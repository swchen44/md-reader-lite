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
