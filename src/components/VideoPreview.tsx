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
  Scissors,
  Crop,
  ChevronUp,
  ChevronDown,
  Monitor,
  Smartphone,
  Square,
} from 'lucide-react'
import { SmoothSettings, TimeBlock, TrimRange, VideoMetadata, VideoTransformSettings } from '../types'
import {
  applyFrameEffects,
  calculateTargetDimensions,
  calculateTransformRect,
} from '../utils/videoProcessor'
import { Language, translations } from '../utils/i18n'
import { TimelineTrimmer } from './TimelineTrimmer'
import { PanelTab } from './ControlPanel'

interface VideoPreviewProps {
  videoUrl: string
  metadata: VideoMetadata | null
  smoothSettings: SmoothSettings
  onVideoLoaded?: (meta: VideoMetadata) => void
  trimRange: TrimRange
  onTrimChange: (range: TrimRange) => void
  timeBlocks?: TimeBlock[]
  onTimeBlocksChange?: (blocks: TimeBlock[]) => void
  transformSettings: VideoTransformSettings
  onTransformChange: (settings: VideoTransformSettings) => void
  currentTime?: number
  onCurrentTimeChange?: (time: number) => void
  isPlaying?: boolean
  onIsPlayingChange?: (isPlaying: boolean) => void
  seekTime?: number | null
  togglePlayTrigger?: number
  showTrimmerInPlayer?: boolean
  activeTab?: PanelTab
  lang: Language
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoUrl,
  metadata,
  smoothSettings,
  onVideoLoaded,
  trimRange,
  onTrimChange,
  timeBlocks,
  onTimeBlocksChange,
  transformSettings,
  onTransformChange,
  currentTime: externalCurrentTime,
  onCurrentTimeChange,
  isPlaying: externalIsPlaying,
  onIsPlayingChange,
  seekTime,
  togglePlayTrigger,
  showTrimmerInPlayer = false,
  activeTab = 'trim',
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

  // Mobile Sticky Mini / Compact Mode
  const [isMobileCompact, setIsMobileCompact] = useState(false)
  const [showTrimmer, setShowTrimmer] = useState(true)

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

  // Sync canvas size with video resolution & transform aspect ratio
  const updateCanvasDimensions = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    const dims = calculateTargetDimensions(
      video.videoWidth,
      video.videoHeight,
      'original',
      transformSettings.aspectRatio
    )

    canvas.width = dims.width
    canvas.height = dims.height

    historyCanvasesRef.current.forEach((c) => {
      c.width = dims.width
      c.height = dims.height
    })
  }, [transformSettings.aspectRatio])

  // Handle Video Metadata loaded
  const handleLoadedMetadata = () => {
    const video = videoRef.current
    if (!video) return

    const dur = video.duration || 0
    setDuration(dur)
    video.playbackRate = smoothSettings.playbackSpeed || 1.0

    // Initialize trim range if not set
    if (trimRange.end === 0 || trimRange.end > dur) {
      onTrimChange({ start: 0, end: dur })
    }

    updateCanvasDimensions()

    if (onVideoLoaded && video.videoWidth && video.videoHeight) {
      onVideoLoaded({
        name: 'video',
        size: 0,
        type: 'video/mp4',
        duration: dur,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
      })
    }
  }

  // Update canvas dimensions when aspect ratio changes
  useEffect(() => {
    updateCanvasDimensions()
  }, [updateCanvasDimensions, transformSettings.aspectRatio])

  // Sync playback rate whenever smoothSettings.playbackSpeed changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = smoothSettings.playbackSpeed || 1.0
    }
  }, [smoothSettings.playbackSpeed])

  // External seek trigger
  useEffect(() => {
    if (seekTime !== undefined && seekTime !== null && videoRef.current) {
      videoRef.current.currentTime = seekTime
      setCurrentTime(seekTime)
      onCurrentTimeChange?.(seekTime)
    }
  }, [seekTime])

  // External toggle play trigger
  useEffect(() => {
    if (togglePlayTrigger && togglePlayTrigger > 0) {
      togglePlay()
    }
  }, [togglePlayTrigger])

  // Enforce trim range and multi-segment loop on time update
  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    const cur = video.currentTime
    setCurrentTime(cur)
    onCurrentTimeChange?.(cur)

    if (timeBlocks && timeBlocks.length > 0) {
      const inBlock = timeBlocks.find((b) => cur >= b.start && cur < b.end)
      if (!inBlock) {
        // Playhead is in a cut out gap or outside
        const nextBlock = timeBlocks.find((b) => b.start >= cur)
        if (nextBlock) {
          video.currentTime = nextBlock.start
        } else {
          // Reached end of all active blocks
          if (isLooping) {
            video.currentTime = timeBlocks[0].start
          } else {
            video.pause()
            setIsPlaying(false)
            onIsPlayingChange?.(false)
          }
        }
      }
    } else if (trimRange.end > 0) {
      if (cur < trimRange.start) {
        video.currentTime = trimRange.start
      } else if (cur >= trimRange.end) {
        if (isLooping) {
          video.currentTime = trimRange.start
        } else {
          video.pause()
          setIsPlaying(false)
          onIsPlayingChange?.(false)
        }
      }
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
            const currentFps = Math.round(
              (frameCountRef.current * 1000) / (now - lastFpsTimeRef.current)
            )
            setMeasuredFps(currentFps)
            frameCountRef.current = 0
            lastFpsTimeRef.current = now
          }

          // Find current block for per-cut settings
          const curTime = video.currentTime
          const curBlock = timeBlocks?.find((b) => curTime >= b.start && curTime <= b.end)
          const activeSmooth = curBlock?.smoothSettings || smoothSettings
          const activeTransform = curBlock?.transformSettings || transformSettings

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
            // Put current transformed frame in history[0]
            const firstCtx = list[0].getContext('2d')
            if (firstCtx) {
              const rect = calculateTransformRect(
                video.videoWidth || w,
                video.videoHeight || h,
                w,
                h,
                activeTransform.fitMode,
                activeTransform.zoom,
                activeTransform.panX,
                activeTransform.panY
              )
              firstCtx.fillStyle = '#000000'
              firstCtx.fillRect(0, 0, w, h)
              firstCtx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
            }
          }

          // Render output based on view mode
          ctx.clearRect(0, 0, w, h)

          if (viewMode === 'original') {
            // Raw frame only with transform
            const rect = calculateTransformRect(
              video.videoWidth || w,
              video.videoHeight || h,
              w,
              h,
              activeTransform.fitMode,
              activeTransform.zoom,
              activeTransform.panX,
              activeTransform.panY
            )
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, w, h)
            ctx.filter = 'none'
            ctx.globalAlpha = 1.0
            ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
          } else if (viewMode === 'smoothed') {
            // Full smoothed frame with per-cut settings
            applyFrameEffects(
              ctx,
              video,
              w,
              h,
              activeSmooth,
              historyCanvasesRef.current,
              activeTransform
            )
          } else if (viewMode === 'split') {
            // Split-screen comparison: Left = Original, Right = Smoothed
            const splitX = Math.round((splitPosition / 100) * w)

            // 1. Draw smoothed on whole canvas
            applyFrameEffects(
              ctx,
              video,
              w,
              h,
              activeSmooth,
              historyCanvasesRef.current,
              activeTransform
            )

            // 2. Draw raw video on left side using clipping
            ctx.save()
            ctx.beginPath()
            ctx.rect(0, 0, splitX, h)
            ctx.clip()
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, splitX, h)
            ctx.filter = 'none'
            ctx.globalAlpha = 1.0
            const rect = calculateTransformRect(
              video.videoWidth || w,
              video.videoHeight || h,
              w,
              h,
              activeTransform.fitMode,
              activeTransform.zoom,
              activeTransform.panX,
              activeTransform.panY
            )
            ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
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
  }, [viewMode, splitPosition, smoothSettings, transformSettings, timeBlocks])

  // Playback control handlers
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      if (timeBlocks && timeBlocks.length > 0) {
        const lastBlock = timeBlocks[timeBlocks.length - 1]
        if (currentTime >= lastBlock.end) {
          video.currentTime = timeBlocks[0].start
        }
      } else if (currentTime >= trimRange.end && trimRange.end > 0) {
        video.currentTime = trimRange.start
      }
      video
        .play()
        .then(() => {
          setIsPlaying(true)
          onIsPlayingChange?.(true)
        })
        .catch(console.warn)
    } else {
      video.pause()
      setIsPlaying(false)
      onIsPlayingChange?.(false)
    }
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
    onCurrentTimeChange?.(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const stepFrame = (frames: number) => {
    if (!videoRef.current) return
    const step = frames * (1 / 30)
    const target = Math.max(
      trimRange.start,
      Math.min(trimRange.end || duration, videoRef.current.currentTime + step)
    )
    videoRef.current.currentTime = target
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

  // Current active block for per-cut transform
  const currentActiveBlock = timeBlocks?.find((b) => currentTime >= b.start && currentTime <= b.end)
  const activeTransform = currentActiveBlock?.transformSettings || transformSettings

  // Pan & Zoom mode is only active when user is in the Export/Crop/Pan tab
  const isCropPanTabActive = activeTab === 'export'

  // Handle Split slider drag (desktop mouse & mobile touch)
  const handleSplitMove = useCallback((clientX: number) => {
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSplitPosition(percentage)
  }, [])

  // Window listeners for Split comparison drag (supporting both mouse and touch for mobile)
  useEffect(() => {
    if (!isDraggingSplit) return

    const onMouseMove = (e: MouseEvent) => {
      handleSplitMove(e.clientX)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        if (e.cancelable) e.preventDefault()
        handleSplitMove(e.touches[0].clientX)
      }
    }

    const onEnd = () => {
      setIsDraggingSplit(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [isDraggingSplit, handleSplitMove])

  // Manual Pan & Drag Position state
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ clientX: number; clientY: number; startPanX: number; startPanY: number }>({
    clientX: 0,
    clientY: 0,
    startPanX: 0,
    startPanY: 0,
  })
  const hasDraggedCanvasRef = useRef(false)
  // Tracks the active pointerId for pointer capture / pan drag
  const activePanPointerIdRef = useRef<number | null>(null)

  const handleCanvasPointerDown = (clientX: number, clientY: number) => {
    // In split comparison mode: canvas clicks do nothing (slider handles the interaction)
    if (viewMode === 'split') return

    // In Crop/Pan tab: start pan drag
    if (isCropPanTabActive) {
      setIsPanning(true)
      hasDraggedCanvasRef.current = false
      panStartRef.current = {
        clientX,
        clientY,
        startPanX: activeTransform.panX || 0,
        startPanY: activeTransform.panY || 0,
      }
      return
    }

    // Normal mode: immediately toggle Play/Pause
    togglePlay()
  }

  const handleCanvasPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isPanning || !canvasRef.current || !isCropPanTabActive) return
      const deltaX = clientX - panStartRef.current.clientX
      const deltaY = clientY - panStartRef.current.clientY

      if (Math.hypot(deltaX, deltaY) > 4) {
        hasDraggedCanvasRef.current = true
      }

      if (hasDraggedCanvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const pctX = (deltaX / (rect.width / 2)) * 100
        const pctY = (deltaY / (rect.height / 2)) * 100

        const newPanX = Math.round(Math.max(-100, Math.min(100, panStartRef.current.startPanX + pctX)))
        const newPanY = Math.round(Math.max(-100, Math.min(100, panStartRef.current.startPanY + pctY)))

        onTransformChange({
          ...activeTransform,
          panX: newPanX,
          panY: newPanY,
        })
      }
    },
    [isPanning, isCropPanTabActive, activeTransform, onTransformChange]
  )

  const handleCanvasPointerUp = () => {
    if (isPanning) {
      if (!hasDraggedCanvasRef.current) {
        togglePlay()
      }
      setIsPanning(false)
      activePanPointerIdRef.current = null
    }
  }

  // Global pointer move & up for smooth pan drag outside viewport
  // Uses Pointer Events API (pointermove/pointerup) — fires ONCE per interaction
  // regardless of mouse or touch, eliminating the ghost-click / double-trigger bug.
  useEffect(() => {
    if (!isPanning) return

    const onMove = (e: PointerEvent) => {
      if (activePanPointerIdRef.current !== null && e.pointerId !== activePanPointerIdRef.current) return
      handleCanvasPointerMove(e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      if (activePanPointerIdRef.current !== null && e.pointerId !== activePanPointerIdRef.current) return
      handleCanvasPointerUp()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isPanning, handleCanvasPointerMove])

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full bg-[#0b0d14] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl transition-all ${
        isMobileCompact ? 'p-2' : ''
      }`}
    >
      {/* Hidden underlying native HTML5 video */}
      <video
        ref={videoRef}
        src={videoUrl}
        loop={false}
        muted={isMuted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* MOBILE COMPACT STICKY BAR: Visible only on mobile when user toggles compact mode */}
      {isMobileCompact ? (
        <div className="flex items-center justify-between gap-2 py-1 px-2 bg-[#10121d] rounded-xl border border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-violet-600 text-white cursor-pointer shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Time readout & stats */}
            <div className="min-w-0 text-xs font-mono">
              <div className="text-white font-bold truncate">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <div className="text-[10px] text-cyan-400 flex items-center gap-1.5 truncate">
                <span>{measuredFps || 60} FPS</span>
                <span>•</span>
                <span>Smooth {smoothSettings.intensity}%</span>
                {transformSettings.aspectRatio !== 'original' && (
                  <>
                    <span>•</span>
                    <span className="text-violet-300">{transformSettings.aspectRatio}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMobileCompact(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-semibold cursor-pointer"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span>{t.expandPlayer}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Header HUD overlay inside video player */}
          <div className="relative z-20 flex flex-wrap items-center justify-between gap-1.5 p-2 sm:p-3 bg-black/60 backdrop-blur-md border-b border-white/[0.06]">
            {/* Real-time stats badges */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[10px] sm:text-xs text-slate-300 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <span>{measuredFps || 60} FPS</span>
              </div>

              {/* Aspect Ratio Badge */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[10px] sm:text-xs text-slate-300 font-mono">
                <Crop className="w-3 h-3 text-cyan-400" />
                <span>
                  {transformSettings.aspectRatio === 'original'
                    ? `${metadata?.width || 1920}×${metadata?.height || 1080}`
                    : transformSettings.aspectRatio}
                </span>
              </div>

              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-950/70 border border-violet-500/40 text-[10px] sm:text-[11px] font-medium text-violet-300">
                <Sparkles className="w-3 h-3 text-violet-400 shrink-0" />
                <span>Smooth: {smoothSettings.intensity}%</span>
              </div>

              {smoothSettings.playbackSpeed && smoothSettings.playbackSpeed < 1.0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-500/40 text-[10px] sm:text-[11px] font-medium text-cyan-300 font-mono">
                  <span>🐌</span>
                  <span>{smoothSettings.playbackSpeed}x</span>
                </div>
              )}
            </div>

            {/* View mode toggle pills & Mobile Collapse toggle */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center p-0.5 rounded-lg bg-black/75 border border-white/10 text-[10px] sm:text-xs shrink-0">
                <button
                  onClick={() => setViewMode('smoothed')}
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'smoothed'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.viewSmoothed}
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'split'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <SplitSquareVertical className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">{t.viewSplit}</span>
                </button>
                <button
                  onClick={() => setViewMode('original')}
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    viewMode === 'original'
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.viewOriginal}
                </button>
              </div>

              {/* Mobile Collapse Button (Only on Mobile) */}
              <button
                onClick={() => setIsMobileCompact(true)}
                className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-[10px] cursor-pointer"
                title={t.collapsePlayer}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Video Viewport (Rendered via Canvas) */}
          <div
            className={`relative flex-1 flex items-center justify-center p-2 sm:p-4 min-h-[220px] max-h-[36vh] sm:max-h-[46vh] lg:min-h-[380px] lg:max-h-[62vh] select-none overflow-hidden bg-black/40 touch-none ${
              viewMode === 'split'
                ? 'cursor-default'
                : isCropPanTabActive
                  ? isPanning ? 'cursor-grabbing' : 'cursor-crosshair'
                  : 'cursor-pointer'
            }`}
            onPointerDown={(e) => {
              // Ignore secondary pointers (multi-touch) and UI overlay clicks
              if (e.isPrimary === false) return
              if ((e.target as HTMLElement).closest('.pointer-events-auto')) return
              activePanPointerIdRef.current = e.pointerId
              handleCanvasPointerDown(e.clientX, e.clientY)
            }}
          >
            <canvas
              ref={canvasRef}
              className={`max-h-[34vh] sm:max-h-[44vh] lg:max-h-[60vh] max-w-full w-auto h-auto rounded-lg shadow-2xl object-contain ring-1 transition-shadow ${
                isPanning ? 'ring-2 ring-amber-400 shadow-amber-500/20' : 'ring-white/10'
              }`}
            />

            {/* Active Pan Position Badge overlay — only visible in Crop/Pan tab */}
            {isCropPanTabActive && (isPanning || (activeTransform.panX && activeTransform.panX !== 0) || (activeTransform.panY && activeTransform.panY !== 0) || (activeTransform.zoom && activeTransform.zoom > 1)) && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-amber-400/50 text-[10px] font-mono text-amber-200 pointer-events-none flex items-center gap-1.5 shadow-lg z-30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                <span>Pan: X {activeTransform.panX || 0}% | Y {activeTransform.panY || 0}%</span>
                {activeTransform.zoom && activeTransform.zoom > 1 && (
                  <span>• Zoom {Math.round(activeTransform.zoom * 100)}%</span>
                )}
              </div>
            )}

            {/* Crop/Pan mode hint — shown in export tab when no pan applied yet */}
            {isCropPanTabActive && !isPanning && activeTransform.panX === 0 && activeTransform.panY === 0 && (!activeTransform.zoom || activeTransform.zoom <= 1) && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-cyan-500/40 text-[10px] font-medium text-cyan-300 pointer-events-none flex items-center gap-1.5 shadow-lg z-30">
                <span>🖐 ลากเพื่อปรับตำแหน่ง Pan</span>
              </div>
            )}

            {/* Split view handle — supports both mouse and touch drag */}
            {viewMode === 'split' && (
              <div
                className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-auto cursor-ew-resize group z-20"
                style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}
                onMouseDown={(e) => { e.stopPropagation(); setIsDraggingSplit(true) }}
                onTouchStart={(e) => { e.stopPropagation(); setIsDraggingSplit(true) }}
              >
                {/* Divider line */}
                <div className="w-0.5 flex-1 bg-violet-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                {/* Handle knob */}
                <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-violet-600 border-2 border-white shadow-lg flex items-center justify-center text-white group-hover:scale-110 active:scale-95 transition-transform">
                  <SplitSquareVertical className="w-4 h-4" />
                </div>
              </div>
            )}

            {/* Center Play Button Overlay when paused — hidden in split comparison mode */}
            {!isPlaying && !isPanning && !hasDraggedCanvasRef.current && viewMode !== 'split' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/25 backdrop-blur-[1px] transition-all">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white flex items-center justify-center shadow-xl shadow-violet-600/40 ring-4 ring-white/20 transition-transform hover:scale-110">
                  <Play className="w-5 h-5 sm:w-7 sm:h-7 ml-0.5" />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Player Controls & Integrated Interactive Trimmer */}
          <div className="p-2 sm:p-3 bg-[#0e1018]/95 border-t border-white/[0.08] backdrop-blur-md flex flex-col gap-2 z-20">
            {/* Interactive Timeline Trimmer Bar (optional in player) */}
            {showTrimmerInPlayer && (
              <TimelineTrimmer
                duration={duration}
                currentTime={currentTime}
                timeBlocks={timeBlocks}
                onTimeBlocksChange={onTimeBlocksChange}
                trimRange={trimRange}
                onTrimChange={onTrimChange}
                onSeek={handleSeek}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                lang={lang}
              />
            )}

            {/* Control bar: Play/Pause, Frame step, Time, Volume, Fullscreen */}
            <div className="flex items-center justify-between gap-2 text-slate-300 pt-1">
              <div className="flex items-center gap-1.5 sm:gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="p-1.5 sm:p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-md shadow-violet-600/30 cursor-pointer"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
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
                <div className="text-[11px] sm:text-xs font-mono text-slate-300 select-none pl-1">
                  <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                  <span className="text-slate-500"> / {formatTime(duration)}</span>
                </div>
              </div>

              {/* Right utility controls */}
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                {/* Aspect Ratio Quick Toggle */}
                <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-white/10 text-[10px] sm:text-[11px]">
                  {(['original', '16:9', '9:16', '1:1'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() =>
                        onTransformChange({
                          ...transformSettings,
                          aspectRatio: r,
                        })
                      }
                      className={`px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                        transformSettings.aspectRatio === r
                          ? 'bg-violet-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {r === 'original' ? 'Orig' : r}
                    </button>
                  ))}
                </div>

                {/* Volume control */}
                <div className="flex items-center gap-1 group">
                  <button
                    onClick={toggleMute}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                    className="w-12 sm:w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-300 hidden md:block"
                  />
                </div>

                {/* Loop Toggle */}
                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
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
                  className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
