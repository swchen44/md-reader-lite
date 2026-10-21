import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { launchExtension } from './_harness.mjs'

const QA = new URL('../../dist/qa/mermaid-styles/', import.meta.url)
const FLOW = 'graph TD\n  A[Start] --> B[Done]'
const fence = source => '```mermaid\n' + source + '\n```'
const SOURCES = {
  flowchart: FLOW,
  sequence:
    'sequenceDiagram\n  participant A as Reader\n  participant B as Renderer\n  A->>B: Draw\n  Note right of B: Ready\n  B-->>A: SVG',
  class:
    'classDiagram\n  class Reader {\n    +render()\n  }\n  Reader --> Diagram',
  state: 'stateDiagram-v2\n  [*] --> Ready\n  Ready --> Done\n  Done --> [*]',
  er: 'erDiagram\n  READER ||--o{ DOCUMENT : opens\n  DOCUMENT {\n    string title\n  }',
  gantt:
    'gantt\n  title Plan\n  dateFormat YYYY-MM-DD\n  section Work\n  Render :a1, 2026-10-22, 2d\n  Review :after a1, 1d',
  pie: 'pie title Reading\n  "Markdown" : 60\n  "Diagrams" : 40',
  git: 'gitGraph\n  commit\n  branch feature\n  checkout feature\n  commit\n  checkout main\n  merge feature',
  journey:
    'journey\n  title Reading\n  section Document\n  Open: 5: Reader\n  Inspect: 4: Reader',
  authored:
    'graph TD\n  A[Failure] --> B[Retry]\n  classDef failure fill:#b91c1c,color:#ffffff,stroke:#7f1d1d\n  class A failure\n  style B fill:#dbeafe,stroke:#1d4ed8\n  linkStyle 0 stroke:#15803d',
  cjk: 'graph LR\n  A[來源文件與較長的中文標籤] --> B[完成渲染並保留可讀文字]',
}
const OPTIONS = style => ({
  Linkify: { fuzzyLink: false, fuzzyIP: false, fuzzyEmail: true },
  Alert: { deep: false },
  Mermaid: { style },
})

describe('Mermaid styles (e2e)', () => {
  let server, port, ctx, page, getStorage, setStorage

  before(async () => {
    server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      const path = new URL(req.url, 'http://fixture').pathname
      if (path === '/diagram.mmd') return res.end(FLOW)
      if (path === '/matrix.md')
        return res.end(
          '# Matrix\n\n' +
            Object.entries(SOURCES)
              .filter(([key]) => !['authored', 'cjk'].includes(key))
              .map(([key, source]) => `## ${key}\n\n${fence(source)}`)
              .join('\n\n'),
        )
      if (path === '/authored.md')
        return res.end(
          '# Authored\n\n' + fence(SOURCES.authored) + '\n\n' + fence(FLOW),
        )
      if (path === '/directives.md')
        return res.end(
          '# Directives\n\n' +
            fence('%%{init: {"theme": "forest"}}%%\n' + FLOW) +
            '\n\n' +
            fence(FLOW.replace('Start', 'Plain')),
        )
      if (path === '/mixed.md')
        return res.end(
          '# Mixed\n\n' +
            fence('digraph G { a -> b }') +
            '\n\n```plantuml\nAlice -> Bob: Hello\n```\n\n' +
            fence(FLOW),
        )
      res.end('# Diagrams\n\n' + fence(SOURCES[path.slice(1, -3)] || FLOW))
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    port = server.address().port
    ;({ ctx, getStorage, setStorage } = await launchExtension())
    page = await ctx.newPage()
    await mkdir(QA, { recursive: true })
  })

  after(async () => {
    if (ctx) await ctx.close()
    if (server) await new Promise(resolve => server.close(resolve))
  })

  async function open(theme = 'light', path = '/flow.md', extra = {}) {
    await setStorage({ pageTheme: theme, offlineMode: true, ...extra })
    await page.goto(`http://127.0.0.1:${port}${path}`)
    await page.waitForSelector('pre.mermaid svg', { timeout: 15000 })
  }

  async function readFlowchart() {
    return page
      .locator('pre.mermaid')
      .first()
      .evaluate(container => {
        const svg = container.querySelector('svg')
        const node = svg?.querySelector('.node rect')
        const label = svg?.querySelector('.nodeLabel, .label, text')
        const edge = svg?.querySelector('.flowchart-link, .edgePath .path')
        const bounds = svg?.getBoundingClientRect()
        return {
          fill: node && getComputedStyle(node).fill,
          stroke: node && getComputedStyle(node).stroke,
          font: label && getComputedStyle(label).fontFamily,
          color: label && getComputedStyle(label).color,
          edge: edge && getComputedStyle(edge).stroke,
          paper: getComputedStyle(container).backgroundColor,
          radius: node && getComputedStyle(node).rx,
          width: bounds?.width,
          height: bounds?.height,
          text: [...svg.querySelectorAll('.node .label, text')]
            .map(el => el.textContent)
            .join(' '),
        }
      })
  }

  test('Original renders nonblank SVGs in light and dark', async () => {
    const baseline = {}
    for (const theme of ['light', 'dark']) {
      await open(theme)
      const actual = await readFlowchart()
      assert.ok(actual.width > 0 && actual.height > 0)
      assert.ok(
        actual.fill && actual.edge && actual.font,
        JSON.stringify(actual),
      )
      assert.match(actual.text, /Start/)
      assert.match(actual.text, /Done/)
      baseline[theme] = actual
      await page.screenshot({
        path: new URL(`original-${theme}-baseline.png`, QA).pathname,
      })
    }
    assert.notEqual(baseline.light.fill, baseline.dark.fill)
    await writeFile(
      new URL('original-baseline.json', QA),
      JSON.stringify(baseline, null, 2),
    )
  })

  test('Anthropic uses a light surface and switching back restores native SVG appearance', async () => {
    for (const theme of ['light', 'dark']) {
      await open(theme, '/flow.md', { mdPluginOptions: OPTIONS('original') })
      const original = await readFlowchart()
      await open(theme, '/flow.md', {
        mdPluginOptions: OPTIONS('anthropic-blog'),
      })
      const styled = await readFlowchart()
      assert.equal(styled.fill, 'rgb(241, 234, 223)')
      assert.equal(styled.paper, 'rgb(250, 249, 245)')
      assert.equal(styled.radius, '8px')
      assert.match(styled.font, /Georgia/)
      assert.ok(styled.width > 0 && styled.height > 0)
      await open(theme, '/flow.md', { mdPluginOptions: OPTIONS('original') })
      const restored = await readFlowchart()
      for (const key of [
        'fill',
        'stroke',
        'font',
        'color',
        'edge',
        'paper',
        'radius',
      ]) {
        assert.equal(restored[key], original[key], `${theme}: restored ${key}`)
      }
    }
  })

  test('all nine supported diagram fixtures render in both styles', async () => {
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/matrix.md', { mdPluginOptions: OPTIONS(style) })
      assert.equal(await page.locator('pre.mermaid svg').count(), 9)
      const sizes = await page.locator('pre.mermaid svg').evaluateAll(svgs =>
        svgs.map(svg => {
          const box = svg.getBoundingClientRect()
          return {
            width: box.width,
            height: box.height,
            errors: svg.querySelectorAll('.error-icon').length,
          }
        }),
      )
      assert.ok(
        sizes.every(s => s.width > 0 && s.height > 0 && !s.errors),
        JSON.stringify(sizes),
      )
    }
  })

  test('author node and edge colors are preserved without leaking to a plain diagram', async () => {
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/authored.md', { mdPluginOptions: OPTIONS(style) })
      const actual = await page
        .locator('pre.mermaid')
        .first()
        .evaluate(container => ({
          nodes: [...container.querySelectorAll('.node rect')].map(
            el => getComputedStyle(el).fill,
          ),
          edge: getComputedStyle(
            container.querySelector('.flowchart-link, .edgePath .path'),
          ).stroke,
        }))
      assert.deepEqual(actual.nodes, ['rgb(185, 28, 28)', 'rgb(219, 234, 254)'])
      assert.equal(actual.edge, 'rgb(21, 128, 61)')
      const plainFill = await page
        .locator('pre.mermaid')
        .nth(1)
        .locator('.node rect')
        .first()
        .evaluate(el => getComputedStyle(el).fill)
      assert.equal(
        plainFill,
        style === 'original' ? 'rgb(236, 236, 255)' : 'rgb(241, 234, 223)',
      )
    }
  })

  test('document init themes take precedence and do not leak to following diagrams', async () => {
    const colors = []
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/directives.md', { mdPluginOptions: OPTIONS(style) })
      const fills = await page
        .locator('pre.mermaid')
        .evaluateAll(elements =>
          elements.map(
            container =>
              getComputedStyle(container.querySelector('.node rect')).fill,
          ),
        )
      colors.push(fills[0])
      assert.equal(
        fills[1],
        style === 'original' ? 'rgb(236, 236, 255)' : 'rgb(241, 234, 223)',
      )
      assert.notEqual(fills[0], fills[1])
    }
    assert.equal(
      colors[0],
      colors[1],
      'explicit forest theme should take precedence over either preset',
    )
  })

  test('standalone .mmd uses the selected style; DOT and PlantUML retain their rendering paths', async () => {
    let graphviz
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/diagram.mmd', { mdPluginOptions: OPTIONS(style) })
      assert.equal(
        await page.locator('pre.mermaid').getAttribute('data-mermaid-style'),
        style,
      )
      await open('light', '/mixed.md')
      await page.waitForSelector('pre.md-reader__graphviz svg', {
        timeout: 15000,
      })
      assert.equal(await page.locator('pre.mermaid').count(), 1)
      assert.equal(
        await page
          .locator('pre.md-reader__graphviz[data-mermaid-style]')
          .count(),
        0,
      )
      assert.equal(await page.locator('img[src*="plantuml"]').count(), 0)
      assert.match(
        await page.locator('.md-reader__markdown-content').textContent(),
        /Alice -> Bob/,
      )
      const fill = await page
        .locator('pre.md-reader__graphviz svg polygon')
        .first()
        .evaluate(el => getComputedStyle(el).fill)
      if (graphviz) assert.equal(fill, graphviz)
      graphviz = fill
    }
  })
})
