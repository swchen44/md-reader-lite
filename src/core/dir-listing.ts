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

/**
 * 以 XMLHttpRequest 讀取 file:// URL。MV3 service worker 的 fetch() 會直接拒絕
 * file: URL，且從 file:// 頁面的 content script 呼叫 fetch() 也會失敗
 * （"Failed to fetch"）。已授予「允許存取檔案網址」權限時，content script
 * isolated world 的 XHR 仍可讀取 file:// URL，因此改走 XHR。部分 Chrome
 * 版本對 file:// 成功回應會回報 status 0，故一併視為成功。
 */
function xhrGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest()
    req.open('GET', url)
    req.onload = () => {
      if (req.status === 200 || (req.status === 0 && req.responseText)) {
        resolve(req.responseText)
      } else {
        reject(new Error(`XHR ${req.status}`))
      }
    }
    req.onerror = () => reject(new Error('XHR network error'))
    req.send()
  })
}

/**
 * 抓取並解析目錄清單。優先走 background（有 host_permissions），
 * 失敗且為 file:// 時退回 content script 直接 XHR（需「允許存取檔案網址」權限）。
 */
export function fetchDirListing(dirUrl: string): Promise<DirEntry[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'fetchDir', data: { url: dirUrl } },
      async (res: { html?: string; error?: string } | undefined) => {
        // 讀取 lastError 以避免瀏覽器主控台出現
        // "Unchecked runtime.lastError" 雜訊；沒有 fallback 可用時併入錯誤訊息。
        const lastError = chrome.runtime.lastError
        if (res?.html) {
          resolve(parseDirListing(res.html, dirUrl))
          return
        }
        if (dirUrl.startsWith('file:')) {
          try {
            const html = await xhrGet(dirUrl)
            resolve(parseDirListing(html, dirUrl))
            return
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)))
            return
          }
        }
        reject(new Error(res?.error || lastError?.message || 'fetchDir failed'))
      },
    )
  })
}
