import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkMarkup,
  checkConfig,
  checkVertices,
  checkDiagram,
} from '../../src/core/mermaid/resource-preflight.mjs'

test('native paint configuration and C4 metadata reject resource values', () => {
  assert.throws(
    () =>
      checkConfig({
        sankey: {
          nodeColors: { Reader: 'url(https://probe.invalid/paint.svg)' },
        },
      }),
    /Blocked resource policy/,
  )
  assert.throws(
    () =>
      checkDiagram({
        db: {
          getC4ShapeArray: () => [
            { bgColor: 'url(https://probe.invalid/paint.svg)' },
          ],
        },
      }),
    /Blocked resource policy/,
  )
})

test('native node styles and C4 relationship paints are checked before rendering', () => {
  for (const method of [
    'getStates',
    'getEntities',
    'getRequirements',
    'getElements',
    'getBlocksFlat',
    'getNodes',
  ])
    assert.throws(
      () =>
        checkDiagram({
          db: {
            [method]: () =>
              new Map([
                [
                  'node',
                  {
                    cssStyles: [
                      'background-image:url(https://probe.invalid/style.png)',
                    ],
                  },
                ],
              ]),
          },
        }),
      /Blocked resource policy/,
      method,
    )
  assert.throws(
    () =>
      checkDiagram({
        db: {
          getRels: () => [{ lineColor: 'url(https://probe.invalid/c4.svg)' }],
        },
      }),
    /Blocked resource policy/,
  )
})

test('plain URLs and safe formatting remain readable without treating them as resources', () => {
  assert.doesNotThrow(() =>
    checkMarkup(
      'flowchart LR\n A["Read https://example.test <b>locally</b><br/>done"] --> B',
    ),
  )
  assert.doesNotThrow(() =>
    checkConfig({
      theme: 'forest',
      fontFamily: 'Courier New',
      themeCSS: '.node{fill:red}',
    }),
  )
})

test('HTML entities and Mermaid numeric entities cannot hide image elements', () => {
  for (const source of [
    '<img src="/relative.png">',
    '&lt;img src="&#104;ttps://probe.invalid/x"&gt;',
    '#60;img src=#quot;https://probe.invalid/x#quot;#62;',
  ])
    assert.throws(() => checkMarkup(source), /Blocked resource policy/)
})

test('authored CSS cannot load resources through nested configuration or raw escapes', () => {
  assert.throws(
    () => checkConfig({ themeCSS: '.node{fill:url(/relative.svg)}' }),
    /Blocked resource policy/,
  )
  assert.throws(
    () => checkConfig({ sequence: { themeCSS: '@import "x.css";' } }),
    /Blocked resource policy/,
  )
  assert.throws(
    () =>
      checkConfig({ themeCSS: '.node{fill:u\\72l(https://probe.invalid/x)}' }),
    /Blocked resource policy/,
  )
})

test('parsed metadata blocks image nodes and class resource styles before rendering', () => {
  assert.throws(
    () => checkVertices(new Map([['A', { img: 'relative.png' }]])),
    /Blocked resource policy/,
  )
  const diagram = {
    db: {
      getVertices: () => new Map([['A', { text: 'Normal' }]]),
      getClasses: () => new Map([['remote', { styles: ['fill:url(x.svg)'] }]]),
    },
  }
  assert.throws(() => checkDiagram(diagram), /Blocked resource policy/)
})
