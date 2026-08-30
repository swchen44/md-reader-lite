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
