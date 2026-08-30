# 案 D：GitHub 目錄樹（零權限）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** raw.githubusercontent.com 的 md 頁自動取得目錄樹（GitHub Contents API、content script 直接 fetch），零權限、零 manifest 變更。

**Architecture:** core 純函式（URL 解析/重組/轉換/ratelimit 分類）＋ shell lister（knownDirs 路徑註冊表，杜絕 URL 回推）＋ file-tree 兩個小 option（parentHref、RateLimitError 訊息）＋ main 判定鏈前插 GitHub 分支與 buildTree kind 參數（防 GitHub 失敗誤清 FSA 授權）。

**Tech Stack:** 同前案。

## Global Constraints

- 分支：`feature/github-tree`（spec 已在其上）。
- **零權限**：manifest／background 不得變更（驗收 `git diff` 確認）。
- GitHub 判定在 probe 之前（parseRawUrl 非 null 直接進分支，省必 404 請求）。
- `onRootStatus` 清 FSA 授權僅限 `kind === 'fsa'`。
- 顯式 refs/ 形態需最少段數守門，否則回退傳統解析。
- 測試命令 `node --test tests/<file>.test.mjs`；全量 6 檔 = github-url + fsa-path + doc-search + obsidian + dir-listing + graphviz（52 + 新增）。
- 建置：`export npm_package_version=1.0.4 npm_package_name=md-reader-lite && node ./scripts/manifest.mjs && node_modules/.bin/webpack --config ./build/webpack.prod.js`。
- Commit 四段 + trailers（Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> ／ Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR）。Subagent 一律 sonnet。表格禁裸 `|`。
- core 跨模組 import 用 `#core/*`（node 測試需要）；shell 用 `@/`。

## File Structure

| 檔案                                                                                                        | 動作 | 職責                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `src/core/github-url.ts`                                                                                    | 新增 | parseRawUrl／rawDirUrl／apiContentsUrl／parentTreeUrl／contentsToDirEntries／classifyGithubFailure |
| `tests/github-url.test.mjs`                                                                                 | 新增 | ≥12 條單元                                                                                         |
| `src/core/github-listing.ts`                                                                                | 新增 | createGithubLister（knownDirs 註冊表 + fetch + RateLimitError）                                    |
| `src/core/file-tree.ts`                                                                                     | 修改 | `parentHref?` option；兩 catch 具名綁定 + ratelimit 訊息                                           |
| `src/main.ts`                                                                                               | 修改 | buildTree(listDir, kind, parentHref)；initFilesContent 前插 GitHub 分支                            |
| `src/config/i18n/locale.json`                                                                               | 修改 | `github_ratelimit` ×3                                                                              |
| `docs/lesson_learn.md`、`docs/research/2026-08-30-chrome-mv3-file-url-access-restrictions.md`、`PRIVACY.md` | 修改 | lesson 10、CSP 更正註記、隱私一句（Task 3）                                                        |
| `docs/plans.md`、`docs/designs.md`、`docs/ROADMAP.md`                                                       | 修改 | 索引 + D 完成（Task 4）                                                                            |

---

### Task 1: github-url 純函式（TDD）

**Files:**

- Create: `src/core/github-url.ts`
- Test: `tests/github-url.test.mjs`

**Interfaces:**

- Produces（T2/T3 依賴）:

  - `interface RawUrlParts { owner: string; repo: string; ref: string; refPrefix: '' | 'refs/heads/' | 'refs/tags/'; dirPath: string[] }`（dirPath = decode 後之檔案所在目錄 segments）
  - `parseRawUrl(url: string): RawUrlParts | null`
  - `rawDirUrl(p: RawUrlParts, dirPath?: string[]): string`（預設 p.dirPath；尾斜線；segment encodeURIComponent；保留 refPrefix 原形態）
  - `apiContentsUrl(p: RawUrlParts, dirPath?: string[]): string`（`?ref=` 帶未加前綴的 p.ref）
  - `parentTreeUrl(p: RawUrlParts): string | null`（github.com tree 頁；dirPath 空 → null）
  - `interface GithubContentItem { name: string; type: string }`
  - `contentsToDirEntries(items: GithubContentItem[], p: RawUrlParts, dirPath: string[]): DirEntry[]`（'dir' + isMarkdownFile 檔；資料夾先、localeCompare；URL = rawDirUrl(p, dirPath) + encodeURIComponent(name)〔目錄加尾斜線〕）
  - `classifyGithubFailure(status: number, ratelimitRemaining: string | null): 'ratelimit' | 'error'`

- [ ] **Step 1: 失敗測試**

`tests/github-url.test.mjs`：

```js
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
```

- [ ] **Step 2: RED** — `node --test tests/github-url.test.mjs` 全 FAIL

- [ ] **Step 3: 實作 `src/core/github-url.ts`**

```ts
import { isMarkdownFile, type DirEntry } from '#core/dir-listing'

export interface RawUrlParts {
  owner: string
  repo: string
  ref: string
  refPrefix: '' | 'refs/heads/' | 'refs/tags/'
  dirPath: string[]
}

export interface GithubContentItem {
  name: string
  type: string
}

const RAW_HOST = 'https://raw.githubusercontent.com'

/** raw URL → 結構；非 raw 網域或段數不足回 null */
export function parseRawUrl(url: string): RawUrlParts | null {
  if (!url.startsWith(RAW_HOST + '/')) return null
  const rest = url.slice(RAW_HOST.length + 1).replace(/[?#].*$/, '')
  const segs = rest.split('/').filter(Boolean).map(decodeURIComponent)
  if (segs.length < 4) {
    // owner/repo/ref/file 為最少（傳統形態）
    return null
  }
  const [owner, repo, ...tail] = segs
  let refPrefix: RawUrlParts['refPrefix'] = ''
  let ref: string
  let pathSegs: string[]
  if (
    tail.length >= 4 &&
    tail[0] === 'refs' &&
    (tail[1] === 'heads' || tail[1] === 'tags')
  ) {
    /* 顯式形態：refs/heads|tags/<ref>/<path…>（最少 refs+kind+ref+file 四段） */
    refPrefix = ('refs/' + tail[1] + '/') as RawUrlParts['refPrefix']
    ref = tail[2]
    pathSegs = tail.slice(3)
  } else if (tail.length >= 2) {
    ref = tail[0]
    pathSegs = tail.slice(1)
  } else {
    return null
  }
  return { owner, repo, ref, refPrefix, dirPath: pathSegs.slice(0, -1) }
}

function encodeSegs(segs: string[]): string {
  return segs.map(encodeURIComponent).join('/')
}

export function rawDirUrl(
  p: RawUrlParts,
  dirPath: string[] = p.dirPath,
): string {
  const path = dirPath.length ? encodeSegs(dirPath) + '/' : ''
  return `${RAW_HOST}/${encodeURIComponent(p.owner)}/${encodeURIComponent(
    p.repo,
  )}/${p.refPrefix}${encodeURIComponent(p.ref)}/${path}`
}

export function apiContentsUrl(
  p: RawUrlParts,
  dirPath: string[] = p.dirPath,
): string {
  const path = dirPath.length ? '/' + encodeSegs(dirPath) : ''
  return `https://api.github.com/repos/${encodeURIComponent(
    p.owner,
  )}/${encodeURIComponent(p.repo)}/contents${path}?ref=${encodeURIComponent(
    p.ref,
  )}`
}

/** `../` 目標：github.com 的 tree 頁；已在 repo 根回 null */
export function parentTreeUrl(p: RawUrlParts): string | null {
  if (!p.dirPath.length) return null
  const parent = p.dirPath.slice(0, -1)
  const path = parent.length ? '/' + encodeSegs(parent) : ''
  return `https://github.com/${encodeURIComponent(
    p.owner,
  )}/${encodeURIComponent(p.repo)}/tree/${encodeURIComponent(p.ref)}${path}`
}

export function contentsToDirEntries(
  items: GithubContentItem[],
  p: RawUrlParts,
  dirPath: string[],
): DirEntry[] {
  const dirs = items.filter(i => i.type === 'dir')
  const files = items.filter(i => i.type === 'file' && isMarkdownFile(i.name))
  const byName = (a: GithubContentItem, b: GithubContentItem) =>
    a.name.localeCompare(b.name)
  dirs.sort(byName)
  files.sort(byName)
  const base = rawDirUrl(p, dirPath)
  return [
    ...dirs.map(d => ({
      name: d.name,
      isDir: true,
      url: base + encodeURIComponent(d.name) + '/',
    })),
    ...files.map(f => ({
      name: f.name,
      isDir: false,
      url: base + encodeURIComponent(f.name),
    })),
  ]
}

/** 403/429 且流量餘額為 0 → ratelimit；其他一律 error */
export function classifyGithubFailure(
  status: number,
  ratelimitRemaining: string | null,
): 'ratelimit' | 'error' {
  return (status === 403 || status === 429) && ratelimitRemaining === '0'
    ? 'ratelimit'
    : 'error'
}
```

- [ ] **Step 4: GREEN + 迴歸 + Commit** — github-url 全綠；全量 6 檔（52 + 新增）；tsc 乾淨。

```
feat: add GitHub raw-url parsing and contents conversion helpers

Why: the GitHub tree needs pure, testable logic for both raw URL
forms (classic and refs/heads|tags with an ambiguity guard), API and
tree-page URL rebuilding, entry conversion and rate-limit
classification — all with the same DirEntry contract as other trees.
What: github-url.ts with parseRawUrl (minimum-segment fallback to the
classic form), rawDirUrl/apiContentsUrl/parentTreeUrl rebuilders,
contentsToDirEntries (markdown/dir filter, dirs-first localeCompare,
encoded urls) and classifyGithubFailure; ten test blocks.
How: #core import keeps it node-testable; ratelimit classification is
pure so the fetch shell stays trivial.
Boundary: core module + tests; no consumers yet.
```

---

### Task 2: github-listing + file-tree options + locale

**Files:**

- Create: `src/core/github-listing.ts`
- Modify: `src/core/file-tree.ts`、`src/config/i18n/locale.json`

**Interfaces:**

- Consumes: Task 1 全部。
- Produces（T3 依賴）: `createGithubLister(p: RawUrlParts, rootDirUrl: string): (dirUrl: string) => Promise<DirEntry[]>`；file-tree `FileTreeOptions.parentHref?: string | null`。

- [ ] **Step 1: `src/core/github-listing.ts`**

```ts
import {
  apiContentsUrl,
  classifyGithubFailure,
  contentsToDirEntries,
  type GithubContentItem,
  type RawUrlParts,
} from '@/core/github-url'
import type { DirEntry } from '@/core/dir-listing'

/**
 * GitHub Contents API lister。knownDirs 以「URL → dirPath」註冊表運作：
 * root 由呼叫端 seed（location 原生編碼），子目錄 URL 為自建（encodeURIComponent），
 * 兩者都只當 Map key 用，完全不做 URL 字串回推。
 */
export function createGithubLister(
  p: RawUrlParts,
  rootDirUrl: string,
): (dirUrl: string) => Promise<DirEntry[]> {
  const knownDirs = new Map<string, string[]>([[rootDirUrl, p.dirPath]])
  return async dirUrl => {
    const dirPath = knownDirs.get(dirUrl)
    if (!dirPath) {
      throw new Error('unknown github directory: ' + dirUrl)
    }
    const res = await fetch(apiContentsUrl(p, dirPath), {
      signal: (AbortSignal as any).timeout(8000),
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) {
      const kind = classifyGithubFailure(
        res.status,
        res.headers.get('x-ratelimit-remaining'),
      )
      const err = new Error(
        kind === 'ratelimit'
          ? 'GitHub API rate limit'
          : `GitHub API HTTP ${res.status}`,
      )
      if (kind === 'ratelimit') err.name = 'RateLimitError'
      throw err
    }
    const items = (await res.json()) as GithubContentItem[]
    if (!Array.isArray(items)) {
      throw new Error('unexpected GitHub API response shape')
    }
    const entries = contentsToDirEntries(items, p, dirPath)
    for (const entry of entries) {
      if (entry.isDir) knownDirs.set(entry.url, [...dirPath, entry.name])
    }
    return entries
  }
}
```

- [ ] **Step 2: file-tree 修改**

a. `FileTreeOptions` 加 `parentHref?: string | null`。
b. `../` 區塊：`const parent = opts 中 parentHref !== undefined ? parentHref : parentOf(rootDir)`（undefined = 現行為；null → if(parent) 不成立即隱藏；string → 直接用）。
c. 兩個 catch 具名化並依 err.name 選訊息：

- root：`.catch(err => { …; renderMessage(container, err?.name === 'RateLimitError' ? localize('github_ratelimit') : localize('dir_error')) })`（沿用現行結構，僅換訊息選擇）
- 展開：`catch (err) { … errMsg.textContent = (err as Error)?.name === 'RateLimitError' ? localize('github_ratelimit') : localize('dir_error') … }`

- [ ] **Step 3: locale ×3**
- en `"github_ratelimit": "GitHub API rate limit reached. Try again later."`
- zh-CN `"GitHub API 流量限制，请稍后再试。"`
- zh-TW `"GitHub API 流量限制，請稍後再試。"`

- [ ] **Step 4: 驗證 + Commit** — 全量 6 檔、tsc、建置、locale JSON 合法。

```
feat: add GitHub lister and rate-limit aware tree messages

Why: the tree needs a lister that talks to the Contents API without
any URL string back-derivation, and both tree error paths must show a
distinct message when the anonymous rate limit is hit.
What: createGithubLister with a knownDirs path registry seeded from
the location-native root URL, 8s timeout, ratelimit-aware error
naming; file-tree gains a parentHref override (string, null to hide,
undefined for current behavior) and named catch bindings selecting
github_ratelimit vs dir_error; locale strings ×3.
How: registry keys are opaque — native and self-built encodings never
need to round-trip; classification stays in the pure core helper.
Boundary: no consumer wiring yet; existing trees unaffected
(parentHref undefined preserves parentOf behavior).
```

---

### Task 3: main 佈線 + 文件同步

**Files:**

- Modify: `src/main.ts`、`docs/lesson_learn.md`、`docs/research/2026-08-30-chrome-mv3-file-url-access-restrictions.md`、`PRIVACY.md`

- [ ] **Step 1: main.ts**

a. import：`createGithubLister`（github-listing）、`parseRawUrl, parentTreeUrl`（github-url）。
b. `buildTree` 簽名改 `function buildTree(listDir?: (u: string) => Promise<DirEntry[]>, kind: 'default' | 'fsa' | 'github' = 'default', parentHref?: string | null)`：

- `createFileTree({ …, parentHref, … })`
- `onRootStatus`：`if (status === 'error' && kind === 'fsa') { …現行清授權回面板… }`（原 `listDir` 判斷改 kind）。
  c. 既有呼叫點：`buildTree(undefined)` 不變（default）；FSA 兩處 → `buildTree(createFsaLister(...), 'fsa')`。
  d. `initFilesContent` 開頭（rootDir 計算後、probe 前）：

```ts
const gh = parseRawUrl(window.location.href.replace(/[?#].*$/, ''))
if (gh) {
  buildTree(createGithubLister(gh, rootDir), 'github', parentTreeUrl(gh))
  return
}
```

- [ ] **Step 2: 文件同步**

a. `docs/lesson_learn.md` 加第 10 條：`10. content script 的 fetch 豁免頁面 CSP（2026-08-31 實測）：在 default-src 'none' 的 raw.githubusercontent 頁上，content script 同源 fetch 8/8 成功、跨域（CORS 允許的）API fetch 也通——narrow-permissions 案「嚴格 CSP 網站失去自動刷新/目錄樹」的推定錯誤；背景代理唯一不可替代的用途只剩需要 host 權限的非 CORS 端點。`
b. research 檔（chrome-mv3-file-url…md）末尾加「更正（2026-08-31）」小節：同上結論一句 + 指向 lesson 10。
c. `PRIVACY.md`：Optional folder access bullet 之後加：`- **GitHub directory listing.** On raw.githubusercontent.com pages the Files tab lists the folder via GitHub's public API (anonymous, read-only, no token); no other data is sent.`；中文摘要加一句：`於 GitHub raw 頁面使用檔案樹時會匿名呼叫 GitHub 公開 API 列目錄，無 token、無其他資料傳輸。`

- [ ] **Step 3: 驗證 + Commit** — 全量 6 檔、tsc、建置、`git diff main -- src/manifest.json src/background.ts` 空。

```
feat: wire GitHub tree into the files panel decision chain

Why: raw.githubusercontent pages should get their directory tree
automatically, before the guaranteed-404 legacy probe, and a GitHub
root failure must never disturb the unrelated FSA grant.
What: buildTree gains kind and parentHref parameters (FSA recovery
now keyed on kind, not listDir truthiness), initFilesContent branches
to the GitHub lister first with the tree-page parent link; lesson 10,
a research correction note and a PRIVACY disclosure document the
content-script-CSP finding and the anonymous API calls.
How: parseRawUrl null-check doubles as the branch guard; no manifest
or background change.
Boundary: http(s), file:// and default degrade flows unchanged.
```

---

### Task 4: 驗收（controller）+ 索引 + 合併發版 v1.0.5

- [ ] Playwright 真網路驗收（swchen44/md-reader-lite repo raw 頁）：樹自動列出 docs/、懶展開 superpowers/、`../` href = github.com/swchen44/md-reader-lite/tree/main、Phase 2 過濾、http 與 file:// 迴歸；如遇 403/429 → 印手動清單、以單元+迴歸為準。
- [ ] `docs/plans.md`/`designs.md` 案 D 兩列；`docs/ROADMAP.md` 1.3/D → 完成。
- [ ] 合入 main、bump 1.0.5、tag、CI release。

## Self-Review 紀錄

- **Spec coverage**：解析兩形態+守門（T1）、knownDirs lister+ratelimit（T2）、kind 區分+判定鏈前插+文件同步（T3）、驗收與零 manifest 驗證（T3/T4）。介面定案八點全數落實。
- **Placeholder scan**：無 TBD。
- **Type consistency**：RawUrlParts／createGithubLister(p, rootDirUrl)／buildTree(listDir, kind, parentHref)／parentHref 三態在各 Task 一致；DirEntry 單一來源。
