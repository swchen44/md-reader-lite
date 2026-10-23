import test from 'node:test'
import assert from 'node:assert/strict'
import { connectFrame } from '../../src/core/mermaid/frame-transport.js'

test('opaque sandbox pages render through runtime without appending a child iframe', async () => {
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    chrome: globalThis.chrome,
  }
  const messages = []
  globalThis.window = {
    get sessionStorage() {
      throw new DOMException('sandbox', 'SecurityError')
    },
  }
  globalThis.chrome = {
    runtime: {
      getURL: () => 'chrome-extension://test/mermaid-frame.html',
      sendMessage(message, callback) {
        messages.push(message)
        queueMicrotask(() =>
          callback({ ok: true, result: { status: 'ready', svg: '<svg/>' } }),
        )
      },
    },
  }
  globalThis.document = {
    createElement() {
      throw new Error('sandbox must not create iframe')
    },
  }
  let renderer
  try {
    renderer = await connectFrame()
    const job = {
      source: 'flowchart LR; A-->B',
      renderId: 'md-reader-mermaid-1',
    }
    assert.deepEqual(await renderer.render(job), {
      status: 'ready',
      svg: '<svg/>',
    })
    assert.deepEqual(messages, [{ action: 'renderMermaid', data: job }])
    renderer.dispose()
    await assert.rejects(renderer.render(job), /Renderer disposed/)
    assert.equal(messages.length, 1)
  } finally {
    renderer?.dispose()
    Object.assign(globalThis, saved)
  }
})

test('sandbox transport disposal rejects pending work and ignores a late callback', async () => {
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    chrome: globalThis.chrome,
  }
  let callback
  globalThis.window = {
    get sessionStorage() {
      throw new DOMException('sandbox', 'SecurityError')
    },
  }
  globalThis.chrome = {
    runtime: {
      getURL: () => 'chrome-extension://test/mermaid-frame.html',
      sendMessage(_message, reply) {
        callback = reply
      },
    },
  }
  globalThis.document = {
    createElement() {
      throw new Error('sandbox must not create iframe')
    },
  }
  let renderer
  try {
    renderer = await connectFrame()
    const pending = renderer.render({ source: 'flowchart LR; A-->B' })
    const rejected = assert.rejects(pending, /Renderer disposed/)
    renderer.dispose()
    await rejected
    callback({ ok: true, result: { status: 'ready', svg: '<svg/>' } })
  } finally {
    renderer?.dispose()
    Object.assign(globalThis, saved)
  }
})

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
