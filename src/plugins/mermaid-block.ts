import type MarkdownIt from 'markdown-it'
import { escapeHtml } from 'markdown-it/lib/common/utils.js'
import { resolveMermaidStyle } from '#core/mermaid-style'

export default function MermaidBlock(
  md: MarkdownIt,
  options: { style?: unknown; theme?: unknown } = {},
) {
  const fallback = md.renderer.rules.fence!
  const style = resolveMermaidStyle(options.style)
  const theme = options.theme === 'dark' ? 'dark' : 'light'
  md.renderer.rules.fence = (...args) => {
    const token = args[0][args[1]]
    if (token.info.trim() !== 'mermaid') return fallback(...args)
    return `<pre class="mermaid" data-mermaid-style="${style}" data-mermaid-theme="${theme}" data-mermaid-status="pending"><code>${escapeHtml(
      token.content,
    )}</code></pre>`
  }
}
