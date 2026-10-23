import storage from '@/core/storage'
import commands from '@/core/commands'
import { canBgFetch } from '@/core/charset'

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const { customCssDefaultPreset } = await storage.get('customCssDefaultPreset')
  if (customCssDefaultPreset) return
  await storage.set({
    customCssDefaultPreset: reason === 'install' ? 'developer' : 'legacy',
  })
})

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
    case 'storage': {
      // Content settings belong to their sender; popup settings pin the active
      // tab now, before storage can yield and the user can switch tabs.
      const tabId = sender.tab?.id ?? (await getActiveTabId())
      await persistSetting(data, tabId)
      callback?.(data)
      break
    }
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
chrome.commands.onCommand.addListener(async action => {
  const command = commands[action]
  if (!command) return
  // Pin before commands.ts reads storage, not just before the eventual write.
  const tabId = await getActiveTabId()
  await command((action, data) => {
    if (action === 'storage')
      return persistSetting(data, tabId, data.key === 'hiddenSide')
  })
})

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ currentWindow: true, active: true })
  return tab?.id
}

async function persistSetting(
  data: { key: keyof typeof actionMap; value: any },
  tabId: number | undefined,
  toggleSide = false,
) {
  await storage.set({ [data.key]: data.value })
  updatePage(data.key, data.value, tabId, toggleSide)
}

const actionMap = {
  enable: 'reload',
  refresh: 'toggleRefresh',
  centered: 'toggleCentered',
  mdPlugins: 'updateMdPlugins',
  pageTheme: 'updatePageTheme',
  hiddenSide: 'updateSideVisibility',
  folderTree: 'toggleFolderTree',
  language: 'reload',
  refreshInterval: 'applySetting',
  searchHistory: 'applySetting',
  searchHistoryLimit: 'applySetting',
  codeWrap: 'applySetting',
  codeBlockDayTheme: 'applySetting',
  codeBlockNightTheme: 'applySetting',
  textSize: 'applySetting',
  textFont: 'applySetting',
  customWidth: 'applySetting',
  customCss: 'applySetting',
  customCssEnabled: 'applySetting',
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

function updatePage(
  key: keyof typeof actionMap,
  value: any,
  tabId: number | undefined,
  toggleSide: boolean,
) {
  const action =
    key === 'hiddenSide' && toggleSide ? 'toggleSide' : actionMap[key]
  if (!action || tabId === undefined) return
  // A tab may close or have no reader. Persist the setting and handle the
  // missing receiver, without falling back to a different active tab.
  chrome.tabs.sendMessage(
    tabId,
    { action, data: { key, value } },
    () => void chrome.runtime.lastError,
  )
}
