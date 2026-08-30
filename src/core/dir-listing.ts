export interface DirEntry {
  name: string
  isDir: boolean
  url: string
}

export const MD_EXT_RE = /\.(md|mdx|mkd|markdown)$/i

export function isMarkdownFile(name: string): boolean {
  return MD_EXT_RE.test(name)
}

const ADD_ROW_RE =
  /addRow\((".*?(?<!\\)")\s*,\s*(".*?(?<!\\)")\s*,\s*(0|1)\s*,/g
const ANCHOR_RE = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi

function parseChromeListing(html: string, baseUrl: string): DirEntry[] {
  const entries: DirEntry[] = []
  for (const match of html.matchAll(ADD_ROW_RE)) {
    let name: string
    let encoded: string
    try {
      // addRow 的參數是 JS 字串字面值，跳脫規則與 JSON 相容（\" \\ \uXXXX）
      name = JSON.parse(match[1])
      encoded = JSON.parse(match[2])
    } catch {
      continue
    }
    const isDir = match[3] === '1'
    if (name === '..' || name === '.') continue
    if (!isDir && !isMarkdownFile(name)) continue
    let u: URL
    try {
      u = new URL(encoded + (isDir ? '/' : ''), baseUrl)
    } catch {
      continue
    }
    if (!/^(https?|file):$/.test(u.protocol)) continue
    entries.push({ name, isDir, url: u.href })
  }
  return entries
}

function parseAutoindex(html: string, baseUrl: string): DirEntry[] {
  const entries: DirEntry[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(ANCHOR_RE)) {
    const href = match[1]
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    // 排序連結（apache ?C=N;O=D）、頁內錨點、上層目錄
    if (href.startsWith('?') || href.startsWith('#')) continue
    if (href === '../' || href === '..' || text === '..') continue
    if (/parent directory/i.test(text)) continue
    let url: URL
    try {
      url = new URL(href, baseUrl)
    } catch {
      continue
    }
    if (url.origin !== new URL(baseUrl).origin) continue
    // 指向自身或上層的絕對路徑（IIS 的 Parent、apache 的 "/"）
    const base = new URL(baseUrl)
    if (
      !url.pathname.startsWith(base.pathname) ||
      url.pathname === base.pathname
    ) {
      continue
    }
    const isDir = url.pathname.endsWith('/')
    const segments = url.pathname.slice(base.pathname.length).split('/')
    // 只收直接子項（有些列表會給深層連結）
    if (segments.filter(Boolean).length !== 1) continue
    const name = (
      text.replace(/\/$/, '') || decodeURIComponent(segments[0])
    ).trim()
    if (!isDir && !isMarkdownFile(name)) continue
    if (seen.has(url.href)) continue
    seen.add(url.href)
    entries.push({ name, isDir, url: url.href })
  }
  return entries
}

export function parseDirListing(html: string, baseUrl: string): DirEntry[] {
  if (/addRow\(/.test(html)) {
    return parseChromeListing(html, baseUrl)
  }
  return parseAutoindex(html, baseUrl)
}
