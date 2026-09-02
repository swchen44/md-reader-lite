# MD Reader Lite v1.6.0 UI 精修設計（六項）

**日期：** 2026-09-02
**分支（預定）：** `feature/v160-ui-refinements`
**狀態：** 設計已與使用者確認，待寫實作計畫

## 目標

一批六項使用者導向的 UI 精修：把「離線模式」正名為更貼合零連外賣點的「隱私模式」；統一 popup 字級；把「設定」「關於」從開新分頁改為**頁內浮層**（仿商店版，點外部即消失）；移除禪模式；左側導覽列寬度可拖曳調整。

## 範圍與非範圍

**範圍（六項）：**

1. 離線模式 → 隱私模式（純 i18n 文案）
2. popup 字級一致化
3. 「設定」改頁內浮層 iframe（不開新分頁）
4. 「關於」改頁內小視窗（icon + 版號 + GitHub 連結，不開新分頁）
5. 移除禪模式
6. 左側導覽列寬度可拖曳調整

**明確非範圍：**

- **檔案樹不動**（使用者本輪明確要求維持現狀：`../` 上層、巢狀展開、`.md` 過濾全部保留）。
- 內部設定 key 不改名（`offlineMode` 維持）。

## 全域約束（每項任務都隱含適用）

- **零權限鐵律**：`permissions` 僅 `["activeTab","storage"]`，**不得**新增 `host_permissions`。iframe 走 `web_accessible_resources`（非權限）。
- **隱私優先**：不得新增任何對外連線；不得繞過 `offlineMode`。
- **建置**：`npm run build`（產出 `extension/` 與 `dist/*.zip`）。版本號在發版時才 bump，開發期維持現值。
- **測試**：純函式用 `node --test tests/<file>.test.mjs`；UI 用 Playwright 真實滑鼠點擊驗收（storage-set 測不出點擊 bug）。
- **commit 訊息**：Why/What/How/Boundary 四段慣例。

---

## 項目 1：離線模式 → 隱私模式（i18n 文案）

**檔案：** `src/config/i18n/locale.json`（en / zh-CN / zh-TW 三區塊）

把所有**使用者可見**的「離線模式 / Offline Mode / 离线模式」字樣改為「隱私模式 / Privacy Mode / 隐私模式」，內部 key 不動。涉及的 key（三語各一份）：

- `label_offline`：`Offline Mode` → `Privacy Mode`；`离线模式` → `隐私模式`；`離線模式` → `隱私模式`
- `hint_offline`：句中「Offline mode / 离线 / 離線」改「Privacy mode / 隱私」，語意保留「一鍵封鎖所有對外網路連線；本機與 file:// 照常；切換會重新載入頁面」
- `desc_offline`：技術描述（封鎖遠端目錄／GitHub 樹／自動刷新／PlantUML／遠端圖片）保留，僅名稱一致
- `hint_offline-disabled`：`Disabled by offline mode` → `Disabled by privacy mode`（三語）
- `offline_blocked`：`Offline mode: ...` → `Privacy mode: ...`（三語）
- `warn_plantuml`、`plantuml_disabled_render`：句中提到「offline mode / 离线 / 離線」處改「privacy mode / 隱私」

**驗收：** 三語搜尋不再殘留舊名稱（`grep -i "offline mode\|離線模式\|离线模式"` 在 locale.json 應為 0 命中）；popup 一般頁籤標籤顯示「隱私模式」。

---

## 項目 2：popup 字級一致化

**檔案：** `src/popup/index.css`、`src/popup/components/{app,header,tab-appearance,tab-plugins,warning}.svelte`

現況混用 11/12/13px。統一為兩級刻度：

- **主要**（欄位標籤 `.label-item`、頁籤鈕 `.tab-btn`、輸入框、伺服器輸入）：`13px`
- **次要**（`.hint-item`、`.sub-label`、`.unit-label`、`.range-value`、PlantUML 說明、warning）：`12px`（把現有 11px 一律提為 12px）

header 標題 `18px` 保留（它是標題非內文，不在兩級刻度內）。

**做法：** 逐檔把 `font-size: 11px` → `12px`；確認所有次要文字都是 12px、主要都是 13px。無邏輯變更。

**驗收：** Playwright 讀 popup 各元件 computed `font-size`，斷言只出現 {13,12,18}px 三值（18 僅 header）。

---

## 項目 3：「設定」改頁內浮層 iframe（不開新分頁）

**檔案：** `src/manifest.json`（web_accessible_resources）、`src/main.ts`（浮層元件 + 選單）、`src/config/class-name.ts`、`src/style/index.less`（浮層樣式）

**架構：**

- `manifest.json` 的 `web_accessible_resources[].resources` 加入 `"popup.html"`（與 css/fonts/images 同一 `<all_urls>` 條目）。
- content script（`main.ts`）建立一個 `iframe`，`src = chrome.runtime.getURL('popup.html')`，包在一個定位於視窗右上角的浮層容器（`position: fixed; top; right; z-index`），預設隱藏。
- ≡ 選單「設定」的 onSelect：**改為切換此 iframe 浮層的顯示**（移除原本 `chrome.runtime.sendMessage({action:'openOptions'})` 的開新分頁行為）。
- 點浮層外部即關閉：沿用與 ≡ 選單相同的 `document` capture-phase click 監聽模式（見共用 helper）。
- iframe lazy 建立（第一次開啟才 append，之後 show/hide），避免每頁都載入 popup bundle。

**保留：** `manifest.json` 的 `options_ui`（工具列右鍵 → 選項）維持不變；`background.ts` 的 `openOptions` case 可保留（不再被浮層使用，但工具列/未來仍可能用）——實作計畫時決定是否清掉，預設保留以縮小 diff。

**邊界：** iframe 內就是既有 popup UI 逐字不變、樣式天然隔離（sandbox），擴充 context 有完整 chrome API，設定寫入 `chrome.storage` 後既有 storage 監聽/生效機制照常。

**驗收：** Playwright — 開啟 .md 頁，點 ≡ →「設定」→ 斷言（a）**沒有**新分頁開啟、（b）頁內出現 `iframe[src$="popup.html"]` 且可見、（c）點頁面其他處後浮層隱藏。

---

## 項目 4：「關於」改頁內小視窗（不開新分頁）

**檔案：** `src/main.ts`（about modal 元件 + 選單）、`src/config/class-name.ts`、`src/config/i18n/locale.json`、`src/style/index.less`

**做法：**

- content script 注入一個小 modal（純 DOM，非 iframe——內容極少）：
  - 擴充 **icon**：`<img src={chrome.runtime.getURL('images/logo-stroke.png')}>`（images/\* 已在 web_accessible_resources）
  - **版號**：`chrome.runtime.getManifest().version`
  - **GitHub 連結**：文字連結 `https://github.com/swchen44/md-reader-lite`（`target="_blank" rel="noopener"`——此為使用者主動點擊的外連，非自動連外，符合隱私原則；不自動載入任何遠端資源）
  - 關閉鈕 / 點外部即消失（沿用共用 helper）
- ≡ 選單「關於」onSelect：**改為顯示此 modal**（移除原本 `window.open(github)` 的開新分頁）。
- 新增 i18n：`about_title`（例：關於）等必要文案（三語）；版號/URL 為資料非文案。

**驗收：** Playwright — 點 ≡ →「關於」→ 斷言（a）**沒有**新分頁、（b）頁內出現 modal，含 `img`（icon）、版號字串（比對 manifest.version）、`a[href*="github.com/swchen44/md-reader-lite"]`、（c）點外部關閉。

---

## 項目 5：移除禪模式

**檔案：** `src/core/data.ts`、`src/background.ts`、`src/main.ts`、`src/popup/components/tab-appearance.svelte`、`src/config/i18n/locale.json`、`src/config/class-name.ts`、`src/core/commands.ts`（若有 zen 快捷）

清除 zenMode 全部痕跡：

- `data.ts`：移除 `zenMode?` 型別與預設 `zenMode: false`
- `background.ts`：`actionMap` 移除 `zenMode: 'applySetting'`
- `main.ts`：移除 zenMode 的 body class 切換（`ZEN`）、`applySetting` 的 `case 'zenMode'`、≡ 選單的 `floatMenuItem('menu_zen', ...)`、相關註解
- `tab-appearance.svelte`：移除「禪模式」`<Switch>` 整個 form-item
- `class-name.ts`：移除 `ZEN`
- `locale.json`：移除 `menu_zen`、`label_zen`（三語）
- **相容**：既有使用者 storage 中殘留的 `zenMode` 值不再被讀取，無需遷移；不再切 ZEN class 即無效果。

**驗收：** `grep -ri "zen" src/` 僅剩無害殘留（理想 0）；Playwright — ≡ 選單項不含禪模式、外觀頁籤無禪模式開關；tsc 乾淨。

---

## 項目 6：左側導覽列寬度可拖曳調整

**檔案：** `src/style/index.less`、`src/main.ts`、`src/core/data.ts`、`src/background.ts`、`src/core/settings.ts`（夾值純函式 + 測試）

**做法：**

- `index.less`：把 `@side-width: 260px` 的 6+ 處使用改為 CSS 變數 `var(--md-reader-side-width, @side-width)`（保留 `@side-width` 當編譯期 fallback 預設）。變數掛在 `document.documentElement`（`:root`）。
- 新增 storage key `sideWidth?: number`（`data.ts` 型別；預設 `undefined` = 用 260px fallback；不寫死進 getDefaultData 以維持「未設定即預設」語意）。
- `background.ts` `actionMap` 加 `sideWidth: 'applySetting'`（即時類，不 reload）。
- `main.ts`：
  - 初始化時若 `configData.sideWidth` 有值，`document.documentElement.style.setProperty('--md-reader-side-width', clamp(sideWidth)+'px')`
  - 側欄右緣加一條**可拖曳分隔線**（新 class，如 `SIDE_RESIZER`）：`mousedown` 起拖、`mousemove` 即時更新 CSS 變數、`mouseup` 結束並 `chrome.runtime.sendMessage({action:'storage', data:{key:'sideWidth', value: clamped}})` 持久化。
  - `applySetting` 加 `case 'sideWidth'`：套用 CSS 變數（供從 popup 或其他分頁同步）。
- `settings.ts`：純函式 `clampSideWidth(v): number`，夾在 **180–560px**（超界回夾、非數字回預設 260）。附單元測試。

**驗收：** 單元測試 `clampSideWidth`（下界/上界/非數字/正常值）；Playwright — 拖曳分隔線後斷言 `--md-reader-side-width` 改變且側欄實際寬度隨之改變、reload 後寬度持久（storage 有 `sideWidth`）。

---

## 跨項共用：頁內浮層 helper

項目 3（iframe 浮層）、項目 4（about modal）、以及既有 ≡ 選單都需要「開啟 / 點外部即關閉 / 關閉」的行為。抽一個小 helper（`main.ts` 內或 `src/core/overlay.ts`）：`createDismissable(el, { onOpen?, onClose? })` 回傳 `{ open, close, toggle }`，內部管理 capture-phase `document` click 監聽（點擊目標不在 `el` 內即 close）。既有 `openFloatMenu/closeFloatMenu/onDocClickForFloatMenu` 可一併重構複用（非必要，實作計畫時評估）。

## 測試總覽

- **單元**（`node --test`）：`clampSideWidth`（新增於 `tests/settings.test.mjs` 或既有檔）。現有 159 條不得回歸。
- **Playwright 真實點擊驗收**：
  1. ≡ 選單無禪模式、外觀頁無禪模式開關
  2. 點「設定」→ 無新分頁、頁內 iframe 浮層出現、點外部關閉
  3. 點「關於」→ 無新分頁、modal 含 icon/版號/GitHub 連結、點外部關閉
  4. 側欄拖曳改寬 + reload 持久
  5. popup 一般頁籤標籤為「隱私模式」
  6. popup 字級僅 {13,12,18}px

## 風險與注意

- **iframe popup 尺寸**：popup.html 原為 360px 寬工具列 popup，也用於 `options_ui` 分頁；在 iframe 浮層中需給定合適寬高（浮層容器控制），確認 SMUI 控件在 iframe 內點擊正常（v1.5.1 的 checkbox/radio 修正在 iframe 內仍適用，因是同一份 CSS）。
- **web_accessible_resources 曝露 popup.html**：任何網頁可 iframe 我們的 popup.html——但 popup 只讀寫本擴充自己的 storage、無敏感資料外洩面；可接受（與商店版同類做法一致）。
- **拖曳與頁面選取衝突**：拖曳時 `user-select: none` + `preventDefault` 避免誤選文字。
