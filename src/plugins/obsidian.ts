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

export default function ObsidianPlugin(md: MarkdownIt): void {
  md.core.ruler.after('normalize', 'obsidian_comments', stripComments)
  md.inline.ruler.before('link', 'obsidian_wikilink', wikilink)
}
