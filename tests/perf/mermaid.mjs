import assert from 'node:assert/strict'
import http from 'node:http'
import os from 'node:os'
import { parseArgs } from 'node:util'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import MarkdownIt from 'markdown-it'
import { launchExtension, EXT } from '../e2e/_harness.mjs'
import { selectFixtures, summarize } from './mermaid-metrics.mjs'

const { values } = parseArgs({
  options: {
    baseline: { type: 'string' },
    candidate: { type: 'string', default: EXT },
    scope: { type: 'string', default: 'shared-11' },
    output: { type: 'string', default: 'dist/qa/mermaid-performance.json' },
  },
})
assert.ok(
  values.baseline || values.scope !== 'shared-11',
  '--baseline must point to a built Mermaid 9 extension',
)
const source = await readFile(
  new URL('../../example/mermaid-compatibility.md', import.meta.url),
  'utf8',
)
const tokens = new MarkdownIt().parse(source, {})
const inventory = []
let heading
for (let index = 0; index < tokens.length; index++) {
  const token = tokens[index]
  if (token.type === 'heading_open' && token.tag === 'h2')
    heading = tokens[index + 1].content.replace(/^\d+\. /, '')
  if (token.type === 'fence' && token.info.trim() === 'mermaid')
    inventory.push({ name: heading, source: token.content })
}
const fixtures = selectFixtures(inventory, values.scope)
const markdown = fixtures
  .map(item => `## ${item.name}\n\n\`\`\`mermaid\n${item.source}\n\`\`\``)
  .join('\n\n')
const report = {
  testedAt: new Date().toISOString(),
  scope: values.scope,
  node: process.version,
  hardware: {
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    memoryBytes: os.totalmem(),
  },
  methodology:
    'Fresh persistent profile per cold run; navigation to all selected SVGs. Warm redraw includes extension storage, direct tab messaging and all SVG replacement. OS disk cache is not flushed. Browser timings include polling overhead. No p95 claim. Standalone ZenUML and full gallery are absolute costs, not an additive attribution.',
  viewport: { width: 1200, height: 900 },
  width: '760px',
  customCssEnabled: false,
  fixtures: fixtures.map(item => item.name),
  results: [],
  comparisons: [],
}
const server = http.createServer((_req, res) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.end(markdown)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${server.address().port}/benchmark.md`
const ready = expected => {
  const blocks = [...document.querySelectorAll('pre.mermaid')]
  return (
    blocks.length === expected &&
    blocks.every(block => {
      const svg = block.querySelector(':scope > svg')
      return (
        svg &&
        svg.getBoundingClientRect().width > 0 &&
        !svg.querySelector('.error-icon') &&
        !['pending', 'rendering', 'error'].includes(block.dataset.mermaidStatus)
      )
    }) &&
    document.querySelector('pre.mermaid > svg') !==
      window.__previousBenchmarkSVG
  )
}
try {
  const variants = [['candidate', resolve(values.candidate)]]
  if (values.scope === 'shared-11')
    variants.unshift(['baseline', resolve(values.baseline)])
  for (const [variant, extensionPath] of variants) {
    const root = dirname(extensionPath)
    const pkg = JSON.parse(
      await readFile(resolve(root, 'package.json'), 'utf8'),
    )
    const assets = {}
    for (const [name, path] of [
      ['content', resolve(extensionPath, 'js/content.js')],
      ['frame', resolve(extensionPath, 'js/mermaid-frame.js')],
      ['zip', resolve(root, `dist/${pkg.name}-${pkg.version}.zip`)],
    ]) {
      try {
        assets[name] = {
          bytes: (await stat(path)).size,
          sha256: createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        }
      } catch (error) {
        if (error.code !== 'ENOENT' || name !== 'frame') throw error
      }
    }
    for (const style of ['original', 'anthropic-blog']) {
      const cold = [],
        warm = [],
        requests = []
      const progress = { variant, style, coldSamples: cold, warmSamples: warm }
      report.results.push(progress)
      let browser
      for (let run = 0; run < 5; run++) {
        const { ctx, sw, setStorage } = await launchExtension({ extensionPath })
        try {
          browser = ctx.browser().version()
          ctx.on('request', request => {
            if (/^https?:/.test(request.url()) && request.url() !== url)
              requests.push(request.url())
          })
          const options = {
            Linkify: { fuzzyLink: false, fuzzyIP: false, fuzzyEmail: false },
            Alert: { deep: false },
            Mermaid: { style },
          }
          await setStorage({
            language: 'en',
            pageTheme: 'light',
            offlineMode: true,
            refresh: false,
            customCssEnabled: false,
            customWidth: 760,
            customWidthUnit: 'px',
            mdPluginOptions: options,
          })
          const page = await ctx.newPage()
          await page.goto(url)
          await page.waitForFunction(ready, fixtures.length, { timeout: 90000 })
          cold.push(await page.evaluate(() => performance.now()))
          await page.bringToFront()
          const tabId = await sw.evaluate(async () => {
            const [tab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            })
            if (!tab) throw new Error('Benchmark active tab missing')
            return tab.id
          })
          if (run === 4)
            for (let redraw = 0; redraw < 10; redraw++) {
              await page.bringToFront()
              await page.evaluate(() => {
                window.__previousBenchmarkSVG =
                  document.querySelector('pre.mermaid > svg')
                window.__benchmarkStart = performance.now()
              })
              await sw.evaluate(
                async ({ tabId, value }) => {
                  await chrome.storage.local.set({ mdPluginOptions: value })
                  await chrome.tabs.sendMessage(tabId, {
                    action: 'applySetting',
                    data: { key: 'mdPluginOptions', value },
                  })
                },
                { tabId, value: options },
              )
              await page.waitForFunction(ready, fixtures.length, {
                timeout: 90000,
              })
              warm.push(
                await page.evaluate(
                  () => performance.now() - window.__benchmarkStart,
                ),
              )
            }
        } finally {
          await ctx.close()
        }
      }
      assert.deepEqual(requests, [])
      const result = {
        variant,
        style,
        browser,
        commit: execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim(),
        dirty: execFileSync('git', ['status', '--short'], {
          cwd: root,
          encoding: 'utf8',
        }),
        assets,
        cold: summarize(cold, 5),
        warm: summarize(warm, 10),
        requests,
      }
      Object.assign(progress, result)
      console.log(
        JSON.stringify({
          variant,
          style,
          coldMedianMs: result.cold.median,
          warmMedianMs: result.warm.median,
        }),
      )
    }
  }
  for (const style of ['original', 'anthropic-blog']) {
    if (values.scope !== 'shared-11') break
    const old = report.results.find(
      result => result.variant === 'baseline' && result.style === style,
    )
    const next = report.results.find(
      result => result.variant === 'candidate' && result.style === style,
    )
    report.comparisons.push({
      style,
      coldMedianRatio: next.cold.median / old.cold.median,
      warmMedianRatio: next.warm.median / old.warm.median,
      zipRatio: next.assets.zip.bytes / old.assets.zip.bytes,
      engineAndContentRatio:
        (next.assets.content.bytes + (next.assets.frame?.bytes || 0)) /
        old.assets.content.bytes,
    })
  }
  report.status = 'complete'
} catch (error) {
  report.status = 'failed'
  report.error = String(error)
  throw error
} finally {
  await new Promise(resolve => server.close(resolve))
  const output = resolve(values.output)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
}
