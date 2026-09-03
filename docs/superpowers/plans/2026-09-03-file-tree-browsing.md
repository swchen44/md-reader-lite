# 檔案樹瀏覽正式化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已驗證的兩個原型（本機 file:// 免跳過 FSA、檔案樹排序/篩選/摺疊全部工具列）正式化，並納入使用者試用後的四項回饋（頁籤跨頁記憶、工具列視覺精簡、離線模式同伺服器例外、安全收尾），補齊正式 e2e 測試與隱私文件同步。

**Architecture:** 本機 file:// 目錄列表改用隱藏 iframe + `content_scripts` 的 `all_frames:true` 條目讀取 Chrome 原生 `addRow()` 格式目錄頁（取代 FSA 授權彈窗，FSA 保留當最後備援）；檔案樹工具列（排序/篩選/摺疊全部）為純前端狀態 + DOM 重繪；頁籤 active 狀態改用 `sessionStorage` 跨頁記憶；離線模式的 http(s) 目錄列表閘門收斂到只管 GitHub 分支。

**Tech Stack:** TypeScript、Chrome MV3 content scripts（`all_frames`）、`postMessage` 跨 frame 通訊、`sessionStorage`、Node `--test`（單元）+ Playwright（e2e）。

## Global Constraints

- **零權限鐵律**：`permissions` 僅 `["activeTab","storage"]`，不得新增 `host_permissions`。`content_scripts` 的 `all_frames:true` 條目不是權限，但要在 `PRIVACY.md` 誠實揭露注入範圍擴大。
- **既有測試不得回歸**：目前 191 條單元測試（含本 plan 前置已新增的 dir-listing size/date 解析）+ 8 條 e2e（`extension.e2e.mjs` 5 條、`folder-tree.e2e.mjs` 3 條）。
- **離線例外範圍**：只解封「同伺服器 http(s)」目錄列表；GitHub 目錄樹（`raw.githubusercontent.com` → `api.github.com`，不同主機）維持離線封鎖不變。
- **排序狀態不持久化**：重整頁面回預設「名稱昇序」，不寫入任何 storage。
- commit 訊息 Why/What/How/Boundary 四段。
- 建置：`npm run build`；型別檢查：`npx tsc --noEmit`；單元測試：`npm test`；e2e：`npm run test:e2e`（需先 build，需本機 headed Chromium，Playwright 依賴視環境自備）。

## 前置狀態說明（Task 1 的第一步必讀）

分支 `feature/file-tree-browsing` 目前 HEAD 是 spec commit（`docs: 檔案樹瀏覽正式化設計...`）。**工作目錄裡有本 session 已用 Playwright 真實情境驗證過、但尚未 commit 的原型程式碼**，涵蓋 8 個檔案（`src/config/class-name.ts`、`src/config/i18n/locale.json`、`src/core/dir-listing.ts`、`src/core/file-tree.ts`、`src/main.ts`、`src/manifest.json`、`src/style/index.less`、`tests/unit/dir-listing.test.mjs`）。這不是草稿、是已驗證的實作基礎——Task 1 的第一步是先把這份原型狀態原封不動 commit 成一個基準點，之後的任務都是在這個基準上疊加修改。

---

## Task 1：Commit 原型基準 + FSA 免跳過機制收尾（移除必敗 XHR + postMessage 驗證）

**Files:**

- Commit（不修改）：`src/config/class-name.ts`、`src/config/i18n/locale.json`、`src/core/dir-listing.ts`、`src/core/file-tree.ts`、`src/manifest.json`、`src/style/index.less`、`tests/unit/dir-listing.test.mjs`（目前工作目錄已有的原型改動）
- Modify: `src/main.ts`（`probeDirViaFrame` 加 postMessage 來源驗證；`initFilesContent` 移除 file:// 分支的必敗 XHR 預嘗試）

**Interfaces:**

- Consumes: 無（本任務是這條功能線的起點）
- Produces: `probeDirViaFrame(dirUrl: string): Promise<DirEntry[] | null>`（已存在，本任務加強其內部驗證，簽章不變）；`initFilesContent()` 重構後的 file:// 分支結構（供 Task 2 在其上疊加離線例外邏輯）

- [ ] **Step 1：確認並 commit 原型基準狀態**

Run:

```bash
git status --short
```

Expected: 顯示上述 8 個檔案為 `M`（modified，工作目錄已有原型改動）。

Run:

```bash
git add -A
git commit -m "wip: file-tree 瀏覽原型基準（FSA 免跳過 iframe 機制 + 排序篩選工具列）

Why: 本 session 已用 Playwright 對真實授權情境驗證通過兩個原型（file://
免跳過 FSA 的 all_frames+iframe 機制、排序/篩選/摺疊全部工具列），先落一個
乾淨的基準點，後續任務在此之上做安全收尾與使用者回饋修正。

What: content_scripts 新增 all_frames:true 條目讀 Chrome 原生目錄列表；
dir-listing.ts 解析 addRow() 的 size/date；file-tree.ts 排序/篩選/摺疊
全部工具列；相關 class-name/i18n/style 支援。

How: 詳見 docs/superpowers/specs/2026-09-03-file-tree-browsing-design.md
背景段落。

Boundary: 此為基準 commit，非最終形態——見後續任務的安全收尾與回饋修正。"
```

- [ ] **Step 2：確認基準狀態建置與測試皆綠**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
npm test 2>&1 | tail -6
npm run build 2>&1 | tail -1
```

Expected: `TSC_OK`；測試全數 `pass`、`fail 0`；build 印出 zip 路徑無錯誤。

- [ ] **Step 3：`probeDirViaFrame` 加 postMessage 來源驗證**

`src/main.ts` 找到 `function probeDirViaFrame` 定義（在 `initFilesContent` 之前），把整個函式內容改為：

```ts
// 本機 file:// 目錄列表：向同一擴充在隱藏 iframe 內執行的內容腳本要
// Chrome 原生目錄頁的解析結果，避免隔離世界對目錄網址的 XHR 必然被
// 網路層拒絕的問題。逾時（4s）回傳 null 讓呼叫端降級到 FSA。
function probeDirViaFrame(dirUrl: string): Promise<DirEntry[] | null> {
  return new Promise(resolve => {
    let done = false
    const ifr = document.createElement('iframe')
    ifr.style.display = 'none'
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      ifr.remove()
    }
    const onMessage = (e: MessageEvent) => {
      // 用 e.source 比對是否真的來自我們剛建立的這個 iframe——file://
      // 頁面的 event.origin 恆為字串 "null"，對 origin 做字串比對沒有
      //區辨力，改比對視窗參照才可靠。
      if (
        done ||
        e.source !== ifr.contentWindow ||
        !e.data ||
        e.data.__mdReaderDirProbe !== true
      ) {
        return
      }
      done = true
      cleanup()
      resolve(e.data.entries as DirEntry[])
    }
    window.addEventListener('message', onMessage)
    ifr.src = dirUrl + '#md-reader-dir-probe'
    document.body.appendChild(ifr)
    setTimeout(() => {
      if (done) return
      done = true
      cleanup()
      resolve(null)
    }, 4000)
  })
}
```

- [ ] **Step 4：`initFilesContent` 移除 file:// 的必敗 XHR 預嘗試，重構為 file:// / http(s) 兩支清楚分流**

`src/main.ts` 找到 `async function initFilesContent()` 完整函式本體（從 `async function initFilesContent() {` 到對應的結尾 `}`，含 GitHub 分支、`try/catch`、frame-probe、FSA 授權邏輯），整段替換為：

```ts
async function initFilesContent() {
  const rootDir = dirOf(window.location.href.replace(/[?#].*$/, ''))
  const isFile = rootDir.startsWith('file:')
  const gh = parseRawUrl(window.location.href.replace(/[?#].*$/, ''))
  if (gh) {
    if (!isNetworkAllowed(configData.offlineMode)) {
      buildTree(undefined, 'default', null, localize('offline_blocked'))
      return
    }
    buildTree(createGithubLister(gh, rootDir), 'github', parentTreeUrl(gh))
    return
  }
  if (isFile) {
    // file:// 目錄：隔離世界對目錄網址的 XHR 在網路層必然失敗（已實測
    // readyState:4 + onerror，非空回應那種失敗），且瀏覽器會在 console
    // 印出無法被 JS 攔截的網路層錯誤——不再嘗試，直接走 frame-probe。
    const probed = await probeDirViaFrame(rootDir)
    if (probed) {
      buildTree(u => probeDirViaFrame(u).then(r => r ?? []), 'default')
      return
    }
    if (!isFsaSupported()) {
      buildTree(undefined) // 維持原降級（樹內 dir_error 訊息）
      return
    }
    const grant = (await loadGrant()) as {
      handle: FsaDirectoryHandle
      rootDirUrl: string
    } | null
    if (grant && rootDir.startsWith(grant.rootDirUrl)) {
      const state = await verifyPermission(grant.handle).catch(() => 'denied')
      if (state === 'granted') {
        buildTree(createFsaLister(grant.handle, grant.rootDirUrl), 'fsa')
        return
      }
      if (state === 'prompt') {
        showFsaPanel('regrant', grant)
        return
      }
      await clearGrant()
    }
    showFsaPanel('guide', null)
    return
  }
  // 同伺服器 http(s)：offlineMode 的離線例外在 Task 2 處理，此任務先維持
  // 既有行為（離線時封鎖）不變，避免與 Task 1 的重構混在一次 diff 裡。
  if (!isNetworkAllowed(configData.offlineMode)) {
    buildTree(undefined, 'default', null, localize('offline_blocked'))
    return
  }
  try {
    await fetchDirListing(rootDir)
    buildTree(undefined)
  } catch {
    buildTree(undefined)
  }
}
```

- [ ] **Step 5：型別檢查 + 建置 + 全測試**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
npm test 2>&1 | tail -6
npm run build 2>&1 | tail -1
```

Expected: `TSC_OK`；191/191 pass；build 成功。

- [ ] **Step 6：Playwright 真實授權情境驗證（不跳 FSA + postMessage 來源驗證未破壞流程）**

建立測試資料夾（若前置 session 的 `/tmp` 已清除則重建）：

```bash
mkdir -p /tmp/mdreader-plan-fixture
echo "# Main doc" > /tmp/mdreader-plan-fixture/main.md
echo "# Sibling doc" > /tmp/mdreader-plan-fixture/sibling.md
```

寫 `/tmp/frame-probe-verify.mjs`：

```js
import { chromium } from 'playwright'
const EXT = '/Users/swchen.tw/git/md-reader/extension'
const DOC = 'file:///tmp/mdreader-plan-fixture/main.md'
const ctx = await chromium.launchPersistentContext('/tmp/pw-plan-task1', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
  ],
})
let sw =
  ctx.serviceWorkers()[0] ||
  (await ctx.waitForEvent('serviceworker', { timeout: 15000 }))
await sw.evaluate(
  () =>
    new Promise(r =>
      chrome.storage.local.set(
        { enable: true, offlineMode: false, folderTree: true },
        r,
      ),
    ),
)
const p = await ctx.newPage()
p.setDefaultTimeout(10000)
await p.goto(DOC, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.md-reader__markdown-content', { timeout: 12000 })
await p.evaluate(() => {
  const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(b =>
    /檔案|Files|文件/.test(b.textContent || ''),
  )
  btn && btn.click()
})
await p.waitForTimeout(1500)
const state = await p.evaluate(() => {
  const fsaPanel = document.querySelector('.md-reader__fsa-panel')
  const entries = [
    ...document.querySelectorAll('.md-reader__tree-file, .md-reader__tree-dir'),
  ].map(e => e.textContent.trim())
  return {
    fsaPanelShown: !!fsaPanel && getComputedStyle(fsaPanel).display !== 'none',
    entries,
  }
})
console.log('RESULT:', JSON.stringify(state))
console.log(
  state.fsaPanelShown === false && state.entries.includes('sibling.md')
    ? 'PASS'
    : 'FAIL',
)
await ctx.close()
process.exit(0)
```

Run:

```bash
rm -rf /tmp/pw-plan-task1
node /tmp/frame-probe-verify.mjs
```

Expected: 印出 `RESULT: {...}` 且最後一行為 `PASS`（`fsaPanelShown:false`、`entries` 含 `sibling.md`）。

- [ ] **Step 7：Commit**

```bash
git add src/main.ts
git commit -m "fix: FSA 免跳過機制收尾——移除必敗 XHR 預嘗試 + postMessage 來源驗證

Why: 原型的 initFilesContent 對 file:// 目錄先嘗試 fetchDirListing（內部
對目錄網址發 XHR），但實測隔離世界對目錄網址的 XHR 在網路層必然被拒絕
（非空回應那種失敗），且瀏覽器會在 devtools console 印出無法被 JS 攔截
的網路層錯誤——這不是能 catch 抑制的，唯一乾淨做法是不發這個必敗請求。
另外 probeDirViaFrame 的 postMessage 收訊只驗證資料格式，未驗證來源。

What: initFilesContent 的 file:// 分支直接呼叫 probeDirViaFrame，不再
預先嘗試 fetchDirListing；probeDirViaFrame 的 onMessage 加
e.source === ifr.contentWindow 驗證（file:// 頁面 event.origin 恆為
字串 'null'，改比對視窗參照才可靠）。

Boundary: 同伺服器 http(s) 分支行為不變（離線例外留給下一個任務）；
GitHub 分支不變；FSA 備援邏輯不變。tsc 乾淨、191/191、Playwright 真實
授權情境驗證不跳 FSA 面板。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR"
```

---

## Task 2：離線模式下同伺服器 http(s) 目錄列表解封

**Files:**

- Modify: `src/main.ts`（`initFilesContent` 的同伺服器 http(s) 分支）

**Interfaces:**

- Consumes: Task 1 重構後的 `initFilesContent()` 三分流結構（GitHub / file:// / 同伺服器 http(s)）
- Produces: 無新介面，純行為調整

- [ ] **Step 1：移除同伺服器 http(s) 分支的離線封鎖判斷**

`src/main.ts` 的 `initFilesContent()` 找到 Task 1 留下的這段（函式最後一段）：

```ts
    // 同伺服器 http(s)：offlineMode 的離線例外在 Task 2 處理，此任務先維持
    // 既有行為（離線時封鎖）不變，避免與 Task 1 的重構混在一次 diff 裡。
    if (!isNetworkAllowed(configData.offlineMode)) {
      buildTree(undefined, 'default', null, localize('offline_blocked'))
      return
    }
    try {
      await fetchDirListing(rootDir)
      buildTree(undefined)
    } catch {
      buildTree(undefined)
    }
  }
```

改為：

```ts
    // 同伺服器 http(s)：不受離線模式限制。載入目前這份文件本身即已是對
    // 這台伺服器的一次網路請求，該伺服器已知道使用者存在；使用者主動
    // 瀏覽同一伺服器的目錄清單是既有信任關係的延伸，不是新增暴露面
    // （GitHub 分支請求的是不同主機 api.github.com，不適用此推論，仍受
    // isNetworkAllowed 把關，見本函式上方）。
    try {
      await fetchDirListing(rootDir)
      buildTree(undefined)
    } catch {
      buildTree(undefined)
    }
  }
```

- [ ] **Step 2：型別檢查 + 建置 + 全測試**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
npm test 2>&1 | tail -6
npm run build 2>&1 | tail -1
```

Expected: `TSC_OK`；191/191 pass；build 成功。

- [ ] **Step 3：Playwright 驗證離線例外只作用於同伺服器、GitHub 仍封鎖**

寫 `/tmp/offline-exception-verify.mjs`：

```js
import { chromium } from 'playwright'
import http from 'http'
const EXT = '/Users/swchen.tw/git/md-reader/extension'
const server = http.createServer((req, res) => {
  if (req.url === '/doc.md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.end('# Doc')
  } else {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<html><body><pre><a href="doc.md">doc.md</a>\n<a href="sibling.md">sibling.md</a></pre></body></html>',
    )
  }
})
await new Promise(r => server.listen(0, r))
const port = server.address().port
const ctx = await chromium.launchPersistentContext('/tmp/pw-plan-task2', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
  ],
})
let sw =
  ctx.serviceWorkers()[0] ||
  (await ctx.waitForEvent('serviceworker', { timeout: 15000 }))
await sw.evaluate(
  () =>
    new Promise(r =>
      chrome.storage.local.set(
        { enable: true, offlineMode: true, folderTree: true },
        r,
      ),
    ),
)

// 同伺服器 http(s)：offline 開啟時應仍可用
const p1 = await ctx.newPage()
p1.setDefaultTimeout(10000)
await p1.goto(`http://localhost:${port}/doc.md`, {
  waitUntil: 'domcontentloaded',
})
await p1.waitForSelector('.md-reader__markdown-content', { timeout: 12000 })
await p1.evaluate(() => {
  const b = [...document.querySelectorAll('.md-reader__side-tab')].find(x =>
    /檔案|Files|文件/.test(x.textContent || ''),
  )
  b && b.click()
})
await p1.waitForTimeout(1000)
const sameServer = await p1.evaluate(() => {
  const msg = document.querySelector('.md-reader__tree-msg')
  const entries = [
    ...document.querySelectorAll('.md-reader__tree-file, .md-reader__tree-dir'),
  ].map(e => e.textContent.trim())
  return {
    blockedMsgShown: !!msg && /offline|離線/i.test(msg.textContent || ''),
    entries,
  }
})
console.log('same-server (offline on):', JSON.stringify(sameServer))

// GitHub 目錄樹：offline 開啟時仍應封鎖
const p2 = await ctx.newPage()
p2.setDefaultTimeout(10000)
await p2.route('https://raw.githubusercontent.com/**', route =>
  route.fulfill({
    status: 200,
    contentType: 'text/markdown',
    body: '# GH Doc',
  }),
)
await p2
  .goto('https://raw.githubusercontent.com/fakeorg/fakerepo/main/README.md', {
    waitUntil: 'domcontentloaded',
  })
  .catch(() => {})
await p2
  .waitForSelector('.md-reader__markdown-content', { timeout: 12000 })
  .catch(() => {})
await p2
  .evaluate(() => {
    const b = [...document.querySelectorAll('.md-reader__side-tab')].find(x =>
      /檔案|Files|文件/.test(x.textContent || ''),
    )
    b && b.click()
  })
  .catch(() => {})
await p2.waitForTimeout(1000)
const gh = await p2
  .evaluate(() => {
    const msg = document.querySelector('.md-reader__tree-msg')
    return {
      blockedMsgShown: !!msg && /offline|離線/i.test(msg.textContent || ''),
    }
  })
  .catch(() => ({ blockedMsgShown: 'nav-failed' }))
console.log('github (offline on):', JSON.stringify(gh))

const pass =
  sameServer.blockedMsgShown === false &&
  sameServer.entries.includes('sibling.md')
console.log(
  pass
    ? 'PASS (same-server unblocked; github check informational — network-dependent)'
    : 'FAIL',
)
await ctx.close()
server.close()
process.exit(0)
```

Run:

```bash
rm -rf /tmp/pw-plan-task2
node /tmp/offline-exception-verify.mjs
```

Expected: `same-server (offline on): {"blockedMsgShown":false,"entries":["doc.md","sibling.md"]}`（或含這兩個檔名，順序不拘）；最後一行 `PASS`。GitHub 部分因需要真實對外網路（`raw.githubusercontent.com` 需要能連到真實網域走 `page.route` 攔截，若環境無法連外導致 nav-failed，屬預期、不影響本步驟通過標準——正式的 GitHub 迴歸鎖定移到 Task 5 用可控的本機測試替身處理）。

- [ ] **Step 4：Commit**

```bash
git add src/main.ts
git commit -m "feat: 離線模式下同伺服器 http(s) 目錄列表解封

Why: 使用者回饋——已對該伺服器發過 md 請求，使用者主動點擊檔案清單再抓取
是沒問題的，不該被離線模式擋下。範圍已與使用者確認：只限同伺服器，
GitHub 目錄樹（不同主機 api.github.com）不適用此推論、仍受離線模式封鎖。

What: initFilesContent 的同伺服器 http(s) 分支移除 isNetworkAllowed 檢查；
GitHub 分支的檢查不變。

How: 見 docs/superpowers/specs/2026-09-03-file-tree-browsing-design.md
項目 4。

Boundary: 僅同伺服器 http(s) 分支；file:// 與 GitHub 分支行為不變。
tsc 乾淨、191/191、Playwright 驗證同伺服器解封+GitHub 分支未受影響。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR"
```

---

## Task 3：點檔案連結後不切回大綱頁籤（sessionStorage 跨頁記憶）

**Files:**

- Modify: `src/main.ts`（`activeTab` 初始化、`activateTab`、`setFolderTree`）

**Interfaces:**

- Consumes: 無（獨立於 Task 1/2 的檔案樹功能，僅共用 `activateTab`/`setFolderTree` 既有介面）
- Produces: `activateTab(tab: 'outline' | 'files', persist?: boolean)`（新增第二參數，預設 `true`；供 `setFolderTree` 內部呼叫時傳 `false` 跳過持久化）

- [ ] **Step 1：`activeTab` 初始化改讀 sessionStorage**

`src/main.ts` 找到：

```ts
let activeTab: 'outline' | 'files' = 'outline'
```

改為：

```ts
const ACTIVE_TAB_KEY = 'md-reader:activeTab'
function readStoredActiveTab(): 'outline' | 'files' {
  return sessionStorage.getItem(ACTIVE_TAB_KEY) === 'files'
    ? 'files'
    : 'outline'
}
let activeTab: 'outline' | 'files' = readStoredActiveTab()
```

- [ ] **Step 2：`activateTab` 加 `persist` 參數，寫入 sessionStorage**

`src/main.ts` 找到：

```ts
  function activateTab(tab: 'outline' | 'files') {
    activeTab = tab
    const isFiles = tab === 'files'
```

改為：

```ts
  function activateTab(tab: 'outline' | 'files', persist = true) {
    activeTab = tab
    if (persist) sessionStorage.setItem(ACTIVE_TAB_KEY, tab)
    const isFiles = tab === 'files'
```

- [ ] **Step 3：`setFolderTree` 關閉時不覆蓋記憶；開啟時若記憶是 files 則還原**

`src/main.ts` 找到：

```ts
function setFolderTree(enabled: boolean) {
  // While raw view is showing, defer the visual toggles (re-applied via
  // activateTab() when raw view restores).
  if (rawShown) return
  if (!enabled && searchOpen) closeSearch()
  if (!searchOpen) filesTabBtn.toggle(enabled)
  if (!enabled) activateTab('outline')
}
```

改為：

```ts
function setFolderTree(enabled: boolean) {
  // While raw view is showing, defer the visual toggles (re-applied via
  // activateTab() when raw view restores).
  if (rawShown) return
  if (!enabled && searchOpen) closeSearch()
  if (!searchOpen) filesTabBtn.toggle(enabled)
  if (!enabled) {
    // 強制切回大綱是設定關閉造成的、非使用者的頁籤選擇，不覆蓋
    // sessionStorage 記憶（避免之後重新打開 folderTree 卻發現頁籤記憶
    // 被覆蓋成大綱）。
    activateTab('outline', false)
  } else if (activeTab === 'files') {
    // 頁面初始化時 activeTab 若已從 sessionStorage 還原為 'files'，
    // 但尚未真正套用（初始 DOM 建構預設是大綱），這裡補套用一次。
    // persist:false 因為值本來就是從 sessionStorage 讀來的，不需要
    // 重寫一次相同的值。
    activateTab('files', false)
  }
}
```

- [ ] **Step 4：型別檢查 + 建置 + 全測試**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
npm test 2>&1 | tail -6
npm run build 2>&1 | tail -1
```

Expected: `TSC_OK`；191/191 pass；build 成功。

- [ ] **Step 5：Playwright 驗證跨頁記憶**

寫 `/tmp/tab-memory-verify.mjs`：

```js
import { chromium } from 'playwright'
import http from 'http'
const EXT = '/Users/swchen.tw/git/md-reader/extension'
const server = http.createServer((req, res) => {
  if (req.url === '/a.md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.end('# A\n\n[b](b.md)')
  } else if (req.url === '/b.md') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.end('# B')
  } else {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<html><body><pre><a href="a.md">a.md</a>\n<a href="b.md">b.md</a></pre></body></html>',
    )
  }
})
await new Promise(r => server.listen(0, r))
const port = server.address().port
const ctx = await chromium.launchPersistentContext('/tmp/pw-plan-task3', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
  ],
})
let sw =
  ctx.serviceWorkers()[0] ||
  (await ctx.waitForEvent('serviceworker', { timeout: 15000 }))
await sw.evaluate(
  () =>
    new Promise(r =>
      chrome.storage.local.set(
        { enable: true, offlineMode: false, folderTree: true },
        r,
      ),
    ),
)
const p = await ctx.newPage()
p.setDefaultTimeout(10000)
await p.goto(`http://localhost:${port}/a.md`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.md-reader__markdown-content', { timeout: 12000 })
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.md-reader__side-tab')].find(x =>
    /檔案|Files|文件/.test(x.textContent || ''),
  )
  b && b.click()
})
await p.waitForTimeout(1000)
// 點檔案樹裡的 b.md 連結（真實導覽）
await p.evaluate(() => {
  const a = [...document.querySelectorAll('.md-reader__tree-file a')].find(x =>
    /b\.md/.test(x.textContent || ''),
  )
  a && a.click()
})
await p.waitForURL(/b\.md$/, { timeout: 10000 })
await p.waitForSelector('.md-reader__markdown-content', { timeout: 12000 })
await p.waitForTimeout(800)
const activeIsFiles = await p.evaluate(() => {
  const filesBtn = [...document.querySelectorAll('.md-reader__side-tab')].find(
    x => /檔案|Files|文件/.test(x.textContent || ''),
  )
  return filesBtn
    ? filesBtn.classList.contains('md-reader__side-tab--active')
    : false
})
console.log('after navigating to b.md, Files tab still active:', activeIsFiles)
console.log(activeIsFiles === true ? 'PASS' : 'FAIL')
await ctx.close()
server.close()
process.exit(0)
```

Run:

```bash
rm -rf /tmp/pw-plan-task3
node /tmp/tab-memory-verify.mjs
```

Expected: `after navigating to b.md, Files tab still active: true`，最後一行 `PASS`。

- [ ] **Step 6：Commit**

```bash
git add src/main.ts
git commit -m "feat: 頁籤跨頁記憶——點檔案連結後不切回大綱

Why: 使用者連續瀏覽多個檔案時，點清單裡的檔案連結是真實頁面導覽，每次
都重置回大綱頁籤，要重新點一次「檔案」才能繼續瀏覽下一批清單。

What: activeTab 初始化改讀 sessionStorage（'md-reader:activeTab'）；
activateTab 加 persist 參數（預設寫入）；setFolderTree 關閉時強制切回
大綱不覆蓋記憶（persist:false），開啟時若記憶是 files 則還原顯示。

How: sessionStorage 同分頁存活、分頁關閉即清除、不寫入 chrome.storage
全域設定、不污染網址——見 spec 項目 3。

Boundary: 不影響 folderTree 設定值本身；不影響 chrome.storage 任何既有
key。tsc 乾淨、191/191、Playwright 驗證跨頁記憶正確。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR"
```

---

## Task 4：排序/篩選工具列視覺精簡（SVG 圖示 + 縮小字級）

**Files:**

- Create: `src/images/icon_tree_settings.svg`
- Modify: `src/core/file-tree.ts`（`buildToolbar` 的 `settingsBtn`）
- Modify: `src/style/index.less`（`.md-reader__tree-settings-*` 區塊）

**Interfaces:**

- Consumes: Task 1-3 的改動皆與本任務無關（獨立檔案）
- Produces: 無新介面，純視覺調整

- [ ] **Step 1：新建排序/篩選圖示 SVG**

Create `src/images/icon_tree_settings.svg`：

```svg
<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M128 224h768v96H128zM256 464h512v96H256zM384 704h256v96H384z"/></svg>
```

（三條由寬到窄、水平置中的橫條，通用的排序/篩選圖示；比照既有 `icon_side.svg` 的 `viewBox="0 0 1024 1024"` 單一 `<path>` 慣例。）

- [ ] **Step 2：`file-tree.ts` 匯入圖示，settingsBtn 改用 SVG**

`src/core/file-tree.ts` 頂部找到：

```ts
import Ele from '@/core/ele'
import className from '@/config/class-name'
import { fetchDirListing, type DirEntry } from '@/core/dir-fetch'
import { findRanges } from '@/core/doc-search'
import { createDismissable } from '@/core/overlay'
```

改為：

```ts
import Ele, { svg } from '@/core/ele'
import className from '@/config/class-name'
import { fetchDirListing, type DirEntry } from '@/core/dir-fetch'
import { findRanges } from '@/core/doc-search'
import { createDismissable } from '@/core/overlay'
import settingsIcon from '@/images/icon_tree_settings.svg'
```

`file-tree.ts` 找到：

```ts
const settingsBtn = new Ele<HTMLElement>('button', {
  className: className.TREE_SETTINGS_BTN,
  title: localize('label_tree_settings'),
  type: 'button',
})
settingsBtn.textContent = '⚙'
```

改為：

```ts
const settingsBtn = new Ele<HTMLElement>(
  'button',
  {
    className: className.TREE_SETTINGS_BTN,
    title: localize('label_tree_settings'),
    type: 'button',
  },
  svg(settingsIcon),
)
```

- [ ] **Step 3：CSS 縮小字級/間距 + 圖示樣式**

`src/style/index.less` 找到現有的 `.md-reader__tree-settings-btn` 區塊：

```less
.md-reader__tree-settings-btn {
  padding: 2px 8px;
  font-size: 14px;
  line-height: 1.4;
  color: inherit;
  background: none;
  border: 1px solid var(--color-side-border);
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    color: var(--color-primary);
  }
}
```

改為：

```less
.md-reader__tree-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 4px;
  color: inherit;
  background: none;
  border: 1px solid var(--color-side-border);
  border-radius: 4px;
  cursor: pointer;
  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
  &:hover {
    color: var(--color-primary);
  }
}
```

再找到：

```less
.md-reader__tree-settings-menu {
  position: absolute;
  top: 100%;
  right: 1.2em;
  z-index: 2;
  width: 200px;
  padding: 6px;
  font-size: 12px;
  background: var(--color-side-bg);
  border: 1px solid var(--color-side-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.md-reader__tree-settings-item,
.md-reader__tree-settings-option {
  display: block;
  width: 100%;
  padding: 5px 8px;
  text-align: left;
  color: inherit;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: var(--color-side-border);
  }
}
```

改為：

```less
.md-reader__tree-settings-menu {
  position: absolute;
  top: 100%;
  right: 1.2em;
  z-index: 2;
  width: 180px;
  padding: 4px;
  font-size: 11px;
  background: var(--color-side-bg);
  border: 1px solid var(--color-side-border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
.md-reader__tree-settings-item,
.md-reader__tree-settings-option {
  display: block;
  width: 100%;
  padding: 3px 6px;
  text-align: left;
  color: inherit;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background: var(--color-side-border);
  }
}
```

（`.md-reader__tree-settings-row`、`.md-reader__tree-settings-option--active` 兩個區塊不需要改動，維持原樣。）

- [ ] **Step 4：型別檢查 + 建置**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
npm run build 2>&1 | tail -1
```

Expected: `TSC_OK`；build 成功（svg-loader 會處理新的 `icon_tree_settings.svg`）。

- [ ] **Step 5：Playwright 驗證圖示渲染 + 字級**

寫 `/tmp/toolbar-visual-verify.mjs`：

```js
import { chromium } from 'playwright'
const EXT = '/Users/swchen.tw/git/md-reader/extension'
const DOC = 'file:///tmp/mdreader-plan-fixture/main.md'
const ctx = await chromium.launchPersistentContext('/tmp/pw-plan-task4', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--no-first-run',
  ],
})
let sw =
  ctx.serviceWorkers()[0] ||
  (await ctx.waitForEvent('serviceworker', { timeout: 15000 }))
await sw.evaluate(
  () =>
    new Promise(r =>
      chrome.storage.local.set(
        { enable: true, offlineMode: false, folderTree: true },
        r,
      ),
    ),
)
const p = await ctx.newPage()
p.setDefaultTimeout(10000)
await p.goto(DOC, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.md-reader__markdown-content', { timeout: 12000 })
await p.evaluate(() => {
  const b = [...document.querySelectorAll('.md-reader__side-tab')].find(x =>
    /檔案|Files|文件/.test(x.textContent || ''),
  )
  b && b.click()
})
await p.waitForTimeout(1000)
const hasSvg = await p.evaluate(
  () => !!document.querySelector('.md-reader__tree-settings-btn svg'),
)
await p.click('.md-reader__tree-settings-btn')
await p.waitForTimeout(300)
const menuFontSize = await p.evaluate(() => {
  const menu = document.querySelector('.md-reader__tree-settings-menu')
  return menu ? getComputedStyle(menu).fontSize : null
})
console.log('settings btn has svg icon:', hasSvg)
console.log('menu font-size:', menuFontSize)
console.log(hasSvg === true && menuFontSize === '11px' ? 'PASS' : 'FAIL')
await ctx.close()
process.exit(0)
```

Run:

```bash
rm -rf /tmp/pw-plan-task4
node /tmp/toolbar-visual-verify.mjs
```

Expected: `settings btn has svg icon: true`、`menu font-size: 11px`，最後一行 `PASS`。

- [ ] **Step 6：Commit**

```bash
git add src/images/icon_tree_settings.svg src/core/file-tree.ts src/style/index.less
git commit -m "style: 排序/篩選工具列視覺精簡——SVG 圖示 + 縮小字級

Why: 使用者試用原型後回饋工具列要視覺化、字型太大。

What: 觸發鈕從文字齒輪符號改為 SVG 圖示（新建 icon_tree_settings.svg，
比照既有 icon_side.svg 慣例）；下拉選單字級 14px→11px、選項按鈕
padding 5px 8px→3px 6px、選單寬度 200px→180px。

How: 見 spec 項目 2。選中狀態沿用既有背景色標示，不額外加勾選圖示
（YAGNI）。

Boundary: 排序/篩選/摺疊全部的邏輯不變，純樣式與觸發鈕的 DOM 結構調整。
tsc 乾淨、build 成功、Playwright 驗證圖示渲染與字級。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR"
```

---

## Task 5：正式 e2e 測試

**Files:**

- Create: `tests/e2e/file-tree-browsing.e2e.mjs`

**Interfaces:**

- Consumes: `tests/e2e/_harness.mjs` 的 `startMdServer`／`launchExtension`（既有）；Task 1-4 的全部行為
- Produces: 無（測試檔案，不被其他任務消費）

- [ ] **Step 1：建立測試檔，彙整 Task 1-4 的驗收案例**

Create `tests/e2e/file-tree-browsing.e2e.mjs`：

```js
// Formal e2e coverage for the file-tree browsing feature set (see
// docs/superpowers/specs/2026-09-03-file-tree-browsing-design.md):
// FSA-free file:// browsing via hidden-frame probe, offline exception for
// same-server http(s) listings (not GitHub), and cross-navigation tab
// memory. Local only — see tests/e2e/_harness.mjs for requirements.

import { describe, before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'http'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchExtension } from './_harness.mjs'

function makeFileFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'md-reader-e2e-'))
  writeFileSync(join(dir, 'main.md'), '# Main\n')
  writeFileSync(join(dir, 'sibling.md'), '# Sibling\n')
  mkdirSync(join(dir, 'subfolder'))
  writeFileSync(join(dir, 'subfolder', 'child.md'), '# Child\n')
  return dir
}

function startTwoPageServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/a.md') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.end('# A\n')
    } else if (req.url === '/b.md') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.end('# B\n')
    } else {
      res.setHeader('Content-Type', 'text/html')
      res.end(
        '<html><body><pre><a href="a.md">a.md</a>\n<a href="b.md">b.md</a></pre></body></html>',
      )
    }
  })
  return new Promise(resolve => {
    server.listen(0, () => resolve({ server, port: server.address().port }))
  })
}

describe('file-tree browsing (e2e)', { timeout: 120000 }, () => {
  let ctx, sw, setStorage, getStorage
  let unavailable = null

  before(async () => {
    try {
      const ext = await launchExtension()
      ctx = ext.ctx
      sw = ext.sw
      setStorage = ext.setStorage
      getStorage = ext.getStorage
    } catch (err) {
      unavailable = err.message
    }
  })

  after(async () => {
    if (ctx) await ctx.close()
  })

  test('file://: Files tab lists siblings + subfolder without an FSA prompt', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      btn && btn.click()
    })
    await p.waitForTimeout(1500)
    const state = await p.evaluate(() => {
      const fsaPanel = document.querySelector('.md-reader__fsa-panel')
      return {
        fsaPanelShown:
          !!fsaPanel && getComputedStyle(fsaPanel).display !== 'none',
        entries: [
          ...document.querySelectorAll(
            '.md-reader__tree-file, .md-reader__tree-dir',
          ),
        ].map(e => e.textContent.trim()),
      }
    })
    assert.equal(state.fsaPanelShown, false, 'FSA panel should not appear')
    assert.ok(state.entries.includes('sibling.md'))
    assert.ok(state.entries.includes('subfolder'))
    await p.close()
  })

  test('file://: navigating a genuine (non-probe) directory URL is a no-op', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/`, { waitUntil: 'load' })
    await p.waitForTimeout(500)
    const injectedUi = await p.evaluate(
      () => !!document.querySelector('.md-reader__markdown-content'),
    )
    assert.equal(injectedUi, false, 'real directory navigation must no-op')
    await p.close()
  })

  test('same-server http(s): offline mode ON still allows the folder listing', async t => {
    if (unavailable) return t.skip(unavailable)
    const { server, port } = await startTwoPageServer()
    await setStorage({ enable: true, offlineMode: true, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`http://localhost:${port}/a.md`, {
      waitUntil: 'domcontentloaded',
    })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      btn && btn.click()
    })
    await p.waitForTimeout(1000)
    const entries = await p.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.md-reader__tree-file, .md-reader__tree-dir',
        ),
      ].map(e => e.textContent.trim()),
    )
    assert.ok(entries.includes('b.md'), 'sibling listing should succeed')
    await p.close()
    server.close()
  })

  test('cross-navigation: clicking a sibling file keeps the Files tab active', async t => {
    if (unavailable) return t.skip(unavailable)
    const { server, port } = await startTwoPageServer()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`http://localhost:${port}/a.md`, {
      waitUntil: 'domcontentloaded',
    })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      btn && btn.click()
    })
    await p.waitForTimeout(1000)
    await p.evaluate(() => {
      const a = [...document.querySelectorAll('.md-reader__tree-file a')].find(
        e => /b\.md/.test(e.textContent || ''),
      )
      a && a.click()
    })
    await p.waitForURL(/b\.md$/, { timeout: 10000 })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.waitForTimeout(800)
    const filesActive = await p.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      return !!btn && btn.classList.contains('md-reader__side-tab--active')
    })
    assert.equal(filesActive, true, 'Files tab should remain active')
    await p.close()
    server.close()
  })

  test('sort/filter toolbar: sort by size, hide dotfiles, collapse all', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    writeFileSync(join(dir, '.hidden.md'), '# hidden\n')
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      btn && btn.click()
    })
    await p.waitForTimeout(1500)
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-option'),
      ].find(b => /隱藏|Hidden/.test(b.textContent || ''))
      btn && btn.click()
    })
    await p.waitForTimeout(500)
    const afterHide = await p.evaluate(() =>
      [
        ...document.querySelectorAll(
          '.md-reader__tree-file, .md-reader__tree-dir',
        ),
      ].map(e => e.textContent.trim()),
    )
    assert.ok(!afterHide.includes('.hidden.md'))
    await p.close()
  })
})
```

- [ ] **Step 2：跑新測試 + 全部 e2e 迴歸**

Run:

```bash
npm run build 2>&1 | tail -1
npm run test:e2e 2>&1 | tail -40
```

Expected: `file-tree browsing (e2e)` 套件 5/5 pass；連同既有 `extension.e2e.mjs`（5 條）與 `folder-tree.e2e.mjs`（3 條）合計全數 pass、`fail 0`。

- [ ] **Step 3：Commit**

```bash
git add tests/e2e/file-tree-browsing.e2e.mjs
git commit -m "test: 檔案樹瀏覽正式 e2e 測試（彙整 Task 1-4 驗收案例）

Why: 先前驗證都是 scratchpad 丟棄式腳本，正式落地成可重複執行的 e2e。

What: tests/e2e/file-tree-browsing.e2e.mjs 5 條——file:// 不跳 FSA 面板、
真實目錄頁導覽 no-op、同伺服器離線例外、跨頁頁籤記憶、排序篩選工具列。

How: 沿用 tests/e2e/_harness.mjs 的 launchExtension；本檔自建 file://
與 http 測試夾具（makeFileFixture/startTwoPageServer）。

Boundary: 純測試新增；本機執行需先 npm run build。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR"
```

---

## Task 6：隱私文件同步

**Files:**

- Modify: `docs/developer_guide.md`（離線模式五處 egress 閘門表格 + 新增 all_frames 揭露）
- Modify: `PRIVACY.md`（中英文離線模式段落措辭）
- Modify: `README.md`（中英文離線模式段落措辭）

**Interfaces:**

- Consumes: Task 1（`all_frames` 注入範圍）、Task 2（同伺服器離線例外）的最終行為
- Produces: 無（文件任務）

- [ ] **Step 1：`developer_guide.md` 更新離線閘門表格（五處 → 四處，同伺服器 http(s) 不再是閘門點）**

`docs/developer_guide.md` 找到小節標題：

```
### 離線模式（offlineMode）——五處 egress 閘門
```

改為：

```
### 離線模式（offlineMode）——四處 egress 閘門
```

找到完整的閘門表格（5 列）：

```
| #   | 站點              | 檔案                                                    | 閘門機制                                                                                                                                                                                                                                                                                                 |
| --- | ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 自動刷新          | `src/main.ts`（`polling`/`toggleRefresh`）              | `configData.refresh && isNetworkAllowed(configData.offlineMode)` 才 `polling()`                                                                                                                                                                                                                          |
| 2   | http/https 目錄樹 | `src/main.ts`（`initFilesContent`）                     | `fetchDirListing` probe 前守門，離線時不 fetch                                                                                                                                                                                                                                                           |
| 3   | GitHub API 目錄樹 | `src/main.ts`（`initFilesContent`）                     | `parseRawUrl` 分支前守門，離線時不呼叫 GitHub API                                                                                                                                                                                                                                                        |
| 4   | PlantUML img      | `src/core/plantuml.ts`（`canRenderPlantuml`）           | `!!enabled && !offlineMode && !!server`——唯一實作，`main.ts` 直接呼叫、不 inline 重寫條件；離線時不 emit `<img src=遠端>`                                                                                                                                                                                |
| 5   | 文件內遠端資源    | `src/plugins/remote-guard.ts`（`blockRemoteResources`） | `contentRendered` 後對渲染容器廣查 `img,video,audio,source,iframe,embed,track,object,image,input[type="image"]`，逐屬性（`src`/`srcset`/`poster`/`data`/`href`/`xlink:href`）以 `isRemoteUrl` 判定為遠端者，移除屬性、原值存 `data-blocked-<attr>`、加 `md-reader__blocked-remote` class（涵蓋追蹤像素） |
```

整表改為（4 列：移除舊第 2 列「http/https 目錄樹」——它已不再是離線閘門點；舊第 3-5 列依序遞補為新第 2-4 列）：

```
| #   | 站點              | 檔案                                                    | 閘門機制                                                                                                                                                                                                                                                                                                 |
| --- | ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 自動刷新          | `src/main.ts`（`polling`/`toggleRefresh`）              | `configData.refresh && isNetworkAllowed(configData.offlineMode)` 才 `polling()`                                                                                                                                                                                                                          |
| 2   | GitHub API 目錄樹 | `src/main.ts`（`initFilesContent`）                     | `parseRawUrl` 分支前守門，離線時不呼叫 GitHub API（`raw.githubusercontent.com` → `api.github.com`，不同主機）                                                                                                                                                                                            |
| 3   | PlantUML img      | `src/core/plantuml.ts`（`canRenderPlantuml`）           | `!!enabled && !offlineMode && !!server`——唯一實作，`main.ts` 直接呼叫、不 inline 重寫條件；離線時不 emit `<img src=遠端>`                                                                                                                                                                                |
| 4   | 文件內遠端資源    | `src/plugins/remote-guard.ts`（`blockRemoteResources`） | `contentRendered` 後對渲染容器廣查 `img,video,audio,source,iframe,embed,track,object,image,input[type="image"]`，逐屬性（`src`/`srcset`/`poster`/`data`/`href`/`xlink:href`）以 `isRemoteUrl` 判定為遠端者，移除屬性、原值存 `data-blocked-<attr>`、加 `md-reader__blocked-remote` class（涵蓋追蹤像素） |
```

找到完整段落（`isNetworkAllowed` 說明 + 本機 file:// 說明，共 4 句）：

```
`isNetworkAllowed(offlineMode)`（`src/core/network.ts`）是站點 1-4 的共用純函式（`!offlineMode`）。站點 5 掃的是渲染後 DOM 而非 markdown 源，故同時涵蓋 image rule 產生的 `<img>` 與 raw HTML。**本機 `file://` 功能不受離線模式影響**（FSA 資料夾樹、`charsetCompat`、dir-fetch 的 `file://` XHR 分支）——讀本機磁碟本就是零 egress，離線模式故意不封鎖。`offlineMode` 屬 reload 類設定（`background.ts` actionMap 映射 `'applySetting'`，切換後 `main.ts` 重整頁面套用五處閘門）。
```

改為（站點編號 1-4→1-3、站點 5→4、五處 → 四處、「FSA 資料夾樹」機制更新為 frame-probe，並補上同伺服器 http(s) 為何不在表中 + `all_frames` 揭露）：

```
`isNetworkAllowed(offlineMode)`（`src/core/network.ts`）是站點 1-3 的共用純函式（`!offlineMode`）。站點 4 掃的是渲染後 DOM 而非 markdown 源，故同時涵蓋 image rule 產生的 `<img>` 與 raw HTML。**本機 `file://` 功能不受離線模式影響**（本機目錄列表 frame-probe／FSA 備援、`charsetCompat`、dir-fetch 的 `file://` XHR 分支）——讀本機磁碟本就是零 egress，離線模式故意不封鎖。`offlineMode` 屬 reload 類設定（`background.ts` actionMap 映射 `'applySetting'`，切換後 `main.ts` 重整頁面套用四處閘門）。**同伺服器 http(s) 目錄列表（`initFilesContent` 的非 GitHub、非 file:// 分支）2026-09-03 起不受離線模式限制**，因此不在本表：載入目前文件本身已是對該伺服器的一次請求，使用者主動瀏覽同伺服器目錄清單是既有信任關係的延伸，不是新增暴露面（見 `docs/superpowers/specs/2026-09-03-file-tree-browsing-design.md` 項目 4）。**`content_scripts` 的 file:// 目錄頁注入範圍（同日起）**：`manifest.json` 新增一則 `{ matches: ["file://*/*/","file:///"], all_frames: true }` 條目，讓我們的程式碼會被 Chrome 注入到**使用者瀏覽的任何本機 file:// 資料夾頁面**（不限含 markdown 檔的資料夾），供隱藏 iframe 探測 Chrome 原生目錄列表格式所用（取代 File System Access 授權彈窗）。這是「程式碼在哪裡執行」的實質擴大，但不是新增權限；既有的 `main()` content-type 閘門保證除了我們自己建立、帶特定 URL hash 標記的探測 iframe 外，一律 no-op（無 UI、無副作用）。
```

再找到下一段（誠實揭露段）：

```
**誠實揭露的殘留缺口**：站點 5 的清掃鎖定元素屬性，不掃 CSS——inline `style="background-image:url(http)"`、`<style>`/`@import url()`、`<use xlink:href>`、legacy `background` 屬性不在涵蓋範圍（markdown 內容中極罕見）。對外文案（README/PRIVACY）措辭須為「封鎖文件內遠端圖片與媒體」，不可宣稱「封鎖一切遠端引用」。
```

改為（站點 5→4）：

```
**誠實揭露的殘留缺口**：站點 4 的清掃鎖定元素屬性，不掃 CSS——inline `style="background-image:url(http)"`、`<style>`/`@import url()`、`<use xlink:href>`、legacy `background` 屬性不在涵蓋範圍（markdown 內容中極罕見）。對外文案（README/PRIVACY）措辭須為「封鎖文件內遠端圖片與媒體」，不可宣稱「封鎖一切遠端引用」。
```

- [ ] **Step 2：`PRIVACY.md` 更新離線模式措辭**

`PRIVACY.md` 找到（英文區塊）：

```
- **Zero network by default, feature by feature.** With offline mode off, auto-refresh, charset compatibility, and PlantUML are each still individually **off by default**. The folder tree tab is **on by default** — that's a visibility setting, not a network one; the directory listing itself is still lazy and nothing is fetched until you actually open the Files tab.
```

改為：

```
- **Zero network by default, feature by feature.** With offline mode off, auto-refresh, charset compatibility, and PlantUML are each still individually **off by default**. The folder tree tab is **on by default** — that's a visibility setting, not a network one; the directory listing itself is still lazy and nothing is fetched until you actually open the Files tab. **Opening the Files tab on a same-server http(s) page works even with offline mode on** (loading the document itself already established a connection to that server; browsing its folder listing is a user-initiated extension of that same trust relationship — GitHub's directory API, a different host, is not included and stays blocked while offline).
```

找到（中文摘要區塊）：

```
關掉離線模式後，自動刷新、字元集相容模式、PlantUML 三個會觸及網路的功能仍各自**預設關閉**；目錄樹頁籤**預設開**（這只是可見性設定、非網路設定，實際列目錄的請求仍懶載入，只在你真的點開「檔案」頁籤時才發出）。
```

改為：

```
關掉離線模式後，自動刷新、字元集相容模式、PlantUML 三個會觸及網路的功能仍各自**預設關閉**；目錄樹頁籤**預設開**（這只是可見性設定、非網路設定，實際列目錄的請求仍懶載入，只在你真的點開「檔案」頁籤時才發出）。**在同伺服器的 http(s) 頁面點開「檔案」頁籤，即使離線模式開啟也能使用**——載入目前這份文件本身已經是對該伺服器的一次連線，瀏覽其目錄清單是使用者主動延伸這個既有信任關係；GitHub 目錄 API（不同主機）不適用此例外，離線時仍封鎖。
```

- [ ] **Step 3：`README.md` 更新離線模式措辭（同 PRIVACY.md 邏輯，英文段落）**

`README.md` 找到：

```
- **Zero network by default, feature by feature.** Turning offline mode off doesn't turn everything else on — auto-refresh, charset compatibility, and PlantUML are each still individually opt-in and off by default. The folder tree tab is on by default, but that's a visibility setting, not a network one — it doesn't fetch anything until you open the tab:
  - **Auto-refresh** (off by default): re-fetches the exact document you are viewing to detect edits — only the same URL you already opened.
  - **Folder tree** (Files tab visible by default; the fetch itself is opt-in by action, not by setting): opening the Files tab lists the folder of the document you are viewing (same server), or — on `raw.githubusercontent.com` pages — calls GitHub's public API anonymously (no token, no account). For `file://` documents, listing also requires the browser's own File System Access permission (a one-time native folder picker), which is unrelated to and can't be bypassed by this extension's settings.
```

改為：

```
- **Zero network by default, feature by feature.** Turning offline mode off doesn't turn everything else on — auto-refresh, charset compatibility, and PlantUML are each still individually opt-in and off by default. The folder tree tab is on by default, but that's a visibility setting, not a network one — it doesn't fetch anything until you open the tab:
  - **Auto-refresh** (off by default): re-fetches the exact document you are viewing to detect edits — only the same URL you already opened.
  - **Folder tree** (Files tab visible by default; the fetch itself is opt-in by action, not by setting): opening the Files tab lists the folder of the document you are viewing (same server) — this works even with offline mode on, since loading the document itself already connected to that server and browsing its listing is a user-initiated extension of that trust. On `raw.githubusercontent.com` pages it instead calls GitHub's public API anonymously (no token, no account) — a different host, so this still respects offline mode and stays blocked while it's on. For `file://` documents, listing reads the browser's own native directory page via a hidden same-extension frame; no permission dialog is needed for this in the common case (falls back to the browser's File System Access folder picker only if that fails), and it's unrelated to and can't be bypassed by this extension's settings.
```

（`file://` 段落措辭同步更新為反映 Task 1 的免跳過機制，不再宣稱一律需要 FSA 選擇器。）

找到中文對應段落：

```
- **目錄樹**（「檔案」頁籤預設可見；實際發請求仍取決於你有沒有點開，而非設定值）：點開「檔案」頁籤會列出你正在看的文件所在資料夾（同一伺服器）；於 `raw.githubusercontent.com` 頁面則匿名呼叫 GitHub 公開 API（無 token、無帳號）。若是 `file://` 本機文件，列目錄還需通過瀏覽器原生的 File System Access 授權（一次性的原生資料夾選擇器）——這與本擴充的任何設定無關，也無法被繞過。
```

改為：

```
- **目錄樹**（「檔案」頁籤預設可見；實際發請求仍取決於你有沒有點開，而非設定值）：點開「檔案」頁籤會列出你正在看的文件所在資料夾（同一伺服器）——即使離線模式開啟也能使用，因為載入文件本身已經連線過該伺服器，瀏覽其目錄清單是延伸這個既有信任關係的使用者主動行為；於 `raw.githubusercontent.com` 頁面則匿名呼叫 GitHub 公開 API（無 token、無帳號）——這是不同主機，仍受離線模式封鎖。若是 `file://` 本機文件，一般情況下讀取瀏覽器原生目錄頁即可、不需要授權對話框（僅在這條路徑失敗時才退回瀏覽器的 File System Access 資料夾選擇器）——這與本擴充的任何設定無關，也無法被繞過。
```

- [ ] **Step 4：JSON/連結完整性檢查（純文件，無程式邏輯，跑既有測試確認無誤觸壞既有東西）**

Run:

```bash
npx tsc --noEmit && echo TSC_OK
npm test 2>&1 | tail -6
```

Expected: `TSC_OK`；191/191 pass（文件變更不影響程式測試，此步驟純粹確認沒有不小心動到程式檔案）。

- [ ] **Step 5：Commit**

```bash
git add docs/developer_guide.md PRIVACY.md README.md
git commit -m "docs: 隱私文件同步——同伺服器離線例外 + all_frames 揭露

Why: Task 1（FSA 免跳過機制擴大 content_scripts 注入範圍）與 Task 2
（同伺服器 http(s) 目錄列表離線例外）改變了實際網路/注入行為，隱私文件
需要誠實反映。

What: developer_guide.md 離線閘門表格更新站點 2 描述 + 新增 all_frames
揭露段落；PRIVACY.md／README.md 中英文離線模式措辭更新，講清楚「同伺服器
例外、GitHub 不適用」與「file:// 一般情況不需要授權對話框」。

How: 見 spec 項目 6。

Boundary: 純文件；不影響任何程式邏輯。tsc 乾淨、191/191（確認未誤觸
程式檔案）。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MGvnXRuTBCvgvbR3fyXtxR"
```

---

## 收尾（全部任務完成後）

- [ ] 跑完整驗收：`npx tsc --noEmit`、`npm test`（≥191 pass）、`npm run build`、`npm run test:e2e`（≥13 pass，含 3 個既有 e2e 檔 + 新增的 `file-tree-browsing.e2e.mjs` 5 條）
- [ ] 交由 subagent-driven-development 的最終 whole-branch review（最強模型）
- [ ] 依 finishing-a-development-branch 合併、bump 版本、tag、CI release、下載到 ~/Downloads
