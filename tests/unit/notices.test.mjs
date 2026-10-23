import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('release packaging generates full notices after compilation and before zip', async () => {
  // Reuse the existing dev toolchain's YAML parser without a product dependency.
  const { parse } = createRequire(import.meta.resolve('lint-staged'))('yaml')
  const workflow = parse(
    await readFile(
      new URL('../../.github/workflows/release.yml', import.meta.url),
      'utf8',
    ),
  )
  const step = workflow.jobs.release.steps.find(
    item => item.name === 'Build and package',
  )
  const commands = step.run.split('\n').map(command => command.trim())
  const compile = commands.indexOf(
    'node_modules/.bin/webpack --config ./build/webpack.prod.js',
  )
  const notices = commands.indexOf('node ./scripts/notices.mjs')
  const zip = commands.indexOf('node ./scripts/zip.mjs')
  assert.ok(
    compile >= 0 && notices > compile && zip > notices,
    'Release must include full notices between webpack and zip',
  )
})

test('third-party notices preserve package license text and provenance', async () => {
  const { createNotices } = await import('../../scripts/notices.mjs')
  const dir = await mkdtemp(join(tmpdir(), 'md-reader-notices-'))
  try {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        version: '1.2.3',
        repository: { url: 'https://example.test/source' },
      }),
    )
    const inventory = {
      Unknown: [{ name: 'fixture', license: 'Unknown', paths: [dir] }],
    }
    await assert.rejects(createNotices(inventory), /Missing license documents/)
    await writeFile(
      join(dir, 'LICENSE'),
      'Fixture license\nCopyright Test Author\n',
    )
    const result = await createNotices(inventory)
    assert.equal(result.packages.length, 1)
    assert.match(result.text, /fixture@1.2.3/)
    assert.match(result.text, /Copyright Test Author/)
    assert.match(result.text, /https:\/\/example.test\/source/)
    assert.ok(!result.text.includes(dir), 'Do not ship local filesystem paths')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
