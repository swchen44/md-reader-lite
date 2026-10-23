import { describe, before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { launchExtension } from './_harness.mjs'

const fence = source => '```mermaid\n' + source + '\n```'
const physical = [
  `flowchart LR
    E[實體環境] --> S[感測器與狀態估計]
    S --> D[模型與任務決策]
    D --> A[控制與致動器]
    A --> E
    T[任務目標與限制] --> D
    G[獨立安全監督與人工接管] -. 約束 .-> D
    G -. 停止或限制動作 .-> A`,
  `flowchart TD
    A[一：展示能力] --> B[二：受控環境可靠性]
    B --> C[三：正式環境可靠自主運作]
    C --> D[四：多場域經濟可擴張性]
    A -. 驗收問題 .-> A1[是否只挑成功片段]
    B -. 驗收問題 .-> B1[條件改變後是否仍能完成]
    C -. 驗收問題 .-> C1[失敗如何偵測與復原]
    D -. 驗收問題 .-> D1[加入整合與維護成本後是否划算]`,
  `flowchart LR
    A[受控試點] --> B[蒐集成功與失敗紀錄]
    B --> C[標記例外與人工介入原因]
    C --> D[改善模型或工作流程]
    D --> E[版本化回歸測試與安全審查]
    E --> F{符合發布條件}
    F -->|是| A
    F -->|否| D
    A --> G[必要時停止並由人工復原]
    G --> B`,
]
const physicalMD =
  '# Physical AI sandbox regression\n\n' + physical.map(fence).join('\n\n')

describe('Mermaid sandbox (e2e)', { timeout: 180000 }, () => {
  let ctx, page, sw, setStorage, server, base, corpus
  const requests = []
  let trapHits = 0
  before(async () => {
    corpus = await readFile(
      new URL('../../example/mermaid-compatibility.md', import.meta.url),
      'utf8',
    )
    server = http.createServer((req, res) => {
      if (req.url === '/blocked-resource.png') trapHits++
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      )
      const content = req.url.includes('many')
        ? '# Interrupted\n\n' +
          Array.from({ length: 30 }, () => fence(physical[0])).join('\n\n')
        : req.url.includes('gallery')
        ? corpus
        : req.url.includes('recovery')
        ? '# Recovery\n\n' +
          [
            'flowchart LR\n A[Broken -->',
            `flowchart LR\n A["<img src='${base}/blocked-resource.png' />"] --> B`,
            'flowchart LR\n A[Sandbox sentinel] --> B[Recovered]',
          ]
            .map(fence)
            .join('\n\n')
        : physicalMD
      res.end(content)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${server.address().port}`
    ;({ ctx, sw, setStorage } = await launchExtension({
      extensionPath: process.env.MD_READER_EXTENSION,
    }))
    ctx.on('request', request => {
      if (!/^https?:/.test(request.url())) return
      const allowed =
        request.url().startsWith(base + '/') &&
        request.isNavigationRequest() &&
        request.frame().parentFrame() === null
      if (!allowed) requests.push(request.url())
    })
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/))/, route =>
      route.abort(),
    )
    page = await ctx.newPage()
    page.setDefaultTimeout(30000)
  })
  after(async () => {
    if (ctx) await ctx.close()
    if (server) await new Promise(resolve => server.close(resolve))
  })
  async function open(style, path = 'physical.md', target = page) {
    await setStorage({
      language: 'en',
      offlineMode: true,
      customCssEnabled: true,
      hiddenSide: true,
      mdPluginOptions: { Mermaid: { style } },
    })
    await target.goto(`${base}/${path}`)
    await settled(target)
  }
  async function settled(target) {
    // sandbox also blocks page-world RAF/timers used by waitForFunction.
    // Poll from Node and inspect the isolated locator world instead.
    const deadline = Date.now() + 30000
    do {
      const done = await target
        .locator('.md-reader__markdown-content')
        .evaluate(
          article =>
            !!article.dataset.mermaidComplete &&
            article.dataset.mermaidComplete ===
              article.dataset.mermaidGeneration,
        )
      if (done) return
      await delay(50)
    } while (Date.now() < deadline)
    assert.fail(
      JSON.stringify(
        await target.locator('pre.mermaid').evaluateAll(elements =>
          elements.map(el => ({
            status: el.dataset.mermaidStatus,
            error: el.querySelector('.md-reader__mermaid-error')?.title,
          })),
        ),
        null,
        2,
      ),
    )
  }
  for (const style of ['original', 'anthropic-blog']) {
    test(`the three reported diagrams render under raw sandbox: ${style}`, async () => {
      await open(style)
      const states = await page.locator('pre.mermaid').evaluateAll(elements =>
        elements.map(el => ({
          status: el.dataset.mermaidStatus,
          error: el.querySelector('.md-reader__mermaid-error')?.title,
          svg: !!el.querySelector('svg'),
        })),
      )
      assert.equal(states.length, 3)
      assert.ok(
        states.every(x => x.status === 'ready' && x.svg),
        JSON.stringify(states),
      )
      assert.equal(
        await page.locator('iframe[src$="mermaid-frame.html"]').count(),
        0,
      )
      assert.deepEqual(
        requests,
        [],
        'Mermaid adds no network requests, including blocked attempts',
      )
    })
    test(`all 31 types render under raw sandbox: ${style}`, async () => {
      await open(style, 'gallery.md')
      assert.equal(await page.locator('pre.mermaid').count(), 31)
      assert.equal(
        await page
          .locator('pre.mermaid[data-mermaid-status="ready"] > svg')
          .count(),
        31,
      )
      assert.deepEqual(requests, [])
    })
  }
  test('invalid/resource-bearing diagrams preserve source and a later sentinel renders', async () => {
    await open('anthropic-blog', 'recovery.md')
    assert.equal(
      await page
        .locator('pre.mermaid[data-mermaid-status="error"] code')
        .count(),
      2,
    )
    assert.equal(
      await page
        .locator('pre.mermaid[data-mermaid-status="ready"] svg')
        .count(),
      1,
    )
    const error = await page
      .locator('.md-reader__mermaid-error')
      .nth(1)
      .getAttribute('title')
    assert.match(error, /^Blocked resource policy:/)
    assert.doesNotMatch(
      error,
      /renderer CSP blocked a resource/,
      'preflight must reject before even a CSP-blocked renderer resource attempt',
    )
    assert.equal(
      trapHits,
      0,
      'server trap covers offscreen requests invisible to the page network listener',
    )
    assert.deepEqual(requests, [])
  })
  test('concurrent sandbox tabs keep their replies and close the idle document', async () => {
    const other = await ctx.newPage()
    try {
      await setStorage({
        mdPluginOptions: { Mermaid: { style: 'anthropic-blog' } },
      })
      await Promise.all([
        page.goto(`${base}/physical.md`),
        other.goto(`${base}/recovery.md`),
      ])
      for (const [target, expected] of [
        [page, 3],
        [other, 1],
      ]) {
        await settled(target)
        assert.equal(
          await target
            .locator('pre.mermaid[data-mermaid-status="ready"] svg')
            .count(),
          expected,
        )
      }
      await other.close()
      // The broker owns lifecycle; no renderer stays around indefinitely.
      for (let i = 0; i < 50; i++) {
        const count = await sw.evaluate(
          async () =>
            (
              await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT'],
              })
            ).length,
        )
        if (count === 0) break
        await page.waitForTimeout(100)
      }
      assert.equal(
        await sw.evaluate(
          async () =>
            (
              await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT'],
              })
            ).length,
        ),
        0,
      )
      await page.reload()
      await settled(page)
      assert.equal(
        await page
          .locator('pre.mermaid[data-mermaid-status="ready"] svg')
          .count(),
        3,
      )
      assert.deepEqual(requests, [])
    } finally {
      if (!other.isClosed()) await other.close()
    }
  })
  test('closing an in-flight sandbox page does not strand the next document', async () => {
    const interrupted = await ctx.newPage()
    try {
      await interrupted.goto(`${base}/many.md`)
      await interrupted.waitForSelector(
        'pre.mermaid[data-mermaid-status="rendering"]',
      )
      await interrupted.close()
      await open('anthropic-blog')
      assert.equal(
        await page
          .locator('pre.mermaid[data-mermaid-status="ready"] svg')
          .count(),
        3,
      )
      await page.reload()
      await settled(page)
      assert.equal(
        await page
          .locator('pre.mermaid[data-mermaid-status="ready"] svg')
          .count(),
        3,
      )
      assert.deepEqual(requests, [])
    } finally {
      if (!interrupted.isClosed()) await interrupted.close()
    }
  })
})
