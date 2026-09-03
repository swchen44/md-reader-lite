import Ele from '@/core/ele'
import className from '@/config/class-name'
import {
  buildIndex,
  makeSnippet,
  search,
  withAncestors,
  type SearchEntry,
  type SearchHit,
  type HeadingLevelEntry,
} from '@/core/doc-search'

/* TS 4.8 lib 無 CSS Custom Highlight API 型別；最小 ambient 宣告 */
declare class Highlight {
  constructor(...ranges: Range[])
}
declare namespace CSS {
  const highlights:
    | { set(name: string, h: Highlight): void; delete(name: string): void }
    | undefined
}

const HIGHLIGHT_NAME = 'md-reader-search'
const DEBOUNCE_MS = 150
const FLASH_MS = 1500
/* 葉層級文字區塊；:has 需 Chrome 105+（本擴充最低支援線一致） */
const BLOCK_SELECTOR = [
  'p',
  'td',
  'th',
  'figcaption',
  'pre code',
  'li:not(:has(p, li, pre, table, blockquote))',
].join(', ')

const SEARCH_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'

interface Options {
  getArticle: () => HTMLElement
  getHeads: () => HTMLElement[]
  localize: (k: string) => string
  onRequestClose: () => void
  getMode: () => 'outline' | 'files'
  onFilesQuery: (q: string) => void
}

export interface SearchPanel {
  button: Ele<HTMLElement>
  bar: Ele<HTMLElement>
  panel: Ele<HTMLElement>
  focus(): void
  clear(): void
  rebuild(): void
  /** 只設定輸入框顯示的文字，不觸發過濾／搜尋——用於換頁後還原查詢字串
   *  時，讓後續 focus()/route() 依照這個值運作。 */
  setQuery(value: string): void
}

export function createSearchPanel(opts: Options): SearchPanel {
  const {
    getArticle,
    getHeads,
    localize,
    onRequestClose,
    getMode,
    onFilesQuery,
  } = opts

  const button = new Ele<HTMLElement>('button', {
    className: className.SIDE_SEARCH_BTN,
    title: localize('search_placeholder'),
  })
  button.innerHTML = SEARCH_SVG

  const input = new Ele<HTMLInputElement>('input', {
    className: className.SEARCH_INPUT,
    placeholder: localize('search_placeholder'),
  })
  const closeBtn = new Ele<HTMLElement>('button', {
    className: className.SEARCH_CLOSE,
    title: 'Esc',
  })
  closeBtn.textContent = '✕'
  const bar = new Ele<HTMLElement>('div', { className: className.SEARCH_BAR }, [
    input,
    closeBtn,
  ])
  const panel = new Ele<HTMLElement>('div', {
    className: className.SEARCH_PANEL,
  })
  bar.hide()
  panel.hide()

  let entries: SearchEntry[] | null = null
  /* 完整標題序列（含層級），供祖先脈絡推導；buildIndex() 會過濾掉空白標
   * 題，但 headingSeq 保留原序不濾——命中映射靠物件同一性比對，空白標
   * 題本身不會被搜到、也極少被當祖先；萬一恰好是祖先鏈斷點，屬可接受
   * 的近似（脈絡鏈少一層，不影響正確性）。*/
  let headingSeq: Array<{ entry: SearchEntry; level: number }> = []
  let debounceTimer = 0
  let flashTimer = 0

  function collect(): SearchEntry[] {
    const heads = getHeads()
    headingSeq = heads.map(h => ({
      entry: {
        kind: 'heading' as const,
        text: headingText(h),
        ref: h,
      },
      level: Number(h.tagName.slice(1)) || 6,
    }))
    const collected: SearchEntry[] = headingSeq.map(x => x.entry)
    const article = getArticle()
    article.querySelectorAll<HTMLElement>(BLOCK_SELECTOR).forEach(el => {
      if (el.closest('h1,h2,h3,h4,h5,h6')) return
      if (el.offsetParent === null) return
      collected.push({ kind: 'block', text: el.textContent || '', ref: el })
    })
    return buildIndex(collected)
  }

  function headingText(h: HTMLElement): string {
    /* 標題首子節點是 "#" 錨點連結，排除之 */
    let text = ''
    h.childNodes.forEach(n => {
      if (
        n instanceof HTMLElement &&
        n.classList.contains(className.HEAD_ANCHOR)
      ) {
        return
      }
      text += n.textContent || ''
    })
    return text.trim()
  }

  function ensureEntries(): SearchEntry[] {
    if (!entries) entries = collect()
    return entries
  }

  /* files 模式下輸入只轉發給檔案樹過濾，絕不執行 search()/文件高亮/面板渲染 */
  function route(value: string) {
    if (getMode() === 'files') {
      onFilesQuery(value)
      return
    }
    run(value)
  }

  function run(query: string) {
    const result = search(ensureEntries(), query.trim())
    renderResults(query.trim(), result)
    applyDocumentHighlights(query.trim(), result.blocks)
  }

  function renderResults(
    query: string,
    result: ReturnType<typeof search>,
  ): void {
    panel.innerHTML = null
    if (!query) {
      message(localize('search_empty_hint'))
      return
    }
    if (!result.headings.length && !result.blocks.length) {
      message(localize('search_no_results'))
      return
    }
    if (result.headings.length) {
      groupTitle(`${localize('search_headings')} ${result.headings.length}`)
      const hitIndexes = result.headings
        .map(h => headingSeq.findIndex(x => x.entry === h.entry))
        .filter(i => i >= 0)
      const hitByIndex = new Map<number, SearchHit>()
      result.headings.forEach(h => {
        const i = headingSeq.findIndex(x => x.entry === h.entry)
        if (i >= 0) hitByIndex.set(i, h)
      })
      withAncestors(
        headingSeq.map((x): HeadingLevelEntry => ({ level: x.level })),
        hitIndexes,
      ).forEach(item => {
        const seq = headingSeq[item.index]
        if (item.isContext) {
          panel.append(contextItem(seq.entry))
        } else {
          panel.append(headingItem(hitByIndex.get(item.index)!))
        }
      })
    }
    if (result.blocks.length) {
      groupTitle(`${localize('search_blocks')} ${result.blocks.length}`)
      result.blocks.forEach(hit => panel.append(blockItem(hit)))
      if (result.truncated) message(localize('search_truncated'))
    }
  }

  function message(text: string) {
    const m = new Ele<HTMLElement>('div', { className: className.SEARCH_MSG })
    m.textContent = text
    panel.append(m)
  }

  function groupTitle(text: string) {
    const t = new Ele<HTMLElement>('div', {
      className: className.SEARCH_GROUP_TITLE,
    })
    t.textContent = text
    panel.append(t)
  }

  function highlightedFragment(
    text: string,
    ranges: Array<[number, number]>,
  ): DocumentFragment {
    const frag = document.createDocumentFragment()
    let cursor = 0
    for (const [s, e] of ranges) {
      if (s > cursor) frag.append(text.slice(cursor, s))
      const mark = document.createElement('span')
      mark.className = className.SEARCH_HIT
      mark.textContent = text.slice(s, e)
      frag.append(mark)
      cursor = e
    }
    if (cursor < text.length) frag.append(text.slice(cursor))
    return frag
  }

  function headingItem(hit: SearchHit): Ele<HTMLElement> {
    const el = hit.entry.ref as HTMLElement
    const item = new Ele<HTMLElement>('div', {
      className: `${className.SEARCH_ITEM} ${className.SEARCH_ITEM_HEADING} ${
        className.MD_SIDE
      }-${el.tagName.toLowerCase()}`,
    })
    item.append(highlightedFragment(hit.entry.text, hit.ranges))
    item.on('click', () => jumpTo(el))
    return item
  }

  function contextItem(entry: SearchEntry): Ele<HTMLElement> {
    const el = entry.ref as HTMLElement
    const item = new Ele<HTMLElement>('div', {
      className: `${className.SEARCH_ITEM} ${className.SEARCH_ITEM_HEADING} ${
        className.SEARCH_ITEM_CONTEXT
      } ${className.MD_SIDE}-${el.tagName.toLowerCase()}`,
    })
    item.textContent = entry.text
    item.on('click', () => jumpTo(el))
    return item
  }

  function blockItem(hit: SearchHit): Ele<HTMLElement> {
    const snip = makeSnippet(hit.entry.text, hit.ranges)
    const item = new Ele<HTMLElement>('div', {
      className: className.SEARCH_ITEM,
    })
    item.append(highlightedFragment(snip.text, snip.ranges))
    item.on('click', () => jumpTo(hit.entry.ref as HTMLElement))
    return item
  }

  function jumpTo(el: HTMLElement) {
    if (!el.isConnected) {
      entries = null
      run(input.ele.value)
      return
    }
    el.scrollIntoView({ block: 'center' })
    clearTimeout(flashTimer)
    el.classList.remove(className.SEARCH_FLASH)
    /* 強制 reflow 讓同一元素能重播動畫 */
    void el.offsetWidth
    el.classList.add(className.SEARCH_FLASH)
    flashTimer = window.setTimeout(
      () => el.classList.remove(className.SEARCH_FLASH),
      FLASH_MS,
    )
  }

  function applyDocumentHighlights(query: string, hits: SearchHit[]): void {
    if (typeof CSS === 'undefined' || !CSS.highlights) return
    CSS.highlights.delete(HIGHLIGHT_NAME)
    if (!query || !hits.length) return
    const ranges: Range[] = []
    for (const hit of hits) {
      const el = hit.entry.ref as HTMLElement
      if (!el.isConnected) continue
      for (const [s, e] of hit.ranges) {
        const range = rangeInElement(el, s, e)
        if (range) ranges.push(range)
      }
    }
    if (ranges.length) {
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges))
    }
  }

  /** 將元素 textContent 的 [start,end) 映射為跨文字節點的 Range */
  function rangeInElement(
    el: HTMLElement,
    start: number,
    end: number,
  ): Range | null {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let offset = 0
    let startNode: Text | null = null
    let startOffset = 0
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const len = node.data.length
      if (!startNode && start < offset + len) {
        startNode = node
        startOffset = start - offset
      }
      if (startNode && end <= offset + len) {
        const range = document.createRange()
        range.setStart(startNode, startOffset)
        range.setEnd(node, end - offset)
        return range
      }
      offset += len
    }
    return null
  }

  input.on('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => route(input.ele.value), DEBOUNCE_MS)
  })
  input.on('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Escape' && !e.isComposing) {
      e.stopPropagation()
      onRequestClose()
    }
  })
  closeBtn.on('click', () => onRequestClose())

  return {
    button,
    bar,
    panel,
    focus() {
      input.ele.focus()
      route(input.ele.value)
    },
    clear() {
      if (getMode() === 'files') onFilesQuery('')
      clearTimeout(debounceTimer)
      input.ele.value = ''
      panel.innerHTML = null
      if (typeof CSS !== 'undefined' && CSS.highlights) {
        CSS.highlights.delete(HIGHLIGHT_NAME)
      }
    },
    rebuild() {
      entries = null
      /*
       * Ele#hide()/#show() only ever toggle `style.display`; there is no
       * `hidden` attribute proxying on Ele, so `panel.ele.hidden` would
       * always read false. Check the actual display state instead.
       */
      if (input.ele.value.trim() && panel.ele.style.display !== 'none') {
        run(input.ele.value)
      }
    },
    setQuery(value: string) {
      input.ele.value = value
    },
  }
}
