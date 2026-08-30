# 設計文件（案 E）：側邊欄搜尋（大綱過濾 + 全文搜尋）

日期：2026-08-30 ／ 分支：`feature/sidebar-search` ／ Roadmap：1.4 / E

## 背景與範圍

參考商店 3.x 版的 outline search 形態，在 MD Reader Lite 側邊欄加入搜尋：**標題（大綱）過濾**與**當前文件全文搜尋**一次交付。純前端、無新權限、無新 runtime 依賴。

## UI 行為

- 頁籤列右側新增放大鏡按鈕（與「大綱/檔案」同列）。
- 點擊後：頁籤列切換為搜尋輸入框（自動聚焦）+ ✕ 關閉鈕；側欄內容區改顯示**搜尋結果面板**（蓋住原頁籤內容，原頁籤狀態保留）。
- 結果面板兩組清單：
  - **標題命中 n**：命中的大綱標題（保留層級縮排樣式），命中子字串以高亮 span 標示；點擊跳轉該標題錨點。
  - **內文命中 n**：命中區塊的摘要（命中前後各約 30 字、頭尾以 … 截斷），命中子字串高亮；點擊 `scrollIntoView({ block: 'center' })` 並對目標區塊做約 1.5 秒底色閃爍。
- 內文命中上限 100 筆，超過時清單尾顯示「僅列出前 100 筆」。
- 空查詢：顯示「輸入關鍵字搜尋標題與內文」提示；零命中：顯示「無符合結果」。
- 關閉（✕ 或 Esc）：清空查詢、移除文件內所有搜尋高亮、恢復原頁籤與其內容。
- 輸入 debounce 150ms；比對為**大小寫不敏感的純子字串**（不支援 regex）。
- 搜尋期間文件內所有命中以 CSS Custom Highlight API 上色（見下）；點擊某筆結果時該筆額外閃爍定位。

## 架構

| 模組                                                       | 層                             | 職責                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/doc-search.ts`（新）                             | core（零 chrome、零 DOM 依賴） | 純函式索引與比對：`buildIndex(entries: SearchEntry[]): SearchIndex`、`search(index, query): SearchResult`。`SearchEntry = { kind, text, ref }`（kind 為 'heading' 或 'block'；`ref` 由呼叫端攜帶，core 不解讀）。回傳命中清單含`ranges: [start, end][]`（單一 entry 內所有命中位置）與 `snippet(text, ranges)` 工具（截 30 字上下文）。 |
| `src/core/search-panel.ts`（新）                           | shell                          | DOM 採集（自 `.md-reader__markdown-content` 收集標題與區塊節點 → SearchEntry[]，`ref` 存元素參照）、結果面板渲染（Ele）、CSS Highlight 套用/清除、跳轉與閃爍、輸入框與 debounce。export `createSearchPanel({ getArticle, getHeadings, localize })` 回傳 `{ button, panel, open(), close(), rebuild() }`。                               |
| `src/main.ts`（改）                                        | shell                          | 掛載按鈕與面板、開關時切換頁籤列/內容區顯示、`globalEvent.on('contentRendered', …)` 觸發 `rebuild()`、Esc 處理、與 raw 檢視/摺疊側欄狀態機整合（搜尋開啟時進 raw → 先 close()）。                                                                                                                                                       |
| `src/config/class-name.ts`、`src/style/index.less`、locale | 改                             | 新 class 常數、樣式、i18n 字串（en/zh-CN/zh-TW：search placeholder、標題命中/內文命中/無符合結果/僅列出前 100 筆）。                                                                                                                                                                                                                    |

## 採集規則（DOM → SearchEntry）

- 標題：沿用 `renderSide()` 已產生的 heading 元素清單（`getHeads`），`text = textContent`（去除 `#` 錨點字元）。
- 區塊：`.md-reader__markdown-content` 直下與巢狀的 `p, li, blockquote > p, td, th, pre code, figcaption` 等**葉層級**文字區塊；以「元素的 `innerText` 非空」為準；同一文字不因巢狀重複收集（li 內含 p 時只收內層）。標題元素不重複進入區塊組。
- 隱藏內容不採集（`offsetParent === null` 略過；`%%` 註解已在渲染期移除、KaTeX 的輔助節點因不可見而排除）。

## 高亮機制

- **文件內**：CSS Custom Highlight API——對每筆命中建立 `Range`（以 TreeWalker 在區塊內定位文字節點的 offset），全部塞進單一 `Highlight` 物件註冊為 `search-hit`，樣式 `::highlight(search-hit) { background: …; color: … }`（亮暗主題各一組變數）。清除 = `CSS.highlights.delete('search-hit')`，零 DOM 變動。
- **降級**：`CSS.highlights` 不存在時（理論上 Chrome 105+ 皆有），文件內不高亮，結果清單與跳轉、閃爍不受影響。
- **側欄結果清單**：自家 DOM，命中子字串以 `<span class="…-hit">` 包裹。
- **閃爍定位**：對目標元素加 class（CSS transition 底色 1.5s 後移除）。

## 狀態機整合（沿用既有模式）

- 搜尋面板開啟時：`sideTabs` 的頁籤鈕隱藏、輸入列顯示；`mdSide` / `fileTree` 皆隱藏、`searchPanel` 顯示。關閉時呼叫既有 `activateTab(activeTab)` 恢復。
- raw 檢視切換：進 raw 前若搜尋開啟先 `close()`；raw 期間放大鏡鈕隨 `sideTabs` 一併隱藏（納入既有 toggleRaw 清單即可，無新增元素——輸入列與面板都掛在既有容器內）。
- `folderTree` 設定關閉不影響搜尋（搜尋屬大綱側，不依賴檔案頁籤）。
- 文件重渲染（自動刷新、插件切換、主題重渲染）：`contentRendered` 事件 → `rebuild()`；若搜尋開啟且有查詢，重跑一次 `search` 更新結果與高亮。

## 錯誤處理

- 查詢期間文件被重渲染：`rebuild()` 後舊元素參照全部丟棄重採集，不持有 stale ref。
- 命中元素已不在文件（極端競態）：點擊時 `ref.isConnected` 檢查，不在則忽略該次點擊並重跑 search。
- 超長文件：採集一次 O(n)，搜尋 O(n×m)；100 筆上限保護渲染；不做 worker（YAGNI）。

## 測試

1. **單元（node --test，新檔 `tests/doc-search.test.mjs`）**：`buildIndex`/`search` 純函式——大小寫不敏感、多命中 ranges、CJK 子字串、空查詢、100 筆上限、snippet 截斷（頭/中/尾命中三種）。
2. **Playwright 驗收**：開 obsidian-demo → 點放大鏡 → 輸入關鍵字 → 斷言兩組結果數、點標題命中跳轉（scrollY 變化）、點內文命中閃爍 class 出現、Esc 後高亮清除（`CSS.highlights.size === 0`）且頁籤恢復。
3. 既有 30 條測試 + tsc + 建置不退化。

## 非目標（YAGNI）

- regex / 模糊搜尋、跨檔案搜尋、搜尋歷史、全域鍵盤快捷鍵（chrome commands）——之後再議。
- Web Worker 索引、虛擬捲動清單。

## Git

分支 `feature/sidebar-search`；commit 依模組切（core 搜尋引擎+測試 → search-panel UI → main.ts 整合+樣式+locale → 驗收素材如需要）；訊息四段（Why/What/How/Boundary）+ trailers。
