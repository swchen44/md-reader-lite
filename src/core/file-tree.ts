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
  const rootDir = dirOf(cleanUrl)
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

  // PROTOTYPE: sort/filter toolbar. A single settings button opens a
  // dismissable dropdown (reuses the same point-outside-to-close helper as
  // the page-level ≡ menu / settings overlay). Sort-by and order are
  // radio-like (only one active at a time, shown via an --active class);
  // folders-first and show-hidden are simple toggle buttons.
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
    const dismissable = createDismissable(menu)

    const optionButtons: { el: Ele<HTMLElement>; isActive: () => boolean }[] =
      []
    function refreshActiveStates() {
      for (const { el, isActive } of optionButtons) {
        el.classList.toggle(className.TREE_SETTINGS_OPTION_ACTIVE, isActive())
      }
    }

    function optionButton(
      label: string,
      isActive: () => boolean,
      onClick: () => void,
    ) {
      const btn = new Ele<HTMLElement>('button', {
        className: className.TREE_SETTINGS_OPTION,
        type: 'button',
      })
      btn.textContent = label
      btn.on('click', () => {
        onClick()
        refreshActiveStates()
        rerenderRoot()
      })
      optionButtons.push({ el: btn, isActive })
      return btn
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

    const sortRow = new Ele<HTMLElement>('div', {
      className: className.TREE_SETTINGS_ROW,
    })
    ;(['name', 'size', 'date'] as SortBy[]).forEach(key => {
      sortRow.append(
        optionButton(
          localize(`label_sort_${key}`),
          () => sortBy === key,
          () => (sortBy = key),
        ),
      )
    })
    menu.append(sortRow)

    const orderRow = new Ele<HTMLElement>('div', {
      className: className.TREE_SETTINGS_ROW,
    })
    orderRow.append(
      optionButton(
        localize('label_sort_asc'),
        () => !sortDesc,
        () => (sortDesc = false),
      ),
    )
    orderRow.append(
      optionButton(
        localize('label_sort_desc'),
        () => sortDesc,
        () => (sortDesc = true),
      ),
    )
    menu.append(orderRow)

    const foldersFirstBtn = optionButton(
      localize('label_folders_first'),
      () => foldersFirst,
      () => (foldersFirst = !foldersFirst),
    )
    menu.append(foldersFirstBtn)

    const showHiddenBtn = optionButton(
      localize('label_show_hidden'),
      () => showHidden,
      () => (showHidden = !showHidden),
    )
    menu.append(showHiddenBtn)

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
