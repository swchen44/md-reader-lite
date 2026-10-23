const { resolve } = require('path')
const { optimize } = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = mode => ({
  name: 'mermaid-renderer',
  dependencies: ['application'],
  mode,
  entry: resolve(__dirname, '../src/core/mermaid/frame.js'),
  output: {
    filename: 'js/mermaid-frame.js',
    path: resolve(__dirname, '../extension'),
    publicPath: './',
  },
  resolve: { extensions: ['.js', '.mjs', '.ts', '.json'] },
  optimization: { minimize: false },
  plugins: [
    new optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: resolve(__dirname, '../src/core/mermaid/frame.html'),
          to: 'mermaid-frame.html',
        },
      ],
    }),
  ],
  performance: false,
})
