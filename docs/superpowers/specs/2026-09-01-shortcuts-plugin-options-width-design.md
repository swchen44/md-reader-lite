# 設計文件（v1.2.0）：鍵盤快捷鍵強化 + 插件子選項 + 寬度 % 單位

日期：2026-09-01 ／ 分支：`feature/shortcuts-plugin-options-width` ／ 目標版本：v1.2.0

## 背景與範圍

依 2026-08-31 使用者核可的「範圍擴充備忘」（`docs/superpowers/plans/2026-08-31-settings-viewer.md` 文末）四項的前三項，分兩批的第一批。字元集相容模式（第四項）因需先做 file:// fetch 可行性 spike、且與零權限有張力，留待下一輪（v1.2.1）。

**關鍵事實更正**：範圍擴充備忘第 1 項稱「manifest 加 commands」——實查 Lite **已完整具備**鍵盤快捷鍵（繼承自上游 2.12.12）：`src/manifest.json` 有 `commands` 四項（`toggleSide` Alt+Shift+B、`toggleCentered` Alt+Shift+C、`toggleRefresh` Alt+Shift+R、`toggleTheme` Alt+Shift+T）、`src/core/commands.ts` 有對應實作、`src/background.ts:25` 掛 `chrome.commands.onCommand`，端到端已可運作。故本項不是「新增」而是「驗證＋文件＋小幅強化」。

使用者決定（2026-09-01）：快捷鍵＝驗證＋文件＋小幅強化；本批＝ 1+2+4 合為 v1.2.0。

## 一、鍵盤快捷鍵（驗證＋文件＋強化）

- **驗證**：Playwright 驗收四個快捷鍵實際切換對應設定並即時生效（透過既有 `commands[action] → messageHandler → updatePage` 路徑）。
- **強化**：`src/core/commands.ts` 的 `toggleTheme` 目前只在 `light ↔ dark` 兩態切換（`pageTheme === 'light' ? 'dark' : 'light'`），忽略 v1.1.0 新增的 `'auto'` 預設。改為三態循環 `auto → light → dark → auto`：

```ts
async toggleTheme(handler) {
  const { pageTheme = 'auto' } = await storage.get('pageTheme')
  const next = pageTheme === 'auto' ? 'light' : pageTheme === 'light' ? 'dark' : 'auto'
  handler('storage', { key: 'pageTheme', value: next })
}
```

預設值由 `'light'` 改為 `'auto'`（對齊 v1.1.0 的 `getDefaultData` 預設）。

- **文件**：`docs/developer_guide.md`（或 store-listing）補快捷鍵表；ROADMAP 標記。無 manifest 變更、無新權限。

## 二、插件子選項（`mdPluginOptions`）

### 資料模型

新增單一 flat storage key `mdPluginOptions`（型別 `Record<string, Record<string, unknown>>`，維持 flat-key 慣例——一個 key 存一個物件，不逐插件開 key 避免 key 爆炸）。預設值只含本批實作的插件，缺項由消費端補預設：

```ts
mdPluginOptions: {
  Linkify: { fuzzyLink: false, fuzzyIP: false, fuzzyEmail: true },
  Alert:   { deep: true },
}
```

### 初始覆蓋範圍（本批）

Lite 的插件集與商店版不同（商店版的 Linkify/FrontMatter 在 Lite 分別是 MarkdownIt 核心設定與 Obsidian 插件）。本批只做**兩個乾淨、高價值、Lite 實際擁有**的插件，建立可擴充的 `mdPluginOptions` 基礎架構，其餘（TaskLists/TOC/Katex/Mermaid/MultimdTable、以及 Obsidian 的 frontmatter showMetadata）留待後續增量：

- **Linkify**（3 開關，商店版免費全開）：`fuzzyLink`（無 `http(s)://` 也自動連結）、`fuzzyIP`（純 IP）、`fuzzyEmail`（Email，預設開）。落點：`markdown.ts` 現有 `md.linkify.set({ fuzzyEmail: true })` 改為讀 `mdPluginOptions.Linkify`。Linkify 是 MarkdownIt 核心（非 `MD_PLUGINS` 成員），故 popup 中歸為獨立「連結辨識」子設定區、不掛在插件 chip 上——或作為特例插件項顯示（見 UI 節）。
- **Alert**（1 開關）：`deep`（巢狀 alert）。落點：`src/plugins/alert.ts` 的 `[alert, { deep: true }]` 改為接受注入的 `deep`；`alert.ts` 匯出改為 `(md, opts?) => ...` 或以工廠函式包裝，`markdown.ts` 的 `PLUGINS.Alert` 改為函式型 `(mdOpts) => [mAlert, { deep: mdOpts.pluginOptions?.Alert?.deep ?? true }]`（`mAlert` 需支援收 options）。

### 生效機制

`mdPluginOptions` 是 **reload 類**（改後需重建 MarkdownIt 實例）：`background.ts` actionMap 加 `mdPluginOptions: 'applySetting'`，`main.ts` applySetting 的該 case → `window.location.reload()`（比照 `breaks`/`mdPlugins` 的重渲染需求；`mdPlugins` 現行走 `updateMdPlugins` 重渲染，`mdPluginOptions` 亦可走同路徑重渲染而非整頁 reload——擇一：優先重渲染 `contentRender(mdRaw); renderSide()`，與 `updateMdPlugins` 一致，體驗較好）。

`markdown.ts` 透傳：`MdOptions` 加 `pluginOptions?: Record<string, Record<string, unknown>>`；`initRender` 內：

- `md.linkify.set({ fuzzyLink, fuzzyIP, fuzzyEmail })` 讀 `pluginOptions?.Linkify`（缺則預設）。
- `PLUGINS` 函式型 entry 已收 `MdOptions`（`plugin(arguments[0])`），故 Alert 改函式型即可讀 `arguments[0].pluginOptions`。
  `main.ts` 的 `mdRenderer` 呼叫 `mdRender(code, { ..., pluginOptions: configData.mdPluginOptions })`。

### popup UI

插件頁籤：既有 chips Set 上方或下方加「插件子選項」區。本批兩項各一個可展開列（⚙ 圖示 or 標題 + 內嵌開關）：

- 連結辨識（Linkify）：三個 Switch。
- 警告框（Alert）：一個 Switch（巢狀）。
  子選項變更走既有 `updateConfig('mdPluginOptions', { ...data.mdPluginOptions, Linkify: {...} })`（整個物件回寫，popup 端維護 immutable 更新）。標示為 reload/重渲染類（沿用 `hint_reload` 或不標，因走重渲染非整頁 reload——若走重渲染則不需 hint）。

### 純函式（core 可測）

`src/core/plugin-options.ts`（node 可測）：

- `getDefaultPluginOptions(): Record<string, Record<string, unknown>>`（回傳上述預設）
- `mergePluginOptions(stored)`（缺項補預設、型別防禦）
- `resolveLinkify(opts)` → `{ fuzzyLink, fuzzyIP, fuzzyEmail }`（boolean 化）
- `resolveAlertDeep(opts)` → `boolean`

## 三、寬度 % 單位

### 資料模型

新增 flat key `customWidthUnit: 'px' | 'percent'`（預設 `'px'`），與既有 `customWidth: number | null` 並存（不破壞 flat 結構，備忘建議）。範圍比照商店版：px 500–3000（既有）、percent 20–100。

### 生效

`customWidthUnit` 為即時類（applySetting → 呼叫既有 `applyTypography()`）。`applyTypography` 目前 `--md-reader-content-width` 設 `${w}px`；改為依單位設 `${w}px` 或 `${w}%`（CSS `max-width: var(--md-reader-content-width, 900px)` 本身吃任意長度，選擇器不改）。`background.ts` actionMap 加 `customWidthUnit: 'applySetting'`。

### 純函式擴充（`src/core/settings.ts`）

- `clampCustomWidth` 擴為單位感知：`clampCustomWidthValue(v, unit): number | null`（percent → clamp 20–100 取整；px → 沿用 500–3000）。或新增 `clampCustomWidthPercent(v)`。保留既有 `clampCustomWidth`（px）向後相容，新增 percent 版本；`applyTypography` 依 unit 選用。
- `formatContentWidth(value: number | null, unit): string | null`（回 `'900px'`/`'50%'`/`null`）供 main.ts 與測試共用。

### popup UI

外觀頁「自訂寬度」控件：現有 number input 旁加單位切換（px/％ 二選，SMUI Select 或兩顆 radio）。切 percent 時 number input 範圍改 20–100、切 px 時 500–3000（失焦 clamp 用對應函式）。`updateConfig('customWidthUnit', unit)` 與 `updateConfig('customWidth', clampedValue)`。

## 資料模型總覽（`src/core/data.ts` 擴充）

| key               | 型別                                      | 預設                                                                           | 生效類 |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------------------ | ------ |
| `mdPluginOptions` | `Record<string, Record<string, unknown>>` | `{Linkify:{fuzzyLink:false,fuzzyIP:false,fuzzyEmail:true}, Alert:{deep:true}}` | 重渲染 |
| `customWidthUnit` | `'px'` 或 `'percent'`                     | `'px'`                                                                         | 即時   |

`pageTheme` 預設不變（v1.1.0 已為 `'auto'`）；`commands.ts` 內部預設同步為 `'auto'`。

## 生效機制對照（沿用 v1.1.0 applySetting 架構）

- `mdPluginOptions` → applySetting → 重渲染（`contentRender(mdRaw); renderSide()`，同 `updateMdPlugins`）。
- `customWidthUnit` → applySetting → `applyTypography()`（即時）。
- 兩者 background actionMap 各加一列 → `'applySetting'`。`git diff main -- src/background.ts` 應只見這兩列增列。

## 測試

1. 單元：
   - `tests/plugin-options.test.mjs`：getDefaultPluginOptions 結構、mergePluginOptions（缺項/壞型別/多餘 key）、resolveLinkify（boolean 化/預設）、resolveAlertDeep ≥ 8 條。
   - `tests/settings.test.mjs` 擴充：clampCustomWidthPercent（20/100 邊界、NaN、越界）、formatContentWidth（px/percent/null）≥ 6 條新增。
2. Playwright 驗收：
   - 四快捷鍵切換對應設定（含 toggleTheme 三態循環 auto→light→dark→auto）。
   - 插件子選項：Linkify fuzzyLink 開 → 裸網址自動連結；Alert deep 開/關 → 巢狀 alert 行為；popup 子選項寫入 mdPluginOptions。
   - 寬度 % 單位：popup 切 percent + 值 → content max-width 為 %；px ↔ percent 切換 clamp。
   - md 頁全功能迴歸（v1.1.0 設定不回歸）。
3. `tsc --noEmit`、build、zip。

## 非目標

- 字元集相容模式（v1.2.1 另案）。
- 插件子選項的其餘插件（TaskLists/TOC/Katex/Mermaid/MultimdTable/Obsidian showMetadata）——本批只做 Linkify + Alert 建立基礎架構，其餘增量。
- 新增快捷鍵（禪模式/切原始內容等）——使用者選「小幅強化」不含新增。
- 帳戶/Pro；巢狀 storage 重構。

## Git

commit 依模組切、四段訊息 + trailers；完成後合入 main 併發 v1.2.0。Subagent 一律 sonnet；markdown 表格 cell 禁裸 `|`。
