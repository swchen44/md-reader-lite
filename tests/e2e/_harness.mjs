// Shared harness for extension end-to-end tests.
//
// e2e tests load the *built* unpacked extension (extension/) into a real
// Chromium via Playwright and drive it like a user. They are NOT run in CI
// (loading an MV3 extension needs a headed / new-headless browser, which CI's
// plain headless runner does not provide). Run them locally with:
//
//     npm run build && npm run test:e2e
//
// Requirements (dev-only, deliberately NOT in package.json to keep CI's
// `pnpm install --frozen-lockfile` intact — see developer_guide.md):
//   - Playwright resolvable (`pnpm add -D playwright` or a global install)
//   - A Chromium that Playwright can launch headed
//
// If either is missing, launchExtension() throws; test files catch that in a
// `before` hook and skip, so `npm run test:e2e` degrades gracefully instead of
// hard-failing on a machine without a browser.

import http from 'http'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
export const EXT = join(here, '..', '..', 'extension')

const SAMPLE_MD = `# E2E fixture

Some **markdown** content for extension end-to-end tests.

## Section A
- item 1
- item 2
`

// Serve the fixture as text/markdown so the content script activates.
export function startMdServer() {
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.end(SAMPLE_MD)
  })
  return new Promise(resolve => {
    server.listen(0, () => resolve({ server, port: server.address().port }))
  })
}

// Launch a headed Chromium with the built extension loaded. Returns handles
// plus storage helpers that talk to the extension's chrome.storage.local via
// the background service worker. Throws if extension/ is unbuilt or Playwright
// / the browser is unavailable.
export async function launchExtension() {
  if (!existsSync(join(EXT, 'manifest.json'))) {
    throw new Error('extension/ not built — run `npm run build` first')
  }
  const { chromium } = await import('playwright')
  const userDataDir = join('/tmp', `md-reader-e2e-${process.pid}-${Date.now()}`)
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1200, height: 900 },
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
    ],
  })
  const sw =
    ctx.serviceWorkers()[0] ||
    (await ctx.waitForEvent('serviceworker', { timeout: 15000 }))
  const extId = new URL(sw.url()).host
  const getStorage = key =>
    sw.evaluate(k => new Promise(r => chrome.storage.local.get(k, r)), key)
  const setStorage = obj =>
    sw.evaluate(o => new Promise(r => chrome.storage.local.set(o, r)), obj)
  return { ctx, sw, extId, getStorage, setStorage }
}
