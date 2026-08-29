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

const BLOCKQUOTE_MARKER_RE = /^\s{0,3}>\s?/
const FENCE_OPEN_RE = /^(\s{0,3})(`{3,}|~{3,})(.*)$/
const FENCE_CLOSE_RE = /^(\s{0,3})(`{3,}|~{3,})\s*$/

type FenceState = { char: string; len: number; quoteDepth: number } | null

/** 剝除行首的 blockquote 標記（可重複巢狀），回傳深度與剩餘內容 */
function stripBlockquoteMarkers(line: string): {
  quoteDepth: number
  remainder: string
} {
  let quoteDepth = 0
  let remainder = line
  let m: RegExpMatchArray | null
  while ((m = remainder.match(BLOCKQUOTE_MARKER_RE))) {
    quoteDepth++
    remainder = remainder.slice(m[0].length)
  }
  return { quoteDepth, remainder }
}

/**
 * 逐行掃描的 fence 追蹤器，由 stripComments 與 normalizeCallouts 共用，
 * 確保兩者對「什麼算在 fence 內」的判斷完全一致（例如 Mermaid 圖表內自己的
 * %% 註解語法、callout 語法都不應被 fence 外的規則處理到）。
 *
 * This is a line-based tracker, not a full CommonMark parser. It tracks the
 * opening fence's character (` or ~), marker length, and blockquote depth so
 * it can tell a genuine fence from:
 *   - a same-line pseudo-fence like ```js``` (backtick info strings may not
 *     contain a backtick, so this never opens a fence at all);
 *   - a shorter marker nested inside a longer fence (a closer must match the
 *     opener's character and be at least as long);
 *   - a fence hidden behind blockquote markers (`> ` `` ` ``).
 * Indented (4-space) code blocks and fences nested inside list items are
 * NOT fence-tracked — that residual is an accepted, deliberate scope bound
 * for this preprocessor, not a bug.
 */
function makeFenceTracker() {
  let fence: FenceState = null
  return {
    inFence: () => fence !== null,
    /** 嘗試以本行（已去除 blockquote 標記）關閉目前的 fence；回傳是否關閉 */
    tryClose(remainder: string, quoteDepth: number): boolean {
      if (!fence) return false
      const close = remainder.match(FENCE_CLOSE_RE)
      if (
        close &&
        close[2][0] === fence.char &&
        close[2].length >= fence.len &&
        // Closer must sit at the same blockquote depth as the opener.
        // Using strict equality (rather than "same-or-shallower") is a
        // documented residual: deeper-nesting mismatches are not
        // precisely tracked by this line-based scanner.
        quoteDepth === fence.quoteDepth
      ) {
        fence = null
        return true
      }
      return false
    },
    /** 嘗試以本行開啟新的 fence；回傳是否開啟 */
    tryOpen(remainder: string, quoteDepth: number): boolean {
      const open = remainder.match(FENCE_OPEN_RE)
      if (!open) return false
      const marker = open[2]
      const info = open[3]
      const isBacktickFence = marker[0] === '`'
      // CommonMark: a backtick fence's info string may not itself contain
      // a backtick (e.g. ```js``` is not a fence opener at all).
      if (isBacktickFence && info.includes('`')) return false
      fence = { char: marker[0], len: marker.length, quoteDepth }
      return true
    },
  }
}

const INLINE_CODE_SPLIT_RE = /(`[^`\n]*`)/

/**
 * 在一段文字中移除 %% 註解，但保留 inline code span（單一反引號）內的內容。
 * 做法：以反引號分隔的片段切開整段文字，只在非 code 片段裡尋找 %%。
 * 回傳處理後的文字，以及是否留下一個尚未關閉的多行註解（inComment）。
 */
function stripCommentSpans(text: string): {
  output: string
  inComment: boolean
} {
  let output = ''
  let inComment = false
  for (const seg of text.split(INLINE_CODE_SPLIT_RE)) {
    if (inComment) {
      const close = seg.indexOf('%%')
      if (close === -1) continue // 整段仍在註解內，捨棄
      const rest = stripCommentSpans(seg.slice(close + 2))
      output += rest.output
      inComment = rest.inComment
      continue
    }
    const isInlineCode = seg.length >= 2 && seg[0] === '`' && seg.endsWith('`')
    if (isInlineCode) {
      output += seg
      continue
    }
    let rest = seg
    for (;;) {
      const start = rest.indexOf('%%')
      if (start === -1) {
        output += rest
        break
      }
      const end = rest.indexOf('%%', start + 2)
      if (end === -1) {
        output += rest.slice(0, start)
        inComment = true
        break
      }
      output += rest.slice(0, start)
      rest = rest.slice(end + 2)
    }
  }
  return { output, inComment }
}

/**
 * 移除 %%...%% 註解（在 normalize 之後、block 解析之前）。
 * 與 normalizeCallouts 共用同一套 fence 追蹤器：fenced code block 內容
 * （例如 Mermaid 自己的 %% 註解語法）完全不處理；fence 外則額外跳過
 * inline code span 內的 %%，並以 inComment 狀態追蹤跨行的多行註解。
 */
function stripComments(state: StateCore): void {
  const tracker = makeFenceTracker()
  let inComment = false
  state.src = state.src
    .split('\n')
    .map(line => {
      const { quoteDepth, remainder } = stripBlockquoteMarkers(line)

      if (tracker.inFence()) {
        tracker.tryClose(remainder, quoteDepth)
        return line
      }

      if (inComment) {
        const close = line.indexOf('%%')
        if (close === -1) return ''
        const result = stripCommentSpans(line.slice(close + 2))
        inComment = result.inComment
        return result.output
      }

      if (tracker.tryOpen(remainder, quoteDepth)) return line

      const result = stripCommentSpans(line)
      inComment = result.inComment
      return result.output
    })
    .join('\n')
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
const CALLOUT_LINE_RE = /^((?:\s*>)+\s*)\[!(\w+)\]([+-]?)(?:[ \t]+(.+))?$/

function normalizeCalloutLine(line: string): string {
  const m = line.match(CALLOUT_LINE_RE)
  if (!m) return line
  const [, prefix, rawType, , title] = m
  const upper = rawType.toUpperCase()
  const mapped = GITHUB_TYPES.includes(upper)
    ? upper
    : CALLOUT_TYPE_MAP[rawType.toLowerCase()] || 'NOTE'
  const head = `${prefix}[!${mapped}]`
  return title ? `${head}\n${prefix}**${title.trim()}**` : head
}

/**
 * Obsidian callout → GitHub alert 語法（Alert 插件可接手渲染），跳過 fenced
 * code block 內容（fence 追蹤規則見 makeFenceTracker）。
 */
function normalizeCallouts(state: StateCore): void {
  const tracker = makeFenceTracker()
  state.src = state.src
    .split('\n')
    .map(line => {
      const { quoteDepth, remainder } = stripBlockquoteMarkers(line)

      if (tracker.inFence()) {
        tracker.tryClose(remainder, quoteDepth)
        return line
      }

      if (tracker.tryOpen(remainder, quoteDepth)) return line

      return normalizeCalloutLine(line)
    })
    .join('\n')
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---\r?\n/

/**
 * 文件開頭的 YAML front matter → 摺疊表格。並非以 html_block token 置頂：
 * 表格 HTML 暫存於 state.env.frontmatterHtml，實際前置輸出是靠檔案底部
 * 包裝過的 md.render（見 ObsidianPlugin 內對 md.render 的包裝）完成的。
 */
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
  if ((md as unknown as { __obsidianPlugin?: boolean }).__obsidianPlugin) return
  ;(md as unknown as { __obsidianPlugin?: boolean }).__obsidianPlugin = true

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
    delete e.frontmatterHtml
    const html = render(src, e)
    return e.frontmatterHtml ? e.frontmatterHtml + html : html
  }
}
