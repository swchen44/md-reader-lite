const { readFile } = require('node:fs/promises')
const { resolve } = require('node:path')
const { createHash } = require('node:crypto')
const assert = require('node:assert/strict')

async function hashFiles(base, paths) {
  return Object.fromEntries(
    await Promise.all(
      paths.map(async path => [
        path,
        createHash('sha256')
          .update(await readFile(resolve(base, path)))
          .digest('hex'),
      ]),
    ),
  )
}

async function fingerprint(output) {
  return {
    inputs: await hashFiles(__dirname, [
      'content.js',
      'frame.js',
      'frame.html',
      '../../../src/core/mermaid/frame-runtime.js',
      '../../../src/core/mermaid/frame-transport.js',
      '../../../src/core/mermaid/css-policy.mjs',
      '../../../src/core/mermaid/svg-policy.js',
      '../../../src/core/mermaid/resource-preflight.mjs',
      'fault-injection.js',
      'background.js',
      'manifest.json',
      'package.json',
      'package-lock.json',
      'build.cjs',
      'evidence.cjs',
      '../../../pnpm-lock.yaml',
    ]),
    outputs: await hashFiles(output, [
      'js/content.js',
      'js/frame.js',
      'frame.html',
      'background.js',
      'manifest.json',
    ]),
  }
}

function verifyFingerprint(built, current) {
  assert.deepEqual(
    { inputs: built.inputs, outputs: built.outputs },
    current,
    'Rebuild the probe: source, lockfile or generated artifacts have changed',
  )
}

async function runGate(report, name, task) {
  let gate = report.gates.find(item => item.name === name)
  if (!gate) {
    gate = { name, status: 'pending' }
    report.gates.push(gate)
  }
  try {
    await task()
    gate.status = 'pass'
  } catch (error) {
    gate.status = 'fail'
    gate.error = error.message
    throw error
  }
}

async function finishReport(report, cleanup, save) {
  report.cleanupErrors = []
  for (const task of cleanup) {
    try {
      await task()
    } catch (error) {
      report.cleanupErrors.push(error.message)
    }
  }
  report.summary = { pass: 0, fail: 0, unavailable: 0 }
  for (const gate of report.gates) {
    if (gate.status === 'pending') gate.status = 'unavailable'
    report.summary[gate.status]++
  }
  report.finished = new Date().toISOString()
  await save(report)
}

module.exports = { fingerprint, verifyFingerprint, runGate, finishReport }
