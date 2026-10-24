# Chrome Web Store 上架材料

現有項目更新流程、正式 ZIP 與可貼上的權限理由見 [Chrome 商店更新指南](chrome-web-store-upload.md)。本次版本為 1.9.0；GitHub 發布狀態與驗證見 [release receipt](releases/1.9.0.md)，商店狀態以後台為準。

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

完整文案集中維護，避免不同副本漂移：

- 英文：[chrome-store-description-en.md](chrome-store-description-en.md)。
- 繁體中文：[chrome-store-description-zh-tw.md](chrome-store-description-zh-tw.md)。

  1.9.0 包含 Mermaid 12／31 種圖、預設 Anthropic 風格、GitHub raw 沙盒繪圖、可記憶寬度的浮動側欄，以及可靠的本機搜尋歷史。隱私文案須保留文件媒體與 opt-in PlantUML 的網路邊界，不使用「所有情況都零網路」等絕對敘述。

## 權限理由（審核申報用）

| 權限                              | 理由                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `storage`                         | 儲存主題、插件開關等設定於本機。                                                                         |
| `activeTab`                       | 設定變更時通知目前分頁即時套用。                                                                         |
| `offscreen`                       | 在 GitHub raw 等沙盒頁面，以插件私有隱藏文件執行本機 Mermaid DOM／SVG 處理；不外送或儲存原碼，閒置關閉。 |
| file URL access（使用者自行開啟） | 渲染本機 .md 檔。                                                                                        |

自此版本起不再申請 host 權限：同源請求由頁面情境發出。

## 資料使用申報（Data usage disclosure）

依 [PRIVACY.md](../PRIVACY.md) 與後台目前的欄位逐項核對。設定／確認的搜尋詞只存本機、沒有追蹤後端；使用者主動啟用 PlantUML 並關閉離線模式時，圖表原碼會送往指定伺服器。資料申報須反映這些實際行為；Remote code 與一般圖片／渲染資源應分開判斷。具體操作見更新指南。

## 素材

- 圖示 128×128：自 src/images/logo-stroke.png 縮出（sips -z 128 128）
- 1.9.0 新素材：繁中／英文各五張 1280×800 RGB PNG，見 [預覽](store-assets/v1.9.0/index.html) 與 [欄位對照](store-assets/README.md)。兩個宣傳影片欄位均留空；原有三張截圖保留為歷史素材。

## 送審前檢查清單

- [ ] dist zip 以正式建置產出（非 dev）
- [ ] manifest version 與 store 表單一致
- [ ] 隱私政策 URL 可公開存取（repo 需 public）
- [ ] 權限理由填入表單
