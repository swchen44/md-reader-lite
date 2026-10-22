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
    const scratch = document.createElement('div')
    scratch.dataset.probeScratch = '1'
    document.body.append(scratch)
    const id = `probe-${i}`
    let restoreFault = () => {}
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
      section.dataset.securityLevel =
        mermaid.mermaidAPI.getConfig().securityLevel
    }
  }
  document.documentElement.dataset.probeDone = '1'
}

function injectFault(stage, id) {
  if (stage === 'stylesheet') {
    const original = CSSStyleSheet.prototype.insertRule
    CSSStyleSheet.prototype.insertRule = () => {
      throw new Error('probe: injected stylesheet failure')
    }
    return () => {
      CSSStyleSheet.prototype.insertRule = original
    }
  }
  if (stage === 'serialization') {
    const original = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'innerHTML',
    )
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...original,
      get() {
        if (this.id === `d${id}`)
          throw new Error('probe: injected serialization failure')
        return original.get.call(this)
      },
    })
    return () => {
      Object.defineProperty(Element.prototype, 'innerHTML', original)
    }
  }
  return () => {}
}
