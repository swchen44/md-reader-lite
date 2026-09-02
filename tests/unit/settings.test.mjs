import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/settings')

test('clampRefreshInterval: min/max boundaries', async () => {
  const { clampRefreshInterval } = await load()
  assert.equal(clampRefreshInterval(0.5), 0.5)
  assert.equal(clampRefreshInterval(600), 600)
})

test('clampRefreshInterval: below min clamps to min', async () => {
  const { clampRefreshInterval } = await load()
  assert.equal(clampRefreshInterval(-1), 0.5)
})

test('clampRefreshInterval: above max clamps to max', async () => {
  const { clampRefreshInterval } = await load()
  assert.equal(clampRefreshInterval(9999), 600)
})

test('clampRefreshInterval: NaN/non-numeric falls back to min', async () => {
  const { clampRefreshInterval } = await load()
  assert.equal(clampRefreshInterval(NaN), 0.5)
  assert.equal(clampRefreshInterval('abc'), 0.5)
})

test('clampRefreshInterval: numeric string parses', async () => {
  const { clampRefreshInterval } = await load()
  assert.equal(clampRefreshInterval('2.5'), 2.5)
})

test('clampCustomWidth: null/undefined/empty string -> null', async () => {
  const { clampCustomWidth } = await load()
  assert.equal(clampCustomWidth(null), null)
  assert.equal(clampCustomWidth(undefined), null)
  assert.equal(clampCustomWidth(''), null)
})

test('clampCustomWidth: below min clamps to min', async () => {
  const { clampCustomWidth } = await load()
  assert.equal(clampCustomWidth(100), 500)
})

test('clampCustomWidth: above max clamps to max', async () => {
  const { clampCustomWidth } = await load()
  assert.equal(clampCustomWidth(5000), 3000)
})

test('clampCustomWidth: numeric string parses and rounds', async () => {
  const { clampCustomWidth } = await load()
  assert.equal(clampCustomWidth('800'), 800)
})

test('clampCustomWidth: NaN -> null', async () => {
  const { clampCustomWidth } = await load()
  assert.equal(clampCustomWidth(NaN), null)
  assert.equal(clampCustomWidth('abc'), null)
})

test('textSizeIndex: exact and nearest matches', async () => {
  const { textSizeIndex } = await load()
  assert.equal(textSizeIndex(16), 2)
  assert.equal(textSizeIndex(12), 0)
  assert.equal(textSizeIndex(25), 5)
})

test('textSizeIndex: non-numeric falls back to default index', async () => {
  const { textSizeIndex } = await load()
  assert.equal(textSizeIndex('abc'), 2)
  assert.equal(textSizeIndex(undefined), 2)
})

test('FONT_STACKS: expected keys exist and default is empty', async () => {
  const { FONT_STACKS } = await load()
  assert.equal(typeof FONT_STACKS.default, 'string')
  assert.equal(FONT_STACKS.default, '')
  assert.equal(typeof FONT_STACKS.sans, 'string')
  assert.equal(typeof FONT_STACKS.serif, 'string')
  assert.equal(typeof FONT_STACKS.mono, 'string')
})

test('resolveCodeTheme: four day/night x light/dark combinations', async () => {
  const { resolveCodeTheme } = await load()
  assert.equal(resolveCodeTheme('light', 'light', 'dark'), 'light')
  assert.equal(resolveCodeTheme('dark', 'light', 'dark'), 'dark')
  assert.equal(resolveCodeTheme('light', 'dark', 'light'), 'dark')
  assert.equal(resolveCodeTheme('dark', 'dark', 'light'), 'light')
})

test('isTxtUrl: .txt and .TXT extensions are true', async () => {
  const { isTxtUrl } = await load()
  assert.equal(isTxtUrl('https://example.com/a.txt'), true)
  assert.equal(isTxtUrl('https://example.com/a.TXT'), true)
})

test('isTxtUrl: query string after extension still matches', async () => {
  const { isTxtUrl } = await load()
  assert.equal(isTxtUrl('https://example.com/a.txt?x=1'), true)
})

test('isTxtUrl: non-.txt extension and relative string are false', async () => {
  const { isTxtUrl } = await load()
  assert.equal(isTxtUrl('https://example.com/a.md'), false)
  assert.equal(isTxtUrl('relative/a.txt'), false)
})

test('clampCustomWidthPercent: min/max boundaries', async () => {
  const { clampCustomWidthPercent } = await load()
  assert.equal(clampCustomWidthPercent(20), 20)
  assert.equal(clampCustomWidthPercent(100), 100)
})

test('clampCustomWidthPercent: below min clamps to min', async () => {
  const { clampCustomWidthPercent } = await load()
  assert.equal(clampCustomWidthPercent(10), 20)
})

test('clampCustomWidthPercent: above max clamps to max', async () => {
  const { clampCustomWidthPercent } = await load()
  assert.equal(clampCustomWidthPercent(200), 100)
})

test('clampCustomWidthPercent: NaN/null -> null', async () => {
  const { clampCustomWidthPercent } = await load()
  assert.equal(clampCustomWidthPercent(NaN), null)
  assert.equal(clampCustomWidthPercent(null), null)
})

test('clampCustomWidthPercent: numeric string parses', async () => {
  const { clampCustomWidthPercent } = await load()
  assert.equal(clampCustomWidthPercent('50'), 50)
})

test('clampCustomWidthValue: px unit delegates to clampCustomWidth', async () => {
  const { clampCustomWidthValue, clampCustomWidth } = await load()
  assert.equal(clampCustomWidthValue(100, 'px'), clampCustomWidth(100))
  assert.equal(clampCustomWidthValue(800, 'px'), 800)
})

test('clampCustomWidthValue: percent unit delegates to clampCustomWidthPercent', async () => {
  const { clampCustomWidthValue, clampCustomWidthPercent } = await load()
  assert.equal(
    clampCustomWidthValue(10, 'percent'),
    clampCustomWidthPercent(10),
  )
  assert.equal(clampCustomWidthValue(50, 'percent'), 50)
})

test('formatContentWidth: px formats with px suffix', async () => {
  const { formatContentWidth } = await load()
  assert.equal(formatContentWidth(900, 'px'), '900px')
})

test('formatContentWidth: percent formats with % suffix', async () => {
  const { formatContentWidth } = await load()
  assert.equal(formatContentWidth(50, 'percent'), '50%')
})

test('formatContentWidth: null value -> null', async () => {
  const { formatContentWidth } = await load()
  assert.equal(formatContentWidth(null, 'px'), null)
  assert.equal(formatContentWidth(null, 'percent'), null)
})

test('formatContentWidth: out-of-range values are clamped before formatting', async () => {
  const { formatContentWidth } = await load()
  assert.equal(formatContentWidth(5000, 'px'), '3000px')
  assert.equal(formatContentWidth(200, 'percent'), '100%')
})

test('clampSideWidth: 正常值原樣返回', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(300), 300)
})
test('clampSideWidth: 下界 180', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(100), 180)
})
test('clampSideWidth: 上界 560', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(9999), 560)
})
test('clampSideWidth: 非數字回預設 260', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth('abc'), 260)
  assert.equal(clampSideWidth(NaN), 260)
  assert.equal(clampSideWidth(undefined), 260)
})
test('clampSideWidth: 邊界值', async () => {
  const { clampSideWidth } = await load()
  assert.equal(clampSideWidth(180), 180)
  assert.equal(clampSideWidth(560), 560)
})
