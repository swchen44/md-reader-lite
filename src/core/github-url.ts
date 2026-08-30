import { isMarkdownFile, type DirEntry } from '#core/dir-listing'

export interface RawUrlParts {
  owner: string
  repo: string
  ref: string
  refPrefix: '' | 'refs/heads/' | 'refs/tags/'
  dirPath: string[]
}

export interface GithubContentItem {
  name: string
  type: string
}

const RAW_HOST = 'https://raw.githubusercontent.com'

/** raw URL → 結構；非 raw 網域或段數不足回 null */
export function parseRawUrl(url: string): RawUrlParts | null {
  if (!url.startsWith(RAW_HOST + '/')) return null
  const rest = url.slice(RAW_HOST.length + 1).replace(/[?#].*$/, '')
  const segs = rest.split('/').filter(Boolean).map(decodeURIComponent)
  if (segs.length < 4) {
    // owner/repo/ref/file 為最少（傳統形態）
    return null
  }
  const [owner, repo, ...tail] = segs
  let refPrefix: RawUrlParts['refPrefix'] = ''
  let ref: string
  let pathSegs: string[]
  if (
    tail.length >= 4 &&
    tail[0] === 'refs' &&
    (tail[1] === 'heads' || tail[1] === 'tags')
  ) {
    /* 顯式形態：refs/heads|tags/<ref>/<path…>（最少 refs+kind+ref+file 四段） */
    refPrefix = ('refs/' + tail[1] + '/') as RawUrlParts['refPrefix']
    ref = tail[2]
    pathSegs = tail.slice(3)
  } else if (tail.length >= 2) {
    ref = tail[0]
    pathSegs = tail.slice(1)
  } else {
    return null
  }
  return { owner, repo, ref, refPrefix, dirPath: pathSegs.slice(0, -1) }
}

function encodeSegs(segs: string[]): string {
  return segs.map(encodeURIComponent).join('/')
}

export function rawDirUrl(
  p: RawUrlParts,
  dirPath: string[] = p.dirPath,
): string {
  const path = dirPath.length ? encodeSegs(dirPath) + '/' : ''
  return `${RAW_HOST}/${encodeURIComponent(p.owner)}/${encodeURIComponent(
    p.repo,
  )}/${p.refPrefix}${encodeURIComponent(p.ref)}/${path}`
}

export function apiContentsUrl(
  p: RawUrlParts,
  dirPath: string[] = p.dirPath,
): string {
  const path = dirPath.length ? '/' + encodeSegs(dirPath) : ''
  return `https://api.github.com/repos/${encodeURIComponent(
    p.owner,
  )}/${encodeURIComponent(p.repo)}/contents${path}?ref=${encodeURIComponent(
    p.ref,
  )}`
}

/** `../` 目標：github.com 的 tree 頁；已在 repo 根回 null */
export function parentTreeUrl(p: RawUrlParts): string | null {
  if (!p.dirPath.length) return null
  const parent = p.dirPath.slice(0, -1)
  const path = parent.length ? '/' + encodeSegs(parent) : ''
  return `https://github.com/${encodeURIComponent(
    p.owner,
  )}/${encodeURIComponent(p.repo)}/tree/${encodeURIComponent(p.ref)}${path}`
}

export function contentsToDirEntries(
  items: GithubContentItem[],
  p: RawUrlParts,
  dirPath: string[],
): DirEntry[] {
  const dirs = items.filter(i => i.type === 'dir')
  const files = items.filter(i => i.type === 'file' && isMarkdownFile(i.name))
  const byName = (a: GithubContentItem, b: GithubContentItem) =>
    a.name.localeCompare(b.name)
  dirs.sort(byName)
  files.sort(byName)
  const base = rawDirUrl(p, dirPath)
  return [
    ...dirs.map(d => ({
      name: d.name,
      isDir: true,
      url: base + encodeURIComponent(d.name) + '/',
    })),
    ...files.map(f => ({
      name: f.name,
      isDir: false,
      url: base + encodeURIComponent(f.name),
    })),
  ]
}

/** 403/429 且流量餘額為 0 → ratelimit；其他一律 error */
export function classifyGithubFailure(
  status: number,
  ratelimitRemaining: string | null,
): 'ratelimit' | 'error' {
  return (status === 403 || status === 429) && ratelimitRemaining === '0'
    ? 'ratelimit'
    : 'error'
}
