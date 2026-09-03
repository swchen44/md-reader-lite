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

const clickFilesTab = () =>
  [...document.querySelectorAll('.md-reader__side-tab')]
    .find(b => /檔案|Files|文件/.test(b.textContent || ''))
    ?.click()

const treeEntryTexts = () =>
  [
    ...document.querySelectorAll('.md-reader__tree-file, .md-reader__tree-dir'),
  ].map(e => e.textContent.trim())

describe('file-tree browsing (e2e)', { timeout: 120000 }, () => {
  let ctx, setStorage
  let unavailable = null

  before(async () => {
    try {
      const ext = await launchExtension()
      ctx = ext.ctx
      setStorage = ext.setStorage
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
    await p.evaluate(clickFilesTab)
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
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1000)
    const entries = await p.evaluate(treeEntryTexts)
    assert.ok(entries.includes('b.md'), 'sibling listing should succeed')
    await p.close()
    server.close()
  })

  test('GitHub directory tree: offline mode ON still blocks it (different host, regression lock)', async t => {
    if (unavailable) return t.skip(unavailable)
    await setStorage({ enable: true, offlineMode: true, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    // Hermetic: intercept the raw.githubusercontent.com navigation itself so
    // this test needs no real network access and can't flake on it.
    await p.route('https://raw.githubusercontent.com/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'text/markdown; charset=utf-8',
        body: '# GH Doc\n',
      }),
    )
    await p.goto(
      'https://raw.githubusercontent.com/fakeorg/fakerepo/main/README.md',
      { waitUntil: 'domcontentloaded' },
    )
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1000)
    const state = await p.evaluate(() => ({
      entries: [
        ...document.querySelectorAll(
          '.md-reader__tree-file, .md-reader__tree-dir',
        ),
      ].map(e => e.textContent.trim()),
      msgShown: !!document.querySelector('.md-reader__tree-msg'),
    }))
    assert.deepEqual(
      state.entries,
      [],
      'GitHub directory listing must stay blocked while offline',
    )
    assert.equal(
      state.msgShown,
      true,
      'a blocked/error message should render instead',
    )
    await p.close()
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
    await p.evaluate(clickFilesTab)
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

  test('sort/filter toolbar: sort by size (ascending)', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1500)
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.click('.md-reader__tree-settings-submenu-trigger')
    await p.waitForTimeout(300)
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-check-option'),
      ].find(b => /大小|Size/.test(b.textContent || ''))
      btn && btn.click()
    })
    await p.waitForTimeout(500)
    // main.md ("# Main\n" = 7 bytes) < sibling.md ("# Sibling\n" = 10 bytes);
    // folders-first stays on by default, so subfolder still leads. The '../'
    // parent-dir link also renders as a .md-reader__tree-file > a (same
    // class as real file rows) — exclude it, it isn't part of the sort.
    const fileEntries = await p.evaluate(() =>
      [...document.querySelectorAll('.md-reader__tree-file a')]
        .map(a => a.textContent.trim())
        .filter(name => name !== '../'),
    )
    assert.deepEqual(
      fileEntries,
      ['main.md', 'sibling.md'],
      'files should be sorted by size ascending',
    )
    await p.close()
  })

  test('sort/filter toolbar: hide dotfiles', async t => {
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
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1500)
    const beforeHide = await p.evaluate(treeEntryTexts)
    assert.ok(
      beforeHide.includes('.hidden.md'),
      'dotfiles are shown by default',
    )
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.click('.md-reader__tree-settings-submenu-trigger')
    await p.waitForTimeout(300)
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-check-option'),
      ].find(b => /隱藏|Hidden/.test(b.textContent || ''))
      btn && btn.click()
    })
    await p.waitForTimeout(500)
    const afterHide = await p.evaluate(treeEntryTexts)
    assert.ok(!afterHide.includes('.hidden.md'))
    await p.close()
  })

  test('sort/filter toolbar: collapse all closes an expanded subfolder', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1500)
    await p.evaluate(() => {
      const dir = [
        ...document.querySelectorAll('.md-reader__tree-dir span'),
      ].find(e => /subfolder/.test(e.textContent || ''))
      dir && dir.click()
    })
    await p.waitForTimeout(1000)
    const openBefore = await p.evaluate(
      () => document.querySelectorAll('.md-reader__tree-dir--open').length,
    )
    assert.equal(openBefore, 1, 'subfolder should be expanded')
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-item'),
      ].find(b => /摺疊全部|Collapse/.test(b.textContent || ''))
      btn && btn.click()
    })
    await p.waitForTimeout(500)
    const openAfter = await p.evaluate(
      () => document.querySelectorAll('.md-reader__tree-dir--open').length,
    )
    assert.equal(openAfter, 0, 'collapse all should close the subfolder')
    await p.close()
  })

  test('root persistence: clicking a file inside an expanded subfolder must not re-root the tree', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：createFileTree() 過去每次都用 dirOf(目前網址) 當根目錄，
    // 點進子資料夾裡的檔案（file:// 是完整導覽，內容腳本整份重跑）就會
    // 讓子資料夾變成新的根，使用者原本展開的上層結構整個消失。
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1200)
    await p.evaluate(() => {
      const dirSpan = [
        ...document.querySelectorAll('.md-reader__tree-dir span'),
      ].find(e => /subfolder/.test(e.textContent || ''))
      dirSpan && dirSpan.click()
    })
    await p.waitForTimeout(1000)
    await p.evaluate(() => {
      const link = [
        ...document.querySelectorAll('.md-reader__tree-file a'),
      ].find(a => a.textContent.trim() === 'child.md')
      link && link.click()
    })
    await p.waitForURL(/child\.md$/, { timeout: 10000 })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.waitForTimeout(1200)
    const entries = await p.evaluate(treeEntryTexts)
    assert.ok(
      entries.some(t => t === 'main.md'),
      `root-level main.md should still be visible after entering subfolder/child.md, got ${JSON.stringify(
        entries,
      )}`,
    )
    await p.close()
  })

  test('expand-state persistence: entering a subfolder file keeps that subfolder expanded (no re-click needed)', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：只記住根目錄還不夠——若展開狀態每次重繪都重置，使用者點進
    // 子資料夾裡的檔案後，那個子資料夾會摺疊回去，還是得重新點開才看得
    // 到裡面其他檔案（例如 subfolder/child.md 的手足檔案）。
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1200)
    await p.evaluate(() => {
      const dirSpan = [
        ...document.querySelectorAll('.md-reader__tree-dir span'),
      ].find(e => /subfolder/.test(e.textContent || ''))
      dirSpan && dirSpan.click()
    })
    await p.waitForTimeout(1000)
    await p.evaluate(() => {
      const link = [
        ...document.querySelectorAll('.md-reader__tree-file a'),
      ].find(a => a.textContent.trim() === 'child.md')
      link && link.click()
    })
    await p.waitForURL(/child\.md$/, { timeout: 10000 })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.waitForTimeout(1500)
    const openCount = await p.evaluate(
      () => document.querySelectorAll('.md-reader__tree-dir--open').length,
    )
    assert.equal(
      openCount,
      1,
      'subfolder should still be expanded after navigating into its child.md, without re-clicking',
    )
    await p.close()
  })

  test('collapse-all clears the expand-state memory, not just the current view', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1000)
    await p.evaluate(() => {
      const dirSpan = [
        ...document.querySelectorAll('.md-reader__tree-dir span'),
      ].find(e => /subfolder/.test(e.textContent || ''))
      dirSpan && dirSpan.click()
    })
    await p.waitForTimeout(1000)
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-item'),
      ].find(b => /摺疊全部|Collapse/.test(b.textContent || ''))
      btn && btn.click()
    })
    await p.waitForTimeout(500)

    await p.goto(`file://${dir}/subfolder/child.md`, {
      waitUntil: 'domcontentloaded',
    })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1200)
    const openCount = await p.evaluate(
      () => document.querySelectorAll('.md-reader__tree-dir--open').length,
    )
    assert.equal(openCount, 0, '摺疊全部後，重新導覽不應該又自動展開回來')
    await p.close()
  })

  test('tree-settings menu font size matches the ≡ float menu (visual symmetry)', async t => {
    if (unavailable) return t.skip(unavailable)
    const dir = makeFileFixture()
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1000)
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.click('.md-reader__float-menu-btn')
    await p.waitForTimeout(300)
    const sizes = await p.evaluate(() => ({
      tree: getComputedStyle(
        document.querySelector('.md-reader__tree-settings-item'),
      ).fontSize,
      float: getComputedStyle(
        document.querySelector('.md-reader__float-menu-item'),
      ).fontSize,
    }))
    assert.equal(
      sizes.tree,
      sizes.float,
      `tree-settings menu font-size (${sizes.tree}) should match the ≡ menu (${sizes.float})`,
    )
    await p.close()
  })

  test('side resizer must not intercept clicks under an open tree-settings submenu', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：子選單開啟時視覺上蓋住側欄拖曳把手的範圍，滑鼠事件也必須
    // 真的落在選單上（z-index 蓋過把手），不能被底下的把手搶走。
    const dir = makeFileFixture()
    await setStorage({
      enable: true,
      offlineMode: false,
      folderTree: true,
      sideWidth: 260,
    })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1000)
    await p.click('.md-reader__tree-settings-btn')
    await p.waitForTimeout(300)
    await p.click('.md-reader__tree-settings-submenu-trigger')
    await p.waitForTimeout(300)
    const hit = await p.evaluate(() => {
      const resizer = document.querySelector('.md-reader__side-resizer')
      const submenu = document.querySelector(
        '.md-reader__tree-settings-submenu',
      )
      const rr = resizer.getBoundingClientRect()
      const sr = submenu.getBoundingClientRect()
      const x = Math.max(rr.left, sr.left) + 2
      const y = sr.top + 10
      const el = document.elementFromPoint(x, y)
      return {
        isResizer: el === resizer,
        isInsideSubmenu: submenu.contains(el),
      }
    })
    assert.equal(hit.isResizer, false, '拖曳把手不應搶走子選單範圍內的滑鼠事件')
    assert.ok(hit.isInsideSubmenu, '該座標應命中子選單本身')
    await p.close()
  })

  test('search persistence: clicking a filtered file keeps the search box open and the tree filtered', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：用檔名搜尋過濾出結果後點裡面的檔案連結（file:// 是完整
    // 導覽），若查詢字串跟搜尋框開啟狀態沒有跟著記住，畫面會瞬間從
    // 「已過濾」跳回「全部展開、搜尋框關閉」，看起來像搜尋結果憑空消失。
    const dir = makeFileFixture()
    writeFileSync(join(dir, 'cscope-bugs.md'), '# Bug doc\n')
    await setStorage({ enable: true, offlineMode: false, folderTree: true })
    const p = await ctx.newPage()
    p.setDefaultTimeout(10000)
    await p.goto(`file://${dir}/main.md`, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.evaluate(clickFilesTab)
    await p.waitForTimeout(1000)
    await p.click('.md-reader__side-search-btn')
    await p.waitForTimeout(300)
    await p.fill('.md-reader__search-input', 'bug')
    await p.waitForTimeout(500)

    await p.evaluate(() => {
      const link = [
        ...document.querySelectorAll('.md-reader__tree-file a'),
      ].find(a => a.textContent.trim() === 'cscope-bugs.md')
      link && link.click()
    })
    await p.waitForURL(/cscope-bugs\.md$/, { timeout: 10000 })
    await p.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await p.waitForTimeout(1500)

    const after = await p.evaluate(() => {
      const bar = document.querySelector('.md-reader__search-bar')
      const input = document.querySelector('.md-reader__search-input')
      return {
        barVisible: !!bar && getComputedStyle(bar).display !== 'none',
        inputValue: input ? input.value : null,
        visibleFiles: [...document.querySelectorAll('.md-reader__tree-file a')]
          .filter(
            a =>
              !a
                .closest('.md-reader__tree-file')
                ?.classList.contains('md-reader__tree-filtered-hidden'),
          )
          .map(a => a.textContent.trim()),
      }
    })
    assert.ok(after.barVisible, '搜尋框應在還原後仍是開啟狀態')
    assert.equal(after.inputValue, 'bug', '搜尋框應保留原本輸入的查詢字串')
    assert.deepEqual(
      after.visibleFiles,
      ['../', 'cscope-bugs.md'],
      '導覽後樹狀結構應維持過濾結果，而不是跳回全部展開',
    )
    await p.close()
  })
})
