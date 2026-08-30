import { isMarkdownFile, type DirEntry } from '#core/dir-listing'

export interface RootCandidate {
  rootDir: string[]
  remainder: string[]
}

export interface DirHandleLike {
  getDirectoryHandle(name: string): Promise<DirHandleLike>
}

export interface FsEntryLike {
  name: string
  kind: 'file' | 'directory'
}

/** file:// URL → 目錄 path segments（去檔名/query/hash、decode、無空段） */
export function urlToDirPath(url: string): string[] {
  const clean = url.replace(/[?#].*$/, '')
  const path = clean.replace(/^file:\/\//, '')
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (!clean.endsWith('/') && segments.length) {
    const last = segments[segments.length - 1]
    if (last.includes('.')) segments.pop()
  }
  return segments
}

/** 名稱匹配候選（深→淺）+ 恆附零匹配 fallback */
export function rootPathCandidates(
  rootName: string,
  dirSegments: string[],
): RootCandidate[] {
  const candidates: RootCandidate[] = []
  for (let i = dirSegments.length - 1; i >= 0; i--) {
    if (dirSegments[i] === rootName) {
      candidates.push({
        rootDir: dirSegments.slice(0, i + 1),
        remainder: dirSegments.slice(i + 1),
      })
    }
  }
  candidates.push({ rootDir: [], remainder: dirSegments.slice() })
  return candidates
}

/** 依序以 handle 走訪驗證候選；全敗回 null */
export async function resolveByCandidates(
  root: DirHandleLike,
  candidates: RootCandidate[],
): Promise<RootCandidate | null> {
  for (const candidate of candidates) {
    try {
      let dir = root
      for (const seg of candidate.remainder) {
        dir = await dir.getDirectoryHandle(seg)
      }
      return candidate
    } catch {
      /* 試下一個候選 */
    }
  }
  return null
}

/** FSA entries → DirEntry（過濾 md/資料夾、資料夾先、字典序、URL 編碼） */
export function entriesToDirEntries(
  items: FsEntryLike[],
  dirUrl: string,
): DirEntry[] {
  const dirs = items.filter(i => i.kind === 'directory')
  const files = items.filter(i => i.kind === 'file' && isMarkdownFile(i.name))
  const byName = (a: FsEntryLike, b: FsEntryLike) =>
    a.name.localeCompare(b.name)
  dirs.sort(byName)
  files.sort(byName)
  return [
    ...dirs.map(d => ({
      name: d.name,
      isDir: true,
      url: dirUrl + encodeURIComponent(d.name) + '/',
    })),
    ...files.map(f => ({
      name: f.name,
      isDir: false,
      url: dirUrl + encodeURIComponent(f.name),
    })),
  ]
}
