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
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-option'),
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
    await p.evaluate(() => {
      const btn = [
        ...document.querySelectorAll('.md-reader__tree-settings-option'),
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
})
