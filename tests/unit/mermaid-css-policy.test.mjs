import test from 'node:test'
import assert from 'node:assert/strict'
import { createCSSPolicy } from '../../src/core/mermaid/css-policy.mjs'

test('safe author colors, geometry and local marker references survive', () => {
  const policy = createCSSPolicy(
    ['.node{fill:#ff0000;stroke:rgb(1,2,3);filter:url(#shadow)}'],
    new Set(['shadow']),
  )
  assert.match(policy.styles[0], /#ff0000/)
  assert.match(policy.styles[0], /url\(#shadow\)/)
  assert.match(policy.value('translate(2px,3px)'), /translate/)
})

test('URL imports, escaped URLs, image-set and external fragments are blocked', () => {
  for (const css of [
    '@import "https://probe.invalid/a.css";',
    '.x{fill:url(https://probe.invalid/a.svg)}',
    '.x{background:image-set("https://probe.invalid/a.png" 1x)}',
    '.x{background:im\\61ge-set("https://probe.invalid/a.png" 1x)}',
    '@font-face{font-family:remote;src:url(font.woff2)}',
  ])
    assert.throws(
      () => createCSSPolicy([css], new Set()),
      /Blocked resource policy/,
    )
  assert.equal(
    createCSSPolicy(['.x{fill:u\\72l(https://probe.invalid/a.svg)}'], new Set())
      .styles[0],
    '.x{}',
  )
})

test('invalid native CSS is discarded and missing fragments cannot reference host definitions', () => {
  const policy = createCSSPolicy([], new Set(), ['undefined;;;undefined'])
  assert.equal(policy.inline[0], '')
  assert.equal(policy.value('hsl(240, 100%, NaN%)'), '')
  assert.equal(policy.value('url(#not-in-this-svg)'), 'none')
})

test('variables resolve locally without inheriting resource values from the host', () => {
  const policy = createCSSPolicy(
    [
      ':root{--safe:#123456}.x{fill:var(--safe);stroke:var(--host,red);color:var(--absent)}',
    ],
    new Set(),
  )
  assert.doesNotMatch(policy.styles[0], /var\(/)
  assert.match(policy.styles[0], /fill:#123456/)
  assert.match(policy.styles[0], /stroke:red/)
  assert.match(policy.styles[0], /color:initial/)
  assert.throws(
    () =>
      createCSSPolicy(
        [':root{--a:var(--b);--b:var(--a)}.x{fill:var(--a)}'],
        new Set(),
      ),
    /Blocked resource policy/,
  )
})

test('inline style values use the same URL and variable boundary', () => {
  const policy = createCSSPolicy([], new Set(), ['fill:#abcdef;--safe:red'])
  assert.match(policy.inline[0], /#abcdef/)
  assert.equal(policy.value('var(--safe)'), 'red')
  assert.throws(
    () => policy.value('url(/relative.svg)'),
    /Blocked resource policy/,
  )
})

test('small CSS variable inputs cannot expand without a total budget', () => {
  let css = ':root{--v0:red;'
  for (let i = 1; i <= 15; i++)
    css += `--v${i}:var(--v${i - 1}) var(--v${i - 1});`
  css += '}.node{fill:var(--v15)}'
  assert.throws(
    () => createCSSPolicy([css], new Set()),
    /Blocked resource policy: CSS expansion budget/,
  )
})

test('output selectors target only the SVG and animations have local names', () => {
  const policy = createCSSPolicy(
    [
      'body:has(#diagram){display:none!important}.node::before{content:"x"}@keyframes pulse{to{opacity:0}}.node{animation:pulse 1s}',
    ],
    new Set(['diagram']),
    [],
    'diagram',
  )
  assert.match(
    policy.styles[0],
    /body:has\(#diagram\):where\(#diagram,#diagram \*\)/,
  )
  assert.match(policy.styles[0], /:where\(#diagram,#diagram \*\)::before/)
  assert.match(policy.styles[0], /@keyframes diagram-pulse/)
  assert.match(policy.styles[0], /animation:diagram-pulse/)
})
