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

/**
 * 將檔名/資料夾名編碼為與瀏覽器 file:// path 編碼一致的路徑片段。
 *
 * `encodeURIComponent` 跳脫的字元集比瀏覽器的 URL path percent-encode set
 * 大很多，導致以它組出的 URL 和 `window.location.href`（由瀏覽器原生編碼）
 * 不一致 —— grant 範圍比對用 `startsWith` 比對兩者，一旦不一致就永久失敗。
 *
 * 經以 Node 的 WHATWG URL（與瀏覽器同一套演算法）實測：對 pathname setter
 * 逐字元探測 `u.pathname = '/kb/' + ('x' + ch + 'y')`，取得瀏覽器實際會跳脫
 * 的字元集為：空白 " # < > ? \ ` { }（以及會被轉成 `/` 的反斜線）。
 * 其餘可列印 ASCII（含 `$ % & + , : ; = @ [ ] |`）瀏覽器一律保留原樣。
 *
 * 因此在 `encodeURIComponent` 之上，將這些「瀏覽器保留但 encodeURIComponent
 * 會跳脫」的字元還原成原字元即可對齊。`/` 刻意排除在還原清單之外 ——
 * 檔名理論上不會含有 `/`，若真的出現，寧可跳脫成 %2F 避免意外多出路徑片段。
 */
export function encodePathSegment(name: string): string {
  return encodeURIComponent(name)
    .replace(/%24/g, '$')
    .replace(/%25/g, '%')
    .replace(/%26/g, '&')
    .replace(/%2B/g, '+')
    .replace(/%2C/g, ',')
    .replace(/%3A/g, ':')
    .replace(/%3B/g, ';')
    .replace(/%3D/g, '=')
    .replace(/%40/g, '@')
    .replace(/%5B/g, '[')
    .replace(/%5D/g, ']')
    .replace(/%7C/g, '|')
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
      url: dirUrl + encodePathSegment(d.name) + '/',
    })),
    ...files.map(f => ({
      name: f.name,
      isDir: false,
      url: dirUrl + encodePathSegment(f.name),
    })),
  ]
}
