import { Parser } from 'htmlparser2'
import { decodeHTML } from 'entities'
import { createCSSPolicy, blocked } from './css-policy.mjs'

const FORMATTING = new Set([
  'a',
  'br',
  'wbr',
  'b',
  'strong',
  'em',
  'i',
  'u',
  's',
  'div',
  'span',
  'p',
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
  'font',
])
const RESOURCES = new Set([
  'src',
  'srcset',
  'poster',
  'data',
  'background',
  'action',
  'formaction',
  'ping',
  'manifest',
  'codebase',
  'profile',
  'archive',
  'classid',
])

function checkCSS(stylesheets = [], inline = []) {
  if (createCSSPolicy(stylesheets, new Set(), inline).dropped)
    throw blocked('unparsed authored CSS')
}

export function checkMarkup(source) {
  // Mirror Mermaid's entity notation before checking the decoded HTML grammar.
  let text = source
    .replace(
      /(?<!&)#(\w+);/g,
      (_, entity) => `&${/^\d+$/.test(entity) ? '#' : ''}${entity};`,
    )
    .replace(/\uFB02\u00b0\u00b0/g, '&#')
    .replace(/\uFB02\u00b0/g, '&')
    .replace(/\u00b6\u00df/g, ';')
  for (let depth = 0; depth < 8; depth++) {
    const decoded = decodeHTML(text)
    if (decoded === text) break
    text = decoded
    if (depth === 7) throw blocked('excessive entity nesting')
  }
  const parser = new Parser(
    {
      onopentag(tag, attributes) {
        if (!FORMATTING.has(tag)) throw blocked(`HTML element ${tag}`)
        for (const [name, value] of Object.entries(attributes)) {
          if (
            name.startsWith('on') ||
            RESOURCES.has(name) ||
            (name === 'href' && tag !== 'a')
          )
            throw blocked('HTML resource or event attribute')
          if (name === 'style') checkCSS([], [value])
        }
      },
    },
    { decodeEntities: true },
  )
  parser.end(text)
}

export function checkConfig(config) {
  const seen = new Set()
  const visit = (value, parentKey = '') => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string') {
        checkMarkup(item)
        if (key.toLowerCase().endsWith('css')) checkCSS([item])
        if (key.toLowerCase().endsWith('fontfamily'))
          checkCSS([], [`font-family:${item}`])
        if (
          parentKey === 'nodeColors' ||
          /(?:color|fill|stroke|background|bkg)$/i.test(key) ||
          /^(?:cScale|git|pie|venn)\d+$/.test(key)
        )
          checkCSS([], [`color:${item}`])
      } else visit(item, key)
    }
  }
  visit(config)
}

export function checkVertices(vertices) {
  for (const vertex of vertices.values()) {
    if (vertex.img !== undefined && vertex.img !== null)
      throw blocked('image node')
    if (typeof vertex.text === 'string') checkMarkup(vertex.text)
    if (Array.isArray(vertex.styles)) checkCSS([], [vertex.styles.join(';')])
  }
}

export function checkDiagram(diagram) {
  if (typeof diagram.db.getC4ShapeArray === 'function')
    checkConfig(diagram.db.getC4ShapeArray())
  if (typeof diagram.db.getBoundaries === 'function')
    checkConfig(diagram.db.getBoundaries())
  if (typeof diagram.db.getRels === 'function')
    checkConfig(diagram.db.getRels())
  if (typeof diagram.db.getVertices === 'function')
    checkVertices(diagram.db.getVertices())
  const seen = new Set()
  const styleFields = new Set([
    'style',
    'styles',
    'textStyles',
    'cssStyles',
    'cssCompiledStyles',
    'labelStyle',
    'defaultStyle',
  ])
  const visit = value => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if (value instanceof Map) {
      for (const item of value.values()) visit(item)
      return
    }
    for (const [key, item] of Object.entries(value)) {
      if (styleFields.has(key) && typeof item === 'string') checkCSS([], [item])
      else if (styleFields.has(key) && Array.isArray(item))
        checkCSS([], [item.join(';')])
      else visit(item)
    }
  }
  for (const method of [
    'getVertices',
    'getClasses',
    'getEdges',
    'getStates',
    'getEntities',
    'getRequirements',
    'getElements',
    'getBlocksFlat',
    'getNodes',
  ])
    if (typeof diagram.db[method] === 'function') visit(diagram.db[method]())
}
