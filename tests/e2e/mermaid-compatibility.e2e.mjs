import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import MarkdownIt from 'markdown-it'
import { launchExtension } from './_harness.mjs'

const require = createRequire(import.meta.url)
const version = require('mermaid/package.json').version
const QA = new URL('../../dist/qa/mermaid-compatibility/', import.meta.url)
const gallery = await readFile(
  new URL('../../example/mermaid-compatibility.md', import.meta.url),
  'utf8',
)
const expectedNames = [
  'Flowchart',
  'Swimlanes Diagram',
  'Sequence Diagram',
  'Class Diagram',
  'State Diagram',
  'Entity Relationship Diagram',
  'User Journey',
  'Gantt',
  'Pie Chart',
  'Quadrant Chart',
  'Requirement Diagram',
  'Use Case Diagram',
  'GitGraph (Git) Diagram',
  'C4 Diagram',
  'Mindmaps',
  'Timeline',
  'ZenUML',
  'Sankey',
  'XY Chart',
  'Block Diagram',
  'Packet',
  'Kanban',
  'Architecture',
  'Radar',
  'Event Modeling',
  'Treemap',
  'Venn',
  'Ishikawa',
  'Wardley',
  'Cynefin',
  'TreeView',
]
const supported = new Set(expectedNames)
const cases = []
let heading
const tokens = new MarkdownIt().parse(gallery, {})
for (let i = 0; i < tokens.length; i++) {
  const token = tokens[i]
  if (token.type === 'heading_open' && token.tag === 'h2')
    heading = tokens[i + 1].content.replace(/^\d+\. /, '')
  if (token.type === 'fence' && token.info.trim() === 'mermaid')
    cases.push({ name: heading, source: token.content })
}
const fence = source => '```mermaid\n' + source + '\n```'
const sentinel = fence('graph LR\n  A[Recovery sentinel] --> B[Still readable]')
const options = style => ({
  Linkify: { fuzzyLink: false, fuzzyIP: false, fuzzyEmail: true },
  Alert: { deep: false },
  Mermaid: { style },
})

test('compatibility inventory covers all 31 requested types on Mermaid 12.2.0', () => {
  assert.equal(
    version,
    '12.2.0',
    'Re-audit the baseline when upgrading Mermaid',
  )
  assert.deepEqual(
    cases.map(item => item.name),
    expectedNames,
  )
  assert.equal(supported.size, 31)
  assert.ok(cases.every(item => item.source.trim()))
})

describe('Mermaid diagram compatibility (e2e)', () => {
  let server, ctx, page, port, setStorage
  const results = []
  const layoutResults = []
  const externalRequests = []

  before(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://fixture')
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      if (url.pathname === '/gallery.md') return res.end(gallery)
      if (url.pathname !== '/probe.md') {
        res.statusCode = 404
        return res.end('Not found')
      }
      const item = cases[Number(url.searchParams.get('case'))]
      res.end(
        '# Compatibility probe\n\n' +
          fence(item.source) +
          '\n\n## Recovery\n\n' +
          sentinel,
      )
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    port = server.address().port
    ;({ ctx, setStorage } = await launchExtension())
    page = await ctx.newPage()
    page.on('request', request => {
      const url = new URL(request.url())
      if (
        ['http:', 'https:'].includes(url.protocol) &&
        url.hostname !== '127.0.0.1'
      )
        externalRequests.push(request.url())
    })
    await mkdir(QA, { recursive: true })
  })

  after(async () => {
    try {
      await writeFile(
        new URL('results.json', QA),
        JSON.stringify(
          {
            version,
            testedAt: new Date().toISOString(),
            results,
            layoutResults,
            externalRequests,
          },
          null,
          2,
        ) + '\n',
      )
    } finally {
      if (ctx) await ctx.close()
      if (server) await new Promise(resolve => server.close(resolve))
    }
  })

  async function open(path, style, width = 1200, theme = 'light') {
    await page.setViewportSize({ width, height: width === 1200 ? 900 : 844 })
    await setStorage({
      pageTheme: theme,
      offlineMode: true,
      mdPluginOptions: options(style),
    })
    await page.goto(`http://127.0.0.1:${port}${path}`)
    await page.waitForSelector('pre.mermaid svg', { timeout: 15000 })
    await page.waitForFunction(
      () => {
        const article = document.querySelector('.md-reader__markdown-content')
        return (
          !!article?.dataset.mermaidComplete &&
          article.dataset.mermaidComplete === article.dataset.mermaidGeneration
        )
      },
      undefined,
      { timeout: 30000 },
    )
  }

  function inspect(container) {
    const svg = container.querySelector('svg')
    const box = svg?.getBoundingClientRect()
    return {
      rendered: !!svg,
      style: container.dataset.mermaidStyle,
      width: box?.width || 0,
      height: box?.height || 0,
      containerWidth: container.getBoundingClientRect().width,
      errors: svg?.querySelectorAll('.error-icon, .error-text').length || 0,
      labels: svg?.querySelectorAll('text, foreignObject').length || 0,
      fontFamilies: svg
        ? [
            ...new Set(
              [
                ...svg.querySelectorAll(
                  'text,foreignObject p,foreignObject span',
                ),
              ]
                .filter(
                  el =>
                    el.textContent.trim() &&
                    el.getBoundingClientRect().width > 0,
                )
                .map(el => getComputedStyle(el).fontFamily),
            ),
          ]
        : [],
      fills: svg
        ? [
            ...new Set(
              [...svg.querySelectorAll('rect,path,circle,polygon')].map(
                el => getComputedStyle(el).fill,
              ),
            ),
          ].slice(0, 24)
        : [],
      text: svg
        ? [...svg.querySelectorAll('text, foreignObject')]
            .map(label => label.textContent.trim())
            .join(' ')
        : container.textContent.trim(),
    }
  }

  function assertRendered(result, style) {
    assert.ok(result.rendered, JSON.stringify(result))
    assert.equal(result.style, style)
    assert.ok(result.width > 0 && result.height > 0, JSON.stringify(result))
    assert.equal(result.errors, 0)
    assert.ok(result.labels > 0, JSON.stringify(result))
  }

  for (const style of ['original', 'anthropic-blog']) {
    for (const [index, item] of cases.entries()) {
      const native = supported.has(item.name)
      const expectation = native ? 'renders' : 'unsupported baseline; recovers'
      test(`${style}: ${item.name} (${expectation})`, async () => {
        await open(`/probe.md?case=${index}`, style)
        const blocks = page.locator('.md-reader__markdown-content > pre')
        assert.equal(await blocks.count(), 2)
        const result = await blocks.first().evaluate(inspect)
        results.push({ name: item.name, style, supported: native, ...result })
        if (native) {
          assertRendered(result, style)
          if (item.name === 'Architecture') {
            assert.equal(
              result.fills.includes('rgb(8, 126, 191)'),
              style === 'original',
              'Anthropic recolors built-in icon backgrounds, Original preserves them',
            )
          }
          await blocks.first().screenshot({
            path: new URL(`${style}-${index + 1}.png`, QA).pathname,
          })
          if (style === 'anthropic-blog')
            assert.ok(
              result.fontFamilies.length &&
                result.fontFamilies.every(font => /Georgia/.test(font)),
              `${item.name} has unthemed fonts: ${JSON.stringify(
                result.fontFamilies,
              )}`,
            )
        } else {
          assert.equal(result.rendered, false, JSON.stringify(result))
          assert.ok(
            result.text.length,
            'Unsupported diagram must not silently vanish',
          )
        }
        const recovery = await blocks.last().evaluate(inspect)
        assertRendered(recovery, style)
        assert.match(recovery.text, /Still readable/)
      })
    }

    for (const theme of ['light', 'dark'])
      for (const width of [1200, 390, 320]) {
        test(`${style}: complete ${theme} mixed gallery at ${width}px`, async () => {
          await open('/gallery.md', style, width, theme)
          const blocks = page.locator('.md-reader__markdown-content > pre')
          assert.equal(await blocks.count(), 31)
          for (const [index, item] of cases.entries()) {
            const result = await blocks.nth(index).evaluate(inspect)
            if (supported.has(item.name)) {
              assertRendered(result, style)
              const fits = result.width <= result.containerWidth + 2
              layoutResults.push({
                name: item.name,
                style,
                theme,
                viewport: width,
                fits,
                ...result,
              })
              if (style === 'anthropic-blog')
                assert.ok(
                  result.fontFamilies.length &&
                    result.fontFamilies.every(font => /Georgia/.test(font)),
                  `${item.name}: ${JSON.stringify(result.fontFamilies)}`,
                )
              assert.ok(
                fits,
                `${item.name} exceeds its initial viewport: ${JSON.stringify(
                  result,
                )}`,
              )
            } else assert.equal(result.rendered, false, item.name)
          }
          assert.deepEqual(
            externalRequests,
            [],
            'Offline diagrams must stay local',
          )
          await page.screenshot({
            path: new URL(`${style}-${theme}-gallery-${width}.png`, QA)
              .pathname,
            fullPage: true,
          })
        })
      }
  }

  for (const width of [320, 390])
    test(`Original GitGraph initially fits a ${width}px viewport`, async () => {
      await open('/probe.md?case=12', 'original', width)
      const block = page.locator('.md-reader__markdown-content > pre').first()
      const result = await block.evaluate(inspect)
      await block.screenshot({
        path: new URL(`original-gitgraph-${width}.png`, QA).pathname,
      })
      assertRendered(result, 'original')
      assert.ok(
        result.width <= result.containerWidth + 2,
        JSON.stringify(result),
      )
    })

  test('all 372 matrix outputs were measured without remote requests', () => {
    assert.equal(layoutResults.length, 31 * 2 * 2 * 3)
    assert.deepEqual(externalRequests, [])
  })
})
