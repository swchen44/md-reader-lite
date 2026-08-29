# 資料夾目錄樹 + Obsidian 語法支援 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在開源 md-reader 2.12.12 加入側邊欄「檔案」頁籤（懶加載資料夾目錄樹，支援 file:// 與 http autoindex）以及 Obsidian 語法渲染插件（`![[圖片]]`、`[[wikilink]]`、`%%註解%%`、callout 正規化、front matter 摺疊表格），全程離線可用。

**Architecture:** 目錄清單由 background service worker 的 `fetchDir` action 抓取原始 HTML（失敗且為 file:// 時由 content script 直接 fetch 作 fallback），`src/core/dir-listing.ts` 以純函式解析成統一的項目清單，`src/core/file-tree.ts` 用專案既有的 `Ele` 工具渲染懶加載樹。Obsidian 語法做成 `mdPlugins` 中可開關的一個 markdown-it 插件 `src/plugins/obsidian.ts`。

**Tech Stack:** TypeScript、markdown-it 13、Svelte 3（popup）、Less、Chrome MV3、node:test（測試直接 import .ts，Node ≥ 22 type-stripping）。

## Global Constraints

- 分支：`feature/folder-tree-obsidian`（已存在，設計文件在上面）。
- 離線環境可用：不得新增任何 runtime 依賴、不得引用外部網路資源（spec「需求 3」）。
- 目錄樹只列資料夾與 `.md/.mdx/.mkd/.markdown`（大小寫不拘）。
- 每個 commit message 必須含動機（why）、變更摘要、影響範圍，結尾帶 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 與 `Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR`。
- 測試命令固定為 `node --test tests/<file>.test.mjs`（注意：`node --test tests/` 目錄模式在本 repo 會誤判失敗，一律指定檔案）。
- 建置命令：`export npm_package_version=2.12.12` 後執行 `node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js`（`corepack pnpm build` 的 deps 檢查在本機環境會失敗，勿用）。
- 型別檢查：`node_modules/.bin/tsc --noEmit`（如既有程式本來就有型別錯誤，只要求不新增錯誤）。
- 程式風格由 lint-staged + prettier 在 commit 時自動處理，無需手動跑。
- CSS class 一律經 `src/config/class-name.ts` 的 `p` 模板產生（前綴 `md-reader__`）。

## File Structure

| 檔案                              | 動作 | 職責                                                                                |
| --------------------------------- | ---- | ----------------------------------------------------------------------------------- |
| `src/core/dir-listing.ts`         | 新增 | 目錄頁 HTML → `DirEntry[]` 純函式解析 + `fetchDirListing()` 訊息封裝與 fallback     |
| `tests/dir-listing.test.mjs`      | 新增 | 解析器單元測試（nginx/Apache/IIS/Chrome file 四種 fixture）                         |
| `src/background.ts`               | 修改 | 新增 `fetchDir` action（5 秒逾時）；`actionMap` 加 `folderTree`                     |
| `src/core/file-tree.ts`           | 新增 | 懶加載樹 UI（展開/收合/快取/錯誤重試/目前檔案高亮/`../`）                           |
| `src/main.ts`                     | 修改 | 側邊欄「大綱/檔案」頁籤整合、folderTree 開關 action                                 |
| `src/config/class-name.ts`        | 修改 | 新增 tabs/tree 相關 class 常數                                                      |
| `src/style/index.less`            | 修改 | 頁籤列與樹的樣式；collapse/expand/RWD 規則加上新元素                                |
| `src/core/data.ts`                | 修改 | `folderTree?: boolean` 預設 `true`                                                  |
| `src/popup/components/app.svelte` | 修改 | 「資料夾目錄」開關                                                                  |
| `src/config/i18n/locale.json`     | 修改 | `label_folder-tree`、`label_outline`、`label_files`、`Obsidian`、`dir_error` 各語系 |
| `src/plugins/obsidian.ts`         | 新增 | Obsidian markdown-it 插件（wikilink/embed/註解/callout/front matter）               |
| `tests/obsidian.test.mjs`         | 新增 | 插件輸入 →HTML 輸出測試                                                             |
| `src/core/markdown.ts`            | 修改 | 註冊 `Obsidian` 插件；front matter 交由插件處理時不再預先剝除                       |
| `src/config/md-plugins.ts`        | 修改 | 清單加入 `'Obsidian'`                                                               |

---

### Task 1: dir-listing 解析器（純函式 + 測試）

**Files:**

- Create: `src/core/dir-listing.ts`
- Test: `tests/dir-listing.test.mjs`

**Interfaces:**

- Produces:

  - `interface DirEntry { name: string; isDir: boolean; url: string }`
  - `parseDirListing(html: string, baseUrl: string): DirEntry[]`（純函式，Task 3 使用）
  - `isMarkdownFile(name: string): boolean`
  - 常數 `MD_EXT_RE`
  - （`fetchDirListing` 在 Task 2 加入同一檔案）

- [ ] **Step 1: 寫失敗測試**

`tests/dir-listing.test.mjs`（fixture 直接內嵌，涵蓋四種格式與過濾規則）：

```js
import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('../src/core/dir-listing.ts')

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
    { name: 'api', isDir: true, url: 'file:///Users/dev/docs/api/' },
    { name: 'intro.md', isDir: false, url: 'file:///Users/dev/docs/intro.md' },
    {
      name: 'Setup Guide.md',
      isDir: false,
      url: 'file:///Users/dev/docs/Setup%20Guide.md',
    },
  ])
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/dir-listing.test.mjs`
Expected: FAIL（模組不存在 / Cannot find module）

- [ ] **Step 3: 最小實作**

`src/core/dir-listing.ts`：

```ts
export interface DirEntry {
  name: string
  isDir: boolean
  url: string
}

export const MD_EXT_RE = /\.(md|mdx|mkd|markdown)$/i

export function isMarkdownFile(name: string): boolean {
  return MD_EXT_RE.test(name)
}

const ADD_ROW_RE =
  /addRow\((".*?(?<!\\)")\s*,\s*(".*?(?<!\\)")\s*,\s*(0|1)\s*,/g
const ANCHOR_RE = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi

function parseChromeListing(html: string, baseUrl: string): DirEntry[] {
  const entries: DirEntry[] = []
  for (const match of html.matchAll(ADD_ROW_RE)) {
    let name: string
    let encoded: string
    try {
      // addRow 的參數是 JS 字串字面值，跳脫規則與 JSON 相容（\" \\ \uXXXX）
      name = JSON.parse(match[1])
      encoded = JSON.parse(match[2])
    } catch {
      continue
    }
    const isDir = match[3] === '1'
    if (name === '..' || name === '.') continue
    if (!isDir && !isMarkdownFile(name)) continue
    entries.push({
      name,
      isDir,
      url: new URL(encoded + (isDir ? '/' : ''), baseUrl).href,
    })
  }
  return entries
}

function parseAutoindex(html: string, baseUrl: string): DirEntry[] {
  const entries: DirEntry[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(ANCHOR_RE)) {
    const href = match[1]
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    // 排序連結（apache ?C=N;O=D）、頁內錨點、上層目錄
    if (href.startsWith('?') || href.startsWith('#')) continue
    if (href === '../' || href === '..' || text === '..') continue
    if (/parent directory/i.test(text)) continue
    let url: URL
    try {
      url = new URL(href, baseUrl)
    } catch {
      continue
    }
    if (url.origin !== new URL(baseUrl).origin) continue
    // 指向自身或上層的絕對路徑（IIS 的 Parent、apache 的 "/"）
    const base = new URL(baseUrl)
    if (
      !url.pathname.startsWith(base.pathname) ||
      url.pathname === base.pathname
    ) {
      continue
    }
    const isDir = url.pathname.endsWith('/')
    const segments = url.pathname.slice(base.pathname.length).split('/')
    // 只收直接子項（有些列表會給深層連結）
    if (segments.filter(Boolean).length !== 1) continue
    const name = text || decodeURIComponent(segments[0])
    if (!isDir && !isMarkdownFile(name)) continue
    if (seen.has(url.href)) continue
    seen.add(url.href)
    entries.push({ name, isDir, url: url.href })
  }
  return entries
}

export function parseDirListing(html: string, baseUrl: string): DirEntry[] {
  if (/addRow\(/.test(html)) {
    return parseChromeListing(html, baseUrl)
  }
  return parseAutoindex(html, baseUrl)
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/dir-listing.test.mjs`
Expected: PASS（6 tests pass）。若 nginx fixture 的 `Setup Guide.MD` 名稱斷言失敗，檢查 `parseAutoindex` 的 `name` 取值（連結文字優先）。

- [ ] **Step 5: 既有測試不退化**

Run: `node --test tests/graphviz.test.mjs`
Expected: PASS（6 tests）

- [ ] **Step 6: Commit**

```bash
git add src/core/dir-listing.ts tests/dir-listing.test.mjs
git commit -m "feat: add directory listing parser for folder tree

Why: the folder-tree feature (spec 2026-08-29) needs a uniform
DirEntry[] view over four directory listing formats: nginx/Apache/IIS
autoindex pages and Chrome's file:// addRow() listing. Parsing is
regex-based (no DOMParser) so it runs unchanged in node:test without a
DOM shim. Only directories and markdown extensions matching the
manifest list (.md/.mdx/.mkd/.markdown, case-insensitive) survive
filtering; sort links, parent links and cross-origin hrefs are dropped.

Scope: new pure module src/core/dir-listing.ts + unit tests with
embedded fixtures. No behavior change for existing code paths."
```

（commit message 皆需附上 Global Constraints 規定的 Co-Authored-By / Claude-Session 兩行結尾，後續 Task 不再重複註明。）

---

### Task 2: background `fetchDir` action 與 `fetchDirListing` 封裝

**Files:**

- Modify: `src/background.ts`（`messageHandler` switch、檔尾）
- Modify: `src/core/dir-listing.ts`（追加 `fetchDirListing`）

**Interfaces:**

- Consumes: `parseDirListing`（Task 1）
- Produces:

  - background action `{action: 'fetchDir', data: {url: string}}` → callback `{html: string} | {error: string}`
  - `fetchDirListing(dirUrl: string): Promise<DirEntry[]>`（Task 3 使用；抓取失敗時 throw `Error`）

- [ ] **Step 1: background 加 `fetchDir`**

`src/background.ts` 的 switch 內、`case 'fetch'` 之後加入：

```ts
    case 'fetchDir':
      fetchDirHtml(data.url).then(callback)
      break
```

檔案中（`fetchData` 函式之後）加入：

```ts
const FETCH_DIR_TIMEOUT = 5000

async function fetchDirHtml(url?: string) {
  if (!url) {
    return { error: 'Fetch error: URL is undefined.' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_DIR_TIMEOUT)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return { error: `HTTP ${res.status}` }
    }
    return { html: await res.text() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 2: `fetchDirListing` 封裝（含 file:// fallback）**

`src/core/dir-listing.ts` 檔尾加入（`chrome.*` 只在此函式使用，純函式區不受影響，測試仍可跑）：

```ts
/**
 * 抓取並解析目錄清單。優先走 background（有 host_permissions），
 * 失敗且為 file:// 時退回 content script 直接 fetch（spike fallback，
 * 需「允許存取檔案網址」權限）。
 */
export function fetchDirListing(dirUrl: string): Promise<DirEntry[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchDir', data: { url: dirUrl } },
      async (res: { html?: string; error?: string } | undefined) => {
        if (res?.html) {
          resolve(parseDirListing(res.html, dirUrl))
          return
        }
        if (dirUrl.startsWith('file:')) {
          try {
            const direct = await fetch(dirUrl)
            resolve(parseDirListing(await direct.text(), dirUrl))
            return
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)))
            return
          }
        }
        reject(new Error(res?.error || 'fetchDir failed'))
      },
    )
  })
}
```

- [ ] **Step 3: 型別檢查與既有測試**

Run: `node_modules/.bin/tsc --noEmit; node --test tests/dir-listing.test.mjs tests/graphviz.test.mjs`
Expected: tsc 無新增錯誤；12 tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/background.ts src/core/dir-listing.ts
git commit -m "feat: fetch directory listings via background with file:// fallback

Why: content scripts cannot cross-origin fetch, but the background
service worker holds *://*/* host permissions and (per the existing
auto-refresh feature) can fetch file:// URLs when 'allow access to file
URLs' is granted. fetchDir mirrors the existing fetch action, adds a 5s
AbortController timeout and structured {html}/{error} responses. If the
service worker path fails for file:// (spike risk noted in the spec),
fetchDirListing falls back to a direct same-directory fetch from the
content script before surfacing an error.

Scope: background message surface + messaging wrapper; no UI yet."
```

---

### Task 3: file-tree UI 元件與樣式

**Files:**

- Create: `src/core/file-tree.ts`
- Modify: `src/config/class-name.ts`
- Modify: `src/style/index.less`

**Interfaces:**

- Consumes: `fetchDirListing`、`DirEntry`、`isMarkdownFile`（Task 1/2）；`Ele`（`@/core/ele`，用法同 main.ts：`new Ele<HTMLElement>('div', {className}, children)`、`.on()`、`.append()`、`.hide()/.show()/.toggle(visible)`）
- Produces: `createFileTree(options: { currentUrl: string; localize: (k: string) => string }): Ele<HTMLElement>`（回傳掛載即用的樹容器，Task 4 使用）

- [ ] **Step 1: class-name 常數**

`src/config/class-name.ts` 的 default export 物件內（`MODAL` 之前）加入：

```ts
  SIDE_TABS: p`side-tabs`,
  SIDE_TAB: p`side-tab`,
  SIDE_TAB_ACTIVE: p`side-tab--active`,
  FILE_TREE: p`file-tree`,
  TREE_DIR: p`tree-dir`,
  TREE_DIR_OPEN: p`tree-dir--open`,
  TREE_FILE: p`tree-file`,
  TREE_FILE_ACTIVE: p`tree-file--active`,
  TREE_MSG: p`tree-msg`,
```

- [ ] **Step 2: 實作 `src/core/file-tree.ts`**

```ts
import Ele from '@/core/ele'
import className from '@/config/class-name'
import { fetchDirListing, type DirEntry } from '@/core/dir-listing'

interface FileTreeOptions {
  currentUrl: string
  localize: (key: string) => string
}

/** 目前檔案所在資料夾（含尾斜線） */
export function dirOf(url: string): string {
  return url.slice(0, url.lastIndexOf('/') + 1)
}

/** 上一層資料夾；已在根目錄時回傳 null */
export function parentOf(dirUrl: string): string | null {
  const u = new URL(dirUrl)
  if (u.pathname === '/' || u.pathname === '') return null
  const parent = new URL('..', dirUrl).href
  return parent === dirUrl ? null : parent
}

export function createFileTree({
  currentUrl,
  localize,
}: FileTreeOptions): Ele<HTMLElement> {
  const rootDir = dirOf(currentUrl)
  const container = new Ele<HTMLElement>('div', {
    className: className.FILE_TREE,
  })
  const cache = new Map<string, Promise<DirEntry[]>>()

  const loadDir = (dirUrl: string) => {
    if (!cache.has(dirUrl)) {
      const p = fetchDirListing(dirUrl)
      p.catch(() => cache.delete(dirUrl)) // 失敗不快取，允許重試
      cache.set(dirUrl, p)
    }
    return cache.get(dirUrl)
  }

  function renderMessage(target: Ele<HTMLElement>, text: string) {
    target.append(
      new Ele<HTMLElement>('div', { className: className.TREE_MSG }, text),
    )
  }

  function renderEntries(target: Ele<HTMLElement>, entries: DirEntry[]) {
    const list = new Ele<HTMLElement>('ul')
    entries.forEach(entry => {
      list.append(entry.isDir ? renderDirNode(entry) : renderFileNode(entry))
    })
    target.append(list)
  }

  function renderFileNode(entry: DirEntry): Ele<HTMLElement> {
    const link = new Ele<HTMLElement>('a', {
      href: entry.url,
      title: entry.name,
    })
    link.textContent = entry.name
    const li = new Ele<HTMLElement>('li', {
      className:
        entry.url === currentUrl
          ? `${className.TREE_FILE} ${className.TREE_FILE_ACTIVE}`
          : className.TREE_FILE,
    })
    li.append(link)
    return li
  }

  function renderDirNode(entry: DirEntry): Ele<HTMLElement> {
    const li = new Ele<HTMLElement>('li', { className: className.TREE_DIR })
    const label = new Ele<HTMLElement>('span', { title: entry.name })
    label.textContent = entry.name
    li.append(label)
    let childBox: Ele<HTMLElement> | null = null
    label.on('click', async () => {
      const open = li.ele.classList.toggle(className.TREE_DIR_OPEN)
      if (!open) {
        childBox?.hide()
        return
      }
      if (childBox) {
        childBox.show()
        return
      }
      childBox = new Ele<HTMLElement>('div')
      li.append(childBox)
      renderMessage(childBox, '…')
      try {
        const entries = await loadDir(entry.url)
        childBox.innerHTML = null
        if (entries.length) {
          renderEntries(childBox, entries)
        } else {
          renderMessage(childBox, localize('dir_empty'))
        }
      } catch {
        childBox.innerHTML = null
        renderMessage(childBox, localize('dir_error'))
        childBox = null // 下次點擊重試
        li.ele.classList.remove(className.TREE_DIR_OPEN)
      }
    })
    return li
  }

  /* 首層：../ + 目前資料夾內容 */
  const parent = parentOf(rootDir)
  if (parent) {
    const upLink = new Ele<HTMLElement>('a', { href: parent })
    upLink.textContent = '../'
    const up = new Ele<HTMLElement>('div', { className: className.TREE_FILE })
    up.append(upLink)
    container.append(up)
  }
  renderMessage(container, '…')
  loadDir(rootDir)
    .then(entries => {
      container.ele.querySelector(`.${className.TREE_MSG}`)?.remove()
      if (entries.length) {
        renderEntries(container, entries)
      } else {
        renderMessage(container, localize('dir_error'))
      }
    })
    .catch(() => {
      container.ele.querySelector(`.${className.TREE_MSG}`)?.remove()
      renderMessage(container, localize('dir_error'))
    })

  return container
}
```

注意：`Ele` 若無 `innerHTML` setter/`querySelector`，改用 `childBox.ele.innerHTML = ''` 與 `container.ele.querySelector(...)`——實作時以 `src/core/ele.ts` 實際 API 為準（`Ele` 是 `HTMLElement` 的 Proxy 包裝，main.ts 中已直接使用 `mdSide.innerHTML = null`，故可用）。

- [ ] **Step 3: 樣式**

`src/style/index.less` 中 `.md-reader` 區塊內、`&__side { ... }` 之後加入：

```less
&__side-tabs {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  width: @side-width;
  border-right: 1px solid var(--color-side-border);
  border-bottom: 1px solid var(--color-side-border);
  background: var(--color-side-bg);
  transition: transform 0.3s;
  will-change: transform;
  z-index: 2;
  .md-reader__side-tab {
    flex: 1;
    padding: 10px 0;
    border: none;
    font-size: 13px;
    text-align: center;
    cursor: pointer;
    color: var(--color-side);
    background: transparent;
    &.md-reader__side-tab--active {
      font-weight: bolder;
      color: var(--color-primary);
      box-shadow: inset 0 -2px 0 var(--color-primary);
    }
  }
}

&__file-tree {
  overflow: auto;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: @side-width;
  padding: 58px 0 22px 1.2em;
  border-right: 1px solid var(--color-side-border);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-side);
  background: var(--color-side-bg);
  transition: transform 0.3s, box-shadow 0.5s;
  will-change: transform, box-shadow;
  z-index: 1;
  ul {
    margin: 0;
    padding-left: 1em;
    list-style: none;
  }
  a {
    text-decoration: none;
    color: inherit;
    &:hover {
      color: var(--color-primary);
    }
  }
  .md-reader__tree-dir {
    > span {
      cursor: pointer;
      &::before {
        content: '▸ ';
      }
      &:hover {
        color: var(--color-primary);
      }
    }
    &.md-reader__tree-dir--open > span::before {
      content: '▾ ';
    }
  }
  .md-reader__tree-file--active > a {
    font-weight: bolder;
    color: var(--color-primary);
  }
  .md-reader__tree-msg {
    opacity: 0.6;
    padding: 0.3em 0;
  }
}
```

並在既有的收合/展開規則把新元素加進同樣的 transform（用逗號擴充 selector，共三處）：

1. `.side-collapsed` 區塊內 `&__side { transform: ... }` → `&__side, &__side-tabs, &__file-tree { ... }`
2. `.side-expanded` 區塊內 `&__side { box-shadow: ... }` → `&__side, &__file-tree { ... }`
3. `@media (max-width: 960px)` 區塊內 `&__side { ... }` → `&__side, &__side-tabs, &__file-tree { ... }`

（實作時以 `grep -n '&__side' src/style/index.less` 找到三處行號後修改；有頁籤時大綱 `ul.md-reader__side` 需要騰出頂部空間，於 Task 4 以 `has-tabs` 修飾 class 加 `padding-top: 58px`。）

- [ ] **Step 4: 型別檢查 + 建置可過**

Run: `node_modules/.bin/tsc --noEmit && export npm_package_version=2.12.12 && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -3`
Expected: 建置成功（此時 file-tree 尚未被引用，webpack 可能 tree-shake 掉，屬正常）

- [ ] **Step 5: Commit**

```bash
git add src/core/file-tree.ts src/config/class-name.ts src/style/index.less
git commit -m "feat: add lazy-loading file tree component and styles

Why: the Files tab (spec 2026-08-29) renders the current document's
folder as an expandable tree. Children are fetched only on first
expand and cached per directory; a failed expand collapses the node
and re-arms it for retry, and failures render a one-line message
instead of a broken tree. The component reuses the project's Ele
wrapper and class-name registry; styles mirror the existing side
panel (fixed, 260px, same collapse/expand transforms).

Scope: new UI module + class constants + less rules. Not yet mounted;
integration lands in the next commit."
```

---

### Task 4: 側邊欄「大綱 / 檔案」頁籤整合

**Files:**

- Modify: `src/main.ts`
- Modify: `src/style/index.less`（`has-tabs` 修飾）
- Modify: `src/config/i18n/locale.json`（`label_outline`、`label_files`、`dir_error`、`dir_empty`）

**Interfaces:**

- Consumes: `createFileTree`（Task 3）、`i18n`（`@/config/i18n`）、`configData.folderTree`（Task 5 加入 Data；本 Task 先以 `configData.folderTree !== false` 判斷，預設啟用）
- Produces: main.ts 內 `actions.toggleFolderTree(value: boolean)`（Task 5 的 popup 開關經 background actionMap 呼叫）

- [ ] **Step 1: locale 文字**

`src/config/i18n/locale.json` 各區塊加入（`en-GB`/`en-US` 維持空物件，fallback 到 `en`；`ko`、`uk` 不加，同樣 fallback）：

```json
"en":    { "label_outline": "Outline", "label_files": "Files",
           "dir_error": "Directory listing unavailable", "dir_empty": "No markdown files" }
"zh-CN": { "label_outline": "大纲", "label_files": "文件",
           "dir_error": "无法取得目录列表", "dir_empty": "没有 Markdown 文件" }
"zh-TW": { "label_outline": "大綱", "label_files": "檔案",
           "dir_error": "無法取得目錄列表", "dir_empty": "沒有 Markdown 檔案" }
```

（以上為要合入各區塊的 key，非整段取代。）

- [ ] **Step 2: main.ts 整合**

`src/main.ts`：

a. import 區加入：

```ts
import i18n from '@/config/i18n'
import { createFileTree } from '@/core/file-tree'
```

b. `renderSide()` 呼叫（`main` 內 `renderSide()` 首次呼叫之前）附近、`mdSide` 建立之後加入：

```ts
/* render folder tree tab */
const localize = i18n(configData.language)
let fileTree: ReturnType<typeof createFileTree> | null = null
const outlineTabBtn = tabButton('label_outline', true)
const filesTabBtn = tabButton('label_files', false)
const sideTabs = new Ele<HTMLElement>(
  'div',
  { className: className.SIDE_TABS },
  [outlineTabBtn, filesTabBtn],
)

function tabButton(labelKey: string, active: boolean) {
  const btn = new Ele<HTMLElement>('button', {
    className: active
      ? `${className.SIDE_TAB} ${className.SIDE_TAB_ACTIVE}`
      : className.SIDE_TAB,
  })
  btn.textContent = localize(labelKey)
  return btn
}

function activateTab(tab: 'outline' | 'files') {
  const isFiles = tab === 'files'
  outlineTabBtn.ele.classList.toggle(className.SIDE_TAB_ACTIVE, !isFiles)
  filesTabBtn.ele.classList.toggle(className.SIDE_TAB_ACTIVE, isFiles)
  mdSide.toggle(!isFiles)
  if (isFiles && !fileTree) {
    fileTree = createFileTree({ currentUrl: window.location.href, localize })
    lifecycle.mount([fileTree])
  }
  fileTree?.toggle(isFiles)
}
outlineTabBtn.on('click', () => activateTab('outline'))
filesTabBtn.on('click', () => activateTab('files'))

function setFolderTree(enabled: boolean) {
  sideTabs.toggle(enabled)
  document.body.classList.toggle('md-reader-has-tabs', enabled)
  if (!enabled) activateTab('outline')
}
```

c. `actions` 物件加入：

```ts
    toggleFolderTree(value: boolean) {
      setFolderTree(value)
    },
```

d. `lifecycle.mount([buttonWrap, mdBody, mdSide])` 改為：

```ts
lifecycle.mount([buttonWrap, mdBody, mdSide, sideTabs])
setFolderTree(configData.folderTree !== false)
```

e. `src/style/index.less` 加入（`.md-reader` 區塊外層、`.side-collapsed` 附近）：

```less
&.md-reader-has-tabs {
  .md-reader__side {
    padding-top: 58px;
  }
}
```

（`body` class 由 `setFolderTree` 控制；file-tree 本身的 `padding-top: 58px` 已在 Task 3 樣式中。）

- [ ] **Step 3: 建置**

Run: `node_modules/.bin/tsc --noEmit && export npm_package_version=2.12.12 && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -3`
Expected: 成功

- [ ] **Step 4: 快速手動 smoke（可選但建議）**

於 repo 根目錄：`python3 -m http.server 8000 --directory example &`，Chrome 以「載入未封裝項目」載入 `extension/` 後開 `http://localhost:8000/`（挑任一 .md）。檢查：側邊欄出現「大綱/檔案」頁籤、檔案頁籤列出同層 md、資料夾可展開、`../` 可導覽。完成後 `kill %1`。

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/style/index.less src/config/i18n/locale.json
git commit -m "feat: integrate Outline/Files tabs into the side panel

Why: the file tree needs a home that reuses the existing side panel's
collapse/expand/RWD machinery instead of a second layout system. A
fixed tab bar sits above both panels; the outline <ul> keeps its DOM
and styles untouched, the tree mounts lazily on first activation of
the Files tab. toggleFolderTree is exposed as a content-script action
so the popup switch (next commit) can flip the whole tab bar at
runtime. New i18n keys fall back to English for locales without
translations.

Scope: main.ts wiring + tab styles + locale strings."
```

---

### Task 5: `folderTree` 設定（data、popup、background actionMap）

**Files:**

- Modify: `src/core/data.ts`
- Modify: `src/background.ts`（`actionMap`）
- Modify: `src/popup/components/app.svelte`
- Modify: `src/config/i18n/locale.json`（`label_folder-tree`）

**Interfaces:**

- Consumes: main.ts `actions.toggleFolderTree`（Task 4）、既有 `updateConfig`/storage 訊息機制
- Produces: `Data.folderTree?: boolean`（預設 `true`）

- [ ] **Step 1: Data 預設值**

`src/core/data.ts`：interface `Data` 加 `folderTree?: boolean`；`getDefaultData` 回傳物件加 `folderTree: true,`（放在 `hiddenSide: false,` 之後）。

- [ ] **Step 2: background actionMap**

`src/background.ts` 的 `actionMap` 加：

```ts
  folderTree: 'toggleFolderTree',
```

- [ ] **Step 3: popup 開關**

`src/popup/components/app.svelte`，在 `label_auto-refresh` 的 `form-item` 區塊之後、plugins 區塊之前加入：

```svelte
    <div class="form-item inline">
      <span class="label-item">{localize('label_folder-tree')}:</span>
      <FormField align="end">
        <Switch
          disabled={!data.enable}
          bind:checked={data.folderTree}
          color="primary"
          on:change={() => updateConfig('folderTree', data.folderTree)}
        />
      </FormField>
    </div>
```

- [ ] **Step 4: locale**

`locale.json`：`en` 加 `"label_folder-tree": "Folder Tree"`；`zh-CN` 加 `"label_folder-tree": "文件夹目录"`；`zh-TW` 加 `"label_folder-tree": "資料夾目錄"`。

- [ ] **Step 5: 建置 + 手動確認開關**

Run: 同 Task 4 Step 3 建置命令。Expected: 成功。
手動：重新載入擴充，popup 出現「資料夾目錄」開關；關閉後已開啟的 md 頁面頁籤列即時消失、大綱恢復無頁籤版位；開啟後恢復。

- [ ] **Step 6: Commit**

```bash
git add src/core/data.ts src/background.ts src/popup/components/app.svelte src/config/i18n/locale.json
git commit -m "feat: add Folder Tree toggle to popup settings

Why: per the approved design the folder tree defaults to on but must
be switchable like every other feature. The toggle rides the existing
storage->background->content action pipeline (actionMap entry
folderTree -> toggleFolderTree), so changes apply to the active tab
immediately without a reload.

Scope: Data default, actionMap entry, popup Switch, locale label."
```

---

### Task 6: Obsidian 插件——wikilink / 圖片嵌入 / 註解（TDD）

**Files:**

- Create: `src/plugins/obsidian.ts`
- Test: `tests/obsidian.test.mjs`

**Interfaces:**

- Produces: `export default function ObsidianPlugin(md: MarkdownIt): void`（Task 8 註冊用；Task 7 在同檔擴充 callout 與 front matter）

- [ ] **Step 1: 失敗測試**

`tests/obsidian.test.mjs`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'

const md = async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  return new MarkdownIt({ html: true }).use(ObsidianPlugin)
}

test('renders image embeds with spaces and width', async () => {
  const m = await md()
  const html = m.render('![[Pasted image 20260829.png]]')
  assert.match(html, /<img src="Pasted%20image%2020260829\.png"/)
  const sized = m.render('![[chart.PNG|300]]')
  assert.match(sized, /<img src="chart\.PNG" width="300"/)
})

test('renders wikilinks, appending .md when extension missing', async () => {
  const m = await md()
  assert.match(
    m.render('[[Meeting Notes]]'),
    /<a href="Meeting%20Notes\.md">Meeting Notes<\/a>/,
  )
  assert.match(
    m.render('[[guide.md|安裝指南]]'),
    /<a href="guide\.md">安裝指南<\/a>/,
  )
})

test('note embeds degrade to links', async () => {
  const m = await md()
  assert.match(
    m.render('![[Other Note]]'),
    /<a href="Other%20Note\.md"[^>]*>Other Note<\/a>/,
  )
})

test('strips %% comments %%', async () => {
  const m = await md()
  const html = m.render('before %%hidden\nlines%% after')
  assert.ok(!html.includes('hidden'))
  assert.match(html, /before\s+after/)
})

test('escapes html in wikilink text', async () => {
  const m = await md()
  const html = m.render('[[a<b]]')
  assert.ok(!html.includes('<b]]'))
  assert.match(html, /a&lt;b/)
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/obsidian.test.mjs`
Expected: FAIL（Cannot find module）

- [ ] **Step 3: 實作**

`src/plugins/obsidian.ts`：

```ts
import type MarkdownIt from 'markdown-it'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline'
import type StateCore from 'markdown-it/lib/rules_core/state_core'

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|svg|webp|bmp)$/i
const HAS_EXT_RE = /\.[a-z0-9]+$/i

function encodePath(target: string): string {
  // 保留 / 作路徑分隔，其餘（含空格）編碼
  return target.split('/').map(encodeURIComponent).join('/')
}

/** [[target|alias]] 與 ![[target|size]] 的 inline rule */
function wikilink(state: StateInline, silent: boolean): boolean {
  const src = state.src
  let pos = state.pos
  const isEmbed = src.charCodeAt(pos) === 0x21 /* ! */
  const start = isEmbed ? pos + 1 : pos
  if (src.slice(start, start + 2) !== '[[') return false
  const end = src.indexOf(']]', start + 2)
  if (end === -1) return false
  const inner = src.slice(start + 2, end)
  if (!inner || inner.includes('[[') || inner.includes('\n')) return false

  if (!silent) {
    const [target, extra] = splitOnce(inner, '|')
    if (isEmbed && IMAGE_EXT_RE.test(target)) {
      const token = state.push('image', 'img', 0)
      token.attrs = [
        ['src', encodePath(target)],
        ['alt', ''],
      ]
      if (extra && /^\d+$/.test(extra)) token.attrs.push(['width', extra])
      token.children = []
    } else {
      const href = HAS_EXT_RE.test(target) ? target : `${target}.md`
      const open = state.push('link_open', 'a', 1)
      open.attrs = [['href', encodePath(href)]]
      if (isEmbed) open.attrs.push(['class', 'md-reader__embed-link'])
      const text = state.push('text', '', 0)
      text.content = extra || target
      state.push('link_close', 'a', -1)
    }
  }
  state.pos = end + 2
  return true
}

function splitOnce(value: string, sep: string): [string, string | null] {
  const idx = value.indexOf(sep)
  return idx === -1
    ? [value.trim(), null]
    : [value.slice(0, idx).trim(), value.slice(idx + 1).trim()]
}

/** 移除 %%...%% 註解（在 normalize 之後、block 解析之前） */
function stripComments(state: StateCore): void {
  state.src = state.src.replace(/%%[\s\S]*?%%/g, '')
}

export default function ObsidianPlugin(md: MarkdownIt): void {
  md.core.ruler.after('normalize', 'obsidian_comments', stripComments)
  md.inline.ruler.before('link', 'obsidian_wikilink', wikilink)
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/obsidian.test.mjs`
Expected: PASS（5 tests）。若 `a<b` 測試失敗，確認 text token 是走 markdown-it 預設 renderer（自動 escape），不要自行拼 HTML。

- [ ] **Step 5: Commit**

```bash
git add src/plugins/obsidian.ts tests/obsidian.test.mjs
git commit -m "feat: add Obsidian syntax plugin (wikilinks, image embeds, comments)

Why: team docs are authored in Obsidian; without this plugin
![[image.png]] and [[note]] render as literal text. The inline rule
handles [[target|alias]] links (auto-appending .md when the target has
no extension), ![[img|300]] image embeds with width, note embeds
degrading to links (transclusion is an explicit non-goal in the spec),
and %%...%% comments are stripped in a core rule before block parsing.
Text goes through markdown-it token renderers so HTML escaping is
preserved.

Scope: new markdown-it plugin + unit tests. Not registered yet."
```

---

### Task 7: Obsidian 插件——callout 正規化與 front matter 表格（TDD）

**Files:**

- Modify: `src/plugins/obsidian.ts`
- Modify: `src/core/markdown.ts`
- Test: `tests/obsidian.test.mjs`（追加）
- Modify: `src/style/index.less`（front matter 樣式）

**Interfaces:**

- Consumes: `@mdit/plugin-alert` 已由 `Alert` 插件處理 `> [!NOTE]` 等 GitHub 型別（見 `src/plugins/alert.ts`）
- Produces: `mdRender` 行為變更——`plugins` 含 `'Obsidian'` 時不預剝 front matter，改由插件渲染 `<details class="md-reader__frontmatter">`

- [ ] **Step 1: 追加失敗測試**

`tests/obsidian.test.mjs` 追加：

```js
test('normalizes obsidian callouts to alert-compatible form', async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  // 未知型別 → NOTE；摺疊記號去除；自訂標題移到粗體行
  const html = m.render('> [!hint]- My Title\n> body')
  assert.match(html, /\[!TIP\]|markdown-alert|blockquote/i)
  assert.match(html, /<strong>My Title<\/strong>/)
})

test('renders front matter as collapsed details table', async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('---\ntitle: Hello\ntags: a, b\n---\n\n# Doc')
  assert.match(html, /<details class="md-reader__frontmatter">/)
  assert.match(html, /<td>title<\/td>\s*<td>Hello<\/td>/)
  assert.match(html, /<h1[^>]*>Doc<\/h1>/)
})

test('front matter requires document start', async () => {
  const { default: ObsidianPlugin } = await import('../src/plugins/obsidian.ts')
  const m = new MarkdownIt({ html: true }).use(ObsidianPlugin)
  const html = m.render('# Doc\n\n---\nnot: frontmatter\n---')
  assert.ok(!html.includes('md-reader__frontmatter'))
})
```

說明：callout 測試不掛 Alert 插件，斷言正規化後至少產生 blockquote 與粗體標題；型別映射的完整驗證放在手動驗收（Alert 插件掛載時 `[!TIP]` 會渲染成 alert 區塊）。

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/obsidian.test.mjs`
Expected: 新增 3 條 FAIL

- [ ] **Step 3: 實作 callout 正規化與 front matter**

`src/plugins/obsidian.ts` 追加：

```ts
const CALLOUT_TYPE_MAP: Record<string, string> = {
  note: 'NOTE',
  info: 'NOTE',
  todo: 'NOTE',
  abstract: 'NOTE',
  summary: 'NOTE',
  tldr: 'NOTE',
  question: 'NOTE',
  help: 'NOTE',
  faq: 'NOTE',
  quote: 'NOTE',
  cite: 'NOTE',
  example: 'NOTE',
  tip: 'TIP',
  hint: 'TIP',
  success: 'TIP',
  check: 'TIP',
  done: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'WARNING',
  attention: 'WARNING',
  danger: 'CAUTION',
  error: 'CAUTION',
  bug: 'CAUTION',
  failure: 'CAUTION',
  fail: 'CAUTION',
  missing: 'CAUTION',
}
const GITHUB_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
const CALLOUT_LINE_RE = /^(\s*>\s*)\[!(\w+)\]([+-]?)(?:[ \t]+(.+))?$/gm

/** Obsidian callout → GitHub alert 語法（Alert 插件可接手渲染） */
function normalizeCallouts(state: StateCore): void {
  state.src = state.src.replace(
    CALLOUT_LINE_RE,
    (_, prefix, rawType, _fold, title) => {
      const upper = rawType.toUpperCase()
      const mapped = GITHUB_TYPES.includes(upper)
        ? upper
        : CALLOUT_TYPE_MAP[rawType.toLowerCase()] || 'NOTE'
      const head = `${prefix}[!${mapped}]`
      return title ? `${head}\n${prefix}**${title.trim()}**` : head
    },
  )
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---\r?\n/

/** 文件開頭的 YAML front matter → 摺疊表格（html_block token 置頂） */
function renderFrontmatter(md: MarkdownIt, state: StateCore): void {
  const match = state.src.match(FRONTMATTER_RE)
  if (!match) return
  state.src = state.src.slice(match[0].length)
  const esc = md.utils.escapeHtml
  const rows = match[1]
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => {
      const idx = line.indexOf(':')
      const key = idx === -1 ? '' : line.slice(0, idx).trim()
      const value = idx === -1 ? line.trim() : line.slice(idx + 1).trim()
      return `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`
    })
    .join('')
  state.env.frontmatterHtml =
    `<details class="md-reader__frontmatter"><summary>Metadata</summary>` +
    `<table><tbody>${rows}</tbody></table></details>\n`
}

// ObsidianPlugin 內（既有兩行 ruler 註冊之後）追加：
//   md.core.ruler.after('normalize', 'obsidian_callouts', normalizeCallouts)
//   md.core.ruler.after('normalize', 'obsidian_frontmatter', s =>
//     renderFrontmatter(md, s))
//   const render = md.render.bind(md)
//   md.render = (src, env) => {
//     const e = env || {}
//     const html = render(src, e)
//     return e.frontmatterHtml ? e.frontmatterHtml + html : html
//   }
```

（實作時把註解中的程式放入 `ObsidianPlugin` 函式本體；core rule 執行順序：comments → callouts → frontmatter，皆在 `normalize` 之後依註冊順序執行。）

`src/core/markdown.ts` 修改 `mdRender`：

```ts
export const mdRender: MdRender = (code, options): string => {
  if (!mdRender.md || options) {
    mdRender.md = initRender(options)
    mdRender.obsidian = (options?.plugins ?? [...MD_PLUGINS]).includes(
      'Obsidian',
    )
  }
  // Obsidian 插件自行將 frontmatter 渲染為表格；未啟用時維持原本剝除行為
  const filteredCode = mdRender.obsidian ? code : removeFrontmatter(code)
  return mdRender.md.render(filteredCode)
}
```

並將 `interface MdRender` 加上 `obsidian?: boolean`。

`src/style/index.less` 的 `.md-reader__markdown-content` 區塊（`.theme();` 之後）加入：

```less
.md-reader__frontmatter {
  margin-bottom: 1.2em;
  font-size: 0.88em;
  opacity: 0.92;
  summary {
    cursor: pointer;
    font-weight: bolder;
  }
  table {
    margin-top: 0.5em;
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs`
Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/plugins/obsidian.ts src/core/markdown.ts src/style/index.less tests/obsidian.test.mjs
git commit -m "feat: obsidian callout normalization and front matter table

Why: Obsidian callouts extend GitHub alert syntax with custom titles,
fold markers and extra types the existing Alert plugin does not
recognize. A core rule rewrites them to the five GitHub types (unknown
types map to NOTE, titles become a bold first line) so @mdit/plugin-
alert renders them when enabled and they degrade to plain blockquotes
when it is not. Front matter switches from being silently stripped to
a collapsed metadata table (parity with store version 3.6.23) -- only
when the Obsidian plugin is active, so default rendering is unchanged.

Scope: plugin core rules + mdRender frontmatter gating + styles."
```

---

### Task 8: 註冊 Obsidian 插件（設定清單、renderer、popup chips、locale）

**Files:**

- Modify: `src/config/md-plugins.ts`
- Modify: `src/core/markdown.ts`（PLUGINS 表）
- Modify: `src/config/i18n/locale.json`（`Obsidian` label）

**Interfaces:**

- Consumes: `ObsidianPlugin`（Task 6/7）
- Produces: `mdPlugins` 含 `'Obsidian'` 時插件生效；popup chips 自動出現（chips 迭代 `MD_PLUGINS`，無需改 svelte）

- [ ] **Step 1: 註冊**

`src/config/md-plugins.ts` 陣列尾端加 `'Obsidian',`。

`src/core/markdown.ts`：import 區加 `import mObsidian from '@/plugins/obsidian'`；`PLUGINS` 表加 `Obsidian: [mObsidian],`。

`locale.json`：`en` 加 `"Obsidian": "Obsidian"`；`zh-CN` 加 `"Obsidian": "Obsidian 语法"`；`zh-TW` 加 `"Obsidian": "Obsidian 語法"`。

- [ ] **Step 2: 全測試 + 建置**

Run: `node --test tests/obsidian.test.mjs tests/dir-listing.test.mjs tests/graphviz.test.mjs && node_modules/.bin/tsc --noEmit && export npm_package_version=2.12.12 && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js 2>&1 | tail -3`
Expected: 測試全 PASS、建置成功

- [ ] **Step 3: Commit**

```bash
git add src/config/md-plugins.ts src/core/markdown.ts src/config/i18n/locale.json
git commit -m "feat: register Obsidian plugin as a toggleable md plugin

Why: wiring the plugin through MD_PLUGINS makes it a first-class,
user-toggleable renderer option: the popup chips iterate MD_PLUGINS so
the switch appears automatically, defaults to enabled for new installs,
and flows through the existing updateMdPlugins live-rerender path.

Scope: plugin registry entries + locale label. No new UI code."
```

---

### Task 9: 手動驗收、打包與文件

**Files:**

- Modify: `example/README.md`（追加 Obsidian 語法示例段落，作驗收素材）
- 產出: `dist/md-reader-2.12.12.zip`

**Interfaces:**

- Consumes: 全部前置 Task

- [ ] **Step 1: 驗收素材**

`example/README.md` 檔尾追加一段（若該檔不存在，改放 `example/obsidian-demo.md` 新檔）：

```markdown
## Obsidian syntax demo

![[demo image.png|200]]

Link to [[README]] and aliased [[README|首頁]].

%% this comment must not render %%

> [!hint]- Folding hint
> Callout body

---

（檔案開頭另建一個含 `title: Demo` front matter 的 `example/obsidian-demo.md` 一併驗證表格渲染）
```

- [ ] **Step 2: 建置 + 打包**

```bash
export npm_package_version=2.12.12
node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js && node ./scripts/zip.mjs
```

Expected: `dist/md-reader-2.12.12.zip` 產出

- [ ] **Step 3: 手動驗收清單（兩種來源都要跑）**

A. `python3 -m http.server 8000 --directory example`，開 `http://localhost:8000/obsidian-demo.md`：

- [ ] 側邊欄有「大綱/檔案」頁籤；檔案頁籤列出同層 md、不含非 md 檔
- [ ] 子資料夾第一次點擊展開時才發請求（DevTools Network 佐證）、第二次點擊收合
- [ ] `../` 導覽正常；目前檔案高亮
- [ ] Obsidian：圖片嵌入（含寬度）、wikilink、`%%註解%%` 不顯示、callout 渲染為 alert、front matter 摺疊表格
- [ ] popup 關「資料夾目錄」→ 頁籤即時消失；關「Obsidian 語法」chip → 語法回到原文
      B. 以 `file:///.../example/obsidian-demo.md` 開啟（確認「允許存取檔案網址」已開）：
- [ ] 檔案頁籤可列出目錄（背景抓取或 fallback 途徑皆可）；其餘同上
- [ ] 若 file:// 目錄清單兩條途徑皆不可行：記錄實測結果，檔案頁籤應顯示「無法取得目錄列表」而非壞樹（此為 spec 的可接受降級），並在 commit message 記載 spike 結論
      C. 斷網（關 Wi-Fi）重跑 A 的任一頁面：
- [ ] 渲染與樹功能完全正常（無外部資源請求）

- [ ] **Step 4: Commit（含 spike 結論）**

```bash
git add example/
git commit -m "docs: add obsidian syntax demo page for acceptance testing

Why: gives the manual acceptance checklist a stable fixture covering
every Obsidian construct plus the folder tree (the example dir now has
a subdirectory + multiple md files to exercise lazy expand).

Spike result (spec 2026-08-29): <record here whether MV3 service
worker fetch of file:// directories worked, whether the content-script
fallback was needed, and the observed Chrome listing format>.

Scope: example fixtures only."
```

---

## Self-Review 紀錄

- **Spec coverage**：懶加載樹（T1-T3）、`../` 導覽與高亮（T3）、頁籤 UI（T4）、folderTree 開關（T5）、file://+http 雙來源與 fallback（T2、T9-B）、只列 md（T1）、Obsidian 六項語法（T6/T7；`==螢光==` 既有 Mark 插件、無需實作，spec 已註明）、front matter 表格（T7）、錯誤處理訊息與單節點重試（T3）、離線驗證（T9-C）、測試三層（T1/T6/T7 單元、T9 手動）、git 流程（每 Task 一 commit、why 齊備）——皆有對應。
- **Placeholder scan**：Task 9 commit message 的 `<record here ...>` 為刻意留給執行者的實測欄位，非未完成設計；其餘無 TBD。
- **Type consistency**：`DirEntry`/`parseDirListing`/`fetchDirListing`/`createFileTree`/`toggleFolderTree`/`ObsidianPlugin` 於各 Task 的 Interfaces 區塊簽名一致。
