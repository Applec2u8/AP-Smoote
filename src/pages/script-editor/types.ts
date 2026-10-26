/**
 * AP Smooth — AI Script Video Editor: Complete Type System
 */

// ── Video Input & Formats ──────────────────────────────────────────────────

export interface VideoQualityOption {
  formatId: string
  label: string
  resolution: string
  height: number
  fps?: number
  ext: string
  filesizeApprox?: number
  hasAudio?: boolean
}

export interface VideoInfoResponse {
  id: string
  title: string
  duration: number
  thumbnail?: string
  sourceType: 'upload' | 'url'
  url?: string
  formats: VideoQualityOption[]
  width?: number
  height?: number
  originalFileName?: string
}

// ── API Key Pool & Rotator ────────────────────────────────────────────────

export type ApiProviderCategory = 'gemini' | 'groq'

export interface ApiKeyItem {
  id: string
  key: string
  label?: string
  category: ApiProviderCategory
  isActive: boolean
  failCount: number
  isExhausted: boolean
  lastUsedAt?: number
}

export interface ApiKeyPoolState {
  gemini: ApiKeyItem[]
  groq: ApiKeyItem[]
  activeCategory: ApiProviderCategory
}

// ── Transcript & Segments ─────────────────────────────────────────────────

export interface WordToken {
  id: string
  text: string
  originalText?: string
  start: number   // in seconds
  end: number     // in seconds
  confidence: number
  isDeleted: boolean
  isEdited?: boolean
  isPunctuation?: boolean
}

export interface TranscriptSegment {
  id: string
  start: number
  end: number
  text: string
  words: WordToken[]
  isSummaryBlock?: boolean
  summaryText?: string
}

// ── AI Smart Summary ──────────────────────────────────────────────────────

export interface SummaryKeyPoint {
  topic: string
  summary: string
  start: number
  end: number
}

export interface SmartSummaryResult {
  summary: string
  keyPoints: SummaryKeyPoint[]
}

// ── TTS Settings ──────────────────────────────────────────────────────────

export interface TTSVoiceOption {
  id: string
  name: string
  gender: 'female' | 'male'
  language: string
  locale: string
}

export interface TTSMixSettings {
  enabled: boolean
  voiceId: string
  speed: number       // 0.8 – 1.5
  pitch: number       // -5 – +5
  originalVolume: number  // 0 – 100
  ttsVolume: number       // 0 – 100
  duckOriginalAudio: boolean
}

// ── Flexible Export ───────────────────────────────────────────────────────

export type ExportMode = 'text_only' | 'audio_only' | 'final_video'

export interface ExportConfig {
  mode: ExportMode
  includeTimestamps: boolean
  format: 'mp4' | 'mp3' | 'txt' | 'srt' | 'json'
}

// ── Pipeline Progress ─────────────────────────────────────────────────────

export type ProcessStep =
  | 'idle'
  | 'fetching_info'
  | 'downloading'
  | 'transcribing'
  | 'summarizing'
  | 'cutting_ffmpeg'
  | 'generating_tts'
  | 'mixing_export'
  | 'completed'
  | 'error'

export interface ProcessProgress {
  step: ProcessStep
  percent: number
  message: string
  error?: string
  exportUrl?: string
  exportFileName?: string
  exportMode?: ExportMode
  stats?: {
    originalDuration: number
    trimmedDuration: number
    wordsCutCount: number
    fillerWordsRemoved: number
  }
}

// ── Project Metadata ──────────────────────────────────────────────────────

export interface ScriptProjectMetadata {
  id: string
  title: string
  sourceType: 'upload' | 'url'
  sourceUrl?: string
  duration: number
  segments: TranscriptSegment[]
  smartSummary?: SmartSummaryResult
  ttsSettings: TTSMixSettings
  exportConfig?: ExportConfig
  createdAt: string
  updatedAt: string
}
