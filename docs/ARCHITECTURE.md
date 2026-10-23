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

| 模組                                 | 職責                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| src/manifest.json、src/background.ts | MV3 宣告；background 僅轉發 storage 訊息與 actionMap（無 fetch 代理） |
| src/main.ts                          | content script 掛載、側邊欄/頁籤/raw 狀態機                           |
| src/core/dir-fetch.ts                | fetchDirListing（頁面情境同源 fetch + file:// XHR fallback）          |
| src/core/file-tree.ts                | 樹 UI（DOM/Ele）                                                      |
| src/popup/\* 、src/core/storage.ts   | 設定 UI 與持久化                                                      |

## Mermaid 12 執行邊界

- `src/plugins/mermaid-block.ts` 與純 queue/style 模組同步產生安全原碼、排程與設定；不把整份 Markdown 改為 async。
- `src/plugins/mermaid-renderer.ts` 是 content-script adapter，管理 generation、active completion 與搜尋更新；`src/main.ts` 在有效圖表完成後還原閱讀位置，使用者捲動會取消。
- `src/core/mermaid/frame-transport.js` 雖位於 core 目錄，**是 extension/browser adapter，並非可攜純 core**：使用 chrome.runtime 取得本機 frame URL。PWA 移植時須替換此 transport，而非照搬 Chrome API。
- `src/core/mermaid/frame-runtime.js` 在獨立本機 extension page 執行 Mermaid／ZenUML，使用 renderer-only CSP、private MessagePort 與序列佇列。`resource-preflight.mjs`／`css-policy.mjs` 檢查輸入，`svg-policy.js` 清理輸出並在受限文件內保留 HTML label typography。這些 DOM renderer 模組也不是 Node 純函式。
- application 與 renderer 是獨立 webpack compilations，不共用跨世界 chunk。沒有 Mermaid 的文章不載入 engine frame；正常 Mermaid 不需網路。31 圖種與安全負例的產品驗收以 migration plan 為準。
- popup 全部分頁共用 `src/popup/index.css` tokens 與現有 SMUI 元件，固定 Anthropic 編輯風格；它不隨文章 CSS 或 Mermaid Original 切換。儲存 schema 未變，明確選擇 Original 的使用者不被預設值遷移覆蓋。

## 浮動側欄

`src/main.ts` 是 overlay shell：管理開關、焦點、pointer capture、取消與儲存；文章容器不再以 sideWidth 保留 padding。`src/core/settings.ts` 的 viewport-aware clamp 保持純函式，畫面縮窄只限制顯示值，不修改偏好。

FileTreeHandle.closeMenus 是 production lifecycle 介面，由 shell 在側欄收合與 raw 切換呼叫，清理移到 body 的排序子選單；不能依賴祖先 inert 控制 portal。側欄寬度與文章寬度是獨立設定。核准行為及永久回歸見 [Floating Sidebar Test Plan](testing/floating-sidebar.md)。

設定回覆的分頁歸屬在 background 收到請求時決定：content script 使用 sender.tab.id，popup 在 storage.set 前取得 active tab，快捷鍵在 commands 讀取 storage 前取得 active tab。後續寫入或回覆不再查詢 active tab；目標已關閉或沒有 reader 時，只儲存設定，不轉送其他分頁。hiddenSide 的 updateSideVisibility 套用明確狀態，重複回覆不反轉畫面；快捷鍵的 toggleSide 仍依實際可見狀態切換，保留窄頁首次收起的行為。

拖曳只由擁有 capture 的 pointerId 結束，blur／pagehide／viewport resize 則取消整次預覽。取消依目前 viewport 重新限制儲存的偏好，清理以 finally 保證解鎖；舊 content script 遇到 extension reload，儲存失敗不阻塞本機拖曳或收合。鍵盤無可見變化時不覆寫偏好；raw lifecycle 同時隱藏並 inert 把手，輸入 handler 也檢查 raw／收合狀態。Menu 在把手之上，後建立的 settings／path 浮層仍在 Menu 之上。

## 驗收檢查

    grep -n "chrome" src/core/markdown.ts src/core/graphviz.ts src/core/dir-listing.ts src/plugins/obsidian.ts src/plugins/alert.ts src/plugins/graphviz-block.ts src/config/md-plugins.ts   # 必須零命中

## 約定

- core 新增檔案一律零 chrome/DOM-extension 依賴；需要瀏覽器 API 時放 shell 並以參數注入。
- PWA 衍生時：core 原樣搬走，shell 以 Web 檔案 API/URL 重寫。
