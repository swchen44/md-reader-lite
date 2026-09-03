import Ele, { svg } from '@/core/ele'
import className from '@/config/class-name'
import { fetchDirListing, type DirEntry } from '@/core/dir-fetch'
import { findRanges } from '@/core/doc-search'
import { createDismissable } from '@/core/overlay'
import settingsIcon from '@/images/icon_tree_settings.svg'

type SortBy = 'name' | 'size' | 'date'

interface FileTreeOptions {
  currentUrl: string
  localize: (key: string) => string
  listDir?: (dirUrl: string) => Promise<DirEntry[]>
  onRootStatus?: (status: 'ok' | 'error') => void
  parentHref?: string | null
  /** 提供時：完全跳過 lister/probe，直接顯示此訊息（零 fetch，離線封鎖用） */
  rootMessage?: string
}

export interface FileTreeHandle {
  tree: Ele<HTMLElement>
  applyFilter(query: string): void
  clearFilter(): void
}

interface NodeRecord {
  plainName: string
  label: HTMLElement // 檔案節點為 <a>、資料夾節點為 <span>
  li: HTMLElement
  isDir: boolean
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
  listDir: listDirOpt,
  onRootStatus,
  parentHref,
  rootMessage,
}: FileTreeOptions): FileTreeHandle {
  // currentUrl 可能帶 #hash 或 ?query（例如錨點跳轉後的頁面網址），
  // 兩者都與檔案樹的目錄／作用中檔案判斷無關，先去除再使用。
  const cleanUrl = currentUrl.replace(/[?#].*$/, '')
  const naturalRootDir = dirOf(cleanUrl)
  // 點擊子資料夾裡的檔案連結（file:// 為完整導覽、http(s)/GitHub 為換頁）
  // 都會讓內容腳本整份重跑，若每次都用 dirOf(目前網址) 當根目錄，樹會
  // 「跟著跑進子樹」──使用者展開的上層結構整個消失。用 sessionStorage
  // 記住使用者最初展開的根目錄；只要目前檔案仍在那個根目錄底下（字串前
  // 綴比對即可，file/http(s)/GitHub 的網址都是階層式路徑），就沿用舊根，
  // 樹狀結構的可見範圍才不會被單純的檔案切換打斷。真的離開該根目錄範圍
  // （例如點「../」跳出去，或另外開一個不相干的檔案）才自然改採新根目錄。
  const ROOT_KEY = 'md-reader:treeRoot'
  function readStoredRoot(): string | null {
    try {
      return sessionStorage.getItem(ROOT_KEY)
    } catch {
      return null
    }
  }
  function writeStoredRoot(root: string) {
    try {
      sessionStorage.setItem(ROOT_KEY, root)
    } catch {
      // 沙盒文件等場景會拋 SecurityError；根目錄記憶只是錦上添花，
      // 忽略即可，退化成「每次都用目前檔案所在資料夾」的舊行為。
    }
  }
  const storedRootDir = readStoredRoot()
  const rootDir =
    storedRootDir && cleanUrl.startsWith(storedRootDir)
      ? storedRootDir
      : naturalRootDir
  if (rootDir !== storedRootDir) writeStoredRoot(rootDir)
  const listDir = listDirOpt ?? fetchDirListing
  const container = new Ele<HTMLElement>('div', {
    className: className.FILE_TREE,
  })
  const cache = new Map<string, Promise<DirEntry[]>>()
  const records: NodeRecord[] = []
  let currentQuery = ''
  let hintEle: Ele<HTMLElement> | null = null
  let emptyEle: Ele<HTMLElement> | null = null

  // PROTOTYPE: sort/filter settings (not yet persisted to storage — resets
  // per page load). Changing any of these re-renders from the cached root
  // listing; already-expanded subfolders collapse (re-expanding re-applies
  // the new settings via the same cache, no re-fetch).
  let sortBy: SortBy = 'name'
  let sortDesc = false
  let foldersFirst = true
  let showHidden = true

  function sortAndFilter(entries: DirEntry[]): DirEntry[] {
    const filtered = showHidden
      ? entries
      : entries.filter(e => !e.name.startsWith('.'))
    return [...filtered].sort((a, b) => {
      if (foldersFirst && a.isDir !== b.isDir) return a.isDir ? -1 : 1
      let cmp = 0
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortBy === 'size') cmp = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0)
      else if (sortBy === 'date') cmp = (a.mtimeMs ?? 0) - (b.mtimeMs ?? 0)
      return sortDesc ? -cmp : cmp
    })
  }

  function collapseAll() {
    for (const li of container.queryAll(`.${className.TREE_DIR_OPEN}`)) {
      li.classList.remove(className.TREE_DIR_OPEN)
      const childBox = li.querySelector('div')
      if (childBox) (childBox as HTMLElement).style.display = 'none'
    }
  }

  function rerenderRoot() {
    collapseAll()
    const list = container.query('ul')
    list?.remove()
    // 重繪根節點時舊的節點紀錄已全數 detach，清空避免無上限累積
    // （applyFilter 靠 li.isConnected 過濾掉它們，功能不受影響，但陣列
    // 與其引用的 detached DOM 會持續佔記憶體）。
    records.length = 0
    loadDir(rootDir).then(entries => {
      if (entries.length) renderEntries(container, entries)
      pinFooterRows()
      if (currentQuery) applyFilter(currentQuery)
    })
  }

  const loadDir = (dirUrl: string) => {
    if (!cache.has(dirUrl)) {
      const p = listDir(dirUrl)
      p.catch(() => cache.delete(dirUrl)) // 失敗不快取，允許重試
      cache.set(dirUrl, p)
    }
    return cache.get(dirUrl)
  }

  function renderMessage(
    target: Ele<HTMLElement>,
    text: string,
  ): Ele<HTMLElement> {
    const msg = new Ele<HTMLElement>('div', { className: className.TREE_MSG })
    msg.textContent = text
    target.append(msg)
    return msg
  }

  function renderEntries(target: Ele<HTMLElement>, entries: DirEntry[]) {
    const list = new Ele<HTMLElement>('ul')
    sortAndFilter(entries).forEach(entry => {
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
    records.push({
      plainName: entry.name,
      label: link.ele,
      li: li.ele,
      isDir: false,
    })
    li.append(link)
    return li
  }

  function renderDirNode(entry: DirEntry): Ele<HTMLElement> {
    const li = new Ele<HTMLElement>('li', { className: className.TREE_DIR })
    const label = new Ele<HTMLElement>('span', { title: entry.name })
    label.textContent = entry.name
    records.push({
      plainName: entry.name,
      label: label.ele,
      li: li.ele,
      isDir: true,
    })
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
          pinFooterRows()
          if (currentQuery) applyFilter(currentQuery)
        } else {
          renderMessage(childBox, localize('dir_empty'))
        }
      } catch (err) {
        childBox.remove()
        childBox = null
        const errMsg = new Ele<HTMLElement>('div', {
          className: className.TREE_MSG,
        })
        errMsg.textContent =
          (err as Error)?.name === 'RateLimitError'
            ? localize('github_ratelimit')
            : localize('dir_error')
        li.append(errMsg)
        label.on('click', () => errMsg.remove(), { once: true })
        li.classList.remove(className.TREE_DIR_OPEN)
      }
    })
    return li
  }

  const HIT_ATTR = 'data-md-filter-hit'

  function rebuildLabel(rec: NodeRecord, ranges: Array<[number, number]>) {
    rec.label.textContent = ''
    let cursor = 0
    for (const [s, e] of ranges) {
      if (s > cursor) {
        rec.label.append(
          document.createTextNode(rec.plainName.slice(cursor, s)),
        )
      }
      const mark = document.createElement('span')
      mark.className = className.TREE_NAME_HIT
      mark.textContent = rec.plainName.slice(s, e)
      rec.label.append(mark)
      cursor = e
    }
    if (cursor < rec.plainName.length) {
      rec.label.append(document.createTextNode(rec.plainName.slice(cursor)))
    }
  }

  function hasMatchedAncestorDir(li: HTMLElement): boolean {
    let node: HTMLElement | null = li.parentElement
    while (node && node !== container.ele) {
      if (
        node.tagName === 'LI' &&
        node.classList.contains(className.TREE_DIR) &&
        node.getAttribute(HIT_ATTR) === '1'
      ) {
        return true
      }
      node = node.parentElement
    }
    return false
  }

  function applyFilter(query: string) {
    const q = query.trim()
    currentQuery = q
    const live = records.filter(r => r.li.isConnected)
    /* phase 1：比對 + label 重建（每次都從 plainName 重建，避免巢狀 span） */
    for (const rec of live) {
      const ranges = q ? findRanges(rec.plainName, q) : []
      if (ranges.length) {
        rec.li.setAttribute(HIT_ATTR, '1')
        rebuildLabel(rec, ranges)
      } else {
        rec.li.removeAttribute(HIT_ATTR)
        rec.label.textContent = rec.plainName
      }
    }
    /* phase 2：可見性（自己命中 ∨ 祖先資料夾命中 ∨ 有命中後代） */
    for (const rec of live) {
      const show =
        !q ||
        rec.li.getAttribute(HIT_ATTR) === '1' ||
        hasMatchedAncestorDir(rec.li) ||
        rec.li.querySelector(`[${HIT_ATTR}="1"]`) !== null
      rec.li.classList.toggle(className.TREE_FILTERED_HIDDEN, !show)
    }
    const anyVisible = live.some(
      r => !r.li.classList.contains(className.TREE_FILTERED_HIDDEN),
    )
    /* 提示列 + 無符合結果訊息 */
    if (q) {
      if (!hintEle) {
        hintEle = new Ele<HTMLElement>('div', {
          className: `${className.TREE_MSG} ${className.TREE_FILTER_HINT}`,
        })
        hintEle.textContent = localize('search_filter_loaded_only')
        container.append(hintEle)
      }
      hintEle.show()
      if (!anyVisible) {
        if (!emptyEle) {
          emptyEle = new Ele<HTMLElement>('div', {
            className: className.TREE_MSG,
          })
          emptyEle.textContent = localize('search_no_results')
          container.append(emptyEle)
        }
        emptyEle.show()
      } else {
        emptyEle?.hide()
      }
    } else {
      hintEle?.hide()
      emptyEle?.hide()
    }
  }

  function clearFilter() {
    applyFilter('')
  }

  /** 讓提示列／無符合結果訊息永遠固定在樹狀清單最下方 */
  function pinFooterRows() {
    if (hintEle) container.append(hintEle)
    if (emptyEle) container.append(emptyEle)
  }

  // Settings button opens a dismissable dropdown (reuses the same
  // point-outside-to-close helper as the page-level ≡ menu / settings
  // overlay). "排序順序" is a submenu trigger that flies out a second panel
  // to the right, mirroring the store CRX's nested sort/filter menu.
  // Sort-by and order are radio-like (only one checked at a time);
  // folders-first and show-hidden are independent checked toggles.
  function buildToolbar(): Ele<HTMLElement> {
    const settingsBtn = new Ele<HTMLElement>(
      'button',
      {
        className: className.TREE_SETTINGS_BTN,
        title: localize('label_tree_settings'),
        type: 'button',
      },
      svg(settingsIcon),
    )

    const menu = new Ele<HTMLElement>('div', {
      className: className.TREE_SETTINGS_MENU,
    })
    menu.hide()

    // .md-reader__file-tree（子選單的原生祖先）同時有 overflow:auto 與
    // will-change:transform，後者會讓它變成 fixed 定位子孫的 containing
    // block——單純把子選單改成 position:fixed 仍會被裁切。因此子選單改為
    // 開啟時才搬到 document.body（脫離該祖先），關閉時移除，並手動計算
    // 貼齊觸發列右側的座標。
    const submenu = new Ele<HTMLElement>('div', {
      className: className.TREE_SETTINGS_SUBMENU,
    })
    submenu.hide()

    function openSubmenu() {
      const rect = submenuTrigger.ele.getBoundingClientRect()
      submenu.setStyle({
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.right + 4}px`,
      })
      document.body.appendChild(submenu.ele)
      submenu.show()
    }
    function closeSubmenu() {
      submenu.hide()
      submenu.remove()
    }

    const dismissable = createDismissable(menu, {
      onClose: () => closeSubmenu(),
      extraContains: target => submenu.ele.contains(target),
    })

    const checkOptions: {
      check: Ele<HTMLElement>
      isActive: () => boolean
    }[] = []
    function refreshActiveStates() {
      for (const { check, isActive } of checkOptions) {
        check.toggle(isActive())
      }
    }

    function checkOption(
      label: string,
      isActive: () => boolean,
      onClick: () => void,
    ) {
      const check = new Ele<HTMLElement>('span', {
        className: className.TREE_SETTINGS_CHECK,
      })
      check.textContent = '✓'
      const text = new Ele<HTMLElement>('span')
      text.textContent = label
      const btn = new Ele<HTMLElement>(
        'button',
        { className: className.TREE_SETTINGS_CHECK_OPTION, type: 'button' },
        [check, text],
      )
      btn.on('click', () => {
        onClick()
        refreshActiveStates()
        rerenderRoot()
      })
      checkOptions.push({ check, isActive })
      return btn
    }

    function divider() {
      return new Ele<HTMLElement>('div', {
        className: className.TREE_SETTINGS_DIVIDER,
      })
    }

    const collapseBtn = new Ele<HTMLElement>('button', {
      className: className.TREE_SETTINGS_ITEM,
      type: 'button',
    })
    collapseBtn.textContent = localize('label_collapse_all')
    collapseBtn.on('click', () => {
      collapseAll()
      dismissable.close()
    })
    menu.append(collapseBtn)

    const submenuTrigger = new Ele<HTMLElement>('button', {
      className: className.TREE_SETTINGS_SUBMENU_TRIGGER,
      type: 'button',
    })
    submenuTrigger.textContent = localize('label_sort_order')
    submenuTrigger.on('click', e => {
      e.stopPropagation()
      submenu.ele.isConnected ? closeSubmenu() : openSubmenu()
    })
    ;(['name', 'size', 'date'] as SortBy[]).forEach(key => {
      submenu.append(
        checkOption(
          localize(`label_sort_${key}`),
          () => sortBy === key,
          () => (sortBy = key),
        ),
      )
    })
    submenu.append(divider())
    submenu.append(
      checkOption(
        localize('label_sort_asc'),
        () => !sortDesc,
        () => (sortDesc = false),
      ),
    )
    submenu.append(
      checkOption(
        localize('label_sort_desc'),
        () => sortDesc,
        () => (sortDesc = true),
      ),
    )
    submenu.append(divider())
    submenu.append(
      checkOption(
        localize('label_folders_first'),
        () => foldersFirst,
        () => (foldersFirst = !foldersFirst),
      ),
    )
    submenu.append(
      checkOption(
        localize('label_show_hidden'),
        () => showHidden,
        () => (showHidden = !showHidden),
      ),
    )

    menu.append(submenuTrigger)

    refreshActiveStates()

    settingsBtn.on('click', e => {
      e.stopPropagation()
      dismissable.toggle()
    })

    return new Ele<HTMLElement>('div', { className: className.TREE_TOOLBAR }, [
      settingsBtn,
      menu,
    ])
  }
  container.append(buildToolbar())

  /* 首層：../ + 目前資料夾內容 */
  const parent = parentHref !== undefined ? parentHref : parentOf(rootDir)
  if (parent) {
    const upLink = new Ele<HTMLElement>('a', { href: parent })
    upLink.textContent = '../'
    const up = new Ele<HTMLElement>('div', { className: className.TREE_FILE })
    up.append(upLink)
    container.append(up)
  }
  if (rootMessage) {
    // 零 fetch：不掛 listDir、不呼叫 loadDir/fetchDirListing，直接顯示訊息
    // （離線封鎖等場景，樹本身不得觸發任何目錄請求）。
    renderMessage(container, rootMessage)
    return { tree: container, applyFilter, clearFilter }
  }
  const rootMsgEle = renderMessage(container, '…')
  loadDir(rootDir)
    .then(entries => {
      rootMsgEle.remove()
      if (entries.length) {
        renderEntries(container, entries)
        pinFooterRows()
        if (currentQuery) applyFilter(currentQuery)
        onRootStatus?.('ok')
      } else {
        renderMessage(container, localize('dir_error'))
        onRootStatus?.('error')
      }
    })
    .catch(err => {
      rootMsgEle.remove()
      renderMessage(
        container,
        err?.name === 'RateLimitError'
          ? localize('github_ratelimit')
          : localize('dir_error'),
      )
      onRootStatus?.('error')
    })

  return { tree: container, applyFilter, clearFilter }
}
