import mermaid from 'mermaid'
import zenuml from '@mermaid-js/mermaid-zenuml'
import { startRenderer } from './frame-runtime'
import { validateZenUML } from './zenuml'

startRenderer(mermaid, {
  registerZen: () => mermaid.registerExternalDiagrams([zenuml]),
  validateDiagram: async (job, parsed) => {
    if (parsed.diagramType !== 'zenuml') return
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(job.source)
    await validateZenUML(diagram.text)
  },
})
