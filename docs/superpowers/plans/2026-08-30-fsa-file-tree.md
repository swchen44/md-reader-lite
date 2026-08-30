# 案 C：FSA file:// 目錄樹 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** file:// 頁的檔案頁籤透過 File System Access API 提供完整目錄樹（引導授權 → IDB 持久化 → 懶加載樹；重啟一鍵重授權），http(s) 零變動。

**Architecture:** core 純函式（URL/segment 映射 + entries 轉換）；shell 三新檔（fsa-store IDB、fsa-listing lister/權限、main 的 filesPanel wrapper 三態流程）；file-tree 僅加 `listDir`/`onRootStatus` 兩個 option。

**Tech Stack:** 同前案；FSA ambient 型別比照 search-panel 的 Highlight 手法。

## Global Constraints

- 分支：`feature/fsa-file-tree`（spec 已在其上）。
- http(s) 行為零變動；file:// 判定順序＝先 `fetchDirListing` 探測、失敗才進 FSA。
- 映射：候選由深至淺 + 零匹配 fallback `{rootDir: [], remainder: 全段}`；`urlToDirPath` 過濾空段；範圍判定 = `dirUrl.startsWith(rootDirUrl)`；範圍外不清 IDB。
- 無樹時檔案模式搜尋停用（openSearch 開頭 guard）。
- 測試全量 = fsa-path(11) + doc-search(13) + obsidian(18) + dir-listing(6) + graphviz(6) = 54。
- 建置：`export npm_package_version=1.0.3 npm_package_name=md-reader-lite && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js`。
- Commit 四段 + trailers（Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> ／ Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR）。Subagent 一律 sonnet。
- 表格/文件中不得裸寫 `|` 於儲存格（lesson 8.5）。

## File Structure

| 檔案                                               | 動作 | 職責                                                                                         |
| -------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `src/core/fsa-path.ts`                             | 新增 | `urlToDirPath`/`rootPathCandidates`/`resolveByCandidates`/`entriesToDirEntries`              |
| `tests/fsa-path.test.mjs`                          | 新增 | 11 條單元測試                                                                                |
| `src/core/fsa-store.ts`                            | 新增 | IDB `saveGrant`/`loadGrant`/`clearGrant`                                                     |
| `src/core/fsa-listing.ts`                          | 新增 | `createFsaLister`、`verifyPermission`、`pickDirectory`、FSA ambient 型別                     |
| `src/core/file-tree.ts`                            | 修改 | options 加 `listDir?`、`onRootStatus?`                                                       |
| `src/main.ts`                                      | 修改 | filesPanel wrapper、三態流程、openSearch guard、呼叫點改接 wrapper                           |
| `src/config/class-name.ts`、`src/style/index.less` | 修改 | FILES_PANEL/FSA_PANEL/FSA_BUTTON/FSA_HINT + 樣式 + 三處 transform selector 補 `&__fsa-panel` |
| `src/config/i18n/locale.json`                      | 修改 | 4 key ×3 語系                                                                                |
| `PRIVACY.md`、`docs/plans.md`、`docs/designs.md`   | 修改 | 隱私一句 + 索引（Task 4）                                                                    |

---

### Task 1: fsa-path 純函式（TDD）

**Files:**

- Create: `src/core/fsa-path.ts`
- Test: `tests/fsa-path.test.mjs`

**Interfaces:**

- Produces（後續任務依賴）:

  - `urlToDirPath(url: string): string[]`——file:// URL → 目錄 segments（去檔名〔最後一段含 `.` 視為檔名——目錄 URL 以 `/` 結尾則無檔名〕、去 query/hash、decodeURIComponent、過濾空段）。約定：輸入為**目錄 URL（尾斜線）或檔案 URL**皆可。
  - `interface RootCandidate { rootDir: string[]; remainder: string[] }`
  - `rootPathCandidates(rootName: string, dirSegments: string[]): RootCandidate[]`——名稱相等的 i 由深至淺 + 末尾 fallback `{rootDir: [], remainder: dirSegments}`（**永遠**附加 fallback，含有匹配時）。
  - `interface DirHandleLike { getDirectoryHandle(name: string): Promise<DirHandleLike> }`
  - `resolveByCandidates(root: DirHandleLike, candidates: RootCandidate[]): Promise<RootCandidate | null>`
  - `interface FsEntryLike { name: string; kind: 'file' | 'directory' }`
  - `entriesToDirEntries(items: FsEntryLike[], dirUrl: string): DirEntry[]`（import type DirEntry from '@/core/dir-listing'）——保留 directory 與 `isMarkdownFile(name)`；排序：資料夾先、各組內 `localeCompare`；url = dirUrl + encodeURIComponent(name)（目錄加尾 `/`）。

- [ ] **Step 1: 失敗測試**

`tests/fsa-path.test.mjs`：

```js
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
```

（共 7 個 test 區塊、11+ 斷言組——Global Constraints 的 11 指斷言涵蓋面，以檔案全綠為準。）

- [ ] **Step 2: RED** — `node --test tests/fsa-path.test.mjs` 全 FAIL

- [ ] **Step 3: 實作 `src/core/fsa-path.ts`**

```ts
import { isMarkdownFile, type DirEntry } from '@/core/dir-listing'

export interface RootCandidate {
  rootDir: string[]
  remainder: string[]
}

export interface DirHandleLike {
  getDirectoryHandle(name: string): Promise<DirHandleLike>
}

export interface FsEntryLike {
  name: string
  kind: 'file' | 'directory'
}

/** file:// URL → 目錄 path segments（去檔名/query/hash、decode、無空段） */
export function urlToDirPath(url: string): string[] {
  const clean = url.replace(/[?#].*$/, '')
  const path = clean.replace(/^file:\/\//, '')
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (!clean.endsWith('/') && segments.length) {
    const last = segments[segments.length - 1]
    if (last.includes('.')) segments.pop()
  }
  return segments
}

/** 名稱匹配候選（深→淺）+ 恆附零匹配 fallback */
export function rootPathCandidates(
  rootName: string,
  dirSegments: string[],
): RootCandidate[] {
  const candidates: RootCandidate[] = []
  for (let i = dirSegments.length - 1; i >= 0; i--) {
    if (dirSegments[i] === rootName) {
      candidates.push({
        rootDir: dirSegments.slice(0, i + 1),
        remainder: dirSegments.slice(i + 1),
      })
    }
  }
  candidates.push({ rootDir: [], remainder: dirSegments.slice() })
  return candidates
}

/** 依序以 handle 走訪驗證候選；全敗回 null */
export async function resolveByCandidates(
  root: DirHandleLike,
  candidates: RootCandidate[],
): Promise<RootCandidate | null> {
  for (const candidate of candidates) {
    try {
      let dir = root
      for (const seg of candidate.remainder) {
        dir = await dir.getDirectoryHandle(seg)
      }
      return candidate
    } catch {
      /* 試下一個候選 */
    }
  }
  return null
}

/** FSA entries → DirEntry（過濾 md/資料夾、資料夾先、字典序、URL 編碼） */
export function entriesToDirEntries(
  items: FsEntryLike[],
  dirUrl: string,
): DirEntry[] {
  const dirs = items.filter(i => i.kind === 'directory')
  const files = items.filter(i => i.kind === 'file' && isMarkdownFile(i.name))
  const byName = (a: FsEntryLike, b: FsEntryLike) =>
    a.name.localeCompare(b.name)
  dirs.sort(byName)
  files.sort(byName)
  return [
    ...dirs.map(d => ({
      name: d.name,
      isDir: true,
      url: dirUrl + encodeURIComponent(d.name) + '/',
    })),
    ...files.map(f => ({
      name: f.name,
      isDir: false,
      url: dirUrl + encodeURIComponent(f.name),
    })),
  ]
}
```

- [ ] **Step 4: GREEN + 迴歸 + Commit** — fsa-path 全綠；全量 54；tsc 乾淨。

```
feat: add FSA path mapping and entry conversion helpers

Why: the File System Access root handle exposes only a name, so
mapping the picked folder onto the current file:// URL needs a
candidate-walk algorithm, and directory entries need a deterministic
DirEntry conversion — both pure and unit-testable.
What: urlToDirPath (decode, filename/query/hash strip, no empty
segments), rootPathCandidates (deep-first name matches plus an
always-appended zero-match fallback), resolveByCandidates over a
structural DirHandleLike, and entriesToDirEntries (markdown/dir
filter, dirs-first localeCompare sort, encoded URLs); seven test
blocks cover decode, multi-match ordering, fallback-only, walk
failover, empty remainder, sorting/encoding and dot-file handling.
How: structural typing keeps the core layer free of DOM lib types.
Boundary: core module + tests; no consumers yet.
```

---

### Task 2: fsa-store + fsa-listing + file-tree options

**Files:**

- Create: `src/core/fsa-store.ts`、`src/core/fsa-listing.ts`
- Modify: `src/core/file-tree.ts`（僅 options）

**Interfaces:**

- Consumes: Task 1 全部；`DirEntry`。
- Produces（Task 3 依賴）:

  - fsa-store：`saveGrant(g: { handle: unknown; rootDirUrl: string }): Promise<void>`、`loadGrant(): Promise<{ handle: unknown; rootDirUrl: string } | null>`、`clearGrant(): Promise<void>`
  - fsa-listing：`pickDirectory(): Promise<FsaDirectoryHandle>`（含 ambient 型別）、`verifyPermission(handle): Promise<PermissionState>`、`requestPermission(handle): Promise<PermissionState>`、`createFsaLister(root: FsaDirectoryHandle, rootDirUrl: string): (dirUrl: string) => Promise<DirEntry[]>`
  - file-tree：`FileTreeOptions` 增 `listDir?: (dirUrl: string) => Promise<DirEntry[]>`（預設 `fetchDirListing`）、`onRootStatus?: (s: 'ok' | 'error') => void`（根載入 then 成功且非空發 'ok'；catch 或空清單發 'error'）

- [ ] **Step 1: `src/core/fsa-store.ts`**

```ts
/** FSA 授權（root handle + 對應 rootDirUrl）的 IndexedDB 持久化。 */
const DB_NAME = 'md-reader-lite'
const STORE = 'fsa'
const KEY = 'root'

export interface FsaGrant {
  handle: unknown
  rootDirUrl: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveGrant(grant: FsaGrant): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(grant, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadGrant(): Promise<FsaGrant | null> {
  try {
    const db = await openDb()
    const grant = await new Promise<FsaGrant | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return grant
  } catch {
    return null // IDB 不可用時降級為不持久（spec 錯誤處理）
  }
}

export async function clearGrant(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* 無可清 */
  }
}
```

- [ ] **Step 2: `src/core/fsa-listing.ts`**

```ts
import { entriesToDirEntries, type FsEntryLike } from '@/core/fsa-path'
import type { DirEntry } from '@/core/dir-listing'

/* TS 4.8 lib 無 File System Access API 型別；最小 ambient 宣告 */
export interface FsaDirectoryHandle {
  readonly name: string
  readonly kind: 'directory'
  getDirectoryHandle(name: string): Promise<FsaDirectoryHandle>
  entries(): AsyncIterable<
    [string, { name: string; kind: 'file' | 'directory' }]
  >
  queryPermission(desc: { mode: 'read' }): Promise<PermissionState>
  requestPermission(desc: { mode: 'read' }): Promise<PermissionState>
}
declare function showDirectoryPicker(opts: {
  mode: 'read'
}): Promise<FsaDirectoryHandle>

export function isFsaSupported(): boolean {
  return typeof showDirectoryPicker === 'function'
}

export function pickDirectory(): Promise<FsaDirectoryHandle> {
  return showDirectoryPicker({ mode: 'read' })
}

export function verifyPermission(
  handle: FsaDirectoryHandle,
): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'read' })
}

export function requestPermission(
  handle: FsaDirectoryHandle,
): Promise<PermissionState> {
  return handle.requestPermission({ mode: 'read' })
}

/** dirUrl（rootDirUrl 範圍內）→ handle 走訪 → DirEntry[] */
export function createFsaLister(
  root: FsaDirectoryHandle,
  rootDirUrl: string,
): (dirUrl: string) => Promise<DirEntry[]> {
  return async dirUrl => {
    if (!dirUrl.startsWith(rootDirUrl)) {
      throw new Error('directory outside granted root')
    }
    const rel = dirUrl
      .slice(rootDirUrl.length)
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent)
    let dir = root
    for (const seg of rel) {
      dir = await dir.getDirectoryHandle(seg)
    }
    const items: FsEntryLike[] = []
    for await (const [, h] of dir.entries()) {
      items.push({ name: h.name, kind: h.kind })
    }
    return entriesToDirEntries(items, dirUrl)
  }
}
```

- [ ] **Step 3: file-tree options**

`FileTreeOptions` 加：

```ts
  listDir?: (dirUrl: string) => Promise<DirEntry[]>
  onRootStatus?: (status: 'ok' | 'error') => void
```

createFileTree 內：`const listDir = opts.listDir ?? fetchDirListing`；`loadDir` 改呼叫 `listDir(dirUrl)`；根載入 `.then`：非空 → 原渲染後 `opts.onRootStatus?.('ok')`；空清單 → 原訊息後 `opts.onRootStatus?.('error')`；`.catch` → 原訊息後 `opts.onRootStatus?.('error')`。（參數取得方式依現行解構風格最小調整。）

- [ ] **Step 4: 驗證 + Commit** — 全量 54、tsc、建置。

```
feat: add FSA grant store, lister and file-tree injection points

Why: the FSA tree needs handle persistence (IndexedDB is the
platform-documented mechanism for FileSystemHandle), a lister that
adapts handle traversal to the tree's DirEntry contract, and a way
for the tree to signal root-load failure outward so the controller
can fall back to the grant panel.
What: fsa-store (single-grant IDB save/load/clear with unavailable-
IDB degradation), fsa-listing (ambient FSA types, pick/permission
helpers, scope-checked lister feeding entriesToDirEntries), and two
new file-tree options — listDir injection defaulting to
fetchDirListing, and onRootStatus fired from the root render paths.
How: lister rejects out-of-scope URLs so navigation outside the
granted root degrades explicitly rather than erroring deep in handle
walks.
Boundary: no behavior change for existing http(s) trees (default
listDir preserved); nothing consumes the new modules yet.
```

---

### Task 3: main.ts filesPanel 三態流程 + 樣式 + locale

**Files:**

- Modify: `src/main.ts`、`src/config/class-name.ts`、`src/style/index.less`、`src/config/i18n/locale.json`

**Interfaces:**

- Consumes: Task 1/2 全部 export；main 既有 `activateTab`/`openSearch`/`closeSearch`/raw 清單/`fileTree`。

- [ ] **Step 1: class 常數**（TREE_FILTER_HINT 之後）

```ts
  FILES_PANEL: p`files-panel`,
  FSA_PANEL: p`fsa-panel`,
  FSA_BUTTON: p`fsa-button`,
  FSA_HINT: p`fsa-hint`,
```

- [ ] **Step 2: 樣式**（`&__file-tree` 區塊後同級新增；並把 `.side-collapsed`、`.side-expanded`、`@media 960px` 三組 selector 逗號補上 `&__fsa-panel`）

```less
&__fsa-panel {
  overflow: auto;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: @side-width;
  padding: 70px 1.2em 22px;
  border-right: 1px solid var(--color-side-border);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-side);
  background: var(--color-side-bg);
  transition: transform 0.3s;
  z-index: 1;
  .md-reader__fsa-button {
    display: block;
    width: 100%;
    padding: 8px 10px;
    margin: 0.8em 0;
    border: 1px solid var(--color-primary);
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-primary);
    background: transparent;
    font-size: 13px;
    &:hover {
      color: #fff;
      background: var(--color-primary);
    }
  }
  .md-reader__fsa-hint {
    opacity: 0.65;
    font-size: 12px;
  }
}
```

- [ ] **Step 3: locale ×3**
- en: `"fsa_pick_button": "Choose folder to enable the tree"`、`"fsa_pick_hint": "Pick the current file's folder or any of its ancestors. Read-only access, stored locally."`、`"fsa_regrant_button": "Re-authorize folder access"`、`"fsa_mismatch": "That folder does not contain the current file. Pick its folder or an ancestor."`
- zh-CN: `"选择文件夹以启用目录树"`、`"请选择当前文件所在的文件夹或其上层。只读访问，仅存于本机。"`、`"重新授权文件夹访问"`、`"所选文件夹不包含当前文件，请选择其所在文件夹或上层。"`
- zh-TW: `"選擇資料夾以啟用目錄樹"`、`"請選擇目前檔案所在的資料夾或其上層。唯讀存取，僅存於本機。"`、`"重新授權資料夾存取"`、`"所選資料夾不包含目前檔案，請選擇其所在資料夾或上層。"`

- [ ] **Step 4: main.ts 重構與流程**

a. import：`createFsaLister, isFsaSupported, pickDirectory, requestPermission, verifyPermission, type FsaDirectoryHandle`（fsa-listing）、`clearGrant, loadGrant, saveGrant`（fsa-store）、`resolveByCandidates, rootPathCandidates, urlToDirPath`（fsa-path）、`fetchDirListing`（dir-fetch）、`dirOf`（file-tree 已 export）。

b. **filesPanel wrapper**：`fileTree` 附近宣告

```ts
let filesPanel: Ele<HTMLElement> | null = null
function ensureFilesPanel(): Ele<HTMLElement> {
  if (!filesPanel) {
    filesPanel = new Ele<HTMLElement>('div', {
      className: className.FILES_PANEL,
    })
    lifecycle.mount([filesPanel])
    void initFilesContent()
  }
  return filesPanel
}
```

c. **呼叫點改接 wrapper**（逐點 grep `fileTree`）：

- `activateTab`：`if (isFiles) ensureFilesPanel()`；原「lazy 建樹」邏輯移入 initFilesContent；`fileTree?.tree.toggle(isFiles)` → `filesPanel?.toggle(isFiles)`
- `openSearch` 檔案模式的 `fileTree?.tree.hide()` 相關：不需（檔案模式樹保持可見——維持現行為，但 hide 呼叫點若存在改 `filesPanel?.hide()` 對應 outline 模式原語意）
- raw 清單：`if (fileTree) eles.push(fileTree.tree)` → `if (filesPanel) eles.push(filesPanel)`
- `openSearch()` 開頭 guard：`if (activeTab === 'files' && !fileTree) return`

d. **三態流程**：

```ts
async function initFilesContent() {
  const panel = filesPanel!
  const rootDir = dirOf(window.location.href.replace(/[?#].*$/, ''))
  const isFile = rootDir.startsWith('file:')
  try {
    await fetchDirListing(rootDir) // 探測：http 及老 Chromium 成功
    buildTree(undefined)
    return
  } catch {
    if (!isFile || !isFsaSupported()) {
      buildTree(undefined) // 維持原降級（樹內 dir_error 訊息）
      return
    }
  }
  const grant = (await loadGrant()) as {
    handle: FsaDirectoryHandle
    rootDirUrl: string
  } | null
  if (grant && rootDir.startsWith(grant.rootDirUrl)) {
    const state = await verifyPermission(grant.handle).catch(() => 'denied')
    if (state === 'granted') {
      buildTree(createFsaLister(grant.handle, grant.rootDirUrl))
      return
    }
    if (state === 'prompt') {
      showFsaPanel('regrant', grant)
      return
    }
    await clearGrant()
  }
  showFsaPanel('guide', null)
}

function buildTree(listDir?: (u: string) => Promise<DirEntry[]>) {
  const panel = filesPanel!
  panel.innerHTML = null
  fileTree = createFileTree({
    currentUrl: window.location.href,
    localize,
    listDir,
    onRootStatus: status => {
      if (status === 'error' && listDir) {
        // FSA root 失效：清授權、回引導面板
        void clearGrant()
        fileTree = null
        showFsaPanel('guide', null)
      }
    },
  })
  panel.append(fileTree.tree)
}

function showFsaPanel(
  kind: 'guide' | 'regrant',
  grant: { handle: FsaDirectoryHandle; rootDirUrl: string } | null,
  message?: string,
) {
  const panel = filesPanel!
  panel.innerHTML = null
  const box = new Ele<HTMLElement>('div', { className: className.FSA_PANEL })
  if (message) {
    const msg = new Ele<HTMLElement>('div', { className: className.FSA_HINT })
    msg.textContent = message
    box.append(msg)
  }
  const btn = new Ele<HTMLElement>('button', {
    className: className.FSA_BUTTON,
  })
  btn.textContent = localize(
    kind === 'guide' ? 'fsa_pick_button' : 'fsa_regrant_button',
  )
  const hint = new Ele<HTMLElement>('div', { className: className.FSA_HINT })
  hint.textContent = localize('fsa_pick_hint')
  btn.on('click', async () => {
    if (kind === 'regrant' && grant) {
      const state = await requestPermission(grant.handle).catch(() => 'denied')
      if (state === 'granted') {
        buildTree(createFsaLister(grant.handle, grant.rootDirUrl))
      } else {
        await clearGrant()
        showFsaPanel('guide', null)
      }
      return
    }
    try {
      const handle = await pickDirectory()
      const dirSegs = urlToDirPath(window.location.href)
      const resolved = await resolveByCandidates(
        handle,
        rootPathCandidates(handle.name, dirSegs),
      )
      if (!resolved) {
        showFsaPanel('guide', null, localize('fsa_mismatch'))
        return
      }
      const rootDirUrl =
        'file:///' +
        resolved.rootDir.map(encodeURIComponent).join('/') +
        (resolved.rootDir.length ? '/' : '')
      await saveGrant({ handle, rootDirUrl })
      buildTree(createFsaLister(handle, rootDirUrl))
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return // 取消：靜默
      showFsaPanel('guide', null, String((err as Error)?.message || err))
    }
  })
  box.append(btn)
  box.append(hint)
  panel.append(box)
}
```

（`DirEntry` 型別 import 自 `@/core/dir-listing`；activateTab 原有「首次建樹」程式碼刪除，統一走 ensureFilesPanel/initFilesContent；實作時以現行 main.ts 為準做最小整併並在 report 記錄差異。）

- [ ] **Step 5: 驗證 + Commit** — 全量 54、tsc、建置、locale JSON 合法。

```
feat: FSA-powered file tree flow for file:// pages

Why: modern Chrome blocks all programmatic file:// reads, leaving the
Files tab dead on local documents; the File System Access API with a
user-gesture folder grant restores the full tree.
What: a filesPanel wrapper now owns Files-tab visibility (tab switch,
raw toggle and search call sites re-pointed), with a three-state flow
— probe legacy listing first, then guide panel (pick folder → map via
candidate walk → persist grant in IDB → build tree with the FSA
lister), regrant panel after browser restart, and automatic fallback
to the guide panel when the granted root disappears; search stays
disabled in files mode until a tree exists; four locale strings and
panel styles added.
How: mapping uses deep-first URL-segment candidates with a zero-match
fallback; out-of-scope navigation shows the panel without clearing
the stored grant.
Boundary: http(s) directory listing behavior unchanged (probe-first
ordering); engine and search untouched.
```

---

### Task 4: 驗收（controller）+ 文件 + 合併發版 v1.0.4

- [ ] 自動驗收（Playwright）：
  1. file:// 開 demo → 檔案頁籤 → 引導面板呈現（fsa_pick_button 字樣、hint、無「無法取得目錄列表」）
  2. 無樹時點放大鏡 → 無反應（搜尋停用 guard）
  3. http://localhost:8123 → 樹功能完整迴歸（Phase 2 過濾含）——證明 probe-first 未破壞 http
  4. raw 切換/folderTree 開關與 filesPanel 互動無殘留
- [ ] `PRIVACY.md` 增補 FSA 一句（EN+中文）；`docs/plans.md`/`designs.md` 索引；ROADMAP 1.2/C → 完成
- [ ] 合入 main、bump 1.0.4、tag、CI release
- [ ] Release note 附**手動驗收清單**（spec 測試節第 2 段）

## Self-Review 紀錄

- **Spec coverage**：映射（T1）、持久化/權限/lister/onRootStatus（T2）、三態流程/wrapper/guard/樣式/locale（T3）、自動+手動驗收拆分與隱私句（T4）。範圍外不清 IDB：lister throw → 節點錯誤（非 root callback），root 範圍檢查在 initFilesContent 的 startsWith 判定——範圍外直接 guide 面板不清 grant ✓。
- **Placeholder scan**：無 TBD；T3 註明「以現行 main.ts 為準最小整併」屬授權偏移。
- **Type consistency**：`FsaDirectoryHandle`/`createFsaLister`/`loadGrant` 簽名 T2/T3 一致；`listDir`/`onRootStatus` 與 T2 file-tree 修改一致；DirEntry 來源一致。
