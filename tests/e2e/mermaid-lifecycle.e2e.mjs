import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { launchExtension } from './_harness.mjs'

const fence = source => '```mermaid\n' + source + '\n```'
const flow = 'flowchart LR\n SecretSource[Visible label] --> B[Recovered]'
const options = style => ({ Mermaid: { style } })

describe('Mermaid async lifecycle (e2e)', () => {
  let server, base, ctx, page, sw, setStorage
  const requests = []
  before(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      if (req.url.startsWith('/privacy')) {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'",
        )
        return res.end(
          '# Privacy\n\n' +
            fence(
              'flowchart LR\n A["<img src=\'https://mermaid-probe.invalid/private.png\' />"] --> B',
            ) +
            '\n\n' +
            fence(flow),
        )
      }
      const many = req.url.startsWith('/many')
      if (req.url.startsWith('/reading'))
        return res.end(
          '# Reading position\n\n' +
            Array.from({ length: 20 }, () => fence(flow)).join('\n\n') +
            '\n\n## Reading anchor\n\n' +
            'Reading paragraph. '.repeat(1200),
        )
      res.end(
        '# Async document\n\n' +
          (many
            ? Array.from({ length: 70 }, () => fence(flow)).join('\n\n')
            : fence('flowchart LR\n A[BrokenSource -->') +
              '\n\n' +
              fence(flow)),
      )
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
    ;({ ctx, sw, setStorage } = await launchExtension())
    page = await ctx.newPage()
    page.on('request', request => {
      if (
        /^https?:/.test(request.url()) &&
        new URL(request.url()).origin !== base
      )
        requests.push(request.url())
    })
    await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, route =>
      route.abort(),
    )
    await setStorage({
      language: 'en',
      offlineMode: true,
      mdPluginOptions: options('original'),
    })
  })
  after(async () => {
    if (ctx) await ctx.close()
    if (server) await new Promise(resolve => server.close(resolve))
  })
  async function settled() {
    await page.waitForFunction(
      () => {
        const article = document.querySelector('.md-reader__markdown-content')
        return (
          article?.dataset.mermaidComplete ===
            article?.dataset.mermaidGeneration &&
          !!article?.dataset.mermaidComplete
        )
      },
      undefined,
      { timeout: 30000 },
    )
  }
  async function style(value) {
    await sw.evaluate(
      async ({ base, value }) => {
        const tabs = await chrome.tabs.query({})
        await Promise.all(
          tabs.map(tab =>
            chrome.tabs
              .sendMessage(tab.id, {
                action: 'applySetting',
                data: {
                  key: 'mdPluginOptions',
                  value: { Mermaid: { style: value } },
                },
              })
              .catch(() => {}),
          ),
        )
      },
      { base, value },
    )
  }
  test('failed source remains readable and later async SVG work settles', async () => {
    await page.goto(base + '/probe.md')
    await page.waitForSelector('pre.mermaid[data-mermaid-status="ready"] svg', {
      timeout: 15000,
    })
    await settled()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="error"]').count(),
      1,
    )
    assert.match(
      await page
        .locator('pre.mermaid[data-mermaid-status="error"] code')
        .textContent(),
      /BrokenSource/,
    )
    assert.equal(
      await page
        .locator('pre.mermaid[data-mermaid-status="ready"] code')
        .count(),
      0,
    )
    assert.equal(
      await page.locator('body > [id^="dmd-reader-mermaid-"]').count(),
      0,
    )
    await page.locator('.md-reader__side-search-btn').click()
    await page.locator('.md-reader__search-input').fill('BrokenSource')
    await page
      .locator('.md-reader__search-item .md-reader__search-hit')
      .first()
      .waitFor()
  })
  test('rapid redraw discards obsolete work and refreshes an active source search', async () => {
    await page.goto(base + '/many.md')
    await page.locator('.md-reader__side-search-btn').click()
    const input = page.locator('.md-reader__search-input')
    await input.fill('SecretSource')
    await page
      .locator('.md-reader__search-item .md-reader__search-hit')
      .first()
      .waitFor()
    await style('anthropic-blog')
    await style('original')
    await style('anthropic-blog')
    await settled()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="ready"]').count(),
      70,
    )
    assert.equal(
      await page
        .locator('pre.mermaid:not([data-mermaid-style="anthropic-blog"])')
        .count(),
      0,
    )
    await page.waitForFunction(
      () =>
        !document
          .querySelector('.md-reader__search-panel')
          ?.textContent.includes('SecretSource'),
    )
    assert.equal(await page.locator('pre.mermaid code').count(), 0)
    const ids = await page
      .locator('pre.mermaid > svg')
      .evaluateAll(elements => elements.map(svg => svg.id))
    assert.equal(new Set(ids).size, 70)
  })
  test('strict host CSP and rejected resources do not block later diagrams', async () => {
    await page.goto(base + '/privacy.md')
    await settled()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="error"]').count(),
      1,
    )
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="ready"]').count(),
      1,
    )
    assert.deepEqual(requests, [])
  })
  test('raw view remains usable while diagrams finish and after reload', async () => {
    await page.goto(base + '/many.md')
    async function toggleRaw() {
      await page.locator('.md-reader__float-menu-btn').click()
      await page
        .locator('.md-reader__float-menu-item')
        .filter({ hasText: /^Toggle Raw View$/ })
        .click()
    }
    await toggleRaw()
    assert.equal(await page.locator('body.md-reader').count(), 0)
    await settled()
    await toggleRaw()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="ready"]').count(),
      70,
    )
    await page.reload()
    await settled()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="ready"]').count(),
      70,
    )
  })
  test('pagehide stops retained-DOM work and pageshow retries unfinished diagrams', async () => {
    await page.goto(base + '/many.md')
    await page.waitForFunction(
      () =>
        document.querySelector('pre.mermaid[data-mermaid-status="ready"]') &&
        document.querySelector('pre.mermaid[data-mermaid-status="rendering"]'),
    )
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent('pagehide', { persisted: true }),
      ),
    )
    await page.waitForFunction(
      () => !document.querySelector('iframe[src$="mermaid-frame.html"]'),
    )
    await page.waitForTimeout(100)
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="error"]').count(),
      0,
    )
    assert.equal(
      await page.locator('iframe[src$="mermaid-frame.html"]').count(),
      0,
    )
    assert.equal(
      await page
        .locator('.md-reader__markdown-content')
        .getAttribute('data-mermaid-complete'),
      null,
    )
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent('pageshow', { persisted: true }),
      ),
    )
    await settled()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="ready"]').count(),
      70,
    )
    const generation = await page
      .locator('.md-reader__markdown-content')
      .getAttribute('data-mermaid-generation')
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent('pageshow', { persisted: true }),
      ),
    )
    await page.waitForTimeout(50)
    assert.equal(
      await page
        .locator('.md-reader__markdown-content')
        .getAttribute('data-mermaid-generation'),
      generation,
    )
    assert.deepEqual(requests, [])
  })
  test('reading restoration waits for current diagrams and respects a new user scroll', async () => {
    await setStorage({ mdPluginOptions: options('original') })
    await page.goto(base + '/reading.md')
    await settled()
    await page.addStyleTag({ content: 'html,body { overflow-anchor: none; }' })
    const anchor = page.locator('h2').filter({ hasText: 'Reading anchor' })
    await anchor.evaluate(el =>
      window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 100),
    )
    await style('anthropic-blog')
    await settled()
    await page.waitForFunction(
      () => {
        const el = [...document.querySelectorAll('h2')].find(el =>
          el.textContent.includes('Reading anchor'),
        )
        return Math.abs(el.getBoundingClientRect().top - 100) < 8
      },
      undefined,
      { timeout: 3000 },
    )
    await style('original')
    await page.mouse.wheel(0, 50)
    await page.evaluate(() => window.scrollTo(0, 200))
    await settled()
    await page.waitForTimeout(50)
    assert.ok(
      await page.evaluate(() => scrollY < 400),
      'Late diagram completion must not pull the user back',
    )
    await anchor.evaluate(el =>
      window.scrollTo(0, scrollY + el.getBoundingClientRect().top - 100),
    )
    await style('anthropic-blog')
    await page.mouse.click(12, 350)
    await page.evaluate(() => window.scrollTo(0, 200))
    await settled()
    await page.waitForTimeout(50)
    assert.ok(
      await page.evaluate(() => scrollY < 400),
      'Pointer navigation must cancel late restoration too',
    )
  })
})
