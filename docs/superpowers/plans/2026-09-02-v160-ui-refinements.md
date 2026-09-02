# v1.6.0 UI 精修實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MD Reader Lite v1.6.0 六項 UI 精修：離線 → 隱私正名、popup 字級一致、設定/關於改頁內浮層（不開新分頁）、移除禪模式、左側導覽列寬度可拖曳。

**Architecture:** i18n 文案與 CSS 微調為獨立小任務；頁內浮層用 content script 注入（設定＝ iframe 載入 popup.html，關於＝純 DOM modal），兩者共用一個「點外部即關閉」helper；側欄寬度用 CSS 變數 `--md-reader-side-width` + 拖曳分隔線 + storage 持久化。

**Tech Stack:** Chrome MV3、TypeScript、Svelte 3 + SMUI（popup）、LESS（content 樣式）、自製 `Ele` DOM 包裝、`node --test`（純函式）、Playwright（UI 真實點擊驗收）。

## Global Constraints

- **零權限鐵律**：`permissions` 僅 `["activeTab","storage"]`，不得新增 `host_permissions`；iframe 走 `web_accessible_resources`（非權限）。
- **隱私優先**：不得新增任何自動對外連線；不得繞過 `offlineMode`。
- **內部 key 不改名**：`offlineMode` 維持，僅改使用者可見文案。
- **檔案樹不動**（非範圍）。
- **建置**：`npm run build`（產出 `extension/`）。版本號開發期不動，發版才 bump。
- **測試**：純函式 `node --test tests/<file>.test.mjs`（勿用目錄模式）；UI 用 Playwright 真實 `mouse.click`。
- **commit 訊息**：Why/What/How/Boundary 四段。
- **既有測試 159 條不得回歸。**

---

## 檔案結構

| 檔案                                          | 職責                                                                | 任務    |
| --------------------------------------------- | ------------------------------------------------------------------- | ------- |
| `src/config/i18n/locale.json`                 | 三語文案：隱私正名、移除 zen keys、（可選）modal 文案               | 1,3     |
| `src/popup/index.css` + `components/*.svelte` | popup 字級兩級刻度                                                  | 2       |
| `src/core/data.ts`                            | 移除 `zenMode`、新增 `sideWidth?`                                   | 3,6     |
| `src/background.ts`                           | actionMap 移除 `zenMode`、新增 `sideWidth`                          | 3,6     |
| `src/config/class-name.ts`                    | 移除 `ZEN`、新增 `SETTINGS_OVERLAY`/`ABOUT_MODAL`/`SIDE_RESIZER`    | 3,4,5,6 |
| `src/popup/components/tab-appearance.svelte`  | 移除禪模式開關                                                      | 3       |
| `src/core/overlay.ts`（新建）                 | `createDismissable` 點外部即關閉 helper                             | 4       |
| `src/main.ts`                                 | 移除 zen；設定 iframe 浮層；關於 modal；側欄 resizer + CSS 變數套用 | 3,4,5,6 |
| `src/manifest.json`                           | `web_accessible_resources` 加 `popup.html`                          | 4       |
| `src/style/index.less`                        | `@side-width` → CSS 變數；浮層/modal/resizer 樣式                   | 4,5,6   |
| `src/core/settings.ts`                        | `clampSideWidth` + 常數                                             | 6       |
| `tests/settings.test.mjs`                     | `clampSideWidth` 單元測試                                           | 6       |

**任務順序理由**：任務 3（移除禪模式）先清乾淨浮動選單，任務 4/5 再改選單項與加浮層（4 建立共用 helper、5 複用），避免同區塊衝突編輯。

---

## Task 1：離線模式 → 隱私模式（i18n 正名）

**Files:**

- Modify: `src/config/i18n/locale.json`（en 區塊行 15–26/95–96、zh-CN 行 110–121/190–191、zh-TW 行 205–216/285–286）

**Interfaces:**

- Consumes: 無
- Produces: 無（純文案）；`offlineMode` storage key 不變

- [ ] **Step 1：改 en 區塊**

把以下 6 條的值改為（key 不動）：

```json
"label_offline": "Privacy Mode",
"hint_offline": "Block all remote network requests with one switch; local & file:// still work as usual. Toggling reloads the page.",
"desc_offline": "Blocks remote directory listing, GitHub trees, auto refresh, PlantUML rendering, and remote images.",
"hint_offline-disabled": "Disabled by privacy mode",
"offline_blocked": "Privacy mode: remote directory request blocked",
"warn_plantuml": "PlantUML sends your diagram source to the server above for rendering. Requires privacy mode to be off.",
"plantuml_disabled_render": "PlantUML is off — enable the plugin and turn off privacy mode to render.",
```

- [ ] **Step 2：改 zh-CN 區塊**

```json
"label_offline": "隐私模式",
"hint_offline": "一键封锁所有对外网络请求，本机与 file:// 照常，切换将重新加载页面",
"desc_offline": "封锁远程目录列表、GitHub 目录树、自动刷新、PlantUML 渲染与远程图片",
"hint_offline-disabled": "隐私模式已停用此功能",
"offline_blocked": "隐私模式：已封锁远程目录请求",
"warn_plantuml": "PlantUML 会将你的图表源代码发送到上述服务器进行渲染，需关闭隐私模式才能使用",
"plantuml_disabled_render": "PlantUML 已关闭——启用插件并关闭隐私模式即可算图",
```

- [ ] **Step 3：改 zh-TW 區塊**

```json
"label_offline": "隱私模式",
"hint_offline": "一鍵封鎖所有對外網路請求，本機與 file:// 照常，切換將重整",
"desc_offline": "封鎖遠端目錄清單、GitHub 目錄樹、自動刷新、PlantUML 算圖與遠端圖片",
"hint_offline-disabled": "隱私模式已停用此功能",
"offline_blocked": "隱私模式：已封鎖遠端目錄請求",
"warn_plantuml": "PlantUML 會將你的圖表原始碼傳送到上述伺服器算圖，需關閉隱私模式才能使用",
"plantuml_disabled_render": "PlantUML 已關閉——啟用插件並關閉隱私模式即可算圖",
```

- [ ] **Step 4：驗證無殘留舊名 + JSON 合法**

Run:

```bash
grep -in "offline mode\|離線模式\|离线模式" src/config/i18n/locale.json
node -e "JSON.parse(require('fs').readFileSync('src/config/i18n/locale.json','utf8'));console.log('JSON OK')"
```

Expected: 第一行 grep **0 命中**；第二行印出 `JSON OK`。

- [ ] **Step 5：Commit**

```bash
git add src/config/i18n/locale.json
git commit -m "feat: 離線模式正名為隱私模式（三語文案，key 不動）"
```

---

## Task 2：popup 字級一致化（主要 13px／次要 12px）

**Files:**

- Modify: `src/popup/index.css:49`（`.hint-item` 11px→12px）
- Modify: `src/popup/components/warning.svelte:11`（確認 12px）
- Modify: `src/popup/components/{tab-appearance,tab-plugins}.svelte`、`src/popup/components/app.svelte`（確認次要文字 12px、主要 13px）

**Interfaces:**

- Consumes: 無
- Produces: 無（純樣式）

現況字級盤點（grep 結果）：`index.css` 有 13px（label-item L43 / input L58）、11px（hint-item L49）、12px（overlay-related L86/L93 已於 v1.5.1 移除，實際剩 range/number 附近）；`app.svelte` tab-btn 13px；`header.svelte` 18px（標題，保留）；`tab-appearance.svelte` 兩處 12px；`tab-plugins.svelte` 13px（伺服器輸入）+ 12px（sub-label）；`warning.svelte` 12px。**唯一偏離兩級刻度的是 `.hint-item` 的 11px。**

- [ ] **Step 1：把 index.css 的 hint-item 11px 改 12px**

`src/popup/index.css` 第 47–51 行 `.hint-item`：

```css
.hint-item {
  margin: -10px 0 12px;
  font-size: 12px;
  color: #8890a6;
}
```

- [ ] **Step 2：全面確認只剩 {13,12,18}px**

Run:

```bash
grep -rho "font-size: *[0-9]*px" src/popup | sort -u
```

Expected: 僅出現 `font-size: 12px`、`font-size: 13px`、`font-size: 18px` 三種（若出現其他值，改為最接近的兩級：≤12→12、>12 且非標題 →13）。

- [ ] **Step 3：建置 + Playwright 驗收字級**

Run:

```bash
npm run build
```

建立 `/tmp/pw-font.mjs`（載入 `extension/`、開 `popup.html`），讀所有可見文字元素的 computed `font-size`，斷言集合 ⊆ {12,13,18}px。
Expected: PASS。

- [ ] **Step 4：Commit**

```bash
git add src/popup/index.css
git commit -m "style: popup 字級統一為主要 13px／次要 12px（hint 11→12）"
```

---

## Task 3：移除禪模式

**Files:**

- Modify: `src/core/data.ts:26,56`（移除 `zenMode?` 型別與預設）
- Modify: `src/background.ts`（actionMap 移除 `zenMode: 'applySetting'`）
- Modify: `src/main.ts`（applySetting `case 'zenMode'`、`applyZen` 定義與呼叫、`floatMenuItem('menu_zen', ...)`）
- Modify: `src/popup/components/tab-appearance.svelte:245-255`（移除禪模式 form-item）
- Modify: `src/config/class-name.ts`（移除 `ZEN`）
- Modify: `src/config/i18n/locale.json`（移除 `menu_zen`、`label_zen` 三語共 6 行）

**Interfaces:**

- Consumes: 無
- Produces: `≡` 浮動選單剩五項（設定/切換原始內容/切換全螢幕/列印/關於）；`applyZen`/`className.ZEN` 不再存在

- [ ] **Step 1：data.ts 移除 zenMode**

刪除 `src/core/data.ts` 介面中的 `zenMode?: boolean`（第 26 行）與 `getDefaultData` 回傳物件中的 `zenMode: false,`（第 56 行）。

- [ ] **Step 2：background.ts 移除 actionMap 項**

刪除 `src/background.ts` actionMap 中的 `zenMode: 'applySetting',` 一行。

- [ ] **Step 3：main.ts 移除 applySetting case 與 applyZen**

`src/main.ts` applySetting switch（約 124–126 行）刪除：

```ts
        case 'zenMode':
          applyZen()
          break
```

並刪除 `applyZen` 定義與其呼叫（約 541–549 行整段，含前面 spec 註解與 `applyZen()` 呼叫那行）：

```ts
// zenMode binding（spec 三規則）… 整段註解 …
const applyZen = () => {
  if (configData.zenMode && searchOpen) closeSearch()
  document.body.classList.toggle(className.ZEN, !!configData.zenMode)
}
applyZen()
```

- [ ] **Step 4：main.ts 移除選單項**

`src/main.ts` floatMenuDropdown（約 702–707 行）刪除：

```ts
      floatMenuItem('menu_zen', () => {
        chrome.runtime.sendMessage({
          action: 'storage',
          data: { key: 'zenMode', value: !configData.zenMode },
        })
      }),
```

- [ ] **Step 5：tab-appearance.svelte 移除禪模式開關**

刪除 `src/popup/components/tab-appearance.svelte` 最後的禪模式 form-item（約 245–255 行）：

```svelte
<div class="form-item inline">
  <span class="label-item">{localize('label_zen')}:</span>
  <FormField align="end">
    <Switch
      disabled={!data.enable}
      bind:checked={data.zenMode}
      color="primary"
      on:change={() => updateConfig('zenMode', data.zenMode)}
    />
  </FormField>
</div>
```

- [ ] **Step 6：class-name.ts 移除 ZEN**

刪除 `src/config/class-name.ts` 的 `ZEN: p`zen`,` 一行。

- [ ] **Step 7：locale.json 移除 zen keys**

三語各刪除 `"menu_zen": ...,` 與 `"label_zen": ...,`（共 6 行）。

- [ ] **Step 8：型別檢查 + 無殘留 + 既有測試**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
grep -rin "zenmode\|zen'\|menu_zen\|label_zen\|className.ZEN\|applyZen" src && echo "---(上方應為 0 命中)---"
node --test tests/*.test.mjs 2>&1 | tail -4
```

Expected: `TSC_OK`；grep 0 命中（`.zen` CSS 類殘留於 index.less 可忽略，見 Step 9）；159 tests pass。

- [ ] **Step 9：清理 index.less 的 .zen 樣式（若存在）**

Run: `grep -n "zen" src/style/index.less`
若有 `.md-reader__zen` 相關規則，一併刪除（禪模式視覺已無觸發點）。無則跳過。

- [ ] **Step 10：Commit**

```bash
git add -A
git commit -m "feat: 移除禪模式（data/actionMap/main/popup/i18n/class 全清）"
```

---

## Task 4：設定改頁內浮層 iframe（不開新分頁）+ 共用 dismissable helper

**Files:**

- Create: `src/core/overlay.ts`（`createDismissable`）
- Modify: `src/manifest.json`（web_accessible_resources 加 `popup.html`）
- Modify: `src/config/class-name.ts`（加 `SETTINGS_OVERLAY`）
- Modify: `src/main.ts`（建立 iframe 浮層、改 `menu_settings` onSelect、重構 float menu 複用 helper）
- Modify: `src/style/index.less`（`.md-reader__settings-overlay` 樣式）

**Interfaces:**

- Consumes: `className.FLOAT_MENU` 等（既有）
- Produces: `createDismissable(el, opts) → { el, open, close, toggle, isOpen }`（Task 5 複用）

- [ ] **Step 1：建立 overlay helper**

Create `src/core/overlay.ts`：

```ts
import type Ele from '@/core/ele'

export interface Dismissable {
  el: Ele<HTMLElement>
  open(): void
  close(): void
  toggle(): void
  readonly isOpen: boolean
}

/**
 * 把一個預設隱藏的元素包成「點外部即關閉」的浮層。
 * - open()：show + 掛 capture-phase document click 監聽
 * - 點擊目標不在 el 內即 close()
 * - 觸發按鈕須自行 stopPropagation，避免同一次 click 立即關閉
 */
export function createDismissable(
  el: Ele<HTMLElement>,
  opts: { onOpen?: () => void; onClose?: () => void } = {},
): Dismissable {
  let open = false
  const onDocClick = (e: MouseEvent) => {
    if (!el.ele.contains(e.target as Node)) api.close()
  }
  const api: Dismissable = {
    el,
    get isOpen() {
      return open
    },
    open() {
      if (open) return
      open = true
      el.show()
      document.addEventListener('click', onDocClick, true)
      opts.onOpen?.()
    },
    close() {
      if (!open) return
      open = false
      el.hide()
      document.removeEventListener('click', onDocClick, true)
      opts.onClose?.()
    },
    toggle() {
      open ? api.close() : api.open()
    },
  }
  return api
}
```

- [ ] **Step 2：單元測試 helper（jsdom 不可用時以最小 DOM stub）**

本專案 `tests/` 為 node 純函式測試、無 DOM 環境，`createDismissable` 依賴 document/Ele，改以 **Playwright 在真實頁面驗收**（見 Step 8），此步不寫 node 單元測試。（記錄於此以免遺漏。）

- [ ] **Step 3：manifest 加 web_accessible_resources**

`src/manifest.json` 把 resources 陣列改為（**只加 `"popup.html"`，其餘不動、維持 inline 格式**）：

```json
      "resources": ["css/*", "fonts/*", "images/*", "popup.html"],
```

- [ ] **Step 4：class-name 加 SETTINGS_OVERLAY**

`src/config/class-name.ts` 在 `FLOAT_MENU_ITEM` 附近加：

```ts
  SETTINGS_OVERLAY: p`settings-overlay`,
```

- [ ] **Step 5：main.ts 匯入 helper**

`src/main.ts` 頂部 import 區加：

```ts
import { createDismissable } from '@/core/overlay'
```

- [ ] **Step 6：main.ts 建立設定 iframe 浮層 + 改選單**

在 float menu 區塊附近（`floatMenuDropdown` 定義之前）加入 lazy 浮層工廠：

```ts
let settingsOverlay: ReturnType<typeof createDismissable> | null = null
function getSettingsOverlay() {
  if (settingsOverlay) return settingsOverlay
  const iframe = new Ele<HTMLIFrameElement>('iframe', {
    src: chrome.runtime.getURL('popup.html'),
  })
  const panel = new Ele<HTMLElement>(
    'div',
    { className: className.SETTINGS_OVERLAY },
    [iframe],
  )
  panel.hide()
  lifecycle.mount([panel])
  settingsOverlay = createDismissable(panel)
  return settingsOverlay
}
```

把 `menu_settings` 項的 onSelect 由：

```ts
      floatMenuItem('menu_settings', () =>
        chrome.runtime.sendMessage({ action: 'openOptions' }),
      ),
```

改為：

```ts
      floatMenuItem('menu_settings', () => getSettingsOverlay().toggle()),
```

（注意：`floatMenuItem` 內部已先 `closeFloatMenu()` 再 `onSelect()`，故點「設定」會先關選單再開浮層；兩者的 document 監聽互不干擾。）

- [ ] **Step 7：index.less 加浮層樣式**

`src/style/index.less` 末尾（頂層、非 `body.md-reader` 限定，與 float-menu 同層級）加：

```less
.md-reader__settings-overlay {
  position: fixed;
  top: 48px;
  right: 12px;
  z-index: 2147483646;
  width: 380px;
  max-width: calc(100vw - 24px);
  height: 620px;
  max-height: calc(100vh - 60px);
  background: #fff;
  border: 1px solid #24315833;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(36, 49, 88, 0.24);
  overflow: hidden;
  iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
}
```

- [ ] **Step 8：建置 + Playwright 驗收設定浮層**

Run:

```bash
npm run build
```

建立 `/tmp/pw-settings.mjs`：載入 `extension/`、開一個本機 `.md` 頁（用既有測試 server 或 `file://`），記錄 `context.pages().length`，點 `≡`（`.md-reader__float-menu-btn`）再點「設定」項，斷言：

1. 分頁數**未增加**（無新分頁）
2. 頁內出現可見的 `.md-reader__settings-overlay iframe[src$="popup.html"]`
3. 點頁面內文區域後，浮層 `display:none`（已關閉）

Expected: 三項皆 PASS。

- [ ] **Step 9：Commit**

```bash
git add -A
git commit -m "feat: 設定改頁內 iframe 浮層（不開新分頁）+ createDismissable helper"
```

---

## Task 5：關於改頁內小視窗（icon + 版號 + GitHub 連結）

**Files:**

- Modify: `src/config/class-name.ts`（加 `ABOUT_MODAL`）
- Modify: `src/main.ts`（建立 about modal、改 `menu_about` onSelect）
- Modify: `src/style/index.less`（`.md-reader__about-modal` 樣式）

**Interfaces:**

- Consumes: `createDismissable`（Task 4）、`className.SETTINGS_OVERLAY` 樣式慣例
- Produces: 無

- [ ] **Step 1：class-name 加 ABOUT_MODAL**

`src/config/class-name.ts` 加：

```ts
  ABOUT_MODAL: p`about-modal`,
```

- [ ] **Step 2：main.ts 建立 about modal + 改選單**

float menu 區塊附近加 lazy 工廠：

```ts
let aboutOverlay: ReturnType<typeof createDismissable> | null = null
function getAboutOverlay() {
  if (aboutOverlay) return aboutOverlay
  const icon = new Ele<HTMLImageElement>('img', {
    src: chrome.runtime.getURL('images/logo-stroke.png'),
  })
  const name = new Ele<HTMLElement>('div', { className: 'about-name' })
  name.textContent = 'MD Reader Lite'
  const version = new Ele<HTMLElement>('div', { className: 'about-version' })
  version.textContent = 'v' + chrome.runtime.getManifest().version
  const link = new Ele<HTMLAnchorElement>('a', {
    href: 'https://github.com/swchen44/md-reader-lite',
    target: '_blank',
    rel: 'noopener',
  })
  link.textContent = 'github.com/swchen44/md-reader-lite'
  const modal = new Ele<HTMLElement>(
    'div',
    { className: className.ABOUT_MODAL },
    [icon, name, version, link],
  )
  modal.hide()
  lifecycle.mount([modal])
  aboutOverlay = createDismissable(modal)
  return aboutOverlay
}
```

把 `menu_about` 項由：

```ts
      floatMenuItem('menu_about', () =>
        window.open('https://github.com/swchen44/md-reader-lite'),
      ),
```

改為：

```ts
      floatMenuItem('menu_about', () => getAboutOverlay().open()),
```

- [ ] **Step 3：index.less 加 modal 樣式**

`src/style/index.less` 末尾加：

```less
.md-reader__about-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2147483646;
  width: 280px;
  padding: 24px 20px;
  background: #fff;
  border: 1px solid #24315833;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(36, 49, 88, 0.24);
  text-align: center;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
  img {
    width: 56px;
    height: 56px;
    margin-bottom: 10px;
  }
  .about-name {
    font-size: 15px;
    font-weight: bolder;
    color: #243158;
  }
  .about-version {
    margin: 4px 0 12px;
    font-size: 12px;
    color: #8890a6;
  }
  a {
    font-size: 13px;
    color: #607cd2;
    text-decoration: none;
    word-break: break-all;
  }
  a:hover {
    text-decoration: underline;
  }
}
```

- [ ] **Step 4：建置 + Playwright 驗收關於視窗**

Run:

```bash
npm run build
```

建立 `/tmp/pw-about.mjs`：開 `.md` 頁，記錄分頁數，點 `≡` → 「關於」，斷言：

1. 分頁數**未增加**
2. 出現可見 `.md-reader__about-modal`，內含 `img`、版號文字（比對 `chrome.runtime.getManifest().version`）、`a[href*="github.com/swchen44/md-reader-lite"]`
3. 點外部後 modal `display:none`

Expected: 三項 PASS。

- [ ] **Step 5：Commit**

```bash
git add -A
git commit -m "feat: 關於改頁內小視窗（icon+版號+GitHub 連結，不開新分頁）"
```

---

## Task 6：左側導覽列寬度可拖曳調整

**Files:**

- Modify: `src/core/settings.ts`（`SIDE_WIDTH_*` 常數 + `clampSideWidth`）
- Modify: `tests/settings.test.mjs`（clampSideWidth 測試）
- Modify: `src/core/data.ts`（`sideWidth?: number` 型別，不進 getDefaultData）
- Modify: `src/background.ts`（actionMap 加 `sideWidth: 'applySetting'`）
- Modify: `src/config/class-name.ts`（加 `SIDE_RESIZER`）
- Modify: `src/style/index.less`（`@side-width` → CSS 變數；resizer 樣式）
- Modify: `src/main.ts`（init 套用寬度、applySetting case、resizer 拖曳）

**Interfaces:**

- Consumes: 無
- Produces: `clampSideWidth(v: unknown) → number`（180–560，非數字回 260）；CSS 變數 `--md-reader-side-width`；storage key `sideWidth`

- [ ] **Step 1：寫 clampSideWidth 失敗測試**

`tests/settings.test.mjs` 末尾加：

```js
test('clampSideWidth: 正常值原樣返回', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(300), 300)
})
test('clampSideWidth: 下界 180', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(100), 180)
})
test('clampSideWidth: 上界 560', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(9999), 560)
})
test('clampSideWidth: 非數字回預設 260', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth('abc'), 260)
  assert.equal(clampSideWidth(NaN), 260)
  assert.equal(clampSideWidth(undefined), 260)
})
test('clampSideWidth: 邊界值', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(180), 180)
  assert.equal(clampSideWidth(560), 560)
})
```

- [ ] **Step 2：跑測試確認失敗**

Run: `node --test tests/settings.test.mjs 2>&1 | tail -5`
Expected: FAIL（`clampSideWidth is not a function`）。

- [ ] **Step 3：實作 clampSideWidth**

`src/core/settings.ts` 在 `clampCustomWidth` 後加：

```ts
export const SIDE_WIDTH_MIN = 180
export const SIDE_WIDTH_MAX = 560
export const SIDE_WIDTH_DEFAULT = 260

export function clampSideWidth(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return SIDE_WIDTH_DEFAULT
  return Math.round(Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, n)))
}
```

- [ ] **Step 4：跑測試確認通過**

Run: `node --test tests/settings.test.mjs 2>&1 | tail -5`
Expected: 全部 PASS。

- [ ] **Step 5：data.ts 加型別（不進預設）**

`src/core/data.ts` 介面加（放在 `offlineMode?` 附近）：

```ts
  sideWidth?: number
```

**不**加入 `getDefaultData` 回傳物件（未設定＝用 CSS fallback 260）。

- [ ] **Step 6：background.ts actionMap 加 sideWidth**

`src/background.ts` actionMap 加：

```ts
  sideWidth: 'applySetting',
```

- [ ] **Step 7：class-name 加 SIDE_RESIZER**

`src/config/class-name.ts` 加：

```ts
  SIDE_RESIZER: p`side-resizer`,
```

- [ ] **Step 8：index.less 把 @side-width 改 CSS 變數**

`src/style/index.less` 把 6 處 `width: @side-width;`、1 處 `padding-left: @side-width;`、以及 `transform: translateX(@side-width)` 全部改為使用變數（保留 `@side-width` 當 fallback）。例：

```less
width: var(--md-reader-side-width, @side-width);
```

```less
padding-left: var(--md-reader-side-width, @side-width);
```

```less
transform: translateX(var(--md-reader-side-width, @side-width));
```

並在檔案加 resizer 樣式（`body.md-reader .md-reader` 區塊內或頂層皆可，需定位於側欄右緣）：

```less
.md-reader__side-resizer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: calc(var(--md-reader-side-width, @side-width) - 3px);
  width: 6px;
  cursor: col-resize;
  z-index: 2147483645;
  user-select: none;
}
.md-reader__side-resizer:hover {
  background: #607cd233;
}
/* 側欄摺疊（響應式收合）時不顯示拖曳條 */
body.md-reader.side-collapsed .md-reader__side-resizer {
  display: none;
}
```

（`left` 隨變數移動，貼齊側欄右緣。`side-collapsed` 為既有 class，見 `className.SIDE_COLLAPSED`。）

- [ ] **Step 9：main.ts 匯入 clampSideWidth**

`src/main.ts` 從 settings 的 import 補上 `clampSideWidth`（該檔已 import `clampRefreshInterval` 等）：

```ts
import { clampRefreshInterval, clampSideWidth } from '@/core/settings'
```

（依實際既有 import 行合併，勿重複匯入。）

- [ ] **Step 10：main.ts 加套用函式 + applySetting case + 初始化**

在 applySetting switch 加（與 `case 'zenMode'` 移除後的相鄰位置）：

```ts
        case 'sideWidth':
          applySideWidth()
          break
```

定義套用函式（放在其他 apply\* 附近）：

```ts
const applySideWidth = () => {
  document.documentElement.style.setProperty(
    '--md-reader-side-width',
    clampSideWidth(configData.sideWidth) + 'px',
  )
}
```

初始化：若使用者已設定寬度，掛載後套用（在 `lifecycle.mount([...])` 之後）：

```ts
if (configData.sideWidth != null) applySideWidth()
```

- [ ] **Step 11：main.ts 加 resizer 元件與拖曳**

在 side 渲染區（`mdSide` 建立後、mount 前）建立 resizer 並掛入 mount 陣列：

```ts
const sideResizer = new Ele<HTMLElement>('div', {
  className: className.SIDE_RESIZER,
})
sideResizer.on('mousedown', (e: MouseEvent) => {
  e.preventDefault()
  document.body.style.userSelect = 'none'
  const onMove = (ev: MouseEvent) => {
    const w = clampSideWidth(ev.clientX)
    document.documentElement.style.setProperty(
      '--md-reader-side-width',
      w + 'px',
    )
  }
  const onUp = (ev: MouseEvent) => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
    const w = clampSideWidth(ev.clientX)
    chrome.runtime.sendMessage({
      action: 'storage',
      data: { key: 'sideWidth', value: w },
    })
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
})
```

把 `sideResizer` 加進 `lifecycle.mount([...])` 陣列（與 `mdSide` 同批）：

```ts
lifecycle.mount([buttonWrap, floatMenu, mdBody, mdSide, sideTabs, sideResizer])
```

- [ ] **Step 12：型別檢查 + 建置 + 全測試**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
node --test tests/*.test.mjs 2>&1 | tail -4
npm run build
```

Expected: `TSC_OK`；測試 164 pass（159 + 5 新）；build 成功。

- [ ] **Step 13：Playwright 驗收拖曳 + 持久**

建立 `/tmp/pw-side.mjs`：開有目錄樹/大綱的 `.md` 頁，讀初始 `--md-reader-side-width`（或側欄實際寬），對 `.md-reader__side-resizer` 中心做 `mouse.down → mouse.move(至新 X) → mouse.up`，斷言：

1. `getComputedStyle(document.documentElement).getPropertyValue('--md-reader-side-width')` 已改變且介於 180–560
2. storage `sideWidth` 已寫入
3. reload 後側欄寬度沿用（`sideWidth` 生效）

Expected: 三項 PASS。

- [ ] **Step 14：Commit**

```bash
git add -A
git commit -m "feat: 左側導覽列寬度可拖曳調整（CSS 變數 + clampSideWidth 180-560 + 持久化）"
```

---

## 收尾（全部任務完成後）

- [ ] 跑完整驗收：`npx tsc --noEmit`、`node --test tests/*.test.mjs`（≥164 pass）、`npm run build`
- [ ] Playwright 全項回歸：設定浮層 / 關於視窗 / 側欄拖曳 / 選單無禪模式 / popup 隱私模式標籤 / 字級
- [ ] 交由 subagent-driven-development 的最終 whole-branch review
- [ ] 依 finishing-a-development-branch 合併、bump 1.5.1→1.6.0、tag、CI release、下載到 ~/Downloads
