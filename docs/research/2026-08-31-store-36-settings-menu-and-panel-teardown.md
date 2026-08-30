# 商店版 Markdown Reader 3.6.28 —— 浮動選單 + 設置面板拆解

拆解對象：Chrome 線上應用程式商店版「Markdown Reader」（`Bener` 開發，非本 repo 的
`MD Reader Lite`），版本 `3.6.28`。目的：為之後把等值設定功能移植到開源版 MD Reader
Lite（案 B+F 合併計畫）做前期研究，記錄「有什麼、存哪裡、怎麼 gate Pro」的事實，
不含實作。

## 0. 方法與素材

- CRX 解包目錄：`scratchpad/crx/unpacked/`（`manifest.json`、`dist/`、`_locales/`）。
- `_locales/*/messages.json` 只含 6 個 key（`ext_name`、`ext_desc`、4 個鍵盤快捷鍵說明），
  **不是**設定文案來源——設定面板的全部文案（label/desc/plugin-eg/plugin-options/
  features）都以 JS 物件字面量的形式打包進 `dist/assets/__uno-CnVt9d6P.js`（共用
  chunk，函式 `Yo`/`SA`，6 個語系：`en`/`en-GB`/`en-US`/`zh-CN`/`zh-TW`/`ja`/`ko`/`uk`）。
- 實際渲染「浮動選單 ≡」的程式碼在 **content script**
  （`dist/content/index.global.js`，未壓縮單行 5.86MB，內含 mermaid/katex/cytoscape
  等第三方函式庫，用關鍵字定位）；元件名稱是 `More`（`emits:["toggleRaw"]`）。
- 實際渲染「設置面板」四頁籤的程式碼在**擴充功能 popup**
  （`dist/assets/popup-CM-nLuw-.js`，~200KB，比 content script 好讀很多）。點擊
  浮動選單「設置」時，是先把 `on.value.popupMenu` 設回 `"General"`，再送
  `chrome.runtime` 訊息 `{action:"popup"}` 給 background 觸發 `chrome.action`
  開啟 popup——也就是說使用者截圖裡「右上角的 overlay 面板」其實就是瀏覽器工具列的
  extension popup，只是打開位置貼齊網頁右上角，視覺上像 in-page overlay。
- 插件註冊表（`K1`／別名 `wr`）、預設值函式（`EQe`）、主題常數（`gA`／`Ya`）等在
  content script 與共用 chunk `__uno-CnVt9d6P.js` 各出現一份（同一份原始碼被兩個
  entry 各自 bundle 一次），內容逐字相同，可交叉驗證。
- 對照組：本 repo `src/popup/components/app.svelte`、`src/config/md-plugins.ts`、
  `src/config/page-themes.ts`、`src/core/data.ts`、`src/core/storage.ts`、
  `src/core/plugin.ts`。

## 1. 儲存架構（與 Lite 的關鍵差異）

商店版把整包設定存成**單一巢狀物件**，而非逐項 flat key：

- `chrome.storage.local["preferences"]` —— 一般/外觀/插件頁籤全部設定的巢狀 JSON
  （由 `ND("preferences", EQe)` 建立的響應式 storage-backed ref，`EQe()` 是預設值
  函式）。
- `chrome.storage.local["account"]` —— 登入態（`name/email/accessToken/ refreshToken/openId/accountVerifiedAt/...`）。
- `chrome.storage.local["about"]` —— 僅 `{version}`。

證據：`dist/content/index.global.js`，搜尋 `on=ND("preferences",EQe)` 與
`Kae="3.6.28",on=ND(`。

Lite（`src/core/storage.ts`）則是每個設定各自一個 top-level key
（`chrome.storage.local.set({enable, centered, refresh, ...})`），沒有巢狀分組，
也沒有 `account`/`about` 這種命名空間。這是純架構差異，不建議照搬（flat 更適合小型
開源版，不需要帳戶系統）。

## 2. 浮動選單（≡）七項

證據：`dist/content/index.global.js`，元件 `More`，搜尋
`s.value("label","toggleRaw")` 可定位到完整陣列字面量：

| 順序 | 項目（zh-TW 對照） | i18n key                 | 行為                                                                                                                                                                                                                      | 型態               |
| ---- | ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1    | 切換原始內容       | `label.toggleRaw`        | `emit("toggleRaw")` → 父層切換 `Wt.showRaw`，純前端 DOM 切換                                                                                                                                                              | 純前端             |
| 2    | 切換全螢幕         | `label.toggleFullscreen` | 呼叫 `useFullscreen`-類 composable 的 `toggle()`（`requestFullscreen`/`exitFullscreen`）                                                                                                                                  | 純前端             |
| 3    | 列印               | `label.print`            | `window.print()`，之後有分隔線 `divider:true`                                                                                                                                                                             | 純前端             |
| 4    | 帳戶               | `label.account`          | `chrome.runtime` 訊息 `{action:"open-options-page"}` → background 開啟獨立 Options 頁籤（`dist/options/index.html`），**不是**設置面板                                                                                    | 開新頁籤           |
| 5    | 設置               | `label.setting`          | 先 `on.value.popupMenu="General"`，再送 `{action:"popup"}` 觸發 `chrome.action` 開 popup（見上節），之後有分隔線                                                                                                          | 開 extension popup |
| 6    | 反饋               | `label.feedback`         | 開啟 in-page 「Feedback」對話框（class `feedback-card`），內含 GitHub Issues/Discussions 連結（`https://github.com/md-reader/md-reader/issues/new/choose`）、Email `mkdreader@gmail.com`（可複製）、WeChat 公眾號 QR code | in-page modal      |
| 7    | 關於               | `label.about`            | `Wt.aboutVisible=true` 開啟 in-page 「About」modal（logo、版本號、Homepage `https://md-reader.github.io`、GitHub 連結）                                                                                                   | in-page modal      |

Lite 現況：**完全沒有**這個浮動選單，也沒有全螢幕切換、列印按鈕、反饋/關於彈窗；
`toggleRaw` 只以 `src/core/lifecycle.ts` 的 `toggleRaw(eles)` 函式存在（推測綁定鍵盤
快捷鍵，未確認 UI 入口）。

## 3. 設置面板：四頁籤

Layout 元件（`dist/assets/popup-CM-nLuw-.js`，`__name:"Layout"`）用的頁籤陣列來自
共用 chunk 函式 `J3()`（`dist/assets/__uno-CnVt9d6P.js`，搜尋
`title:"General",icon:g2`）：

```
[{title:"General"},{title:"Appearance"},{title:"Plugins"},{title:"About"},{title:"Gap"}]
```

四個圖示分頁對應使用者截圖：齒輪=General、調色盤=Appearance、插頭=Plugins、
i=About（`Gap` 是版面填充用的隱藏項）。註：Options 獨立頁籤（帳戶登入頁）另外有
`Dashboard`/`Environment` 兩個 menu 項，但那是 Options 頁專屬，浮動選單「設置」
不會進到那邊。

### 3.1 一般（General）—— 10 項

證據：`popup-CM-nLuw-.js`，`__name:"General"` 元件（`Bn="Breaks"` 起始）。

| 設定名                           | i18n key（label/desc）                                                                                 | storage 位置                                     | 預設值           | 型別                                              | Pro-gated      | 備註                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ---------------- | ------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| 訪客模式/登入列                  | `label.guestMode` / `label.signIn` / `label.account`                                                   | `account.email`                                  | `null`           | 顯示用                                            | 否             | 整列可點擊，呼叫 `chrome.runtime.openOptionsPage()`                                                     |
| 啟用                             | `label.enable` / `desc.enable`                                                                         | `preferences.enable`                             | `true`           | boolean                                           | 否             | `onChange` 會觸發整頁 reload                                                                            |
| 換行風格                         | `label.Breaks` / `desc.Breaks`（`On preserves line breaks; off follows the CommonMark specification`） | `preferences.mdPlugins`（陣列是否含 `"Breaks"`） | 關（不在陣列中） | boolean（借用插件陣列成員資格實作，不是獨立欄位） | 否             | 與 3.3 插件頁籤的 `Breaks` 插件是**同一顆開關**，只是在一般頁籤重複曝光一次                             |
| 啟用大綱折疊                     | `label.isOutlineExpandable`                                                                            | `preferences.isOutlineExpandable`                | `false`          | boolean                                           | 否             |                                                                                                         |
| 渲染資料夾路徑                   | `label.enableFolderUrl` / `desc.enableFolderUrlDesc`（`Effective only with Pro plan`）                 | `preferences.enableFolderUrl`                    | `true`           | boolean                                           | **是（軟性）** | UI 上可切換，未訂閱 Pro 時功能不生效（本機資料夾瀏覽時在 content script 另有 `plan.name!=="pro"` 判斷） |
| 將 `.txt` 檔案當作 Markdown 渲染 | `label.enableTxtExt`                                                                                   | `preferences.enableTxtExt`                       | `true`           | boolean                                           | 否             |                                                                                                         |
| 自動刷新文檔                     | `label.autoRefresh` / `desc.autoRefresh`（提示：頻繁請求可能被目標伺服器限流）                         | `preferences.refresh`                            | `false`          | boolean                                           | 否             |                                                                                                         |
| 自動刷新間隔                     | `label.autoRefreshInterval` / `desc.autoRefreshInterval`（`0.5s-600s`）                                | `preferences.refreshInterval`                    | `0.5`（秒）      | number（0.5–600，2 位小數）                       | 否             | 就是使用者截圖「往下還有」的下一項                                                                      |
| 字元集相容模式                   | `label.charsetCompatibilityMode` / `desc.charsetCompatibilityMode`                                     | `preferences.charsetCompat`                      | `false`          | boolean                                           | 否             | 僅在 `file://` 協議載入大檔時生效                                                                       |
| 語言                             | `label.language`                                                                                       | `preferences.language`                           | 瀏覽器語系       | enum（8 語系）                                    | 否             |                                                                                                         |
| 恢復預設設定                     | `label.resetSetting` / `desc.resetWarning`                                                             | 動作按鈕（呼叫 reset 函式）                      | —                | action                                            | 否             | 有二次確認 popconfirm                                                                                   |

### 3.2 外觀（Appearance）—— 10 項

證據：`popup-CM-nLuw-.js`，`__name:"Appearance"` 元件。

| 設定名                   | i18n key                                                                          | storage 位置                                                                                       | 預設值                                        | 型別                                                                                                               | Pro-gated                                                | 備註                                       |
| ------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------ |
| 字體大小                 | `label.TextSize`                                                                  | `preferences.textSize`                                                                             | `"Normal"`                                    | enum slider，6 級：`Tiny/Small/Normal/Medium/Large/Extra Large` ↔ `12/14/16/18/20/24px`，emoji 刻度 `🐝🐭🐰🐶🐯🐘` | 否                                                       |                                            |
| 字體                     | `label.TextFont`                                                                  | `preferences.textFont`                                                                             | `"Default"`                                   | enum，9 選項：`Default/Inter/Roboto/Merriweather/MerriweatherSans/NotoSans/SourceSans3/Saans/NotoSerifSC`          | 否                                                       |                                            |
| 主題                     | `label.theme`                                                                     | `preferences.pageTheme`                                                                            | `"auto"`                                      | enum：`auto/light/dark`                                                                                            | 否                                                       |                                            |
| 淺色模式時的代碼區塊主題 | `label.codeBlockDayTheme` / `desc.codeBlockDayTheme`                              | `preferences.codeBlockDayTheme`                                                                    | `"light"`                                     | enum：`light/dark`                                                                                                 | 否                                                       |                                            |
| 深色模式時的代碼區塊主題 | `label.codeBlockNightTheme` / `desc.codeBlockNightTheme`                          | `preferences.codeBlockNightTheme`                                                                  | `"dark"`                                      | enum：`light/dark`                                                                                                 | 否                                                       | 使用者截圖標註「往下還有」對應的就是這項   |
| 代碼自動換行             | `label.codeWrap`                                                                  | `preferences.codeWrap`                                                                             | `false`                                       | boolean                                                                                                            | 否                                                       |                                            |
| 禪模式（Zen Mode）       | `label.zenMode` / `desc.zenModeDescription`（隱藏側邊欄與所有控制項，沉浸式閱讀） | `preferences.mode`（`"normal"`/`"zen"`）                                                           | `"normal"`                                    | boolean                                                                                                            | 否                                                       | **使用者截圖未提及、本次拆解新發現的項目** |
| 內容居中                 | `label.centered` / `desc.centered`                                                | `preferences.centered`                                                                             | `true`                                        | boolean                                                                                                            | 否                                                       |                                            |
| 自訂內容最大寬度         | `label.contentMaxWidth`                                                           | `preferences.enableCustomContentWidth` + `preferences.customContentData{unit,maxWidth,maxPercent}` | 關；`{unit:"px",maxWidth:1000,maxPercent:50}` | boolean 開關 + slider（px 500–3000 或 % 20–100）+ 單位下拉                                                         | 否（UI 未 gate，但屬於行銷頁列出的 Pro 賣點之一，見 §4） | 只有 `centered=true` 時才顯示              |
| 自訂 CSS                 | `label.customCSS`                                                                 | `preferences.enableCustomCSS` + `preferences.customCSS`                                            | 關；`""`                                      | boolean 開關 + textarea（Tab 縮排、⌘/Ctrl+S 套用）                                                                 | 否（同上，行銷頁列為 Pro 賣點）                          |                                            |

### 3.3 插件（Plugins）—— 1 個總開關 + 19 個插件

證據：`dist/assets/__uno-CnVt9d6P.js`，搜尋 `Breaks:{enable`（插件註冊表 `wr`，
content script 內同一份叫 `K1`）；UI 元件在 `popup-CM-nLuw-.js`，`__name:"Plugins"`。

儲存：`preferences.mdPlugins`（啟用的插件名稱陣列）+ `preferences.mdPluginOptions`
（每個插件的子設定物件，只有列在插件註冊表 `options` 欄位的插件才有）。

| #   | 插件名                    | i18n key                                                           | 預設啟用 | 有 ⚙ 子設定 | 子設定內容                                                                                                                                     | Pro-gated（子設定）                                     |
| --- | ------------------------- | ------------------------------------------------------------------ | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | 換行風格                  | `label.Breaks`                                                     | 否       | 無          | —                                                                                                                                              | —                                                       |
| 2   | 自動辨識連結              | `label.Linkify`                                                    | 是       | **是**      | `fuzzyLink`（無 `http(s)://` 也自動連結）、`fuzzyIP`（純 IP 位址）、`fuzzyEmail`（Email，預設開）                                              | **免費**（`freeOptions` 涵蓋全部 3 項）                 |
| 3   | 排版字元替換              | `label.Typographer`（範例 `(c) -> ©, TM -> ™`）                    | 是       | 無          | —                                                                                                                                              | —                                                       |
| 4   | 表情                      | `label.Emoji`（`:smile: :+1: :sparkles:`）                         | 是       | 無          | —                                                                                                                                              | —                                                       |
| 5   | 上標 Superscript          | `label.Sup`（`19^th^`）                                            | 是       | 無          | —                                                                                                                                              | —                                                       |
| 6   | 下標 Subscript            | `label.Sub`（`H~2~O`）                                             | 是       | 無          | —                                                                                                                                              | —                                                       |
| 7   | 目錄 TOC                  | `label.TOC`（`[[TOC]]`）                                           | 是       | **是**      | `includeLevel`、`containerClass`、`markerPattern`、`omitTag`、`listType`（另有文案但預設值未含的 `containerHeaderHtml`/`containerFooterHtml`） | **全付費**（無 `freeOptions`）                          |
| 8   | 插入 Insert               | `label.Ins`（`++Inserted text++`）                                 | 是       | 無          | —                                                                                                                                              | —                                                       |
| 9   | 標記 Mark                 | `label.Mark`（`==Marked text==`）                                  | 是       | 無          | —                                                                                                                                              | —                                                       |
| 10  | 數學公式 Katex            | `label.Katex`（`$\sqrt{3x-1}+(1+x)^2$`）                           | 是       | **是**      | `enableBareBlocks`、`enableFencedBlocks`、`enableMathInlineInHtml`、`enableMathBlockInHtml`、`throwOnError`、`errorColor`                      | **全付費**（無 `freeOptions`）                          |
| 11  | Mermaid 圖表              | `label.Mermaid`（流程圖/時序圖/甘特圖）                            | 是       | **是**      | `json`（`Mermaid.initialize` 原始 JSON 設定，預設 `{"theme":"auto","startOnLoad":false}`）                                                     | **全付費**（無 `freeOptions`）                          |
| 12  | PlantUML 圖表             | `label.PlantUML`（時序/類別/使用案例圖）                           | 是       | 無          | —                                                                                                                                              | —                                                       |
| 13  | 縮寫                      | `label.Abbr`（`*[HTML]: Hyper Text Markup Language`）              | 是       | 無          | —                                                                                                                                              | —                                                       |
| 14  | 釋義 Definition List      | `label.Deflist`（`<dl>`）                                          | 是       | 無          | —                                                                                                                                              | —                                                       |
| 15  | 腳註 Footnote             | `label.Footnote`（`[^first]`）                                     | 是       | 無          | —                                                                                                                                              | —                                                       |
| 16  | Front Matter 元數據       | `label.FrontMatter`（`--- \n title: Hi \n ---`）                   | 是       | **是**      | `showMetadata`（是否在文件上方渲染 metadata 表格）                                                                                             | **免費**（`freeOptions:["showMetadata"]` 涵蓋唯一選項） |
| 17  | 表格擴展語法 MultimdTable | `label.MultimdTable`                                               | 是       | **是**      | `multiline`、`rowspan`、`headerless`、`multibody`、`autolabel`                                                                                 | **全付費**（無 `freeOptions`）                          |
| 18  | 任務清單 TaskLists        | `label.TaskLists`（`- [x] Todo`）                                  | 是       | **是**      | `enabled`（checkbox 互動）、`label`、`labelAfter`                                                                                              | **全付費**（無 `freeOptions`）                          |
| 19  | 警告框 Alert              | `label.Alert`（`> [!NOTE\|!TIP\|!IMPORTANT\|!WARNING\|!CAUTION]`） | 是       | **是**      | `alertNames`、`deep`（巢狀）、`infoContainer`、`tipContainer`、`successContainer`、`warningContainer`、`dangerContainer`                       | **免費**（`freeOptions` 涵蓋全部 7 項）                 |

master 開關：`toggleAllPlugin`（`label.toggleAllPlugin`="All plugins"，
`desc.toggleAllPlugin`="Enable or Disable all plugins"），checkbox 狀態 =
`已啟用插件數 === 19`，onChange 直接把 `mdPlugins` 設成全開或全關；未 gate Pro。

**Gate 判斷邏輯**（`dist/assets/__uno-CnVt9d6P.js`，函式 `zh`/`q3`/`K3`，
`popup-CM-nLuw-.js` 內對應別名 `fa`＝「此插件是否有付費限定子選項」、`$n`＝
「此插件是否有至少一個免費子選項」）：一個插件的 `options` 只要**不在**該插件
`freeOptions` 清單裡，就必須是 Pro 帳號才能改；若 `freeOptions` 為空/不存在，
整個子設定面板鎖死並顯示升級提示（`ProLine` 元件）；若 `freeOptions` 涵蓋全部
選項（Linkify/FrontMatter/Alert），子面板完全開放，不顯示升級提示。插件本身的
開/關（不含子設定）一律免費，只受「啟用」總開關影響。

### 3.4 關於（About）

證據：`popup-CM-nLuw-.js`，`__name:"About"` 元件。

- Logo + 擴充功能名稱
- Homepage 連結：`https://md-reader.github.io`
- GitHub 連結：`https://github.com/md-reader/md-reader`
- WeChat 公眾號 QR code（hover 顯示圖片）
- Email：`mkdreader@gmail.com`（可一鍵複製）
- 版權宣告 + 版本號（`v3.6.28`，取自 `preferences`/`about` 共用的常數 `Kae`）

無獨立設定項，純資訊/連結頁。

## 4. Pro 定位參考（行銷文案，非嚴格 gating 清單）

`__uno-CnVt9d6P.js` 內有一份行銷用「Pro 方案賣點」清單（`features:{...}`，用於升級卡片
/早鳥方案文案，鄰近 `earlyBirdSpecial`），列出：`All Built-in Markdown Plugins`、
`Auto-generate Outline`、`Auto-refresh Document`、`Center Document Content`、
`Custom Content Width`、`Custom CSS`、`Adjust Font`、`Folder Directory`、
`Markdown plugin options`、`More Features in Development`。這份清單**不是**逐項
gating 依據（例如「啟用」「自動刷新」「內容居中」本身在免費版就能切換且預設開啟），
而是把「完整插件生態＋插件子選項＋資料夾瀏覽」包裝成 Pro 定位賣點；真正在程式碼層級
被 gate 的，只有：

1. `enableFolderUrl`（渲染資料夾路徑）—— 明確標註 `Effective only with Pro plan`。
2. 插件子設定面板中的 `TOC`、`Katex`、`Mermaid`、`MultimdTable`、`TaskLists`
   （5 個插件的 ⚙，全鎖）。
3. 帳戶/訂閱系統本身（登入、Options 頁的方案管理）。

## 5. 與 MD Reader Lite 現況的差距表

Lite 現況依據：`src/core/data.ts`（`Data` 介面 + 預設值）、
`src/popup/components/app.svelte`（唯一設定 UI，單頁無分頁）、
`src/config/md-plugins.ts`、`src/config/page-themes.ts`、`src/core/storage.ts`、
`src/core/plugin.ts`、`src/plugins/*`。

| 分類                      | 商店版有                                                                                    | Lite 現況                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI 結構                   | 浮動選單（≡）7 項 + 4 頁籤 popup 面板                                                       | 只有工具列 popup，單頁無分頁、無浮動選單、無全螢幕/列印/反饋/關於彈窗                                                                                    |
| 儲存                      | 巢狀單一 key（`preferences`/`account`/`about`）                                             | 逐項 flat key                                                                                                                                            |
| 啟用                      | `enable`                                                                                    | `enable`（已有，行為相同）                                                                                                                               |
| 內容居中                  | `centered`                                                                                  | `centered`（已有）                                                                                                                                       |
| 自動刷新                  | `refresh` + 可調間隔 `refreshInterval`（0.5–600s）                                          | `refresh`（僅開關，無間隔可調）                                                                                                                          |
| 資料夾/側欄               | `sideCollapsed`、`enableFolderUrl`（Pro）                                                   | `folderTree`（已有目錄樹，命名不同、無 Pro 限制，功能更開放）                                                                                            |
| `.txt` 當 Markdown        | `enableTxtExt`                                                                              | 沒有對應設定（manifest content_scripts 有比對 `.txt`，但無 UI 開關）                                                                                     |
| 大綱折疊                  | `isOutlineExpandable`                                                                       | 沒有對應設定                                                                                                                                             |
| 字元集相容模式            | `charsetCompat`                                                                             | 沒有對應設定                                                                                                                                             |
| 語言                      | `language`（8 語系下拉）                                                                    | `language`（已有，語系數量另計）                                                                                                                         |
| 恢復預設設定              | `resetSetting` 按鈕                                                                         | 沒有                                                                                                                                                     |
| 字體大小                  | `textSize`（6 級 slider）                                                                   | 沒有                                                                                                                                                     |
| 字體                      | `textFont`（9 種字體下拉）                                                                  | 沒有                                                                                                                                                     |
| 主題                      | `pageTheme`（`auto/light/dark`，預設 `auto`）                                               | `pageTheme`（同 3 選項，但預設 `light` 而非 `auto`）                                                                                                     |
| 代碼區塊主題（淺/深分開） | `codeBlockDayTheme`/`codeBlockNightTheme`                                                   | 沒有（代碼區塊主題應隨全域主題走，未拆分）                                                                                                               |
| 代碼自動換行              | `codeWrap`                                                                                  | 沒有                                                                                                                                                     |
| 禪模式                    | `mode`（zen）                                                                               | 沒有                                                                                                                                                     |
| 自訂內容寬度              | `enableCustomContentWidth` + 數值/單位                                                      | 沒有                                                                                                                                                     |
| 自訂 CSS                  | `enableCustomCSS` + `customCSS`                                                             | 沒有                                                                                                                                                     |
| 插件總開關                | `toggleAllPlugin`                                                                           | 沒有（僅逐一 chip 選取，無總開關）                                                                                                                       |
| 插件清單                  | 19 個（含 `Breaks`/`Linkify`/`Typographer`/`PlantUML`/`FrontMatter`/`MultimdTable`）        | 14 個：`Emoji/Sup/Sub/TOC/Ins/Mark/Katex/Mermaid/Abbr/Deflist/Footnote/TaskLists/Alert` + Lite 獨有的 `Obsidian`                                         |
| 插件子設定（⚙）           | 8 個插件有子設定 UI（`Linkify/TOC/Katex/Mermaid/FrontMatter/MultimdTable/TaskLists/Alert`） | 完全沒有子設定架構（`src/core/plugin.ts` 只是簡單的 `usePlugin` 陣列，無 per-plugin options schema）                                                     |
| 帳戶/Pro                  | 登入、訂閱、Pro-gating                                                                      | 無（開源版本無此概念，也不需要）                                                                                                                         |
| Lite 獨有                 | —                                                                                           | `folderTree`、`Obsidian` 插件、`graphviz`（PlantUML 之外另一種圖表管線）、`block-copy`、`img-viewer`（商店版皆無對應項，可視為 Lite 差異化賣點，非差距） |

## 6. 移植建議分級

**低成本高價值（優先）：**

1. **插件總開關（toggleAllPlugin）**——UI 上只是一顆 checkbox（狀態=`已選插件數=== 總數`），對照 Lite 現有的 chip `Set` 元件，加一顆全選/全不選按鈕即可，不涉及新
   資料結構。
2. **自動刷新間隔（refreshInterval）**——Lite 目前 `refresh` 只有開關、沒有間隔，
   商店版的秒數欄位（0.5–600s）是最小可用的品質提升，實作成本低（一個 number
   input + 一個 `setTimeout` 參數）。
3. **代碼自動換行（codeWrap）**——純 CSS class 開關，成本極低，價值明確（長行程式碼
   在窄側欄很痛）。
4. **主題預設改為 `auto`，並拆分淺/深色代碼區塊主題**——Lite 目前 `pageTheme` 預設
   `light` 且代碼區塊未跟隨深色模式獨立設定；改成 `auto` 更符合現代瀏覽器習慣，
   拆分淺/深代碼主題是常見閱讀器功能，成本中低。
5. **恢復預設設定按鈕（resetSetting）**——UX 保底功能，實作只是把 storage 清空/寫回
   `getDefaultData()`，成本很低。

**中成本、看使用者需求再排：**

6. 字體大小 slider（6 級）＋字體下拉（9 種）——需要引入字型資源與 CSS 變數，體積會
   增加（商店版把字型檔放在 `assets/fonts`），要評估 bundle size。
7. 大綱折疊開關（`isOutlineExpandable`）——若 Lite 目前大綱已有摺疊互動，只是缺開關，
   成本低；若尚無摺疊邏輯，成本中等。
8. 自訂內容寬度 / 自訂 CSS——功能明確、使用者常見需求，但要處理輸入驗證與
   XSS-safe 的 CSS 注入（商店版有 apply/cancel 兩段式確認），值得做但非急件。
9. 插件子設定（Linkify 的 fuzzy 開關、Alert 的容器樣式、FrontMatter 的
   showMetadata）——這 3 個插件在商店版本來就是全免費子選項，最適合優先移植的
   「有 ⚙」插件；其餘 5 個（TOC/Katex/Mermaid/MultimdTable/TaskLists）商店版本身
   全鎖 Pro，若要做，Lite 版可以直接做成開源免費（本來就沒有 Pro 限制的必要），
   但工作量較大（需要為每個插件設計 options schema + UI）。

**高成本或不適合移植：**

10. 帳戶系統／登入列／Pro 訂閱與 gating——與 Lite 開源、免費、無後端的定位衝突，
    不移植。
11. `enableFolderUrl`（Pro-only 資料夾路徑渲染）——Lite 的 `folderTree` 已經是免費
    提供的對應功能，不需要照搬「鎖 Pro」這個機制本身。
12. 反饋/關於彈窗改走「開新頁籤到 GitHub Issues／README」即可，不必照搬商店版
    in-page modal + WeChat QR 這套（WeChat 公眾號對 Lite 的定位不適用）。
13. 巢狀單一 storage key 架構——現有 flat key 對小型開源版已經夠用，重構儲存層
    屬於高成本、低急迫性的技術債清理，不建議現階段做。

## 7. 證據索引（供之後回查）

| 主題                              | 檔案                                                             | 關鍵字                                                                                             |
| --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| manifest 概觀                     | `manifest.json`                                                  | `action`/`options_ui`/`background`/`commands`                                                      |
| 浮動選單 7 項                     | `dist/content/index.global.js`                                   | `s.value("label","toggleRaw")`、`__name:"More"`                                                    |
| Options 頁開啟                    | `dist/content/index.global.js`                                   | `open-options-page`                                                                                |
| Popup 頁籤結構                    | `dist/assets/popup-CM-nLuw-.js`                                  | `__name:"Layout"`、`__name:"General"`、`__name:"Appearance"`、`__name:"Plugins"`、`__name:"About"` |
| 頁籤清單                          | `dist/assets/__uno-CnVt9d6P.js`                                  | `title:"General",icon:g2`                                                                          |
| 插件註冊表                        | `dist/assets/__uno-CnVt9d6P.js`                                  | `Breaks:{enable`                                                                                   |
| 插件註冊表（content script 副本） | `dist/content/index.global.js`                                   | `const K1={Breaks:{enable`                                                                         |
| 偏好設定預設值                    | `dist/content/index.global.js`                                   | `enableFolderUrl:!0,enableTxtExt:!0,centered:!0`                                                   |
| storage key 命名                  | `dist/content/index.global.js`                                   | `on=ND("preferences",EQe)`                                                                         |
| Pro-gate 判斷函式                 | `dist/assets/__uno-CnVt9d6P.js`                                  | `freeOptions.includes`                                                                             |
| i18n label/desc（英文全量）       | `dist/assets/__uno-CnVt9d6P.js` / `dist/content/index.global.js` | `label:{default:"Default"`、`desc:{enable:"Enable Markdown Reader"`                                |
| 行銷 Pro 賣點清單                 | `dist/assets/__uno-CnVt9d6P.js`                                  | `features:{allBuiltInPlugins`                                                                      |
| Lite 對照：預設資料               | `src/core/data.ts`                                               | `getDefaultData`                                                                                   |
| Lite 對照：popup UI               | `src/popup/components/app.svelte`                                | 全檔                                                                                               |
| Lite 對照：插件清單               | `src/config/md-plugins.ts`                                       | 全檔                                                                                               |
| Lite 對照：儲存層                 | `src/core/storage.ts`                                            | 全檔                                                                                               |
