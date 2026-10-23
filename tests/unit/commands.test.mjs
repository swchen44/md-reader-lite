import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Transpile the actual module and inject only the extension storage boundary.
const compiled = ts.transpileModule(
  readFileSync(new URL('../../src/core/commands.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText
function commands(getStored) {
  const exports = {}
  new Function('require', 'exports', compiled)(name => {
    assert.equal(name, '@/core/storage')
    return { default: { get: getStored } }
  }, exports)
  return exports.default
}
async function toggle(getStored, handler, key, defaultValue) {
  const name = {
    hiddenSide: 'toggleSide',
    centered: 'toggleCentered',
    refresh: 'toggleRefresh',
  }[key]
  await commands(getStored)[name](handler)
}

async function toggleTheme(getStored, handler) {
  await commands(getStored).toggleTheme(handler)
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
