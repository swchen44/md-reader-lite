// Store photography uses the actual built extension; no UI mockups or CDN.
// Run after npm run build. Playwright is the same dev-only prerequisite as e2e.
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { launchExtension } from '../tests/e2e/_harness.mjs'
import { notes } from '../docs/store-assets/source/demo.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetRoot = path.join(root, 'docs/store-assets')
const output = path.join(assetRoot, 'v1.9.0')
const copy = JSON.parse(
  await readFile(path.join(assetRoot, 'source/copy.json')),
)
const shots = ['reading', 'diagrams', 'navigation', 'search', 'settings']
const receipt = {
  version: '1.9.0',
  createdAt: new Date().toISOString(),
  actualExtensionCaptures: true,
  files: [],
  observations: [],
}
const manifest = JSON.parse(
  await readFile(path.join(root, 'extension/manifest.json')),
)
assert.equal(manifest.version, receipt.version)

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost')
    const match = u.pathname.match(/^\/demo\/(en|zh-TW)\/([^/]+\.md)?$/)
    if (match) {
      const [, lang, file] = match
      if (file) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
        return res.end(
          notes[lang][file === 'diagrams.md' ? 'diagrams' : 'reading'],
        )
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end(
        [
          'reading.md',
          'diagrams.md',
          'design-decisions.md',
          'research-notes.md',
          'knowledge-base.md',
        ]
          .map(name => `<a href="${name}">${name}</a><br>`)
          .join(''),
      )
    }
    const file = path.resolve(assetRoot, '.' + decodeURIComponent(u.pathname))
    if (!file.startsWith(assetRoot + path.sep)) {
      res.writeHead(403)
      return res.end()
    }
    const type =
      {
        '.html': 'text/html',
        '.json': 'application/json',
        '.png': 'image/png',
        '.mjs': 'text/javascript',
      }[path.extname(file)] || 'application/octet-stream'
    res.setHeader(
      'Content-Type',
      type + (type.startsWith('text/') ? '; charset=utf-8' : ''),
    )
    res.end(await readFile(file))
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
let ctx
try {
  const ext = await launchExtension()
  ctx = ext.ctx
  receipt.browser = ctx.browser()?.version() || 'persistent Chromium'
  const errors = []
  const page = await ctx.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
  for (const lang of ['zh-TW', 'en']) {
    const capture = path.join(output, 'captures', lang)
    const uploads = path.join(output, lang === 'en' ? 'common' : 'zh-TW')
    await mkdir(capture, { recursive: true })
    await mkdir(uploads, { recursive: true })
    await ext.sw.evaluate(() => chrome.storage.local.clear())
    await ext.setStorage({
      language: lang,
      enable: true,
      pageTheme: 'light',
      offlineMode: true,
      hiddenSide: true,
      customCssEnabled: true,
      textSize: 16,
      sideWidth: 300,
      searchHistoryLimit: 10,
    })
    await page.setViewportSize({ width: 1000, height: 760 })
    const go = async (file = 'reading.md') => {
      await page.goto(`${base}/demo/${lang}/${file}`)
      await page.locator('.md-reader__markdown-content').waitFor()
      await pause(250)
    }
    await go()
    await page.screenshot({ path: path.join(capture, 'reading.png') })

    await page.setViewportSize({ width: 1280, height: 532 })
    await go('diagrams.md')
    await page.locator('pre.mermaid[data-mermaid-status="ready"]').waitFor()
    assert.equal(
      await page.locator('pre.mermaid[data-mermaid-status="error"]').count(),
      0,
    )
    await pause(150)
    await page.screenshot({ path: path.join(capture, 'diagrams.png') })

    await page.setViewportSize({ width: 1000, height: 760 })
    await ext.setStorage({
      hiddenSide: true,
      customWidth: 55,
      customWidthUnit: 'percent',
      sideWidth: 260,
    })
    await go()
    const before = await page
      .locator('.md-reader__markdown-content')
      .boundingBox()
    await page.locator('.md-reader__btn--side-expand').click()
    await pause(350)
    const after = await page
      .locator('.md-reader__markdown-content')
      .boundingBox()
    assert.equal(before.x, after.x)
    assert.equal(before.width, after.width)
    await page.locator('.md-reader__side-tab').nth(1).click()
    await page.locator('.md-reader__tree-file').first().waitFor()
    await page.screenshot({ path: path.join(capture, 'navigation.png') })
    receipt.observations.push({ lang, sidebarArticleBoundsUnchanged: true })

    await page.locator('.md-reader__side-tab').first().click()
    const terms =
      lang === 'en'
        ? ['Knowledge base', 'Mermaid', 'Design decisions']
        : ['知識庫', 'Mermaid', '設計決策']
    for (const term of terms) {
      await page.locator('.md-reader__side-search-btn').click()
      const input = page.locator('.md-reader__search-input')
      await input.fill(term)
      await input.press('Enter')
      await pause(200)
      await input.press('Escape')
    }
    await page.locator('.md-reader__side-search-btn').click()
    const input = page.locator('.md-reader__search-input')
    await input.fill('')
    await input.press('ArrowDown')
    await pause(200)
    const saved = (await ext.getStorage('searchHistory')).searchHistory
    assert.equal(saved.length, 3)
    await page.screenshot({ path: path.join(capture, 'search.png') })
    receipt.observations.push({ lang, historySavedThroughRealEnter: saved })
    await input.press('Escape')

    await ext.setStorage({
      hiddenSide: true,
      customWidth: 85,
      customWidthUnit: 'percent',
    })
    await go()
    await page.locator('.md-reader__float-menu-btn').click()
    await page
      .locator('.md-reader__float-menu-item')
      .filter({ hasText: lang === 'en' ? /^Settings$/ : /^設定$/ })
      .click()
    const frame = page.frameLocator('.md-reader__settings-overlay iframe')
    await frame.locator('.tab-btn').nth(1).click()
    await pause(250)
    await page.screenshot({ path: path.join(capture, 'settings.png') })

    for (const shot of shots) {
      const board = await ctx.newPage()
      await board.setViewportSize({ width: 1280, height: 800 })
      board.on('pageerror', error => errors.push(error.message))
      await board.goto(`${base}/source/board.html?lang=${lang}&shot=${shot}`)
      await board.locator('body[data-ready="true"]').waitFor()
      await board.evaluate(() => window.scrollTo(0, 0))
      await pause(200)
      const brand = await board.locator('.brand').evaluate(el => ({
        text: el.textContent,
        top: el.getBoundingClientRect().top,
        visible: getComputedStyle(el).visibility,
        display: getComputedStyle(el).display,
      }))
      receipt.observations.push({ lang, shot, brand })
      const target = path.join(uploads, copy[lang][shot].file)
      await board.screenshot({ path: target })
      const bytes = await readFile(target)
      assert.equal(bytes.readUInt32BE(16), 1280)
      assert.equal(bytes.readUInt32BE(20), 800)
      assert.equal(bytes[24], 8, '8-bit channels required')
      assert.equal(bytes[25], 2, 'RGB PNG, no alpha or palette')
      receipt.files.push({
        path: path.relative(root, target),
        width: 1280,
        height: 800,
        mode: 'RGB',
        bytes: bytes.length,
      })
      console.log('Rendered', path.relative(root, target))
      await board.close()
    }
  }
  assert.deepEqual(errors, [])
  receipt.pageErrors = errors
  await writeFile(
    path.join(output, 'receipt.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  )
} finally {
  if (ctx) await ctx.close()
  await new Promise(resolve => server.close(resolve))
}
