import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/plantuml')

const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml'

test('normalizePlantumlServer: strips trailing slashes', async () => {
  const { normalizePlantumlServer } = await load()
  assert.equal(
    normalizePlantumlServer('https://plantuml.example.com///'),
    'https://plantuml.example.com',
  )
})

test('normalizePlantumlServer: non-string -> default', async () => {
  const { normalizePlantumlServer } = await load()
  assert.equal(normalizePlantumlServer(undefined), DEFAULT_SERVER)
  assert.equal(normalizePlantumlServer(null), DEFAULT_SERVER)
  assert.equal(normalizePlantumlServer(42), DEFAULT_SERVER)
})

test('normalizePlantumlServer: empty string -> default', async () => {
  const { normalizePlantumlServer } = await load()
  assert.equal(normalizePlantumlServer(''), DEFAULT_SERVER)
})

test('normalizePlantumlServer: whitespace-only string -> default', async () => {
  const { normalizePlantumlServer } = await load()
  assert.equal(normalizePlantumlServer('   '), DEFAULT_SERVER)
})

test('normalizePlantumlServer: trims surrounding whitespace', async () => {
  const { normalizePlantumlServer } = await load()
  assert.equal(
    normalizePlantumlServer('  https://plantuml.example.com  '),
    'https://plantuml.example.com',
  )
})

test('normalizePlantumlServer: no trailing slash left unchanged', async () => {
  const { normalizePlantumlServer } = await load()
  assert.equal(
    normalizePlantumlServer('https://plantuml.example.com'),
    'https://plantuml.example.com',
  )
})

test('buildPlantumlImageUrl: builds svg endpoint URL', async () => {
  const { buildPlantumlImageUrl } = await load()
  assert.equal(
    buildPlantumlImageUrl('https://plantuml.example.com', 'ENC123'),
    'https://plantuml.example.com/svg/ENC123',
  )
})

test('buildPlantumlImageUrl: normalizes trailing slash on server before building', async () => {
  const { buildPlantumlImageUrl } = await load()
  assert.equal(
    buildPlantumlImageUrl('https://plantuml.example.com/', 'ENC123'),
    'https://plantuml.example.com/svg/ENC123',
  )
})

test('buildPlantumlImageUrl: falls back to default server when non-string', async () => {
  const { buildPlantumlImageUrl } = await load()
  assert.equal(
    buildPlantumlImageUrl(undefined, 'ENC123'),
    `${DEFAULT_SERVER}/svg/ENC123`,
  )
})

test('canRenderPlantuml: enabled + online + server -> true', async () => {
  const { canRenderPlantuml } = await load()
  assert.equal(
    canRenderPlantuml(true, false, 'https://plantuml.example.com'),
    true,
  )
})

test('canRenderPlantuml: offline -> false', async () => {
  const { canRenderPlantuml } = await load()
  assert.equal(
    canRenderPlantuml(true, true, 'https://plantuml.example.com'),
    false,
  )
})

test('canRenderPlantuml: not enabled -> false', async () => {
  const { canRenderPlantuml } = await load()
  assert.equal(
    canRenderPlantuml(false, false, 'https://plantuml.example.com'),
    false,
  )
})

test('canRenderPlantuml: empty server -> false', async () => {
  const { canRenderPlantuml } = await load()
  assert.equal(canRenderPlantuml(true, false, ''), false)
  assert.equal(canRenderPlantuml(true, false, '   '), false)
})

test('canRenderPlantuml: non-string/nullish server -> false', async () => {
  const { canRenderPlantuml } = await load()
  assert.equal(canRenderPlantuml(true, false, undefined), false)
  assert.equal(canRenderPlantuml(true, false, null), false)
})

test('isPlantumlUrl: .puml / .plantuml (case-insensitive) -> true', async () => {
  const { isPlantumlUrl } = await load()
  assert.equal(isPlantumlUrl('http://x/a.puml'), true)
  assert.equal(isPlantumlUrl('http://x/a.plantuml'), true)
  assert.equal(isPlantumlUrl('file:///x/A.PUML'), true)
  assert.equal(isPlantumlUrl('https://x/dir/b.PlantUML'), true)
})

test('isPlantumlUrl: query string tolerated', async () => {
  const { isPlantumlUrl } = await load()
  assert.equal(isPlantumlUrl('http://x/a.puml?x=1'), true)
})

test('isPlantumlUrl: non-plantuml extensions -> false', async () => {
  const { isPlantumlUrl } = await load()
  assert.equal(isPlantumlUrl('http://x/a.md'), false)
  assert.equal(isPlantumlUrl('http://x/a.txt'), false)
  assert.equal(isPlantumlUrl('http://x/pumla.md'), false)
})

test('isPlantumlUrl: bad/non-string url -> false', async () => {
  const { isPlantumlUrl } = await load()
  assert.equal(isPlantumlUrl('not a url'), false)
  assert.equal(isPlantumlUrl(''), false)
  assert.equal(isPlantumlUrl(undefined), false)
})
