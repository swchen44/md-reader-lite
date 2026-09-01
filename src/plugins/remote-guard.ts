import className from '@/config/class-name'
import { hasRemoteSrcset, isNetworkAllowed, isRemoteUrl } from '@/core/network'

// 廣查所有可能載入遠端資源的元素（含 SVG <image>、<input type="image">）。
const REMOTE_RESOURCE_SELECTOR =
  'img,video,audio,source,iframe,embed,track,object,image,input[type="image"]'

// 涵蓋 HTML 與 SVG 兩套屬性命名（href / xlink:href）。
const REMOTE_ATTRS = ['src', 'srcset', 'poster', 'data', 'href', 'xlink:href']

/**
 * 站點5：DOM 掃除。離線模式下，內容渲染完成後掃描已渲染的 DOM，
 * 把任何指向遠端（http/https/protocol-relative）的資源屬性移除並封存，
 * 避免瀏覽器對這些屬性發出網路請求。
 */
export function blockRemoteResources(container: ParentNode): void {
  const elements = container.querySelectorAll<HTMLElement>(
    REMOTE_RESOURCE_SELECTOR,
  )
  elements.forEach(el => {
    REMOTE_ATTRS.forEach(attr => {
      const value = el.getAttribute(attr)
      const isRemote =
        attr === 'srcset' ? hasRemoteSrcset(value) : isRemoteUrl(value)
      if (value && isRemote) {
        el.setAttribute('data-blocked-' + attr, value)
        el.removeAttribute(attr)
        el.classList.add(className.BLOCKED_REMOTE)
      }
    })
  })
}

export default function remoteGuardPlugin({ event, offlineMode }) {
  event.on('contentRendered', (container: HTMLElement) => {
    if (!isNetworkAllowed(offlineMode)) {
      blockRemoteResources(container)
    }
  })
}
