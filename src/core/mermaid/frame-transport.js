export async function connectFrame(
  url = chrome.runtime.getURL('mermaid-frame.html'),
) {
  const frame = document.createElement('iframe')
  frame.src = url
  frame.style.cssText =
    'position:fixed;left:-100000px;top:0;width:1200px;height:900px;visibility:hidden;border:0'
  frame.tabIndex = -1
  frame.setAttribute('aria-hidden', 'true')
  const channel = new MessageChannel()
  const pending = new Map()
  let nextId = 0
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const item of pending.values()) {
      clearTimeout(item.timeout)
      item.reject(new Error('Renderer disposed'))
    }
    pending.clear()
    channel.port1.close()
    channel.port2.close()
    frame.remove()
  }
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Local renderer frame handshake timed out')),
        15000,
      )
      channel.port1.onmessage = event => {
        if (event.data?.type !== 'ready') return
        clearTimeout(timeout)
        resolve()
      }
      frame.onload = () =>
        frame.contentWindow.postMessage(
          { type: 'md-reader:mermaid-connect' },
          new URL(frame.src).origin,
          [channel.port2],
        )
      document.body.append(frame)
    })
    channel.port1.onmessage = event => {
      const reply = event.data
      const item = pending.get(reply?.id)
      if (reply?.type !== 'result' || !item) return
      pending.delete(reply.id)
      clearTimeout(item.timeout)
      item.resolve(reply)
    }
    const render = job =>
      new Promise((resolve, reject) => {
        if (disposed) {
          reject(new Error('Renderer disposed'))
          return
        }
        const id = ++nextId
        const timeout = setTimeout(() => {
          pending.delete(id)
          reject(new Error('Local renderer response timed out'))
        }, 90000)
        pending.set(id, { resolve, reject, timeout })
        channel.port1.postMessage({ id, job })
      })
    return { frame, render, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
