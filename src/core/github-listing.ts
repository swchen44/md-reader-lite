import {
  apiContentsUrl,
  classifyGithubFailure,
  contentsToDirEntries,
  type GithubContentItem,
  type RawUrlParts,
} from '@/core/github-url'
import type { DirEntry } from '@/core/dir-listing'

/**
 * GitHub Contents API lister。knownDirs 以「URL → dirPath」註冊表運作：
 * root 由呼叫端 seed（location 原生編碼），子目錄 URL 為自建（encodeURIComponent），
 * 兩者都只當 Map key 用，完全不做 URL 字串回推。
 */
export function createGithubLister(
  p: RawUrlParts,
  rootDirUrl: string,
): (dirUrl: string) => Promise<DirEntry[]> {
  const knownDirs = new Map<string, string[]>([[rootDirUrl, p.dirPath]])
  return async dirUrl => {
    const dirPath = knownDirs.get(dirUrl)
    if (!dirPath) {
      throw new Error('unknown github directory: ' + dirUrl)
    }
    const res = await fetch(apiContentsUrl(p, dirPath), {
      signal: (AbortSignal as any).timeout(8000),
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) {
      const kind = classifyGithubFailure(
        res.status,
        res.headers.get('x-ratelimit-remaining'),
      )
      const err = new Error(
        kind === 'ratelimit'
          ? 'GitHub API rate limit'
          : `GitHub API HTTP ${res.status}`,
      )
      if (kind === 'ratelimit') err.name = 'RateLimitError'
      throw err
    }
    const items = (await res.json()) as GithubContentItem[]
    if (!Array.isArray(items)) {
      throw new Error('unexpected GitHub API response shape')
    }
    const entries = contentsToDirEntries(items, p, dirPath)
    for (const entry of entries) {
      if (entry.isDir) knownDirs.set(entry.url, [...dirPath, entry.name])
    }
    return entries
  }
}
