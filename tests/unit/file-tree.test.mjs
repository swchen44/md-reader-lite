import test from 'node:test'
import assert from 'node:assert/strict'

// src/core/file-tree.ts pulls in `@/core/ele`, `@/config/class-name`, etc. —
// aliases only webpack resolves, not plain `node --test` (same constraint
// tests/graphviz.test.mjs and tests/plantuml-plugin.test.mjs work around).
// dirOf/parentOf are pure one-liners with no further dependencies, so we
// mirror them here verbatim rather than retrofitting file-tree.ts's import
// wiring just to expose two functions.
function dirOf(url) {
  return url.slice(0, url.lastIndexOf('/') + 1)
}
function parentOf(dirUrl) {
  const u = new URL(dirUrl)
  if (u.pathname === '/' || u.pathname === '') return null
  const parent = new URL('..', dirUrl).href
  return parent === dirUrl ? null : parent
}

test('dirOf: strips filename, keeps trailing slash', () => {
  assert.equal(dirOf('http://x/docs/intro.md'), 'http://x/docs/')
})

test('dirOf: already a directory URL is unchanged', () => {
  assert.equal(dirOf('http://x/docs/'), 'http://x/docs/')
})

test('dirOf: root-level file', () => {
  assert.equal(dirOf('http://x/intro.md'), 'http://x/')
})

test('parentOf: one level up', () => {
  assert.equal(parentOf('http://x/docs/api/'), 'http://x/docs/')
})

test('parentOf: at site root returns null', () => {
  assert.equal(parentOf('http://x/'), null)
})

test('parentOf: parent equal to self (edge case) returns null', () => {
  // new URL('..', 'http://x') resolves to 'http://x/' — same as input once
  // normalized, so this must not loop forever in a caller that follows
  // parentOf() up the tree.
  assert.equal(parentOf('http://x'), null)
})

test('parentOf: file:// one level up', () => {
  assert.equal(parentOf('file:///Users/x/docs/api/'), 'file:///Users/x/docs/')
})
