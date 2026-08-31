import imageViewerPlugin from './img-viewer'
import blockCopyPlugin from './block-copy'
import graphvizRendererPlugin from './graphviz-renderer'
import diagramViewerPlugin from './diagram-viewer'
import { usePlugin } from '@/core/plugin'
export { initPlugins } from '@/core/plugin'

usePlugin([
  blockCopyPlugin,
  imageViewerPlugin,
  graphvizRendererPlugin,
  diagramViewerPlugin,
])
