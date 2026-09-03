import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('../../src/core/dir-listing.ts')

const NGINX_HTML = `<html><head><title>Index of /docs/</title></head>
<body bgcolor="white"><h1>Index of /docs/</h1><hr><pre><a href="../">../</a>
<a href="api/">api/</a>                                28-Aug-2026 10:00       -
<a href="intro.md">intro.md</a>                        28-Aug-2026 10:00     1024
<a href="Setup%20Guide.MD">Setup Guide.MD</a>          28-Aug-2026 10:00      512
<a href="photo.png">photo.png</a>                      28-Aug-2026 10:00     9000
</pre><hr></body></html>`

const APACHE_HTML = `<html><head><title>Index of /docs</title></head><body>
<h1>Index of /docs</h1><table>
<tr><th><a href="?C=N;O=D">Name</a></th><th><a href="?C=M;O=A">Last modified</a></th></tr>
<tr><td><a href="/">Parent Directory</a></td><td></td></tr>
<tr><td><a href="api/">api/</a></td><td>2026-08-28 10:00</td></tr>
<tr><td><a href="intro.md">intro.md</a></td><td>2026-08-28 10:00</td></tr>
<tr><td><a href="readme.txt">readme.txt</a></td><td>2026-08-28 10:00</td></tr>
</table></body></html>`

const IIS_HTML = `<html><head><title>example.com - /docs/</title></head><body>
<H1>example.com - /docs/</H1><hr><pre>
<A HREF="/docs/api/">api</A><br>
<A HREF="/docs/intro.md">intro.md</A><br>
<A HREF="/docs/data.json">data.json</A><br>
</pre><hr></body></html>`

// Chrome file:// 目錄頁的核心是一串 addRow(name, urlencodedName, isdir, ...) 呼叫
const CHROME_FILE_HTML = `<html><head><script>start("/Users/dev/docs/");</script>
<script>addRow("..","..",1,0,"",0,"");</script>
<script>addRow("api","api",1,0,"",1756346400,"8/28/26");</script>
<script>addRow("intro.md","intro.md",0,1024,"1.0 kB",1756346400,"8/28/26");</script>
<script>addRow("Setup Guide.md","Setup%20Guide.md",0,512,"512 B",1756346400,"8/28/26");</script>
<script>addRow("notes.txt","notes.txt",0,10,"10 B",1756346400,"8/28/26");</script>
</head><body></body></html>`

test('parses nginx autoindex: keeps dirs and md files, drops others and ../', async () => {
  const { parseDirListing } = await load()
  const entries = parseDirListing(NGINX_HTML, 'http://intra/docs/')
  assert.deepEqual(entries, [
    { name: 'api', isDir: true, url: 'http://intra/docs/api/' },
    { name: 'intro.md', isDir: false, url: 'http://intra/docs/intro.md' },
    {
      name: 'Setup Guide.MD',
      isDir: false,
      url: 'http://intra/docs/Setup%20Guide.MD',
    },
  ])
})

test('parses apache autoindex: drops sort links and Parent Directory', async () => {
  const { parseDirListing } = await load()
  const entries = parseDirListing(APACHE_HTML, 'http://intra/docs/')
  assert.deepEqual(entries, [
    { name: 'api', isDir: true, url: 'http://intra/docs/api/' },
    { name: 'intro.md', isDir: false, url: 'http://intra/docs/intro.md' },
  ])
})

test('parses IIS listing with absolute hrefs', async () => {
  const { parseDirListing } = await load()
  const entries = parseDirListing(IIS_HTML, 'http://intra/docs/')
  assert.deepEqual(entries, [
    { name: 'api', isDir: true, url: 'http://intra/docs/api/' },
    { name: 'intro.md', isDir: false, url: 'http://intra/docs/intro.md' },
  ])
})

test('parses chrome file:// addRow listing', async () => {
  const { parseDirListing } = await load()
  const entries = parseDirListing(CHROME_FILE_HTML, 'file:///Users/dev/docs/')
  assert.deepEqual(entries, [
    {
      name: 'api',
      isDir: true,
      url: 'file:///Users/dev/docs/api/',
      sizeBytes: 0,
      mtimeMs: 1756346400000,
    },
    {
      name: 'intro.md',
      isDir: false,
      url: 'file:///Users/dev/docs/intro.md',
      sizeBytes: 1024,
      mtimeMs: 1756346400000,
    },
    {
      name: 'Setup Guide.md',
      isDir: false,
      url: 'file:///Users/dev/docs/Setup%20Guide.md',
      sizeBytes: 512,
      mtimeMs: 1756346400000,
    },
  ])
})

test('parses chrome file:// addRow size/mtime for sort features', async () => {
  const { parseDirListing } = await load()
  const entries = parseDirListing(CHROME_FILE_HTML, 'file:///Users/dev/docs/')
  const bySize = [...entries].sort(
    (a, b) => (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0),
  )
  assert.deepEqual(
    bySize.map(e => e.name),
    ['api', 'Setup Guide.md', 'intro.md'],
  )
})

test('unknown html yields empty list', async () => {
  const { parseDirListing } = await load()
  assert.deepEqual(
    parseDirListing('<html><body>hello</body></html>', 'http://x/'),
    [],
  )
})

test('isMarkdownFile matches manifest extensions case-insensitively', async () => {
  const { isMarkdownFile } = await load()
  assert.equal(isMarkdownFile('a.md'), true)
  assert.equal(isMarkdownFile('a.MDX'), true)
  assert.equal(isMarkdownFile('a.mkd'), true)
  assert.equal(isMarkdownFile('a.markdown'), true)
  assert.equal(isMarkdownFile('a.txt'), false)
})
