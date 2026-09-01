import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/network')

test('isNetworkAllowed: offlineMode true -> false', async () => {
  const { isNetworkAllowed } = await load()
  assert.equal(isNetworkAllowed(true), false)
})

test('isNetworkAllowed: offlineMode false -> true', async () => {
  const { isNetworkAllowed } = await load()
  assert.equal(isNetworkAllowed(false), true)
})

test('isRemoteUrl: http:// -> true', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('http://example.com/a.png'), true)
})

test('isRemoteUrl: https:// -> true', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('https://example.com/a.png'), true)
})

test('isRemoteUrl: protocol-relative // -> true', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('//example.com/a.png'), true)
})

test('isRemoteUrl: HTTPS uppercase scheme -> true', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('HTTPS://example.com/a.png'), true)
})

test('isRemoteUrl: relative path "img.png" -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('img.png'), false)
})

test('isRemoteUrl: relative path "./a" -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('./a'), false)
})

test('isRemoteUrl: relative path "../a" -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('../a'), false)
})

test('isRemoteUrl: data: URI -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('data:image/png;base64,abc'), false)
})

test('isRemoteUrl: blob: URI -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('blob:https://example.com/uuid'), false)
})

test('isRemoteUrl: chrome-extension:// -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('chrome-extension://abc/x.png'), false)
})

test('isRemoteUrl: file:/// -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('file:///Users/me/a.png'), false)
})

test('isRemoteUrl: empty string -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl(''), false)
})

test('isRemoteUrl: whitespace-only string -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl('   '), false)
})

test('isRemoteUrl: non-string values -> false', async () => {
  const { isRemoteUrl } = await load()
  assert.equal(isRemoteUrl(undefined), false)
  assert.equal(isRemoteUrl(null), false)
  assert.equal(isRemoteUrl(42), false)
  assert.equal(isRemoteUrl({}), false)
})
