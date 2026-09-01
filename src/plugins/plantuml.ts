import type MarkdownIt from 'markdown-it'
import encoder from 'plantuml-encoder'
import { buildPlantumlImageUrl } from '@/core/plantuml'
import className from '@/config/class-name'

const PLANTUML_INFO_TOKEN = 'plantuml'

function escapeHtml(content: string): string {
  return String(content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function PlantumlPlugin(
  md: MarkdownIt,
  opts?: { server?: string; allowed?: boolean },
) {
  const fallbackFence = md.renderer.rules.fence?.bind(md.renderer.rules)

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    const info = token.info.trim().toLowerCase()
    const code = token.content.trim()

    if (info === PLANTUML_INFO_TOKEN) {
      if (opts?.allowed) {
        const encoded = encoder.encode(code)
        const src = buildPlantumlImageUrl(opts.server ?? '', encoded)
        return `<img class="${className.PLANTUML}" src="${src}" alt="PlantUML diagram" loading="lazy">`
      }
      return `<div class="${
        className.PLANTUML_DISABLED
      }">PlantUML disabled</div><pre>${escapeHtml(code)}</pre>`
    }

    if (fallbackFence) {
      return fallbackFence(tokens, idx, options, env, self)
    }

    return self.renderToken(tokens, idx, options)
  }
}
