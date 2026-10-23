import { createMermaidQueue } from '@/core/mermaid-renderer'
import { connectFrame } from '@/core/mermaid/frame-transport'
import {
  hasMermaidThemeDirective,
  resolveMermaidRenderOptions,
  resolveMermaidStyle,
} from '@/core/mermaid-style'
import i18n from '@/config/i18n'

export default function MermaidRendererPlugin({ event, language }) {
  const localize = i18n(language)
  let connection: ReturnType<typeof connectFrame> | null = null
  let serial = 0
  let generation = 0
  const generations = new WeakMap<HTMLElement, number>()
  const queue = createMermaidQueue(async job => {
    if (!connection) connection = connectFrame()
    let renderer: Awaited<ReturnType<typeof connectFrame>>
    let reply
    try {
      renderer = await connection
      if (!job.isCurrent()) return ''
      reply = await renderer.render({
        source: job.source,
        renderId: job.id,
        zen: true,
        config: resolveMermaidRenderOptions(
          hasMermaidThemeDirective(job.source)
            ? undefined
            : { style: job.style },
          job.theme,
        ),
      })
    } catch (error) {
      connection?.then(
        frame => frame.dispose(),
        () => {},
      )
      connection = null
      throw error
    }
    if (reply.status !== 'ready')
      throw new Error(reply.error || 'Mermaid rendering failed')
    return reply.svg
  })
  window.addEventListener('pagehide', () => {
    connection?.then(
      frame => frame.dispose(),
      () => {},
    )
    connection = null
  })
  event.on('contentRendered', (container: HTMLElement) => {
    const current = ++generation
    generations.set(container, current)
    container.dataset.mermaidGeneration = String(current)
    delete container.dataset.mermaidComplete
    const elements = Array.from(
      container.querySelectorAll<HTMLElement>(
        'pre.mermaid[data-mermaid-status="pending"]',
      ),
    )
    // Initial contentRendered happens before mount; defer until main has appended the article.
    queueMicrotask(async () => {
      const tasks = elements.map(async element => {
        const code = element.querySelector('code')
        if (!code) return
        const isCurrent = () =>
          container.isConnected &&
          element.isConnected &&
          generations.get(container) === current
        if (!isCurrent()) return
        element.dataset.mermaidStatus = 'rendering'
        element.setAttribute('aria-busy', 'true')
        element.setAttribute('aria-label', localize('mermaid_render_pending'))
        const result = await queue.run({
          id: `md-reader-mermaid-${++serial}`,
          source: code.textContent || '',
          style: resolveMermaidStyle(element.dataset.mermaidStyle),
          theme: element.dataset.mermaidTheme === 'dark' ? 'dark' : 'light',
          isCurrent,
        })
        if (!isCurrent() || result.status === 'stale') return
        element.removeAttribute('aria-busy')
        element.removeAttribute('aria-label')
        element.dataset.mermaidStatus = result.status
        if (result.status === 'ready') element.innerHTML = result.svg
        else {
          const error = document.createElement('div')
          error.className = 'md-reader__mermaid-error'
          error.textContent = localize('mermaid_render_error')
          error.title = result.error
          element.append(error)
        }
      })
      await Promise.all(tasks)
      if (container.isConnected && generations.get(container) === current) {
        container.dataset.mermaidComplete = String(current)
        event.emit('diagramsRendered', { container, generation: current })
      }
    })
  })
}
