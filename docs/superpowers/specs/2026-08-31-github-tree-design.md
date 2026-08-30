# 設計文件（案 D）：GitHub 目錄樹（零權限版）

日期：2026-08-31 ／ 分支：`feature/github-tree` ／ Roadmap：1.3 / D ／ 目標版本：v1.0.5

## 背景與關鍵 Spike（2026-08-31）

raw.githubusercontent.com 無目錄列表（目錄 URL 404），檔案頁籤只能降級。原規劃走 `api.github.com` 窄 host 權限 + background 代理；但實測推翻了前提：

- **content script（隔離世界）發出的 fetch 不受頁面 CSP 限制**——在送出 `default-src 'none'; sandbox` 的 raw 頁上，既有自動刷新（content script 同源 fetch）實測 8/8 成功（Playwright 網路監聽佐證）。
- GitHub API 有完整 CORS（`Access-Control-Allow-Origin: *`，並 expose `x-ratelimit-*` headers），跨域 fetch 從頁面情境即可直接呼叫（主世界實測拿到目錄 JSON）。

因此：**不需要任何 host 權限、不動 manifest、不加 background 程式**——上架申報零影響（使用者「不要太複雜、不可危及上架」的要求以此達成）。附帶修正：narrow-permissions 案文件中「嚴格 CSP 網站失去自動刷新/目錄樹」的敘述是錯的，一併更正（見文件同步）。

## 範圍界定

- 僅 `raw.githubusercontent.com`（本擴充唯一會渲染的 GitHub 網域；github.com blob 頁是 HTML 應用，contentType 檢查本就不渲染）。
- 支援 raw URL 兩形態：
  - 傳統：`/{owner}/{repo}/{ref}/{path…}`（ref 為單段近似；含 `/` 的 branch 屬已知限制）
  - 顯式：`/{owner}/{repo}/refs/heads/{branch}/{path…}`、`/{owner}/{repo}/refs/tags/{tag}/{path…}`（branch/tag 取單段近似）

## UX

- 開 raw md 頁 → 檔案頁籤：樹自動載入（零互動），根 = 目前檔案目錄；懶加載、Phase 2 過濾、搜尋 guard 全沿用。
- `../` → `github.com/{owner}/{repo}/tree/{ref}/{parentPath}`（父層為 repo 根時 `/tree/{ref}`；目前已在 repo 根 → 隱藏 `../`）。
- 檔案連結 = 同 ref 的 raw URL（整頁導航）。
- 流量限制（匿名 60 req/hr/IP；懶加載天然節流）：命中顯示 i18n `github_ratelimit`「GitHub API 流量限制，請稍後再試」；其他 API 錯誤沿用 dir_error。

## 架構（全部 content script 內，無新權限）

| 模組                               | 層                        | 職責                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/github-url.ts`（新）     | core（純函式、node 可測） | `parseRawUrl(url)` → `{ owner, repo, ref, refPrefix, dirPath }` 或 null（refPrefix ∈ ''、'refs/heads/'、'refs/tags/'，重組保留原形態；dirPath 為 decode 後 segments 陣列）；`rawDirUrl(p)`；`apiContentsUrl(p)`（path segment 個別 encodeURIComponent、`?ref=` 帶 encode 後 ref）；`parentTreeUrl(p)`（repo 根回 null）；`contentsToDirEntries(items: Array<{ name; type }>, p)`（type 'dir' 與 isMarkdownFile 檔案；資料夾先、localeCompare；URL 以 encodeURIComponent 組 raw 連結——https 網域用標準編碼即可，無 file:// 的字面集合問題） |
| `src/core/github-listing.ts`（新） | shell                     | `isGithubRawUrl(url): boolean`；`createGithubLister(p): (dirUrl) => Promise<DirEntry[]>`——dirUrl 以 `rawDirUrl` 前綴相對化回 dirPath → `fetch(apiContentsUrl, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/vnd.github+json' } })` → `!ok`：403/429 且 `x-ratelimit-remaining === '0'` → throw `RateLimitError`（`Error` 子類或 `name` 設定），否則 throw 一般 Error → JSON → `contentsToDirEntries`                                                                                                                |
| `src/core/file-tree.ts`            | shell 改                  | option `parentHref?`（型別為 string 或 null 或 undefined：undefined = 現行 parentOf 行為；null = 隱藏 `../`；string = 指定 href）；root 與展開兩個 catch：`err?.name === 'RateLimitError'` → 顯示 `github_ratelimit`，否則沿用 dir_error                                                                                                                                                                                                                                                                                                   |
| `src/main.ts`                      | shell 改                  | `buildTree(listDir?, parentHref?)` 第二參數透傳；`initFilesContent` 判定鏈：probe 失敗 → `parseRawUrl` 非 null → `buildTree(createGithubLister(p), parentTreeUrl(p))` → 否則 file:// FSA → 否則原降級                                                                                                                                                                                                                                                                                                                                      |
| locale                             | 改                        | `github_ratelimit` ×3（en/zh-CN/zh-TW）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

無新 class、無樣式變更、無 manifest 變更、無 background 變更。

### 介面定案（設計審查後）

- **buildTree 樹種區分（HIGH 修正）**：`buildTree(listDir?, kind: 'default' 或 'fsa' 或 'github' = 'default', parentHref?)`；`onRootStatus('error')` 的「清 FSA 授權回引導面板」邏輯**僅在 kind === 'fsa'** 時執行——GitHub 樹失敗只顯示樹內訊息，絕不觸碰 FSA grant。
- **路徑註冊表取代 URL 回推**：`createGithubLister(p, rootDirUrl)` 內部維護 `knownDirs: Map<string, string[]>`，seed `rootDirUrl → p.dirPath`；每次列目錄後將子資料夾 `entry.url → [...dirPath, entry.name]` 註冊。`listDir(dirUrl)` 由 Map 查 dirPath，miss 則 throw——完全不做 URL 字串切割回推，root 的瀏覽器原生編碼與自建 URL 的 encodeURIComponent 差異就無關緊要。
- **GitHub 判定提前**：`initFilesContent` 開頭先 `parseRawUrl(href)`——非 null 直接進 GitHub 分支，**跳過 probe**（省掉必 404 的請求）；`isGithubRawUrl` 移除（parseRawUrl null 判定即可，不留死碼）。
- **refs/ 形態保留**（GitHub「Copy raw URL」現產此形態，為主要使用情境）＋防歧義守門：顯式形態需滿足最少段數（owner、repo、'refs'、heads 或 tags、ref、≥1 路徑段）才成立，否則按傳統形態解析。
- **ratelimit 分類抽 core 純函式**：`classifyGithubFailure(status: number, ratelimitRemaining: string | null): 'ratelimit' 或 'error'`（403/429 且 remaining === '0' → 'ratelimit'）——進單元測試；shell 端讀 `res.headers.get('x-ratelimit-remaining')` 後呼叫。
- `RateLimitError` = 一般 `Error` 實例 + 建構後明確設 `err.name = 'RateLimitError'`（不做子類）。
- file-tree 兩個 catch（root `.catch(() => …)` 與展開 `catch {`）需改為具名 `err` 綁定以讀取 `err?.name`——列為明確編輯項。
- `AbortSignal.timeout` 沿用 dir-fetch.ts 的 `(AbortSignal as any).timeout(…)` cast 慣例（TS 4.8 lib 未含型別）。
- Playwright 驗收命中真實 ratelimit（403/429）時：不重試，改印手動驗收清單並以既有 52+ 測試與單元結果為過關準據。

## 錯誤處理

- API 404 / 私有 repo 匿名不可見 / 5xx → dir_error（root 級與節點級沿用既有訊息）。
- ratelimit → 專屬訊息（root 與展開皆同）。
- `parseRawUrl` 回 null（非預期 raw 形態）→ 走原降級（dir_error），不進 GitHub 分支。
- probe（`fetchDirListing(rootDir)`）對 raw 目錄 URL 404 → 快速失敗進判定鏈（實測毫秒級）。

## 文件同步（Task 內完成）

- `docs/research/2026-08-30-chrome-mv3-file-url-access-restrictions.md` 加更正註記 + `docs/superpowers/specs/2026-08-30-narrow-permissions-design.md` 不改（歷史文件），改在 `docs/lesson_learn.md` 加第 10 條：**content script fetch 豁免頁面 CSP**（narrow-permissions 案的「CSP 降級」推定經 2026-08-31 實測推翻；自動刷新與目錄樹在嚴格 CSP 網站其實可用；背景代理唯一不可替代的用途只剩「需要 host 權限的非 CORS 端點」）。
- `PRIVACY.md`：一句（EN+中文）——在 GitHub raw 頁面使用檔案樹時，擴充會匿名呼叫 GitHub 公開 API 列目錄；無 token、無其他資料傳輸。
- `docs/store-listing.md`：不需改（權限零變更）。

## 測試

1. 單元（node，`tests/github-url.test.mjs`）：parseRawUrl（傳統／refs-heads／refs-tags／非 GitHub → null／repo 根檔案 dirPath 空／path 含 %20 decode／顯式形態段數不足回退傳統解析）、rawDirUrl 與 apiContentsUrl 重組（兩形態 + 編碼）、parentTreeUrl（深層／一層／根 → null）、contentsToDirEntries（過濾排序編碼）、classifyGithubFailure（403+0→ratelimit、429+0→ratelimit、403+非 0→error、500→error）≥12 條。
2. Playwright 自動驗收（全自動、真網路，對 `swchen44/md-reader-lite` 自家 repo）：raw 頁檔案頁籤自動列出 docs/ 內容；懶展開 `superpowers/`；`../` href = github.com tree 頁；Phase 2 過濾可用；http 與 file:// 迴歸。網路不穩時重試一次後改列手動清單。
3. 既有 52 條 + 新單元全綠；tsc；建置；`git diff` 確認 manifest 未變。

## 非目標

- github.com blob 頁、私有 repo token、gist、enterprise、多段 branch 的傳統形態精確解析、API 快取持久化。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.0.5。Subagent 一律 sonnet；表格禁裸 `|`。
