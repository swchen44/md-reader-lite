import { readFile, readdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function createNotices(inventory) {
  const packages = []
  const seen = new Set()
  for (const entries of Object.values(inventory))
    for (const entry of entries)
      for (const path of entry.paths) {
        const pkg = JSON.parse(
          await readFile(join(path, 'package.json'), 'utf8'),
        )
        const id = `${pkg.name}@${pkg.version}`
        if (seen.has(id)) continue
        seen.add(id)
        const files = await readdir(path, { withFileTypes: true })
        let documents = files
          .filter(
            file =>
              file.isFile() &&
              /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/i.test(file.name),
          )
          .map(file => file.name)
          .sort()
        let readmeFallback = false
        if (!documents.length) {
          documents = files
            .filter(
              file => file.isFile() && /^readme(?:\..*)?$/i.test(file.name),
            )
            .map(file => file.name)
            .sort()
          readmeFallback = true
        }
        if (!documents.length)
          throw new Error(`Missing license documents: ${id}`)
        const repository =
          typeof pkg.repository === 'string'
            ? pkg.repository
            : pkg.repository?.url
        packages.push({
          name: pkg.name,
          version: pkg.version,
          license: entry.license,
          repository: repository || pkg.homepage || '',
          readmeFallback,
          documents: await Promise.all(
            documents.map(async name => ({
              name,
              text: await readFile(join(path, name), 'utf8'),
            })),
          ),
        })
      }
  packages.sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`),
  )
  return {
    packages,
    text:
      'MD Reader Lite - Third-party notices\n\nProduction dependency inventory; some packages may be tree-shaken. Original package license/notice documents are reproduced below. Metadata marked Unknown is not a license conclusion; consult the accompanying document. No local filesystem paths are included.\n\n' +
      packages
        .map(
          pkg =>
            `${'='.repeat(72)}\n${pkg.name}@${
              pkg.version
            }\nDeclared license metadata: ${pkg.license}\nSource: ${
              pkg.repository
            }\n${
              pkg.readmeFallback
                ? 'No separate license file in this package; original README follows.\n'
                : ''
            }\n` +
            pkg.documents
              .map(doc => `--- ${doc.name} ---\n${doc.text}`)
              .join('\n\n'),
        )
        .join('\n\n') +
      '\n',
  }
}

async function main() {
  const args = ['licenses', 'list', '--prod', '--json']
  const options = {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, COREPACK_ENABLE_AUTO_PIN: '0' },
  }
  let output
  try {
    output = execFileSync('pnpm', args, options)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    output = execFileSync('corepack', ['pnpm', ...args], options)
  }
  const result = await createNotices(JSON.parse(output))
  const extension = fileURLToPath(new URL('../extension/', import.meta.url))
  await writeFile(join(extension, 'THIRD_PARTY_NOTICES.txt'), result.text)
  await writeFile(
    join(extension, 'third-party-licenses.json'),
    JSON.stringify(
      result.packages.map(({ documents, ...pkg }) => ({
        ...pkg,
        documents: documents.map(doc => doc.name),
      })),
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Third-party notices: ${result.packages.length} package versions; ${
      result.packages.filter(pkg => pkg.readmeFallback).length
    } README fallbacks`,
  )
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
)
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
