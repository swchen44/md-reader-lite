import test from 'node:test'
import assert from 'node:assert/strict'

// src/core/commands.ts imports `@/core/storage`, which node --test cannot
// resolve (webpack-only alias — see lesson_learn.md #9), and storage.ts
// itself uses `<T>expr` angle-bracket type assertions that Node's
// type-stripping loader rejects (only `expr as T` is supported), so even
// retrofitting the alias wouldn't make it importable here. We mirror the
// toggle/toggleTheme logic verbatim instead, matching the established
// pattern in graphviz.test.mjs / plantuml-plugin.test.mjs for modules that
// pull in non-`#core` aliases.
async function toggle(getStored, handler, key, defaultValue) {
  const data = await getStored(key)
  const value = data[key] === undefined ? defaultValue : data[key]
  handler('storage', { key, value: !value })
}

async function toggleTheme(getStored, handler) {
  const { pageTheme = 'auto' } = await getStored('pageTheme')
  const next =
    pageTheme === 'auto' ? 'light' : pageTheme === 'light' ? 'dark' : 'auto'
  handler('storage', { key: 'pageTheme', value: next })
}

function fakeGetStored(store) {
  return async key => ({ [key]: store[key] })
}

test('toggleSide: missing value defaults to false (so first toggle → true)', async () => {
  const calls = []
  await toggle(
    fakeGetStored({}),
    (action, data) => calls.push({ action, data }),
    'hiddenSide',
    false,
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'hiddenSide', value: true } },
  ])
})

test('toggleCentered: missing value defaults to true (so first toggle → false)', async () => {
  const calls = []
  await toggle(
    fakeGetStored({}),
    (action, data) => calls.push({ action, data }),
    'centered',
    true,
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'centered', value: false } },
  ])
})

test('toggleRefresh: flips an existing true value to false', async () => {
  const calls = []
  await toggle(
    fakeGetStored({ refresh: true }),
    (action, data) => calls.push({ action, data }),
    'refresh',
    false,
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'refresh', value: false } },
  ])
})

test('toggleTheme: auto → light', async () => {
  const calls = []
  await toggleTheme(fakeGetStored({ pageTheme: 'auto' }), (action, data) =>
    calls.push({ action, data }),
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'pageTheme', value: 'light' } },
  ])
})

test('toggleTheme: light → dark', async () => {
  const calls = []
  await toggleTheme(fakeGetStored({ pageTheme: 'light' }), (action, data) =>
    calls.push({ action, data }),
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'pageTheme', value: 'dark' } },
  ])
})

test('toggleTheme: dark → auto (cycle closes)', async () => {
  const calls = []
  await toggleTheme(fakeGetStored({ pageTheme: 'dark' }), (action, data) =>
    calls.push({ action, data }),
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'pageTheme', value: 'auto' } },
  ])
})

test('toggleTheme: missing pageTheme defaults to auto → light', async () => {
  const calls = []
  await toggleTheme(fakeGetStored({}), (action, data) =>
    calls.push({ action, data }),
  )
  assert.deepEqual(calls, [
    { action: 'storage', data: { key: 'pageTheme', value: 'light' } },
  ])
})
