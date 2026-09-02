import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('../../src/core/event.ts')

test('on/emit: listener receives emitted args', async () => {
  const { default: Event } = await load()
  const e = new Event()
  const calls = []
  e.on('x', (...args) => calls.push(args))
  e.emit('x', 1, 2)
  assert.deepEqual(calls, [[1, 2]])
})

test('on: multiple listeners for the same event all fire', async () => {
  const { default: Event } = await load()
  const e = new Event()
  let a = 0
  let b = 0
  e.on('x', () => a++)
  e.on('x', () => b++)
  e.emit('x')
  assert.equal(a, 1)
  assert.equal(b, 1)
})

test('emit: unknown event name is a no-op', async () => {
  const { default: Event } = await load()
  const e = new Event()
  assert.doesNotThrow(() => e.emit('never-registered'))
})

test('off: removes only the given listener', async () => {
  const { default: Event } = await load()
  const e = new Event()
  let a = 0
  let b = 0
  const listenerA = () => a++
  e.on('x', listenerA)
  e.on('x', () => b++)
  e.off('x', listenerA)
  e.emit('x')
  assert.equal(a, 0)
  assert.equal(b, 1)
})

test('once: fires exactly once then auto-removes', async () => {
  const { default: Event } = await load()
  const e = new Event()
  let count = 0
  e.once('x', () => count++)
  e.emit('x')
  e.emit('x')
  assert.equal(count, 1)
})

test('clear: removes all listeners for an event', async () => {
  const { default: Event } = await load()
  const e = new Event()
  let count = 0
  e.on('x', () => count++)
  e.clear('x')
  e.emit('x')
  assert.equal(count, 0)
})
