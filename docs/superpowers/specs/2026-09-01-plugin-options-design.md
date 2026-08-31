# 插件子選項（mdPluginOptions）設計文件

- 日期：2026-09-01
- 狀態：APPROVED（設計已與使用者對齊；實作另開 session，計畫文件屆時再寫）
- 基線：v1.1.0（案 B+F 已合入 main）
- 硬約束：**修改零風險、完全向後相容** —— 使用者不動任何子選項時，渲染行為
  bit-for-bit 等同 v1.1.0 現行行為
- 參考：商店版 3.6.28 拆解
  （`docs/research/2026-08-31-store-36-settings-menu-and-panel-teardown.md` §3.3、
  `docs/research/2026-08-31-store-crx-3628-local-unpack-notes.md` §4）

## 一、目標與範圍

對齊商店版「插件 ⚙ 子選項」功能：讓使用者微調各 markdown-it 插件的行為，
不再只有整顆開關。商店版 8 個有 ⚙ 的插件中，Lite 適用 **6 個**：

| 適用                                                            | 不適用與原因                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TaskLists、TOC、MultimdTable（表格擴展）、Linkify、Katex、Alert | Mermaid（Lite 主題已自動跟隨 pageTheme，商店版 raw JSON 直傳 `Mermaid.initialize` 風險高不移植）；FrontMatter（Lite 由 Obsidian 插件渲染 metadata 摺疊表格，語意已涵蓋） |

商店版的 Pro/freeOptions 分層機制不移植（Lite 全免費）。

## 二、儲存架構（零風險核心）

新增**單一** top-level storage key（沿用 Lite flat 慣例，值本身是 map）：

```ts
// src/core/data.ts
mdPluginOptions?: Partial<Record<string, Record<string, unknown>>>
// getDefaultData() 補：mdPluginOptions: {}
```

規則：

1. **只存使用者改過的欄位**（sparse diff）。預設值全部留在程式碼常數，
   不寫入 storage。
2. key 不存在、map 為空、或任一欄位缺席 → 一律採程式碼預設 → 行為等同現行。
3. 未來版本要改某預設值時，只改程式碼常數即可，不會被舊 storage 覆蓋
   （因為舊 storage 根本沒存那個欄位）。
4. popup 寫回時整包覆寫該 key（走既有 `updateConfig('mdPluginOptions', map)`
   單 key 機制，不做深層 patch）。

## 三、子選項清單與預設值

**預設值 = v1.1.0 現行硬編碼行為**，其中兩處與商店版預設不同（粗體），
屬零風險約束的刻意保留：

| 插件         | 子選項（型別）                                 | Lite 預設     | 商店版預設 | 說明                                                                              |
| ------------ | ---------------------------------------------- | ------------- | ---------- | --------------------------------------------------------------------------------- |
| TaskLists    | `enabled` (bool)                               | false         | false      | true 時 checkbox 可勾選互動                                                       |
| TaskLists    | `label` (bool)                                 | false         | false      | 文字包 `<label>` 可點擊                                                           |
| TOC          | `includeLevel` (number 1–6，UI 為「最大層級」) | 2（即 [1,2]） | 2          | 存為深度 N，resolve 成陣列 [1..N]                                                 |
| TOC          | `listType` ('ul' 或 'ol')                      | 'ul'          | 'ul'       |                                                                                   |
| MultimdTable | `multiline` (bool)                             | false         | false      | 反斜線續行合併儲存格                                                              |
| MultimdTable | `rowspan` (bool)                               | false         | false      | `^^` 合併上下列                                                                   |
| MultimdTable | `headerless` (bool)                            | false         | false      | 允許無表頭表格                                                                    |
| MultimdTable | `multibody` (bool)                             | false         | false      | 空行分段 tbody                                                                    |
| MultimdTable | `autolabel` (bool)                             | false         | false      | caption 自動 label                                                                |
| Linkify      | `fuzzyLink` (bool)                             | **true**      | false      | 無協定網址自動連結；現行是 linkify-it 套件預設 true，零風險故保留                 |
| Linkify      | `fuzzyIP` (bool)                               | false         | false      | 純 IP 轉連結                                                                      |
| Linkify      | `fuzzyEmail` (bool)                            | true          | true       | 現行 `md.linkify.set({fuzzyEmail:true})`                                          |
| Katex        | `throwOnError` (bool)                          | false         | false      | 語法錯誤時 throw（顯示錯誤原文）                                                  |
| Katex        | `errorColor` (string，#rrggbb)                 | '#cc0000'     | '#cc0000'  | 錯誤顯示色                                                                        |
| Alert        | `deep` (bool)                                  | **true**      | false      | blockquote 巢狀內也解析 alert；現行 `alert.ts` 硬編碼 `{deep:true}`，零風險故保留 |
| Alert        | `infoContainer` (bool)                         | true          | true       | 註冊 `::: info` 與 `::: note`                                                     |
| Alert        | `tipContainer` (bool)                          | true          | true       | 註冊 `::: tip` 與 `::: tips`                                                      |
| Alert        | `successContainer` (bool)                      | true          | true       | 註冊 `::: success`                                                                |
| Alert        | `warningContainer` (bool)                      | true          | true       | 註冊 `::: warning`                                                                |
| Alert        | `dangerContainer` (bool)                       | true          | true       | 註冊 `::: danger`                                                                 |

不暴露的商店版選項與原因：TOC `containerClass`/`markerPattern`/`omitTag`
（改壞會讓 [[TOC]] 失效，冷門）；Katex `enableBareBlocks` 等四項
（屬 vscode 系整合的選項，`@traptitech/markdown-it-katex` 不支援，只透傳
katex 本體 options）；Alert `alertNames`（改壞會讓五種 GitHub alert 全失效）；
TaskLists `labelAfter`（依賴 label，UI 徒增複雜度）。

## 四、core 純函式模組

新檔 `src/core/plugin-options.ts`（零 chrome 依賴，`#core/plugin-options`
subpath 供 node 測試，比照 `settings.ts`）：

```ts
export const PLUGIN_OPTION_DEFAULTS = {
  TaskLists: { enabled: false, label: false },
  TOC: { maxLevel: 2, listType: 'ul' },
  MultimdTable: {
    multiline: false,
    rowspan: false,
    headerless: false,
    multibody: false,
    autolabel: false,
  },
  Linkify: { fuzzyLink: true, fuzzyIP: false, fuzzyEmail: true },
  Katex: { throwOnError: false, errorColor: '#cc0000' },
  Alert: {
    deep: true,
    infoContainer: true,
    tipContainer: true,
    successContainer: true,
    warningContainer: true,
    dangerContainer: true,
  },
} as const

// sparse user map + 消毒 → 完整 options。任何壞值（型別不符、超界、
// 非法色碼、非 ul/ol）一律靜默 fallback 該欄位預設，絕不 throw。
export function resolvePluginOptions(
  userOptions: unknown,
): Resolved /* 六插件完整物件 */

// 深度 N → includeLevel 陣列 [1..N]（N clamp 至 1–6，非數字回 [1,2]）
export function tocIncludeLevel(maxLevel: unknown): number[]
```

消毒規則：boolean 欄位用 `=== true / === false` 嚴格判定否則取預設；
`errorColor` 須符合 `/^#[0-9a-f]{6}$/i` 否則取預設；`listType` 僅接受
`'ul' | 'ol'`；未知插件名與未知欄位直接忽略。此層保證 storage 被手動改壞
也不影響渲染（風險約束 2）。

## 五、渲染佈線（`src/core/markdown.ts` + `src/plugins/alert.ts`）

1. `initRender(options)` 增讀 `options.pluginOptions`（raw user map），開頭
   `const po = resolvePluginOptions(options.pluginOptions)`。
2. `PLUGINS` 表中四個插件改為帶 options：
   - `TaskLists: [mTaskLists, po.TaskLists]`
   - `TOC: [mToc, { includeLevel: tocIncludeLevel(po.TOC.maxLevel), listType: po.TOC.listType }]`
   - `Katex: [mKatex, po.Katex]`
   - 常駐內建 `md.use(mMultimdTable)` → `md.use(mMultimdTable, po.MultimdTable)`
3. Linkify：現行 `md.linkify.set({ fuzzyEmail: true })` 改為
   `md.linkify.set(po.Linkify)`（三欄位齊傳；預設值下行為與現行相同，
   因 fuzzyLink 預設本來就是 true、fuzzyIP 本來就是 false）。
4. `alert.ts`：`AlertPlugin` 改為工廠 `AlertPlugin(opts)`——`deep` 傳給
   `@mdit/plugin-alert`；五個 `xxxContainer` 開關決定對應
   `markdown-it-container` 別名是否註冊（`info→[note,info]`、
   `tip→[tips,tip]`、`success`、`warning`、`danger`，對齊現行註冊表）。
   `PLUGINS.Alert` 改函式形態（比照 `Mermaid`）吃 resolved options。
5. `main.ts` 的 `mdRenderer` 呼叫加傳
   `pluginOptions: configData.mdPluginOptions`。

## 六、生效機制（沿用案 B+F 佈線）

- `src/background.ts` `actionMap` 增一列：`mdPluginOptions: 'applySetting'`
  （維持「background 僅 actionMap 增列」的邊界約束）。
- `src/main.ts` `applySetting` 增 case `mdPluginOptions`：呼叫與
  `updateMdPlugins` 相同的原地重渲染路徑（有 `mdRaw` 就
  `contentRender(mdRaw) + renderSide()`，否則 `window.location.reload()`）。
  即時生效，popup 不需「將重新整理」標示。

## 七、popup UI（`src/popup/components/tab-plugins.svelte`）

**既有 chips 區與總開關一行都不動**（風險約束 3）。下方新增「插件設定」區：

```text
插件: [Emoji] [Sup] [TaskLists✓] [TOC✓] ...   ← 現狀不動

── 插件設定 ─────────────────
▸ 任務列表
▾ 目錄 TOC
    最大層級: [2 ▼]（1–6）
    列表型式: (●) ul  ( ) ol
▸ 表格擴展
▸ 自動辨識連結
▸ 數學公式
▸ 警告框
```

- 只列**已啟用**（在 `data.mdPlugins` 中）且有子選項的插件；MultimdTable
  為常駐內建，恆列出。
- 每插件一個原生 `<details>` accordion（不引新 SMUI 元件，收合狀態不持久化）。
- 控件全用原生 input：checkbox（boolean）、`<select>`（maxLevel、listType）、
  `<input type="color">`（errorColor）。
- 變更即寫回：以「目前完整 UI 值 − 預設值」算出 sparse diff，
  `updateConfig('mdPluginOptions', diff)` 整包覆寫。
- 區塊尾附「重置插件設定」小按鈕：`updateConfig('mdPluginOptions', {})`
  （一鍵回到零風險基線）。
- i18n 新 key（en/zh-CN/zh-TW 三語系，`src/config/i18n/locale.json`）：
  `label_plugin-options`、`label_po-reset`，及每欄位 label
  （`po_tasklists-enabled`、`po_toc-max-level` … 命名以 `po_` 前綴）。

## 八、零風險保證清單（驗收時逐條核）

1. storage 無 `mdPluginOptions`（或為 `{}`）時，六插件渲染輸出與 v1.1.0
   完全一致（含 fuzzyLink=true、Alert deep=true 兩處與商店版不同的現狀）。
2. `resolvePluginOptions` 對任意壞輸入（null、字串、超界數字、非法色碼、
   未知欄位）不 throw，逐欄 fallback 預設。
3. `tab-plugins.svelte` 既有 chips/總開關 DOM 與行為零變更。
4. `getDefaultData()` 補 `mdPluginOptions: {}`；恢復預設按鈕
   （`storage.clear + set(getDefaultData())`）自然涵蓋本功能。
5. `background.ts` diff 僅 actionMap 一列；manifest 零變更、零新權限、
   零新依賴。
6. 既有 79 條測試不回歸。

## 九、測試與驗收

- 單元：`tests/plugin-options.test.mjs`（`#core/plugin-options`）——
  空輸入回預設、sparse merge、每種壞值消毒、`tocIncludeLevel` 邊界
  （0→clamp 1、7→clamp 6、'abc'→[1,2]）、Alert container 開關組合。
  預估 15+ test block。
- 手動/Playwright（實作 session 決定形式）：
  - TaskLists enabled 開 → 渲染頁 checkbox 可點擊。
  - TOC maxLevel 2→4 → `[[TOC]]` 出現 h3/h4 項。
  - MultimdTable multiline 開 → 反斜線續行表格正確合併。
  - Linkify fuzzyLink 關 → 裸網址 `example.com` 不再轉連結（驗證預設
    路徑相反方向也通）。
  - Katex errorColor 改色 → 錯誤公式顯示新色。
  - Alert deep 關 → 巢狀 blockquote 內 `[!NOTE]` 不再解析。
  - 每項變更即時生效（不 reload）；恢復預設/重置插件設定回基線。

## 十、明確不做（YAGNI）

- Mermaid raw JSON 設定、FrontMatter showMetadata（見 §一）。
- 商店版 Pro/freeOptions 分層。
- TOC `containerClass`/`markerPattern`/`omitTag`、Alert `alertNames`、
  TaskLists `labelAfter`、Katex vscode 系四選項（見 §三）。
- Obsidian/Graphviz 等 Lite 自有插件的子選項（另案再議）。
- 子選項的匯入/匯出。
