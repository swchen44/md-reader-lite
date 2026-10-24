# Chrome 商店圖片：Anthropic 編輯風格

本次套件：**1.9.0**。先開啟 [預覽與下載頁](v1.9.0/index.html)，再依後台欄位上傳。

## 欄位對照

| 後台欄位                 | 使用檔案／填法                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| 繁體中文／在地化螢幕截圖 | `v1.9.0/zh-TW/01-reading.png` 到 `05-personalize.png`，共 5 張                                        |
| 通用螢幕截圖             | `v1.9.0/common/01-reading.png` 到 `05-personalize.png`，英文共 5 張                                   |
| 在地化宣傳影片           | **留空**                                                                                              |
| 通用宣傳影片             | **留空**                                                                                              |
| `offscreen` 權限理由     | [英文可貼文字](v1.9.0/offscreen-permission-en.txt)；[中文說明](v1.9.0/offscreen-permission-zh-TW.txt) |

圖片依序為閱讀、Mermaid、浮動導覽、搜尋歷史、個人化設定。每張均 **1280×800、24 位元 RGB PNG、無 alpha**，可直接拖入對應欄位。兩組各五張；預覽頁與 `captures/` 的原始取景檔供檢查來源。

依使用者決定，這次只提供圖片，兩個影片網址欄位都留空。Google 官方也列宣傳影片為選填，螢幕截圖至少一張、最多五張。[官方商店欄位](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)、[圖片規格](https://developer.chrome.com/docs/webstore/images)

## 設計與來源

- 紙色 `#faf9f5`、墨色 `#141413`、陶土色 `#c56d4c`、輔助灰 `#68665e`、分隔線 `#dedbd2`。大標使用 Georgia／Songti TC，說明使用 Helvetica Neue／PingFang TC；不載入遠端字型。
- 主角為 MD Reader Lite：大標說明閱讀效益，右側保留真實插件畫面。圖表頁擴大實際 SVG 畫面，讓圖形本身說明功能。
- 插件畫面由已建置的 1.9.0 擷取，示範文章是本 repo 自寫的展示筆記，沒有使用私人的文件、帳號、使用者紀錄或第三方文章。實際搜尋歷史由 UI 按 Enter 產生。
- `source/demo.mjs` 保存示範文章；`source/copy.json` 保存雙語文案；`source/board.html` 保存編排。`v1.9.0/captures/` 保留原始插件取景。
- 品牌為 MD Reader Lite，沿用產品已採用的 Anthropic 編輯風格。隱私文案只說本機渲染與沒有追蹤後端，保留 [PRIVACY.md](../../PRIVACY.md) 的文件媒體與 opt-in PlantUML 邊界。

## 永久產生與測試計畫

環境沿用 [Developer Guide](../developer_guide.md) 的 Node／Playwright／headed Chromium，另需 `ffmpeg` 作 PNG 解碼驗證。腳本目前固定對應 1.9.0；改版時需同步版本目錄、預覽來源與期待版本，使用對應的正式成品。

```sh
# extension/ 可使用正式 ZIP 解壓內容，或先 npm run build。
node scripts/store-assets.mjs
node scripts/store-assets-package.mjs
node scripts/verify-store-assets.mjs
```

瀏覽器只序列執行，不與完整 e2e 並跑。完成輸出後，須更新檔案指紋與驗收紀錄。

每次重製依序驗證：

1. 兩組各五張、順序一致；讀取 PNG IHDR，核對 1280×800、bit depth 8、color type 2、沒有 tRNS 透明色。用解碼器完整讀取，避免只驗副檔名。
2. 擷取時確認 Mermaid ready、沒有 error；浮動側欄開啟前後文章 x／width 相同；三筆歷史由真實 Enter 寫入。這些斷言已放在產生腳本。
3. 逐張檢視全部十張：大標／副標無截斷，實際 UI 沒有錯誤提示，繁中與英文表達相同功能。以 640×400 縮圖再檢視標題及核心畫面。
4. 開啟 `v1.9.0/index.html`，在 1280、640 與 320 px 確認十張圖片載入、檔案連結有效、無水平溢位／page error／console error；頁面及上傳資料夾不包含影片。
5. 核對 [receipt.json](v1.9.0/receipt.json) 的尺寸、bytes、SHA-256 與現有輸出一致；ZIP 素材包只納入十張上傳圖、預覽頁、權限說明及 README，避免誤包測試 log 或原始取景。

本次已完成上述輸出規格與瀏覽器／解碼檢查；驗證細節保存在 `receipt.json`。這是商店素材的驗收，不取代插件的完整功能回歸。Google 商店尚未上傳或送審。
