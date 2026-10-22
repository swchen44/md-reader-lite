import test from 'node:test'
import assert from 'node:assert/strict'
import { connectFrame } from './frame-transport.js'

test('disposed renderers reject immediately without posting another job', async () => {
  const originalDocument = globalThis.document
  const originalChrome = globalThis.chrome
  let posted = 0
  let renderer
  globalThis.chrome = {
    runtime: { getURL: () => 'https://extension.invalid/frame.html' },
  }
  globalThis.document = {
    createElement: () => ({
      style: {},
      setAttribute() {},
      remove() {},
      contentWindow: {
        postMessage(_data, _origin, ports) {
          posted++
          ports[0].postMessage({ type: 'ready' })
        },
      },
    }),
    body: {
      append(frame) {
        queueMicrotask(() => frame.onload())
      },
    },
  }
  let timer
  try {
    renderer = await connectFrame()
    renderer.dispose()
    await assert.rejects(
      Promise.race([
        renderer.render({ source: 'flowchart LR; A-->B' }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('did not reject immediately')),
            50,
          )
        }),
      ]),
      /Renderer disposed/,
    )
    assert.equal(posted, 1)
  } finally {
    clearTimeout(timer)
    renderer?.dispose()
    globalThis.document = originalDocument
    globalThis.chrome = originalChrome
  }
})
