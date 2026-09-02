// End-to-end acceptance for the in-page UI (settings overlay, about modal,
// sidebar resize, privacy rename). Loads the built extension in a real browser
// and drives it with real mouse clicks — this catches CSS/click bugs that
// storage-level unit tests cannot (see v1.5.1 SMUI switch regression).
//
// Local only. See tests/e2e/_harness.mjs for requirements. If the browser is
// unavailable the whole suite skips instead of failing.

import { describe, before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { startMdServer, launchExtension } from './_harness.mjs'

describe('extension in-page UI (e2e)', { timeout: 120000 }, () => {
  let ctx, sw, getStorage, setStorage, server, port, page
  let unavailable = null

  before(async () => {
    try {
      const s = await startMdServer()
      server = s.server
      port = s.port
      const ext = await launchExtension()
      ctx = ext.ctx
      sw = ext.sw
      getStorage = ext.getStorage
      setStorage = ext.setStorage
    } catch (err) {
      unavailable = err.message
      if (server) server.close()
      return
    }
    // offline OFF so the privacy-mode switch inside the overlay is not disabled
    await setStorage({ enable: true, offlineMode: false })
    page = await ctx.newPage()
    page.setDefaultTimeout(10000)
    await page.goto(`http://localhost:${port}/x.md`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
  })

  after(async () => {
    if (ctx) await ctx.close()
    if (server) server.close()
  })

  // Open the ≡ float menu, then click the item whose text matches `re`.
  async function clickMenuItem(re) {
    await page.click('.md-reader__float-menu-btn')
    await page.waitForTimeout(200)
    await page.evaluate(pattern => {
      const rx = new RegExp(pattern)
      const it = [
        ...document.querySelectorAll('.md-reader__float-menu-item'),
      ].find(e => rx.test(e.textContent || ''))
      it && it.click()
    }, re.source)
    await page.waitForTimeout(600)
  }

  test('content script renders the markdown', t => {
    if (unavailable) return t.skip(unavailable)
    // waitForSelector in before() already asserted this; a positive check here
    // keeps the suite meaningful when read in isolation.
    assert.ok(page, 'page should exist')
  })

  test('設定: 頁內浮層開啟、不開新分頁、浮層內開關可 toggle、點外部關閉', async t => {
    if (unavailable) return t.skip(unavailable)
    const pagesBefore = ctx.pages().length
    await clickMenuItem(/設定|Settings|设置/)

    assert.equal(ctx.pages().length, pagesBefore, '不應開新分頁')
    const overlayVisible = await page.evaluate(() => {
      const o = document.querySelector('.md-reader__settings-overlay')
      return !!o && getComputedStyle(o).display !== 'none'
    })
    assert.ok(overlayVisible, '設定浮層應可見')

    const frame = page.frames().find(f => /popup\.html/.test(f.url()))
    assert.ok(frame, 'iframe 應載入 popup.html')

    // toggle the privacy-mode switch INSIDE the iframe → storage flips
    const before = (await getStorage('offlineMode')).offlineMode
    await frame.evaluate(() => {
      const row = [...document.querySelectorAll('.form-item.inline')].find(r =>
        /隱私模式|隐私模式|Privacy Mode/.test(
          r.querySelector('.label-item')?.textContent || '',
        ),
      )
      const s = row?.querySelector('.mdc-switch')
      const b = s.getBoundingClientRect()
      window.__pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    })
    const iframeBox = await (
      await page.evaluateHandle(() =>
        document.querySelector('.md-reader__settings-overlay iframe'),
      )
    )
      .asElement()
      .boundingBox()
    const pt = await frame.evaluate(() => window.__pt)
    await page.mouse.click(iframeBox.x + pt.x, iframeBox.y + pt.y)
    await page.waitForTimeout(400)
    const after = (await getStorage('offlineMode')).offlineMode
    assert.notEqual(after, before, '浮層內點開關應 toggle storage')

    // click outside the overlay → dismiss
    await page.mouse.click(600, 850)
    await page.waitForTimeout(300)
    const closed = await page.evaluate(() => {
      const o = document.querySelector('.md-reader__settings-overlay')
      return !o || getComputedStyle(o).display === 'none'
    })
    assert.ok(closed, '點外部應關閉浮層')
  })

  test('關於: 頁內小視窗含 icon / 版號 / GitHub 連結、不開新分頁', async t => {
    if (unavailable) return t.skip(unavailable)
    const pagesBefore = ctx.pages().length
    await clickMenuItem(/關於|About|关于/)
    assert.equal(ctx.pages().length, pagesBefore, '不應開新分頁')
    const info = await page.evaluate(() => {
      const m = document.querySelector('.md-reader__about-modal')
      if (!m || getComputedStyle(m).display === 'none') return { ok: false }
      return {
        ok: true,
        img: !!m.querySelector('img'),
        name: m.querySelector('.md-reader__about-name')?.textContent,
        version: m.querySelector('.md-reader__about-version')?.textContent,
        link: !!m.querySelector(
          'a[href*="github.com/swchen44/md-reader-lite"]',
        ),
      }
    })
    assert.ok(info.ok, '關於視窗應可見')
    assert.ok(info.img, '應含 icon')
    assert.equal(info.name, 'MD Reader Lite')
    assert.match(info.version || '', /^v\d/, '應顯示版號')
    assert.ok(info.link, '應含 GitHub 連結')
    await page.mouse.click(600, 850)
    await page.waitForTimeout(200)
  })

  test('側欄: 拖曳分隔線可改寬並持久化 (180–560)', async t => {
    if (unavailable) return t.skip(unavailable)
    const varOf = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue('--md-reader-side-width')
          .trim(),
      )
    const before = await varOf()
    const box = await page.evaluate(() => {
      const r = document.querySelector('.md-reader__side-resizer')
      if (!r) return null
      const b = r.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    })
    assert.ok(box, 'resizer 應存在')
    await page.mouse.move(box.x, box.y)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    const after = await varOf()
    assert.notEqual(after, before, '拖曳後 CSS 變數應改變')
    const persisted = (await getStorage('sideWidth')).sideWidth
    assert.ok(
      persisted >= 180 && persisted <= 560,
      `sideWidth 應持久化且夾在 180–560，實得 ${persisted}`,
    )
  })

  test('隱私模式: 浮層內一般頁籤顯示「隱私模式」標籤', async t => {
    if (unavailable) return t.skip(unavailable)
    await clickMenuItem(/設定|Settings|设置/)
    const frame = page.frames().find(f => /popup\.html/.test(f.url()))
    const labels = await frame.evaluate(() =>
      [...document.querySelectorAll('.label-item')].map(e =>
        e.textContent.trim(),
      ),
    )
    assert.ok(
      labels.some(t => /隱私模式|隐私模式|Privacy Mode/.test(t)),
      '應出現隱私模式標籤（離線模式已正名）',
    )
    await page.mouse.click(600, 850)
    await page.waitForTimeout(200)
  })
})
