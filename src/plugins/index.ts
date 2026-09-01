import imageViewerPlugin from './img-viewer'
import blockCopyPlugin from './block-copy'
import graphvizRendererPlugin from './graphviz-renderer'
import diagramViewerPlugin from './diagram-viewer'
import remoteGuardPlugin from './remote-guard'
import { usePlugin } from '@/core/plugin'
export { initPlugins } from '@/core/plugin'

usePlugin([
  blockCopyPlugin,
  imageViewerPlugin,
  graphvizRendererPlugin,
  diagramViewerPlugin,
  // 放最後：確保 contentRendered 觸發時，其餘渲染插件（圖表等）已完成 DOM
  // 佈置，remote-guard 才能掃到完整的最終 DOM 樹。
  remoteGuardPlugin,
])
