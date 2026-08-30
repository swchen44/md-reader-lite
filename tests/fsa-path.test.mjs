import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('../src/core/fsa-path.ts')

test('urlToDirPath: file URL strips filename/query/hash, decodes, no empty segs', async () => {
  const { urlToDirPath } = await load()
  assert.deepEqual(urlToDirPath('file:///Users/me/my%20kb/notes/a.md?x=1#h'), [
    'Users',
    'me',
    'my kb',
    'notes',
  ])
  assert.deepEqual(urlToDirPath('file:///Users/me/notes/'), [
    'Users',
    'me',
    'notes',
  ])
  assert.deepEqual(urlToDirPath('file:///'), [])
})

test('rootPathCandidates: deep-first matches plus always-appended fallback', async () => {
  const { rootPathCandidates } = await load()
  const segs = ['a', 'x', 'b', 'x', 'c']
  assert.deepEqual(rootPathCandidates('x', segs), [
    { rootDir: ['a', 'x', 'b', 'x'], remainder: ['c'] },
    { rootDir: ['a', 'x'], remainder: ['b', 'x', 'c'] },
    { rootDir: [], remainder: segs },
  ])
})

test('rootPathCandidates: no name match yields only fallback', async () => {
  const { rootPathCandidates } = await load()
  assert.deepEqual(rootPathCandidates('zzz', ['a', 'b']), [
    { rootDir: [], remainder: ['a', 'b'] },
  ])
})

test('resolveByCandidates: first failing, second succeeding', async () => {
  const { resolveByCandidates } = await load()
  const fake = allowed => ({
    getDirectoryHandle: async name => {
      if (!allowed.length || allowed[0] !== name) throw new Error('NotFound')
      return fake(allowed.slice(1))
    },
  })
  const root = fake(['b', 'x', 'c'])
  const got = await resolveByCandidates(root, [
    { rootDir: ['a', 'x', 'b', 'x'], remainder: ['c'] },
    { rootDir: ['a', 'x'], remainder: ['b', 'x', 'c'] },
  ])
  assert.deepEqual(got, { rootDir: ['a', 'x'], remainder: ['b', 'x', 'c'] })
})

test('resolveByCandidates: empty remainder wins immediately; all-fail null', async () => {
  const { resolveByCandidates } = await load()
  const never = {
    getDirectoryHandle: async () => {
      throw new Error('x')
    },
  }
  assert.deepEqual(
    await resolveByCandidates(never, [{ rootDir: ['p'], remainder: [] }]),
    {
      rootDir: ['p'],
      remainder: [],
    },
  )
  assert.equal(
    await resolveByCandidates(never, [{ rootDir: [], remainder: ['a'] }]),
    null,
  )
})

test('entriesToDirEntries: filters, sorts dirs-first, encodes urls', async () => {
  const { entriesToDirEntries } = await load()
  const out = entriesToDirEntries(
    [
      { name: 'b.md', kind: 'file' },
      { name: 'zeta', kind: 'directory' },
      { name: 'photo.png', kind: 'file' },
      { name: 'alpha', kind: 'directory' },
      { name: 'A note.MD', kind: 'file' },
    ],
    'file:///kb/',
  )
  assert.deepEqual(out, [
    { name: 'alpha', isDir: true, url: 'file:///kb/alpha/' },
    { name: 'zeta', isDir: true, url: 'file:///kb/zeta/' },
    { name: 'A note.MD', isDir: false, url: 'file:///kb/A%20note.MD' },
    { name: 'b.md', isDir: false, url: 'file:///kb/b.md' },
  ])
})

test('entriesToDirEntries: dot files filtered unless markdown', async () => {
  const { entriesToDirEntries } = await load()
  const out = entriesToDirEntries(
    [
      { name: '.DS_Store', kind: 'file' },
      { name: '.hidden.md', kind: 'file' },
      { name: '.git', kind: 'directory' },
    ],
    'file:///kb/',
  )
  assert.deepEqual(
    out.map(e => e.name),
    ['.git', '.hidden.md'],
  )
})

test('entriesToDirEntries: punctuation matches browser file-url encoding', async () => {
  const { entriesToDirEntries, encodePathSegment } = await load()
  // 黃金值來自 WHATWG URL 的 pathname setter —— 與瀏覽器 location.href 同一套
  // 正規化演算法。encodePathSegment 組出的 URL 必須跟它完全一致，否則以
  // startsWith 比對 grant 範圍時會永久失敗。
  const goldUrl = name => {
    const u = new URL('file:///kb/')
    u.pathname = '/kb/' + name
    return u.href
  }
  const names = [
    'Q&A.md',
    'a=b.md',
    'c+d.md',
    'e,f.md',
    'g;h.md',
    'i@j.md',
    'k$l.md',
    'v|w.md',
    '[bracket].md',
    'space name.md',
    '中文 檔.md',
    '100%.md',
  ]
  for (const name of names) {
    const built = 'file:///kb/' + encodePathSegment(name)
    assert.equal(built, goldUrl(name), `mismatch for ${JSON.stringify(name)}`)
  }

  const out = entriesToDirEntries(
    [{ name: 'Q&A.md', kind: 'file' }],
    'file:///kb/',
  )
  assert.deepEqual(out, [
    { name: 'Q&A.md', isDir: false, url: 'file:///kb/Q&A.md' },
  ])
})
