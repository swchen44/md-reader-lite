# 案 E Phase 2：搜尋形態一致增量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 標題結果加入祖先鏈脈絡；檔案頁籤就地樹過濾（依頁籤分流的搜尋模式），對齊商店 3.x 形態。

**Architecture:** core 加純函式 `withAncestors`；file-tree 改回傳 handle（tree + applyFilter/clearFilter，內部扁平節點註冊表 + `currentQuery` 於兩個渲染完成點重套）；search-panel 以 `getMode`/`onFilesQuery` 分流輸入事件（檔案模式絕不觸發全文搜尋與文件高亮）；main 居中接線。

**Tech Stack:** 同案 E（TS、Ele、node:test、Playwright）。

## Global Constraints

- 分支：`feature/search-parity`（已存在，spec 在上面）。
- 檔案模式**絕不**執行 `search()`／`CSS.highlights`／面板渲染（spec Critical 防漏）。
- 名稱比對重用 core 的 `findRanges`（比對語意零改動）。
- 節點註冊表為扁平陣列、不以 name 作 key；`applyFilter` 每次由 plainName 重建 label；`applyFilter('')` ≡ `clearFilter()`；`../` 豁免；TREE_FILE_ACTIVE 不豁免；資料夾命中不自動展開。
- 測試命令 `node --test tests/<file>.test.mjs`；全量 = doc-search(13) + obsidian(18) + dir-listing(6) + graphviz(6) = 43。
- 建置：`export npm_package_version=1.0.2 npm_package_name=md-reader-lite && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js`。
- Commit 四段（Why/What/How/Boundary）+ 兩行 trailers（Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> ／ Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR）。
- Subagent 模型一律 sonnet（使用者指定）。

## File Structure

| 檔案                               | 動作 | 職責                                                                 |
| ---------------------------------- | ---- | -------------------------------------------------------------------- |
| `src/core/doc-search.ts`           | 修改 | `withAncestors` + `HeadingLevelEntry`/`AncestorItem` 型別            |
| `tests/doc-search.test.mjs`        | 修改 | +5 條 withAncestors 測試                                             |
| `src/core/file-tree.ts`            | 修改 | `FileTreeHandle`、註冊表、applyFilter/clearFilter、currentQuery 重套 |
| `src/core/search-panel.ts`         | 修改 | getMode/onFilesQuery 分流、祖先脈絡渲染                              |
| `src/main.ts`                      | 修改 | handle 型別連動、模式接線、closeSearch 清理                          |
| `src/config/class-name.ts`         | 修改 | TREE_FILTERED_HIDDEN、TREE_NAME_HIT、SEARCH_ITEM_CONTEXT             |
| `src/style/index.less`             | 修改 | 三個新 class 樣式                                                    |
| `src/config/i18n/locale.json`      | 修改 | `search_filter_loaded_only` ×3                                       |
| `docs/plans.md`、`docs/designs.md` | 修改 | 索引（Task 4）                                                       |

---

### Task 1: `withAncestors`（TDD）

**Files:**

- Modify: `src/core/doc-search.ts`（檔尾追加）
- Test: `tests/doc-search.test.mjs`（追加 5 條）

**Interfaces:**

- Produces:

  - `interface HeadingLevelEntry { level: number }`
  - `interface AncestorItem { index: number; isContext: boolean }`
  - `withAncestors(headings: HeadingLevelEntry[], hitIndexes: number[]): AncestorItem[]`——輸出依 index 升冪；祖先 = 該標題前方最近的、level 更小的標題，遞迴至無；命中優先（同 index 既是命中又是祖先 → isContext=false）；共用祖先去重；hitIndexes 空 → 空陣列。

- [ ] **Step 1: 追加失敗測試**

`tests/doc-search.test.mjs` 檔尾：

```js
test('withAncestors: nested hit pulls full ancestor chain as context', async () => {
  const { withAncestors } = await load()
  // h1 h2 h3，命中 h3
  assert.deepEqual(
    withAncestors([{ level: 1 }, { level: 2 }, { level: 3 }], [2]),
    [
      { index: 0, isContext: true },
      { index: 1, isContext: true },
      { index: 2, isContext: false },
    ],
  )
})

test('withAncestors: shared ancestors dedupe across hits', async () => {
  const { withAncestors } = await load()
  // h1 h2 h3 h3，命中兩個 h3 → h1/h2 各一次
  assert.deepEqual(
    withAncestors(
      [{ level: 1 }, { level: 2 }, { level: 3 }, { level: 3 }],
      [2, 3],
    ),
    [
      { index: 0, isContext: true },
      { index: 1, isContext: true },
      { index: 2, isContext: false },
      { index: 3, isContext: false },
    ],
  )
})

test('withAncestors: h1 hit has no ancestors', async () => {
  const { withAncestors } = await load()
  assert.deepEqual(withAncestors([{ level: 1 }, { level: 2 }], [0]), [
    { index: 0, isContext: false },
  ])
})

test('withAncestors: skip-level headings still chain (h1 -> h3)', async () => {
  const { withAncestors } = await load()
  assert.deepEqual(withAncestors([{ level: 1 }, { level: 3 }], [1]), [
    { index: 0, isContext: true },
    { index: 1, isContext: false },
  ])
})

test('withAncestors: a hit that is also an ancestor stays a hit', async () => {
  const { withAncestors } = await load()
  // h1(hit) h2(hit)：h1 是 h2 的祖先但本身命中 → isContext=false
  assert.deepEqual(withAncestors([{ level: 1 }, { level: 2 }], [0, 1]), [
    { index: 0, isContext: false },
    { index: 1, isContext: false },
  ])
})
```

- [ ] **Step 2: RED** — `node --test tests/doc-search.test.mjs` → 5 條新測試 FAIL（withAncestors is not a function）

- [ ] **Step 3: 實作（doc-search.ts 檔尾）**

```ts
export interface HeadingLevelEntry {
  level: number
}

export interface AncestorItem {
  index: number
  isContext: boolean
}

/**
 * 命中標題 + 其未命中祖先（提供層級脈絡）。
 * 祖先 = 該標題前方最近且 level 更小者，遞迴至無。輸出依文件順序。
 */
export function withAncestors(
  headings: HeadingLevelEntry[],
  hitIndexes: number[],
): AncestorItem[] {
  const hits = new Set(hitIndexes)
  if (!hits.size) return []
  const visible = new Set<number>(hits)
  for (const hit of hitIndexes) {
    let level = headings[hit]?.level ?? 0
    for (let i = hit - 1; i >= 0 && level > 1; i--) {
      if (headings[i].level < level) {
        visible.add(i)
        level = headings[i].level
      }
    }
  }
  return Array.from(visible)
    .sort((a, b) => a - b)
    .map(index => ({ index, isContext: !hits.has(index) }))
}
```

- [ ] **Step 4: GREEN** — `node --test tests/doc-search.test.mjs` → 13 pass（8 舊 + 5 新）

- [ ] **Step 5: 迴歸 + Commit** — 全量 43 pass、tsc 乾淨。

```
feat: add withAncestors heading-context helper

Why: store-parity phase needs heading hits displayed with their
unmatched ancestor chain for hierarchy context (teardown-documented
store rule: visible = self hit or has visible descendant).
What: pure withAncestors(headings, hitIndexes) returning
document-ordered {index, isContext} with shared-ancestor dedupe,
skip-level chaining and hit-over-context precedence; five unit tests.
How: per-hit backward walk collecting strictly-decreasing levels.
Boundary: core module + tests; no consumer yet.
```

---

### Task 2: file-tree 過濾（handle 化 + 註冊表）

**Files:**

- Modify: `src/core/file-tree.ts`、`src/main.ts`（僅 handle 型別連動的機械修改）、`src/config/class-name.ts`、`src/style/index.less`

**Interfaces:**

- Consumes: `findRanges`（`@/core/doc-search`）
- Produces（Task 3 依賴）:

  - `export interface FileTreeHandle { tree: Ele<HTMLElement>; applyFilter(query: string): void; clearFilter(): void }`
  - `createFileTree(opts): FileTreeHandle`（原本直接回傳 Ele → 改回傳 handle）

- [ ] **Step 1: class 常數**

`class-name.ts`（TREE_MSG 之後）：

```ts
  TREE_FILTERED_HIDDEN: p`tree-filtered-hidden`,
  TREE_NAME_HIT: p`tree-name-hit`,
  TREE_FILTER_HINT: p`tree-filter-hint`,
```

- [ ] **Step 2: file-tree.ts 改造**

a. import 增加：`import { findRanges } from '@/core/doc-search'`

b. 檔內新增型別與（createFileTree 內）註冊表狀態：

```ts
export interface FileTreeHandle {
  tree: Ele<HTMLElement>
  applyFilter(query: string): void
  clearFilter(): void
}

interface NodeRecord {
  plainName: string
  label: HTMLElement // 檔案節點為 <a>、資料夾節點為 <span>
  li: HTMLElement
  isDir: boolean
}
```

createFileTree 內：

```ts
const records: NodeRecord[] = []
let currentQuery = ''
let hintEle: Ele<HTMLElement> | null = null
```

c. `renderFileNode` 於 `li.append(link)` 前登錄：

```ts
records.push({
  plainName: entry.name,
  label: link.ele,
  li: li.ele,
  isDir: false,
})
```

`renderDirNode` 於 `li.append(label)` 前登錄（isDir: true, label: label.ele, li: li.ele）。

d. 過濾核心（createFileTree 內、renderDirNode 之後）：

```ts
const HIT_ATTR = 'data-md-filter-hit'

function rebuildLabel(rec: NodeRecord, ranges: Array<[number, number]>) {
  rec.label.textContent = ''
  let cursor = 0
  for (const [s, e] of ranges) {
    if (s > cursor) {
      rec.label.append(document.createTextNode(rec.plainName.slice(cursor, s)))
    }
    const mark = document.createElement('span')
    mark.className = className.TREE_NAME_HIT
    mark.textContent = rec.plainName.slice(s, e)
    rec.label.append(mark)
    cursor = e
  }
  if (cursor < rec.plainName.length) {
    rec.label.append(document.createTextNode(rec.plainName.slice(cursor)))
  }
}

function hasMatchedAncestorDir(li: HTMLElement): boolean {
  let node: HTMLElement | null = li.parentElement
  while (node && node !== container.ele) {
    if (
      node.tagName === 'LI' &&
      node.classList.contains(className.TREE_DIR) &&
      node.getAttribute(HIT_ATTR) === '1'
    ) {
      return true
    }
    node = node.parentElement
  }
  return false
}

function applyFilter(query: string) {
  const q = query.trim()
  currentQuery = q
  const live = records.filter(r => r.li.isConnected)
  /* phase 1：比對 + label 重建（每次都從 plainName 重建，避免巢狀 span） */
  for (const rec of live) {
    const ranges = q ? findRanges(rec.plainName, q) : []
    rec.li.toggleAttribute
    if (ranges.length) {
      rec.li.setAttribute(HIT_ATTR, '1')
      rebuildLabel(rec, ranges)
    } else {
      rec.li.removeAttribute(HIT_ATTR)
      rec.label.textContent = rec.plainName
    }
  }
  /* phase 2：可見性（自己命中 ∨ 祖先資料夾命中 ∨ 有命中後代） */
  for (const rec of live) {
    const show =
      !q ||
      rec.li.getAttribute(HIT_ATTR) === '1' ||
      hasMatchedAncestorDir(rec.li) ||
      rec.li.querySelector(`[${HIT_ATTR}="1"]`) !== null
    rec.li.classList.toggle(className.TREE_FILTERED_HIDDEN, !show)
  }
  /* 提示列 */
  if (q) {
    if (!hintEle) {
      hintEle = new Ele<HTMLElement>('div', {
        className: `${className.TREE_MSG} ${className.TREE_FILTER_HINT}`,
      })
      hintEle.textContent = localize('search_filter_loaded_only')
      container.append(hintEle)
    }
    hintEle.show()
  } else {
    hintEle?.hide()
  }
}

function clearFilter() {
  applyFilter('')
}
```

（`rec.li.toggleAttribute` 該行為贅字，實作時勿包含——此處明確標示以免照抄。）

e. **兩個渲染完成點重套**：根載入 `.then` 的 `renderEntries(container, entries)` 之後、展開路徑 `renderEntries(childBox, entries)` 之後，各加：

```ts
if (currentQuery) applyFilter(currentQuery)
```

f. 回傳改為：

```ts
return { tree: container, applyFilter, clearFilter }
```

g. `../` 導覽 div 不登錄（現況即如此，不動）。

- [ ] **Step 3: main.ts 機械連動**

`fileTree` 型別 `ReturnType<typeof createFileTree> | null` 不變（型別自動變 handle）；使用點全改：

- `lifecycle.mount([fileTree])` → `lifecycle.mount([fileTree.tree])`
- `fileTree?.toggle(isFiles)` → `fileTree?.tree.toggle(isFiles)`
- `fileTree?.hide()` → `fileTree?.tree.hide()`
- raw 清單 `eles.push(fileTree)` → `eles.push(fileTree.tree)`
  （以 `grep -n "fileTree" src/main.ts` 逐點清查，不遺漏。）

- [ ] **Step 4: 樣式**

`index.less` 的 `&__file-tree { … }` 區塊內加：

```less
.md-reader__tree-filtered-hidden {
  display: none;
}
.md-reader__tree-name-hit {
  background: rgba(255, 200, 40, 0.55);
  border-radius: 2px;
}
.md-reader__tree-filter-hint {
  margin-top: 0.6em;
  font-size: 12px;
}
```

- [ ] **Step 5: locale**

`locale.json`：en `"search_filter_loaded_only": "Filtering loaded items only"`；zh-CN `"仅过滤已加载项目"`；zh-TW `"僅過濾已載入項目"`（python json round-trip 編輯）。

- [ ] **Step 6: 驗證 + Commit** — 全量 43 pass（Task 1 已入）、tsc 乾淨、建置成功、`python3 -c "import json; json.load(open('src/config/i18n/locale.json'))"`。

```
feat: add in-place filtering to the file tree

Why: store parity — the store's Files tab carries its own tree filter
(folder match reveals the loaded subtree, ancestors of hits stay
visible); ours had none.
What: createFileTree now returns a handle {tree, applyFilter,
clearFilter}; a flat node registry (never name-keyed) drives
match marking, idempotent label rebuild from plainName, two-phase
visibility (self hit / matched ancestor dir / matched descendant),
a loaded-only hint row, and currentQuery reapplied after both the
root load and folder-expand render paths; main.ts call sites updated
mechanically; styles and the hint locale string added.
How: name matching reuses core findRanges so semantics stay identical
to document search; ../ nav stays exempt by never entering the
registry.
Boundary: no behavior change while no filter is active; search-panel
wiring lands next.
```

---

### Task 3: search-panel 模式分流 + 祖先脈絡 + main 接線

**Files:**

- Modify: `src/core/search-panel.ts`、`src/main.ts`、`src/config/class-name.ts`、`src/style/index.less`

**Interfaces:**

- Consumes: `withAncestors`/`HeadingLevelEntry`（Task 1）、`FileTreeHandle`（Task 2）
- Produces: `createSearchPanel` options 增加 `getMode: () => 'outline' | 'files'` 與 `onFilesQuery: (q: string) => void`（必填）；行為——files 模式下輸入/focus/clear 只走 `onFilesQuery`，絕不執行 search()/文件高亮/面板渲染。

- [ ] **Step 1: class 常數 + 樣式**

`class-name.ts`（SEARCH_ITEM_HEADING 之後）：`SEARCH_ITEM_CONTEXT: p`search-item--context`,`
`index.less` `&__search-panel` 區塊內：

```less
.md-reader__search-item--context {
  opacity: 0.55;
}
```

- [ ] **Step 2: search-panel.ts 修改**

a. import 增加 `withAncestors` 與 `type HeadingLevelEntry`。

b. `Options` 增加：

```ts
  getMode: () => 'outline' | 'files'
  onFilesQuery: (q: string) => void
```

c. collect 時同步建立完整標題序列（供祖先推導）。現行 `collect()` 開頭 `heads.map(...)` 改為同時記錄 level：

```ts
let headingSeq: Array<{ entry: SearchEntry; level: number }> = []

function collect(): SearchEntry[] {
  const heads = getHeads()
  headingSeq = heads.map(h => ({
    entry: {
      kind: 'heading' as const,
      text: headingText(h),
      ref: h,
    },
    level: Number(h.tagName.slice(1)) || 6,
  }))
  const collected: SearchEntry[] = headingSeq.map(x => x.entry)
  /* …既有區塊採集段落不動… */
  return buildIndex(collected)
}
```

（注意：`buildIndex` 會過濾空白標題——`headingSeq` 保留原序即可，祖先推導用 headingSeq，命中映射用物件同一性，空白標題不會成為命中也極少成為祖先；若成為祖先鏈斷點屬可接受近似，加註解說明。）

d. 輸入分流——`run` 之上新增：

```ts
function route(value: string) {
  if (opts.getMode() === 'files') {
    opts.onFilesQuery(value)
    return
  }
  run(value)
}
```

`input.on('input', …)` 的 debounce callback 由 `run(input.ele.value)` 改 `route(input.ele.value)`；`focus()` 內的 `run(...)` 改 `route(...)`；`clear()` 開頭加：

```ts
if (opts.getMode() === 'files') opts.onFilesQuery('')
```

（`opts` 即 createSearchPanel 參數物件；現行程式若解構了 options，改存整個 opts 或補捕 getMode/onFilesQuery 變數。）

e. 祖先脈絡渲染——`renderResults` 的標題組段改為：

```ts
if (result.headings.length) {
  groupTitle(`${localize('search_headings')} ${result.headings.length}`)
  const hitIndexes = result.headings
    .map(h => headingSeq.findIndex(x => x.entry === h.entry))
    .filter(i => i >= 0)
  const hitByIndex = new Map<number, SearchHit>()
  result.headings.forEach(h => {
    const i = headingSeq.findIndex(x => x.entry === h.entry)
    if (i >= 0) hitByIndex.set(i, h)
  })
  withAncestors(
    headingSeq.map(x => ({ level: x.level })),
    hitIndexes,
  ).forEach(item => {
    const seq = headingSeq[item.index]
    if (item.isContext) {
      panel.append(contextItem(seq.entry))
    } else {
      panel.append(headingItem(hitByIndex.get(item.index)!))
    }
  })
}
```

新增 `contextItem`：

```ts
function contextItem(entry: SearchEntry): Ele<HTMLElement> {
  const el = entry.ref as HTMLElement
  const item = new Ele<HTMLElement>('div', {
    className: `${className.SEARCH_ITEM} ${className.SEARCH_ITEM_HEADING} ${
      className.SEARCH_ITEM_CONTEXT
    } ${className.MD_SIDE}-${el.tagName.toLowerCase()}`,
  })
  item.textContent = entry.text
  item.on('click', () => jumpTo(el))
  return item
}
```

- [ ] **Step 3: main.ts 接線**

a. `createSearchPanel({...})` 增加：

```ts
    getMode: () => activeTab,
    onFilesQuery: q => fileTree?.applyFilter(q),
```

b. `openSearch()`：面板 mount/show 僅限 outline 模式——

```ts
function openSearch() {
  if (searchOpen || rawShown) return
  searchOpen = true
  const filesMode = activeTab === 'files'
  if (!filesMode) {
    if (!searchMounted) {
      lifecycle.mount([searchPanel.panel])
      searchMounted = true
    }
    mdSide.hide()
    fileTree?.tree.hide()
    searchPanel.panel.show()
  }
  outlineTabBtn.hide()
  filesTabBtn.hide()
  searchPanel.button.hide()
  searchPanel.bar.show()
  searchPanel.focus()
}
```

（files 模式：樹保持可見、面板不動。）

c. `closeSearch()`：`searchPanel.clear()` 之後加 `fileTree?.clearFilter()`（兩模式都呼叫、無過濾時為 no-op），其餘不變。

- [ ] **Step 4: 驗證 + Commit** — 全量 43 pass、tsc 乾淨、建置成功。

```
feat: split search by tab mode and add ancestor context to results

Why: store parity — the store runs two independent filters (outline /
file tree); our single search now routes by the active tab, and
heading results show their unmatched ancestor chain for hierarchy
context.
What: search-panel gains getMode/onFilesQuery routing (files mode
never runs full-text search, document highlighting or panel
rendering), heading results render withAncestors output with faded
clickable context items; main wires the mode getter and file-tree
filter, keeps the tree visible in files mode and clears the filter on
close.
How: hit mapping by entry object identity onto the collected heading
sequence; context items reuse the sidebar level classes for indent.
Boundary: outline-mode semantics unchanged apart from added context
rows; engine untouched.
```

---

### Task 4: 驗收（controller）+ 索引 + 合併發版

- [ ] Playwright（controller）：
  1. 大綱模式：查詢命中 h3（例如查 "comments"→Multi? 用 obsidian-demo 的 h2/h1 結構驗證）：脈絡項存在（`.md-reader__search-item--context`）、opacity 淡化、可點擊跳轉；標題命中計數不含脈絡項。
  2. 檔案模式：切檔案頁籤 → 開搜尋 → 輸入 "nested" → `CSS.highlights` 全程空、無面板顯示、sub 資料夾（含命中後代）與 nested.md 顯示、其餘隱藏（TREE_FILTERED_HIDDEN）、名稱含 TREE_NAME_HIT span、提示列存在；輸入 "sub"（資料夾名命中）→ 已載入子樹全顯示；連續按鍵 label 無巢狀 span（span 數穩定）；Esc → 全樹恢復、label 純文字。
  3. 迴歸：大綱模式全流程、raw、folderTree 開關、tree 展開後過濾重套。
- [ ] `docs/plans.md`/`docs/designs.md` 補案 E Phase 2 兩列。
- [ ] 合入 main、bump 1.0.3、tag 觸發自動 release（controller）。

## Self-Review 紀錄

- **Spec coverage**：withAncestors（T1）、樹過濾全規則含豁免/競態/冪等（T2）、模式分流與 Critical 防漏、祖先渲染、main 接線（T3）、驗收含 CSS.highlights 空與巢狀 span 檢查（T4）。
- **Placeholder scan**：T2 Step 2d 的贅行已明確標示勿抄；無 TBD。
- **Type consistency**：`FileTreeHandle`/`applyFilter`/`clearFilter`/`getMode`/`onFilesQuery`/`withAncestors` 簽名跨任務一致；main.ts `fileTree.tree` 連動點在 T2/T3 敘述一致。
