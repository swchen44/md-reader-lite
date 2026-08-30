import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('../src/core/github-url.ts')

test('parseRawUrl: classic form', async () => {
  const { parseRawUrl } = await load()
  assert.deepEqual(
    parseRawUrl('https://raw.githubusercontent.com/o/r/main/docs/a.md'),
    { owner: 'o', repo: 'r', ref: 'main', refPrefix: '', dirPath: ['docs'] },
  )
  assert.deepEqual(
    parseRawUrl('https://raw.githubusercontent.com/o/r/abc123/top.md'),
    { owner: 'o', repo: 'r', ref: 'abc123', refPrefix: '', dirPath: [] },
  )
})

test('parseRawUrl: explicit refs forms', async () => {
  const { parseRawUrl } = await load()
  assert.deepEqual(
    parseRawUrl(
      'https://raw.githubusercontent.com/o/r/refs/heads/main/docs/x/a.md',
    ),
    {
      owner: 'o',
      repo: 'r',
      ref: 'main',
      refPrefix: 'refs/heads/',
      dirPath: ['docs', 'x'],
    },
  )
  assert.equal(
    parseRawUrl('https://raw.githubusercontent.com/o/r/refs/tags/v1/a.md')
      .refPrefix,
    'refs/tags/',
  )
})

test('parseRawUrl: short explicit form falls back to classic parse', async () => {
  const { parseRawUrl } = await load()
  // segs = ['refs','heads','a.md'] 不足顯式最少段數 → 傳統解析：ref='refs'? 不：
  // 傳統需 ref+file ≥2 段：ref='refs', path=['heads','a.md'] → dirPath ['heads']
  assert.deepEqual(
    parseRawUrl('https://raw.githubusercontent.com/o/r/refs/heads/a.md'),
    { owner: 'o', repo: 'r', ref: 'refs', refPrefix: '', dirPath: ['heads'] },
  )
})

test('parseRawUrl: non-github and malformed → null', async () => {
  const { parseRawUrl } = await load()
  assert.equal(parseRawUrl('https://example.com/o/r/main/a.md'), null)
  assert.equal(parseRawUrl('https://raw.githubusercontent.com/o/r'), null)
  assert.equal(parseRawUrl('https://raw.githubusercontent.com/o/r/main'), null)
})

test('parseRawUrl: decodes %20 and strips query/hash', async () => {
  const { parseRawUrl } = await load()
  assert.deepEqual(
    parseRawUrl(
      'https://raw.githubusercontent.com/o/r/main/my%20docs/a.md?x=1#y',
    ).dirPath,
    ['my docs'],
  )
})

test('rawDirUrl: rebuilds both forms with encoding and trailing slash', async () => {
  const { parseRawUrl, rawDirUrl } = await load()
  const p1 = parseRawUrl(
    'https://raw.githubusercontent.com/o/r/main/my%20docs/a.md',
  )
  assert.equal(
    rawDirUrl(p1),
    'https://raw.githubusercontent.com/o/r/main/my%20docs/',
  )
  const p2 = parseRawUrl(
    'https://raw.githubusercontent.com/o/r/refs/heads/main/docs/a.md',
  )
  assert.equal(
    rawDirUrl(p2),
    'https://raw.githubusercontent.com/o/r/refs/heads/main/docs/',
  )
  assert.equal(
    rawDirUrl(p2, []),
    'https://raw.githubusercontent.com/o/r/refs/heads/main/',
  )
})

test('apiContentsUrl: path + unprefixed ref', async () => {
  const { parseRawUrl, apiContentsUrl } = await load()
  const p = parseRawUrl(
    'https://raw.githubusercontent.com/o/r/refs/heads/main/my%20docs/a.md',
  )
  assert.equal(
    apiContentsUrl(p),
    'https://api.github.com/repos/o/r/contents/my%20docs?ref=main',
  )
  assert.equal(
    apiContentsUrl(p, []),
    'https://api.github.com/repos/o/r/contents?ref=main',
  )
})

test('parentTreeUrl: deep, one-level, root', async () => {
  const { parseRawUrl, parentTreeUrl } = await load()
  const deep = parseRawUrl(
    'https://raw.githubusercontent.com/o/r/main/a/b/c.md',
  )
  assert.equal(parentTreeUrl(deep), 'https://github.com/o/r/tree/main/a')
  const one = parseRawUrl('https://raw.githubusercontent.com/o/r/main/a/c.md')
  assert.equal(parentTreeUrl(one), 'https://github.com/o/r/tree/main')
  const root = parseRawUrl('https://raw.githubusercontent.com/o/r/main/c.md')
  assert.equal(parentTreeUrl(root), null)
})

test('contentsToDirEntries: filter, sort, urls', async () => {
  const { parseRawUrl, contentsToDirEntries } = await load()
  const p = parseRawUrl('https://raw.githubusercontent.com/o/r/main/docs/a.md')
  const out = contentsToDirEntries(
    [
      { name: 'z.md', type: 'file' },
      { name: 'img.png', type: 'file' },
      { name: 'sub dir', type: 'dir' },
      { name: 'A.MD', type: 'file' },
    ],
    p,
    ['docs'],
  )
  assert.deepEqual(out, [
    {
      name: 'sub dir',
      isDir: true,
      url: 'https://raw.githubusercontent.com/o/r/main/docs/sub%20dir/',
    },
    {
      name: 'A.MD',
      isDir: false,
      url: 'https://raw.githubusercontent.com/o/r/main/docs/A.MD',
    },
    {
      name: 'z.md',
      isDir: false,
      url: 'https://raw.githubusercontent.com/o/r/main/docs/z.md',
    },
  ])
})

test('classifyGithubFailure', async () => {
  const { classifyGithubFailure } = await load()
  assert.equal(classifyGithubFailure(403, '0'), 'ratelimit')
  assert.equal(classifyGithubFailure(429, '0'), 'ratelimit')
  assert.equal(classifyGithubFailure(403, '42'), 'error')
  assert.equal(classifyGithubFailure(403, null), 'error')
  assert.equal(classifyGithubFailure(500, '0'), 'error')
  assert.equal(classifyGithubFailure(404, null), 'error')
})
