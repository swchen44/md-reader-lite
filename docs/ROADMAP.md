# Roadmap

| 版本 | 案  | 內容                                                                                                                                                                                                                                                                                                                                                   | 狀態 |
| ---- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 1.0  | A   | 改名 MD Reader Lite、上架材料、docs 文件組、core/shell 邊界                                                                                                                                                                                                                                                                                            | 完成 |
| 1.1  | B   | 規格對齊：GitHub/Obsidian markers 補齊（wikilink #標題/#^block、行內腳註、#tag、可摺疊 callout、自訂任務狀態…以案 B spec 定案）＋ CommonMark/GFM spec.txt conformance harness ＋ Obsidian fixture 對照；範圍定案改為設定面板對齊商店版（popup 三頁籤、13 flat key）＋頁內浮動選單五項；已完成並發布 v1.1.0                                             | 完成 |
| 1.2  | C   | file:// 完整目錄樹（File System Access API；先 spike：file:// 頁 showDirectoryPicker 可用性、handle 持久化/重授權）                                                                                                                                                                                                                                    | 完成 |
| 1.3  | D   | GitHub 目錄樹（零權限版）：raw.githubusercontent.com 頁由 content script 直呼 GitHub Contents API 列出檔案（實測 CORS 全開、CSP 不擋 content script fetch）；零 host 權限、零 manifest 變更；knownDirs 路徑註冊表防 URL 回推；未登入 API 60 req/hr 限流，懶加載天然節流＋ ratelimit 專屬訊息；已完成並發布 v1.0.5                                      | 完成 |
| 1.4  | E   | 側邊欄搜尋：側欄新增搜尋框（第三個頁籤或大綱頁籤上方），即時過濾大綱標題並高亮命中字串、點擊跳轉至該標題；進階為當前文件全文搜尋（命中段落列表 + 跳轉 + 內文高亮）。純前端、無新權限（參考商店 3.x 版的 outline search 形態）＋ Phase 2 形態一致（祖先鏈脈絡、檔案樹過濾）                                                                             | 完成 |
| 1.5  | F   | 圖表檢視器：Mermaid/Graphviz SVG 右下角懸浮控制列（放大/縮小/重置/全螢幕 Expand diagram），滾輪縮放與拖曳平移；採 `@panzoom/panzoom`（MIT、~4KB、零依賴，經拆解確認商店 3.x 版即用此套：panzoom\* 事件與 contain/pinchAndPan API 指紋吻合，minScale 0.5 / maxScale 8）；全螢幕用 Fullscreen API 自包 UI；同套可日後複用到圖片畫廊；已完成並發布 v1.1.0 | 完成 |
| 2.x  | —   | PWA/Web 衍生專案：免安裝閱讀器，複用 core 層（產品形態參考 TriptoAfsin/md-viewer-pwa：drop zone、多分頁、離線 PWA）；技術棧屆時另定                                                                                                                                                                                                                    | 願景 |

## 維護策略

- 上游 sync：上游 remote 名 upstream，僅挑選性 cherry-pick；版號與上游脫鉤（本 fork 自 1.0.0 起算）。
- 商店版本：送審一次一版，store 材料在 docs/store-listing.md。
- 依據研究：docs/research/ 與 swchen44/personal-knowledge-base-from-ai 的 2026-08-30 Markdown 規格研究。
