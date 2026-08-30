import Ele from '@/core/ele'
import className from '@/config/class-name'
import { fetchDirListing, type DirEntry } from '@/core/dir-fetch'

interface FileTreeOptions {
  currentUrl: string
  localize: (key: string) => string
}

/** 目前檔案所在資料夾（含尾斜線） */
export function dirOf(url: string): string {
  return url.slice(0, url.lastIndexOf('/') + 1)
}

/** 上一層資料夾；已在根目錄時回傳 null */
export function parentOf(dirUrl: string): string | null {
  const u = new URL(dirUrl)
  if (u.pathname === '/' || u.pathname === '') return null
  const parent = new URL('..', dirUrl).href
  return parent === dirUrl ? null : parent
}

export function createFileTree({
  currentUrl,
  localize,
}: FileTreeOptions): Ele<HTMLElement> {
  // currentUrl 可能帶 #hash 或 ?query（例如錨點跳轉後的頁面網址），
  // 兩者都與檔案樹的目錄／作用中檔案判斷無關，先去除再使用。
  const cleanUrl = currentUrl.replace(/[?#].*$/, '')
  const rootDir = dirOf(cleanUrl)
  const container = new Ele<HTMLElement>('div', {
    className: className.FILE_TREE,
  })
  const cache = new Map<string, Promise<DirEntry[]>>()

  const loadDir = (dirUrl: string) => {
    if (!cache.has(dirUrl)) {
      const p = fetchDirListing(dirUrl)
      p.catch(() => cache.delete(dirUrl)) // 失敗不快取，允許重試
      cache.set(dirUrl, p)
    }
    return cache.get(dirUrl)
  }

  function renderMessage(target: Ele<HTMLElement>, text: string) {
    const msg = new Ele<HTMLElement>('div', { className: className.TREE_MSG })
    msg.textContent = text
    target.append(msg)
  }

  function renderEntries(target: Ele<HTMLElement>, entries: DirEntry[]) {
    const list = new Ele<HTMLElement>('ul')
    entries.forEach(entry => {
      list.append(entry.isDir ? renderDirNode(entry) : renderFileNode(entry))
    })
    target.append(list)
  }

  function renderFileNode(entry: DirEntry): Ele<HTMLElement> {
    const link = new Ele<HTMLElement>('a', {
      href: entry.url,
      title: entry.name,
    })
    link.textContent = entry.name
    const li = new Ele<HTMLElement>('li', {
      className:
        entry.url === cleanUrl
          ? `${className.TREE_FILE} ${className.TREE_FILE_ACTIVE}`
          : className.TREE_FILE,
    })
    li.append(link)
    return li
  }

  function renderDirNode(entry: DirEntry): Ele<HTMLElement> {
    const li = new Ele<HTMLElement>('li', { className: className.TREE_DIR })
    const label = new Ele<HTMLElement>('span', { title: entry.name })
    label.textContent = entry.name
    li.append(label)
    let childBox: Ele<HTMLElement> | null = null
    label.on('click', async () => {
      const open = li.classList.toggle(className.TREE_DIR_OPEN)
      if (!open) {
        childBox?.hide()
        return
      }
      if (childBox) {
        childBox.show()
        return
      }
      childBox = new Ele<HTMLElement>('div')
      li.append(childBox)
      renderMessage(childBox, '…')
      try {
        const entries = await loadDir(entry.url)
        childBox.innerHTML = null
        if (entries.length) {
          renderEntries(childBox, entries)
        } else {
          renderMessage(childBox, localize('dir_empty'))
        }
      } catch {
        childBox.remove()
        childBox = null
        const errMsg = new Ele<HTMLElement>('div', {
          className: className.TREE_MSG,
        })
        errMsg.textContent = localize('dir_error')
        li.append(errMsg)
        label.on('click', () => errMsg.remove(), { once: true })
        li.classList.remove(className.TREE_DIR_OPEN)
      }
    })
    return li
  }

  /* 首層：../ + 目前資料夾內容 */
  const parent = parentOf(rootDir)
  if (parent) {
    const upLink = new Ele<HTMLElement>('a', { href: parent })
    upLink.textContent = '../'
    const up = new Ele<HTMLElement>('div', { className: className.TREE_FILE })
    up.append(upLink)
    container.append(up)
  }
  renderMessage(container, '…')
  loadDir(rootDir)
    .then(entries => {
      container.query(`.${className.TREE_MSG}`)?.remove()
      if (entries.length) {
        renderEntries(container, entries)
      } else {
        renderMessage(container, localize('dir_error'))
      }
    })
    .catch(() => {
      container.query(`.${className.TREE_MSG}`)?.remove()
      renderMessage(container, localize('dir_error'))
    })

  return container
}
