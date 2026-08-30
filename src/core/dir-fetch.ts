import { parseDirListing, type DirEntry } from '@/core/dir-listing'

export type { DirEntry } from '@/core/dir-listing'

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
 * 抓取並解析目錄清單。content script 在頁面 origin 內直接同源 fetch 即可，
 * 不需要任何 host 權限；file:// 則維持走 XHR（需「允許存取檔案網址」權限）。
 */
export async function fetchDirListing(dirUrl: string): Promise<DirEntry[]> {
  if (dirUrl.startsWith('file:')) {
    const html = await xhrGet(dirUrl)
    return parseDirListing(html, dirUrl)
  }
  const res = await fetch(dirUrl, {
    signal: (AbortSignal as any).timeout(5000),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const html = await res.text()
  return parseDirListing(html, dirUrl)
}
