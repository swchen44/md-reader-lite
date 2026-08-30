# Roadmap

| 版本 | 案  | 內容                                                                                                                                                                                                                                                                                | 狀態   |
| ---- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.0  | A   | 改名 MD Reader Lite、上架材料、docs 文件組、core/shell 邊界                                                                                                                                                                                                                         | 完成   |
| 1.1  | B   | 規格對齊：GitHub/Obsidian markers 補齊（wikilink #標題/#^block、行內腳註、#tag、可摺疊 callout、自訂任務狀態…以案 B spec 定案）＋ CommonMark/GFM spec.txt conformance harness ＋ Obsidian fixture 對照                                                                              | 規劃中 |
| 1.2  | C   | file:// 完整目錄樹（File System Access API；先 spike：file:// 頁 showDirectoryPicker 可用性、handle 持久化/重授權）                                                                                                                                                                 | 規劃中 |
| 1.3  | D   | GitHub 目錄樹：偵測 github.com / raw.githubusercontent.com 網址時改用 GitHub API（`api.github.com/repos/<o>/<r>/contents/<path>`）列出檔案；manifest 僅加窄範圍 host 權限 `https://api.github.com/*`（單一網域，不觸發廣泛權限深審）；未登入 API 60 req/hr 限流，樹的懶加載天然節流 | 規劃中 |
| 2.x  | —   | PWA/Web 衍生專案：免安裝閱讀器，複用 core 層（產品形態參考 TriptoAfsin/md-viewer-pwa：drop zone、多分頁、離線 PWA）；技術棧屆時另定                                                                                                                                                 | 願景   |

## 維護策略

- 上游 sync：上游 remote 名 upstream，僅挑選性 cherry-pick；版號與上游脫鉤（本 fork 自 1.0.0 起算）。
- 商店版本：送審一次一版，store 材料在 docs/store-listing.md。
- 依據研究：docs/research/ 與 swchen44/personal-knowledge-base-from-ai 的 2026-08-30 Markdown 規格研究。
