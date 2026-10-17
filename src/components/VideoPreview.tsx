import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  SplitSquareVertical,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { SmoothSettings, VideoMetadata } from '../types'
import { applyFrameEffects } from '../utils/videoProcessor'
import { Language, translations } from '../utils/i18n'

interface VideoPreviewProps {
  videoUrl: string
  metadata: VideoMetadata | null
  smoothSettings: SmoothSettings
  onVideoLoaded?: (meta: VideoMetadata) => void
  lang: Language
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl,
  metadata,
  smoothSettings,
  onVideoLoaded,
  lang,
}) => {
  const t = translations[lang]
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLooping, setIsLooping] = useState(true)

  // Comparison & View modes
  const [viewMode, setViewMode] = useState<'smoothed' | 'split' | 'original'>('smoothed')
  const [splitPosition, setSplitPosition] = useState(50) // percentage 0-100
  const [isDraggingSplit, setIsDraggingSplit] = useState(false)

  // FPS calculation for preview player
  const [measuredFps, setMeasuredFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())

  // History canvases for frame blending buffer
  const historyCanvasesRef = useRef<HTMLCanvasElement[]>([])

  // Initialize history canvases
  useEffect(() => {
    const list: HTMLCanvasElement[] = []
    for (let i = 0; i < 8; i++) {
      const c = document.createElement('canvas')
      list.push(c)
    }
    historyCanvasesRef.current = list
  }, [])

  // Sync canvas size with video resolution
  const updateCanvasDimensions = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    historyCanvasesRef.current.forEach((c) => {
      c.width = video.videoWidth
      c.height = video.videoHeight
    })
  }, [])

  // Handle Video Metadata loaded
  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return

    setDuration(video.duration || 0)
    updateCanvasDimensions()

    if (onVideoLoaded && video.videoWidth && video.videoHeight) {
      onVideoLoaded({
        name: 'video',
        size: 0,
        type: 'video/mp4',
        duration: video.duration || 0,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
      })
    }
  }

  // Main Render Loop (runs continuously via requestAnimationFrame)
  useEffect(() => {
    let animId: number
    const video = videoRef.current
    const canvas = canvasRef.current

    const render = () => {
      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const w = canvas.width
          const h = canvas.height

          // FPS measurement
          frameCountRef.current++
          const now = performance.now()
          if (now - lastFpsTimeRef.current >= 500) {
            const currentFps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current))
            setMeasuredFps(currentFps)
            frameCountRef.current = 0
            lastFpsTimeRef.current = now
          }

          // If video is playing or seeked, update history canvas buffer
          if (!video.paused && !video.ended) {
            const list = historyCanvasesRef.current
            // Shift history
            for (let i = list.length - 1; i > 0; i--) {
              const destCtx = list[i].getContext('2d')
              if (destCtx) {
                destCtx.clearRect(0, 0, w, h)
                destCtx.drawImage(list[i - 1], 0, 0)
              }
            }
            // Put current frame in history[0]
            const firstCtx = list[0].getContext('2d')
            if (firstCtx) {
              firstCtx.clearRect(0, 0, w, h)
              firstCtx.drawImage(video, 0, 0, w, h)
            }
          }

          // Render output based on view mode
          ctx.clearRect(0, 0, w, h)

          if (viewMode === 'original') {
            // Raw frame only
            ctx.filter = 'none'
            ctx.globalAlpha = 1.0
            ctx.drawImage(video, 0, 0, w, h)
          } else if (viewMode === 'smoothed') {
            // Full smoothed frame
            applyFrameEffects(ctx, video, w, h, smoothSettings, historyCanvasesRef.current)
          } else if (viewMode === 'split') {
            // Split-screen comparison: Left = Original, Right = Smoothed
            const splitX = Math.round((splitPosition / 100) * w)

            // 1. Draw smoothed on whole canvas
            applyFrameEffects(ctx, video, w, h, smoothSettings, historyCanvasesRef.current)

            // 2. Draw raw video on left side using clipping
            ctx.save()
            ctx.beginPath()
            ctx.rect(0, 0, splitX, h)
            ctx.clip()
            ctx.filter = 'none'
            ctx.globalAlpha = 1.0
            ctx.drawImage(video, 0, 0, w, h)
            ctx.restore()

            // 3. Draw divider line
            ctx.beginPath()
            ctx.moveTo(splitX, 0)
            ctx.lineTo(splitX, h)
            ctx.strokeStyle = '#a855f7'
            ctx.lineWidth = 3
            ctx.shadowColor = '#c084fc'
            ctx.shadowBlur = 10
            ctx.stroke()
            ctx.shadowBlur = 0
          }
        }
      }
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [viewMode, splitPosition, smoothSettings])

  // Playback control handlers
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(console.warn)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setCurrentTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const stepFrame = (frames: number) => {
    if (!videoRef.current) return
    const step = frames * (1 / 30) // assume ~30fps step
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + step))
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) {
      videoRef.current.volume = val
      videoRef.current.muted = val === 0
      setIsMuted(val === 0)
    }
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const ms = Math.floor((secs % 1) * 10)
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`
  }

  // Handle Split slider drag in UI
  const handleSplitMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSplit || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSplitPosition(percentage)
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col w-full h-full bg-[#0b0d14] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl"
      onMouseMove={handleSplitMouseMove}
      onMouseUp={() => setIsDraggingSplit(false)}
    >
      {/* Hidden underlying native HTML5 video */}
      <video
        ref={videoRef}
        src={videoUrl}
        loop={isLooping}
        muted={isMuted}
        playsInline
        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Top Header HUD overlay inside video player */}
      <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 z-20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pointer-events-none">
        {/* Real-time stats badges */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[11px] sm:text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>{measuredFps || 60} FPS</span>
          </div>

          {metadata && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-xs text-slate-300 font-mono">
              <span>{metadata.width}×{metadata.height}</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2 sm:py-1 rounded-md bg-violet-950/70 backdrop-blur-md border border-violet-500/40 text-[10px] sm:text-[11px] font-medium text-violet-300">
            <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
            <span>Smooth: {smoothSettings.intensity}%</span>
          </div>
        </div>

        {/* View mode toggle pills */}
        <div className="flex items-center p-0.5 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 pointer-events-auto text-[11px] sm:text-xs shrink-0">
          <button
            onClick={() => setViewMode('smoothed')}
            className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'smoothed'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.viewSmoothed}
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 sm:px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'split'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SplitSquareVertical className="w-3 h-3 shrink-0" />
            <span>{t.viewSplit}</span>
          </button>
          <button
            onClick={() => setViewMode('original')}
            className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'original'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.viewOriginal}
          </button>
        </div>
      </div>

      {/* Main Video Viewport (Rendered via Canvas) */}
      <div
        className="relative flex-1 flex items-center justify-center p-3 sm:p-6 min-h-[340px] lg:min-h-[460px] cursor-pointer select-none overflow-hidden"
        onClick={togglePlay}
      >
        <canvas
          ref={canvasRef}
          className="max-h-[68vh] max-w-full w-auto h-auto rounded-lg shadow-2xl object-contain ring-1 ring-white/10"
        />

        {/* Split view handle tag */}
        {viewMode === 'split' && (
          <div
            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-auto cursor-ew-resize group"
            style={{ left: `${splitPosition}%` }}
            onMouseDown={() => setIsDraggingSplit(true)}
          >
            <div className="w-7 h-7 rounded-full bg-violet-600 border-2 border-white shadow-lg flex items-center justify-center text-white -ml-3.5 group-hover:scale-110 transition-transform">
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </div>
            <div className="mt-2 -ml-8 px-2 py-0.5 rounded bg-black/80 text-[10px] text-white font-mono pointer-events-none">
              {t.dragToCompare}
            </div>
          </div>
        )}

        {/* Center Play Button Overlay when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/25 backdrop-blur-[2px] transition-all">
            <div className="w-16 h-16 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white flex items-center justify-center shadow-xl shadow-violet-600/40 ring-4 ring-white/20 transition-transform hover:scale-110">
              <Play className="w-7 h-7 ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Transport Player Controls */}
      <div className="p-3 sm:p-4 bg-[#0e1018]/95 border-t border-white/[0.08] backdrop-blur-md flex flex-col gap-2.5 z-20">
        {/* Timeline Scrubber */}
        <div className="relative group w-full flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
        </div>

        {/* Control bar: Play/Pause, Frame step, Time, Volume, Fullscreen */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 text-slate-300">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-md shadow-violet-600/30 cursor-pointer"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Frame step backward */}
            <button
              onClick={() => stepFrame(-1)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer hidden sm:block"
              title={t.stepBack}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Frame step forward */}
            <button
              onClick={() => stepFrame(1)}
              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer hidden sm:block"
              title={t.stepForward}
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Time readout */}
            <div className="text-xs font-mono text-slate-300 select-none pl-1">
              <span className="text-white font-semibold">{formatTime(currentTime)}</span>
              <span className="text-slate-500"> / {formatTime(duration)}</span>
            </div>
          </div>

          {/* Right utility controls */}
          <div className="flex items-center gap-3">
            {/* Volume control */}
            <div className="flex items-center gap-1.5 group">
              <button
                onClick={toggleMute}
                className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-300 hidden sm:block"
              />
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isLooping
                  ? 'bg-violet-950/50 text-violet-300 border-violet-500/30'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
              title="Loop playback"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
