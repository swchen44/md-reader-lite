import { connectEmbeddedFrame } from './frame-transport'

// This private document has its own CSP and never inherits a website sandbox.
// Keep the existing renderer iframe and geometry/security pipeline unchanged.
let connection = null
let active = 0
let heartbeat
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.target !== 'mermaid-offscreen') return
  if (sender.id !== chrome.runtime.id || sender.tab) return
  active++
  if (!heartbeat)
    heartbeat = setInterval(() => {
      chrome.runtime.sendMessage(
        { action: 'mermaidRendererHeartbeat' },
        () => void chrome.runtime.lastError,
      )
    }, 20000)
  if (!connection) connection = connectEmbeddedFrame()
  const current = connection
  current
    .then(renderer => renderer.render(message.job))
    .then(respond, error => {
      if (connection === current) connection = null
      current.then(
        renderer => renderer.dispose(),
        () => {},
      )
      respond({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    })
    .finally(() => {
      if (--active === 0) {
        clearInterval(heartbeat)
        heartbeat = null
      }
    })
    // The originating tab may disappear before its asynchronous response.
    .catch(() => {})
  return true
})
