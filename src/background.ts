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
  refreshInterval: 'applySetting',
  codeWrap: 'applySetting',
  codeBlockDayTheme: 'applySetting',
  codeBlockNightTheme: 'applySetting',
  textSize: 'applySetting',
  textFont: 'applySetting',
  customWidth: 'applySetting',
  customCss: 'applySetting',
  zenMode: 'applySetting',
  breaks: 'applySetting',
  txtAsMd: 'applySetting',
  outlineCollapse: 'applySetting',
  mdPluginOptions: 'applySetting',
  customWidthUnit: 'applySetting',
}

function updatePage(key: keyof typeof actionMap, value?: any) {
  const action = actionMap[key]
  action &&
    chrome.tabs.query({ currentWindow: true, active: true }, tabs => {
      tabs.length &&
        chrome.tabs.sendMessage(tabs[0].id, { action, data: { key, value } })
    })
}
