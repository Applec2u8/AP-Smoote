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
  playbackSpeed?: number // 0.1 - 1.0 (Slow motion factor: 1.0 = Normal, 0.5 = 2x Slow, 0.25 = 4x Slow, 0.1 = 10x Slow)
}

export type TargetFPS = 30 | 60 | 120

export type TargetResolution = 'original' | '1080p' | '720p' | '480p'

export interface ExportSettings {
  fps: TargetFPS
  resolution: TargetResolution
  quality: 'high' | 'medium' | 'maximum'
  format: 'mp4' | 'webm'
}

export type VideoAspectRatio = 'original' | '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | '21:9'

export type VideoFitMode = 'contain' | 'cover'

export interface TrimRange {
  start: number
  end: number
}

export interface TimeBlock {
  id: string
  start: number
  end: number
  smoothSettings?: SmoothSettings
  transformSettings?: VideoTransformSettings
}

export interface VideoTransformSettings {
  aspectRatio: VideoAspectRatio
  fitMode: VideoFitMode
  zoom: number // 1.0 = 100%, up to 3.0 = 300%
  panX?: number // -100 to 100 (% offset from center)
  panY?: number // -100 to 100 (% offset from center)
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
  trim_range?: TrimRange
  time_blocks?: TimeBlock[]
  transform_settings?: VideoTransformSettings
  created_at?: string
  updated_at?: string
}
