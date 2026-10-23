import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const flush = () => new Promise(resolve => setImmediate(resolve))
function deferred() {
  let resolve
  const promise = new Promise(r => (resolve = r))
  return { promise, resolve }
}

// Execute the real background and commands modules; replace only Chrome/storage.
function background() {
  let message, command
  const writes = [],
    sends = [],
    reads = [],
    queries = []
  const writeGate = deferred(),
    readGate = deferred()
  const storage = {
    async set(data) {
      writes.push(data)
      await writeGate.promise
    },
    async get(key) {
      reads.push(key)
      await readGate.promise
      return { [key]: false }
    },
  }
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(fn) {
          message = fn
        },
      },
    },
    commands: {
      onCommand: {
        addListener(fn) {
          command = fn
        },
      },
    },
    tabs: {
      query(_query, callback) {
        queries.push(activeTab)
        const tabs = activeTab === undefined ? [] : [{ id: activeTab }]
        if (callback) callback(tabs)
        else return Promise.resolve(tabs)
      },
      sendMessage(id, payload, callback) {
        sends.push({ id, ...payload })
        callback?.()
      },
    },
  }
  let activeTab = 11
  function load(path, dependencies) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText
    const exports = {}
    new Function('require', 'exports', 'chrome', compiled)(
      name => {
        assert.ok(name in dependencies, name)
        return dependencies[name]
      },
      exports,
      chrome,
    )
    return exports.default
  }
  const commands = load('../../src/core/commands.ts', {
    '@/core/storage': { default: storage },
  })
  load('../../src/background.ts', {
    '@/core/storage': { default: storage },
    '@/core/commands': { default: commands },
    '@/core/charset': { canBgFetch: () => false },
    '@/core/mermaid/offscreen-broker': { installOffscreenBroker() {} },
  })
  return {
    writes,
    sends,
    reads,
    queries,
    writeGate,
    readGate,
    activate(id) {
      activeTab = id
    },
    message(data, sender = {}) {
      message({ action: 'storage', data }, sender, () => {})
    },
    command(name) {
      command(name)
    },
  }
}

test('content setting replies stay with sender.tab even after active tab changes', async () => {
  const bg = background()
  bg.activate(22)
  bg.message({ key: 'hiddenSide', value: true }, { tab: { id: 11 } })
  await flush()
  bg.activate(33)
  bg.writeGate.resolve()
  await flush()
  assert.equal(bg.sends.length, 1)
  assert.equal(bg.sends[0].id, 11)
  assert.equal(bg.sends[0].data.value, true)
})

test('popup setting pins active tab before awaiting storage.set', async () => {
  const bg = background()
  bg.message({ key: 'pageTheme', value: 'dark' })
  await flush()
  assert.equal(bg.writes.length, 1)
  bg.activate(22)
  bg.writeGate.resolve()
  await flush()
  assert.equal(bg.sends[0].id, 11)
})

test('shortcut pins active tab before awaiting storage.get and storage.set', async () => {
  const bg = background()
  bg.command('toggleSide')
  await flush()
  assert.deepEqual(bg.reads, ['hiddenSide'])
  bg.activate(22)
  bg.readGate.resolve()
  await flush()
  bg.activate(33)
  bg.writeGate.resolve()
  await flush()
  assert.equal(bg.sends[0].id, 11)
  assert.equal(
    bg.sends[0].action,
    'toggleSide',
    'shortcut still toggles actual narrow-page visibility',
  )
})

test('no target at ingress must not send a delayed update to a newly active tab', async () => {
  const bg = background()
  bg.activate(undefined)
  bg.message({ key: 'hiddenSide', value: true })
  await flush()
  bg.activate(22)
  bg.writeGate.resolve()
  await flush()
  assert.deepEqual(bg.writes, [{ hiddenSide: true }])
  assert.deepEqual(bg.sends, [])
})
