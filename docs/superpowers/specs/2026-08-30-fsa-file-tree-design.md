# 設計文件（案 C）：file:// 完整目錄樹（File System Access API）

日期：2026-08-30 ／ 分支：`feature/fsa-file-tree` ／ Roadmap：1.2 / C ／ 目標版本：v1.0.4

## 背景與 Spike 結論

Chrome MV3 封鎖擴充對 file:// 的程式化讀取（見 docs/research/2026-08-30-chrome-mv3-file-url-access-restrictions.md），目前 file:// 頁的檔案頁籤只能顯示降級訊息。Spike（2026-08-30，記錄於 .superpowers/sdd/progress.md）確認替代路線可行：

- file:// 頁面是 secure context；`showDirectoryPicker` 與 `FileSystemDirectoryHandle` 在**content script 隔離世界**皆存在，實際呼叫會打開原生資料夾選擇器。
- 隔離世界的 IndexedDB 在 file:// origin 可正常讀寫（round-trip 驗證過）。
- OPFS 在 file:// 不可用（SecurityError）——與本案無關，持久化走 IDB。
- 待驗收期驗證：真實 handle 的 IDB structured-clone round-trip；**file:// 各頁面是否共享同一 IDB origin**（若各頁 opaque origin 隔離，授權僅存活於單頁——功能仍成立但為降級，驗收確認後記錄實況）。

## UX 流程（僅 file:// 頁；http(s) 完全不變）

1. **未授權**：檔案頁籤內容區顯示引導面板（取代「無法取得目錄列表」）：說明文字 + 主按鈕「選擇資料夾以啟用目錄樹」+ 提示「請選擇目前檔案所在的資料夾或其上層」。
2. **點按鈕**（使用者手勢）→ `showDirectoryPicker({ mode: 'read' })` → 取得 root handle。
3. **映射驗證**：以「URL 尾段比對 + handle 走訪」把 root handle 對應到目前檔案的絕對目錄路徑（演算法見下）。
   - 成功 → `{ handle, rootDirUrl }` 存入 IDB → 以 FSA lister 建立正常目錄樹（懶加載、`../`、高亮、Phase 2 過濾全部沿用）。
   - 失敗（選的資料夾不含目前檔案）→ 訊息「選擇的資料夾不包含目前檔案，請選擇目前檔案所在的資料夾或其上層」，按鈕保留可重試。
   - 使用者取消 picker（AbortError）→ 靜默返回引導面板。
4. **再次造訪/重新整理**：自 IDB 載入 → `handle.queryPermission({ mode: 'read' })`：
   - `'granted'` → 直接建樹（零互動）。
   - `'prompt'`（瀏覽器重啟後常態）→ 顯示「重新授權存取資料夾」按鈕 → 點擊（手勢）→ `requestPermission` → granted 建樹；denied 回引導面板（清除該筆 IDB 紀錄）。
   - 載入失敗/無紀錄 → 引導面板。
5. **`../` 導覽**：樹內連結仍為一般 file:// `<a href>`（整頁導航）。**範圍判定 = `dirUrl.startsWith(rootDirUrl)` 字串前綴**（皆正規化、rootDirUrl 以 `/` 結尾）。範圍內且 IDB 授權可讀 → 沿用授權（若 file:// 各頁共享 IDB origin——此點驗收確認，若不共享則每頁需重授權，屬可接受降級並記錄實況）；範圍外 → 本頁顯示引導面板，**不清除** IDB 授權（導回範圍內的頁面仍零互動建樹）。

## 映射演算法（核心、可 TDD）

問題：`FileSystemDirectoryHandle` 只有 `name` 沒有絕對路徑；需將使用者選的 root 對應到目前 URL 的路徑。

- `urlToDirPath(url: string): string[]`：file:// URL → decode 後的目錄 path segments（去檔名、去 query/hash、**過濾空段**——目錄 URL 尾斜線不得產生空 segment）。
- `rootPathCandidates(rootName: string, dirSegments: string[]): Array<{ rootDir: string[]; remainder: string[] }>`：對每個 `dirSegments[i] === rootName` 的 i（**由深至淺**排序），產生 `{ rootDir: segments[0..i], remainder: segments[i+1..] }`；rootName 不出現 → 空陣列。
- `resolveByCandidates(root: DirHandleLike, candidates): Promise<{ rootDir: string[] } | null>`：依序對每個 candidate 用 `root.getDirectoryHandle(seg)` 鏈式走訪 remainder，全部成功即回傳該 candidate；全部失敗回 null。`DirHandleLike = { getDirectoryHandle(name: string): Promise<DirHandleLike> }`（結構型別，node 測試用假 handle）。
- 邊界：使用者直接選中目前目錄（remainder 空）→ 首個 candidate 即成立；同名段多次出現（如 /a/x/b/x/c）→ 由深至淺嘗試，以 handle 走訪結果裁決。
- **零匹配 fallback**：rootName 不出現在任何段時（磁碟卷根、名稱與路徑不符等），追加最後一個 candidate `{ rootDir: [], remainder: dirSegments }`（自選取根直接走訪完整路徑；成立時 rootDirUrl 記為 `file:///`）。fallback 對 symlink 情境為保守近似（可能低估範圍，導致部分 `../` 導航退回引導面板——安全但非最優，註記於文件）。
- 大小寫：candidate 產生用 JS `===`（大小寫敏感），但 fallback 與 handle 走訪由瀏覽器/OS 解析（macOS APFS 預設大小寫不敏感），實務上可涵蓋大小寫差異案例。

以上三函式置於 `src/core/fsa-path.ts`（core 層，零 chrome、僅結構型別，node 可測）。

## 架構

| 模組                              | 層       | 職責                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/fsa-path.ts`（新）      | core     | 上述三個純/結構型別函式                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/core/fsa-store.ts`（新）     | shell    | IDB 持久化：`saveGrant({handleValue, rootDirUrl})`、`loadGrant()`、`clearGrant()`（db `md-reader-lite`、store `fsa`、key `root`；handle 以 structured clone 存取）                                                                                                                                                                                                                                                                                                                                        |
| `src/core/fsa-listing.ts`（新）   | shell    | `createFsaLister(root, rootDirUrl): (dirUrl) => Promise<DirEntry[]>`——dirUrl 相對化、handle 走訪、`entries()` 枚舉後交純函式轉換；`verifyPermission(handle)` 回傳 'granted' 或 'prompt' 或 'denied'                                                                                                                                                                                                                                                                                                       |
| `src/core/fsa-path.ts` 追加純函式 | core     | `entriesToDirEntries(items, dirUrl): DirEntry[]`（items 為 name + kind('file' 或 'directory') 陣列）——過濾（資料夾 + isMarkdownFile）、排序（資料夾先、字典序）、URL 組裝（encodeURIComponent）；node 可測（編碼、排序、過濾、dot 檔）                                                                                                                                                                                                                                                                    |
| `src/core/file-tree.ts`           | shell 改 | `FileTreeOptions` 增加 `listDir?`（預設 fetchDirListing）與 `onRootStatus?`（callback，根載入成功發 'ok'、失敗/空發 'error'——供 main 在 FSA 模式偵測 root 失效以清授權回面板）                                                                                                                                                                                                                                                                                                                            |
| `src/main.ts`                     | shell 改 | 新增模組層 **`filesPanel: Ele` wrapper**（首次 activateTab('files') 懶掛載）：http 與 file:// 的樹、FSA 引導面板、重新授權面板都渲染在 wrapper 內。**既有四個 fileTree 可見性呼叫點（hide/toggle/raw 清單/mount）全部改為以 filesPanel 為對象**——不再以 nullable fileTree 控可見性；`fileTree` 變數僅供 applyFilter/clearFilter 引用。file:// 判定順序：先 `await fetchDirListing(rootDir)` 探測（現代 Chrome 立即失敗、成本趨零；老 Chromium 成功則走原流程，重複一次抓取可接受）→ 失敗才進 FSA 三態流程 |
| class-name / less / locale        | 改       | `FSA_PANEL`、`FSA_BUTTON`、`FSA_HINT`；四條 i18n 加入 en/zh-CN/zh-TW（ko/uk 依既有慣例 fallback en）                                                                                                                                                                                                                                                                                                                                                                                                      |

型別註：TS 4.8 lib 無 `showDirectoryPicker`/`queryPermission` 型別 → 檔頭最小 ambient 宣告（比照 search-panel 的 Highlight 手法），不裝 @types。

## 狀態機整合

- FSA 引導/重授權面板與樹同屬「檔案頁籤內容」：以 `filesPanel` wrapper 掛載（見架構表），`activateTab`/raw/folderTree 的 show/hide 一律操作 wrapper，內部三態切換由 FSA 流程自管。
- **檔案模式搜尋在無樹時停用**：`openSearch()` 開頭加 `if (activeTab === 'files' && !fileTree) return`（點放大鏡無反應——引導面板本身已說明需先授權；避免出現可輸入但無作用的搜尋框）。
- 授權成功建樹後，`fileTree` handle 由 null 轉為實例：後續搜尋、raw、folderTree 開關路徑不需感知 FSA 的存在（樹的行為與 http 版完全一致）。
- 舊行為保留：FSA 面板僅在 file:// 出現；fetchDirListing 的 XHR fallback 路徑保留不動（老版 Chromium 仍可直接列目錄，此時走原流程、不出引導面板——判定順序：先試原 listing（既有快取 promise），失敗才進 FSA 流程）。

## 錯誤處理

- picker AbortError（取消）→ 靜默回面板；其他例外 → 面板顯示錯誤一行。
- 走訪中 handle 失效（資料夾被移動/刪除；NotFoundError）→ 該節點顯示既有 dir_error 訊息；root 級失效 → file-tree 以 `onRootStatus('error')` 通知 main → 清除 IDB、wrapper 切回引導面板。
- `requestPermission` denied → 清 IDB、回引導面板。
- IDB 不可用（極端）→ 功能仍可用但授權不持久（每次進頁重選）；不擋主流程。

## 隱私

FSA 為使用者手勢主動授權的唯讀存取，範圍僅所選資料夾；授權 handle 僅存本機 IDB。`PRIVACY.md` 增補一句（EN+中文）說明此選用功能；不涉及任何 manifest 權限變更。

## 測試

0. **前置 spike 實況（2026-08-30 已執行）**：CDP `userGesture:true` 可開 picker，但 osascript 受 macOS 輔助使用權限阻擋（error 1002），原生對話框無法無人自動化。裁決：handle→IDB structured clone 為 Chrome 官方文件明載的標準持久化模式，依文件行為續行實作；**真實授權 E2E 改列使用者手動驗收清單**（見下）。若實測 round-trip 失敗，退 session-only 授權（記憶體保存 handle，重整重選）並出 patch。
1. 單元（node，`tests/fsa-path.test.mjs`）：`urlToDirPath`（含 %20 decode、去檔名/query/hash）、`rootPathCandidates`（無匹配/單一/多重同名深至淺）、`resolveByCandidates`（假 handle：首選失敗次選成功、全失敗、remainder 空）≥8 條；另 `entriesToDirEntries`（編碼特殊字元、資料夾先排序、md 過濾、dot 檔）≥3 條。
2. 自動驗收（controller，Playwright）：file:// 頁引導面板呈現（按鈕/提示字樣/無「無法取得目錄列表」）、無樹時搜尋鈕停用、http(s) 頁完全不受影響（迴歸）、raw/folderTree/頁籤狀態機與 filesPanel wrapper 的互動。
   **手動驗收清單（使用者執行，附於 PR/release note）**：點按鈕選 example/ → 樹渲染＋懶加載＋過濾；重新整理 → 零互動建樹；重啟瀏覽器 → 「重新授權」鈕一鍵恢復；選錯資料夾 → mismatch 訊息；取消 → 靜默回面板；跨檔案共享實況回報。
3. 既有 43 條全綠、tsc、建置。

## 非目標

- 寫入/監看（watch）能力、多 root 管理、http(s) 頁的 FSA。
- Firefox/Safari 相容（無此 API）。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.0.4。Subagent 一律 sonnet。
