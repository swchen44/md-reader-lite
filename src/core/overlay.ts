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
 * - 點擊目標不在 el 內即 close()
 * - 觸發按鈕須自行 stopPropagation，避免同一次 click 立即關閉
 */
export function createDismissable(
  el: Ele<HTMLElement>,
  opts: { onOpen?: () => void; onClose?: () => void } = {},
): Dismissable {
  let open = false
  const onDocClick = (e: MouseEvent) => {
    if (!el.ele.contains(e.target as Node)) api.close()
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
