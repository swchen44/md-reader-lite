import test from 'node:test'
import assert from 'node:assert/strict'

test('pinned ZenUML parser validates without constructing a React diagram', async () => {
  // The browser library reads its local theme preference during initialization.
  const previousLocation = globalThis.location
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  )
  globalThis.location = new URL('https://extension.invalid/')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => null, setItem() {}, removeItem() {} },
  })
  try {
    const { validateZenUML } = await import('../../src/core/mermaid/zenuml.js')
    await assert.doesNotReject(() =>
      validateZenUML('zenuml\n A as Alice\n B as Backend\n A->B: Hello'),
    )
    await assert.rejects(
      () => validateZenUML('zenuml\n A.Load() {'),
      /ZenUML syntax error/,
    )
    await assert.doesNotReject(() =>
      validateZenUML('zenuml\n A.Load() {\n B.Fetch()\n }'),
    )
  } finally {
    if (previousLocation === undefined) delete globalThis.location
    else globalThis.location = previousLocation
    if (storageDescriptor)
      Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  }
})
