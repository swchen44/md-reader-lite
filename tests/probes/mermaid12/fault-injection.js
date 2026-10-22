export function injectFault(stage, id) {
  if (stage === 'stylesheet') {
    const original = CSSStyleSheet.prototype.insertRule
    CSSStyleSheet.prototype.insertRule = () => {
      throw new Error('probe: injected stylesheet failure')
    }
    return () => {
      CSSStyleSheet.prototype.insertRule = original
    }
  }
  if (stage === 'serialization') {
    const original = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'innerHTML',
    )
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...original,
      get() {
        if (this.id === `d${id}`)
          throw new Error('probe: injected serialization failure')
        return original.get.call(this)
      },
    })
    return () => {
      Object.defineProperty(Element.prototype, 'innerHTML', original)
    }
  }
  return () => {}
}
