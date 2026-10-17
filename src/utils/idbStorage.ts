/**
 * Client-side IndexedDB helper for persisting video files, projects, and active editing sessions.
 * IndexedDB supports storing large binary files (hundreds of MBs to GBs) safely
 * without triggering the 5MB quota limit of localStorage.
 */

import { ProjectItem } from '../types'

const DB_NAME = 'smoot_local_db'
const DB_VERSION = 2

const STORE_VIDEOS = 'videos'
const STORE_PROJECTS = 'projects'
const STORE_ACTIVE_SESSION = 'active_session'

const LEGACY_VIDEO_KEY = 'active_project_video'
const ACTIVE_SESSION_KEY = 'current_session'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      // 1. Legacy store for backward compatibility
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS)
      }

      // 2. Full project store with video blob + settings
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const projectStore = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
        projectStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      // 3. Active session store for debounced auto-save & auto-restore
      if (!db.objectStoreNames.contains(STORE_ACTIVE_SESSION)) {
        db.createObjectStore(STORE_ACTIVE_SESSION)
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

// ==========================================
// FULL PROJECT CRUD (IndexedDB)
// ==========================================

/**
 * Saves or updates a complete ProjectItem (Blob + settings + thumbnail) in IndexedDB
 */
export async function saveProjectToIDB(project: ProjectItem): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite')
      const store = tx.objectStore(STORE_PROJECTS)
      const req = store.put(project)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to save project to IndexedDB:', err)
    return false
  }
}

/**
 * Retrieves a single project by its ID from IndexedDB
 */
export async function getProjectFromIDB(id: string): Promise<ProjectItem | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly')
      const store = tx.objectStore(STORE_PROJECTS)
      const req = store.get(id)
      req.onsuccess = () => {
        resolve((req.result as ProjectItem) || null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to get project from IndexedDB:', err)
    return null
  }
}

/**
 * Retrieves all saved projects from IndexedDB sorted by newest first
 */
export async function getAllProjectsFromIDB(): Promise<ProjectItem[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly')
      const store = tx.objectStore(STORE_PROJECTS)
      const req = store.getAll()
      req.onsuccess = () => {
        const list = (req.result as ProjectItem[]) || []
        // Sort descending by updatedAt
        list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        resolve(list)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to get all projects from IndexedDB:', err)
    return []
  }
}

/**
 * Deletes a project from IndexedDB by ID
 */
export async function deleteProjectFromIDB(id: string): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite')
      const store = tx.objectStore(STORE_PROJECTS)
      const req = store.delete(id)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to delete project from IndexedDB:', err)
    return false
  }
}

// ==========================================
// ACTIVE SESSION AUTO-SAVE (IndexedDB)
// ==========================================

/**
 * Saves current active editing state for automatic resume
 */
export async function saveActiveSessionToIDB(project: ProjectItem): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ACTIVE_SESSION, 'readwrite')
      const store = tx.objectStore(STORE_ACTIVE_SESSION)
      const req = store.put(project, ACTIVE_SESSION_KEY)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to save active session to IndexedDB:', err)
    return false
  }
}

/**
 * Retrieves current active editing session
 */
export async function getActiveSessionFromIDB(): Promise<ProjectItem | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ACTIVE_SESSION, 'readonly')
      const store = tx.objectStore(STORE_ACTIVE_SESSION)
      const req = store.get(ACTIVE_SESSION_KEY)
      req.onsuccess = () => {
        resolve((req.result as ProjectItem) || null)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to get active session from IndexedDB:', err)
    return null
  }
}

/**
 * Clears current active editing session
 */
export async function clearActiveSessionFromIDB(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ACTIVE_SESSION, 'readwrite')
      const store = tx.objectStore(STORE_ACTIVE_SESSION)
      const req = store.delete(ACTIVE_SESSION_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to clear active session from IndexedDB:', err)
  }
}

// ==========================================
// THUMBNAIL UTILITIES
// ==========================================

/**
 * Captures a small thumbnail from the currently rendered HTML5 canvas
 */
export function captureCurrentCanvasThumbnail(): string | undefined {
  try {
    const canvas = document.querySelector('canvas')
    if (canvas && canvas.width > 0 && canvas.height > 0) {
      const thumbCanvas = document.createElement('canvas')
      thumbCanvas.width = 240
      thumbCanvas.height = 135
      const ctx = thumbCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
        return thumbCanvas.toDataURL('image/jpeg', 0.6)
      }
    }
  } catch {
    // Canvas might be cross-origin tainted or uninitialized
  }
  return undefined
}

/**
 * Generates a thumbnail JPEG DataURL from any video Blob
 */
export function generateVideoThumbnail(blob: Blob): Promise<string | undefined> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(blob)
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      video.src = url

      const cleanUp = () => {
        URL.revokeObjectURL(url)
        video.removeAttribute('src')
        video.load()
      }

      const timeout = setTimeout(() => {
        cleanUp()
        resolve(undefined)
      }, 3500)

      video.onloadeddata = () => {
        video.currentTime = Math.min(0.5, (video.duration || 1) / 2)
      }

      video.onseeked = () => {
        clearTimeout(timeout)
        try {
          const canvas = document.createElement('canvas')
          const scale = Math.min(240 / (video.videoWidth || 240), 135 / (video.videoHeight || 135), 1)
          canvas.width = Math.max(80, Math.floor((video.videoWidth || 240) * scale))
          canvas.height = Math.max(45, Math.floor((video.videoHeight || 135) * scale))
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6)
            cleanUp()
            resolve(dataUrl)
            return
          }
        } catch {
          // ignore error
        }
        cleanUp()
        resolve(undefined)
      }

      video.onerror = () => {
        clearTimeout(timeout)
        cleanUp()
        resolve(undefined)
      }
    } catch {
      resolve(undefined)
    }
  })
}

// ==========================================
// LEGACY COMPATIBILITY HELPERS
// ==========================================

export async function saveVideoToIDB(blob: Blob, name: string): Promise<boolean> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite')
      const store = tx.objectStore(STORE_VIDEOS)
      const record: StoredVideoRecord = {
        blob,
        name,
        type: blob.type || 'video/mp4',
        lastModified: Date.now(),
      }
      const req = store.put(record, LEGACY_VIDEO_KEY)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to save video to IndexedDB:', err)
    return false
  }
}

export async function getVideoFromIDB(): Promise<StoredVideoRecord | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readonly')
      const store = tx.objectStore(STORE_VIDEOS)
      const req = store.get(LEGACY_VIDEO_KEY)
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

export async function clearVideoFromIDB(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEOS, 'readwrite')
      const store = tx.objectStore(STORE_VIDEOS)
      const req = store.delete(LEGACY_VIDEO_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('[IDB] Failed to clear video from IndexedDB:', err)
  }
}
