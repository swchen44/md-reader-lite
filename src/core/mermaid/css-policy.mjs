import { parse, walk, generate, clone, List, ident } from 'css-tree'

const FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
  'light-dark',
  'calc',
  'min',
  'max',
  'clamp',
  'abs',
  'sign',
  'round',
  'mod',
  'rem',
  'sqrt',
  'pow',
  'hypot',
  'log',
  'exp',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'translate',
  'translatex',
  'translatey',
  'translatez',
  'translate3d',
  'scale',
  'scalex',
  'scaley',
  'scalez',
  'scale3d',
  'rotate',
  'rotatex',
  'rotatey',
  'rotatez',
  'rotate3d',
  'matrix',
  'matrix3d',
  'skew',
  'skewx',
  'skewy',
  'perspective',
  'cubic-bezier',
  'steps',
  'linear',
  'drop-shadow',
  'blur',
  'brightness',
  'contrast',
  'grayscale',
  'hue-rotate',
  'invert',
  'opacity',
  'saturate',
  'sepia',
])
const AT_RULES = new Set([
  'media',
  'supports',
  'keyframes',
  '-webkit-keyframes',
  'container',
  'layer',
])

export function blocked(reason) {
  return new Error(`Blocked resource policy: ${reason}`)
}

function parseCSS(source, context) {
  return parse(source, {
    context,
    parseCustomProperty: true,
  })
}

export function createCSSPolicy(stylesheets, ids, inlineStyles = [], rootId) {
  let dropped = 0
  let clonedNodes = 0
  let clonedCharacters = 0
  let visitedNodes = 0
  if (
    [...stylesheets, ...inlineStyles].reduce(
      (sum, text) => sum + text.length,
      0,
    ) > 262144
  )
    throw blocked('CSS expansion budget')
  function checkedClone(ast) {
    walk(ast, node => {
      clonedNodes++
      for (const value of Object.values(node))
        if (typeof value === 'string') clonedCharacters += value.length
      if (clonedNodes > 25000 || clonedCharacters > 262144)
        throw blocked('CSS expansion budget')
    })
    return clone(ast)
  }
  const styles = stylesheets.map(source => parseCSS(source, 'stylesheet'))
  const inline = inlineStyles.map(source => parseCSS(source, 'declarationList'))
  for (const ast of [...styles, ...inline]) {
    walk(ast, {
      enter(node, item, list) {
        let invalid = node.type === 'Raw'
        if (node.type === 'Declaration')
          walk(node.value, child => {
            if (child.type === 'Raw') invalid = true
          })
        if (invalid && list) {
          dropped++
          list.remove(item)
          return walk.skip
        }
      },
    })
  }
  const variables = new Map()
  for (const ast of [...styles, ...inline]) {
    walk(ast, {
      visit: 'Declaration',
      enter(node) {
        if (!node.property.startsWith('--')) return
        const key = ident.decode(node.property)
        if (
          variables.has(key) &&
          generate(variables.get(key)) !== generate(node.value)
        )
          throw blocked('scoped CSS variables are not supported')
        variables.set(key, checkedClone(node.value))
      },
    })
  }

  function rewriteValue(value, path = []) {
    walk(value, {
      leave(node, item, list) {
        if (++visitedNodes > 50000) throw blocked('CSS expansion budget')
        if (node.type === 'Raw') throw blocked('unparsed CSS value')
        if (node.type === 'Url') {
          if (!node.value.startsWith('#'))
            throw blocked(`nonlocal CSS URL: ${node.value}`)
          if (!ids.has(node.value.slice(1)))
            list.replace(
              item,
              list.createItem({ type: 'Identifier', name: 'none' }),
            )
        }
        if (node.type !== 'Function') return
        const name = ident.decode(node.name).toLowerCase()
        if (name === 'var') {
          const parts = node.children.toArray()
          const key =
            parts[0]?.type === 'Identifier' ? ident.decode(parts[0].name) : ''
          if (!key.startsWith('--') || path.includes(key) || path.length >= 32)
            throw blocked('invalid or cyclic CSS variable')
          const fallback = new List()
          const comma = parts.findIndex(
            part => part.type === 'Operator' && part.value === ',',
          )
          if (comma >= 0)
            for (const part of parts.slice(comma + 1))
              fallback.appendData(checkedClone(part))
          const replacement = variables.has(key)
            ? checkedClone(variables.get(key))
            : fallback.isEmpty
            ? parseCSS('initial', 'value')
            : { type: 'Value', children: fallback }
          rewriteValue(replacement, [...path, key])
          list.replace(item, replacement.children)
        } else if (!FUNCTIONS.has(name)) {
          throw blocked(`unsupported CSS function ${name}`)
        }
      },
    })
    return value
  }

  for (const ast of [...styles, ...inline]) {
    walk(ast, {
      enter(node) {
        if (node.type === 'Raw') throw blocked('unparsed CSS')
        if (
          node.type === 'Atrule' &&
          !AT_RULES.has(ident.decode(node.name).toLowerCase())
        )
          throw blocked('resource-loading or unsupported CSS at-rule')
        if (node.type === 'Declaration') rewriteValue(node.value)
      },
    })
  }
  if (rootId) {
    const names = new Map()
    const guard = parseCSS(
      `:where(#${ident.encode(rootId)},#${ident.encode(rootId)} *)`,
      'selector',
    ).children.first
    for (const ast of styles) {
      walk(ast, {
        visit: 'Atrule',
        enter(node) {
          if (
            !['keyframes', '-webkit-keyframes'].includes(
              ident.decode(node.name),
            )
          )
            return
          const name = node.prelude?.children.first
          if (name?.type !== 'Identifier')
            throw blocked('invalid keyframe name')
          const original = ident.decode(name.name)
          const scoped = `${rootId}-${original}`
          names.set(original, scoped)
          name.name = ident.encode(scoped)
        },
      })
      walk(ast, {
        visit: 'Rule',
        enter(node) {
          if (
            this.atrule &&
            ['keyframes', '-webkit-keyframes'].includes(
              ident.decode(this.atrule.name),
            )
          )
            return
          if (node.prelude?.type !== 'SelectorList')
            throw blocked('unparsed CSS selector')
          for (const selector of node.prelude.children) {
            let before = null
            for (let item = selector.children.tail; item; item = item.prev) {
              if (item.data.type === 'PseudoElementSelector') before = item
            }
            selector.children.insertData(checkedClone(guard), before)
          }
        },
      })
    }
    for (const ast of [...styles, ...inline])
      walk(ast, {
        visit: 'Declaration',
        enter(node) {
          if (
            ![
              'animation',
              'animation-name',
              '-webkit-animation',
              '-webkit-animation-name',
            ].includes(node.property)
          )
            return
          walk(node.value, child => {
            if (
              child.type === 'Identifier' &&
              names.has(ident.decode(child.name))
            )
              child.name = ident.encode(names.get(ident.decode(child.name)))
          })
        },
      })
  }
  const outputStyles = styles.map(generate)
  const outputInline = inline.map(generate)
  if (
    [...outputStyles, ...outputInline].reduce(
      (sum, text) => sum + text.length,
      0,
    ) > 262144
  )
    throw blocked('CSS expansion budget')
  return {
    dropped,
    styles: outputStyles,
    inline: outputInline,
    value: source => {
      let ast
      try {
        ast = parseCSS(source, 'value')
      } catch {
        return ''
      }
      return generate(rewriteValue(ast))
    },
  }
}
