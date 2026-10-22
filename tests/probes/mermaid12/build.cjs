const { resolve } = require('node:path')
const {
  mkdir,
  copyFile,
  stat,
  writeFile,
  rm,
  readdir,
} = require('node:fs/promises')
const assert = require('node:assert/strict')
const webpack = require('webpack')
const { fingerprint } = require('./evidence.cjs')

const output = resolve(__dirname, '../../../dist/probes/mermaid12/extension')

async function build() {
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  const stats = await new Promise((accept, reject) => {
    webpack(
      ['content', 'frame'].map(name => ({
        mode: 'production',
        entry: resolve(__dirname, `${name}.js`),
        output: { path: output, filename: `js/${name}.js`, publicPath: './' },
        optimization: { minimize: false },
        plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
        performance: false,
        stats: 'errors-warnings',
      })),
      (error, result) => {
        if (error) reject(error)
        else if (result.hasErrors()) reject(new Error(result.toString()))
        else accept(result)
      },
    )
  })
  assert.deepEqual((await readdir(resolve(output, 'js'))).sort(), [
    'content.js',
    'frame.js',
  ])
  for (const file of ['manifest.json', 'background.js', 'frame.html'])
    await copyFile(resolve(__dirname, file), resolve(output, file))
  const bytes = (await stat(resolve(output, 'js/content.js'))).size
  await writeFile(
    resolve(output, '../build.json'),
    JSON.stringify(
      {
        bytes,
        node: process.version,
        webpack: webpack.version,
        ...(await fingerprint(output)),
        warnings: stats
          .toJson({ all: false, warnings: true })
          .children.flatMap(child => child.warnings),
      },
      null,
      2,
    ),
  )
  console.log(`MV3 content-script bundle: ${bytes} bytes at ${output}`)
}

build().catch(error => {
  console.error(error)
  process.exitCode = 1
})
