# 案 B+F 實作計畫：設定面板對齊 + 頁內浮動選單 + 圖表檢視器

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依核可 spec（`docs/superpowers/specs/2026-08-31-settings-panel-and-diagram-viewer-design.md`）落地 13 個新設定 key、popup 三頁籤、頁內浮動選單五項、panzoom 圖表檢視器，發版 v1.1.0。

**Architecture:** flat storage key + 既有雙白名單訊息機制擴充（`actionMap` 新 key 全部映射單一 `applySetting` action）；core（node 可測純函式 `settings.ts`）/shell 分層；代碼主題以新 `data-md-reader-code-theme` attribute 與頁面主題解耦。

**Tech Stack:** TS 4.8.2、webpack、Svelte 3 + SMUI（popup）、markdown-it、highlight.js、`@panzoom/panzoom`（新依賴）、node --test、Playwright（驗收）。

## Global Constraints

- 零 host 權限；manifest 僅允許 `.txt` matches 擴充（8 條，比照 md 模式）；`background.ts` 僅允許 `actionMap` 增列。
- 既有 63 條測試不得回歸；測試一律指定檔名跑：`node --test tests/github-url.test.mjs tests/fsa-path.test.mjs tests/doc-search.test.mjs tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs tests/settings.test.mjs`（Task 1 起含 settings）。
- 新 core 檔用 `#core/*` subpath import 供測試（比照 github-url）；shell 用 `@/` alias。
- 每 task 結尾：測試綠 + `node_modules/.bin/tsc --noEmit` 乾淨 + commit（四段 Why/What/How/Boundary 中文 + trailers：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`）。
- i18n 新 key 僅 en/zh-CN/zh-TW 三語系（其餘 fallback）；`src/config/i18n/locale.json` 單檔。
- markdown 文件表格 cell 禁裸 `|`（prettier pre-commit）。
- spec 的「設定生效機制」「zenMode 三規則」「.txt 判定點」「代碼主題解耦」節為 binding。

---

### Task 1: core `settings.ts` + `data.ts` 擴充 + 單元測試

**Files:**

- Create: `src/core/settings.ts`、`tests/settings.test.mjs`
- Modify: `src/core/data.ts`

**Interfaces（Produces，後續任務依賴）:**

- `Data` 新欄位：`refreshInterval?: number`、`codeWrap?: boolean`、`codeBlockDayTheme?: 'light' | 'dark'`、`codeBlockNightTheme?: 'light' | 'dark'`、`textSize?: number`、`textFont?: string`、`txtAsMd?: boolean`、`outlineCollapse?: boolean`、`breaks?: boolean`、`customWidth?: number | null`、`customCss?: string`、`zenMode?: boolean`
- `getDefaultData()` 新預設：`refreshInterval: 0.5, codeWrap: false, codeBlockDayTheme: 'light', codeBlockNightTheme: 'dark', textSize: 16, textFont: 'default', txtAsMd: false, outlineCollapse: false, breaks: false, customWidth: null, customCss: '', zenMode: false`；`pageTheme` 預設由 `PAGE_THEMES[0]`（light）改為 `'auto'`。
- `src/core/settings.ts` 匯出（零 chrome 依賴）：

```ts
export const REFRESH_INTERVAL_MIN = 0.5
export const REFRESH_INTERVAL_MAX = 600
export const CUSTOM_WIDTH_MIN = 500
export const CUSTOM_WIDTH_MAX = 3000
export const TEXT_SIZES = [12, 14, 16, 18, 20, 24] as const

export function clampRefreshInterval(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return REFRESH_INTERVAL_MIN
  return Math.min(REFRESH_INTERVAL_MAX, Math.max(REFRESH_INTERVAL_MIN, n))
}

export function clampCustomWidth(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return null
  return Math.round(Math.min(CUSTOM_WIDTH_MAX, Math.max(CUSTOM_WIDTH_MIN, n)))
}

export function textSizeIndex(px: unknown): number {
  const n = typeof px === 'number' ? px : parseFloat(String(px))
  let best = 2 // 16px
  ;(TEXT_SIZES as readonly number[]).forEach((size, i) => {
    if (Math.abs(size - n) < Math.abs(TEXT_SIZES[best] - n)) best = i
  })
  return isFinite(n as number) ? best : 2
}

export const FONT_STACKS: Record<string, string> = {
  default: '',
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", "Songti TC", "Noto Serif CJK TC", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
}

export function resolveCodeTheme(
  pageThemeResolved: 'light' | 'dark',
  day: 'light' | 'dark' = 'light',
  night: 'light' | 'dark' = 'dark',
): 'light' | 'dark' {
  return pageThemeResolved === 'dark' ? night : day
}

export function isTxtUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname
    return /\.txt$/i.test(pathname)
  } catch {
    return false
  }
}
```

**Steps:**

- [ ] 寫 `tests/settings.test.mjs`（`import ... from '#core/settings'`）：clampRefreshInterval（0.5/600 邊界、-1→0.5、9999→600、NaN/'abc'→0.5、'2.5' 字串 →2.5）；clampCustomWidth（null/''→null、100→500、5000→3000、'800'→800、NaN→null）；textSizeIndex（16→2、12→0、25→5、非數 →2）；FONT_STACKS 四 key 存在且 default 為空字串；resolveCodeTheme 四組合；isTxtUrl（`.txt`/`.TXT`/`?query`/`.md`→false/相對字串 →false）。至少 12 個 test block。
- [ ] 跑測試確認 FAIL（模組不存在）。
- [ ] 實作 `src/core/settings.ts`（如上）；`package.json` 的 `imports` 與 tsconfig paths 若未涵蓋 `#core/settings` 需確認（既有 `#core/*` 萬用即可，勿新增重複條目）。
- [ ] 改 `src/core/data.ts`：介面加 12 欄位、`getDefaultData` 加 12 預設、`pageTheme: 'auto'`（import type 不變；`'auto'` 屬 `PAGE_THEMES` 成員，型別相容）。
- [ ] 全測試（7 檔）綠、`tsc --noEmit` 乾淨、commit。

---

### Task 2: 生效機制佈線 + 一般類設定落地（refreshInterval / breaks / txtAsMd / codeWrap）+ manifest

**Files:**

- Modify: `src/background.ts`（僅 `actionMap`）、`src/main.ts`、`src/core/markdown.ts`（不用改——`config` 透傳已支援 breaks，見下）、`src/manifest.json`、`src/style/index.less`（codeWrap 樣式）、`src/config/class-name.ts`

**Interfaces:**

- Consumes：Task 1 的 `Data` 欄位、`clampRefreshInterval`、`isTxtUrl`。
- Produces：`main.ts` 內 `applySetting(key, value)` 分派函式（Task 3/4 增 case）；`className.CODE_WRAP = p`code-wrap``。

**Steps:**

- [ ] `src/background.ts` `actionMap` 增列（全部映射 `'applySetting'`）：

```ts
const actionMap = {
  enable: 'reload',
  refresh: 'toggleRefresh',
  centered: 'toggleCentered',
  mdPlugins: 'updateMdPlugins',
  pageTheme: 'updatePageTheme',
  hiddenSide: 'toggleSide',
  folderTree: 'toggleFolderTree',
  refreshInterval: 'applySetting',
  codeWrap: 'applySetting',
  codeBlockDayTheme: 'applySetting',
  codeBlockNightTheme: 'applySetting',
  textSize: 'applySetting',
  textFont: 'applySetting',
  customWidth: 'applySetting',
  customCss: 'applySetting',
  zenMode: 'applySetting',
  breaks: 'applySetting',
  txtAsMd: 'applySetting',
  outlineCollapse: 'applySetting',
}
```

- [ ] `src/main.ts` `actions` 物件加 handler（注意：既有 onMessage listener 先寫 `configData[key] = value` 再派發，applySetting 直接讀 `configData`）：

```ts
applySetting(value, oldValue) {
  // key 由 listener 閉包提供：改寫 listener 傳入 key —— actions[action]?.(value, oldValue, key)
},
```

實際定案：把既有 listener 改為 `actions[action]?.(value, oldValue, key)`（第三參數，其餘 handler 不受影響），`applySetting(value, _old, key)` 內 switch：

- `refreshInterval`：無動作（polling 每輪讀 `configData.refreshInterval`，見下）。
- `codeWrap`：`mdContent.ele.classList.toggle(className.CODE_WRAP, !!value)`。
- `breaks`、`txtAsMd`、`outlineCollapse`：`window.location.reload()`（Task 4 落地 outlineCollapse 後仍維持 reload 生效）。
- 其餘 key（textSize 等）：本 task 先留 `// Task 3/4 補` 空 case（不 throw）。
- [ ] 輪詢間隔：`polling()` 內 `pollingTimer = setTimeout(watch, 500)` 改為 `setTimeout(watch, clampRefreshInterval(configData.refreshInterval) * 1000)`（import 自 `@/core/settings`）。
- [ ] breaks：`mdRenderer` 的 `mdRender(code, {...})` options 加 `config: { breaks: !!configData.breaks }`（`initRender` 已把 `config` spread 進 MarkdownIt options——不用改 markdown.ts）。
- [ ] txtAsMd：`main()` 開頭、`if (!configData.enable || !CONTENT_TYPES...)` **之前**加獨立 if：

```ts
if (isTxtUrl(window.location.href) && !configData.txtAsMd) {
  return
}
```

- [ ] `src/manifest.json` matches 增 8 條：`*://*/*.txt`、`*://*/*.TXT`、`file://*/*.txt`、`file://*/*.TXT`、`*://*/*.txt?*`、`*://*/*.TXT?*`、`file://*/*.txt?*`、`file://*/*.TXT?*`。
- [ ] codeWrap 樣式：`src/style/index.less` 適當位置加：

```less
.md-reader__code-wrap {
  .hljs-pre code {
    white-space: pre-wrap;
    word-break: break-all;
  }
}
```

（選擇器依實際 code block 結構微調：`pre.hljs-pre.md-reader__code-block > code.hljs`；class 掛在 `mdContent`（article）上，故寫成 `.md-reader__code-wrap .hljs-pre code`。）

- [ ] 手動 smoke：build 後本機確認 codeWrap 切換即時生效、txt 頁 early return。
- [ ] 全測試綠、tsc 乾淨、`git diff main -- src/background.ts` 只見 actionMap、commit。

---

### Task 3: 外觀落地（textSize / textFont / customWidth / customCss / 代碼主題解耦）

**Files:**

- Modify: `src/main.ts`、`src/style/variable.less`、`src/style/index.less`、`src/shared/index.ts`、`src/config/page-themes.ts`（加 code-theme attribute 常數）

**Interfaces:**

- Consumes：Task 2 的 `applySetting` switch、Task 1 的 `FONT_STACKS`/`clampCustomWidth`/`resolveCodeTheme`。
- Produces：`data-md-reader-code-theme` attribute 慣例；`setCodeTheme(t: 'light' | 'dark')` helper（`src/shared/index.ts`）。

**Steps:**

- [ ] `variable.less` 解耦（spec §六 binding）：
  1. 從 `.light()` 移除 `.hljs-light(); .highlight();`，從 `.dark()` 移除 `.hljs-dark(); .highlight();`。
  2. `:root` 區塊新增：

```less
&[data-md-reader-code-theme='light'] .md-reader {
  .hljs-light();
  .highlight();
}
&[data-md-reader-code-theme='dark'] .md-reader {
  .hljs-dark();
  .highlight();
}
```

3. 無 attribute 時的 fallback（popup 等非 content 頁）：保留 `:root` 頂層 `.light()` 內原有變數即可；驗證 popup 樣式不因 hljs 抽離而壞（popup 不含 code block，風險低——仍需截圖確認）。

- [ ] `src/config/page-themes.ts` 加 `export const rootCodeThemePrefix = 'mdReaderCodeTheme'`；`src/shared/index.ts` 加：

```ts
export function setCodeTheme(theme: Exclude<Theme, 'auto'>) {
  HTML.dataset[rootCodeThemePrefix] = theme
}
```

- [ ] `main.ts` 初始化（`setTheme(configData.pageTheme)` 之後）：

```ts
const applyCodeTheme = () =>
  setCodeTheme(
    resolveCodeTheme(
      toTheme(configData.pageTheme),
      configData.codeBlockDayTheme,
      configData.codeBlockNightTheme,
    ),
  )
applyCodeTheme()
```

並在三處觸發：`updatePageTheme` handler 內、`darkMediaQuery` change listener 內（auto 時）、`applySetting` 的 `codeBlockDayTheme`/`codeBlockNightTheme` case。

- [ ] textSize/textFont/customWidth：初始化時與 applySetting case 中設定 CSS 變數（掛 `mdContent.ele.style`）：

```ts
const applyTypography = () => {
  const s = mdContent.ele.style
  s.setProperty('--md-reader-text-size', `${configData.textSize || 16}px`)
  const stack = FONT_STACKS[configData.textFont] || ''
  stack
    ? s.setProperty('--md-reader-text-font', stack)
    : s.removeProperty('--md-reader-text-font')
  const w = clampCustomWidth(configData.customWidth)
  w
    ? s.setProperty('--md-reader-content-width', `${w}px`)
    : s.removeProperty('--md-reader-content-width')
}
```

`index.less` 的 `.md-reader__content`（article）規則加：`font-size: var(--md-reader-text-size, 16px); font-family: var(--md-reader-text-font, inherit);`；居中寬度既有規則的 max-width 值改 `var(--md-reader-content-width, <原值>)`（原值照抄現行 less）。

- [ ] customCss：初始化與 applySetting case——`<style id="md-reader-custom-css">` 存在則更新 textContent、空字串則移除；掛 `document.head`。
- [ ] 手動 smoke（build + 本機）：四種代碼主題組合截圖（淺頁+深代碼、深頁+淺代碼必拍）；字級/字體/寬度/自訂 CSS 即時生效。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 4: outlineCollapse + zenMode + 浮動選單

**Files:**

- Modify: `src/main.ts`、`src/style/index.less`、`src/config/class-name.ts`、`src/config/i18n/locale.json`（本 task 用到的 key）

**Interfaces:**

- Consumes：Task 2 `applySetting`；既有 `rawToggleBtn` handler、`closeSearch()`、`handleHeadItem`/`renderSide`。
- Produces：`className` 新增 `ZEN = p`zen`` 、`FLOAT_MENU = p`float-menu ``、`FLOAT_MENU_OPEN`、`SIDE_FOLD = p`side-fold``（大綱摺疊箭頭）。

**Steps:**

- [ ] **outlineCollapse**（reload 生效，維持 Task 2 的 reload case）：`configData.outlineCollapse` 為 true 時，`handleHeadItem` 產出的 li 加摺疊箭頭 span（僅當該標題其後存在更深層級標題時）；點箭頭 toggle 收合：收合＝隱藏「其後所有層級更深的 li，直到遇到同級或更淺」（在 `renderSide` 後以 `sideLiElements` + tagName 層級計算，純 DOM `display:none`）。收合狀態不持久化（reload 重置）。
- [ ] **zenMode**（spec 三規則 binding）：`applySetting` 的 `zenMode` case + 初始化各一次呼叫：

```ts
const applyZen = () => {
  if (configData.zenMode && searchOpen) closeSearch()
  document.body.classList.toggle(className.ZEN, !!configData.zenMode)
}
```

`index.less`：`body.md-reader__zen` 下隱藏 `.md-reader__side`、`.md-reader__side-tabs`、`.md-reader__files-panel`、`.md-reader__button-wrap`（浮動選單除外）；不動 `hiddenSide` storage。

- [ ] **浮動選單**：`main()` 閉包內建 `≡` 按鈕（fixed 右上，`className.FLOAT_MENU`）＋下拉（五項，i18n key：`menu_toggle-raw`、`menu_fullscreen`、`menu_print`、`menu_zen`、`menu_about`）。行為：
  - 切原始內容：把既有 `rawToggleBtn` click 邏輯抽成 `function toggleRawView()`，兩處呼叫。
  - 全螢幕：`document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})`。
  - 列印：`window.print()`；`index.less` 加 `@media print` 隱藏側欄/浮動元件/按鈕群。
  - 禪模式：`chrome.runtime.sendMessage({ action: 'storage', data: { key: 'zenMode', value: !configData.zenMode } })`（走既有 storage 路徑回流 applySetting）。
  - 關於：`window.open(pkg.homepage)`（main.ts 已可 import package.json？若無先例則寫死 `https://github.com/swchen44/md-reader-lite`——採後者，避免 bundle 拖入 package.json）。
  - 點選單外部關閉下拉；zen 模式下按鈕半透明（opacity 0.4，hover 恢復）。
- [ ] locale.json：五個 menu key en/zh-CN/zh-TW。
- [ ] 手動 smoke：五項行為、zen 進出與搜尋列互動、print 預覽。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 5: popup 三頁籤改版 + 全部設定控件 + i18n

**Files:**

- Create: `src/popup/components/tab-general.svelte`、`tab-appearance.svelte`、`tab-plugins.svelte`
- Modify: `src/popup/components/app.svelte`、`src/config/i18n/locale.json`

**Interfaces:**

- Consumes：Task 1 `Data`/預設值、`TEXT_SIZES`/`FONT_STACKS` keys、`clampRefreshInterval`/`clampCustomWidth`（popup 端失焦 clamp）。
- Produces：無（終端 UI）。

**Steps:**

- [ ] `app.svelte` 改為頁籤容器：頂部三鈕（`tab_general`/`tab_appearance`/`tab_plugins`，SMUI Button 或自製，沿用現有樣式語彙），`{#if}` 切換三個子元件；`data`、`localize`、`updateConfig` 以 props 傳入子元件（維持既有逐 key `updateConfig` 機制）。
- [ ] **一般**：啟用、自動刷新開關＋間隔 number input（`on:blur` 時 `clampRefreshInterval` 回寫並 `updateConfig('refreshInterval', v)`；僅 `refresh` 開啟時顯示）、換行風格（標示「切換後頁面將重新整理」`hint_reload`）、`.txt` 渲染（同標示）、目錄樹（既有）、大綱摺疊（同標示）、語言（既有）、**恢復預設**按鈕：兩段式（首次點擊變紅顯示 `label_reset-confirm`，3 秒內再點執行）→ `chrome.storage.local.clear()` 後 `storage.set(getDefaultData())`，再送 `{action:'storage', data:{key:'enable', value:true}}` 觸發 active tab reload，UI 顯示 `hint_reset-done`（含「其他分頁請手動重新整理」）。
- [ ] **外觀**：字級六級 slider（SMUI Slider 若已有依賴；否則原生 `<input type=range min=0 max=5>` 映射 `TEXT_SIZES`）、字體 Select（default/sans/serif/mono）、主題三選（既有 Radio）、淺色代碼主題二選、深色代碼主題二選、代碼換行、內容居中（既有）、自訂寬度（開關＋ number input 500–3000，`centered` 時顯示；關閉 →`updateConfig('customWidth', null)`）、自訂 CSS（textarea ＋「套用」鈕 →`updateConfig('customCss', text)`）、禪模式開關。
- [ ] **插件**：總開關 checkbox（`checked = data.mdPlugins.length === MD_PLUGINS.length`；change → `updateConfig('mdPlugins', 全部或 [])`）＋既有 chips Set 原樣搬入。
- [ ] locale.json 新 key（en/zh-CN/zh-TW ×3）：`tab_general`、`tab_appearance`、`tab_plugins`、`label_refresh-interval`、`label_breaks`、`label_txt-as-md`、`label_outline-collapse`、`label_reset`、`label_reset-confirm`、`hint_reset-done`、`hint_reload`、`label_text-size`、`label_text-font`、`label_code-theme-day`、`label_code-theme-night`、`label_code-wrap`、`label_custom-width`、`label_custom-css`、`label_apply`、`label_zen`、`label_all-plugins`、字體選項 `font_default`/`font_sans`/`font_serif`/`font_mono`。
- [ ] build 後手動開 popup 檢查三頁籤與每個控件寫入（chrome.storage 檢視）。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 6: 案 F 圖表檢視器（panzoom）

**Files:**

- Create: `src/plugins/diagram-viewer.ts`
- Modify: `src/plugins/index.ts`（註冊）、`src/style/index.less`、`src/config/class-name.ts`、`package.json`（依賴）

**Interfaces:**

- Consumes：`initPlugins` 的 `{ event }`（`contentRendered` 事件，見 `src/plugins/graphviz-renderer.ts:72` 同模式）。
- Produces：`className.DIAGRAM_VIEWER = p`diagram-viewer`` 、`DIAGRAM_CONTROLS = p`diagram-controls ``。

**Steps:**

- [ ] `pnpm add @panzoom/panzoom`（確認 lockfile 與 `allowBuilds` 無新增需求；純 JS 無 postinstall）。
- [ ] `diagram-viewer.ts`：`event.on('contentRendered', container => attach(container))`；`attach` 對 `pre.mermaid` 與 `.md-reader__graphviz`（實際 class 以 `src/plugins/graphviz-block.ts` 的 `GRAPHVIZ_CLASS` 為準，實作時查證）容器：
  - 首次 `mouseenter` 才 `Panzoom(svgEle, { maxScale: 8, minScale: 0.3, cursor: 'grab' })`（lazy）；同時掛控制列（右下角三鈕：＋ `zoomIn()`、− `zoomOut()`、⟳ `reset()`），`wheel` 事件綁 `panzoom.zoomWithWheel`。
  - 容器加 `position: relative; overflow: hidden`（class `DIAGRAM_VIEWER`）；控制列預設 opacity 0，容器 hover 顯示。
  - SVG 缺尺寸或 Panzoom throw → try/catch 略過該圖表。
  - 重複 `contentRendered`（auto-refresh 重渲染）：以 `dataset.mdReaderPz = '1'` 防重複 attach。
- [ ] `plugins/index.ts` 註冊（比照 graphviz-renderer/img-viewer 既有模式）。
- [ ] `index.less`：控制列樣式（沿用 `--color-button*` 變數）。
- [ ] 手動 smoke：example 檔含 mermaid 與 digraph 圖表，滾輪縮放、拖曳、三鈕、reset。
- [ ] 全測試綠、tsc 乾淨、build 成功（bundle 增量記錄於 commit Boundary）、commit。

---

### Task 7: 驗收 + 文件 + 合併發版 v1.1.0（controller）

- [ ] Playwright 驗收（真瀏覽器、unpacked extension）：
  - content 頁（http://localhost:8123）：codeWrap/textSize/textFont/customWidth/customCss/代碼主題交叉組合/zen/浮動選單五項/outlineCollapse/breaks reload 生效/圖表縮放。
  - popup：`context.serviceWorkers()` 取 id → `goto('chrome-extension://<id>/popup.html')`：三頁籤、每控件寫 storage、恢復預設、總開關。
  - `.txt`：本機 http `.txt` 檔——`txtAsMd=false` 不渲染、true 渲染。
  - md 頁全功能迴歸（側欄/搜尋/檔案樹/FSA 面板/GitHub 樹不回歸）。
- [ ] `docs/plans.md`/`designs.md` 案 B+F 列；`docs/ROADMAP.md` 案 B、案 F → 完成（v1.1.0）；`docs/store-listing.md` 補 .txt 支援與（依 v1.0.5 遺留 triage）修正「nothing leaves your browser」措辭對齊 GitHub API 例外。
- [ ] 最終整分支審查（sonnet）→ fix batch → 合入 main（--no-ff）→ bump 1.1.0（package.json + src/manifest.json）→ tag v1.1.0 → CI release 監控。

## 範圍擴充備忘（2026-08-31 使用者核可，未排程）

使用者於 2026-08-31 檢視商店版 crx 分析後，勾選以下四項原 spec 排除的功能為後續移植目標（不納入本計畫 v1.1.0 範圍；補充事實見 `docs/research/2026-08-31-store-crx-3628-local-unpack-notes.md`）：

1. **鍵盤快捷鍵**（成本低，可考慮併入 v1.1.x）：manifest 加 `commands`（`toggleCentered` Alt+Shift+C、`togglePageTheme` Alt+Shift+T、`toggleRefresh` Alt+Shift+R、`toggleSide` Alt+Shift+B），`background.ts` 掛 `chrome.commands.onCommand`，切換值走既有 `{action:'storage'}` 訊息路徑回流生效機制。`commands` 非 permission，零新權限。
2. **插件子選項**（成本高，建議獨立成案）：新增 `mdPluginOptions` map 存 storage；popup 插件頁每插件加 ⚙ 展開；`initRender` 透傳 options。優先順序建議照商店版免費子選項起步：Linkify（fuzzy 三開關）、FrontMatter（showMetadata）、Alert（7 項），其後才是 TOC/Katex/Mermaid/MultimdTable/TaskLists（Lite 全做成免費）。完整預設值 schema 見上述 research 文件 §4。
3. **字元集相容模式**：`charsetCompat: boolean` + `charset: string`（預設 `'utf-8'`）兩 key，僅影響 `file://` 大檔載入；商店版實作點未拆解，動工前需先研究其 content script 的讀檔路徑。
4. **寬度 % 單位**：`customWidth` 由 `number | null` 擴為含單位（新增 `customWidthUnit: 'px' | 'percent'` key，避免破壞既有 flat 結構），popup 自訂寬度控件加單位切換（px 500–3000、% 20–100，範圍比照商店版）。

## Self-Review 紀錄

- **Spec coverage**：13 key（T1 資料模型；T2 refreshInterval/breaks/txtAsMd/codeWrap；T3 textSize/textFont/customWidth/customCss/codeBlock 兩主題＋ pageTheme auto；T4 outlineCollapse/zenMode）、popup 三頁籤＋總開關＋恢復預設（T5）、浮動選單五項（T4）、案 F（T6）、manifest .txt（T2）、驗收與發版（T7）。生效機制/zen 三規則/txt 判定點/代碼主題解耦四個 binding 節各自落在 T2/T4/T2/T3。
- **Placeholder scan**：無 TBD；graphviz 容器 class 於 T6 標明「實作時查證 GRAPHVIZ_CLASS」屬指定查證點非留白。
- **Type consistency**：`applySetting(value, oldValue, key)` 第三參數簽名 T2 定義、T3/T4 沿用；`setCodeTheme`/`rootCodeThemePrefix` 命名 T3 一致；`className` 新常數各 task 一致。
