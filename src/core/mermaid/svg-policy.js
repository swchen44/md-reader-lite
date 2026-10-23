import DOMPurify from 'dompurify'
import { createCSSPolicy, blocked } from './css-policy.mjs'

const TAGS = [
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textpath',
  'marker',
  'clippath',
  'mask',
  'pattern',
  'lineargradient',
  'radialgradient',
  'stop',
  'filter',
  'feblend',
  'fecolormatrix',
  'fecomponenttransfer',
  'fecomposite',
  'feconvolvematrix',
  'fediffuselighting',
  'fedisplacementmap',
  'fedistantlight',
  'fedropshadow',
  'feflood',
  'fefunca',
  'fefuncb',
  'fefuncg',
  'fefuncr',
  'fegaussianblur',
  'femerge',
  'femergenode',
  'femorphology',
  'feoffset',
  'fepointlight',
  'fespecularlighting',
  'fespotlight',
  'fetile',
  'feturbulence',
  'foreignobject',
  'title',
  'desc',
  'style',
  'a',
  'switch',
  'div',
  'span',
  'p',
  'b',
  'strong',
  'em',
  'i',
  'u',
  's',
  'br',
  'wbr',
  'small',
  'sub',
  'sup',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'label',
  'font',
]
const RESOURCES = new Set([
  'img',
  'image',
  'feimage',
  'iframe',
  'object',
  'embed',
  'video',
  'audio',
  'source',
  'link',
  'base',
  'meta',
  'script',
  'animate',
  'set',
])
const RESOURCE_ATTRS = new Set([
  'src',
  'srcset',
  'href',
  'poster',
  'background',
  'data',
  'action',
  'formaction',
  'ping',
  'manifest',
  'codebase',
  'profile',
  'archive',
  'classid',
])
const PAINT_ATTRS = new Set([
  'fill',
  'stroke',
  'filter',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'cursor',
])

export function sanitizeSVG(source, css) {
  const fragment = DOMPurify.sanitize(source, {
    ALLOWED_TAGS: TAGS,
    ADD_ATTR: ['xmlns', 'xmlns:xlink', 'dominant-baseline', 'xml:space'],
    HTML_INTEGRATION_POINTS: { foreignobject: true },
    RETURN_DOM_FRAGMENT: true,
  })
  for (const removed of DOMPurify.removed) {
    if (
      removed.element &&
      RESOURCES.has(removed.element.localName.toLowerCase())
    )
      throw blocked('embedded resource or active element')
    if (
      removed.attribute &&
      removed.attribute.localName.toLowerCase().startsWith('on')
    )
      throw blocked('event handler')
  }
  const svg = fragment.firstElementChild
  if (!svg || svg.localName !== 'svg' || fragment.children.length !== 1)
    throw blocked('invalid SVG root')
  if (css) {
    const style = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'style',
    )
    style.textContent = css
    svg.append(style)
  }
  const elements = [svg, ...svg.querySelectorAll('*')]
  const ids = new Set(elements.filter(el => el.id).map(el => el.id))
  const sheets = elements.filter(el => el.localName === 'style')
  const styled = elements.filter(el => el.hasAttribute('style'))
  const policy = createCSSPolicy(
    sheets.map(el => el.textContent),
    ids,
    styled.map(el => el.getAttribute('style')),
    svg.id,
  )
  sheets.forEach((el, i) => {
    el.textContent = policy.styles[i]
  })
  styled.forEach((el, i) => {
    el.setAttribute('style', policy.inline[i])
  })
  for (const element of elements) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.localName.toLowerCase()
      if (RESOURCE_ATTRS.has(name)) {
        if (name === 'href' && element.localName === 'a') continue
        if (
          name !== 'href' ||
          !attribute.value.startsWith('#') ||
          !ids.has(attribute.value.slice(1))
        )
          throw blocked('nonlocal resource attribute')
      }
      if (PAINT_ATTRS.has(name)) {
        const value = policy.value(attribute.value)
        if (value)
          element.setAttributeNS(attribute.namespaceURI, attribute.name, value)
        else element.removeAttributeNode(attribute)
      }
    }
  }
  // Snapshot HTML label typography before host article CSS can override it.
  // Only mount after resource validation, and never copy resource-bearing styles.
  const mount = document.createElement('div')
  mount.append(svg)
  document.body.append(mount)
  try {
    const properties = [
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'line-height',
      'color',
      'text-align',
      'text-decoration',
      'white-space',
      'word-break',
      'overflow-wrap',
      'margin',
      'padding',
      'letter-spacing',
    ]
    const labels = [...svg.querySelectorAll('foreignObject *')].map(element => {
      const computed = getComputedStyle(element)
      return {
        element,
        values: properties.map(name => computed.getPropertyValue(name)),
      }
    })
    for (const { element, values } of labels)
      properties.forEach((name, index) => {
        if (values[index])
          element.style.setProperty(name, values[index], 'important')
      })
    return new XMLSerializer().serializeToString(svg)
  } finally {
    mount.remove()
  }
}
