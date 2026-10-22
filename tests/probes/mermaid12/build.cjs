const { resolve } = require('node:path')
const { mkdir, copyFile, stat, writeFile } = require('node:fs/promises')
const webpack = require('webpack')

const output = resolve(__dirname, '../../../dist/probes/mermaid12/extension')

async function build() {
  await mkdir(output, { recursive: true })
  const stats = await new Promise((accept, reject) => {
    webpack(
      {
        mode: 'production',
        entry: resolve(__dirname, 'content.js'),
        output: { path: output, filename: 'js/content.js', publicPath: './' },
        optimization: { minimize: false },
        plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
        performance: false,
        stats: 'errors-warnings',
      },
      (error, result) => {
        if (error) reject(error)
        else if (result.hasErrors()) reject(new Error(result.toString()))
        else accept(result)
      },
    )
  })
  for (const file of ['manifest.json', 'background.js'])
    await copyFile(resolve(__dirname, file), resolve(output, file))
  const bytes = (await stat(resolve(output, 'js/content.js'))).size
  await writeFile(
    resolve(output, '../build.json'),
    JSON.stringify(
      {
        bytes,
        webpack: webpack.version,
        warnings: stats.toJson({ all: false, warnings: true }).warnings,
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
