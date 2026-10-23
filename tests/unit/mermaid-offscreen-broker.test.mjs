import test from 'node:test'
import assert from 'node:assert/strict'
import { installOffscreenBroker } from '../../src/core/mermaid/offscreen-broker.js'

const path = 'mermaid-offscreen.html'
const extensionId = 'broker-test-extension'
const documentURL = `chrome-extension://${extensionId}/${path}`
const contentSender = { id: extensionId, tab: { id: 7 } }
const offscreenSender = { id: extensionId, url: documentURL }
const job = {
  source: 'flowchart LR; A-->B',
  renderId: 'md-reader-mermaid-1',
  config: { theme: 'default', flowchart: { htmlLabels: true } },
  theme: 'light',
  style: 'anthropic-blog',
  zen: false,
}
const frameReply = { type: 'result', id: 1, status: 'ready', svg: '<svg/>' }
const flush = () => new Promise(resolve => setImmediate(resolve))

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function replaceGlobal(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, name, previous)
    else delete globalThis[name]
  })
}

// Only the Chrome boundary is mocked; all routing and lifecycle behavior runs
// through the installed real-module listener.
function boundary(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const calls = {
    listeners: [],
    contexts: [],
    creates: [],
    closes: [],
    sends: [],
  }
  let present = options.present ?? false
  const api = {
    runtime: {
      id: extensionId,
      getURL: name => `chrome-extension://${extensionId}/${name}`,
      onMessage: { addListener: listener => calls.listeners.push(listener) },
      async getContexts(filter) {
        calls.contexts.push(filter)
        return present ? [{ documentUrl: documentURL }] : []
      },
      sendMessage(message, callback) {
        calls.sends.push(message)
        if (options.send) return options.send(message, callback, api)
        queueMicrotask(() => callback(frameReply))
      },
    },
    offscreen: {
      async createDocument(parameters) {
        calls.creates.push(parameters)
        await options.create?.()
        present = true
      },
      async closeDocument() {
        calls.closes.push(true)
        await options.close?.()
        present = false
      },
    },
  }
  if (options.globalAPI) {
    replaceGlobal(t, 'chrome', api)
    installOffscreenBroker()
  } else installOffscreenBroker(api, options.brokerOptions)
  assert.equal(calls.listeners.length, 1)
  function dispatch(
    message = { action: 'renderMermaid', data: job },
    sender = contentSender,
  ) {
    const response = deferred()
    const replies = []
    const returned = calls.listeners[0](message, sender, value => {
      replies.push(value)
      response.resolve(value)
    })
    return { returned, replies, response: response.promise }
  }
  return { api, calls, dispatch }
}

test('concurrent tabs share one creation and receive asynchronous raw frame replies', async t => {
  const creation = deferred()
  const { calls, dispatch } = boundary(t, { create: () => creation.promise })
  const first = dispatch()
  const secondJob = { ...job, renderId: 'md-reader-mermaid-2' }
  const second = dispatch(
    { action: 'renderMermaid', data: secondJob },
    { id: extensionId, tab: { id: 8 } },
  )
  assert.equal(first.returned, true)
  assert.equal(second.returned, true)
  assert.deepEqual(first.replies, [])
  await flush()
  assert.deepEqual(calls.creates, [
    {
      url: path,
      reasons: ['DOM_PARSER'],
      justification:
        'Render and sanitize local Mermaid SVG on sandboxed pages.',
    },
  ])
  assert.equal(calls.sends.length, 0)
  creation.resolve()
  assert.deepEqual(await Promise.all([first.response, second.response]), [
    { ok: true, result: frameReply },
    { ok: true, result: frameReply },
  ])
  assert.deepEqual(calls.sends, [
    { target: 'mermaid-offscreen', job },
    { target: 'mermaid-offscreen', job: secondJob },
  ])
  assert.deepEqual(calls.contexts[0], {
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [documentURL],
  })
  t.mock.timers.tick(999)
  await flush()
  assert.equal(calls.closes.length, 0)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(calls.closes.length, 1)
})

test('only same-extension content scripts may request rendering; targeted messages are ignored', async t => {
  const { calls, dispatch } = boundary(t)
  for (const sender of [
    undefined,
    {},
    { id: 'foreign', tab: { id: 7 } },
    { tab: { id: 7 } },
    { id: extensionId },
    offscreenSender,
  ]) {
    const ignored = dispatch(
      { action: 'renderMermaid', data: job },
      sender ?? null,
    )
    assert.ok(ignored.returned === undefined || ignored.returned === false)
    assert.deepEqual(ignored.replies, [])
  }
  for (const message of [
    null,
    {},
    { action: 'other' },
    { target: 'unknown', action: 'renderMermaid', data: job },
    { target: 'mermaid-offscreen', job },
    { target: 'mermaid-offscreen', action: 'renderMermaid', data: job },
  ]) {
    const ignored = dispatch(message)
    assert.ok(ignored.returned === undefined || ignored.returned === false)
    assert.deepEqual(ignored.replies, [])
  }
  await flush()
  assert.equal(calls.contexts.length, 0)
  assert.equal(calls.creates.length, 0)
  assert.equal(calls.sends.length, 0)
})

test('heartbeat replies synchronously only to the exact own offscreen document without a tab', t => {
  const { calls, dispatch } = boundary(t)
  const heartbeat = { action: 'mermaidRendererHeartbeat' }
  const accepted = dispatch(heartbeat, offscreenSender)
  assert.deepEqual(accepted.replies, [{ ok: true }])
  assert.ok(accepted.returned === undefined || accepted.returned === false)
  for (const sender of [
    null,
    {},
    contentSender,
    { ...offscreenSender, id: 'foreign' },
    { ...offscreenSender, tab: { id: 7 } },
    { id: extensionId, url: `${documentURL}?spoof=1` },
    { id: extensionId, url: `${documentURL}#spoof` },
    { id: extensionId, url: `https://example.invalid/${path}` },
    {
      id: extensionId,
      url: `chrome-extension://${extensionId}/mermaid-frame.html`,
    },
  ]) {
    const ignored = dispatch(heartbeat, sender)
    assert.deepEqual(ignored.replies, [])
    assert.ok(ignored.returned === undefined || ignored.returned === false)
  }
  assert.deepEqual(
    dispatch({ ...heartbeat, target: 'unknown' }, offscreenSender).replies,
    [],
  )
  assert.equal(calls.creates.length, 0)
  assert.equal(calls.sends.length, 0)
})

test('missing offscreen API returns an explicit asynchronous error and can recover', async t => {
  const { api, calls, dispatch } = boundary(t)
  const offscreen = api.offscreen
  delete api.offscreen
  const failed = dispatch()
  assert.equal(failed.returned, true)
  assert.deepEqual(failed.replies, [])
  const response = await failed.response
  assert.equal(response.ok, false)
  assert.match(
    response.error,
    /offscreen.*(unavailable|unsupported|not available)/i,
  )
  assert.equal(calls.sends.length, 0)
  api.offscreen = offscreen
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
})

test('a failed creation releases the lifecycle latch so a later request can create again', async t => {
  let attempt = 0
  const { calls, dispatch } = boundary(t, {
    create() {
      if (++attempt === 1) throw new Error('creation rejected')
    },
  })
  assert.deepEqual(await dispatch().response, {
    ok: false,
    error: 'creation rejected',
  })
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 2)
  assert.equal(calls.sends.length, 1)
})

test('an existing document is reused without the undocumented hasDocument API', async t => {
  const { api, calls, dispatch } = boundary(t, { present: true })
  api.offscreen.hasDocument = () => {
    throw new Error('must not use hasDocument')
  }
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 0)
})

for (const existing of [true, false]) {
  test(`pre-116 clients.matchAll uses the exact document URL (existing=${existing})`, async t => {
    const { api, calls, dispatch } = boundary(t)
    delete api.runtime.getContexts
    let matched = 0
    replaceGlobal(t, 'clients', {
      async matchAll() {
        matched++
        return existing
          ? [{ url: documentURL }]
          : [
              { url: `chrome-extension://${extensionId}/popup.html` },
              { url: `${documentURL}?other` },
              { url: `https://example.invalid/${extensionId}` },
            ]
      },
    })
    assert.deepEqual(await dispatch().response, {
      ok: true,
      result: frameReply,
    })
    assert.equal(matched, 1)
    assert.equal(calls.creates.length, existing ? 0 : 1)
    assert.equal(calls.contexts.length, 0)
  })
}

test('job validation rejects malformed envelopes without creating or forwarding', async t => {
  const { calls, dispatch } = boundary(t)
  const cyclic = {}
  cyclic.self = cyclic
  for (const data of [
    undefined,
    null,
    [],
    'source',
    {},
    { ...job, source: 1 },
    { ...job, source: 'a'.repeat(50001) },
    { ...job, renderId: undefined },
    { ...job, renderId: 1 },
    { ...job, renderId: 'md-reader-mermaid-1<script>' },
    { ...job, config: [] },
    { ...job, config: null },
    { ...job, config: { value: () => {} } },
    { ...job, config: cyclic },
    { ...job, config: { value: 1n } },
  ]) {
    const pending = dispatch({ action: 'renderMermaid', data })
    assert.equal(pending.returned, true)
    const response = await pending.response
    assert.equal(response.ok, false)
    assert.match(response.error, /invalid.*(job|source|renderId|config)/i)
  }
  assert.equal(calls.creates.length, 0)
  assert.equal(calls.sends.length, 0)
})

test('structured configs and optional fields pass through unchanged for engine preflight', async t => {
  const { calls, dispatch } = boundary(t)
  const structured = {
    ...job,
    source: 'x'.repeat(50000),
    zen: true,
    theme: 'dark',
    style: 'original',
    config: {
      themeVariables: { fontFamily: 'local serif', fontSize: '17px' },
      themeCSS: '.node { fill: red; }',
      sequence: { actorMargin: 0, mirrorActors: false },
      unknownFutureConfig: [null, 3.14, true, 'value', { nested: [] }],
    },
  }
  for (const data of [
    structured,
    { source: '', renderId: 'md-reader-mermaid-0' },
    { ...job, config: Object.create(null) },
  ]) {
    assert.deepEqual(
      await dispatch({ action: 'renderMermaid', data }).response,
      { ok: true, result: frameReply },
    )
  }
  assert.deepEqual(
    calls.sends.map(message => message.job),
    [
      structured,
      { source: '', renderId: 'md-reader-mermaid-0' },
      { ...job, config: Object.create(null) },
    ],
  )
})

test('Promise-returning sendMessage forwards a raw engine rejection reply as a successful transport', async t => {
  const blocked = { status: 'blocked', error: 'Blocked resource policy: image' }
  const { dispatch } = boundary(t, { send: () => Promise.resolve(blocked) })
  const pending = dispatch()
  await flush()
  assert.deepEqual(pending.replies, [{ ok: true, result: blocked }])
})

for (const failure of ['throw', 'lastError', 'promise', 'empty']) {
  test(`sendMessage ${failure} failure releases work, closes when idle, and permits retry`, async t => {
    let fail = true
    const { calls, dispatch } = boundary(t, {
      send(_message, callback, api) {
        if (!fail) return Promise.resolve(frameReply)
        if (failure === 'throw') throw new Error('send disconnected')
        if (failure === 'promise')
          return Promise.reject(new Error('send disconnected'))
        queueMicrotask(() => {
          if (failure === 'lastError')
            api.runtime.lastError = { message: 'send disconnected' }
          try {
            callback(undefined)
          } finally {
            delete api.runtime.lastError
          }
        })
      },
    })
    const pending = dispatch()
    await flush()
    assert.equal(pending.replies.length, 1)
    assert.equal(pending.replies[0].ok, false)
    assert.match(pending.replies[0].error, /disconnected|no response/i)
    t.mock.timers.tick(1000)
    await flush()
    assert.equal(calls.closes.length, 1)
    fail = false
    const retry = dispatch()
    await flush()
    assert.deepEqual(retry.replies, [{ ok: true, result: frameReply }])
    assert.equal(calls.creates.length, 2)
  })
}

test('a new request cancels idle closure and a busy document stays open until the last reply', async t => {
  const callbacks = []
  const { calls, dispatch } = boundary(t, {
    brokerOptions: { idleMs: 20 },
    send(_message, callback) {
      callbacks.push(callback)
    },
  })
  const first = dispatch()
  const second = dispatch()
  await flush()
  callbacks[0](frameReply)
  await first.response
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(calls.closes.length, 0)
  callbacks[1](frameReply)
  await second.response
  t.mock.timers.tick(19)
  const third = dispatch()
  await flush()
  t.mock.timers.tick(1)
  await flush()
  assert.equal(calls.closes.length, 0)
  callbacks[2](frameReply)
  await third.response
  t.mock.timers.tick(19)
  await flush()
  assert.equal(calls.closes.length, 0)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(calls.closes.length, 1)
  assert.equal(calls.creates.length, 1)
})

test('work arriving during close waits for closure, then recreates before sending', async t => {
  const closing = deferred()
  const { calls, dispatch } = boundary(t, { close: () => closing.promise })
  await dispatch().response
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(calls.closes.length, 1)
  const pending = dispatch()
  await flush()
  assert.equal(calls.creates.length, 1)
  assert.equal(calls.sends.length, 1)
  closing.resolve()
  assert.deepEqual(await pending.response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 2)
  assert.equal(calls.sends.length, 2)
})

test('work arriving while idle discovery is pending prevents closure of a busy document', async t => {
  const checking = deferred()
  const replies = []
  const { api, calls, dispatch } = boundary(t, {
    send(_message, callback) {
      replies.push(callback)
    },
  })
  const first = dispatch()
  await flush()
  replies[0](frameReply)
  await first.response
  const original = api.runtime.getContexts
  t.mock.method(api.runtime, 'getContexts', () => checking.promise)
  t.mock.timers.tick(1000)
  await flush()
  const pending = dispatch()
  checking.resolve([{ documentUrl: documentURL }])
  await flush()
  assert.equal(calls.closes.length, 0)
  assert.equal(replies.length, 2)
  replies[1](frameReply)
  await pending.response
  api.runtime.getContexts = original
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(calls.closes.length, 1)
})

test('a rejected idle close does not poison the lifecycle queue', async t => {
  const { calls, dispatch } = boundary(t, {
    close() {
      throw new Error('close rejected')
    },
  })
  await dispatch().response
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(calls.closes.length, 1)
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 1)
})

for (const mode of ['callback', 'promise']) {
  test(`an unanswered ${mode} render times out by 90000ms, releases idle cleanup, and ignores late replies`, async t => {
    const late = deferred()
    let reply
    let stuck = true
    const { calls, dispatch } = boundary(t, {
      send(_message, callback) {
        if (!stuck) return Promise.resolve(frameReply)
        reply = callback
        return mode === 'promise' ? late.promise : undefined
      },
    })
    const pending = dispatch()
    await flush()
    assert.equal(calls.sends.length, 1)
    t.mock.timers.tick(89999)
    await flush()
    assert.deepEqual(pending.replies, [])
    assert.equal(calls.closes.length, 0)
    t.mock.timers.tick(1)
    await flush()
    assert.equal(pending.replies.length, 1)
    assert.equal(pending.replies[0].ok, false)
    assert.match(pending.replies[0].error, /timed out/i)
    t.mock.timers.tick(1000)
    await flush()
    assert.equal(calls.closes.length, 1)
    if (mode === 'promise') late.reject(new Error('late disconnection'))
    else reply(frameReply)
    await flush()
    assert.equal(pending.replies.length, 1)
    stuck = false
    const retry = dispatch()
    await flush()
    assert.deepEqual(retry.replies, [{ ok: true, result: frameReply }])
    assert.equal(calls.creates.length, 2)
  })
}

test('the response deadline includes slow creation; expired work never forwards after creation settles', async t => {
  const creation = deferred()
  const { calls, dispatch } = boundary(t, { create: () => creation.promise })
  const pending = dispatch()
  await flush()
  t.mock.timers.tick(90000)
  await flush()
  assert.equal(pending.replies.length, 1)
  assert.equal(pending.replies[0].ok, false)
  assert.match(pending.replies[0].error, /timed out/i)
  t.mock.timers.tick(1000)
  await flush()
  creation.resolve()
  await flush()
  assert.equal(calls.sends.length, 0)
  assert.equal(calls.closes.length, 1)
  assert.equal(pending.replies.length, 1)
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
})

test('disconnected response callback cannot leak active work or produce an unhandled rejection', async t => {
  const { calls } = boundary(t)
  assert.equal(
    calls.listeners[0](
      { action: 'renderMermaid', data: job },
      contentSender,
      () => {
        throw new Error('content tab disconnected')
      },
    ),
    true,
  )
  await flush()
  t.mock.timers.tick(1000)
  await flush()
  assert.equal(calls.closes.length, 1)
})

test('the default API is globalThis.chrome', async t => {
  const { dispatch } = boundary(t, { globalAPI: true })
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
})

test('document discovery failure releases the lifecycle latch for a later request', async t => {
  const { api, calls, dispatch } = boundary(t)
  const original = api.runtime.getContexts
  t.mock.method(api.runtime, 'getContexts', () =>
    Promise.reject(new Error('discovery rejected')),
  )
  assert.deepEqual(await dispatch().response, {
    ok: false,
    error: 'discovery rejected',
  })
  api.runtime.getContexts = original
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 1)
})

test('a deadline also covers waiting for closure and never sends expired queued work', async t => {
  const closing = deferred()
  const { calls, dispatch } = boundary(t, { close: () => closing.promise })
  await dispatch().response
  t.mock.timers.tick(1000)
  await flush()
  const pending = dispatch()
  t.mock.timers.tick(90000)
  await flush()
  assert.equal(pending.replies.length, 1)
  assert.match(pending.replies[0].error, /timed out/i)
  closing.resolve()
  await flush()
  assert.equal(calls.creates.length, 1)
  assert.equal(calls.sends.length, 1)
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 2)
})

test('late creation rejection after the response deadline is consumed and later creation recovers', async t => {
  const creation = deferred()
  let first = true
  const { calls, dispatch } = boundary(t, {
    create() {
      if (first) {
        first = false
        return creation.promise
      }
    },
  })
  const pending = dispatch()
  await flush()
  t.mock.timers.tick(90000)
  await flush()
  assert.equal(pending.replies.length, 1)
  assert.match(pending.replies[0].error, /timed out/i)
  creation.reject(new Error('late creation rejected'))
  await flush()
  assert.deepEqual(await dispatch().response, { ok: true, result: frameReply })
  assert.equal(calls.creates.length, 2)
  assert.equal(pending.replies.length, 1)
})

test('callback completion consumes a simultaneous returned Promise rejection', async t => {
  const { dispatch } = boundary(t, {
    send(_message, callback) {
      callback(frameReply)
      return Promise.reject(new Error('late dual-api rejection'))
    },
  })
  const pending = dispatch()
  assert.deepEqual(await pending.response, { ok: true, result: frameReply })
  await flush()
  assert.equal(pending.replies.length, 1)
})

test('new work invalidates an idle check even if that new request expires before discovery returns', async t => {
  const checking = deferred()
  const { api, calls, dispatch } = boundary(t)
  await dispatch().response
  const original = api.runtime.getContexts
  t.mock.method(api.runtime, 'getContexts', () => checking.promise)
  t.mock.timers.tick(1000)
  await flush()
  const pending = dispatch()
  t.mock.timers.tick(90000)
  await flush()
  assert.equal(pending.replies.length, 1)
  assert.match(pending.replies[0].error, /timed out/i)
  checking.resolve([{ documentUrl: documentURL }])
  await flush()
  assert.equal(calls.closes.length, 0)
  api.runtime.getContexts = original
  t.mock.timers.tick(999)
  await flush()
  assert.equal(calls.closes.length, 0)
  t.mock.timers.tick(1)
  await flush()
  assert.equal(calls.closes.length, 1)
})
