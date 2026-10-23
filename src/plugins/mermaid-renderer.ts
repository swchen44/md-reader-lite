import { createMermaidQueue } from '@/core/mermaid-renderer'
import { connectFrame } from '@/core/mermaid/frame-transport'
import {
  resolveMermaidRenderOptions,
  resolveMermaidStyle,
} from '@/core/mermaid-style'
import i18n from '@/config/i18n'

export default function MermaidRendererPlugin({ event, language }) {
  const localize = i18n(language)
  let connection: ReturnType<typeof connectFrame> | null = null
  let serial = 0
  let generation = 0
  let suspended = false
  let pageEpoch = 0
  const generations = new WeakMap<HTMLElement, number>()
  const containers = new Set<HTMLElement>()
  const queue = createMermaidQueue(async job => {
    if (!connection) connection = connectFrame()
    const activeConnection = connection
    let renderer: Awaited<ReturnType<typeof connectFrame>>
    let reply
    try {
      renderer = await activeConnection
      if (!job.isCurrent()) return ''
      reply = await renderer.render({
        source: job.source,
        renderId: job.id,
        zen: true,
        style: job.style,
        theme: job.theme,
        config: resolveMermaidRenderOptions({ style: job.style }, job.theme),
      })
    } catch (error) {
      activeConnection.then(
        frame => frame.dispose(),
        () => {},
      )
      if (connection === activeConnection) connection = null
      throw error
    }
    if (reply.status !== 'ready')
      throw new Error(reply.error || 'Mermaid rendering failed')
    return reply.svg
  })
  window.addEventListener('pagehide', () => {
    suspended = true
    pageEpoch++
    connection?.then(
      frame => frame.dispose(),
      () => {},
    )
    connection = null
  })
  window.addEventListener('pageshow', () => {
    if (!suspended) return
    suspended = false
    for (const container of containers) {
      if (!container.isConnected) {
        containers.delete(container)
        continue
      }
      for (const element of Array.from(
        container.querySelectorAll<HTMLElement>(
          'pre.mermaid[data-mermaid-status="rendering"],pre.mermaid[data-mermaid-status="pending"]',
        ),
      ))
        element.dataset.mermaidStatus = 'pending'
      renderContainer(container)
    }
  })
  function renderContainer(container: HTMLElement) {
    for (const known of containers)
      if (!known.isConnected) containers.delete(known)
    containers.add(container)
    const epoch = pageEpoch
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
      const isActive = () =>
        !suspended &&
        pageEpoch === epoch &&
        container.isConnected &&
        generations.get(container) === current
      const tasks = elements.map(async element => {
        const code = element.querySelector('code')
        if (!code) return
        const isCurrent = () => isActive() && element.isConnected
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
      if (isActive()) {
        container.dataset.mermaidComplete = String(current)
        event.emit('diagramsRendered', { container, generation: current })
      }
    })
  }
  event.on('contentRendered', renderContainer)
}
