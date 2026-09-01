import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/charset')

test('needsCharsetCompat: file: + true -> true', async () => {
  const { needsCharsetCompat } = await load()
  assert.equal(needsCharsetCompat('file:', true), true)
})

test('needsCharsetCompat: file: + false -> false', async () => {
  const { needsCharsetCompat } = await load()
  assert.equal(needsCharsetCompat('file:', false), false)
})

test('needsCharsetCompat: http: + true -> false', async () => {
  const { needsCharsetCompat } = await load()
  assert.equal(needsCharsetCompat('http:', true), false)
})

test('needsCharsetCompat: https: + true -> false', async () => {
  const { needsCharsetCompat } = await load()
  assert.equal(needsCharsetCompat('https:', true), false)
})

test('needsCharsetCompat: non-string protocol is defensively false', async () => {
  const { needsCharsetCompat } = await load()
  assert.equal(needsCharsetCompat(undefined, true), false)
  assert.equal(needsCharsetCompat(null, true), false)
  assert.equal(needsCharsetCompat(42, true), false)
})

test('canBgFetch: same file URL + matching extension id -> true', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch(
      'file:///Users/me/doc.md',
      'file:///Users/me/doc.md',
      'abc',
      'abc',
    ),
    true,
  )
})

test('canBgFetch: file page requesting a DIFFERENT file (senderUrl!==targetUrl) -> false (file-disclosure guard)', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch(
      'file:///Users/me/doc.md',
      'file:///Users/me/secret.md',
      'abc',
      'abc',
    ),
    false,
  )
})

test('canBgFetch: http page (senderUrl) requesting a file (targetUrl), urls differ -> false', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch(
      'https://example.com/page.html',
      'file:///Users/me/doc.md',
      'abc',
      'abc',
    ),
    false,
  )
})

test('canBgFetch: same http URL (senderUrl===targetUrl) but protocol is not file: -> false', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch(
      'https://example.com/page.html',
      'https://example.com/page.html',
      'abc',
      'abc',
    ),
    false,
  )
})

test('canBgFetch: senderId does not match extensionId -> false', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch(
      'file:///Users/me/doc.md',
      'file:///Users/me/doc.md',
      'abc',
      'other-extension-id',
    ),
    false,
  )
})

test('canBgFetch: senderUrl empty or non-string -> false', async () => {
  const { canBgFetch } = await load()
  assert.equal(canBgFetch('', 'file:///Users/me/doc.md', 'abc', 'abc'), false)
  assert.equal(
    canBgFetch(undefined, 'file:///Users/me/doc.md', 'abc', 'abc'),
    false,
  )
  assert.equal(canBgFetch(42, 'file:///Users/me/doc.md', 'abc', 'abc'), false)
})

test('canBgFetch: targetUrl is malformed ("not a url") -> false', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch('file:///Users/me/doc.md', 'not a url', 'abc', 'abc'),
    false,
  )
})

test('canBgFetch: extensionId non-string -> false', async () => {
  const { canBgFetch } = await load()
  assert.equal(
    canBgFetch('file:///Users/me/doc.md', 'file:///Users/me/doc.md', 42, 42),
    false,
  )
})
