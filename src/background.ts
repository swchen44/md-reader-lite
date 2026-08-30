import storage from '@/core/storage'
import commands from '@/core/commands'

chrome.runtime.onMessage.addListener(({ action, data }, sender, callback) => {
  messageHandler(action, data, sender, callback)
  return true
})

async function messageHandler(
  action: string,
  data: any,
  sender: chrome.runtime.MessageSender,
  callback?: (response?: any) => void,
) {
  switch (action) {
    case 'storage':
      await storage.set({ [data.key]: data.value })
      updatePage(data.key, data.value)
      callback?.(data)
      break
    case 'fetch':
      fetchData(sender.url).then(callback)
      break
    case 'fetchDir':
      fetchDirHtml(data.url, sender.url).then(callback)
      break
  }
}

async function fetchData(url?: string) {
  if (!url) {
    const error = new Error('Fetch error: URL is undefined.')
    console.error(error)
    return error.message
  }

  return fetch(url)
    .then(res => res.text())
    .catch(err => {
      console.error(err)
      return err.message
    })
}

const FETCH_DIR_TIMEOUT = 5000

/**
 * fetchDir 只允許抓取與請求頁面同一個目錄樹的資源，避免任意頁面的 content
 * script 透過 background 的 host_permissions 繞過 CORS 抓取任意網址。
 * 最小判斷：http(s) 需 origin 相同；file: 僅在請求頁面本身也是 file: 時允許。
 */
function isSameDirTree(url: string, senderUrl?: string): boolean {
  if (!senderUrl) return false
  try {
    const target = new URL(url)
    const sender = new URL(senderUrl)
    if (target.protocol === 'file:') {
      return sender.protocol === 'file:'
    }
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      return target.origin === sender.origin
    }
    return false
  } catch {
    return false
  }
}

async function fetchDirHtml(url?: string, senderUrl?: string) {
  if (!url) {
    return { error: 'Fetch error: URL is undefined.' }
  }
  if (!isSameDirTree(url, senderUrl)) {
    return { error: 'forbidden' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_DIR_TIMEOUT)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return { error: `HTTP ${res.status}` }
    }
    return { html: await res.text() }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    clearTimeout(timer)
  }
}

// Chrome extension shortcuts
chrome.commands.onCommand.addListener(action => {
  commands[action]?.(messageHandler)
})

const actionMap = {
  enable: 'reload',
  refresh: 'toggleRefresh',
  centered: 'toggleCentered',
  mdPlugins: 'updateMdPlugins',
  pageTheme: 'updatePageTheme',
  hiddenSide: 'toggleSide',
  folderTree: 'toggleFolderTree',
}

function updatePage(key: keyof typeof actionMap, value?: any) {
  const action = actionMap[key]
  action &&
    chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
      tabs.length &&
        chrome.tabs.sendMessage(tabs[0].id, { action, data: { key, value } })
    })
}
