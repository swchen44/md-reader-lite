import { entriesToDirEntries, type FsEntryLike } from '@/core/fsa-path'
import type { DirEntry } from '@/core/dir-listing'

/* TS 4.8 lib 無 File System Access API 型別；最小 ambient 宣告 */
export interface FsaDirectoryHandle {
  readonly name: string
  readonly kind: 'directory'
  getDirectoryHandle(name: string): Promise<FsaDirectoryHandle>
  entries(): AsyncIterable<
    [string, { name: string; kind: 'file' | 'directory' }]
  >
  queryPermission(desc: { mode: 'read' }): Promise<PermissionState>
  requestPermission(desc: { mode: 'read' }): Promise<PermissionState>
}
declare function showDirectoryPicker(opts: {
  mode: 'read'
}): Promise<FsaDirectoryHandle>

export function isFsaSupported(): boolean {
  return typeof showDirectoryPicker === 'function'
}

export function pickDirectory(): Promise<FsaDirectoryHandle> {
  return showDirectoryPicker({ mode: 'read' })
}

export function verifyPermission(
  handle: FsaDirectoryHandle,
): Promise<PermissionState> {
  return handle.queryPermission({ mode: 'read' })
}

export function requestPermission(
  handle: FsaDirectoryHandle,
): Promise<PermissionState> {
  return handle.requestPermission({ mode: 'read' })
}

/** dirUrl（rootDirUrl 範圍內）→ handle 走訪 → DirEntry[] */
export function createFsaLister(
  root: FsaDirectoryHandle,
  rootDirUrl: string,
): (dirUrl: string) => Promise<DirEntry[]> {
  return async dirUrl => {
    if (!dirUrl.startsWith(rootDirUrl)) {
      throw new Error('directory outside granted root')
    }
    const rel = dirUrl
      .slice(rootDirUrl.length)
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent)
    let dir = root
    for (const seg of rel) {
      dir = await dir.getDirectoryHandle(seg)
    }
    const items: FsEntryLike[] = []
    for await (const [, h] of dir.entries()) {
      items.push({ name: h.name, kind: h.kind })
    }
    return entriesToDirEntries(items, dirUrl)
  }
}
