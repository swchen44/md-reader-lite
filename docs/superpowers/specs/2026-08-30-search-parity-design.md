# 設計文件（案 E Phase 2）：搜尋形態一致增量（祖先鏈脈絡 + 檔案樹過濾）

日期：2026-08-30 ／ 分支：`feature/search-parity` ／ 依據：docs/research/2026-08-30-store-3x-search-teardown.md

## 背景

商店 3.6.x 拆解顯示其搜尋為兩個樹過濾器（大綱、檔案樹），比對語意與 Lite 案 E 相同，但呈現有兩處差異。本案補齊：

1. **標題命中的祖先鏈脈絡**：商店版顯示規則「自己命中 ∨ 有命中後代 → 顯示」，未命中的祖先標題仍顯示提供層級脈絡。
2. **檔案樹過濾**：商店版檔案頁籤有獨立過濾器。

## 行為設計

### 1. 搜尋面板的標題組加入祖先脈絡

- 「標題命中 n」組的清單改為：命中標題 + 其**未命中祖先標題**（依標題層級 h1-h6 推導祖先：一個標題的祖先是其前方最近的、層級較小的標題，遞迴至 h1）。
- 祖先項樣式淡化（`opacity: .55`、無命中高亮），仍可點擊跳轉；命中項維持現樣式。
- 排序維持文件順序；n 只計**命中數**，不含脈絡項。
- 純函式實作於 core：`withAncestors(headings: HeadingLevelEntry[], hitIndexes: number[]): Array<{ index: number; isContext: boolean }>`，`HeadingLevelEntry = { level: number }`（僅需層級）；shell 端把 heading 元素的 tagName 轉 level。可 node 測試（巢狀、多命中共用祖先去重、h1 命中無祖先、跳級標題 h1→h3）。

### 2. 檔案頁籤的就地樹過濾

- 搜尋鈕行為改為**依當前頁籤分流**（對齊商店版 folder/outline 兩個過濾器）：
  - `activeTab === 'outline'` → 現有行為（結果面板：標題組含祖先脈絡 + 內文組）。
  - `activeTab === 'files'` → **不開結果面板**；輸入框就地過濾檔案樹：
    - 顯示規則：節點名命中 ∨ 有命中後代（已載入者）→ 顯示；**資料夾名命中 → 其已載入子樹全顯示**（對齊商店 parentVisible 語意）。
    - 命中子字串在節點名以高亮 span 標示（實作為 label 文字重建：清除時還原純文字）。
    - 只過濾**已載入**節點；輸入非空時樹底顯示提示「僅過濾已載入項目」（i18n）。過濾中展開資料夾 → 新載入子層立即套用目前過濾。
    - 空查詢 = 不過濾（全部顯示、無高亮）。
  - Esc/✕：兩模式一致——清除（過濾/高亮/面板）並恢復原頁籤視圖。
- 檔案模式下不做內文搜尋、不動文件內高亮（維持大綱模式專屬）。
- 切換頁籤時若搜尋開啟：先 `closeSearch()`（簡化狀態機；頁籤鈕在搜尋開啟時本就隱藏，此規則僅防禦性）。

## 架構變更

| 模組                        | 變更                                                                                                                                                                                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/doc-search.ts`    | 新增 `withAncestors`（純函式）+ 型別；既有 API 不變                                                                                                                                                                                                   |
| `tests/doc-search.test.mjs` | 追加 withAncestors 測試（≥4 條）                                                                                                                                                                                                                      |
| `src/core/file-tree.ts`     | `createFileTree` 回傳增加 `applyFilter(query: string): void` 與 `clearFilter(): void`；內部：節點註冊表（name、label 元素、li、isDir、parent li）於渲染時登錄；filter 走訪已載入節點套 hidden class 與名稱高亮；懶加載完成 callback 內重套現行 filter |
| `src/core/search-panel.ts`  | 標題組渲染改吃 `withAncestors` 結果（context 項樣式）；新增 `getQuery(): string` 供檔案模式重用輸入框；面板本身在檔案模式不顯示                                                                                                                       |
| `src/main.ts`               | 接線：`getMode: () => activeTab`、`onFilesQuery: q => fileTree?.applyFilter(q)`；檔案模式 openSearch 不 mount/show 面板；closeSearch 依模式清理（clearFilter 或面板清理）；不新增 searchMode 狀態（見介面定案）                                       |
| class-name / less / locale  | `TREE_FILTERED_HIDDEN`、`TREE_NAME_HIT`、`SEARCH_ITEM_CONTEXT`（祖先脈絡項，opacity .55）；`search_filter_loaded_only` 字串 ×3 語系                                                                                                                   |

### 介面定案（設計審查後）

- `createSearchPanel` 新增兩個 option：`getMode: () => 'outline' | 'files'` 與 `onFilesQuery: (q: string) => void`。內部 debounce 後的處理：`getMode()==='files'` 時**只呼叫 `onFilesQuery(q)`，絕不執行 `search()`／文件高亮／面板渲染**（Critical 防漏）；`'outline'` 時維持現行 `run()`。`focus()`、`clear()` 同樣依模式分流（files 模式 clear → `onFilesQuery('')`）。search-panel 不 import file-tree，由 main 居中接線（`onFilesQuery: q => fileTree?.applyFilter(q)`）。
- 不新增 `searchMode` 狀態：搜尋開啟期間兩個頁籤鈕皆隱藏、`activeTab` 不可能變動，`getMode` 直接讀 `activeTab`。
- `withAncestors` 輸入推導：search-panel 於 collect 時保留**完整文件序 heading entry 陣列**（含由 tagName 轉出的 level）；`search()` 回傳的命中以 entry 物件同一性（indexOf）映射回 `hitIndexes`。doc-search 不需新增查詢 API。
- 命中優先於脈絡：同一標題既是命中又是他人祖先時 `isContext=false`（新增第 5 條單元測試驗證）。
- file-tree 過濾：
  - 節點註冊表為**扁平陣列**（record：plainName、labelEle、li、isDir、parentLi），**絕不以 name 作 key**（重名檔案跨資料夾必然存在）。
  - `applyFilter(q)`：內部 `q.trim()`；**每次**呼叫都從 record 的 plainName 重建 label（先還原純文字再上高亮 span，保證連續按鍵不巢狀）；`applyFilter('')` 與 `clearFilter()` 走同一條程式路徑（還原 label + 移除 hidden + 清提示）。
  - 模組層 `currentQuery`：`applyFilter` 寫入；**兩個渲染完成點**（根目錄首次載入的 `.then` 與資料夾展開完成）都在渲染後讀 `currentQuery` 重套過濾（涵蓋「搜尋時根載入仍在途」競態）。
  - `../` 導覽列**不進註冊表、永遠顯示**（明文豁免）。
  - 目前檔案（TREE_FILE_ACTIVE）不豁免：名稱未命中一樣隱藏（對齊商店語意）。
  - 資料夾名命中：顯示其已載入子樹，**不自動展開**（維持使用者展開狀態）。

## 錯誤處理

- 過濾中節點被重載（fetch 失敗重試、重渲染）：註冊表以 li 存活（`isConnected`）為準，走訪時跳過失聯節點。
- 檔案模式搜尋時根目錄載入仍在途（activateTab('files') 同步建樹但 fetch 非同步）：兩個渲染完成點統一重套 `currentQuery`（見介面定案），無需特例。
- 過濾把整棵樹濾空：顯示既有訊息樣式「無符合結果」+「僅過濾已載入項目」。

## 測試

1. 單元：`withAncestors`（巢狀／共用祖先去重／h1 命中無祖先／跳級 h1→h3／**命中優先於脈絡**，共 5 條）。
2. Playwright 驗收：
   - 大綱模式：命中 h3 時其 h2/h1 祖先以淡化樣式出現且可點擊；n 不含脈絡項。
   - 檔案模式：檔案頁籤開搜尋 → 無面板、樹就地過濾；資料夾名命中顯示整棵已載入子樹；名稱高亮；展開資料夾後新節點套用過濾；提示字樣存在；Esc 還原全樹與純文字 label；**`CSS.highlights` 全程為空（檔案模式絕不觸發文件高亮）**；連續按鍵 label 無巢狀 span。
   - 迴歸:大綱模式全流程、raw、folderTree 開關。
3. 既有 38 條 + 新單元測試全綠。

## 非目標

- 未載入子樹的預抓過濾、跨資料夾遞迴搜尋。
- 檔案模式的內文搜尋/文件高亮。
- 大綱頁籤的就地過濾（維持結果面板形態；祖先鏈已提供同等脈絡）。

## Git

分支 `feature/search-parity`；commit 依模組切；四段訊息 + trailers。完成後合入 main 並發 v1.0.3。
