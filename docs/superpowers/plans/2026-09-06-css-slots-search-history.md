# CSS Slots + Search History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four-way CSS selection with two readonly built-in presets and two editable user slots, plus persistent sidebar search history with configurable limit, clear action, suggestions, keyboard selection, and Tab completion.

**Architecture:** Keep settings as flat `chrome.storage.local` keys, matching the existing popup and background message flow. Put pure history normalization and matching logic in `src/core/settings.ts` for unit tests; keep popup CSS slot editing in `tab-appearance.svelte`; keep in-page search suggestions inside `search-panel.ts`, with storage writes routed through the existing background `storage` action. No new network request, manifest permission, host permission, or offline-mode exception is allowed.

**Tech Stack:** Chrome MV3, TypeScript, Svelte 3 + SMUI popup, LESS content styles, `Ele` DOM helper, `node --test` unit tests, Playwright e2e tests.

**Spec:** Bounded in-chat design approved from the 2026-09-06 thread. Project constraints come from `docs/developer_guide.md`, `docs/ARCHITECTURE.md`, `docs/superpowers/specs/2026-08-31-settings-panel-and-diagram-viewer-design.md`, `docs/superpowers/specs/2026-08-30-sidebar-search-design.md`, and `docs/superpowers/specs/2026-08-30-search-parity-design.md`.

**Status:** Completed on 2026-09-06 on `main`.

**Implementation commits:** `0ceaae4`, `fd4d7fc`, `f6ee91b`, `aaa5b95`, `9b89617`.

## Global Constraints

- Follow `docs/developer_guide.md`: pure logic goes in `tests/unit/`; popup and in-page UI behavior goes in `tests/e2e/`.
- Do not add network behavior. Do not modify `offlineMode`, PlantUML gating, folder-tree network gating, or `src/manifest.json` permissions.
- Do not overwrite existing dirty work. Current dirty files include path-modal work in `src/config/class-name.ts`, `src/config/i18n/locale.json`, `src/core/settings.ts`, `src/main.ts`, `src/style/index.less`, `tests/e2e/extension.e2e.mjs`, and `tests/unit/settings.test.mjs`.
- Keep storage flat. New keys must live at top level in `Data` and `getDefaultData()`.
- CSS built-in presets are selectable and readable, but not editable.
- User CSS slots are editable. Applying a user slot updates both the slot value and the effective `customCss`.
- Search history is local-only, deduped, newest first, trimmed, and bounded by `searchHistoryLimit`.
- `searchHistoryLimit` default is `10`; `0` disables suggestions and recording; maximum is `100`.
- Commit after each independently testable segment. Commit bodies must use `Why / What / How / Boundary`.

---

## Files

- Modify: `src/core/data.ts`
  Add flat keys for CSS slot state and search history state.
- Modify: `src/core/settings.ts`
  Add pure helpers for CSS slot migration and search history normalization, recording, and matching.
- Modify: `src/config/custom-css-presets.ts`
  Add typed preset metadata so built-ins can be treated as readonly choices.
- Modify: `src/popup/components/tab-appearance.svelte`
  Replace the current preset-fill behavior with four choices: two readonly presets, User 1, User 2.
- Modify: `src/popup/components/tab-general.svelte`
  Add search history limit and clear-history controls.
- Modify: `src/core/search-panel.ts`
  Add suggestion menu, keyboard selection, Tab completion, click selection, and history recording.
- Modify: `src/config/class-name.ts`
  Add class names for search suggestions.
- Modify: `src/style/index.less`
  Add in-page suggestion menu styling.
- Modify: `src/popup/index.css`
  Add readonly textarea and clear-history button styling if needed.
- Modify: `src/config/i18n/locale.json`
  Add labels and hints for CSS slot choices and search history controls.
- Modify: `tests/unit/settings.test.mjs`
  Add permanent unit coverage for helper behavior.
- Modify: `tests/e2e/extension.e2e.mjs`
  Add permanent e2e coverage for popup CSS slots, search history settings, and in-page search suggestions.
- Modify: `docs/plans.md`
  Register this plan.

---

## Task 1: Search History Pure Model

**Files:**

- Modify: `src/core/data.ts`
- Modify: `src/core/settings.ts`
- Test: `tests/unit/settings.test.mjs`

**Interfaces:**

- Produces: `SEARCH_HISTORY_LIMIT_DEFAULT = 10`
- Produces: `SEARCH_HISTORY_LIMIT_MAX = 100`
- Produces: `clampSearchHistoryLimit(v: unknown): number`
- Produces: `normalizeSearchHistory(v: unknown, limit: number): string[]`
- Produces: `recordSearchHistory(history: unknown, query: unknown, limit: unknown): string[]`
- Produces: `matchSearchHistory(history: unknown, query: unknown, limit: unknown): string[]`
- Produces: `Data.searchHistory?: string[]`
- Produces: `Data.searchHistoryLimit?: number`

- [ ] **Step 1: Write failing unit tests**

Add these tests to `tests/unit/settings.test.mjs`:

```js
test('clampSearchHistoryLimit: default, boundaries, and max', async () => {
  const { clampSearchHistoryLimit } = await load()
  assert.equal(clampSearchHistoryLimit(undefined), 10)
  assert.equal(clampSearchHistoryLimit('abc'), 10)
  assert.equal(clampSearchHistoryLimit(-1), 0)
  assert.equal(clampSearchHistoryLimit(0), 0)
  assert.equal(clampSearchHistoryLimit(10), 10)
  assert.equal(clampSearchHistoryLimit(999), 100)
})

test('recordSearchHistory: trims, dedupes, newest first, and respects limit', async () => {
  const { recordSearchHistory } = await load()
  assert.deepEqual(recordSearchHistory(['alpha', 'beta'], ' beta ', 10), [
    'beta',
    'alpha',
  ])
  assert.deepEqual(recordSearchHistory(['alpha', 'beta'], 'gamma', 2), [
    'gamma',
    'alpha',
  ])
  assert.deepEqual(recordSearchHistory(['alpha'], '   ', 10), ['alpha'])
  assert.deepEqual(recordSearchHistory(['alpha'], 'beta', 0), [])
})

test('matchSearchHistory: case-insensitive suggestions respect query and limit', async () => {
  const { matchSearchHistory } = await load()
  assert.deepEqual(
    matchSearchHistory(['Open Path', 'Find Heading', 'copy path'], 'path', 10),
    ['Open Path', 'copy path'],
  )
  assert.deepEqual(matchSearchHistory(['alpha', 'beta'], '', 10), [])
  assert.deepEqual(matchSearchHistory(['alpha', 'beta'], 'a', 1), ['alpha'])
  assert.deepEqual(matchSearchHistory(['alpha'], 'a', 0), [])
})
```

- [ ] **Step 2: Verify tests fail for the right reason**

Run:

```bash
node --test tests/unit/settings.test.mjs
```

Expected: FAIL because `clampSearchHistoryLimit`, `recordSearchHistory`, or `matchSearchHistory` is not exported.

- [ ] **Step 3: Implement the pure helpers**

Add to `src/core/settings.ts`:

```ts
export const SEARCH_HISTORY_LIMIT_DEFAULT = 10
export const SEARCH_HISTORY_LIMIT_MAX = 100

export function clampSearchHistoryLimit(v: unknown): number {
  if (v === undefined || v === null || v === '')
    return SEARCH_HISTORY_LIMIT_DEFAULT
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!isFinite(n)) return SEARCH_HISTORY_LIMIT_DEFAULT
  return Math.round(Math.min(SEARCH_HISTORY_LIMIT_MAX, Math.max(0, n)))
}

export function normalizeSearchHistory(v: unknown, limit: number): string[] {
  const max = clampSearchHistoryLimit(limit)
  if (!max || !Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of v) {
    const text = String(item ?? '').trim()
    const key = text.toLowerCase()
    if (!text || seen.has(key)) continue
    seen.add(key)
    out.push(text)
    if (out.length >= max) break
  }
  return out
}

export function recordSearchHistory(
  history: unknown,
  query: unknown,
  limit: unknown,
): string[] {
  const max = clampSearchHistoryLimit(limit)
  if (!max) return []
  const text = String(query ?? '').trim()
  const base = normalizeSearchHistory(history, max)
  if (!text) return base
  return normalizeSearchHistory([text, ...base], max)
}

export function matchSearchHistory(
  history: unknown,
  query: unknown,
  limit: unknown,
): string[] {
  const max = clampSearchHistoryLimit(limit)
  if (!max) return []
  const q = String(query ?? '')
    .trim()
    .toLowerCase()
  if (!q) return []
  return normalizeSearchHistory(history, max).filter(item =>
    item.toLowerCase().includes(q),
  )
}
```

Add to `src/core/data.ts`:

```ts
searchHistory?: string[]
searchHistoryLimit?: number
```

and defaults:

```ts
searchHistory: [],
searchHistoryLimit: 10,
```

- [ ] **Step 4: Verify unit tests pass**

Run:

```bash
node --test tests/unit/settings.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/data.ts src/core/settings.ts tests/unit/settings.test.mjs
git commit -m "feat: add bounded local search history model"
```

Commit body:

```text
Why: 側欄搜尋需要可持久化、可限制筆數、可清除的歷史資料，且必須維持本機儲存與零網路特性。

What: 新增 searchHistory/searchHistoryLimit flat storage keys，並加入 clamp、normalize、record、match 四個純函式。

How: 用 node --test 覆蓋 trim、dedupe、大小寫不敏感比對、limit 0 停用與 100 筆上限。

Boundary: 只新增資料模型與純函式，尚未接 UI，也未修改 manifest、權限或任何網路行為。
```

---

## Task 2: CSS Slot Pure Model

**Files:**

- Modify: `src/core/data.ts`
- Modify: `src/core/settings.ts`
- Modify: `src/config/custom-css-presets.ts`
- Test: `tests/unit/settings.test.mjs`

**Interfaces:**

- Produces: `type CustomCssChoice = 'editorial' | 'developer' | 'user1' | 'user2'`
- Produces: `Data.customCssChoice?: CustomCssChoice`
- Produces: `Data.customCssUser1?: string`
- Produces: `Data.customCssUser2?: string`
- Produces: `resolveCustomCssChoice(data: Pick<Data, ...>): { choice: CustomCssChoice; draft: string; readonly: boolean }`

- [ ] **Step 1: Write failing unit tests**

Add tests:

```js
test('resolveCustomCssChoice: built-in choices are readonly', async () => {
  const { resolveCustomCssChoice } = await load()
  const editorial = resolveCustomCssChoice({
    customCssChoice: 'editorial',
    customCss: 'legacy',
    customCssUser1: '',
    customCssUser2: '',
  })
  assert.equal(editorial.choice, 'editorial')
  assert.equal(editorial.readonly, true)
  assert.match(editorial.draft, /Little Might|編輯風格/)
})

test('resolveCustomCssChoice: user choices are editable and preserve slot text', async () => {
  const { resolveCustomCssChoice } = await load()
  assert.deepEqual(
    resolveCustomCssChoice({
      customCssChoice: 'user2',
      customCss: '',
      customCssUser1: 'one',
      customCssUser2: 'two',
    }),
    { choice: 'user2', draft: 'two', readonly: false },
  )
})

test('resolveCustomCssChoice: legacy customCss migrates to user1 display', async () => {
  const { resolveCustomCssChoice } = await load()
  assert.deepEqual(
    resolveCustomCssChoice({
      customCssChoice: undefined,
      customCss: '.x { color: red }',
      customCssUser1: '',
      customCssUser2: '',
    }),
    { choice: 'user1', draft: '.x { color: red }', readonly: false },
  )
})
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
node --test tests/unit/settings.test.mjs
```

Expected: FAIL because `resolveCustomCssChoice` is not exported.

- [ ] **Step 3: Implement helper and data defaults**

Move only minimal CSS-choice logic into `src/core/settings.ts`, importing preset CSS from `src/config/custom-css-presets.ts` if that import works under Node subpath imports. If alias import fails under `node --test`, keep the test mirror narrow and document it in the test file using the repo's existing mirror-test convention.

`src/core/data.ts`:

```ts
customCssChoice?: 'editorial' | 'developer' | 'user1' | 'user2'
customCssUser1?: string
customCssUser2?: string
```

defaults:

```ts
customCssChoice: 'user1',
customCssUser1: '',
customCssUser2: '',
```

- [ ] **Step 4: Verify unit tests pass**

Run:

```bash
node --test tests/unit/settings.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/data.ts src/core/settings.ts src/config/custom-css-presets.ts tests/unit/settings.test.mjs
git commit -m "feat: add custom CSS slot model"
```

Commit body:

```text
Why: CSS 設定需要明確區分 readonly built-in preset 與可編輯 user slots，避免使用者以為預設內容可直接修改。

What: 新增 customCssChoice、customCssUser1、customCssUser2，並提供 resolve helper 處理 readonly 狀態與 legacy customCss 顯示。

How: 單元測試鎖住 built-in readonly、user slot editable、舊 customCss 自動落到 User 1。

Boundary: 尚未改 popup UI；effective customCss 注入仍沿用既有機制。
```

---

## Task 3: Popup CSS Four-Way Editor

**Files:**

- Modify: `src/popup/components/tab-appearance.svelte`
- Modify: `src/popup/index.css`
- Modify: `src/config/i18n/locale.json`
- Test: `tests/e2e/extension.e2e.mjs`

**Interfaces:**

- Consumes: `customCssChoice`, `customCssUser1`, `customCssUser2`, `customCss`
- Produces: popup behavior where built-ins are readonly and user slots are editable

- [ ] **Step 1: Write failing e2e tests**

Add e2e tests that open the settings overlay, switch to Appearance, and assert:

```js
assert.equal(
  textarea.readOnly,
  true,
  'built-in preset textarea should be readonly',
)
assert.equal(
  applyDisabled,
  true,
  'built-in preset should not be directly applied from the editor',
)
```

Then select User 2, fill textarea, click Apply, and assert:

```js
assert.equal((await getStorage('customCssUser2')).customCssUser2, css)
assert.equal((await getStorage('customCss')).customCss, css)
assert.equal((await getStorage('customCssChoice')).customCssChoice, 'user2')
```

- [ ] **Step 2: Verify e2e test fails**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: FAIL on readonly or user slot storage assertion because UI is not implemented.

- [ ] **Step 3: Implement the popup UI**

In `tab-appearance.svelte`, replace the current `cssPresetId` behavior with a selected choice driven by `data.customCssChoice`. On choice change:

- `editorial` or `developer`: set draft to preset CSS, set readonly true, do not write `customCss`.
- `user1`: set draft to `data.customCssUser1 || data.customCss || ''`.
- `user2`: set draft to `data.customCssUser2 || ''`.

On Apply for user slots:

```ts
if (data.customCssChoice === 'user1') {
  data.customCssUser1 = customCssDraft
  updateConfig('customCssUser1', data.customCssUser1)
} else if (data.customCssChoice === 'user2') {
  data.customCssUser2 = customCssDraft
  updateConfig('customCssUser2', data.customCssUser2)
}
data.customCss = customCssDraft
updateConfig('customCss', data.customCss)
updateConfig('customCssChoice', data.customCssChoice)
```

Add i18n keys:

```json
"custom-css-choice_editorial": "Editorial (readonly)",
"custom-css-choice_developer": "Developer (readonly)",
"custom-css-choice_user1": "User 1",
"custom-css-choice_user2": "User 2",
"hint_custom-css-readonly": "Built-in CSS presets are readonly. Select User 1 or User 2 to edit your own CSS."
```

- [ ] **Step 4: Verify e2e passes**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: CSS slot tests pass, existing e2e remains green or skips only if Playwright/Chromium is unavailable.

- [ ] **Step 5: Commit**

```bash
git add src/popup/components/tab-appearance.svelte src/popup/index.css src/config/i18n/locale.json tests/e2e/extension.e2e.mjs
git commit -m "feat: add readonly CSS presets and editable user CSS slots"
```

Commit body:

```text
Why: 使用者需要在兩個 built-in CSS 與兩個個人 CSS slot 間切換，且 built-in 只能讀取與選用，不能被直接修改。

What: Appearance 頁籤改成四選一 CSS editor，built-in textarea readonly，User 1/User 2 可編輯並同步 effective customCss。

How: Playwright e2e 驗證 readonly 狀態、User 2 儲存、自訂 CSS 注入仍走既有 customCss 生效路徑。

Boundary: 不新增 CSS parser、不驗證 CSS 語法、不改 customCss 的 `<style>` 注入策略。
```

---

## Task 4: Search History Settings UI

**Files:**

- Modify: `src/popup/components/tab-general.svelte`
- Modify: `src/popup/index.css`
- Modify: `src/config/i18n/locale.json`
- Test: `tests/e2e/extension.e2e.mjs`

**Interfaces:**

- Consumes: `searchHistory`, `searchHistoryLimit`, `clampSearchHistoryLimit`
- Produces: General tab controls for max history count and clearing history

- [ ] **Step 1: Write failing e2e test**

Add a test that opens Settings, stays on General tab, changes search history limit to `3`, clicks clear, and asserts:

```js
assert.equal((await getStorage('searchHistoryLimit')).searchHistoryLimit, 3)
assert.deepEqual((await getStorage('searchHistory')).searchHistory, [])
```

- [ ] **Step 2: Verify e2e test fails**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: FAIL because controls do not exist.

- [ ] **Step 3: Implement General tab controls**

Add to `tab-general.svelte`:

```ts
function onSearchHistoryLimitBlur() {
  data.searchHistoryLimit = clampSearchHistoryLimit(data.searchHistoryLimit)
  updateConfig('searchHistoryLimit', data.searchHistoryLimit)
}

function clearSearchHistory() {
  data.searchHistory = []
  updateConfig('searchHistory', [])
}
```

Add UI near other local settings:

```svelte
<div class="form-item inline">
  <span class="label-item">{localize('label_search-history-limit')}:</span>
  <input
    type="number"
    min="0"
    max="100"
    step="1"
    disabled={!data.enable}
    bind:value={data.searchHistoryLimit}
    on:blur={onSearchHistoryLimitBlur}
  />
</div>
<div class="hint-item">{localize('hint_search-history-limit')}</div>
<div class="form-item">
  <button
    type="button"
    class="btn-reset"
    disabled={!data.enable}
    on:click={clearSearchHistory}
  >
    {localize('label_search-history-clear')}
  </button>
</div>
```

- [ ] **Step 4: Verify e2e passes**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: new search-history settings test passes.

- [ ] **Step 5: Commit**

```bash
git add src/popup/components/tab-general.svelte src/popup/index.css src/config/i18n/locale.json tests/e2e/extension.e2e.mjs
git commit -m "feat: add search history settings controls"
```

Commit body:

```text
Why: 搜尋歷史需要使用者可控制最大筆數，也需要清除入口，才能避免本機 storage 無限制累積。

What: General 頁籤新增搜尋歷史最大筆數與清除歷史按鈕。

How: Playwright e2e 驗證 limit 寫入 storage，清除按鈕會把 searchHistory 清成空陣列。

Boundary: 此段只處理 popup 設定，不接 in-page suggestion menu。
```

---

## Task 5: In-Page Search Suggestions

**Files:**

- Modify: `src/core/search-panel.ts`
- Modify: `src/config/class-name.ts`
- Modify: `src/style/index.less`
- Test: `tests/e2e/extension.e2e.mjs`

**Interfaces:**

- Consumes: `matchSearchHistory`, `recordSearchHistory`
- Consumes: `configData.searchHistory`, `configData.searchHistoryLimit`
- Produces: suggestion menu under `.md-reader__search-input`

- [ ] **Step 1: Write failing e2e test**

Create a test that seeds storage:

```js
await setStorage({
  searchHistory: ['Architecture', 'Folder tree', 'PlantUML'],
  searchHistoryLimit: 10,
})
```

Then open in-page search and assert:

```js
await page.fill('.md-reader__search-input', 'pla')
await page.keyboard.press('ArrowDown')
await page.keyboard.press('Tab')
const value = await page.inputValue('.md-reader__search-input')
assert.equal(value, 'PlantUML')
```

Also assert click selection:

```js
await page.fill('.md-reader__search-input', 'tree')
await page.click('.md-reader__search-suggestion')
assert.equal(await page.inputValue('.md-reader__search-input'), 'Folder tree')
```

- [ ] **Step 2: Verify e2e test fails**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: FAIL because `.md-reader__search-suggestion` does not exist.

- [ ] **Step 3: Update search-panel options**

Extend `Options` in `src/core/search-panel.ts`:

```ts
getSearchHistory: () => string[]
getSearchHistoryLimit: () => number
onSearchHistoryChange: (history: string[]) => void
```

In `src/main.ts`, pass:

```ts
getSearchHistory: () => configData.searchHistory || [],
getSearchHistoryLimit: () => configData.searchHistoryLimit ?? 10,
onSearchHistoryChange: history => {
  configData.searchHistory = history
  chrome.runtime.sendMessage({
    action: 'storage',
    data: { key: 'searchHistory', value: history },
  })
},
```

- [ ] **Step 4: Implement suggestions and keyboard behavior**

In `search-panel.ts`:

- Create a suggestion container inside `bar`, after input.
- On `input`, update suggestions immediately and still debounce existing search/filter routing.
- On `ArrowDown` and `ArrowUp`, move active suggestion.
- On `Tab`, prevent default when a suggestion exists and set input to active suggestion or first suggestion.
- On `Enter`, record the current non-empty query.
- On suggestion click, set input value, route immediately, record selected value, and hide suggestions.
- On `Escape` or close, hide suggestions.

- [ ] **Step 5: Add styles**

Add class names:

```ts
SEARCH_SUGGESTIONS: p`search-suggestions`,
SEARCH_SUGGESTION: p`search-suggestion`,
SEARCH_SUGGESTION_ACTIVE: p`search-suggestion--active`,
```

Add LESS near the search bar styles:

```less
.md-reader__search-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 28px;
  z-index: 4;
  max-height: 180px;
  overflow: auto;
  background: #fff;
  border: 1px solid #24315824;
  border-radius: 4px;
  box-shadow: 0 8px 20px rgba(36, 49, 88, 0.16);
}

.md-reader__search-suggestion {
  width: 100%;
  padding: 6px 8px;
  text-align: left;
  font: inherit;
  color: #243158;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.md-reader__search-suggestion:hover,
.md-reader__search-suggestion--active {
  background: #607cd211;
}
```

Ensure `.md-reader__search-bar` has `position: relative`.

- [ ] **Step 6: Verify e2e passes**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: search suggestion tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/search-panel.ts src/main.ts src/config/class-name.ts src/style/index.less tests/e2e/extension.e2e.mjs
git commit -m "feat: add sidebar search history suggestions"
```

Commit body:

```text
Why: 使用者希望搜尋輸入能像常見 app 一樣即時比對歷史，並支援鍵盤選取與 Tab 補完。

What: 側欄搜尋列新增歷史 suggestion menu，支援 ArrowUp/ArrowDown、Tab、Enter 與滑鼠點選，並把歷史寫回本機 storage。

How: Playwright e2e seed storage 後驗證即時建議、Tab 補完、點選套用與既有搜尋仍會執行。

Boundary: 不做跨文件全文索引、不預抓檔案樹、不新增模糊搜尋函式庫。
```

---

## Task 6: Permanent TestPlan and Full Regression

**Files:**

- Modify: `docs/superpowers/plans/2026-09-06-css-slots-search-history.md`
- Modify: `docs/plans.md`
- Test: all relevant test suites

**Interfaces:**

- Produces: permanent test plan in this file
- Produces: regression evidence in the final delivery message

- [ ] **Step 1: Run permanent unit test suite**

Run:

```bash
npm run test:unit
```

Expected: all unit tests pass. This suite is CI-covered by the release workflow.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 3: Build extension**

Run:

```bash
npm run build
```

Expected: `extension/` is rebuilt and zip generation succeeds.

- [ ] **Step 4: Run e2e suite**

Run:

```bash
npm run test:e2e
```

Expected: all e2e tests pass, or the whole suite skips only when the harness reports browser/Playwright unavailable.

- [ ] **Step 5: Verify no permission or network surface changed**

Run:

```bash
node --test tests/unit/manifest.test.mjs
git diff -- src/manifest.json
```

Expected: manifest test passes; `src/manifest.json` has no diff for permissions or host permissions.

- [ ] **Step 6: Commit documentation/testplan index**

```bash
git add docs/superpowers/plans/2026-09-06-css-slots-search-history.md docs/plans.md
git commit -m "docs: add permanent test plan for CSS slots and search history"
```

Commit body:

```text
Why: 這次功能包含 popup 設定與頁內搜尋互動，測試計畫需要留在 repo 內，讓之後發版與回歸能永久重跑。

What: 新增 CSS slots + search history implementation plan，記錄 unit/e2e/regression 指令與每段 commit 邊界。

How: 對齊 docs/developer_guide.md 的測試分層：純函式走 node --test，popup/側欄互動走 Playwright e2e。

Boundary: 文件與索引，不修改 runtime behavior。
```

---

## Permanent TestPlan

### Automated Coverage

- `tests/unit/settings.test.mjs` covers history limit defaults and bounds, normalization, dedupe, newest-first recording, case-insensitive matching, `0` disabling history, readonly built-in CSS choices, editable user slots, and legacy `customCss` migration.
- `tests/e2e/extension.e2e.mjs` covers readonly built-in CSS, User 2 persistence and effective CSS application, the Developer preset's table and callout rules, rounded rendered table/callout surfaces, native desktop table layout with a full-width header, disabling CSS customization without losing drafts, deliberate re-apply after re-enabling, history-limit persistence, history clearing, matching search-input and history-suggestion typography, ArrowUp/ArrowDown selection, Tab completion, click selection, Enter recording, and clearing history from popup while the content page is already open.
- `tests/unit/manifest.test.mjs` guards match-pattern validity and the zero-permission policy. This feature must not add host permissions or network behavior.

### Repeatable Commands

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
node --test tests/unit/manifest.test.mjs
```

`npm run test:unit` is the CI-compatible gate. Run `npm run build` before `npm run test:e2e`, because e2e loads the built `extension/` directory into headed Chromium. Browser unavailability may skip e2e; a passing release requires real browser execution, not a skip.

### Manual Acceptance

1. Open Settings > Appearance. Toggle CSS Customization off and confirm page styles are removed while all slot content remains. Toggle it back on and confirm CSS is not restored until Apply. Verify Editorial and Developer stay readonly but can be applied, and User 1/User 2 can be edited and applied independently. With Developer selected, inspect a Markdown table, callout, frontmatter details, headings, and code block: table columns fill the desktop surface, small screens can scroll wide tables, and framed elements use the warm, rounded visual language.
2. Open Settings > General. Change Search History Limit, reload the page, and confirm the setting persists. Set it to `0` and confirm no history candidate appears. Clear history and confirm candidates disappear without reloading the markdown page.
3. Open sidebar search, type a stored partial query, and verify candidates use the same font and size as the input. Use ArrowUp/ArrowDown then Tab, click a candidate, and press Enter on a new query. Reopen search and confirm the new query is first in history.

## Regression Plan

- Search: outline mode still returns heading/content hits and clears highlights on Escape.
- Files tab search: still filters only the file tree and does not create document highlights.
- Popup: settings overlay still opens inside the page when not sandboxed, switches remain clickable, outside click dismisses it, CSS customization stays disabled until Apply, and search-history updates are delivered to an already-open content page.
- Existing path modal dirty work: keep the current `Show Path` menu item, modal, copy feedback, and e2e coverage intact.
- Privacy: no new fetch, no background proxy, no host permission, no manifest permission, no offline-mode exception.
- Build: after `npm run build`, e2e must load the rebuilt `extension/`; if browser launch hangs, follow `docs/developer_guide.md` and inspect manifest validity first.

## Completion Evidence

- `npm run test:unit`: 203 passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; webpack reported only existing asset-size recommendations.
- `npm run test:e2e`: 33 passed in a headed Chromium session.
- `node --test tests/unit/manifest.test.mjs`: 6 passed; `src/manifest.json` has no change in this feature series.

## Recent Git History Notes

- Recent commits use long commit bodies with `Why / What / How / Boundary`; follow the same style for every segment.
- UI regressions are normally locked with Playwright e2e, not manual-only notes.
- Search/file-tree state recently moved through `sessionStorage`; this feature uses `chrome.storage.local` because it is a user preference/history feature rather than one-page navigation state.
- CSS customization keeps built-ins readonly and user slots editable. The separate enable switch removes effective CSS without erasing stored slots; re-enabling requires an explicit Apply.
