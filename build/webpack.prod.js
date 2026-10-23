const { merge } = require('webpack-merge')
const commentConfig = require('./webpack.common.js')
const { ESBuildMinifyPlugin } = require('esbuild-loader')

const production = {
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [
      new ESBuildMinifyPlugin({
        target: 'chrome80',
        css: true,
      }),
    ],
  },
}
module.exports = [
  merge(commentConfig, production),
  merge(require('./webpack.mermaid')('production'), production),
]
