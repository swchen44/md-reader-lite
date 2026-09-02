import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/plugin-options')

test('getDefaultPluginOptions: expected structure and values', async () => {
  const { getDefaultPluginOptions } = await load()
  const def = getDefaultPluginOptions()
  assert.equal(def.Linkify.fuzzyLink, true)
  assert.equal(def.Linkify.fuzzyIP, false)
  assert.equal(def.Linkify.fuzzyEmail, true)
  assert.equal(def.Alert.deep, true)
})

test('mergePluginOptions: null/non-object -> default', async () => {
  const { getDefaultPluginOptions, mergePluginOptions } = await load()
  assert.deepEqual(mergePluginOptions(null), getDefaultPluginOptions())
  assert.deepEqual(mergePluginOptions(undefined), getDefaultPluginOptions())
  assert.deepEqual(mergePluginOptions('abc'), getDefaultPluginOptions())
  assert.deepEqual(mergePluginOptions(42), getDefaultPluginOptions())
})

test('mergePluginOptions: missing Alert key falls back to default', async () => {
  const { mergePluginOptions } = await load()
  const merged = mergePluginOptions({ Linkify: { fuzzyLink: false } })
  assert.deepEqual(merged.Alert, { deep: true })
})

test('mergePluginOptions: partial Linkify override preserves the rest', async () => {
  const { mergePluginOptions } = await load()
  const merged = mergePluginOptions({ Linkify: { fuzzyLink: false } })
  assert.deepEqual(merged.Linkify, {
    fuzzyLink: false,
    fuzzyIP: false,
    fuzzyEmail: true,
  })
})

test('mergePluginOptions: extraneous keys are ignored', async () => {
  const { mergePluginOptions } = await load()
  const merged = mergePluginOptions({ Extra: { foo: 'bar' } })
  assert.equal('Extra' in merged, false)
})

test('mergePluginOptions: non-object value for a known key falls back to default', async () => {
  const { getDefaultPluginOptions, mergePluginOptions } = await load()
  const merged = mergePluginOptions({ Linkify: 'nope', Alert: 123 })
  assert.deepEqual(merged, getDefaultPluginOptions())
})

test('resolveLinkify: all missing -> defaults (fuzzyLink true, fuzzyIP false, fuzzyEmail true)', async () => {
  const { resolveLinkify } = await load()
  assert.deepEqual(resolveLinkify(undefined), {
    fuzzyLink: true,
    fuzzyIP: false,
    fuzzyEmail: true,
  })
  assert.deepEqual(resolveLinkify({}), {
    fuzzyLink: true,
    fuzzyIP: false,
    fuzzyEmail: true,
  })
})

test('resolveLinkify: partial boolean overrides apply', async () => {
  const { resolveLinkify } = await load()
  assert.deepEqual(resolveLinkify({ fuzzyIP: true }), {
    fuzzyLink: true,
    fuzzyIP: true,
    fuzzyEmail: true,
  })
  assert.deepEqual(resolveLinkify({ fuzzyLink: false, fuzzyEmail: false }), {
    fuzzyLink: false,
    fuzzyIP: false,
    fuzzyEmail: false,
  })
})

test('resolveLinkify: non-boolean values fall back to defaults', async () => {
  const { resolveLinkify } = await load()
  assert.deepEqual(
    resolveLinkify({ fuzzyLink: 'yes', fuzzyIP: 1, fuzzyEmail: null }),
    { fuzzyLink: true, fuzzyIP: false, fuzzyEmail: true },
  )
})

test('resolveAlertDeep: true/false pass through, missing/non-boolean -> true', async () => {
  const { resolveAlertDeep } = await load()
  assert.equal(resolveAlertDeep({ deep: true }), true)
  assert.equal(resolveAlertDeep({ deep: false }), false)
  assert.equal(resolveAlertDeep({}), true)
  assert.equal(resolveAlertDeep(undefined), true)
  assert.equal(resolveAlertDeep({ deep: 'nope' }), true)
})
