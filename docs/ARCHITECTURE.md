# Architecture — core / shell 邊界

目的：渲染核心可攜（未來 PWA/Web 版直接複用），extension 專屬邏輯隔離在 shell。

## core（可攜層）— 禁止 import chrome

| 模組                                    | 職責                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| src/core/markdown.ts                    | markdown-it 組裝、mdRender、front matter gating           |
| src/core/graphviz.ts                    | graphviz 判定與 placeholder                               |
| src/plugins/obsidian.ts                 | Obsidian 語法（wikilink/embed/註解/callout/front matter） |
| src/plugins/alert.ts、graphviz-block.ts | markdown-it 層插件                                        |
| src/config/md-plugins.ts                | 插件清單                                                  |
| src/core/dir-listing.ts                 | 目錄頁 HTML → DirEntry[] 純解析                           |
| @md-reader/theme                        | 主題樣式                                                  |

## shell（extension 專屬）

| 模組                                 | 職責                                             |
| ------------------------------------ | ------------------------------------------------ |
| src/manifest.json、src/background.ts | MV3 宣告與訊息代理（fetch/fetchDir/actionMap）   |
| src/main.ts                          | content script 掛載、側邊欄/頁籤/raw 狀態機      |
| src/core/dir-fetch.ts                | fetchDirListing（chrome.runtime + XHR fallback） |
| src/core/file-tree.ts                | 樹 UI（DOM/Ele）                                 |
| src/popup/\* 、src/core/storage.ts   | 設定 UI 與持久化                                 |

## 驗收檢查

    grep -n "chrome" src/core/markdown.ts src/core/graphviz.ts src/core/dir-listing.ts src/plugins/obsidian.ts src/plugins/alert.ts src/plugins/graphviz-block.ts src/config/md-plugins.ts   # 必須零命中

## 約定

- core 新增檔案一律零 chrome/DOM-extension 依賴；需要瀏覽器 API 時放 shell 並以參數注入。
- PWA 衍生時：core 原樣搬走，shell 以 Web 檔案 API/URL 重寫。
