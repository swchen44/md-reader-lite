import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as settings from '#core/settings'
import * as docSearch from '../../src/core/doc-search.ts'

// Only the DOM boundary is replaced. Execute the actual panel and Ele modules.
function panelFixture(history = ['alpha', 'beta'], limit = 10) {
  const document = { activeElement: null }
  class Element extends EventTarget {
    children = []
    style = {}
    value = ''
    classes = new Set()
    classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      toggle: (name, on) =>
        on ? this.classes.add(name) : this.classes.delete(name),
    }
    setAttribute(name, value) {
      this[name] = value
    }
    appendChild(child) {
      this.children.push(child)
      return child
    }
    set innerHTML(_value) {
      this.children = []
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(selector.startsWith('.') && child.classes.has(selector.slice(1))
          ? [child]
          : []),
        ...child.querySelectorAll(selector),
      ])
    }
    focus() {
      if (document.activeElement === this) return
      document.activeElement = this
      this.dispatchEvent(new Event('focus'))
    }
  }
  class Fragment extends Element {}
  document.createElement = () => new Element()
  function load(path, dependencies = {}) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
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
      'document',
      'window',
      'DocumentFragment',
      'HTMLImageElement',
      compiled,
    )(
      name => {
        assert.ok(name in dependencies, name)
        return dependencies[name]
      },
      exports,
      document,
      { setTimeout },
      Fragment,
      class {},
    )
    return exports
  }
  const Ele = load('../../src/core/ele.ts')
  const className = load('../../src/config/class-name.ts')
  const { createSearchPanel } = load('../../src/core/search-panel.ts', {
    '@/core/ele': Ele,
    '@/config/class-name': className,
    '@/core/settings': settings,
    '@/core/doc-search': docSearch,
  })
  const commits = [],
    queries = []
  const panel = createSearchPanel({
    getArticle: () => new Element(),
    getHeads: () => [],
    localize: key => key,
    onRequestClose: () => panel.clear(),
    getMode: () => 'files',
    onFilesQuery: query => queries.push(query),
    getSearchHistory: () => history,
    getSearchHistoryLimit: () => limit,
    onRecordSearchQuery: query => commits.push(query),
  })
  const [input, , dropdown] = panel.bar.ele.children
  function key(code, extra = {}) {
    const event = new Event('keydown', { cancelable: true })
    Object.assign(event, { code, isComposing: false, ...extra })
    input.dispatchEvent(event)
    return event
  }
  return {
    panel,
    input,
    dropdown,
    document,
    commits,
    queries,
    key,
    candidates: () => dropdown.children.map(child => child.textContent),
    update(next, nextLimit = limit) {
      history = next
      limit = nextLimit
      panel.refreshHistory()
    },
  }
}

test('empty open and subsequent input focus show recent history; typing filters without committing', () => {
  const f = panelFixture()
  f.panel.focus()
  assert.deepEqual(f.candidates(), ['alpha', 'beta'])
  f.input.value = 'BET'
  f.input.dispatchEvent(new Event('input'))
  assert.deepEqual(f.candidates(), ['beta'])
  f.panel.clear()
  f.document.activeElement = null
  f.input.focus()
  assert.deepEqual(f.candidates(), ['alpha', 'beta'])
  assert.deepEqual(f.commits, [])
})

for (const code of ['Enter', 'NumpadEnter']) {
  test(`${code} commits a nonempty query and ignores an IME confirmation`, () => {
    const f = panelFixture([])
    f.input.value = ' 中文 '
    assert.equal(
      f.key(code, { key: 'Enter', isComposing: true }).defaultPrevented,
      false,
    )
    assert.deepEqual(f.commits, [])
    assert.equal(f.key(code, { key: 'Enter' }).defaultPrevented, true)
    assert.deepEqual(f.commits, ['中文'])
    assert.equal(f.queries.at(-1), ' 中文 ')
    assert.equal(f.dropdown.style.display, 'none')
    f.input.value = '  '
    f.key(code)
    assert.deepEqual(f.commits, ['中文'], 'blank Enter must not write history')
  })
}

test('disabled history does not commit a query', () => {
  const f = panelFixture(['alpha'], 0)
  f.input.value = 'beta'
  f.key('Enter')
  assert.deepEqual(f.commits, [])
})

test('Shift+Tab leaves backward focus navigation native without selecting history', () => {
  const f = panelFixture()
  f.panel.focus()
  assert.equal(
    f.key('Tab', { key: 'Tab', shiftKey: true }).defaultPrevented,
    false,
  )
  assert.equal(f.input.value, '')
  assert.deepEqual(f.commits, [])
})

for (const selection of ['click', 'Tab', 'Enter', 'NumpadEnter']) {
  test(`${selection} selects a candidate, restores input focus and leaves the dropdown closed`, () => {
    const f = panelFixture()
    f.input.value = 'a'
    f.input.dispatchEvent(new Event('input'))
    if (selection === 'click') {
      f.dropdown.children[1].focus()
      f.dropdown.children[1].dispatchEvent(new Event('click'))
    } else {
      f.key('ArrowDown')
      f.key('ArrowDown')
      f.key(selection)
    }
    assert.equal(f.input.value, 'beta')
    assert.equal(f.document.activeElement, f.input)
    assert.deepEqual(f.commits, ['beta'])
    assert.equal(f.dropdown.style.display, 'none')
    assert.deepEqual(f.candidates(), [])
  })
}

test('live history and limit changes refresh visible candidates and remove stale keyboard selections', () => {
  const f = panelFixture()
  f.input.dispatchEvent(new Event('input'))
  f.key('ArrowDown')
  f.update(['gamma', 'alpha', 'beta'], 2)
  assert.deepEqual(f.candidates(), ['gamma', 'alpha'])
  f.input.value = 'AL'
  f.input.dispatchEvent(new Event('input'))
  f.update(['delta', 'alpha'])
  assert.deepEqual(f.candidates(), ['alpha'])
  f.update([])
  assert.equal(f.dropdown.style.display, 'none')
  f.input.value = 'fresh'
  f.key('Enter')
  assert.deepEqual(f.commits, ['fresh'])
  f.input.value = ''
  f.panel.focus()
  f.update(['new'])
  f.panel.focus()
  f.update(['new'], 0)
  assert.equal(f.dropdown.style.display, 'none')
  f.panel.clear()
})

test('a storage acknowledgement does not reopen suggestions after submitting or closing', () => {
  const f = panelFixture()
  f.input.value = 'alpha'
  f.key('Enter')
  f.update(['alpha', 'beta'])
  assert.equal(f.dropdown.style.display, 'none')
  f.panel.clear()
  f.update(['gamma', 'alpha'])
  assert.equal(f.dropdown.style.display, 'none')
})

for (const code of ['Enter', 'Tab']) {
  test(`${code} keeps the selected term when another document changes history order`, () => {
    const f = panelFixture(['alpha', 'beta'])
    f.input.value = 'a'
    f.input.dispatchEvent(new Event('input'))
    f.key('ArrowDown')
    f.key('ArrowDown')
    f.update(['gamma', 'alpha', 'BETA'])
    f.key(code)
    assert.equal(f.input.value, 'BETA')
    assert.deepEqual(f.commits, ['BETA'])
  })
}
