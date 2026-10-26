import { getEffectiveSupabaseConfig } from '../../../utils/supabase'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ScriptProjectMetadata } from '../types'

const LOCAL_STORAGE_SCRIPT_PROJECTS = 'ap_smooth_script_projects'

let _supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient | null {
  const config = getEffectiveSupabaseConfig()
  if (!config.url || !config.key) return null
  if (!_supabaseClient) {
    _supabaseClient = createClient(config.url, config.key)
  }
  return _supabaseClient
}

/**
 * SQL Schema for Supabase PostgreSQL (Stored in database only - NO LARGE VIDEOS IN STORAGE):
 * 
 * CREATE TABLE IF NOT EXISTS script_projects (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   title TEXT NOT NULL,
 *   source_type TEXT NOT NULL,
 *   source_url TEXT,
 *   duration NUMERIC,
 *   segments JSONB NOT NULL,
 *   tts_settings JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

export async function saveScriptProjectMetadata(
  project: ScriptProjectMetadata
): Promise<{ success: boolean; isCloud: boolean; error?: string }> {
  const client = getSupabaseClient()

  // 1. Always save a local copy to ensure safety and offline capability
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCRIPT_PROJECTS)
    const list: ScriptProjectMetadata[] = raw ? JSON.parse(raw) : []
    const existingIdx = list.findIndex((p) => p.id === project.id)
    if (existingIdx >= 0) {
      list[existingIdx] = { ...project, updatedAt: new Date().toISOString() }
    } else {
      list.unshift({ ...project, updatedAt: new Date().toISOString() })
    }
    localStorage.setItem(LOCAL_STORAGE_SCRIPT_PROJECTS, JSON.stringify(list))
  } catch (err) {
    console.warn('LocalStorage save failed:', err)
  }

  // 2. If Supabase is connected, store Text, Timestamps & Metadata in PostgreSQL
  if (client) {
    try {
      const payload = {
        id: project.id,
        title: project.title,
        source_type: project.sourceType,
        source_url: project.sourceUrl || null,
        duration: project.duration,
        segments: project.segments, // Text & Timestamps stored as JSONB
        tts_settings: project.ttsSettings,
        updated_at: new Date().toISOString(),
      }

      const { error } = await client.from('script_projects').upsert(payload)
      if (error) {
        console.warn('Supabase DB upsert returned error (fallback to local):', error.message)
        return { success: true, isCloud: false, error: error.message }
      }
      return { success: true, isCloud: true }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown Supabase error'
      return { success: true, isCloud: false, error: msg }
    }
  }

  return { success: true, isCloud: false }
}

export async function loadScriptProjects(): Promise<ScriptProjectMetadata[]> {
  const client = getSupabaseClient()
  if (client) {
    try {
      const { data, error } = await client
        .from('script_projects')
        .select('*')
        .order('updated_at', { ascending: false })

      if (!error && data && data.length > 0) {
        return data.map((row) => ({
          id: row.id,
          title: row.title,
          sourceType: row.source_type,
          sourceUrl: row.source_url,
          duration: Number(row.duration || 0),
          segments: row.segments,
          ttsSettings: row.tts_settings,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      }
    } catch (err) {
      console.warn('Could not fetch from Supabase script_projects, falling back to local storage', err)
    }
  }

  // Fallback to local storage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCRIPT_PROJECTS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
