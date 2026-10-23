const SHARED_NAMES = new Set([
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
])

export function selectFixtures(fixtures, scope) {
  const expected = { 'shared-11': 11, 'gallery-31': 31, zenuml: 1 }[scope]
  if (!expected) throw new Error(`Unknown benchmark scope: ${scope}`)
  const selected = fixtures.filter(
    item =>
      scope === 'gallery-31' ||
      (scope === 'zenuml'
        ? item.name === 'ZenUML'
        : SHARED_NAMES.has(item.name)),
  )
  if (
    selected.length !== expected ||
    new Set(selected.map(item => item.name)).size !== expected
  )
    throw new Error(`Incomplete benchmark inventory: ${scope}`)
  return selected
}

export function summarize(samples, minimum) {
  if (samples.length < minimum) throw new Error('Incomplete benchmark run')
  if (samples.some(value => !Number.isFinite(value) || value < 0))
    throw new Error('Invalid benchmark sample')
  const sorted = [...samples].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return {
    samples: [...samples],
    count: samples.length,
    median:
      sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    max: sorted.at(-1),
  }
}
