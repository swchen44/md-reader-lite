// Regression coverage for the 2026-09-03 folderTree default change: the
// "Files" tab is visible by default (no settings trip required), but that
// visibility must NOT cost a network request — the directory listing stays
// lazy, fetched only when the user actually opens the tab. This is the
// property the "zero network on page load" privacy claim depends on.
//
// Local only. See tests/e2e/_harness.mjs for requirements.

import { describe, before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { startMdServer, launchExtension } from './_harness.mjs'

describe('folder tree default visibility (e2e)', { timeout: 60000 }, () => {
  let ctx, sw, setStorage, server, port, page
  let requestsToMdServer = []
  let unavailable = null

  before(async () => {
    try {
      const s = await startMdServer()
      server = s.server
      port = s.port
      const ext = await launchExtension()
      ctx = ext.ctx
      sw = ext.sw
      setStorage = ext.setStorage
    } catch (err) {
      unavailable = err.message
      if (server) server.close()
      return
    }
    // Fresh defaults: `folderTree` left untouched so getDefaultData()'s `true`
    // default is what's actually exercised. offlineMode is set false because
    // it's a separate, pre-existing network gate (see developer_guide.md)
    // that would otherwise block the directory-listing fetch in the last
    // test below independently of folderTree's visibility default; it's a
    // reload-class setting so it must be set before first navigation, not
    // patched mid-test.
    await setStorage({ enable: true, offlineMode: false })
    page = await ctx.newPage()
    page.setDefaultTimeout(10000)
    page.on('request', req => {
      if (new URL(req.url()).port === String(port)) {
        requestsToMdServer.push(req.url())
      }
    })
    await page.goto(`http://localhost:${port}/x.md`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    // Give any stray async fetch (there shouldn't be one) time to fire.
    await page.waitForTimeout(500)
  })

  after(async () => {
    if (ctx) await ctx.close()
    if (server) server.close()
  })

  test('Files tab is visible by default without touching settings', async t => {
    if (unavailable) return t.skip(unavailable)
    const visible = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      return !!btn && getComputedStyle(btn).display !== 'none'
    })
    assert.ok(visible, 'Files tab button should be visible by default')
  })

  test('page load with default settings makes exactly one request (the document itself) — opening the Files tab fetches nothing on its own', async t => {
    if (unavailable) return t.skip(unavailable)
    assert.deepEqual(
      requestsToMdServer,
      [`http://localhost:${port}/x.md`],
      'folderTree defaulting to true must only affect tab visibility, not fire a directory-listing request on load',
    )
  })

  test('clicking the Files tab now fetches the directory listing (lazy load confirmed to actually work)', async t => {
    if (unavailable) return t.skip(unavailable)
    requestsToMdServer.length = 0
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.md-reader__side-tab')].find(
        b => /檔案|Files|文件/.test(b.textContent || ''),
      )
      btn && btn.click()
    })
    await page.waitForTimeout(500)
    assert.ok(
      requestsToMdServer.length > 0,
      'opening the Files tab should trigger the (same-origin) directory-listing probe',
    )
  })
})
