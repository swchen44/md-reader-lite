import ZenUml from '@zenuml/core'

// In pinned core 3.50.1 this public method is stateless. Avoid the React
// constructor: syntax validation must not mount UI or initiate asset loading.
const validator = Object.create(ZenUml.prototype)

export async function validateZenUML(source) {
  const result = await validator.parse(source.replace(/^\s*zenuml\b/, ''))
  if (!result.pass) {
    const detail = result.errorDetails
      .slice(0, 3)
      .map(error => `${error.line}:${error.column} ${error.msg}`)
      .join('; ')
    throw new Error(`ZenUML syntax error${detail ? ': ' + detail : ''}`)
  }
}
