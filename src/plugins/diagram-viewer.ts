import Panzoom, { type PanzoomObject } from '@panzoom/panzoom'
import className from '@/config/class-name'
import { GRAPHVIZ_CLASS, GRAPHVIZ_STATUS_ATTR } from '@/core/graphviz'

const ATTACHED_FLAG = 'mdReaderPz'
// Both diagram kinds render their SVG straight inside this container:
//   Mermaid  -> <pre class="mermaid">...<svg>...</svg></pre>
//     (see @md-reader/markdown-it-mermaid dist/index.js — rendered
//     synchronously into the markdown-it output, so the <svg> is already
//     present when `contentRendered` fires)
//   Graphviz -> <pre class="md-reader__graphviz" ...><svg class="md-reader__graphviz-svg">
//     (see src/plugins/graphviz-renderer.ts — rendered asynchronously
//     *after* `contentRendered` fires, replacing the placeholder <code>)
const DIAGRAM_SELECTOR = `pre.mermaid, .${GRAPHVIZ_CLASS}`

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
function waitForSvg(diagramEle: HTMLElement): void {
  const observer = new MutationObserver(() => {
    const status = diagramEle.getAttribute(GRAPHVIZ_STATUS_ATTR)
    if (status === 'error') {
      observer.disconnect()
      return
    }

    const svgEle = diagramEle.querySelector<SVGSVGElement>('svg')
    if (!svgEle) {
      return
    }

    observer.disconnect()
    if (diagramEle.dataset[ATTACHED_FLAG] === '1') {
      return
    }
    markAttached(diagramEle)
    safeAttachPanzoom(diagramEle, svgEle)
  })
  observer.observe(diagramEle, { childList: true })
}

export function attach(container: ParentNode): void {
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

    waitForSvg(diagramEle)
  })
}

export default function DiagramViewerPlugin({ event }) {
  event.on('contentRendered', (container: HTMLElement) => {
    attach(container)
  })
}
