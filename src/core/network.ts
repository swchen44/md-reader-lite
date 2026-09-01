export function isNetworkAllowed(offlineMode: boolean): boolean {
  return !offlineMode
}

export function isRemoteUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false
  const u = url.trim()
  if (!u) return false
  if (/^\/\//.test(u)) return true // protocol-relative
  return /^https?:\/\//i.test(u)
}
