import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/mermaid-style')

test('modern diagram presets define nested chart palettes without overriding required native layouts', async () => {
  const { resolveMermaidDiagramOptions } = await load()
  assert.equal(typeof resolveMermaidDiagramOptions, 'function')
  const options = resolveMermaidDiagramOptions(
    { style: 'anthropic-blog' },
    'dark',
    { diagramType: 'flowchart-v2', config: {} },
  )
  assert.equal(options.look, 'classic')
  assert.equal(
    options.themeVariables.xyChart.plotColorPalette.split(',')[0],
    '#d49a83',
  )
  assert.equal(options.themeVariables.radar.graticuleColor, '#8a8074')
  assert.equal(options.themeVariables.wardley.componentFill, '#f1eadf')
  assert.equal(options.themeVariables.cynefin.clearBg, '#f7edce')
  assert.match(options.c4.personFontFamily, /Georgia/)
  assert.equal(options.c4.system_bg_color, '#725646')
  assert.equal(
    resolveMermaidDiagramOptions({ style: 'anthropic-blog' }, 'light', {
      diagramType: 'swimlane',
      config: {},
    }).look,
    undefined,
  )
})

test('public Mermaid parsing detects YAML and directive themes before applying a preset', async () => {
  const { resolveMermaidDiagramOptions } = await load()
  assert.equal(typeof resolveMermaidDiagramOptions, 'function')
  const { default: mermaid } = await import('mermaid')
  for (const source of [
    '---\nconfig:\n  theme: forest\n---\nflowchart LR\n A-->B',
    "%%{initialize: {'theme':'forest'}}%%\nflowchart LR\n A-->B",
  ]) {
    const parsed = await mermaid.parse(source)
    assert.equal(parsed.config.theme, 'forest')
    const options = resolveMermaidDiagramOptions(
      { style: 'anthropic-blog' },
      'light',
      parsed,
    )
    assert.equal(options.themeVariables, undefined)
    assert.equal(options.fontFamily, undefined)
    assert.equal(options.c4, undefined)
  }
})

test('Mermaid style: absent/unknown selections use Anthropic and explicit Original survives', async () => {
  const { resolveMermaidStyle } = await load()
  for (const value of [undefined, null, '', 'forest', 1, {}, []]) {
    assert.equal(resolveMermaidStyle(value), 'anthropic-blog')
  }
  assert.equal(resolveMermaidStyle('original'), 'original')
  assert.equal(resolveMermaidStyle('anthropic-blog'), 'anthropic-blog')
})

test('Original follows page theme and clears every custom rendering option', async () => {
  const { resolveMermaidRenderOptions } = await load()
  for (const options of [{ style: 'original' }]) {
    for (const theme of ['light', 'dark']) {
      const resolved = resolveMermaidRenderOptions(options, theme)
      assert.equal(resolved.theme, theme === 'dark' ? 'dark' : 'default')
      assert.equal(resolved.themeVariables, undefined)
      assert.equal(resolved.themeCSS, undefined)
      assert.equal(resolved.fontFamily, undefined)
    }
  }
})

test('Anthropic keeps its light paper and local serif typography on a dark page', async () => {
  const { resolveMermaidRenderOptions } = await load()
  const light = resolveMermaidRenderOptions(
    { style: 'anthropic-blog' },
    'light',
  )
  const dark = resolveMermaidRenderOptions({ style: 'anthropic-blog' }, 'dark')
  assert.deepEqual(light, dark)
  assert.equal(light.theme, 'base')
  assert.equal(light.darkMode, false)
  assert.equal(light.themeVariables.background, '#faf9f5')
  assert.equal(light.themeVariables.primaryColor, '#f1eadf')
  assert.equal(light.themeVariables.primaryTextColor, '#24231f')
  assert.equal(light.themeVariables.fontFamily, light.fontFamily)
  assert.match(light.fontFamily, /Georgia/)
})

test('Renderer mutation cannot leak between style resolutions', async () => {
  const { resolveMermaidRenderOptions } = await load()
  const options = { style: 'anthropic-blog' }
  const a = resolveMermaidRenderOptions(options, 'dark')
  a.themeVariables.primaryColor = 'renderer mutation'
  a.themeCSS = 'renderer mutation'
  const b = resolveMermaidRenderOptions(options, 'light')
  assert.equal(b.themeVariables.primaryColor, '#f1eadf')
  assert.notEqual(b.themeCSS, a.themeCSS)
  assert.deepEqual(options, { style: 'anthropic-blog' })
  const original = resolveMermaidRenderOptions({ style: 'original' }, 'light')
  assert.equal(original.themeVariables, undefined)
  assert.equal(original.themeCSS, undefined)
})

test('nested preset options are isolated and author fonts reach the ZenUML adapter', async () => {
  const { resolveMermaidDiagramOptions } = await load()
  const parsed = {
    diagramType: 'zenuml',
    config: { themeVariables: { fontFamily: 'Courier New' } },
  }
  const a = resolveMermaidDiagramOptions(
    { style: 'anthropic-blog' },
    'light',
    parsed,
  )
  assert.match(a.svgCSS, /Courier New/)
  a.themeVariables.xyChart.backgroundColor = 'mutation'
  a.c4.personFontFamily = 'mutation'
  const b = resolveMermaidDiagramOptions(
    { style: 'anthropic-blog' },
    'light',
    parsed,
  )
  assert.equal(b.themeVariables.xyChart.backgroundColor, '#faf9f5')
  assert.match(b.c4.personFontFamily, /Georgia/)
  assert.equal(
    resolveMermaidDiagramOptions({ style: 'original' }, 'dark', parsed).c4,
    undefined,
  )
})
