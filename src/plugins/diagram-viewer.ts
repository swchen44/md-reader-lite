import Panzoom, { type PanzoomObject } from '@panzoom/panzoom'
import className from '@/config/class-name'
import { GRAPHVIZ_CLASS, GRAPHVIZ_STATUS_ATTR } from '@/core/graphviz'

const ATTACHED_FLAG = 'mdReaderPz'
// Both renderers replace readable source placeholders with inline SVG asynchronously.
const DIAGRAM_SELECTOR = `pre.mermaid, .${GRAPHVIZ_CLASS}`
const observers = new WeakMap<ParentNode, Set<MutationObserver>>()

function createButton(
  label: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `${className.DIAGRAM_CONTROLS}-btn`
  button.title = title
  button.textContent = label
  button.addEventListener('click', event => {
    event.stopPropagation()
    onClick()
  })
  return button
}

function createControls(panzoom: PanzoomObject): HTMLDivElement {
  const controls = document.createElement('div')
  controls.className = className.DIAGRAM_CONTROLS
  controls.append(
    createButton('+', 'Zoom in', () => panzoom.zoomIn()),
    createButton('−', 'Zoom out', () => panzoom.zoomOut()),
    createButton('↻', 'Reset', () => panzoom.reset()),
  )
  return controls
}

function hasRenderedSize(svgEle: SVGSVGElement): boolean {
  const rect = svgEle.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function attachPanzoom(diagramEle: HTMLElement, svgEle: SVGSVGElement): void {
  diagramEle.classList.add(className.DIAGRAM_VIEWER)

  diagramEle.addEventListener(
    'mouseenter',
    function onFirstEnter() {
      diagramEle.removeEventListener('mouseenter', onFirstEnter)

      if (!hasRenderedSize(svgEle)) {
        return
      }

      const panzoom = Panzoom(svgEle, {
        maxScale: 8,
        minScale: 0.3,
        cursor: 'grab',
      })
      diagramEle.addEventListener('wheel', event => {
        panzoom.zoomWithWheel(event as WheelEvent)
      })
      diagramEle.append(createControls(panzoom))
    },
    { once: true },
  )
}

function markAttached(diagramEle: HTMLElement): void {
  diagramEle.dataset[ATTACHED_FLAG] = '1'
}

function safeAttachPanzoom(
  diagramEle: HTMLElement,
  svgEle: SVGSVGElement,
): void {
  try {
    attachPanzoom(diagramEle, svgEle)
  } catch {
    // A missing size or a Panzoom throw must only skip this one
    // diagram — never break the rest of the page.
  }
}

// Graphviz renders its <svg> asynchronously (see graphviz-renderer.ts),
// so at the time `contentRendered` fires the container may still only
// hold the pending placeholder. Watch for the swap instead of missing it.
function waitForSvg(
  diagramEle: HTMLElement,
  pending: Set<MutationObserver>,
): void {
  const settle = () => {
    observer.disconnect()
    pending.delete(observer)
  }
  const observer = new MutationObserver(() => {
    const status =
      diagramEle.getAttribute(GRAPHVIZ_STATUS_ATTR) ||
      diagramEle.dataset.mermaidStatus
    if (status === 'error' || status === 'stale') {
      settle()
      return
    }

    const svgEle = diagramEle.querySelector<SVGSVGElement>('svg')
    if (!svgEle) {
      return
    }

    settle()
    if (diagramEle.dataset[ATTACHED_FLAG] === '1') {
      return
    }
    markAttached(diagramEle)
    safeAttachPanzoom(diagramEle, svgEle)
  })
  pending.add(observer)
  observer.observe(diagramEle, {
    childList: true,
    attributes: true,
    attributeFilter: [GRAPHVIZ_STATUS_ATTR, 'data-mermaid-status'],
  })
}

export function attach(container: ParentNode): void {
  observers.get(container)?.forEach(observer => observer.disconnect())
  const pending = new Set<MutationObserver>()
  observers.set(container, pending)
  const diagramElements = Array.from(
    container.querySelectorAll<HTMLElement>(DIAGRAM_SELECTOR),
  )

  diagramElements.forEach(diagramEle => {
    if (diagramEle.dataset[ATTACHED_FLAG] === '1') {
      return
    }

    const svgEle = diagramEle.querySelector<SVGSVGElement>('svg')
    if (svgEle) {
      markAttached(diagramEle)
      safeAttachPanzoom(diagramEle, svgEle)
      return
    }

    if (
      diagramEle.dataset.mermaidStatus !== 'error' &&
      diagramEle.getAttribute(GRAPHVIZ_STATUS_ATTR) !== 'error'
    )
      waitForSvg(diagramEle, pending)
  })
}

export default function DiagramViewerPlugin({ event }) {
  event.on('contentRendered', (container: HTMLElement) => {
    attach(container)
  })
}
