# Chrome Web Store 上架材料

## 基本

- 名稱：MD Reader Lite（備援：MD Lite Reader、Markdown Lite Viewer——僅改 locales ext_name 一個 commit 可換）
- 類別：Productivity / Tools ；語言：en, zh-TW, zh-CN
- 隱私權政策 URL：https://github.com/swchen44/md-reader-lite/blob/main/PRIVACY.md

## 單一用途聲明（Single purpose）

Render local and online Markdown files as clean, readable pages in the browser.

## 短述（132 字內）

EN: Read local & online Markdown beautifully — offline, zero tracking. Obsidian syntax, folder tree, Mermaid, KaTeX.
ZH: 離線零追蹤的 Markdown 閱讀器：Obsidian 語法、資料夾目錄樹、Mermaid、KaTeX。

## 詳述

EN:
MD Reader Lite turns .md files into clean, readable pages. Open a local file or any URL ending in .md and it renders instantly — fully offline, with zero data collection.
• GFM-style rendering: tables, task lists, footnotes, KaTeX math, Mermaid & Graphviz diagrams
• Obsidian syntax: ![[image|300]] embeds, [[wikilinks|alias]], %%comments%%, callouts, front matter table
• Folder tree side panel to browse sibling documents on http servers
• Outline panel, light/dark/auto themes, per-plugin toggles
• Works on intranets and air-gapped machines — nothing ever leaves your browser
Forked from the open-source md-reader (MIT) with new features; not affiliated with the original store listing.
ZH:
MD Reader Lite 將 .md 檔轉換成簡潔易讀的網頁。開啟本機檔案或任何以 .md 結尾的網址，即時渲染——完全離線，零資料蒐集。
• GFM 標準渲染：表格、工作清單、注腳、KaTeX 數學、Mermaid 與 Graphviz 圖表
• Obsidian 語法：![[image|300]] 嵌入、[[wikilinks|別名]]、%%備註%%、callout 標註框、front matter 屬性表
• 資料夾目錄樹邊欄，瀏覽 HTTP 伺服器上的相鄰文件
• 大綱邊欄、淺色／深色／自動佈景主題、按外掛的開關
• 適用於內網與隔離機器——任何東西都不會離開你的瀏覽器
源自開源 md-reader（MIT）並加入新功能；與原版上架清單無關。

## 權限理由（審核申報用）

| 權限                              | 理由                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `host_permissions` (`*://*/*`)    | 讀取使用者導覽到的 .md 檔內容（自動刷新）與該檔所在資料夾的目錄列表（檔案樹）。不主動存取任何未開啟的網站。 |
| storage                           | 儲存主題、插件開關等設定於本機。                                                                            |
| activeTab                         | 設定變更時通知目前分頁即時套用。                                                                            |
| file URL access（使用者自行開啟） | 渲染本機 .md 檔。                                                                                           |

## 資料使用申報（Data usage disclosure）

全部項目勾「不蒐集」。

## 素材

- 圖示 128×128：自 src/images/logo-stroke.png 縮出（sips -z 128 128）
- 截圖 1280×800 ×3+：存 docs/store-assets/（亮色渲染、目錄樹、popup 設定；Task 9 產出）

## 送審前檢查清單

- [ ] dist zip 以正式建置產出（非 dev）
- [ ] manifest version 與 store 表單一致
- [ ] 隱私政策 URL 可公開存取（repo 需 public）
- [ ] 權限理由填入表單
