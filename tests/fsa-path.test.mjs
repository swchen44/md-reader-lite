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
