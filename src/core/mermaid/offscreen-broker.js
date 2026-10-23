const OFFSCREEN_PATH = 'mermaid-offscreen.html'
const RESPONSE_TIMEOUT_MS = 90000

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
}

function isJSON(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (!Array.isArray(value) && !isPlainObject(value)) return false
  if (ancestors.has(value)) return false
  ancestors.add(value)
  const valid = Object.values(value).every(item => isJSON(item, ancestors))
  ancestors.delete(value)
  return valid
}

function validateJob(job) {
  if (!isPlainObject(job)) throw new Error('Invalid Mermaid job')
  if (typeof job.source !== 'string' || job.source.length > 50000)
    throw new Error(
      'Invalid Mermaid source: expected a string of at most 50000 characters',
    )
  if (
    typeof job.renderId !== 'string' ||
    !/^md-reader-mermaid-\d+$/.test(job.renderId)
  )
    throw new Error('Invalid Mermaid renderId')
  if (
    job.config !== undefined &&
    (!isPlainObject(job.config) || !isJSON(job.config))
  )
    throw new Error('Invalid Mermaid config: expected a plain JSON object')
}

export function installOffscreenBroker(
  api = globalThis.chrome,
  { idleMs = 1000 } = {},
) {
  let lifecycle = Promise.resolve()
  let active = 0
  let idleTimer
  let idleEpoch = 0

  // Creation and closure use the same queue, including after a failed operation.
  function serialize(operation) {
    const next = lifecycle.then(operation)
    lifecycle = next.catch(() => {})
    return next
  }

  async function hasDocument() {
    const url = api.runtime.getURL(OFFSCREEN_PATH)
    if (typeof api.runtime.getContexts === 'function') {
      const contexts = await api.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [url],
      })
      return contexts.length > 0
    }
    // Official pre-116 service-worker fallback, restricted to our exact page.
    if (typeof globalThis.clients?.matchAll !== 'function')
      throw new Error('Offscreen document discovery unavailable')
    const clients = await globalThis.clients.matchAll()
    return clients.some(client => client.url === url)
  }

  function scheduleIdleClose() {
    if (active) return
    clearTimeout(idleTimer)
    const epoch = idleEpoch
    idleTimer = setTimeout(() => {
      serialize(async () => {
        if (active || epoch !== idleEpoch) return
        const exists = await hasDocument()
        // New work invalidates this check even if it has already finished or
        // timed out by the time document discovery settles.
        if (!exists || active || epoch !== idleEpoch) return
        await api.offscreen.closeDocument()
      }).catch(() => {})
    }, idleMs)
  }

  async function render(job) {
    let expired = false
    let responseTimer
    const work = async () => {
      validateJob(job)
      if (
        typeof api.offscreen?.createDocument !== 'function' ||
        typeof api.offscreen?.closeDocument !== 'function'
      )
        throw new Error('Mermaid offscreen API unavailable')
      await serialize(async () => {
        if (expired) return
        const exists = await hasDocument()
        if (!exists && !expired) {
          await api.offscreen.createDocument({
            url: OFFSCREEN_PATH,
            reasons: ['DOM_PARSER'],
            justification:
              'Render and sanitize local Mermaid SVG on sandboxed pages.',
          })
        }
      })
      // A deadline may have elapsed while discovery, creation, or closure was
      // pending. Never send that expired job when the lifecycle queue resumes.
      if (expired) return
      return new Promise((resolve, reject) => {
        const receive = result => {
          if (result == null)
            reject(new Error('Mermaid offscreen renderer returned no response'))
          else resolve(result)
        }
        const returned = api.runtime.sendMessage(
          { target: 'mermaid-offscreen', job },
          result => {
            const error = api.runtime.lastError
            if (error) reject(new Error(error.message))
            else receive(result)
          },
        )
        // Chrome callback APIs return undefined; Promise-based boundaries may
        // return a Promise instead. Consume rejections even after a timeout.
        if (returned?.then) returned.then(receive, reject)
      })
    }
    try {
      const deadline = new Promise((_, reject) => {
        responseTimer = setTimeout(() => {
          expired = true
          reject(new Error('Mermaid offscreen response timed out'))
        }, RESPONSE_TIMEOUT_MS)
      })
      const result = await Promise.race([deadline, work()])
      return { ok: true, result }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    } finally {
      clearTimeout(responseTimer)
      active--
      scheduleIdleClose()
    }
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== undefined) return
    if (message?.action === 'mermaidRendererHeartbeat') {
      if (
        sender?.id === api.runtime.id &&
        !sender.tab &&
        sender.url === api.runtime.getURL(OFFSCREEN_PATH)
      )
        sendResponse({ ok: true })
      return
    }
    if (message?.action !== 'renderMermaid') return
    if (sender?.id !== api.runtime.id || !sender.tab) return
    idleEpoch++
    clearTimeout(idleTimer)
    active++
    render(message.data)
      .then(sendResponse)
      .catch(() => {})
    return true
  })
}
