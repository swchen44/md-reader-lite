import storage from '@/core/storage'
import commands from '@/core/commands'
import { canBgFetch } from '@/core/charset'

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
    case 'openOptions':
      chrome.runtime.openOptionsPage()
      callback?.()
      break
    case 'bgFetch': {
      const allowed = canBgFetch(
        sender.url,
        data?.url,
        chrome.runtime.id,
        sender.id,
      )
      if (!allowed) {
        callback?.({ ok: false })
        break
      }
      try {
        const r = await fetch(data.url)
        if (!r.ok) {
          callback?.({ ok: false })
          break
        }
        const buf = await r.arrayBuffer()
        const text = new TextDecoder('utf-8').decode(buf)
        callback?.({ ok: true, text })
      } catch {
        callback?.({ ok: false })
      }
      break
    }
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
  language: 'reload',
  refreshInterval: 'applySetting',
  codeWrap: 'applySetting',
  codeBlockDayTheme: 'applySetting',
  codeBlockNightTheme: 'applySetting',
  textSize: 'applySetting',
  textFont: 'applySetting',
  customWidth: 'applySetting',
  customCss: 'applySetting',
  breaks: 'applySetting',
  txtAsMd: 'applySetting',
  outlineCollapse: 'applySetting',
  mdPluginOptions: 'applySetting',
  customWidthUnit: 'applySetting',
  charsetCompat: 'applySetting',
  offlineMode: 'applySetting',
  plantumlEnabled: 'applySetting',
  plantumlServer: 'applySetting',
  sideWidth: 'applySetting',
}

function updatePage(key: keyof typeof actionMap, value?: any) {
  const action = actionMap[key]
  action &&
    chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
      tabs.length &&
        chrome.tabs.sendMessage(tabs[0].id, { action, data: { key, value } })
    })
}
