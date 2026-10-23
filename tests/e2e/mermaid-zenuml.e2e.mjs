import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir } from 'node:fs/promises'
import { launchExtension } from './_harness.mjs'

const QA = new URL('../../dist/qa/mermaid-zenuml/', import.meta.url)
const alias = 'zenuml\n A as Alice\n B as Backend\n A->B: Hello\n B->A: Ready'
const nested =
  'zenuml\n A as Alice\n B as Backend\n A.Load() {\n if(ready) {\n B.Load() {\n return result\n }\n } else {\n B.Retry()\n }\n while(pending) {\n B.Poll()\n }\n }'
const broken = 'zenuml\n A.Load() {'
const fence = source => '```mermaid\n' + source + '\n```'
let server, ctx, page, base, setStorage
const requests = []

before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(
      req.url.endsWith('.mmd')
        ? nested
        : '# Local ZenUML\n\n' +
            [
              alias,
              nested,
              broken,
              'flowchart LR\n A[Recovered] --> B[Readable]',
            ]
              .map(fence)
              .join('\n\n'),
    )
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  ;({ ctx, setStorage } = await launchExtension())
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
  await mkdir(QA, { recursive: true })
})
after(async () => {
  if (ctx) await ctx.close()
  if (server) await new Promise(resolve => server.close(resolve))
})
for (const style of ['original', 'anthropic-blog']) {
  test(`ZenUML ${style}: aliases, nested branches/loops, failure recovery and standalone mmd`, async () => {
    await setStorage({
      mdPluginOptions: { Mermaid: { style } },
      offlineMode: true,
    })
    for (const path of ['/zen.md', '/zen.mmd']) {
      await page.goto(base + path)
      await page.waitForFunction(
        () => {
          const article = document.querySelector('.md-reader__markdown-content')
          return (
            !!article?.dataset.mermaidComplete &&
            article.dataset.mermaidComplete ===
              article.dataset.mermaidGeneration
          )
        },
        undefined,
        { timeout: 30000 },
      )
      const standalone = path.endsWith('.mmd')
      assert.equal(
        await page
          .locator('pre.mermaid[data-mermaid-status="ready"] > svg')
          .count(),
        standalone ? 1 : 3,
      )
      if (!standalone) {
        assert.equal(
          await page
            .locator('pre.mermaid[data-mermaid-status="error"]')
            .count(),
          1,
        )
        assert.equal(
          await page
            .locator('pre.mermaid[data-mermaid-status="error"] code')
            .textContent(),
          broken + '\n',
        )
        assert.match(
          await page.locator('pre.mermaid').first().textContent(),
          /Alice/,
        )
      }
      const nestedBlock = page.locator('pre.mermaid').nth(standalone ? 0 : 1)
      assert.match(await nestedBlock.textContent(), /Poll/)
      const size = await nestedBlock.locator(':scope > svg').evaluate(svg => ({
        width: svg.getBoundingClientRect().width,
        height: svg.getBoundingClientRect().height,
      }))
      assert.ok(size.width > 0 && size.height > 0)
      await nestedBlock.screenshot({
        path: new URL(`${style}-${standalone ? 'mmd' : 'nested'}.png`, QA)
          .pathname,
      })
    }
    assert.deepEqual(requests, [])
  })
}
