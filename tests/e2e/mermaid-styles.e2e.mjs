import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { launchExtension } from './_harness.mjs'
import { CUSTOM_CSS_PRESETS } from '../../src/config/custom-css-presets.ts'

const QA = new URL('../../dist/qa/mermaid-styles/', import.meta.url)
const FLOW = 'graph TD\n  A[Start] --> B[Done]'
const fence = source => '```mermaid\n' + source + '\n```'
const SOURCES = {
  flowchart: FLOW,
  shapes: 'graph TD\n  A([Start]) --> B[Plain]\n  B --> C(Rounded)',
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
      if (path === '/author-sequence.md')
        return res.end(
          '# Author sequence\n\n' +
            fence(
              "%%{initialize: {'theme': 'forest'}}%%\n" + SOURCES.sequence,
            ) +
            '\n\n' +
            fence(SOURCES.sequence),
        )
      if (path === '/code.md')
        return res.end(
          '# Code document\n\n```text\n' +
            Array.from({ length: 80 }, (_, i) => `Code line ${i}`).join('\n') +
            '\n```\n\n' +
            fence(FLOW) +
            '\n\n## Later heading\n\n' +
            'More content. '.repeat(800),
        )
      if (path === '/invalid.md')
        return res.end(
          '# Invalid diagram\n\n' +
            fence('graph TD\n  A[broken -->') +
            '\n\n## Still readable\n\n' +
            fence(FLOW),
        )
      if (path === '/long.md')
        return res.end(
          '# Long document\n\n' +
            fence(FLOW) +
            '\n\n' +
            Array.from(
              { length: 22 },
              (_, i) => `## Part ${i}\n\n${'Reading paragraph. '.repeat(20)}`,
            ).join('\n\n') +
            '\n\n## Reading anchor\n\n' +
            'Visible paragraph. '.repeat(30) +
            '\n\n' +
            fence(SOURCES.cjk) +
            '\n\n' +
            '## More reading\n\n' +
            'Remaining paragraph. '.repeat(500),
        )
      if (path === '/matrix.md')
        return res.end(
          '# Matrix\n\n' +
            Object.entries(SOURCES)
              .filter(([key]) => !['authored', 'cjk', 'shapes'].includes(key))
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
      if (path === '/author-font.md')
        return res.end(
          '# Authored typography\n\n' +
            fence(
              '---\nconfig:\n  theme: base\n  fontFamily: Courier New\n  themeVariables:\n    fontFamily: Courier New\n    primaryTextColor: "#166534"\n---\n' +
                FLOW,
            ) +
            '\n\n' +
            fence(FLOW),
        )
      if (path === '/author-c4.md')
        return res.end(
          '# Authored C4\n\n' +
            fence(
              'C4Context\n Person(reader, "Reader")\n System(app, "Application")\n Rel(reader, app, "Reads")\n UpdateElementStyle(reader, $bgColor="#123456", $fontColor="#ffffff", $borderColor="#654321")',
            ) +
            '\n\n' +
            fence('C4Context\n Person(reader, "Plain")'),
        )
      if (path === '/author-sankey.md')
        return res.end(
          '# Authored Sankey\n\n' +
            fence(
              '---\nconfig:\n  sankey:\n    nodeColors:\n      Documents: "#123456"\n---\nsankey\nDocuments,Text,55',
            ) +
            '\n\n' +
            fence('sankey\nDocuments,Text,55'),
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
    await page.waitForFunction(
      () =>
        !document.querySelector(
          'pre.mermaid[data-mermaid-status="pending"],pre.mermaid[data-mermaid-status="rendering"]',
        ),
      undefined,
      { timeout: 30000 },
    )
  }

  async function readFlowchart() {
    await page.waitForSelector('pre.mermaid[data-mermaid-status="ready"] svg')
    return page
      .locator('pre.mermaid[data-mermaid-status="ready"]')
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

  async function openSettings() {
    await page.bringToFront()
    await page.locator('.md-reader__float-menu-btn').click()
    await page
      .locator('.md-reader__float-menu-item')
      .filter({ hasText: /^(Settings|設定|设置|설정)$/ })
      .click()
    await page
      .frameLocator('.md-reader__settings-overlay iframe')
      .locator('.tab-btn')
      .first()
      .waitFor()
    const frame = page.frames().find(f => /popup\.html/.test(f.url()))
    assert.ok(frame)
    await frame.locator('.tab-btn').nth(2).press('Enter')
    await frame.locator('.mermaid-style-select').waitFor({ timeout: 3000 })
    assert.equal(
      await frame.locator('.mermaid-style-select').count(),
      1,
      'Mermaid style menu should exist',
    )
    return frame
  }

  async function chooseStyle(frame, style) {
    await frame
      .locator('.mermaid-style-select .mdc-select__anchor')
      .press('ArrowDown')
    await frame.waitForFunction(() => {
      const menu = document.querySelector(
        '.mermaid-style-select .mdc-select__menu',
      )
      return (
        menu.classList.contains('mdc-menu-surface--open') &&
        !menu.classList.contains('mdc-menu-surface--animating-open')
      )
    })
    await frame
      .getByRole('option', {
        name: style === 'original' ? 'Original' : 'Anthropic blog style',
        exact: true,
      })
      .click()
    await frame
      .locator('.mermaid-style-select .mdc-select__menu')
      .waitFor({ state: 'hidden', timeout: 3000 })
    await page.waitForFunction(
      selected =>
        document.querySelector('pre.mermaid')?.dataset.mermaidStyle ===
        selected,
      style,
    )
    assert.equal(
      (await getStorage('mdPluginOptions')).mdPluginOptions.Mermaid.style,
      style,
    )
    await page.waitForFunction(
      () =>
        !document.querySelector(
          'pre.mermaid[data-mermaid-status="pending"],pre.mermaid[data-mermaid-status="rendering"]',
        ),
      undefined,
      { timeout: 30000 },
    )
  }

  test('Original renders nonblank SVGs in light and dark', async () => {
    const baseline = {}
    for (const theme of ['light', 'dark']) {
      await open(theme, '/flow.md', { mdPluginOptions: OPTIONS('original') })
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
            labels: [...svg.querySelectorAll('text, foreignObject')]
              .map(el => el.textContent)
              .join(' '),
          }
        }),
      )
      assert.ok(
        sizes.every(s => s.width > 0 && s.height > 0 && !s.errors),
        JSON.stringify(sizes),
      )
      for (const [index, label] of [
        'Start',
        'Reader',
        'Reader',
        'Ready',
        'READER',
        'Render',
        'Markdown',
        'feature',
        'Open',
      ].entries()) {
        assert.ok(
          sizes[index].labels.includes(label),
          `${style}: missing ${label}`,
        )
      }
    }
  })

  test('author node and edge colors are preserved without leaking to a plain diagram', async () => {
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/authored.md', { mdPluginOptions: OPTIONS(style) })
      const actual = await page
        .locator('pre.mermaid')
        .first()
        .evaluate(container => ({
          nodes: [
            ...container.querySelectorAll('.node > rect.label-container'),
          ].map(el => getComputedStyle(el).fill),
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

  test('authored YAML typography survives host paragraph CSS without leaking to the next graph', async () => {
    await open('light', '/author-font.md', {
      mdPluginOptions: OPTIONS('anthropic-blog'),
    })
    const labels = await page.locator('pre.mermaid').evaluateAll(containers =>
      containers.map(container =>
        [...container.querySelectorAll('foreignObject p')].map(label => {
          const style = getComputedStyle(label)
          return {
            font: style.fontFamily,
            color: style.color,
            size: style.fontSize,
          }
        }),
      ),
    )
    assert.ok(labels.every(items => items.length > 0))
    assert.ok(
      labels[0].every(label => /Courier New/.test(label.font)),
      JSON.stringify(labels),
    )
    assert.ok(
      labels[0].every(label => label.color === 'rgb(22, 101, 52)'),
      JSON.stringify(labels),
    )
    assert.ok(
      labels[1].every(label => /Georgia/.test(label.font)),
      JSON.stringify(labels),
    )
    assert.ok(
      labels[1].every(label => label.size === '16px'),
      JSON.stringify(labels),
    )
  })

  test('C4 and Sankey preserve authored native colors without preset leakage', async () => {
    for (const path of ['/author-c4.md', '/author-sankey.md']) {
      await open('light', path, { mdPluginOptions: OPTIONS('anthropic-blog') })
      const colors = await page
        .locator('pre.mermaid > svg')
        .evaluateAll(svgs =>
          svgs.map(svg =>
            [...svg.querySelectorAll('rect,path,circle')].map(
              element => getComputedStyle(element).fill,
            ),
          ),
        )
      assert.ok(
        colors[0].includes('rgb(18, 52, 86)'),
        `${path}: ${JSON.stringify(colors)}`,
      )
      assert.ok(
        !colors[1].includes('rgb(18, 52, 86)'),
        `${path}: ${JSON.stringify(colors)}`,
      )
    }
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

  test('menu saves repeated choices and redraws without navigation or losing other settings', async () => {
    await open('light', '/flow.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('original'),
    })
    const frame = await openSettings()
    let navigations = 0
    const onNavigate = f => {
      if (f === page.mainFrame()) navigations++
    }
    page.on('framenavigated', onNavigate)
    try {
      for (const style of ['anthropic-blog', 'original', 'anthropic-blog']) {
        await chooseStyle(frame, style)
        assert.equal(
          (await getStorage('mdPluginOptions')).mdPluginOptions.Linkify
            .fuzzyLink,
          false,
        )
        assert.equal(
          (await getStorage('mdPluginOptions')).mdPluginOptions.Alert.deep,
          false,
        )
        assert.ok(
          await page.locator('.md-reader__settings-overlay').isVisible(),
        )
        assert.equal(
          (await readFlowchart()).fill,
          style === 'original' ? 'rgb(236, 236, 255)' : 'rgb(241, 234, 223)',
        )
      }
      assert.equal(navigations, 0)
    } finally {
      page.off('framenavigated', onNavigate)
    }
    await open('light')
    assert.equal(
      await page.locator('pre.mermaid').getAttribute('data-mermaid-style'),
      'anthropic-blog',
    )
    const reopened = await openSettings()
    assert.match(
      await reopened
        .locator('.mermaid-style-select .mdc-select__selected-text')
        .textContent(),
      /Anthropic/,
    )
  })

  test('live style redraw preserves a scrolled reading anchor and attaches fresh zoom controls', async () => {
    await open('light', '/long.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('original'),
    })
    const anchor = page
      .locator('.md-reader__markdown-content h2')
      .filter({ hasText: 'Reading anchor' })
    await anchor.evaluate(el =>
      window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 100),
    )
    const top = await anchor.evaluate(el => el.getBoundingClientRect().top)
    const frame = await openSettings()
    await chooseStyle(frame, 'anthropic-blog')
    await page.waitForFunction(
      expected => {
        const el = [
          ...document.querySelectorAll('.md-reader__markdown-content h2'),
        ].find(el => el.textContent.includes('Reading anchor'))
        return Math.abs(el.getBoundingClientRect().top - expected) <= 8
      },
      top,
      { timeout: 3000 },
    )
    await page.mouse.click(800, 600)
    const diagram = page.locator('pre.mermaid').last()
    await diagram.scrollIntoViewIfNeeded()
    await diagram.hover()
    assert.equal(
      await diagram.locator('.md-reader__diagram-controls').count(),
      1,
    )
    await diagram.getByTitle('Zoom in', { exact: true }).click()
    await page.waitForFunction(() => {
      const diagrams = document.querySelectorAll('pre.mermaid svg')
      return (
        parseFloat(
          getComputedStyle(diagrams[diagrams.length - 1]).transform.split(
            '(',
          )[1],
        ) > 1
      )
    })
    await diagram.getByTitle('Reset', { exact: true }).click()
    for (const style of ['original', 'anthropic-blog']) {
      const settings = await openSettings()
      await chooseStyle(settings, style)
      await page.mouse.click(600, 850)
      await diagram.scrollIntoViewIfNeeded()
      await diagram.hover()
      assert.equal(
        await diagram.locator('.md-reader__diagram-controls').count(),
        1,
      )
      await diagram.getByTitle('Zoom in', { exact: true }).click()
      await diagram.getByTitle('Reset', { exact: true }).click()
    }
  })

  test('auto theme follows the system for Original while Anthropic keeps its light palette', async () => {
    await page.emulateMedia({ colorScheme: 'light' })
    await open('auto', '/flow.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('original'),
    })
    const light = await readFlowchart()
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(fill => {
      const rect = document.querySelector('pre.mermaid .node rect')
      return !!rect && getComputedStyle(rect).fill !== fill
    }, light.fill)
    const frame = await openSettings()
    await chooseStyle(frame, 'anthropic-blog')
    const darkAnthropic = await readFlowchart()
    await page.emulateMedia({ colorScheme: 'light' })
    await page.evaluate(
      () =>
        new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    )
    const lightAnthropic = await readFlowchart()
    for (const key of ['fill', 'font', 'color', 'edge', 'paper'])
      assert.equal(lightAnthropic[key], darkAnthropic[key])
    await chooseStyle(frame, 'original')
    assert.equal((await readFlowchart()).fill, light.fill)
  })

  test('Mermaid can be disabled and re-enabled without erasing its selected style', async () => {
    await open('light', '/flow.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('anthropic-blog'),
    })
    const frame = await openSettings()
    const chip = frame.locator('[title="Mermaid"]')
    await chip.click()
    await page.waitForFunction(
      () => !document.querySelector('pre.mermaid'),
      null,
      { timeout: 3000 },
    )
    assert.equal(
      await frame
        .locator('.mermaid-style-select .mdc-select__anchor')
        .getAttribute('aria-disabled'),
      'true',
    )
    assert.equal(
      (await getStorage('mdPluginOptions')).mdPluginOptions.Mermaid.style,
      'anthropic-blog',
    )
    await chip.click()
    await page.waitForSelector(
      'pre.mermaid[data-mermaid-style="anthropic-blog"] svg',
    )
    assert.equal(
      await frame
        .locator('.mermaid-style-select .mdc-select__anchor')
        .getAttribute('aria-disabled'),
      'false',
    )
  })

  test('opening saved settings does not redraw content and another tab adopts the choice on its next load', async () => {
    await open('light', '/flow.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('original'),
    })
    const other = await ctx.newPage()
    try {
      await other.goto(`http://127.0.0.1:${port}/flow.md`)
      await other.waitForSelector('pre.mermaid svg')
      await page.evaluate(() => {
        window.__originalSvg = document.querySelector('pre.mermaid svg')
      })
      const before = await getStorage('mdPluginOptions')
      const frame = await openSettings()
      assert.equal(
        await page.evaluate(
          () =>
            window.__originalSvg === document.querySelector('pre.mermaid svg'),
        ),
        true,
      )
      assert.deepEqual(await getStorage('mdPluginOptions'), before)
      await chooseStyle(frame, 'anthropic-blog')
      assert.equal(
        await other.locator('pre.mermaid').getAttribute('data-mermaid-style'),
        'original',
      )
      await other.reload()
      await other.waitForSelector(
        'pre.mermaid[data-mermaid-style="anthropic-blog"] svg',
      )
    } finally {
      await other.close()
    }
  })

  test('Reset to Defaults restores Anthropic and 85 percent width', async () => {
    await open('light', '/flow.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('original'),
    })
    const frame = await openSettings()
    await frame.locator('.tab-btn').nth(0).press('Enter')
    await frame
      .getByRole('button', { name: 'Reset to Defaults', exact: true })
      .press('Enter')
    await frame.locator('.btn-reset.danger').press('Enter')
    await page.waitForSelector(
      'pre.mermaid[data-mermaid-style="anthropic-blog"] svg',
    )
    assert.equal(
      (await getStorage('mdPluginOptions')).mdPluginOptions.Mermaid.style,
      'anthropic-blog',
    )
    assert.deepEqual(await getStorage(['customWidth', 'customWidthUnit']), {
      customWidth: 85,
      customWidthUnit: 'percent',
    })
  })

  test('CSS presets and disabling customization retain the independent Mermaid choice', async () => {
    for (const choice of ['developer', 'editorial', 'user1', 'user2']) {
      const css =
        CUSTOM_CSS_PRESETS.find(p => p.id === choice)?.css ||
        '.md-reader__markdown-content h1 { color: #166534; }'
      await open('light', '/flow.md', {
        language: 'en',
        mdPluginOptions: OPTIONS('anthropic-blog'),
        customCssEnabled: true,
        customCssChoice: choice,
        customCss: css,
      })
      assert.equal((await readFlowchart()).paper, 'rgb(250, 249, 245)')
      assert.equal((await readFlowchart()).fill, 'rgb(241, 234, 223)')
      assert.equal(
        (await getStorage('mdPluginOptions')).mdPluginOptions.Mermaid.style,
        'anthropic-blog',
      )
    }
    const frame = await openSettings()
    await frame.locator('.tab-btn').nth(1).press('Enter')
    const toggle = frame
      .locator('.form-item.inline')
      .filter({ hasText: 'Enable Custom CSS:' })
      .locator('.mdc-switch')
    await toggle.click()
    await page.waitForFunction(
      () => !document.querySelector('#md-reader-custom-css'),
    )
    assert.equal((await readFlowchart()).paper, 'rgb(250, 249, 245)')
    await toggle.click()
    assert.equal(
      (await getStorage('mdPluginOptions')).mdPluginOptions.Mermaid.style,
      'anthropic-blog',
    )
    assert.equal((await readFlowchart()).fill, 'rgb(241, 234, 223)')
  })

  test('invalid Mermaid is isolated and a later diagram and heading remain visible', async () => {
    await open('light', '/invalid.md', {
      mdPluginOptions: OPTIONS('anthropic-blog'),
    })
    assert.equal(await page.locator('pre.mermaid svg').count(), 1)
    assert.ok(
      await page
        .locator('h2')
        .filter({ hasText: 'Still readable' })
        .isVisible(),
    )
    assert.equal(
      await page
        .locator('pre.mermaid[data-mermaid-status="error"] code')
        .count(),
      1,
    )
    assert.ok((await readFlowchart()).width > 0)
  })

  test('privacy-on rendering and live style selection make no extra HTTP requests', async () => {
    const requests = []
    const onRequest = req => {
      if (/^https?:/.test(req.url())) requests.push(req.url())
    }
    page.on('request', onRequest)
    try {
      await open('light', '/flow.md', {
        language: 'en',
        mdPluginOptions: OPTIONS('original'),
      })
      assert.deepEqual(requests, [`http://127.0.0.1:${port}/flow.md`])
      const frame = await openSettings()
      await chooseStyle(frame, 'anthropic-blog')
      await chooseStyle(frame, 'original')
      assert.deepEqual(requests, [`http://127.0.0.1:${port}/flow.md`])
    } finally {
      page.off('request', onRequest)
    }
  })

  test('all five locales display the style control with readable option labels', async () => {
    for (const language of ['en', 'zh-TW', 'zh-CN', 'ko', 'ja']) {
      await open('light', '/flow.md', {
        language,
        mdPluginOptions: OPTIONS('anthropic-blog'),
      })
      const frame = await openSettings()
      const label = await frame
        .locator('.mermaid-style-select .label-item')
        .textContent()
      assert.match(label, /Mermaid/)
      assert.doesNotMatch(label, /label_|mermaid-style_/)
      const selected = frame.locator(
        '.mermaid-style-select .mdc-select__selected-text',
      )
      assert.equal(
        (await selected.textContent()).trim(),
        'Anthropic blog style',
      )
      assert.ok(
        await selected.evaluate(el => el.scrollWidth <= el.clientWidth + 1),
      )
      await page.screenshot({
        path: new URL(`settings-${language}.png`, QA).pathname,
      })
    }
  })

  test('desktop and narrow layouts render nonblank themed diagrams with local fonts', async () => {
    try {
      for (const cssChoice of ['off', 'developer', 'editorial']) {
        for (const theme of ['light', 'dark']) {
          for (const viewport of [
            { width: 1200, height: 900 },
            { width: 390, height: 844 },
          ]) {
            await page.setViewportSize(viewport)
            await open(theme, '/matrix.md', {
              language: 'en',
              mdPluginOptions: OPTIONS('anthropic-blog'),
              customCssEnabled: cssChoice !== 'off',
              customCss:
                CUSTOM_CSS_PRESETS.find(p => p.id === cssChoice)?.css || '',
            })
            const filename = `anthropic-blog-${theme}-${cssChoice}-${viewport.width}x${viewport.height}.png`
            await page.screenshot({
              path: new URL(filename, QA).pathname,
              fullPage: true,
              animations: 'disabled',
            })
            const boxes = await page
              .locator('pre.mermaid')
              .evaluateAll(containers =>
                containers.map(container => {
                  const svg = container.querySelector('svg')
                  const bounds = svg.getBoundingClientRect()
                  return {
                    width: bounds.width,
                    height: bounds.height,
                    available: container.clientWidth - 32,
                    viewBox: svg.getAttribute('viewBox'),
                    style: svg.getAttribute('style'),
                    paper: getComputedStyle(container).backgroundColor,
                  }
                }),
              )
            assert.equal(boxes.length, 9)
            assert.ok(
              boxes.every(
                b =>
                  b.width > 0 &&
                  b.height > 0 &&
                  b.paper === 'rgb(250, 249, 245)',
              ),
              filename,
            )
            assert.ok(
              boxes.every(b => b.width <= b.available + 1),
              `${filename}: ${JSON.stringify(boxes)}`,
            )
          }
        }
      }
      await open('light', '/cjk.md', {
        mdPluginOptions: OPTIONS('anthropic-blog'),
      })
      assert.match((await readFlowchart()).text, /來源文件與較長的中文標籤/)
      await page.screenshot({
        path: new URL('anthropic-blog-cjk-390x844.png', QA).pathname,
        animations: 'disabled',
      })
    } finally {
      await page.setViewportSize({ width: 1200, height: 900 })
    }
  })

  test('an explicit sequence init theme fully overrides preset colors and typography', async () => {
    const authored = []
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/author-sequence.md', {
        mdPluginOptions: OPTIONS(style),
      })
      authored.push(
        await page
          .locator('pre.mermaid')
          .first()
          .evaluate(el => ({
            actor: getComputedStyle(el.querySelector('rect.actor')).fill,
            text: getComputedStyle(el.querySelector('text.actor')).fill,
            font: getComputedStyle(el.querySelector('text.actor')).fontFamily,
          })),
      )
    }
    assert.deepEqual(
      authored[1],
      authored[0],
      'author sequence theme must win over every preset variable',
    )
    assert.equal(
      await page
        .locator('pre.mermaid')
        .nth(1)
        .locator('rect.actor')
        .first()
        .evaluate(el => getComputedStyle(el).fill),
      'rgb(241, 234, 223)',
    )
  })

  test('softened plain rectangles preserve stadium and explicitly rounded node shapes', async () => {
    const shapes = []
    for (const style of ['original', 'anthropic-blog']) {
      await open('light', '/shapes.md', { mdPluginOptions: OPTIONS(style) })
      shapes.push(
        await page.locator('pre.mermaid .node').evaluateAll(elements =>
          elements.map(el => {
            const rect = el.querySelector(':scope > rect.label-container')
            return {
              rx: rect && getComputedStyle(rect).rx,
              stadium: !!el.querySelector(':scope > g.outer-path > path'),
            }
          }),
        ),
      )
    }
    assert.ok(
      shapes[0][0].stadium && shapes[1][0].stadium,
      'Mermaid 12 stadium must preserve its native curved path',
    )
    assert.equal(shapes[1][1].rx, '8px')
    assert.equal(
      shapes[1][2].rx,
      shapes[0][2].rx,
      'explicit rounded shape must keep its radius',
    )
  })

  test('redrawing below an entirely visible code block preserves scroll coordinates', async () => {
    await open('light', '/code.md', {
      language: 'en',
      mdPluginOptions: OPTIONS('original'),
    })
    await page.evaluate(() => window.scrollTo(0, 400))
    const scroll = await page.evaluate(() => window.scrollY)
    const frame = await openSettings()
    await chooseStyle(frame, 'anthropic-blog')
    await page.evaluate(
      () =>
        new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    )
    assert.ok(
      Math.abs((await page.evaluate(() => window.scrollY)) - scroll) <= 1,
    )
  })
})
