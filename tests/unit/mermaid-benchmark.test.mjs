import test from 'node:test'
import assert from 'node:assert/strict'

test('benchmark scopes enforce shared-11, gallery-31 and standalone ZenUML inventories', async () => {
  const { selectFixtures } = await import('../perf/mermaid-metrics.mjs')
  const names = [
    'Flowchart',
    'Sequence Diagram',
    'Class Diagram',
    'State Diagram',
    'Entity Relationship Diagram',
    'User Journey',
    'Gantt',
    'Pie Chart',
    'Requirement Diagram',
    'GitGraph (Git) Diagram',
    'C4 Diagram',
    'ZenUML',
    ...Array.from({ length: 19 }, (_, index) => `New ${index}`),
  ]
  const fixtures = names.map(name => ({ name, source: name }))
  assert.equal(selectFixtures(fixtures, 'shared-11').length, 11)
  assert.equal(selectFixtures(fixtures, 'gallery-31').length, 31)
  assert.deepEqual(selectFixtures(fixtures, 'zenuml'), [
    { name: 'ZenUML', source: 'ZenUML' },
  ])
  assert.throws(
    () => selectFixtures(fixtures.slice(1), 'shared-11'),
    /Incomplete/,
  )
  assert.throws(
    () => selectFixtures(fixtures.slice(1), 'gallery-31'),
    /Incomplete/,
  )
  assert.throws(() => selectFixtures([], 'zenuml'), /Incomplete/)
  assert.throws(() => selectFixtures(fixtures, 'unknown'), /Unknown/)
})

test('benchmark summaries retain raw samples and reject incomplete or invalid runs', async () => {
  const { summarize } = await import('../perf/mermaid-metrics.mjs')
  assert.deepEqual(summarize([5, 1, 4, 2, 3], 5), {
    samples: [5, 1, 4, 2, 3],
    count: 5,
    median: 3,
    max: 5,
  })
  assert.equal(summarize([4, 1, 3, 2], 4).median, 2.5)
  assert.throws(() => summarize([1, 2], 5), /Incomplete/)
  assert.throws(() => summarize([1, NaN], 2), /Invalid/)
  assert.throws(() => summarize([1, -1], 2), /Invalid/)
})
