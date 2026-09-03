import type Ele from '@/core/ele'

export interface Dismissable {
  el: Ele<HTMLElement>
  open(): void
  close(): void
  toggle(): void
  readonly isOpen: boolean
}

/**
 * 把一個預設隱藏的元素包成「點外部即關閉」的浮層。
 * - open()：show + 掛 capture-phase document click 監聽
 * - 點擊目標不在 el 內即 close()（extraContains 可額外收容不在 el 底下的
 *   DOM，例如為了逃脫祖先 overflow:auto 裁切而搬到 document.body 的子選單）
 * - 觸發按鈕須自行 stopPropagation，避免同一次 click 立即關閉
 */
export function createDismissable(
  el: Ele<HTMLElement>,
  opts: {
    onOpen?: () => void
    onClose?: () => void
    extraContains?: (target: Node) => boolean
  } = {},
): Dismissable {
  let open = false
  const onDocClick = (e: MouseEvent) => {
    const target = e.target as Node
    if (el.ele.contains(target)) return
    if (opts.extraContains?.(target)) return
    api.close()
  }
  const api: Dismissable = {
    el,
    get isOpen() {
      return open
    },
    open() {
      if (open) return
      open = true
      el.show()
      document.addEventListener('click', onDocClick, true)
      opts.onOpen?.()
    },
    close() {
      if (!open) return
      open = false
      el.hide()
      document.removeEventListener('click', onDocClick, true)
      opts.onClose?.()
    },
    toggle() {
      open ? api.close() : api.open()
    },
  }
  return api
}
