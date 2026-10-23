import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir } from 'node:fs/promises'
import { launchExtension } from './_harness.mjs'

const QA = new URL('../../dist/qa/settings-theme/', import.meta.url)
const FLOW = '# Defaults\n\n```mermaid\nflowchart LR\n A[Start]-->B[Done]\n```'

describe('Anthropic settings and default (e2e)', () => {
  let ctx, sw, extId, setStorage, getStorage, server, url, page
  const requests = []
  before(async () => {
    server = http.createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.end(FLOW)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${server.address().port}/defaults.md`
    ;({ ctx, sw, extId, setStorage, getStorage } = await launchExtension())
    ctx.on('request', request => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(url))
        requests.push(request.url())
    })
    page = await ctx.newPage()
    await mkdir(QA, { recursive: true })
  })
  after(async () => {
    if (ctx) await ctx.close()
    if (server) await new Promise(resolve => server.close(resolve))
  })

  test('fresh and legacy defaults are Anthropic; saved Original remains Original', async () => {
    for (const [name, stored, expected] of [
      ['fresh', null, 'anthropic-blog'],
      ['legacy', { Linkify: { fuzzyLink: false } }, 'anthropic-blog'],
      ['saved', { Mermaid: { style: 'original' } }, 'original'],
    ]) {
      await sw.evaluate(() => chrome.storage.local.clear())
      await setStorage({
        language: 'en',
        offlineMode: true,
        ...(stored ? { mdPluginOptions: stored } : {}),
      })
      await page.goto(url)
      await page.waitForSelector(
        `pre.mermaid[data-mermaid-style="${expected}"][data-mermaid-status="ready"]`,
      )
      if (stored)
        assert.deepEqual(
          (await getStorage('mdPluginOptions')).mdPluginOptions,
          stored,
          name,
        )
      await page.reload()
      await page.waitForSelector(
        `pre.mermaid[data-mermaid-style="${expected}"][data-mermaid-status="ready"]`,
      )
    }
  })

  test('width defaults to 85 percent without migrating stored widths or disabled state', async () => {
    for (const [stored, expected] of [
      [{}, '85%'],
      [{ customWidth: 900 }, '900px'],
      [{ customWidth: 67, customWidthUnit: 'percent' }, '67%'],
      [{ customWidth: null }, ''],
    ]) {
      await sw.evaluate(() =>
        chrome.storage.local.remove(['customWidth', 'customWidthUnit']),
      )
      await setStorage(stored)
      await page.goto(url)
      await page.waitForSelector('pre.mermaid[data-mermaid-status="ready"]')
      const width = await page
        .locator('.md-reader__markdown-content')
        .evaluate(element =>
          element.style.getPropertyValue('--md-reader-content-width'),
        )
      assert.equal(width, expected, JSON.stringify(stored))
      assert.deepEqual(
        await getStorage(['customWidth', 'customWidthUnit']),
        stored,
      )
    }
    await sw.evaluate(() =>
      chrome.storage.local.remove(['customWidth', 'customWidthUnit']),
    )
    await page.goto(`chrome-extension://${extId}/popup.html`)
    await page.locator('.tab-btn').nth(1).press('Enter')
    assert.equal(
      await page.locator('.width-controls input[type="number"]').inputValue(),
      '85',
    )
    assert.equal(
      await page
        .locator('.width-controls input[type="radio"]:checked')
        .inputValue(),
      'percent',
    )
  })

  test('all tabs use local Anthropic tokens and fit narrow viewports in five locales', async () => {
    for (const language of ['en', 'zh-CN', 'zh-TW', 'ko', 'ja']) {
      await setStorage({ language, enable: true })
      for (const width of [320, 360, 390]) {
        await page.setViewportSize({ width, height: 844 })
        await page.goto(`chrome-extension://${extId}/popup.html`)
        await page.waitForFunction(
          locale => document.documentElement.lang === locale,
          language,
        )
        for (let tab = 0; tab < 3; tab++) {
          await page.locator('.tab-btn').nth(tab).press('Enter')
          const appearance = await page.evaluate(() => ({
            paper: getComputedStyle(document.body).backgroundColor,
            primary: getComputedStyle(document.body)
              .getPropertyValue('--mdc-theme-primary')
              .trim(),
            font: getComputedStyle(document.querySelector('h1')).fontFamily,
            overflow: document.documentElement.scrollWidth > innerWidth,
          }))
          assert.equal(appearance.paper, 'rgb(250, 249, 245)')
          assert.equal(appearance.primary, '#a34f37')
          assert.match(appearance.font, /Georgia/)
          assert.equal(
            appearance.overflow,
            false,
            `${language}/${width}/${tab}`,
          )
          await page.screenshot({
            path: new URL(`${language}-${width}-tab${tab}.png`, QA).pathname,
            fullPage: true,
          })
        }
      }
    }
    assert.deepEqual(
      requests,
      [],
      'settings and diagrams do not fetch external assets',
    )
  })
  test('expanded menus and embedded settings retain the same theme and keyboard controls', async () => {
    await setStorage({ language: 'en' })
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto(`chrome-extension://${extId}/popup.html`)
    await page.waitForFunction(() => document.documentElement.lang === 'en')
    for (let tab = 0; tab < 3; tab++) {
      await page.locator('.tab-btn').nth(tab).press('Enter')
      const anchor = page.locator('.mdc-select__anchor').first()
      await anchor.press('ArrowDown')
      const menu = page.locator('.mdc-menu-surface--open')
      await menu.waitFor()
      const actual = await menu.evaluate(element => ({
        paper: getComputedStyle(element).backgroundColor,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        viewport: innerWidth,
      }))
      assert.equal(actual.paper, 'rgb(250, 249, 245)')
      assert.ok(
        actual.left >= 0 && actual.right <= actual.viewport,
        JSON.stringify(actual),
      )
      await page.screenshot({
        path: new URL(`menu-tab${tab}-320.png`, QA).pathname,
      })
      await page.waitForFunction(
        () => !document.querySelector('.mdc-menu-surface--animating-open'),
      )
      await menu.getByRole('option').first().press('Escape')
      await menu.waitFor({ state: 'hidden' })
    }
    // Start the independent embedded-view checks with an explicit locale.
    await setStorage({ language: 'en' })
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(url)
      await page.waitForSelector('pre.mermaid[data-mermaid-status="ready"]')
      await page.locator('.md-reader__float-menu-btn').click()
      const items = await page
        .locator('.md-reader__float-menu-item')
        .allTextContents()
      assert.ok(
        items.includes('Settings'),
        JSON.stringify({ items, stored: await getStorage('language') }),
      )
      await page
        .locator('.md-reader__float-menu-item')
        .filter({ hasText: /^Settings$/ })
        .click()
      const frame = page.frameLocator('.md-reader__settings-overlay iframe')
      await frame.locator('.tab-btn').first().waitFor()
      const body = await frame.locator('body').evaluate(element => ({
        paper: getComputedStyle(element).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }))
      assert.equal(body.paper, 'rgb(250, 249, 245)')
      assert.equal(body.overflow, false)
      await page.screenshot({
        path: new URL(`embedded-${width}.png`, QA).pathname,
      })
    }
    assert.deepEqual(requests, [])
  })
})
