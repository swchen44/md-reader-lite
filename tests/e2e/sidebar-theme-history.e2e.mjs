import { describe, before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { launchExtension } from './_harness.mjs'

const article =
  '# Reading notes\n\n## Alpha heading\n\nAlpha text and Beta notes.\n\n## 中文搜尋\n\n中文內容。'
const QA = new URL('../../dist/qa/sidebar-theme-history/', import.meta.url)
describe('sidebar theme and search history (e2e)', () => {
  let ctx, page, server, url, setStorage, getStorage, sw
  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.end('<a href="notes.md">notes.md</a>')
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.end(article)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${server.address().port}/notes.md`
    ;({ ctx, setStorage, getStorage, sw } = await launchExtension())
    page = await ctx.newPage()
    page.setDefaultTimeout(5000)
    await mkdir(QA, { recursive: true })
  })
  after(async () => {
    if (ctx) await ctx.close()
    if (server) await new Promise(resolve => server.close(resolve))
  })
  async function open(extra = {}, width = 1200) {
    await page.close()
    page = await ctx.newPage()
    page.setDefaultTimeout(5000)
    await setStorage({
      language: 'en',
      enable: true,
      hiddenSide: false,
      sideWidth: 260,
      pageTheme: 'light',
      customCssEnabled: false,
      searchHistory: [],
      searchHistoryLimit: 10,
      offlineMode: true,
      ...extra,
    })
    await page.setViewportSize({ width, height: 900 })
    await page.goto(url)
    await page.waitForSelector('.md-reader__markdown-content')
    if (await page.locator('body.side-collapsed').count()) {
      await page.locator('.md-reader__btn--side-expand').click()
      await delay(350)
    }
    await page.locator('.md-reader__side-tab').first().click()
  }
  async function search(target = page) {
    await target.locator('.md-reader__side-search-btn').click()
    return target.locator('.md-reader__search-input')
  }
  async function stored(expected) {
    for (let i = 0; i < 50; i++) {
      if (
        JSON.stringify((await getStorage('searchHistory')).searchHistory) ===
        JSON.stringify(expected)
      )
        return
      await delay(20)
    }
    assert.deepEqual(
      (await getStorage('searchHistory')).searchHistory,
      expected,
    )
  }
  for (const [theme, width, customCssEnabled] of [
    ['light', 1200, false],
    ['dark', 390, false],
    ['light', 320, true],
  ])
    test(`Anthropic sidebar uses paper/ink/accent independently of article at ${theme}/${width}`, async () => {
      await open({ pageTheme: theme, customCssEnabled }, width)
      const colors = await page
        .locator('.md-reader__side-tabs')
        .evaluate(el => ({
          paper: getComputedStyle(el).backgroundColor,
          ink: getComputedStyle(el.querySelector('.md-reader__side-tab')).color,
          accent: getComputedStyle(
            el.querySelector('.md-reader__side-tab--active'),
          ).color,
          font: getComputedStyle(el.querySelector('.md-reader__side-tab'))
            .fontFamily,
        }))
      assert.equal(colors.paper, 'rgb(250, 249, 245)')
      assert.equal(colors.accent, 'rgb(163, 79, 55)')
      assert.match(colors.font, /Georgia/)
      await page.screenshot({
        path: new URL(`${theme}-${width}-outline.png`, QA).pathname,
      })
      const input = await search()
      await input.fill('Alpha')
      await page.waitForSelector('.md-reader__search-item')
      assert.equal(
        await page
          .locator('.md-reader__search-panel')
          .evaluate(el => getComputedStyle(el).backgroundColor),
        'rgb(250, 249, 245)',
      )
      await page.screenshot({
        path: new URL(`${theme}-${width}.png`, QA).pathname,
      })
    })
  test('file tree and portaled submenu retain the same light paper on a dark page', async () => {
    await open({ pageTheme: 'dark' })
    await page.locator('.md-reader__side-tab').nth(1).click()
    await page.locator('.md-reader__tree-settings-btn').click()
    await page.locator('.md-reader__tree-settings-submenu-trigger').click()
    for (const selector of [
      '.md-reader__file-tree',
      '.md-reader__tree-settings-menu',
      '.md-reader__tree-settings-submenu',
    ])
      assert.equal(
        await page
          .locator(selector)
          .evaluate(el => getComputedStyle(el).backgroundColor),
        'rgb(250, 249, 245)',
      )
    await page.screenshot({ path: new URL('files-menu.png', QA).pathname })
  })
  test('Enter persists a new query and reopening empty search exposes recent history', async () => {
    await open()
    const input = await search()
    await input.fill('Alpha')
    await delay(200)
    await stored([])
    await input.press('Enter')
    await stored(['Alpha'])
    await input.press('Escape')
    await search()
    assert.deepEqual(
      await page.locator('.md-reader__search-suggestion').allTextContents(),
      ['Alpha'],
    )
    await page.reload()
    await page.waitForSelector('.md-reader__side-search-btn')
    await search()
    assert.deepEqual(
      await page.locator('.md-reader__search-suggestion').allTextContents(),
      ['Alpha'],
    )
  })
  test('numeric keypad Enter commits just like the main Enter key', async () => {
    await open()
    const input = await search()
    await input.fill('Beta')
    await input.press('NumpadEnter')
    await stored(['Beta'])
  })
  test('IME confirmation does not record partial text; a following Enter records Chinese', async () => {
    await open()
    const input = await search()
    await input.fill('中文搜尋')
    await input.evaluate(el =>
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          isComposing: true,
          bubbles: true,
        }),
      ),
    )
    await delay(100)
    await stored([])
    await input.press('Enter')
    await stored(['中文搜尋'])
  })
  test("two already-open documents preserve each other's committed history", async () => {
    await open()
    const other = await ctx.newPage()
    try {
      await other.goto(url)
      await other.waitForSelector('.md-reader__side-search-btn')
      const a = await search()
      await a.fill('Alpha')
      await a.press('Enter')
      await stored(['Alpha'])
      const b = await search(other)
      await b.fill('Beta')
      await b.press('Enter')
      await stored(['Beta', 'Alpha'])
    } finally {
      await other.close()
    }
  })
  test('external clear/disable immediately removes visible history suggestions', async () => {
    await open({ searchHistory: ['Alpha'] })
    const input = await search()
    await input.fill('Al')
    await page.waitForSelector('.md-reader__search-suggestion')
    await setStorage({ searchHistory: [] })
    await delay(100)
    assert.equal(await page.locator('.md-reader__search-suggestion').count(), 0)
    await setStorage({ searchHistory: ['Alpha'], searchHistoryLimit: 0 })
    await input.fill('Al')
    await input.press('Enter')
    await stored(['Alpha'])
    assert.equal(await page.locator('.md-reader__search-suggestion').count(), 0)
    await setStorage({ searchHistoryLimit: 10 })
    await input.fill('')
    await page.waitForSelector('.md-reader__search-suggestion')
    assert.deepEqual(
      await page.locator('.md-reader__search-suggestion').allTextContents(),
      ['Alpha'],
    )
  })
  test('Shift+Tab keeps native backward focus while Tab deliberately completes history', async () => {
    await open({ searchHistory: ['Alpha'] })
    const input = await search()
    await page.waitForSelector('.md-reader__search-suggestion')
    await input.press('Shift+Tab')
    assert.equal(await input.inputValue(), '')
    assert.equal(
      await input.evaluate(el => el === document.activeElement),
      false,
    )
    await stored(['Alpha'])
    await input.focus()
    await input.press('Tab')
    assert.equal(await input.inputValue(), 'Alpha')
    assert.equal(await page.locator('.md-reader__search-suggestion').count(), 0)
  })
  test('Files search records the confirmed term and Outline can reuse it', async () => {
    await open()
    await page.locator('.md-reader__side-tab').nth(1).click()
    await page.waitForSelector('.md-reader__tree-settings-btn')
    const input = await search()
    await input.fill('notes')
    await input.press('Enter')
    await stored(['notes'])
    await input.press('Escape')
    await page.locator('.md-reader__side-tab').first().click()
    await search()
    assert.deepEqual(
      await page.locator('.md-reader__search-suggestion').allTextContents(),
      ['notes'],
    )
  })
  for (const key of ['Enter', 'Tab'])
    test(`${key} preserves a history selection through a live cross-page reorder`, async () => {
      await open({ searchHistory: ['Alpha', 'Beta'] })
      const input = await search()
      await input.fill('a')
      await input.press('ArrowDown')
      await input.press('ArrowDown')
      await setStorage({ searchHistory: ['Gamma', 'Alpha', 'Beta'] })
      await delay(100)
      assert.deepEqual(
        await page
          .locator('.md-reader__search-suggestion--active')
          .allTextContents(),
        ['Beta'],
      )
      await input.press(key)
      assert.equal(await input.inputValue(), 'Beta')
      await stored(['Beta', 'Gamma', 'Alpha'])
    })
  test('late setting echoes cannot override current native history changes', async () => {
    await open({ searchHistory: ['Alpha'] })
    const input = await search()
    await setStorage({ searchHistory: ['Beta'] })
    await delay(100)
    await sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      await chrome.tabs.sendMessage(tab.id, {
        action: 'applySetting',
        data: { key: 'searchHistory', value: ['Alpha'] },
      })
    })
    await input.fill('B')
    assert.deepEqual(
      await page.locator('.md-reader__search-suggestion').allTextContents(),
      ['Beta'],
    )
  })
})
