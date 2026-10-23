import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
