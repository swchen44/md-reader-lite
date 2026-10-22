import mermaid from 'mermaid'
import zenuml from '@mermaid-js/mermaid-zenuml'

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

async function run({ cases, zen = false, config = {} }) {
  if (zen) await mermaid.registerExternalDiagrams([zenuml])
  document.body.replaceChildren()
  const main = document.createElement('main')
  main.id = 'probe-results'
  document.body.append(main)
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
    const start = performance.now()
    try {
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
      const result = await mermaid.render(`probe-${i}`, item.source)
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
      section.dataset.duration = String(performance.now() - start)
      section.dataset.securityLevel =
        mermaid.mermaidAPI.getConfig().securityLevel
    }
  }
  document.documentElement.dataset.probeDone = '1'
}
