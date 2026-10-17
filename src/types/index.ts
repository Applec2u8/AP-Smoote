export interface VideoMetadata {
  name: string
  size: number
  type: string
  duration: number
  width: number
  height: number
  aspectRatio: number
}

export type SmoothingMode = 'blend' | 'motion_blur' | 'interpolation'

export interface SmoothSettings {
  intensity: number // 0 - 100
  mode: SmoothingMode
  frameSamples: number // 2 - 8 samples
  blendDecay: number // 0.1 - 0.9
  sharpness: number // 0 - 100
  brightness: number // 80 - 120
  contrast: number // 80 - 140
  enableStabilizeSim: boolean
}

export type TargetFPS = 30 | 60 | 120

export type TargetResolution = 'original' | '1080p' | '720p' | '480p'

export interface ExportSettings {
  fps: TargetFPS
  resolution: TargetResolution
  quality: 'high' | 'medium' | 'maximum'
  format: 'webm' | 'mp4'
}

export interface ProjectMetadata {
  id?: string
  project_name: string
  video_name: string
  video_size: number
  duration: number
  width: number
  height: number
  smooth_settings: SmoothSettings
  export_settings: ExportSettings
  created_at?: string
  updated_at?: string
}
