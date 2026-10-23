import test from 'node:test'
import assert from 'node:assert/strict'

const load = () => import('#core/mermaid-renderer')
const job = (id, isCurrent = () => true) => ({
  id,
  source: id,
  style: 'original',
  theme: 'light',
  isCurrent,
})

test('Mermaid rendering is serial and a rejected job does not poison the queue', async () => {
  const { createMermaidQueue } = await load()
  let active = 0
  let maximum = 0
  const calls = []
  const queue = createMermaidQueue(async item => {
    active++
    maximum = Math.max(maximum, active)
    calls.push(item.id)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    if (item.id === 'bad') throw new Error('broken diagram')
    return `<svg id="${item.id}"/>`
  })
  const result = await Promise.all(
    ['first', 'bad', 'last'].map(id => queue.run(job(id))),
  )
  assert.equal(maximum, 1)
  assert.deepEqual(calls, ['first', 'bad', 'last'])
  assert.equal(result[0].status, 'ready')
  assert.equal(result[1].status, 'error')
  assert.match(result[1].error, /broken diagram/)
  assert.equal(result[2].status, 'ready')
})

test('obsolete jobs are skipped before expensive work and after awaiting a render', async () => {
  const { createMermaidQueue } = await load()
  let release
  let current = true
  const calls = []
  const queue = createMermaidQueue(async item => {
    calls.push(item.id)
    if (item.id === 'running')
      await new Promise(resolve => {
        release = resolve
      })
    return '<svg/>'
  })
  const running = queue.run(job('running', () => current))
  await new Promise(resolve => setImmediate(resolve))
  const obsolete = queue.run(job('queued', () => current))
  current = false
  const fresh = queue.run(job('fresh'))
  release()
  assert.equal((await running).status, 'stale')
  assert.equal((await obsolete).status, 'stale')
  assert.equal((await fresh).status, 'ready')
  assert.deepEqual(calls, ['running', 'fresh'])
})
