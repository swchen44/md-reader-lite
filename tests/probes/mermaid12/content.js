import mermaid from 'mermaid'
import zenuml from '@mermaid-js/mermaid-zenuml'
import { connectFrame } from './frame-transport'
import { injectFault } from './fault-injection'

const payload = document.getElementById('md-reader-probe-input')
const input =
  payload?.textContent ||
  (location.protocol === 'file:' ? document.body.textContent : null)
if (input) {
  void run(JSON.parse(input)).catch(error => {
    document.documentElement.dataset.probeFatal = String(error)
    document.documentElement.dataset.probeDone = '1'
  })
}

async function run({
  cases,
  zen = false,
  config = {},
  transport = false,
  policy = 'raw',
}) {
  if (transport) {
    document.body.replaceChildren()
    const connection = await connectFrame()
    connection.dispose()
    document.documentElement.dataset.probeTransport = 'ready'
    document.documentElement.dataset.probeDone = '1'
    return
  }
  if (zen) await mermaid.registerExternalDiagrams([zenuml])
  document.body.replaceChildren()
  const main = document.createElement('main')
  main.id = 'probe-results'
  document.body.append(main)
  const confined = policy === 'confined' ? await connectFrame() : null
  for (const [i, item] of cases.entries()) {
    const section = document.createElement('section')
    section.className = 'probe-diagram'
    section.dataset.name = item.name
    const heading = document.createElement('h2')
    heading.textContent = item.name
    const source = document.createElement('pre')
    source.textContent = item.source
    section.append(heading, source)
    main.append(section)
    const scratch = document.createElement('div')
    scratch.dataset.probeScratch = '1'
    document.body.append(scratch)
    const id = `probe-${i}`
    let restoreFault = () => {}
    const start = performance.now()
    try {
      if (confined) {
        const result = await confined.render({
          source: item.source,
          config,
          zen,
          failAt: item.failAt,
        })
        section.dataset.status = result.status
        if (result.syntax) section.dataset.syntax = result.syntax
        section.dataset.violations = JSON.stringify(result.violations || [])
        section.dataset.frameResiduals = String(result.residuals || 0)
        section.dataset.securityLevel = result.securityLevel
        if (result.status !== 'ready') {
          section.dataset.error = result.error
          continue
        }
        const diagram = document.createElement('div')
        diagram.className = 'probe-output'
        diagram.innerHTML = result.svg
        source.replaceWith(diagram)
        continue
      }
      mermaid.initialize({
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
        ...config,
      })
      await mermaid.parse(item.source)
      section.dataset.syntax = 'valid'
      restoreFault = injectFault(item.failAt, id)
      const result = await mermaid.render(id, item.source, scratch)
      const diagram = document.createElement('div')
      diagram.className = 'probe-output'
      diagram.innerHTML = result.svg
      source.replaceWith(diagram)
      section.dataset.status = 'ready'
    } catch (error) {
      section.dataset.status = 'error'
      section.dataset.error =
        error instanceof Error ? error.message : String(error)
    } finally {
      restoreFault()
      scratch.remove()
      section.dataset.duration = String(performance.now() - start)
      if (!confined)
        section.dataset.securityLevel =
          mermaid.mermaidAPI.getConfig().securityLevel
    }
  }
  confined?.dispose()
  document.documentElement.dataset.probeDone = '1'
}
