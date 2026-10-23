import mermaid from 'mermaid'
import zenuml from '@mermaid-js/mermaid-zenuml'
import { startRenderer } from '../../../src/core/mermaid/frame-runtime'
import { injectFault } from './fault-injection'

startRenderer(mermaid, {
  registerZen: () => mermaid.registerExternalDiagrams([zenuml]),
  injectFault,
})
