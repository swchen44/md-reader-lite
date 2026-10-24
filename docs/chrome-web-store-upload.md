# Chrome 線上應用程式商店：更新既有項目

本次版本：**1.9.0**。既有項目為 [MD Reader Lite](https://chromewebstore.google.com/detail/md-reader-lite/dllkoapplbnpedjjhodcaogiegbhdkdj)，ID：`dllkoapplbnpedjjhodcaogiegbhdkdj`。

## 1. 取得正式 ZIP

從 [GitHub Release v1.9.0](https://github.com/swchen44/md-reader-lite/releases/tag/v1.9.0) 的 Assets 下載 **`md-reader-lite-1.9.0.zip`**。本機已下載的正式附件位於 `dist/release-download-1.9.0/md-reader-lite-1.9.0.zip`；`dist/md-reader-lite-1.9.0.zip` 是本機建置，建議上傳前者以對應發布 receipt。

正式附件大小 **3,998,683 B**，SHA-256：`4a7b0f6d1eaed3aceac941fc03a3b3eceb278cde539b5cfeb67a1ca65b6f41d5`。

這個 ZIP 包含完整建置成品，`manifest.json` 位於最外層，版本為 1.9.0。直接上傳此 ZIP；GitHub 自動產生的 Source code 壓縮檔是原始碼，與商店套件不同。Google 要求新套件的 version 大於既有版本，並包含變更及未變更的全部檔案。[官方套件規格](https://developer.chrome.com/docs/webstore/prepare)

本版移除舊的 `version_name: 1.0.4`，顯示版本改跟隨 `version: 1.9.0`。Google 以數字 version 判斷更新，version_name 只用於顯示；若後台已有更高的數字版本，需再提高 package／manifest／tag 版本，不能只改顯示名稱。[官方版本規則](https://developer.chrome.com/docs/extensions/reference/manifest/version)

## 2. 更新原有項目

1. 開啟 [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)，登入原本上架的 Google 帳號。
2. 選取既有 **MD Reader Lite**，核對上述 extension ID。
3. 到 **Package／套件**，按 **Upload new package／上傳新套件**。
4. 選擇 `md-reader-lite-1.9.0.zip`，等待處理完成，確認版本顯示 **1.9.0**。

這個流程會沿用既有商店網址、extension ID 與使用者。按 [官方更新說明](https://developer.chrome.com/docs/webstore/update) 操作現有項目即可。

## 3. 更新商店資訊

在 **Store listing／商店資訊** 更新介紹及適合的截圖。可直接取用：

- 英文文案：[chrome-store-description-en.md](chrome-store-description-en.md)。
- 繁體中文文案：[chrome-store-description-zh-tw.md](chrome-store-description-zh-tw.md)。
- 新素材：[Anthropic 風格圖片預覽](store-assets/v1.9.0/index.html)；繁中與英文各五張。依本次決定，在地化與通用宣傳影片欄位均留空。[欄位對照與永久重製方式](store-assets/README.md)。
- 隱私權政策：`https://github.com/swchen44/md-reader-lite/blob/main/PRIVACY.md`。

本次重點為 Mermaid 12／31 種圖、Anthropic 圖表與操作介面、可拖寬且不重排文章的浮動欄、GitHub raw 沙盒繪圖，以及可靠的搜尋歷史。

## 4. 填寫 Privacy practices／隱私權實務

Google 要求解釋 manifest 中每項權限，並讓資料使用申報與隱私權政策一致。[官方欄位說明](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)

本版新增 **offscreen**，用途僅限本機 Mermaid 繪圖。可貼入下列英文理由：

> Creates a bundled offscreen document to parse and sanitize Mermaid SVG when a page’s CSP sandbox blocks the embedded renderer. All renderer code is packaged with the extension. Diagram source is processed locally, is not sent to a server or persisted, and the document closes after idle.

既有權限理由：

| 權限        | 可填寫的英文理由                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `storage`   | Stores reader preferences and confirmed search history locally on this device. It does not sync them to a Google account. |
| `activeTab` | Applies user-selected reader settings to the current tab.                                                                 |

**Remote code** 可選 **No, I am not using remote code**：Mermaid／ZenUML、字型 fallback 與其它執行程式都使用套件內程式或本機資源，沒有 CDN 執行碼。文件圖片及 opt-in PlantUML 圖片屬文件／渲染資源，與下載執行程式碼不同。

資料處理依 [PRIVACY.md](../PRIVACY.md) 的實際行為核對：設定與確認的搜尋詞只存本機，沒有分析／追蹤後端；文件本身與使用者選擇的網路功能仍可能發出請求。特別是使用者同時關閉離線模式並開啟 PlantUML 時，圖表原碼會送往使用者指定的伺服器。不要把「沒有 analytics」當作所有資料申報欄位都能略過的依據。

## 5. 提供審查測試方式

若後台要求 Testing instructions，可貼：

> No account or login is required. Open a Markdown URL, such as https://raw.githubusercontent.com/swchen44/md-reader-lite/refs/tags/v1.9.0/example/mermaid-compatibility.md. Mermaid and ZenUML diagrams render locally, including on GitHub raw pages with CSP sandbox. Open the sidebar, search for a term and press Enter to save it locally. Reopen search to see recent terms. The sidebar width can be dragged without changing article layout. Offline Mode is enabled by default; PlantUML is optional and disabled by default.

## 6. 送審與發布

1. 完成後台各分頁要求的欄位並儲存。
2. 按 **Submit for review／提交審查**。
3. 在確認視窗選擇審查通過後自動發布，或先保留待手動發布。
4. 提交後回後台查看審查狀態；若選手動發布，通過後再按 **Publish／發布**。

GitHub Release 與 Chrome 商店送審是兩個獨立流程；GitHub 發布不會自動更新商店。目前教學只準備上傳材料，商店實際上傳／送審／發布狀態以後台為準。[官方送審流程](https://developer.chrome.com/docs/webstore/update)
