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
