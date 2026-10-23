import mermaid from 'mermaid'
import zenuml from '@mermaid-js/mermaid-zenuml'
import { startRenderer } from './frame-runtime'
import { validateZenUML } from './zenuml'
import {
  resolveMermaidDiagramOptions,
  ANTHROPIC_SERIES,
} from '../mermaid-style.ts'

startRenderer(mermaid, {
  registerZen: () => mermaid.registerExternalDiagrams([zenuml]),
  resolveConfig: async (job, parsed) => {
    const options = resolveMermaidDiagramOptions(
      { style: job.style },
      job.theme === 'dark' ? 'dark' : 'light',
      parsed,
    )
    if (parsed.diagramType === 'sankey' && options.themeVariables) {
      const diagram = await mermaid.mermaidAPI.getDiagramFromText(job.source)
      if (typeof diagram.db.getNodes !== 'function')
        throw new Error('Sankey metadata API changed')
      const nodes = diagram.db.getNodes()
      if (
        !Array.isArray(nodes) ||
        nodes.some(node => typeof node.ID !== 'string')
      )
        throw new Error('Sankey metadata API changed')
      options.sankey = {
        nodeColors: Object.fromEntries(
          nodes.map((node, index) => [
            node.ID,
            ANTHROPIC_SERIES[index % ANTHROPIC_SERIES.length],
          ]),
        ),
      }
    }
    return options
  },
  validateDiagram: async (job, parsed) => {
    if (parsed.diagramType !== 'zenuml') return
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(job.source)
    await validateZenUML(diagram.text)
  },
})
