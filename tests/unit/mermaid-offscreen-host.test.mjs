import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(
  new URL('../../src/core/mermaid/offscreen-host.js', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
const flush = () => new Promise(resolve => setImmediate(resolve))
function host(connectEmbeddedFrame) {
  let listener
  const timers = new Map(),
    messages = []
  const api = {
    runtime: {
      id: 'ours',
      onMessage: {
        addListener(fn) {
          listener = fn
        },
      },
      sendMessage(message, callback) {
        messages.push(message)
        callback()
      },
    },
  }
  new Function(
    'require',
    'exports',
    'chrome',
    'setInterval',
    'clearInterval',
    compiled,
  )(
    name => {
      assert.equal(name, './frame-transport')
      return { connectEmbeddedFrame }
    },
    {},
    api,
    (callback, ms) => {
      const id = {}
      timers.set(id, { callback, ms })
      return id
    },
    id => timers.delete(id),
  )
  return {
    timers,
    messages,
    request(job, respond, sender = { id: 'ours' }) {
      return listener({ target: 'mermaid-offscreen', job }, sender, respond)
    },
  }
}

test('offscreen host accepts only extension pages and shares one private frame', async () => {
  let connects = 0
  const jobs = [],
    replies = []
  const h = host(async () => {
    connects++
    return {
      render: async job => {
        jobs.push(job)
        return { status: 'ready', svg: job.source }
      },
    }
  })
  assert.equal(
    h.request({}, () => assert.fail(), { id: 'external' }),
    undefined,
  )
  assert.equal(
    h.request({}, () => assert.fail(), { id: 'ours', tab: { id: 7 } }),
    undefined,
  )
  assert.equal(connects, 0)
  for (const source of ['first', 'second'])
    assert.equal(
      h.request({ source }, reply => replies.push(reply)),
      true,
    )
  assert.equal(h.timers.size, 1)
  const timer = [...h.timers.values()][0]
  assert.equal(timer.ms, 20000)
  timer.callback()
  assert.deepEqual(h.messages, [{ action: 'mermaidRendererHeartbeat' }])
  await flush()
  assert.equal(connects, 1)
  assert.deepEqual(jobs, [{ source: 'first' }, { source: 'second' }])
  assert.deepEqual(replies, [
    { status: 'ready', svg: 'first' },
    { status: 'ready', svg: 'second' },
  ])
  assert.equal(h.timers.size, 0)
})

test('offscreen host releases a failed connection and can render a later job', async () => {
  let connects = 0
  const h = host(() =>
    ++connects === 1
      ? Promise.reject(new Error('frame failed'))
      : Promise.resolve({
          render: async () => ({ status: 'ready', svg: '<svg/>' }),
        }),
  )
  const replies = []
  h.request({ source: 'first' }, reply => replies.push(reply))
  await flush()
  assert.deepEqual(replies, [{ status: 'error', error: 'frame failed' }])
  h.request({ source: 'next' }, reply => replies.push(reply))
  await flush()
  assert.equal(replies[1].status, 'ready')
  assert.equal(connects, 2)
  assert.equal(h.timers.size, 0)
})

test('a closed response receiver cannot leave an unhandled rejection or heartbeat', async () => {
  const h = host(async () => ({
    render: async () => ({ status: 'ready', svg: '<svg/>' }),
  }))
  h.request({ source: 'closed page' }, () => {
    throw new Error('message port closed')
  })
  await flush()
  await flush()
  assert.equal(h.timers.size, 0)
})
