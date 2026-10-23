import { describe, before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir } from 'node:fs/promises'
import { launchExtension } from './_harness.mjs'

const QA = new URL('../../dist/qa/floating-sidebar/', import.meta.url)
const paragraph =
  'Reading should keep the same line breaks and position while the navigation panel opens or changes width. '.repeat(
    8,
  )
const markdown =
  '# Floating sidebar\n\n' +
  paragraph +
  '\n\n```mermaid\nflowchart LR\n A[Start]-->B[Done]\n```\n\n| Name | Value |\n| --- | --- |\n| Width | Stable |\n\n' +
  Array.from(
    { length: 12 },
    (_, i) => `## Section ${i + 1}\n\n${paragraph}`,
  ).join('\n\n')

describe('floating sidebar (e2e)', { timeout: 120000 }, () => {
  let ctx, sw, page, setStorage, getStorage, server, url
  const requests = []
  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end('<a href="sidebar.md">sidebar.md</a>')
        return
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.end(markdown)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${server.address().port}/sidebar.md`
    ;({ ctx, sw, setStorage, getStorage } = await launchExtension())
    ctx.on('request', request => {
      if (
        /^https?:/.test(request.url()) &&
        !request.url().startsWith(new URL(url).origin + '/')
      )
        requests.push(request.url())
    })
    page = await ctx.newPage()
    page.setDefaultTimeout(8000)
    await mkdir(QA, { recursive: true })
  })
  after(async () => {
    if (ctx) await ctx.close()
    if (server) await new Promise(resolve => server.close(resolve))
  })

  async function open(width = 1200, extra = {}) {
    await setStorage({
      language: 'en',
      enable: true,
      hiddenSide: true,
      sideWidth: 260,
      pageTheme: 'light',
      offlineMode: true,
      customCssEnabled: false,
      customWidth: 85,
      customWidthUnit: 'percent',
      ...extra,
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto(url)
    await ready()
  }
  async function ready() {
    await page.waitForSelector('pre.mermaid[data-mermaid-status="ready"] svg')
    await page.evaluate(() => document.fonts.ready)
  }
  async function isOpen() {
    return page
      .locator('.md-reader__side-tabs')
      .evaluate(el => el.getBoundingClientRect().left >= -1)
  }
  async function setOpen(value) {
    if ((await isOpen()) !== value)
      await page.locator('.md-reader__btn--side-expand').click()
    await page.waitForFunction(open => {
      const box = document
        .querySelector('.md-reader__side-tabs')
        .getBoundingClientRect()
      return open ? Math.abs(box.left) < 1 : box.right <= 1
    }, value)
    await page.waitForTimeout(350)
  }
  async function geometry() {
    return page.evaluate(() => {
      const article = document.querySelector('article')
      const paragraph = article.querySelector('p')
      const range = document.createRange()
      range.selectNodeContents(paragraph)
      const rect = element => {
        const r = element.getBoundingClientRect()
        return { x: r.x, top: r.y + scrollY, width: r.width, height: r.height }
      }
      return {
        article: rect(article),
        paragraph: rect(paragraph),
        table: rect(article.querySelector('table')),
        diagram: rect(article.querySelector('pre.mermaid')),
        lines: range.getClientRects().length,
        scrollY,
      }
    })
  }
  function unchanged(actual, expected) {
    for (const key of ['article', 'paragraph', 'table', 'diagram'])
      for (const field of ['x', 'top', 'width', 'height'])
        assert.ok(
          Math.abs(actual[key][field] - expected[key][field]) < 1,
          `${key}.${field}: ${actual[key][field]} vs ${expected[key][field]}`,
        )
    assert.equal(actual.lines, expected.lines)
    assert.equal(actual.scrollY, expected.scrollY)
  }
  async function dragBy(delta) {
    const handle = page.locator('.md-reader__side-resizer')
    const box = await handle.boundingBox()
    assert.ok(box && box.width > 0 && box.height > 0, 'visible resize edge')
    await page.mouse.move(box.x + box.width / 2, 300)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + delta, 300, { steps: 8 })
  }

  for (const width of [1200, 390, 320])
    test(`open/close/drag preserves article layout at ${width}px`, async () => {
      await open(width)
      await page.evaluate(() => scrollTo(0, 600))
      const before = await geometry()
      await setOpen(true)
      unchanged(await geometry(), before)
      await dragBy(width === 1200 ? 100 : -50)
      assert.equal(
        await isOpen(),
        true,
        'dragging across the old edge must not dismiss',
      )
      unchanged(await geometry(), before)
      await page.mouse.up()
      await page.waitForTimeout(100)
      assert.equal(await isOpen(), true, 'pointer release must not dismiss')
      unchanged(await geometry(), before)
      await page.screenshot({ path: new URL(`open-${width}.png`, QA).pathname })
      await setOpen(false)
      unchanged(await geometry(), before)
      assert.equal(
        await page.locator('.md-reader__side-resizer').isVisible(),
        false,
        'no invisible edge intercepting the article',
      )
    })

  test('mouse resize cursor, persisted width, reopening and reload', async () => {
    await open()
    await setOpen(true)
    const handle = page.locator('.md-reader__side-resizer')
    await handle.hover()
    assert.match(
      await handle.evaluate(el => getComputedStyle(el).cursor),
      /^(col|ew)-resize$/,
    )
    await dragBy(120)
    await page.mouse.up()
    await page.waitForFunction(() => document.body.style.userSelect !== 'none')
    const stored = (await getStorage('sideWidth')).sideWidth
    assert.equal(stored, 380)
    await setOpen(false)
    await setOpen(true)
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => el.getBoundingClientRect().width),
      stored,
    )
    await page.reload()
    await ready()
    await setOpen(true)
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => el.getBoundingClientRect().width),
      stored,
    )
  })

  test('Escape survives other keys, outside clicks still activate article links', async () => {
    await open()
    await setOpen(true)
    await page.keyboard.press('Shift')
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () =>
        document.querySelector('.md-reader__side-tabs').getBoundingClientRect()
          .right <= 1,
    )
    assert.equal(await isOpen(), false)
    await setOpen(true)
    await page.evaluate(() => {
      const a = document.createElement('a')
      a.id = 'article-action'
      a.href = '#article-clicked'
      a.textContent = 'Article action'
      a.style.cssText = 'position:fixed;right:30px;top:150px;z-index:3'
      document.querySelector('article').append(a)
    })
    await page.locator('#article-action').click()
    await page.waitForFunction(
      () =>
        document.querySelector('.md-reader__side-tabs').getBoundingClientRect()
          .right <= 1,
    )
    assert.equal(
      new URL(page.url()).hash,
      '#article-clicked',
      'closing the drawer must not eat the link click',
    )
  })

  test('narrow display clamps the edge without overwriting a saved desktop width', async () => {
    await open(1200, { hiddenSide: false, sideWidth: 480 })
    await setOpen(true)
    await page.setViewportSize({ width: 320, height: 900 })
    await page.waitForTimeout(100)
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => el.getBoundingClientRect().width),
      208,
    )
    assert.equal((await getStorage('sideWidth')).sideWidth, 480)
    assert.equal(await isOpen(), true)
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.waitForTimeout(100)
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => el.getBoundingClientRect().width),
      480,
    )
  })

  test('cancelled pointer drag restores the width and does not dismiss', async () => {
    await open()
    await setOpen(true)
    await dragBy(80)
    await page
      .locator('.md-reader__side-resizer')
      .evaluate(el =>
        el.dispatchEvent(
          new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }),
        ),
      )
    await page.mouse.up()
    await page.waitForTimeout(100)
    assert.equal(await isOpen(), true)
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => el.getBoundingClientRect().width),
      260,
    )
    assert.equal((await getStorage('sideWidth')).sideWidth, 260)
    assert.notEqual(
      await page.evaluate(() => document.body.style.userSelect),
      'none',
    )
  })

  test('keyboard resize is accessible and all five locales name the controls', async () => {
    for (const language of ['en', 'zh-TW', 'zh-CN', 'ko', 'ja']) {
      await open(1200, { language })
      await setOpen(true)
      const handle = page.getByRole('separator')
      assert.ok((await handle.getAttribute('aria-label')).length > 2)
      assert.ok(
        (
          await page
            .locator('.md-reader__btn--side-expand')
            .getAttribute('aria-label')
        ).length > 2,
      )
      await handle.focus()
      await handle.press('ArrowRight')
      await page.waitForTimeout(100)
      assert.equal((await getStorage('sideWidth')).sideWidth, 270)
      assert.equal(await isOpen(), true)
      await handle.press('Home')
      await page.waitForTimeout(100)
      assert.equal((await getStorage('sideWidth')).sideWidth, 180)
      await handle.press('End')
      await page.waitForTimeout(100)
      assert.equal((await getStorage('sideWidth')).sideWidth, 560)
    }
  })

  test('maximum narrow width leaves the sidebar toggle separate from Menu', async () => {
    await open(320, { sideWidth: 560 })
    await setOpen(true)
    const toggle = page.locator('.md-reader__btn--side-expand')
    assert.equal(
      await toggle.evaluate(el => {
        const box = el.getBoundingClientRect()
        return el.contains(
          document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2,
          ),
        )
      }),
      true,
      'Menu must not cover the sidebar toggle',
    )
    await setOpen(false)
  })

  test('closing slides the inert panel out before hiding it', async () => {
    await open()
    await setOpen(true)
    await page.locator('.md-reader__btn--side-expand').click()
    await page.waitForTimeout(50)
    assert.equal(
      await page.locator('.md-reader__side-tabs').evaluate(el => el.inert),
      true,
    )
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => getComputedStyle(el).visibility),
      'visible',
    )
    await page.waitForFunction(
      () =>
        getComputedStyle(document.querySelector('.md-reader__side-tabs'))
          .visibility === 'hidden',
    )
    assert.equal(await isOpen(), false)
  })

  test('IME Escape preserves the drawer and search handles Escape before dismiss', async () => {
    await open()
    await setOpen(true)
    await page.locator('.md-reader__side-search-btn').click()
    await page.locator('.md-reader__search-input').fill('Section')
    await page.locator('.md-reader__search-input').evaluate(el =>
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          isComposing: true,
          bubbles: true,
        }),
      ),
    )
    await page.waitForTimeout(350)
    assert.equal(await isOpen(), true)
    assert.equal(
      await page.locator('.md-reader__search-input').inputValue(),
      'Section',
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(350)
    assert.equal(await isOpen(), true)
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () =>
        document.querySelector('.md-reader__side-tabs').getBoundingClientRect()
          .right <= 1,
    )
  })

  test('pressing the narrow edge without changing width preserves the desktop preference', async () => {
    await open(320, { sideWidth: 480 })
    await setOpen(true)
    await page.locator('.md-reader__side-resizer').hover()
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(100)
    assert.equal((await getStorage('sideWidth')).sideWidth, 480)
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.waitForTimeout(100)
    assert.equal(
      await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => el.getBoundingClientRect().width),
      480,
    )
  })

  test('background toggle during drag preserves actual open state in storage', async () => {
    await open(1200, { hiddenSide: false })
    await setOpen(true)
    await dragBy(80)
    await sw.evaluate(async () => {
      await chrome.storage.local.set({ hiddenSide: true })
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleSide',
        data: { key: 'hiddenSide', value: true },
      })
    })
    await page.waitForTimeout(100)
    assert.equal(await isOpen(), true)
    assert.equal((await getStorage('hiddenSide')).hiddenSide, false)
    await page.mouse.up()
    await page.reload()
    await ready()
    assert.equal(await isOpen(), true)
  })

  test('Escape removes the portaled tree submenu when the sidebar closes', async () => {
    await open()
    await setOpen(true)
    await page.locator('.md-reader__side-tab').nth(1).click()
    await page.locator('.md-reader__tree-settings-btn').click()
    await page.locator('.md-reader__tree-settings-submenu-trigger').click()
    assert.equal(
      await page.locator('.md-reader__tree-settings-submenu').isVisible(),
      true,
    )
    await page.keyboard.press('Escape')
    await page.waitForTimeout(350)
    assert.equal(await isOpen(), false)
    assert.equal(
      await page.locator('.md-reader__tree-settings-submenu').isVisible(),
      false,
    )
    await setOpen(true)
    assert.equal(
      await page.locator('.md-reader__tree-settings-menu').isVisible(),
      false,
    )
  })

  for (const cancellation of ['lostpointercapture', 'blur', 'pagehide'])
    test(`${cancellation} restores width and permits a later drag`, async () => {
      await open()
      await setOpen(true)
      await dragBy(60)
      if (cancellation === 'lostpointercapture') {
        await page
          .locator('.md-reader__side-resizer')
          .evaluate(el => el.releasePointerCapture(1))
        await page.mouse.move(700, 330)
      } else
        await page.evaluate(
          type =>
            window.dispatchEvent(
              type === 'pagehide'
                ? new PageTransitionEvent(type, { persisted: true })
                : new Event(type),
            ),
          cancellation,
        )
      await page.mouse.up()
      if (cancellation === 'pagehide')
        await page.evaluate(() =>
          window.dispatchEvent(
            new PageTransitionEvent('pageshow', { persisted: true }),
          ),
        )
      await page.waitForTimeout(100)
      assert.equal(await isOpen(), true)
      assert.equal(
        await page
          .locator('.md-reader__side-tabs')
          .evaluate(el => el.getBoundingClientRect().width),
        260,
      )
      assert.equal((await getStorage('sideWidth')).sideWidth, 260)
      assert.notEqual(
        await page.evaluate(() => document.body.style.userSelect),
        'none',
      )
      await dragBy(10)
      await page.mouse.up()
      await page.waitForTimeout(100)
      assert.equal((await getStorage('sideWidth')).sideWidth, 270)
    })

  test('raw and print do not leave a resize edge over content', async () => {
    await open()
    await setOpen(true)
    await page.locator('.md-reader__float-menu-btn').click()
    await page.locator('.md-reader__float-menu-item').first().click()
    assert.equal(
      await page.locator('.md-reader__side-resizer').isVisible(),
      false,
    )
    await page.locator('.md-reader__float-menu-btn').click()
    await page.locator('.md-reader__float-menu-item').first().click()
    await setOpen(true)
    await page.emulateMedia({ media: 'print' })
    assert.equal(
      await page.locator('.md-reader__side-resizer').isVisible(),
      false,
    )
    await page.emulateMedia({ media: 'screen' })
    assert.deepEqual(requests, [], 'floating controls add no external requests')
  })
})
