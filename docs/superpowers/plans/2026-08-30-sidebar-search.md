# 案 E：側邊欄搜尋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 側欄放大鏡搜尋——即時過濾大綱標題 + 當前文件全文搜尋（snippet、跳轉、CSS Custom Highlight 文件內高亮）。

**Architecture:** core 層純函式引擎 `doc-search.ts`（可 node 測試，零 DOM/chrome），shell 層 `search-panel.ts`（DOM 採集、面板、Highlight API、跳轉閃爍），main.ts 以既有 activateTab/rawShown 狀態機掛載。無新依賴、無新權限。

**Tech Stack:** TypeScript、Ele wrapper、CSS Custom Highlight API（含降級）、node:test、Playwright（controller 驗收）。

## Global Constraints

- 分支：`feature/sidebar-search`（已存在，spec 在上面）。
- 比對規則：大小寫不敏感純子字串；debounce 150ms；內文命中上限 100（`BLOCK_HIT_LIMIT`）；snippet 前後 30 字。
- core 檔案（doc-search.ts）零 chrome、零 DOM 型別依賴。
- 測試命令 `node --test tests/<file>.test.mjs`（目錄模式勿用）；全量 = obsidian + dir-listing + graphviz + doc-search 四檔。
- 建置：`export npm_package_version=1.0.1 npm_package_name=md-reader-lite && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js`。
- CSS class 一律經 class-name.ts 的 `p` 模板；i18n 新 key 加 en/zh-CN/zh-TW（其餘 fallback en）。
- 每個 commit 四段訊息（Why/What/How/Boundary）+ 兩行 trailers（Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> / Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR），各 Task 不再重複註明。
- TS 4.8：無 Highlight/CSS.highlights 型別——在 search-panel.ts 檔頭做最小 ambient 宣告（見 Task 2），不裝 @types。

## File Structure

| 檔案                               | 動作 | 職責                                                     |
| ---------------------------------- | ---- | -------------------------------------------------------- |
| `src/core/doc-search.ts`           | 新增 | 純函式：`findRanges`/`buildIndex`/`search`/`makeSnippet` |
| `tests/doc-search.test.mjs`        | 新增 | 引擎單元測試                                             |
| `src/core/search-panel.ts`         | 新增 | DOM 採集、UI（button/bar/panel）、Highlight、跳轉閃爍    |
| `src/config/class-name.ts`         | 修改 | SEARCH\_\* class 常數                                    |
| `src/style/index.less`             | 修改 | 搜尋列/面板/高亮/閃爍樣式                                |
| `src/main.ts`                      | 修改 | 掛載與開關狀態機、contentRendered rebuild、raw 前關閉    |
| `src/config/i18n/locale.json`      | 修改 | 6 個 search\_\* 字串 ×3 語系                             |
| `docs/plans.md`、`docs/designs.md` | 修改 | 索引補案 E 兩列                                          |

---

### Task 1: doc-search 引擎（TDD）

**Files:**

- Create: `src/core/doc-search.ts`
- Test: `tests/doc-search.test.mjs`

**Interfaces:**

- Produces（Task 2/3 依賴，簽名精確）:

  - `interface SearchEntry { kind: 'heading' | 'block'; text: string; ref: unknown }`
  - `interface SearchHit { entry: SearchEntry; ranges: Array<[number, number]> }`
  - `interface SearchResult { headings: SearchHit[]; blocks: SearchHit[]; truncated: boolean }`
  - `interface Snippet { text: string; ranges: Array<[number, number]> }`
  - `const BLOCK_HIT_LIMIT = 100`
  - `findRanges(text: string, query: string): Array<[number, number]>`（非重疊、全部命中、大小寫不敏感）
  - `buildIndex(entries: SearchEntry[]): SearchEntry[]`（過濾空白 text，回傳新陣列）
  - `search(entries: SearchEntry[], query: string, limit?: number): SearchResult`（query trim 後為空 → 全空結果；blocks 超過 limit 截斷並 truncated=true；headings 不設限）
  - `makeSnippet(text: string, ranges: Array<[number, number]>, context?: number): Snippet`（以第一個命中為中心、前後 context=30 字；視窗外命中丟棄、視窗內命中位移重映射；截斷側加 `…` 並計入位移）

- [ ] **Step 1: 失敗測試**

`tests/doc-search.test.mjs`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('../src/core/doc-search.ts')

test('findRanges: case-insensitive, all non-overlapping hits', async () => {
  const { findRanges } = await load()
  assert.deepEqual(findRanges('Obsidian and obsidian', 'obsid'), [
    [0, 5],
    [13, 18],
  ])
  assert.deepEqual(findRanges('aaaa', 'aa'), [
    [0, 2],
    [2, 4],
  ])
  assert.deepEqual(findRanges('abc', 'x'), [])
  assert.deepEqual(findRanges('文件夾目錄與文件', '文件'), [
    [0, 2],
    [6, 8],
  ])
})

test('buildIndex drops blank entries, keeps order and refs', async () => {
  const { buildIndex } = await load()
  const a = { kind: 'heading', text: 'One', ref: 1 }
  const b = { kind: 'block', text: '   ', ref: 2 }
  const c = { kind: 'block', text: 'Two', ref: 3 }
  assert.deepEqual(buildIndex([a, b, c]), [a, c])
})

test('search: groups by kind, empty query yields empty result', async () => {
  const { buildIndex, search } = await load()
  const idx = buildIndex([
    { kind: 'heading', text: 'Obsidian 語法', ref: 'h1' },
    { kind: 'block', text: '拿 obsidian 實測', ref: 'b1' },
    { kind: 'block', text: '無關內容', ref: 'b2' },
  ])
  const r = search(idx, 'obsid')
  assert.equal(r.headings.length, 1)
  assert.equal(r.blocks.length, 1)
  assert.deepEqual(r.blocks[0].ranges, [[2, 7]])
  assert.equal(r.truncated, false)
  const empty = search(idx, '   ')
  assert.deepEqual(empty, { headings: [], blocks: [], truncated: false })
})

test('search: block hits truncate at limit, headings unlimited', async () => {
  const { search } = await load()
  const entries = []
  for (let i = 0; i < 150; i++)
    entries.push({ kind: 'block', text: `hit ${i}`, ref: i })
  const r = search(entries, 'hit', 100)
  assert.equal(r.blocks.length, 100)
  assert.equal(r.truncated, true)
})

test('makeSnippet: middle hit gets both ellipses and remapped ranges', async () => {
  const { makeSnippet } = await load()
  const text = 'x'.repeat(50) + 'NEEDLE' + 'y'.repeat(50)
  const s = makeSnippet(text, [[50, 56]], 30)
  assert.ok(s.text.startsWith('…') && s.text.endsWith('…'))
  const [st, en] = s.ranges[0]
  assert.equal(s.text.slice(st, en), 'NEEDLE')
})

test('makeSnippet: hit at head/tail omits that side ellipsis', async () => {
  const { makeSnippet } = await load()
  const head = makeSnippet('NEEDLE' + 'y'.repeat(50), [[0, 6]], 30)
  assert.ok(!head.text.startsWith('…') && head.text.endsWith('…'))
  assert.equal(head.text.slice(...head.ranges[0]), 'NEEDLE')
  const tail = makeSnippet('y'.repeat(50) + 'NEEDLE', [[50, 56]], 30)
  assert.ok(tail.text.startsWith('…') && !tail.text.endsWith('…'))
  assert.equal(tail.text.slice(...tail.ranges[0]), 'NEEDLE')
})

test('makeSnippet: in-window secondary hits kept, out-of-window dropped', async () => {
  const { makeSnippet } = await load()
  const text = 'ab ab' + 'z'.repeat(100) + 'ab'
  const s = makeSnippet(
    text,
    [
      [0, 2],
      [3, 5],
      [105, 107],
    ],
    10,
  )
  assert.equal(s.ranges.length, 2)
  for (const [st, en] of s.ranges) assert.equal(s.text.slice(st, en), 'ab')
})
```

- [ ] **Step 2: RED**

Run: `node --test tests/doc-search.test.mjs` → 全部 FAIL（Cannot find module）

- [ ] **Step 3: 實作 `src/core/doc-search.ts`**

```ts
export interface SearchEntry {
  kind: 'heading' | 'block'
  text: string
  ref: unknown
}

export interface SearchHit {
  entry: SearchEntry
  ranges: Array<[number, number]>
}

export interface SearchResult {
  headings: SearchHit[]
  blocks: SearchHit[]
  truncated: boolean
}

export interface Snippet {
  text: string
  ranges: Array<[number, number]>
}

export const BLOCK_HIT_LIMIT = 100

/** 大小寫不敏感、非重疊的全部命中位置 */
export function findRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  if (!query) return ranges
  const haystack = text.toLowerCase()
  const needle = query.toLowerCase()
  let from = 0
  for (;;) {
    const at = haystack.indexOf(needle, from)
    if (at === -1) break
    ranges.push([at, at + needle.length])
    from = at + needle.length
  }
  return ranges
}

export function buildIndex(entries: SearchEntry[]): SearchEntry[] {
  return entries.filter(e => e.text.trim().length > 0)
}

export function search(
  entries: SearchEntry[],
  query: string,
  limit: number = BLOCK_HIT_LIMIT,
): SearchResult {
  const q = query.trim()
  const result: SearchResult = { headings: [], blocks: [], truncated: false }
  if (!q) return result
  for (const entry of entries) {
    if (entry.kind === 'block' && result.blocks.length >= limit) {
      result.truncated = true
      continue
    }
    const ranges = findRanges(entry.text, q)
    if (!ranges.length) continue
    const hit: SearchHit = { entry, ranges }
    if (entry.kind === 'heading') result.headings.push(hit)
    else result.blocks.push(hit)
  }
  return result
}

/** 以第一個命中為中心擷取上下文；視窗內其餘命中重映射、視窗外丟棄 */
export function makeSnippet(
  text: string,
  ranges: Array<[number, number]>,
  context: number = 30,
): Snippet {
  if (!ranges.length) return { text, ranges: [] }
  const [first] = ranges
  const start = Math.max(0, first[0] - context)
  const end = Math.min(text.length, first[1] + context)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const offset = prefix.length - start
  const remapped: Array<[number, number]> = []
  for (const [s, e] of ranges) {
    if (s >= start && e <= end) remapped.push([s + offset, e + offset])
  }
  return { text: prefix + text.slice(start, end) + suffix, ranges: remapped }
}
```

- [ ] **Step 4: GREEN**

Run: `node --test tests/doc-search.test.mjs` → 7 pass。
注意 `search` 的 truncated 判定：達 limit 後仍需掃到「確實還有命中」才設 truncated——上面實作在達上限後對 block 一律 continue 並直接設 truncated，若該 block 其實沒命中會誤報。修正為：達上限時仍執行 `findRanges`，有命中才 `result.truncated = true`（測試第 4 條 150 筆全命中兩種實作都過，請以此語意實作並自行加一條測試：101 筆中第 101 筆不命中 → truncated=false）：

```js
test('search: truncated only when an actual hit is dropped', async () => {
  const { search } = await load()
  const entries = []
  for (let i = 0; i < 100; i++)
    entries.push({ kind: 'block', text: `hit ${i}`, ref: i })
  entries.push({ kind: 'block', text: 'miss', ref: 'x' })
  const r = search(entries, 'hit', 100)
  assert.equal(r.blocks.length, 100)
  assert.equal(r.truncated, false)
})
```

- [ ] **Step 5: 迴歸 + Commit**

Run: `node --test tests/doc-search.test.mjs tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs`（8+15+6+6=35 pass）、`node_modules/.bin/tsc --noEmit`

```
feat: add pure document search engine

Why: sidebar search (roadmap 1.4/E) needs a testable core that
filters outline headings and full-text blocks with hit ranges and
context snippets, independent of DOM and chrome APIs.
What: doc-search.ts with findRanges (case-insensitive, non-overlap),
buildIndex, search (heading/block grouping, 100-block limit with
honest truncation flag) and makeSnippet (30-char context, range
remapping, edge ellipses); 8 unit tests including CJK substrings.
How: plain string scanning; refs are opaque to the core so callers
attach DOM elements without the core depending on DOM types.
Boundary: new core module + tests; nothing consumes it yet.
```

---

### Task 2: search-panel（DOM 採集 + UI + Highlight）

**Files:**

- Create: `src/core/search-panel.ts`
- Modify: `src/config/class-name.ts`、`src/style/index.less`

**Interfaces:**

- Consumes: Task 1 全部 export；`Ele`（`@/core/ele`：`new Ele('div',{className},children)`、`.on()`、`.append()`、`.hide()/.show()/.toggle(v)`、`.textContent`、`.innerHTML = null`、proxy 轉發 DOM 屬性）；`className`。
- Produces（Task 3 依賴）:

  - `createSearchPanel(opts: { getArticle: () => HTMLElement; getHeads: () => HTMLElement[]; localize: (k: string) => string; onRequestClose: () => void }): SearchPanel`
  - `interface SearchPanel { button: Ele<HTMLElement>; bar: Ele<HTMLElement>; panel: Ele<HTMLElement>; focus(): void; clear(): void; rebuild(): void }`
  - 初始狀態：`bar` 與 `panel` hidden、`button` visible。`button` 的 click 由 Task 3 綁（open 流程屬 main 狀態機）；`bar` 內 ✕ 與輸入框 Esc 觸發 `onRequestClose()`。

- [ ] **Step 1: class-name 常數**

`src/config/class-name.ts` default export 內（`SIDE_TAB_ACTIVE` 之後）加：

```ts
  SIDE_SEARCH_BTN: p`side-search-btn`,
  SEARCH_BAR: p`search-bar`,
  SEARCH_INPUT: p`search-input`,
  SEARCH_CLOSE: p`search-close`,
  SEARCH_PANEL: p`search-panel`,
  SEARCH_GROUP_TITLE: p`search-group-title`,
  SEARCH_ITEM: p`search-item`,
  SEARCH_ITEM_HEADING: p`search-item--heading`,
  SEARCH_HIT: p`search-hit`,
  SEARCH_MSG: p`search-msg`,
  SEARCH_FLASH: p`search-flash`,
```

- [ ] **Step 2: 實作 `src/core/search-panel.ts`**

```ts
import Ele from '@/core/ele'
import className from '@/config/class-name'
import {
  buildIndex,
  makeSnippet,
  search,
  type SearchEntry,
  type SearchHit,
} from '@/core/doc-search'

/* TS 4.8 lib 無 CSS Custom Highlight API 型別；最小 ambient 宣告 */
declare class Highlight {
  constructor(...ranges: Range[])
}
declare namespace CSS {
  const highlights:
    | { set(name: string, h: Highlight): void; delete(name: string): void }
    | undefined
}

const HIGHLIGHT_NAME = 'md-reader-search'
const DEBOUNCE_MS = 150
const FLASH_MS = 1500
/* 葉層級文字區塊；:has 需 Chrome 105+（本擴充最低支援線一致） */
const BLOCK_SELECTOR = [
  'p',
  'td',
  'th',
  'figcaption',
  'pre code',
  'li:not(:has(p, li, pre, table, blockquote))',
].join(', ')

const SEARCH_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'

interface Options {
  getArticle: () => HTMLElement
  getHeads: () => HTMLElement[]
  localize: (k: string) => string
  onRequestClose: () => void
}

export interface SearchPanel {
  button: Ele<HTMLElement>
  bar: Ele<HTMLElement>
  panel: Ele<HTMLElement>
  focus(): void
  clear(): void
  rebuild(): void
}

export function createSearchPanel(opts: Options): SearchPanel {
  const { getArticle, getHeads, localize, onRequestClose } = opts

  const button = new Ele<HTMLElement>('button', {
    className: className.SIDE_SEARCH_BTN,
    title: localize('search_placeholder'),
  })
  button.innerHTML = SEARCH_SVG

  const input = new Ele<HTMLInputElement>('input', {
    className: className.SEARCH_INPUT,
    placeholder: localize('search_placeholder'),
  })
  const closeBtn = new Ele<HTMLElement>('button', {
    className: className.SEARCH_CLOSE,
    title: 'Esc',
  })
  closeBtn.textContent = '✕'
  const bar = new Ele<HTMLElement>('div', { className: className.SEARCH_BAR }, [
    input,
    closeBtn,
  ])
  const panel = new Ele<HTMLElement>('div', {
    className: className.SEARCH_PANEL,
  })
  bar.hide()
  panel.hide()

  let entries: SearchEntry[] | null = null
  let debounceTimer = 0
  let flashTimer = 0

  function collect(): SearchEntry[] {
    const heads = getHeads()
    const collected: SearchEntry[] = heads.map(h => ({
      kind: 'heading',
      text: headingText(h),
      ref: h,
    }))
    const article = getArticle()
    article.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach(el => {
      if (el.closest('h1,h2,h3,h4,h5,h6')) return
      if (el.offsetParent === null) return
      collected.push({ kind: 'block', text: el.textContent || '', ref: el })
    })
    return buildIndex(collected)
  }

  function headingText(h: HTMLElement): string {
    /* 標題首子節點是 "#" 錨點連結，排除之 */
    let text = ''
    h.childNodes.forEach(n => {
      if (
        n instanceof HTMLElement &&
        n.classList.contains(className.HEAD_ANCHOR)
      ) {
        return
      }
      text += n.textContent || ''
    })
    return text.trim()
  }

  function ensureEntries(): SearchEntry[] {
    if (!entries) entries = collect()
    return entries
  }

  function run(query: string) {
    const result = search(ensureEntries(), query.trim())
    renderResults(query.trim(), result)
    applyDocumentHighlights(query.trim(), result.blocks)
  }

  function renderResults(
    query: string,
    result: ReturnType<typeof search>,
  ): void {
    panel.innerHTML = null
    if (!query) {
      message(localize('search_empty_hint'))
      return
    }
    if (!result.headings.length && !result.blocks.length) {
      message(localize('search_no_results'))
      return
    }
    if (result.headings.length) {
      groupTitle(`${localize('search_headings')} ${result.headings.length}`)
      result.headings.forEach(hit => panel.append(headingItem(hit)))
    }
    if (result.blocks.length) {
      groupTitle(`${localize('search_blocks')} ${result.blocks.length}`)
      result.blocks.forEach(hit => panel.append(blockItem(hit)))
      if (result.truncated) message(localize('search_truncated'))
    }
  }

  function message(text: string) {
    const m = new Ele<HTMLElement>('div', { className: className.SEARCH_MSG })
    m.textContent = text
    panel.append(m)
  }

  function groupTitle(text: string) {
    const t = new Ele<HTMLElement>('div', {
      className: className.SEARCH_GROUP_TITLE,
    })
    t.textContent = text
    panel.append(t)
  }

  function highlightedFragment(
    text: string,
    ranges: Array<[number, number]>,
  ): DocumentFragment {
    const frag = document.createDocumentFragment()
    let cursor = 0
    for (const [s, e] of ranges) {
      if (s > cursor) frag.append(text.slice(cursor, s))
      const mark = document.createElement('span')
      mark.className = className.SEARCH_HIT
      mark.textContent = text.slice(s, e)
      frag.append(mark)
      cursor = e
    }
    if (cursor < text.length) frag.append(text.slice(cursor))
    return frag
  }

  function headingItem(hit: SearchHit): Ele<HTMLElement> {
    const el = hit.entry.ref as HTMLElement
    const item = new Ele<HTMLElement>('div', {
      className: `${className.SEARCH_ITEM} ${className.SEARCH_ITEM_HEADING} ${
        className.MD_SIDE
      }-${el.tagName.toLowerCase()}`,
    })
    item.append(highlightedFragment(hit.entry.text, hit.ranges))
    item.on('click', () => jumpTo(el))
    return item
  }

  function blockItem(hit: SearchHit): Ele<HTMLElement> {
    const snip = makeSnippet(hit.entry.text, hit.ranges)
    const item = new Ele<HTMLElement>('div', {
      className: className.SEARCH_ITEM,
    })
    item.append(highlightedFragment(snip.text, snip.ranges))
    item.on('click', () => jumpTo(hit.entry.ref as HTMLElement))
    return item
  }

  function jumpTo(el: HTMLElement) {
    if (!el.isConnected) {
      entries = null
      run(input.ele.value)
      return
    }
    el.scrollIntoView({ block: 'center' })
    clearTimeout(flashTimer)
    el.classList.remove(className.SEARCH_FLASH)
    /* 強制 reflow 讓同一元素能重播動畫 */
    void el.offsetWidth
    el.classList.add(className.SEARCH_FLASH)
    flashTimer = window.setTimeout(
      () => el.classList.remove(className.SEARCH_FLASH),
      FLASH_MS,
    )
  }

  function applyDocumentHighlights(query: string, hits: SearchHit[]): void {
    if (typeof CSS === 'undefined' || !CSS.highlights) return
    CSS.highlights.delete(HIGHLIGHT_NAME)
    if (!query || !hits.length) return
    const ranges: Range[] = []
    for (const hit of hits) {
      const el = hit.entry.ref as HTMLElement
      if (!el.isConnected) continue
      for (const [s, e] of hit.ranges) {
        const range = rangeInElement(el, s, e)
        if (range) ranges.push(range)
      }
    }
    if (ranges.length) {
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges))
    }
  }

  /** 將元素 textContent 的 [start,end) 映射為跨文字節點的 Range */
  function rangeInElement(
    el: HTMLElement,
    start: number,
    end: number,
  ): Range | null {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let offset = 0
    let startNode: Text | null = null
    let startOffset = 0
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.data.length
      if (!startNode && start < offset + len) {
        startNode = node
        startOffset = start - offset
      }
      if (startNode && end <= offset + len) {
        const range = document.createRange()
        range.setStart(startNode, startOffset)
        range.setEnd(node, end - offset)
        return range
      }
      offset += len
    }
    return null
  }

  input.on('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => run(input.ele.value), DEBOUNCE_MS)
  })
  input.on('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      e.stopPropagation()
      onRequestClose()
    }
  })
  closeBtn.on('click', () => onRequestClose())

  return {
    button,
    bar,
    panel,
    focus() {
      input.ele.focus()
      run(input.ele.value)
    },
    clear() {
      clearTimeout(debounceTimer)
      input.ele.value = ''
      panel.innerHTML = null
      if (typeof CSS !== 'undefined' && CSS.highlights) {
        CSS.highlights.delete(HIGHLIGHT_NAME)
      }
    },
    rebuild() {
      entries = null
      if (input.ele.value.trim() && !panel.ele.hidden) run(input.ele.value)
    },
  }
}
```

（若 `Ele` 對 `hidden` 屬性/`innerHTML` 的 proxy 行為與上述用法不符，以 `panel.ele.…` 直接操作為準——實作時對照 `src/core/ele.ts`，並在 report 記錄調整。`rebuild` 中「面板是否顯示」的判斷可改由 Task 3 傳入 callback 或以 `panel.ele.style.display` 檢查，擇一並保持行為：關閉狀態下 rebuild 只作廢索引。）

- [ ] **Step 3: 樣式**

`src/style/index.less`：

a. `.md-reader` 區塊內 `&__side-tabs { … }` 的 `.md-reader__side-tab` 規則後加：

```less
.md-reader__side-search-btn {
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  color: var(--color-side);
  background: transparent;
  &:hover {
    color: var(--color-primary);
  }
}
.md-reader__search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 6px 8px;
  .md-reader__search-input {
    flex: 1;
    min-width: 0;
    padding: 4px 8px;
    border: 1px solid var(--color-side-border);
    border-radius: 4px;
    font-size: 13px;
    color: var(--color-side);
    background: transparent;
    outline: none;
    &:focus {
      border-color: var(--color-primary);
    }
  }
  .md-reader__search-close {
    flex: 0 0 auto;
    margin-left: 6px;
    border: none;
    cursor: pointer;
    color: var(--color-side);
    background: transparent;
    &:hover {
      color: var(--color-primary);
    }
  }
}
```

b. `&__file-tree { … }` 區塊後新增同級：

```less
&__search-panel {
  overflow: auto;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: @side-width;
  padding: 58px 1.2em 22px;
  border-right: 1px solid var(--color-side-border);
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-side);
  background: var(--color-side-bg);
  transition: transform 0.3s;
  will-change: transform;
  z-index: 1;
  .md-reader__search-group-title {
    margin: 0.8em 0 0.3em;
    font-weight: bolder;
    opacity: 0.7;
  }
  .md-reader__search-item {
    padding: 0.35em 0.4em;
    border-radius: 4px;
    cursor: pointer;
    word-break: break-all;
    &:hover {
      background: rgba(96, 124, 210, 0.12);
    }
  }
  .md-reader__search-msg {
    opacity: 0.6;
    padding: 0.5em 0;
  }
  .md-reader__search-hit {
    background: rgba(255, 200, 40, 0.55);
    border-radius: 2px;
  }
}
```

c. 檔案尾端（`.md-reader` 大區塊外）加文件內高亮與閃爍：

```less
::highlight(md-reader-search) {
  background-color: rgba(255, 200, 40, 0.45);
}

.md-reader__search-flash {
  animation: md-reader-search-flash 1.5s ease-out;
}

@keyframes md-reader-search-flash {
  0%,
  60% {
    background-color: rgba(96, 124, 210, 0.25);
  }
  100% {
    background-color: transparent;
  }
}
```

d. 既有三處收合/展開/RWD selector（`.side-collapsed`、`@media (max-width: 960px)` 中含 `&__side, &__side-tabs, &__file-tree` 的規則）以逗號補上 `&__search-panel`；`.side-expanded` 的 `&__side, &__file-tree, &__side-tabs` 亦補上。

- [ ] **Step 4: 驗證 + Commit**

Run: `node_modules/.bin/tsc --noEmit`（無新錯）、全量測試 36 pass、建置成功。

```
feat: add search panel component with document highlighting

Why: project E's UI layer — collects headings and leaf text blocks
from the rendered article, renders grouped results with snippets, and
highlights document hits without mutating the article DOM.
What: search-panel.ts (collector with :has leaf-block selector,
result list with per-hit highlight spans, CSS Custom Highlight API
integration with graceful degradation, jump with 1.5s flash and
stale-ref guard), SEARCH_* class constants, styles incl. collapse/
expand/RWD selector extensions.
How: ranges from the pure engine drive both list marks and document
Range objects (textContent-offset TreeWalker mapping); ambient types
cover the Highlight API missing from TS 4.8's lib.
Boundary: not mounted yet; main.ts wiring lands next.
```

---

### Task 3: main.ts 整合 + locale

**Files:**

- Modify: `src/main.ts`、`src/config/i18n/locale.json`

**Interfaces:**

- Consumes: `createSearchPanel`（Task 2 簽名）；main.ts 既有 `activateTab(tab)`、`activeTab`、`rawShown`、`sideTabs`、`mdSide`、`fileTree`、`lifecycle.mount`、`globalEvent`、`headElements`、`mdContent`。

- [ ] **Step 1: locale 字串**

`src/config/i18n/locale.json` 各區塊合入（en 為 fallback）：

```json
"en":    { "search_placeholder": "Search headings & content",
           "search_headings": "Heading hits", "search_blocks": "Content hits",
           "search_empty_hint": "Type to search headings and content",
           "search_no_results": "No matches",
           "search_truncated": "Showing first 100 content hits" }
"zh-CN": { "search_placeholder": "搜索标题与内文",
           "search_headings": "标题命中", "search_blocks": "内文命中",
           "search_empty_hint": "输入关键字搜索标题与内文",
           "search_no_results": "无符合结果",
           "search_truncated": "仅列出前 100 笔内文命中" }
"zh-TW": { "search_placeholder": "搜尋標題與內文",
           "search_headings": "標題命中", "search_blocks": "內文命中",
           "search_empty_hint": "輸入關鍵字搜尋標題與內文",
           "search_no_results": "無符合結果",
           "search_truncated": "僅列出前 100 筆內文命中" }
```

- [ ] **Step 2: main.ts 佈線**

a. import：`import { createSearchPanel } from '@/core/search-panel'`

b. `filesTabBtn` 建立後、`sideTabs` 建立前插入：

```ts
let searchOpen = false
let searchMounted = false
const searchPanel = createSearchPanel({
  getArticle: () => mdContent.ele,
  getHeads: () => headElements,
  localize,
  onRequestClose: () => closeSearch(),
})
searchPanel.button.on('click', () => openSearch())

function openSearch() {
  if (searchOpen || rawShown) return
  searchOpen = true
  if (!searchMounted) {
    lifecycle.mount([searchPanel.panel])
    searchMounted = true
  }
  outlineTabBtn.hide()
  filesTabBtn.hide()
  searchPanel.button.hide()
  searchPanel.bar.show()
  mdSide.hide()
  fileTree?.hide()
  searchPanel.panel.show()
  searchPanel.focus()
}

function closeSearch() {
  if (!searchOpen) return
  searchOpen = false
  searchPanel.clear()
  searchPanel.bar.hide()
  searchPanel.panel.hide()
  outlineTabBtn.show()
  filesTabBtn.show()
  searchPanel.button.show()
  activateTab(activeTab)
}
```

c. `sideTabs` children 改為 `[outlineTabBtn, filesTabBtn, searchPanel.button, searchPanel.bar]`。

d. `rawToggleBtn` click handler 開頭加 `if (searchOpen) closeSearch()`。

e. `setFolderTree` 不需改（搜尋不依賴 folderTree；sideTabs 隱藏時搜尋鈕隨之隱藏）。

f. `initPlugins({ event: globalEvent })` 之後（或任何 globalEvent 可用處）加：

```ts
globalEvent.on('contentRendered', () => {
  searchPanel.rebuild()
})
```

（確認 `src/core/event.ts` 的訂閱方法名——若是 `on` 以外的名稱如 `addListener`/`subscribe`，以實際 API 為準並記錄於 report。）

g. 注意順序：`headElements` 於 `renderSide()` 填充、`mdContent` 於上方建立——`createSearchPanel` 只存 getter，宣告位置在兩者 `let`/`const` 之後即可（`headElements` 是既有 `let`，getter 惰性取值無時序問題）。

- [ ] **Step 3: 驗證 + Commit**

Run: 全量測試 36 pass、tsc 乾淨、建置成功、`python3 -c "import json; json.load(open('src/config/i18n/locale.json'))"`。

```
feat: wire sidebar search into the tab state machine

Why: exposes project E's search through the existing side panel UX —
magnifier button in the tab bar, expanding input, exclusive panel
visibility consistent with outline/files tabs and raw view.
What: open/close state functions hiding tab buttons and sibling
panels, lazy panel mount, Esc/✕ close restoring the previous tab,
raw-view toggle closes search first, contentRendered rebuilds the
index, six search_* locale strings in en/zh-CN/zh-TW.
How: reuses activateTab for restore so tab/panel exclusivity has a
single owner; search button rides sideTabs so collapse/raw handling
needs no new elements.
Boundary: main.ts wiring and locale only; engine and panel unchanged.
```

---

### Task 4: 驗收（controller 執行 Playwright）與索引更新

**Files:**

- Modify: `docs/plans.md`、`docs/designs.md`（各補案 E 一列，狀態 進行中 → 完成由 controller 在驗收後改）

- [ ] **Step 1（controller）: Playwright 驗收腳本**

對 `http://localhost:8123/obsidian-demo.md`（ThreadingHTTPServer + charset）：

1. 點放大鏡 → 輸入框聚焦（`document.activeElement.className` 含 search-input）
2. 輸入 `Obsidian` → 斷言標題命中 ≥1、內文命中 ≥1、清單含高亮 span
3. 點第一筆標題命中 → `scrollY` 改變、目標 heading 有 `md-reader__search-flash` class
4. 點一筆內文命中 → 目標區塊 flash、`CSS.highlights` 有 `md-reader-search`（`page.evaluate(() => CSS.highlights.has('md-reader-search'))`）
5. Esc → 輸入框消失、頁籤鈕回復、`CSS.highlights.has(...)` false、大綱清單可見
6. 迴歸：檔案頁籤樹仍可載入；raw 切換（搜尋開啟時點 Toggle raw）不殘留面板

- [ ] **Step 2: 索引兩列**

`docs/plans.md` 與 `docs/designs.md` 各加案 E 一列（連結本計畫/спec，狀態依實況）。

- [ ] **Step 3: Commit（docs）**

```
docs: index project E plan and spec

Why: keep plans.md/designs.md the complete registry of project docs.
What: one row each for the sidebar-search spec and plan.
How: links into docs/superpowers/.
Boundary: documentation only.
```

---

## Self-Review 紀錄

- **Spec coverage**：引擎與規則（T1）、採集/面板/Highlight/降級/閃爍/stale-ref（T2）、狀態機整合＋ raw ＋ contentRendered ＋ locale（T3）、Playwright 驗收與索引（T4）。100 上限、debounce、30 字 snippet、Esc/✕、空查詢/零命中訊息皆有對應。
- **Placeholder scan**：無 TBD；T2 對 Ele API 差異與 T3 對 event API 名稱給了明確的「以實際 API 為準並記錄」指示（授權偏移而非留白）。
- **Type consistency**：`SearchEntry/SearchHit/SearchResult/Snippet/BLOCK_HIT_LIMIT` 與 `createSearchPanel` 簽名在 T1/T2/T3 一致；`HIGHLIGHT_NAME = 'md-reader-search'` 與驗收步驟、`::highlight(md-reader-search)` 樣式一致。
