import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import Event from '../../src/core/event.ts'
import { createMermaidQueue } from '../../src/core/mermaid-renderer.ts'
import * as style from '../../src/core/mermaid-style.ts'

test('pagehide invalidates retained DOM jobs; pageshow resumes unfinished source once', async () => {
  const listeners = new Map()
  const event = new Event()
  let connects = 0,
    renders = 0,
    completed = 0,
    rejectPending
  const elements = Array.from({ length: 3 }, () => ({
    isConnected: true,
    dataset: { mermaidStatus: 'pending', mermaidStyle: 'original' },
    querySelector() {
      return this.dataset.mermaidStatus === 'ready'
        ? null
        : { textContent: 'flowchart LR\nA-->B' }
    },
    setAttribute() {},
    removeAttribute() {},
    append() {},
  }))
  const container = {
    isConnected: true,
    dataset: {},
    querySelectorAll(selector) {
      return elements.filter(element =>
        selector.includes('rendering')
          ? ['pending', 'rendering'].includes(element.dataset.mermaidStatus)
          : element.dataset.mermaidStatus === 'pending',
      )
    },
  }
  const connectFrame = async () => {
    const index = ++connects
    return {
      render() {
        renders++
        if (index === 1)
          return new Promise((_, reject) => {
            rejectPending = reject
          })
        return Promise.resolve({ status: 'ready', svg: '<svg/>' })
      },
      dispose() {
        if (index === 1) rejectPending?.(new Error('Renderer disposed'))
      },
    }
  }
  const dependencies = {
    '@/core/mermaid-renderer': { createMermaidQueue },
    '@/core/mermaid/frame-transport': { connectFrame },
    '@/core/mermaid-style': style,
    '@/config/i18n': { default: () => key => key },
  }
  // Transpile the actual plugin; inject only its browser/extension boundary imports.
  const source = await readFile(
    new URL('../../src/plugins/mermaid-renderer.ts', import.meta.url),
    'utf8',
  )
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
  const exports = {}
  new Function(
    'require',
    'exports',
    'window',
    'document',
    'queueMicrotask',
    compiled,
  )(
    name => {
      assert.ok(name in dependencies, name)
      return dependencies[name]
    },
    exports,
    { addEventListener: (name, handler) => listeners.set(name, handler) },
    { createElement: () => ({}) },
    queueMicrotask,
  )
  event.on('diagramsRendered', () => completed++)
  exports.default({ event, language: 'en' })
  event.emit('contentRendered', container)
  const flush = () => new Promise(resolve => setImmediate(resolve))
  await flush()
  assert.equal(connects, 1)
  assert.equal(renders, 1)
  listeners.get('pagehide')({ persisted: true })
  await flush()
  assert.equal(connects, 1, 'Hidden pages must not recreate their renderer')
  assert.equal(renders, 1)
  assert.equal(completed, 0)
  assert.equal(container.dataset.mermaidComplete, undefined)
  assert.ok(
    elements.every(element => element.dataset.mermaidStatus !== 'error'),
  )
  listeners.get('pageshow')({ persisted: true })
  await flush()
  assert.equal(connects, 2)
  assert.equal(
    renders,
    4,
    'Retry all three unfinished sources on the restored page',
  )
  assert.ok(
    elements.every(element => element.dataset.mermaidStatus === 'ready'),
  )
  assert.equal(completed, 1)
  listeners.get('pageshow')({ persisted: true })
  await flush()
  assert.equal(renders, 4, 'Duplicate pageshow must not duplicate work')
})
