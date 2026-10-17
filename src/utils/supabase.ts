import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ProjectMetadata } from '../types'

// Retrieve environment variables
const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

// Local storage keys for fallback or custom keys
const STORAGE_PROJECTS_KEY = 'smoot_local_projects'
const STORAGE_SUPABASE_CONFIG = 'smoot_custom_supabase_config'

export interface SupabaseConfig {
  url: string
  key: string
}

export function getEffectiveSupabaseConfig(): SupabaseConfig {
  const custom = localStorage.getItem(STORAGE_SUPABASE_CONFIG)
  if (custom) {
    try {
      const parsed = JSON.parse(custom)
      if (parsed.url && parsed.key) {
        return parsed
      }
    } catch {
      // ignore
    }
  }
  return {
    url: envUrl,
    key: envKey,
  }
}

export function saveCustomSupabaseConfig(config: SupabaseConfig) {
  localStorage.setItem(STORAGE_SUPABASE_CONFIG, JSON.stringify(config))
  _supabaseClient = null // force re-init
}

export function clearCustomSupabaseConfig() {
  localStorage.removeItem(STORAGE_SUPABASE_CONFIG)
  _supabaseClient = null
}

export function getMaskedSupabaseUrl(): string {
  const config = getEffectiveSupabaseConfig()
  if (!config.url) return ''
  try {
    const parsed = new URL(config.url)
    const host = parsed.hostname
    const parts = host.split('.')
    if (parts.length >= 3) {
      const subdomain = parts[0]
      const visible = subdomain.slice(0, 4)
      return `${parsed.protocol}//${visible}••••••••••••.${parts.slice(1).join('.')}`
    }
    return `${parsed.protocol}//${host.slice(0, 8)}••••••••`
  } catch {
    return 'https://••••••••••••••••'
  }
}

let _supabaseClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient

  const config = getEffectiveSupabaseConfig()
  if (config.url && config.key && config.url.startsWith('http')) {
    try {
      _supabaseClient = createClient(config.url, config.key)
      return _supabaseClient
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err)
      return null
    }
  }
  return null
}

export function isSupabaseConfigured(): boolean {
  const config = getEffectiveSupabaseConfig()
  return Boolean(config.url && config.key && config.url.startsWith('http'))
}

/**
 * Save project metadata.
 * STRICT POLICY: NEVER upload video files/blobs to Supabase Storage!
 * Only stores lightweight JSON metadata, timestamps, and editor settings.
 */
export async function saveProjectMetadata(project: ProjectMetadata): Promise<{ success: boolean; data?: ProjectMetadata; error?: string }> {
  const supabase = getSupabase()

  const projectPayload: ProjectMetadata = {
    ...project,
    id: project.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `proj_${Date.now()}`),
    updated_at: new Date().toISOString(),
    created_at: project.created_at || new Date().toISOString(),
  }

  // If Supabase is available, try inserting or updating into "video_projects" table
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('video_projects')
        .upsert({
          id: projectPayload.id,
          project_name: projectPayload.project_name,
          video_name: projectPayload.video_name,
          video_size: projectPayload.video_size,
          duration: projectPayload.duration,
          width: projectPayload.width,
          height: projectPayload.height,
          smooth_settings: projectPayload.smooth_settings,
          export_settings: projectPayload.export_settings,
          updated_at: projectPayload.updated_at,
          created_at: projectPayload.created_at,
        })
        .select()
        .single()

      if (!error && data) {
        saveToLocalStorage(data as ProjectMetadata)
        return { success: true, data: data as ProjectMetadata }
      }
      if (error) {
        console.warn('Supabase upsert returned error (table might need creation):', error.message)
      }
    } catch (err: any) {
      console.warn('Supabase save error, falling back to local storage:', err.message)
    }
  }

  // Fallback to local storage
  saveToLocalStorage(projectPayload)
  return { success: true, data: projectPayload }
}

/**
 * Fetch project history
 */
export async function fetchProjectHistory(): Promise<ProjectMetadata[]> {
  const supabase = getSupabase()

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('video_projects')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20)

      if (!error && data && data.length > 0) {
        return data as ProjectMetadata[]
      }
    } catch (err) {
      console.warn('Could not fetch from Supabase, loading local:', err)
    }
  }

  return getLocalStorageProjects()
}

/**
 * Delete project metadata
 */
export async function deleteProjectMetadata(id: string): Promise<boolean> {
  const supabase = getSupabase()
  if (supabase) {
    try {
      await supabase.from('video_projects').delete().eq('id', id)
    } catch (err) {
      console.warn('Could not delete from Supabase:', err)
    }
  }

  const list = getLocalStorageProjects().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(list))
  return true
}

// Local Storage helpers
function getLocalStorageProjects(): ProjectMetadata[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToLocalStorage(project: ProjectMetadata) {
  const list = getLocalStorageProjects()
  const idx = list.findIndex((p) => p.id === project.id)
  if (idx >= 0) {
    list[idx] = project
  } else {
    list.unshift(project)
  }
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(list.slice(0, 50)))
}
