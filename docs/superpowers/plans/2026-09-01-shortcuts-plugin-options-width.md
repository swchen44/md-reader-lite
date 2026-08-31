# v1.2.0 實作計畫：快捷鍵強化 + 插件子選項 + 寬度 % 單位

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依核可 spec（`docs/superpowers/specs/2026-09-01-shortcuts-plugin-options-width-design.md`）落地 toggleTheme 三態循環、mdPluginOptions（Linkify+Alert）、customWidthUnit（%），發版 v1.2.0。

**Architecture:** 沿用 v1.1.0 的 applySetting 生效架構（background actionMap → main.ts applySetting switch）；core 純函式 plugin-options.ts / settings.ts 擴充；mdPluginOptions 走重渲染（同 updateMdPlugins）、customWidthUnit 即時（applyTypography）。

**Tech Stack:** TS 4.8.2、webpack、Svelte 3 + SMUI（popup）、markdown-it、linkify-it、@mdit/plugin-alert、node --test、Playwright（驗收）。

## Global Constraints

- 零 host 權限；**無 manifest 變更**；`background.ts` 僅允許 actionMap 兩列增列（`mdPluginOptions`、`customWidthUnit`）。
- 既有 79 條測試不得回歸；測試指定檔名跑：`node --test tests/github-url.test.mjs tests/fsa-path.test.mjs tests/doc-search.test.mjs tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs tests/settings.test.mjs tests/plugin-options.test.mjs`（Task 1 起含 plugin-options）。
- 新 core 檔用 `#core/*` subpath import 供測試（比照 settings.test.mjs）；shell 用 `@/` alias。
- 每 task 結尾：測試綠 + `node_modules/.bin/tsc --noEmit` 乾淨 + commit（四段 Why/What/How/Boundary 中文 + trailers：`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`）。
- i18n 新 key 僅 en/zh-CN/zh-TW 三語系；`src/config/i18n/locale.json` 單檔。
- markdown 文件表格 cell 禁裸 `|`（prettier pre-commit）。
- spec 的「fuzzyLink 預設 true 防回歸」「mdPluginOptions 走重渲染」「alert 只動第一個 entry」「popup 直接賦值」為 binding。

---

### Task 1: core 純函式 + data.ts 擴充 + 單元測試

**Files:**

- Create: `src/core/plugin-options.ts`、`tests/plugin-options.test.mjs`
- Modify: `src/core/data.ts`、`src/core/settings.ts`、`tests/settings.test.mjs`

**Interfaces（Produces）:**

- `Data` 新欄位：`mdPluginOptions?: Record<string, Record<string, unknown>>`、`customWidthUnit?: 'px' | 'percent'`
- `getDefaultData()` 新預設：`mdPluginOptions: getDefaultPluginOptions()`、`customWidthUnit: 'px'`
- `src/core/plugin-options.ts`（零 chrome 依賴）：

```ts
export type PluginOptions = Record<string, Record<string, unknown>>

export function getDefaultPluginOptions(): PluginOptions {
  return {
    Linkify: { fuzzyLink: true, fuzzyIP: false, fuzzyEmail: true },
    Alert: { deep: true },
  }
}

export function mergePluginOptions(stored: unknown): PluginOptions {
  const def = getDefaultPluginOptions()
  if (!stored || typeof stored !== 'object') return def
  const s = stored as Record<string, unknown>
  const out: PluginOptions = {}
  for (const key of Object.keys(def)) {
    const sv = s[key]
    out[key] =
      sv && typeof sv === 'object'
        ? { ...def[key], ...(sv as Record<string, unknown>) }
        : { ...def[key] }
  }
  return out
}

export function resolveLinkify(opts: unknown): {
  fuzzyLink: boolean
  fuzzyIP: boolean
  fuzzyEmail: boolean
} {
  const def = getDefaultPluginOptions().Linkify
  const o = (opts && typeof opts === 'object' ? opts : {}) as Record<
    string,
    unknown
  >
  return {
    fuzzyLink:
      typeof o.fuzzyLink === 'boolean'
        ? o.fuzzyLink
        : (def.fuzzyLink as boolean),
    fuzzyIP:
      typeof o.fuzzyIP === 'boolean' ? o.fuzzyIP : (def.fuzzyIP as boolean),
    fuzzyEmail:
      typeof o.fuzzyEmail === 'boolean'
        ? o.fuzzyEmail
        : (def.fuzzyEmail as boolean),
  }
}

export function resolveAlertDeep(opts: unknown): boolean {
  const o = (opts && typeof opts === 'object' ? opts : {}) as Record<
    string,
    unknown
  >
  return typeof o.deep === 'boolean' ? o.deep : true
}
```

- `src/core/settings.ts` 新增：

```ts
export const CUSTOM_WIDTH_PERCENT_MIN = 20
export const CUSTOM_WIDTH_PERCENT_MAX = 100

export function clampCustomWidthPercent(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return null
  return Math.round(
    Math.min(CUSTOM_WIDTH_PERCENT_MAX, Math.max(CUSTOM_WIDTH_PERCENT_MIN, n)),
  )
}

export function clampCustomWidthValue(
  v: unknown,
  unit: 'px' | 'percent',
): number | null {
  return unit === 'percent' ? clampCustomWidthPercent(v) : clampCustomWidth(v)
}

export function formatContentWidth(
  value: number | null,
  unit: 'px' | 'percent',
): string | null {
  const clamped = clampCustomWidthValue(value, unit)
  if (clamped === null) return null
  return unit === 'percent' ? `${clamped}%` : `${clamped}px`
}
```

**Steps:**

- [ ] 寫 `tests/plugin-options.test.mjs`（`import ... from '#core/plugin-options'`）：getDefaultPluginOptions 結構（**含 `fuzzyLink === true` 斷言**）；mergePluginOptions（null/非物件 → 預設、缺 Alert 補預設、Linkify 部分覆蓋保留其餘、多餘 key 忽略、壞型別 sv 非物件 → 預設）；resolveLinkify（全缺 → 預設 fuzzyLink true/fuzzyIP false/fuzzyEmail true、部分 boolean 覆蓋、非 boolean 值 → 預設）；resolveAlertDeep（true/false/缺 →true/非 boolean→true）≥ 8 block。
- [ ] 寫 `tests/settings.test.mjs` 新增 block：clampCustomWidthPercent（20/100 邊界、10→20、200→100、NaN→null、null→null、'50'→50）；clampCustomWidthValue（px 走既有、percent 走新）；formatContentWidth（900/px→'900px'、50/percent→'50%'、null→null、越界 clamp 後格式化）≥ 6 block。
- [ ] 跑 `node --test tests/plugin-options.test.mjs tests/settings.test.mjs` 確認新測試 FAIL（函式未實作）。
- [ ] 實作 `src/core/plugin-options.ts`（如上）與 `src/core/settings.ts` 新增函式。
- [ ] 改 `src/core/data.ts`：介面加 2 欄位、`getDefaultData` 加 2 預設（`import { getDefaultPluginOptions } from './plugin-options'`——注意 data.ts 現用 `import type`，此處需值 import）。
- [ ] 全測試（8 檔）綠、`tsc --noEmit` 乾淨、commit。

---

### Task 2: shell 佈線（toggleTheme 三態 + 插件子選項透傳 + 寬度%單位）

**Files:**

- Modify: `src/core/commands.ts`、`src/core/markdown.ts`、`src/plugins/alert.ts`、`src/main.ts`、`src/background.ts`（僅 actionMap）

**Interfaces:**

- Consumes：Task 1 的 `resolveLinkify`、`resolveAlertDeep`、`formatContentWidth`、`mergePluginOptions`、`Data` 欄位。
- Produces：`MdOptions.pluginOptions`；applySetting 的 `mdPluginOptions`/`customWidthUnit` case。

**Steps:**

- [ ] **toggleTheme 三態**（`src/core/commands.ts`）：改為

```ts
async toggleTheme(handler) {
  const { pageTheme = 'auto' } = await storage.get('pageTheme')
  const next = pageTheme === 'auto' ? 'light' : pageTheme === 'light' ? 'dark' : 'auto'
  handler('storage', { key: 'pageTheme', value: next })
},
```

- [ ] **alert.ts 收 deep**：`export default function AlertPlugin(md, opts?: { deep?: boolean })`，把第一個 entry `[alert, { deep: true }]` 改為 `[alert, { deep: opts?.deep ?? true }]`；其餘 7 個 container **不動**。
- [ ] **markdown.ts 透傳**：
  - `MdOptions` 加 `pluginOptions?: Record<string, Record<string, unknown>>`。
  - `md.linkify.set({ fuzzyEmail: true })` 改為 `md.linkify.set(resolveLinkify(arguments[0]?.pluginOptions?.Linkify))`（import `resolveLinkify` 自 `@/core/plugin-options`；注意 initRender 是具名 function 才有 arguments——維持現狀，或改讀解構的 `pluginOptions`）。實作定案：`initRender({ config = {}, plugins = [...MD_PLUGINS], pluginOptions }: MdOptions)` 解構出 `pluginOptions`，直接用 `resolveLinkify(pluginOptions?.Linkify)`。
  - `PLUGINS.Alert` 改函式型：`Alert: (o) => [mAlert, { deep: resolveAlertDeep(o?.pluginOptions?.Alert) }]`（`mAlert` 即 alert.ts default）。
- [ ] **main.ts mdRenderer 傳 pluginOptions**：`mdRender(code, { theme, plugins, config, pluginOptions: configData.mdPluginOptions, ...options })`。
- [ ] **main.ts applySetting 兩 case**：
  - `mdPluginOptions`：`contentRender(mdRaw); renderSide()`（同 updateMdPlugins 的重渲染；注意 reloading 旗標處理比照 updateMdPlugins——若 mdRaw 為空則 reload）。實作可直接呼叫既有 `updateMdPlugins` handler 邏輯或複製其守則。
  - `customWidthUnit`：`applyTypography()`。
- [ ] **applyTypography 單位感知**（main.ts）：`const w = formatContentWidth(configData.customWidth, configData.customWidthUnit || 'px'); w ? s.setProperty('--md-reader-content-width', w) : s.removeProperty(...)`（import `formatContentWidth`）。
- [ ] **background.ts actionMap** 加兩列：`mdPluginOptions: 'applySetting'`、`customWidthUnit: 'applySetting'`。
- [ ] 手動 smoke：build 後確認裸網域仍連結（fuzzyLink 預設 true 未回歸）、Alert deep 切換、寬度 % 生效、快捷鍵 Alt+Shift+T 三態循環。
- [ ] 全測試綠、tsc 乾淨、`git diff main -- src/background.ts` 只見兩列 actionMap、commit。

---

### Task 3: popup UI（插件子選項 + 寬度單位切換）+ i18n

**Files:**

- Modify: `src/popup/components/tab-plugins.svelte`、`src/popup/components/tab-appearance.svelte`、`src/config/i18n/locale.json`

**Interfaces:**

- Consumes：Task 1 的 `clampCustomWidthValue`、`TEXT_SIZES`；`data.mdPluginOptions`/`data.customWidthUnit`。

**Steps:**

- [ ] **tab-plugins.svelte**：既有 chips Set 下方加「插件子選項」區：
  - 連結辨識（Linkify）：三個 Switch（fuzzyLink/fuzzyIP/fuzzyEmail），change → `data.mdPluginOptions.Linkify.fuzzyLink = e; updateConfig('mdPluginOptions', data.mdPluginOptions)`（直接賦值，非 immutable）。
  - 警告框（Alert）：一個 Switch（deep），同上模式。
  - 若 `data.mdPluginOptions` 缺鍵，讀取時以預設補（`data.mdPluginOptions?.Linkify?.fuzzyLink ?? true`）——但 Task 1 的 getDefaultData 已保證有值，防禦即可。
- [ ] **tab-appearance.svelte 自訂寬度加單位**：現有 number input 旁加 px/％ 切換（兩顆 radio 或 SMUI Select）。切 unit → `data.customWidthUnit = unit; updateConfig('customWidthUnit', unit)`，並用對應範圍 clamp 現值（`clampCustomWidthValue(data.customWidth, unit)` 回寫）。number input 的 min/max 依 unit 動態（px 500–3000、% 20–100）；失焦 clamp 用 `clampCustomWidthValue`。
- [ ] **locale.json 新 key**（en/zh-CN/zh-TW ×3）：`label_plugin-options`、`label_linkify`、`label_fuzzy-link`、`label_fuzzy-ip`、`label_fuzzy-email`、`label_alert-deep`、`label_width-unit`、`unit_px`、`unit_percent`。台灣用語（連結辨識/模糊連結/IP 位址/Email/巢狀警告框/寬度單位/像素/百分比）。
- [ ] build 後手動開 popup 檢查子選項與單位切換寫入 storage。
- [ ] 全測試綠、tsc 乾淨、commit。

---

### Task 4: 驗收 + 文件 + 合併發版 v1.2.0（controller）

- [ ] Playwright 驗收（真瀏覽器、unpacked extension）：
  - 四快捷鍵：Alt+Shift+B/C/R 切換 hiddenSide/centered/refresh；Alt+Shift+T 三態循環 auto→light→dark→auto（連按三次驗 storage pageTheme 值序列；快捷鍵無法直接由 Playwright 送，改以在 popup context 呼叫 `commands` 對應的 storage 切換或直接驗 commands.ts 邏輯——若快捷鍵事件不可自動化，以單元測試 + 手動清單佐證 toggleTheme 三態，並在報告註明）。
  - 插件子選項：預設渲染裸網域 `example.com` → 連結（fuzzyLink 未回歸）；popup 關 fuzzyLink → 重渲染後裸網域不連結；Alert deep 開/關 → 巢狀 alert；子選項寫入 mdPluginOptions storage。
  - 寬度 % 單位：popup 切 percent + 值 50 → content max-width 為 `50%`；px↔percent 切換值 clamp 正確。
  - md 頁全功能迴歸（v1.1.0 全設定：字級/字體/自訂 CSS/代碼主題/zen/浮動選單/圖表 panzoom/搜尋/檔案樹不回歸）。
- [ ] `docs/plans.md`/`designs.md` 本案列；`docs/ROADMAP.md` 四項擴充的 1/2/4 → 完成（v1.2.0），第 3 項（字元集）標記為 v1.2.1 待做；`docs/developer_guide.md` 補快捷鍵表（四個 Alt+Shift 綁定 + toggleTheme 三態）。
- [ ] 最終整分支審查（sonnet）→ fix batch → 合入 main（--no-ff）→ bump 1.2.0（package.json + src/manifest.json）→ 檢查無繼承舊 tag → tag v1.2.0 → CI release 監控。

## Self-Review 紀錄

- **Spec coverage**：快捷鍵 toggleTheme 三態（T2）＋驗證/文件（T4）；插件子選項 mdPluginOptions 資料模型（T1）＋透傳 markdown/alert/main/background（T2）＋ popup UI（T3）；寬度%單位 clamp/format 純函式（T1）＋ applyTypography/background（T2）＋ popup 單位切換（T3）。fuzzyLink 預設 true 防回歸落在 T1 測試。
- **Placeholder scan**：無 TBD；markdown.ts 的 initRender arguments vs 解構於 T2 明確定案為解構 pluginOptions。
- **Type consistency**：`PluginOptions` 型別 T1 定義、T2 透傳一致；`clampCustomWidthValue(v, unit)` 簽名 T1 定義、T2/T3 沿用；`formatContentWidth` 回傳 string|null 一致。
