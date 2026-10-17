/**
 * Client-side IndexedDB helper for persisting video files & blobs locally.
 * IndexedDB supports storing large files (hundreds of MBs) safely without
 * triggering the 5MB quota limit of localStorage.
 */

const DB_NAME = 'smoot_local_db'
const DB_VERSION = 1
const STORE_NAME = 'videos'
const VIDEO_KEY = 'active_project_video'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export interface StoredVideoRecord {
  blob: Blob
  name: string
  type: string
  lastModified: number
}

/**
 * Saves video Blob or File to IndexedDB
 */
export async function saveVideoToIDB(blob: Blob, name: string): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record: StoredVideoRecord = {
        blob,
        name,
        type: blob.type || 'video/mp4',
        lastModified: Date.now(),
      }
      const req = store.put(record, VIDEO_KEY)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to save video to IndexedDB:', err)
    return false
  }
}

/**
 * Retrieves the saved video Blob from IndexedDB
 */
export async function getVideoFromIDB(): Promise<StoredVideoRecord | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(VIDEO_KEY)
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve(req.result as StoredVideoRecord)
        } else {
          resolve(null)
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to retrieve video from IndexedDB:', err)
    return null
  }
}

/**
 * Clears the saved video from IndexedDB
 */
export async function clearVideoFromIDB(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(VIDEO_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to clear video from IndexedDB:', err)
  }
}
