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

/**
 * srcset 是逗號分隔的多候選字串（如 "local.png 1x, //evil/pixel.png 2x"），
 * 不能整串丟給 isRemoteUrl 判定（會誤判為 false）。
 * 拆出每個候選的 URL 部分（第一個空白前），任一候選為遠端即回 true。
 */
export function hasRemoteSrcset(srcset: unknown): boolean {
  if (typeof srcset !== 'string') return false
  return srcset
    .split(',')
    .some(candidate => isRemoteUrl(candidate.trim().split(/\s+/)[0]))
}
