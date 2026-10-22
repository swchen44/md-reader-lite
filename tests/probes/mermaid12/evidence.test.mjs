import test from 'node:test'
import assert from 'node:assert/strict'
import evidence from './evidence.cjs'

test('a setup failure inside a gate remains a failed receipt and is rethrown', async () => {
  const report = { gates: [] }
  await assert.rejects(
    evidence.runGate(report, 'file permission', async () => {
      throw new Error('permission toggle unavailable')
    }),
    /permission toggle unavailable/,
  )
  assert.equal(report.gates[0].status, 'fail')
  assert.match(report.gates[0].error, /permission toggle unavailable/)
})

test('cleanup failures do not suppress other cleanup or the receipt', async () => {
  const report = {
    gates: [{ status: 'pass' }, { status: 'fail' }, { status: 'pending' }],
  }
  const calls = []
  await evidence.finishReport(
    report,
    [
      async () => {
        calls.push('browser')
        throw new Error('close failed')
      },
      async () => {
        calls.push('server')
      },
    ],
    async result => {
      calls.push('save')
      assert.equal(result.cleanupErrors.length, 1)
    },
  )
  assert.deepEqual(calls, ['browser', 'server', 'save'])
  assert.deepEqual(report.summary, { pass: 1, fail: 1, unavailable: 1 })
})

test('a stale source or bundle fingerprint is rejected', () => {
  const built = {
    inputs: { source: 'abc', lockfile: 'def' },
    outputs: { bundle: '123' },
  }
  assert.doesNotThrow(() =>
    evidence.verifyFingerprint(built, structuredClone(built)),
  )
  assert.throws(
    () =>
      evidence.verifyFingerprint(built, {
        ...built,
        inputs: { source: 'new', lockfile: 'def' },
      }),
    /Rebuild/,
  )
  assert.throws(
    () =>
      evidence.verifyFingerprint(built, {
        ...built,
        outputs: { bundle: 'old' },
      }),
    /Rebuild/,
  )
})
