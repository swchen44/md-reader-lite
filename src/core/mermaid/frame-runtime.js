import { sanitizeSVG } from './svg-policy'
import {
  checkMarkup,
  checkConfig,
  checkDiagram,
} from './resource-preflight.mjs'
export function startRenderer(
  mermaid,
  { registerZen = async () => {}, injectFault = () => () => {} } = {},
) {
  let connected = false
  let registeredZen = false
  let queue = Promise.resolve()

  window.addEventListener('message', event => {
    if (connected) return
    if (
      event.source !== parent ||
      event.data?.type !== 'md-reader:mermaid-connect'
    )
      return
    const port = event.ports[0]
    if (!port) return
    connected = true
    port.onmessage = message => {
      const { id, job } = message.data || {}
      if (!Number.isSafeInteger(id) || !job) return
      queue = queue
        .then(async () => {
          const result = await render(job, id)
          port.postMessage({ type: 'result', id, ...result })
        })
        .catch(error => {
          port.postMessage({
            type: 'result',
            id,
            status: 'error',
            error: String(error),
          })
        })
    }
    port.start()
    port.postMessage({ type: 'ready' })
  })

  async function render(job, id) {
    const scratch = document.createElement('div')
    document.body.append(scratch)
    const violations = []
    const onViolation = event => {
      if (violations.length < 32)
        violations.push({
          directive: event.effectiveDirective,
          uri: event.blockedURI,
        })
    }
    document.addEventListener('securitypolicyviolation', onViolation)
    const result = { status: 'error', violations, securityLevel: 'strict' }
    let restoreFault = () => {}
    try {
      if (typeof job.source !== 'string' || job.source.length > 50000)
        throw new Error('Blocked resource policy: source exceeds limit')
      checkMarkup(job.source)
      checkConfig(job.config)
      if (job.zen && !registeredZen) {
        await registerZen()
        registeredZen = true
      }
      mermaid.initialize({
        ...job.config,
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        maxTextSize: 50000,
        maxEdges: 500,
        secure: [
          'secure',
          'securityLevel',
          'startOnLoad',
          'suppressErrorRendering',
          'maxTextSize',
          'maxEdges',
        ],
      })
      const parsed = await mermaid.parse(job.source)
      result.syntax = 'valid'
      checkConfig(parsed.config)
      if (parsed.diagramType.startsWith('flowchart')) {
        const diagram = await mermaid.mermaidAPI.getDiagramFromText(job.source)
        if (typeof diagram.db.getVertices !== 'function')
          throw new Error(
            'Blocked resource policy: flowchart metadata API changed',
          )
        checkDiagram(diagram)
      }
      const renderId = /^md-reader-mermaid-\d+$/.test(job.renderId)
        ? job.renderId
        : `confined-${id}`
      restoreFault = injectFault(job.failAt, renderId)
      const rendered = await mermaid.render(renderId, job.source, scratch)
      result.svg = sanitizeSVG(rendered.svg)
      result.status = 'ready'
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      if (error?.source)
        result.error += ` near ${error.source.slice(
          Math.max(0, error.offset - 40),
          error.offset + 80,
        )}`
      if (result.error.startsWith('Blocked resource policy:'))
        result.status = 'blocked'
    } finally {
      restoreFault()
      scratch.remove()
      result.residuals = document.body.childElementCount
      await new Promise(resolve => setTimeout(resolve, 0))
      document.removeEventListener('securitypolicyviolation', onViolation)
      result.securityLevel = mermaid.mermaidAPI.getConfig().securityLevel
      if (violations.length) {
        result.status = 'blocked'
        result.error =
          'Blocked resource policy: renderer CSP blocked a resource'
        delete result.svg
      }
    }
    return result
  }
}
