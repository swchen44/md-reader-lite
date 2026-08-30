/** FSA 授權（root handle + 對應 rootDirUrl）的 IndexedDB 持久化。 */
const DB_NAME = 'md-reader-lite'
const STORE = 'fsa'
const KEY = 'root'

export interface FsaGrant {
  handle: unknown
  rootDirUrl: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveGrant(grant: FsaGrant): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(grant, KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadGrant(): Promise<FsaGrant | null> {
  try {
    const db = await openDb()
    const grant = await new Promise<FsaGrant | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return grant
  } catch {
    return null // IDB 不可用時降級為不持久（spec 錯誤處理）
  }
}

export async function clearGrant(): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* 無可清 */
  }
}
