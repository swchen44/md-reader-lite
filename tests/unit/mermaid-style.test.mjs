import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/mermaid-style')

test('Mermaid style: unknown selections safely resolve to Original', async () => {
  const { resolveMermaidStyle } = await load()
  for (const value of [undefined, null, '', 'forest', 'original', 1, {}, []]) {
    assert.equal(resolveMermaidStyle(value), 'original')
  }
  assert.equal(resolveMermaidStyle('anthropic-blog'), 'anthropic-blog')
})

test('Original follows page theme and clears every custom rendering option', async () => {
  const { resolveMermaidRenderOptions } = await load()
  for (const options of [
    undefined,
    null,
    [],
    'bad',
    { style: 'bad' },
    { style: 'original' },
  ]) {
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

test('author theme detection uses directive JSON and accepts Mermaid 9 quoting', async () => {
  const { hasMermaidThemeDirective } = await load()
  assert.equal(
    hasMermaidThemeDirective(
      '%%{init: {"theme":"forest"}}%%\ngraph TD\n A --> B',
    ),
    true,
  )
  assert.equal(
    hasMermaidThemeDirective(
      "%%{initialize: {\n 'theme': 'dark'\n}}%%\nsequenceDiagram",
    ),
    true,
  )
  assert.equal(
    hasMermaidThemeDirective('%%{init: {"flowchart":{"curve":"linear"}}}%%'),
    false,
  )
  assert.equal(
    hasMermaidThemeDirective('%%{init: {"theme":"not-a-theme"}}%%'),
    false,
  )
  assert.equal(hasMermaidThemeDirective('%%{init: invalid}%%'), false)
  assert.equal(hasMermaidThemeDirective('graph TD\n A[theme] --> B'), false)
})
