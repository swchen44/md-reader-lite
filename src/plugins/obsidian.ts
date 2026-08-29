import type MarkdownIt from 'markdown-it'
import type StateInline from 'markdown-it/lib/rules_inline/state_inline'
import type StateCore from 'markdown-it/lib/rules_core/state_core'

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|svg|webp|bmp)$/i
const HAS_EXT_RE = /\.[a-z0-9]+$/i

function encodePath(target: string): string {
  // 保留 / 作路徑分隔，其餘（含空格）編碼
  return target.split('/').map(encodeURIComponent).join('/')
}

/** [[target|alias]] 與 ![[target|size]] 的 inline rule */
function wikilink(state: StateInline, silent: boolean): boolean {
  const src = state.src
  let pos = state.pos
  const isEmbed = src.charCodeAt(pos) === 0x21 /* ! */
  const start = isEmbed ? pos + 1 : pos
  if (src.slice(start, start + 2) !== '[[') return false
  const end = src.indexOf(']]', start + 2)
  if (end === -1) return false
  const inner = src.slice(start + 2, end)
  if (!inner || inner.includes('[[') || inner.includes('\n')) return false

  if (!silent) {
    const [target, extra] = splitOnce(inner, '|')
    if (isEmbed && IMAGE_EXT_RE.test(target)) {
      const token = state.push('image', 'img', 0)
      token.attrs = [['src', encodePath(target)]]
      if (extra && /^\d+$/.test(extra)) token.attrs.push(['width', extra])
      token.attrs.push(['alt', target])
      token.children = []
    } else {
      const href = HAS_EXT_RE.test(target) ? target : `${target}.md`
      const open = state.push('link_open', 'a', 1)
      open.attrs = [['href', encodePath(href)]]
      if (isEmbed) open.attrs.push(['class', 'md-reader__embed-link'])
      const text = state.push('text', '', 0)
      text.content = extra || target
      state.push('link_close', 'a', -1)
    }
  }
  state.pos = end + 2
  return true
}

function splitOnce(value: string, sep: string): [string, string | null] {
  const idx = value.indexOf(sep)
  return idx === -1
    ? [value.trim(), null]
    : [value.slice(0, idx).trim(), value.slice(idx + 1).trim()]
}

/** 移除 %%...%% 註解（在 normalize 之後、block 解析之前） */
function stripComments(state: StateCore): void {
  state.src = state.src.replace(/%%[\s\S]*?%%/g, '')
}

const CALLOUT_TYPE_MAP: Record<string, string> = {
  note: 'NOTE',
  info: 'NOTE',
  todo: 'NOTE',
  abstract: 'NOTE',
  summary: 'NOTE',
  tldr: 'NOTE',
  question: 'NOTE',
  help: 'NOTE',
  faq: 'NOTE',
  quote: 'NOTE',
  cite: 'NOTE',
  example: 'NOTE',
  tip: 'TIP',
  hint: 'TIP',
  success: 'TIP',
  check: 'TIP',
  done: 'TIP',
  important: 'IMPORTANT',
  warning: 'WARNING',
  caution: 'WARNING',
  attention: 'WARNING',
  danger: 'CAUTION',
  error: 'CAUTION',
  bug: 'CAUTION',
  failure: 'CAUTION',
  fail: 'CAUTION',
  missing: 'CAUTION',
}
const GITHUB_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
const CALLOUT_LINE_RE = /^(\s*>\s*)\[!(\w+)\]([+-]?)(?:[ \t]+(.+))?$/gm

/** Obsidian callout → GitHub alert 語法（Alert 插件可接手渲染） */
function normalizeCallouts(state: StateCore): void {
  state.src = state.src.replace(
    CALLOUT_LINE_RE,
    (_, prefix, rawType, _fold, title) => {
      const upper = rawType.toUpperCase()
      const mapped = GITHUB_TYPES.includes(upper)
        ? upper
        : CALLOUT_TYPE_MAP[rawType.toLowerCase()] || 'NOTE'
      const head = `${prefix}[!${mapped}]`
      return title ? `${head}\n${prefix}**${title.trim()}**` : head
    },
  )
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---\r?\n/

/** 文件開頭的 YAML front matter → 摺疊表格（html_block token 置頂） */
function renderFrontmatter(md: MarkdownIt, state: StateCore): void {
  const match = state.src.match(FRONTMATTER_RE)
  if (!match) return
  state.src = state.src.slice(match[0].length)
  const esc = md.utils.escapeHtml
  const rows = match[1]
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => {
      const idx = line.indexOf(':')
      const key = idx === -1 ? '' : line.slice(0, idx).trim()
      const value = idx === -1 ? line.trim() : line.slice(idx + 1).trim()
      return `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`
    })
    .join('')
  state.env.frontmatterHtml =
    `<details class="md-reader__frontmatter"><summary>Metadata</summary>` +
    `<table><tbody>${rows}</tbody></table></details>\n`
}

export default function ObsidianPlugin(md: MarkdownIt): void {
  md.core.ruler.after('normalize', 'obsidian_comments', stripComments)
  md.core.ruler.after(
    'obsidian_comments',
    'obsidian_callouts',
    normalizeCallouts,
  )
  md.core.ruler.after('obsidian_callouts', 'obsidian_frontmatter', s =>
    renderFrontmatter(md, s),
  )
  md.inline.ruler.before('link', 'obsidian_wikilink', wikilink)

  const render = md.render.bind(md)
  md.render = (src, env) => {
    const e = env || {}
    const html = render(src, e)
    return e.frontmatterHtml ? e.frontmatterHtml + html : html
  }
}
