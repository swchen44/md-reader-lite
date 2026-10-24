// Permanent gate for exported screenshots, not product unit tests.
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile, readdir, writeFile, access } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'docs/store-assets/v1.9.0')
const receiptPath = path.join(dir, 'receipt.json')
const receipt = JSON.parse(await readFile(receiptPath))
assert.equal(receipt.promoVideoFields.localized, 'leave empty')
assert.equal(receipt.promoVideoFields.global, 'leave empty')
for (const folder of ['zh-TW', 'common']) {
  const names = await readdir(path.join(dir, folder))
  assert.equal(names.filter(n => n.endsWith('.png')).length, 5)
  assert.ok(!names.some(n => /\.(mp4|webm|mov)$/i.test(n)))
}
assert.equal(receipt.files.length, 10)
for (const item of receipt.files) {
  const file = path.join(root, item.path)
  const bytes = await readFile(file)
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    item.sha256,
    item.path,
  )
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(bytes.readUInt32BE(16), 1280)
  assert.equal(bytes.readUInt32BE(20), 800)
  assert.equal(bytes[24], 8)
  assert.equal(bytes[25], 2)
  for (let at = 8; at < bytes.length; ) {
    assert.notEqual(bytes.toString('ascii', at + 4, at + 8), 'tRNS')
    at += 12 + bytes.readUInt32BE(at)
  }
  await run('ffmpeg', [
    '-v',
    'error',
    '-xerror',
    '-err_detect',
    'explode',
    '-i',
    file,
    '-f',
    'null',
    '-',
  ])
}
const browser = await chromium.launch({ headless: true })
const errors = []
const consoleErrors = []
const galleryChecks = []
try {
  const page = await browser.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning')
      consoleErrors.push(m.text())
  })
  await page.goto(pathToFileURL(path.join(dir, 'index.html')).href)
  await page.locator('img').evaluateAll(async images => {
    images.forEach(img => (img.loading = 'eager'))
    await Promise.all(images.map(img => img.decode()))
  })
  assert.equal(await page.locator('img').count(), 10)
  assert.equal(await page.locator('video').count(), 0)
  for (const href of await page
    .locator('a[href]')
    .evaluateAll(links => links.map(a => a.getAttribute('href')))) {
    if (href.startsWith('#')) continue
    await access(fileURLToPath(new URL(href, page.url())))
  }
  for (const width of [1280, 640, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const result = await page.evaluate(() => ({
      width: innerWidth,
      contentWidth: document.documentElement.scrollWidth,
      loadedImages: [...document.images].filter(
        i => i.complete && i.naturalWidth === 1280,
      ).length,
    }))
    assert.ok(result.contentWidth <= width, JSON.stringify(result))
    assert.equal(result.loadedImages, 10)
    galleryChecks.push(result)
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(consoleErrors, [])
  receipt.acceptance = {
    verifiedAt: new Date().toISOString(),
    browser: browser.version(),
    pngsDecoded: 10,
    gallery: galleryChecks,
    pageErrors: errors,
    consoleErrors,
    promoVideoFields: 'both intentionally empty',
    storeUpload: 'not performed',
  }
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n')
  console.log(
    'PASS: 10 RGB PNGs, complete decode/checksums, gallery 1280/640/320, no page/console errors; no video assets.',
  )
} finally {
  await browser.close()
}
