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
 * 先前版本以 Node 的 WHATWG URL pathname setter 逐字元探測還原字元集，但
 * 這只驗證了字串正規化演算法，不是瀏覽器實際開檔（打開真實檔案、讀 tab
 * URL）時的 OS path → file:// 轉換路徑，兩者不保證一致。改以 Chrome 151
 * 對真實檔案的 live 導覽實測：`; | [ ] %` 被 Chrome 跳脫為
 * `%3B %7C %5B %5D %25`，僅 `$ & + , = @` 六個字元被 live 驗證為保留原樣。
 * `:` 在 macOS 檔名中非法、無法測試，保守起見維持跳脫（其他平台可能不同，
 * 屬已知殘留風險，見 final-review-fixes-fsa.md）。
 *
 * 因此在 `encodeURIComponent` 之上，只將這六個 live 驗證過的字元還原成
 * 原字元。`encodeURIComponent` 本來就不會跳脫的 `! ' ( ) * ~ - _ .` 無需
 * 處理。`/` 刻意排除在還原清單之外 —— 檔名理論上不會含有 `/`，若真的
 * 出現，寧可跳脫成 %2F 避免意外多出路徑片段。
 */
export function encodePathSegment(name: string): string {
  return encodeURIComponent(name)
    .replace(/%24/g, '$')
    .replace(/%26/g, '&')
    .replace(/%2B/g, '+')
    .replace(/%2C/g, ',')
    .replace(/%3D/g, '=')
    .replace(/%40/g, '@')
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
