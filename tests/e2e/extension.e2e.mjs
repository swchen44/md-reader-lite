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

  test('sessionStorage 被拋 SecurityError（沙盒文件）也不能讓 main() 中斷渲染', async t => {
    if (unavailable) return t.skip(unavailable)
    // 頁籤記憶功能會讀寫 sessionStorage；某些頁面（例如把 md 內容嵌進缺
    // allow-same-origin 的沙盒 iframe）存取 sessionStorage 會直接拋
    // SecurityError。這裡在 content script 執行前就讓 sessionStorage
    // getter 拋錯，模擬那個情境，確認畫面仍然渲染出來（迴歸鎖：曾經因為
    // 這個未防護的呼叫讓整個 main() 中斷、內容完全顯示不出來）。
    const sandboxedPage = await ctx.newPage()
    await sandboxedPage.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException(
            "Failed to read the 'sessionStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag.",
            'SecurityError',
          )
        },
      })
    })
    await sandboxedPage.goto(`http://localhost:${port}/x.md`, {
      waitUntil: 'domcontentloaded',
    })
    await sandboxedPage.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    const text = await sandboxedPage.textContent('.md-reader__markdown-content')
    assert.ok(text.trim().length > 0, 'sessionStorage 拋錯時內容仍應渲染')
    await sandboxedPage.close()
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

  test('≡ 選單: 「設定」緊鄰在「關於」前面', async t => {
    if (unavailable) return t.skip(unavailable)
    await page.click('.md-reader__float-menu-btn')
    await page.waitForTimeout(200)
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.md-reader__float-menu-item')].map(e =>
        e.textContent.trim(),
      ),
    )
    await page.mouse.click(600, 850)
    await page.waitForTimeout(200)
    assert.equal(order.length, 5, '選單應有 5 個項目')
    const settingsIdx = order.length - 2
    const aboutIdx = order.length - 1
    assert.match(
      order[settingsIdx],
      /設定|Settings|设置/,
      '倒數第二項應是「設定」',
    )
    assert.match(order[aboutIdx], /關於|About|关于/, '最後一項應是「關於」')
  })

  test('設定: 切換語言（頁面重整）後再次打開不應閃退', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：頁籤記憶功能上線前，SMUI <Select> 在 storage.get() 回填語言
    // 值時會誤觸發 MDCSelect:change，導致「language -> reload」被重複送出，
    // 使剛打開的設定浮層在下一次開啟時瞬間被整頁重整關掉。
    const langPage = await ctx.newPage()
    await setStorage({ enable: true, offlineMode: false, language: 'en' })
    await langPage.goto(`http://localhost:${port}/x.md`, {
      waitUntil: 'domcontentloaded',
    })
    await langPage.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })

    async function openSettingsOn(p) {
      await p.click('.md-reader__float-menu-btn')
      await p.waitForTimeout(200)
      await p.evaluate(() => {
        const it = [
          ...document.querySelectorAll('.md-reader__float-menu-item'),
        ].find(e => /設定|Settings|设置/.test(e.textContent || ''))
        it && it.click()
      })
      await p.waitForTimeout(400)
    }

    await openSettingsOn(langPage)
    const frame = langPage.frames().find(f => /popup\.html/.test(f.url()))
    await frame.evaluate(() => {
      const row = [...document.querySelectorAll('.form-item')].find(r =>
        /Language/.test(r.querySelector('.label-item')?.textContent || ''),
      )
      const sel = row?.querySelector('.mdc-select__anchor, .mdc-select')
      sel && sel.click()
    })
    await langPage.waitForTimeout(300)
    await frame.evaluate(() => {
      const opt = [
        ...document.querySelectorAll(
          '.mdc-deprecated-list-item, [role="option"]',
        ),
      ].find(e => e.textContent.trim() === '繁體中文')
      opt && opt.click()
    })
    await langPage
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 })
      .catch(() => {})
    await langPage.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await langPage.waitForTimeout(300)
    assert.equal(
      (await getStorage('language')).language,
      'zh-TW',
      '語言切換本身應該真的生效',
    )

    await openSettingsOn(langPage)
    const visibleRightAfterOpen = await langPage.evaluate(() => {
      const o = document.querySelector('.md-reader__settings-overlay')
      return !!o && getComputedStyle(o).display !== 'none'
    })
    await langPage.waitForTimeout(1500)
    const stillVisible = await langPage.evaluate(() => {
      const o = document.querySelector('.md-reader__settings-overlay')
      return !!o && getComputedStyle(o).display !== 'none'
    })
    assert.ok(visibleRightAfterOpen, '重新開啟設定浮層應可見')
    assert.ok(stillVisible, '設定浮層不應在打開後自己閃退關閉')

    await setStorage({ language: 'en' })
    await langPage.close()
  })

  test('擴充停用時，FOUC 防護遮罩不能卡住不放內容', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：index.less 的 loading 遮罩預設蓋住整頁，只有 main.ts 明確
    // 加上 md-reader-ready class 才會掀開。main() 在「擴充已停用」等提早
    // return 的分支都必須補上這個 class，否則畫面會永遠卡在 loading 狀態。
    await setStorage({ enable: false })
    const disabledPage = await ctx.newPage()
    await disabledPage.goto(`http://localhost:${port}/x.md`, {
      waitUntil: 'domcontentloaded',
    })
    await disabledPage.waitForTimeout(1200)
    const state = await disabledPage.evaluate(() => ({
      ready: document.body.classList.contains('md-reader-ready'),
      bodyVisible: document.body.textContent.length > 0,
    }))
    assert.ok(state.ready, '停用時也要補上 md-reader-ready，掀開遮罩')
    assert.ok(state.bodyVisible, '停用時原生內容應該看得到，不能被卡住')
    await disabledPage.close()
    await setStorage({ enable: true })
  })

  test('沙盒頁面（如 GitHub raw 內容）：設定改開新分頁、列印停用並附提示', async t => {
    if (unavailable) return t.skip(unavailable)
    // 迴歸鎖：raw.githubusercontent.com 送出的
    // `Content-Security-Policy: sandbox`（無 allow-* token）會讓瀏覽器把
    // 我們建立的設定 iframe 也一併當成沒有 allow-scripts 的沙盒——畫面
    // 變成一片空白；window.print() 需要 allow-modals token，被擋下時不會
    // 有任何錯誤或對話框，看起來像按鈕壞掉。用 page.route 重現這組真實
    // response header，確認兩個症狀都已修正。
    const sandboxedPage = await ctx.newPage()
    await sandboxedPage.route('https://raw.githubusercontent.com/**', route =>
      route.fulfill({
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'content-security-policy':
            "default-src 'none'; style-src 'unsafe-inline'; sandbox",
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'deny',
        },
        body: '# Architecture\n\nSome content.\n',
      }),
    )
    const pagesOpened = []
    ctx.on('page', pg => pagesOpened.push(pg))
    await sandboxedPage.goto(
      'https://raw.githubusercontent.com/swchen44/md-reader-lite/main/docs/ARCHITECTURE.md',
      { waitUntil: 'domcontentloaded' },
    )
    await sandboxedPage.waitForSelector('.md-reader__markdown-content', {
      timeout: 12000,
    })
    await sandboxedPage.waitForTimeout(500)

    await sandboxedPage.click('.md-reader__float-menu-btn')
    await sandboxedPage.waitForTimeout(300)
    await sandboxedPage.evaluate(() => {
      const it = [
        ...document.querySelectorAll('.md-reader__float-menu-item'),
      ].find(e => /設定|Settings|设置/.test(e.textContent || ''))
      it && it.click()
    })
    await sandboxedPage.waitForTimeout(1000)

    const overlayOpenedInline = await sandboxedPage.evaluate(() => {
      const overlay = document.querySelector('.md-reader__settings-overlay')
      return !!overlay && getComputedStyle(overlay).display !== 'none'
    })
    assert.equal(
      overlayOpenedInline,
      false,
      '沙盒頁面不應該打開內嵌設定浮層（會是空白的）',
    )
    assert.equal(pagesOpened.length, 1, '應該改開一個新分頁載入設定')
    await pagesOpened[0].waitForLoadState('domcontentloaded')
    const settingsRendered = await pagesOpened[0].evaluate(
      () => !!document.querySelector('.form-item'),
    )
    assert.ok(settingsRendered, '新分頁裡的設定表單應該正常渲染出來')
    await pagesOpened[0].close()

    await sandboxedPage.click('.md-reader__float-menu-btn')
    await sandboxedPage.waitForTimeout(300)
    const printState = await sandboxedPage.evaluate(() => {
      const it = [
        ...document.querySelectorAll('.md-reader__float-menu-item'),
      ].find(e => /列印|Print|打印|印刷|인쇄/.test(e.textContent || ''))
      return { disabled: it ? it.disabled : null, title: it ? it.title : null }
    })
    assert.equal(printState.disabled, true, '沙盒頁面的列印選項應該停用')
    assert.ok(
      printState.title && printState.title.length > 0,
      '停用的列印選項應該附上說明提示',
    )
    await sandboxedPage.close()
  })
})
