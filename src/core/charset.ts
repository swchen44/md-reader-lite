export function needsCharsetCompat(
  protocol: string,
  charsetCompat: boolean,
): boolean {
  return protocol === 'file:' && !!charsetCompat
}

export function canBgFetch(
  senderUrl: unknown,
  targetUrl: unknown,
  extensionId: unknown,
  senderId: unknown,
): boolean {
  if (typeof senderUrl !== 'string' || !senderUrl) return false
  if (typeof targetUrl !== 'string' || !targetUrl) return false
  if (typeof extensionId !== 'string' || senderId !== extensionId) return false
  let t: URL
  try {
    // parse both; sender parse guards malformed sender
    // eslint-disable-next-line no-new
    new URL(senderUrl)
    t = new URL(targetUrl)
  } catch {
    return false
  }
  if (senderUrl !== targetUrl) return false // 精確比對：只重抓自己這頁
  if (t.protocol !== 'file:') return false // file: 限縮
  return true
}
