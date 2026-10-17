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
  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const [activeVideoKey, setActiveVideoKey] = useState<'A' | 'B'>('A')
  const activeVideoKeyRef = useRef<'A' | 'B'>('A')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Buffer canvas to hold the last valid rendered frame during seeks/buffering (prevents black screen)
  const lastValidFrameCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pendingSeekTimeRef = useRef<number | null>(null)
  const preloadedClipIndexRef = useRef<number>(-1)

  const getActiveVideo = useCallback((): HTMLVideoElement | null => {
    return activeVideoKeyRef.current === 'A' ? videoARef.current : videoBRef.current
  }, [])

  const getStandbyVideo = useCallback((): HTMLVideoElement | null => {
    return activeVideoKeyRef.current === 'A' ? videoBRef.current : videoARef.current
  }, [])

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

  // Active independent clip index for sequential multi-segment playback
  const activeClipIndexRef = useRef<number>(0)

  // Decoder readiness flags to prevent black-screen preview on mobile
  const [isVideoReady, setIsVideoReady] = useState(false)
  const isVideoReadyRef = useRef(false)
  const hasRenderedFirstFrameRef = useRef(false)

  // *** MOBILE FIX: Mirror props into refs so render loop always reads latest value ***
  // This prevents stale closures in the RAF loop when settings change during drag
  const smoothSettingsRef = useRef<SmoothSettings>(smoothSettings)
  const transformSettingsRef = useRef<VideoTransformSettings>(transformSettings)
  const timeBlocksRef = useRef<typeof timeBlocks>(timeBlocks)
  const viewModeRef = useRef<'smoothed' | 'split' | 'original'>('smoothed')
  const splitPositionRef = useRef<number>(50)
  const isMutedRef = useRef<boolean>(false)
  // Version counter: incremented whenever settings change while paused → forces one extra render frame
  const settingsVersionRef = useRef<number>(0)

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
    const video = getActiveVideo() || videoARef.current || videoBRef.current
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

    if (lastValidFrameCanvasRef.current) {
      lastValidFrameCanvasRef.current.width = dims.width
      lastValidFrameCanvasRef.current.height = dims.height
    }

    historyCanvasesRef.current.forEach((c) => {
      c.width = dims.width
      c.height = dims.height
    })
  }, [getActiveVideo, transformSettings.aspectRatio])

  // Core drawing routine: renders the active video frame to canvasRef with effects & transforms
  const forceDrawFrame = useCallback(() => {
    const activeVideo = getActiveVideo()
    const canvas = canvasRef.current
    if (!activeVideo || !canvas) return

    // Mobile safety check: readyState must be >= HAVE_CURRENT_DATA (2)
    if (activeVideo.readyState < 2) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    if (w === 0 || h === 0) return

    const currentTimeBlocks = timeBlocksRef.current
    const currentSmSettings = smoothSettingsRef.current
    const currentTrSettings = transformSettingsRef.current
    const currentViewMode = viewModeRef.current
    const currentSplitPos = splitPositionRef.current

    const curBlock =
      currentTimeBlocks && currentTimeBlocks.length > 0
        ? currentTimeBlocks[activeClipIndexRef.current] || currentTimeBlocks[0]
        : null
    const activeSmooth = curBlock?.smoothSettings || currentSmSettings
    const activeTransform = curBlock?.transformSettings || currentTrSettings

    ctx.clearRect(0, 0, w, h)

    if (currentViewMode === 'original') {
      const rect = calculateTransformRect(
        activeVideo.videoWidth || w,
        activeVideo.videoHeight || h,
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
      ctx.drawImage(activeVideo, rect.dx, rect.dy, rect.dw, rect.dh)
    } else if (currentViewMode === 'smoothed') {
      applyFrameEffects(
        ctx,
        activeVideo,
        w,
        h,
        activeSmooth,
        historyCanvasesRef.current,
        activeTransform
      )
    } else if (currentViewMode === 'split') {
      const splitX = Math.round((currentSplitPos / 100) * w)
      applyFrameEffects(
        ctx,
        activeVideo,
        w,
        h,
        activeSmooth,
        historyCanvasesRef.current,
        activeTransform
      )

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, splitX, h)
      ctx.clip()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, splitX, h)
      ctx.filter = 'none'
      ctx.globalAlpha = 1.0
      const rect = calculateTransformRect(
        activeVideo.videoWidth || w,
        activeVideo.videoHeight || h,
        w,
        h,
        activeTransform.fitMode,
        activeTransform.zoom,
        activeTransform.panX,
        activeTransform.panY
      )
      ctx.drawImage(activeVideo, rect.dx, rect.dy, rect.dw, rect.dh)
      ctx.restore()

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

    // Cache valid frame (Prevents black screen on seeks)
    if (lastValidFrameCanvasRef.current) {
      const lgCtx = lastValidFrameCanvasRef.current.getContext('2d')
      if (lgCtx) {
        lgCtx.clearRect(0, 0, w, h)
        lgCtx.drawImage(canvas, 0, 0)
      }
    }

    hasRenderedFirstFrameRef.current = true
  }, [getActiveVideo])

  // Handles loadeddata and canplay events: only unlocks canvas loop once frames are truly decoded
  const handleVideoReady = useCallback(
    (key: 'A' | 'B') => {
      const activeKey = activeVideoKeyRef.current
      if (key !== activeKey) return

      const video = key === 'A' ? videoARef.current : videoBRef.current
      if (!video) return

      if (video.readyState >= 2) {
        isVideoReadyRef.current = true
        setIsVideoReady(true)
        updateCanvasDimensions()
        forceDrawFrame()
      }
    },
    [updateCanvasDimensions, forceDrawFrame]
  )

  // Preload standby video buffer for the target clip (Zero-latency transition preparation)
  const preloadStandbyVideoForClip = useCallback(
    (clipIndex: number) => {
      if (!timeBlocks || clipIndex >= timeBlocks.length || clipIndex < 0) return
      const standbyVideo = getStandbyVideo()
      if (!standbyVideo) return

      const nextClip = timeBlocks[clipIndex]
      if (
        preloadedClipIndexRef.current === clipIndex &&
        Math.abs(standbyVideo.currentTime - nextClip.start) < 0.1
      ) {
        return // Already preloaded at this exact time
      }

      preloadedClipIndexRef.current = clipIndex
      standbyVideo.muted = true
      standbyVideo.playbackRate =
        nextClip.smoothSettings?.playbackSpeed || smoothSettings.playbackSpeed || 1.0

      if ('fastSeek' in standbyVideo && typeof (standbyVideo as any).fastSeek === 'function') {
        try {
          ;(standbyVideo as any).fastSeek(nextClip.start)
        } catch {
          standbyVideo.currentTime = nextClip.start
        }
      } else {
        standbyVideo.currentTime = nextClip.start
      }
      standbyVideo.pause()
    },
    [timeBlocks, getStandbyVideo, smoothSettings.playbackSpeed]
  )

  // Handle Video Metadata loaded
  const handleLoadedMetadata = () => {
    const video = getActiveVideo() || videoARef.current
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

    // If readyState is already >= 2 (HAVE_CURRENT_DATA), draw initial frame immediately
    if (video.readyState >= 2) {
      isVideoReadyRef.current = true
      setIsVideoReady(true)
      forceDrawFrame()
    }

    if (timeBlocks && timeBlocks.length > 1) {
      preloadStandbyVideoForClip(1)
    }
  }

  // Keep refs in sync with latest props on every render (critical for mobile RAF loop)
  // Sync ALL state-derived refs every render (critical: makes RAF loop always see latest values)
  smoothSettingsRef.current = smoothSettings
  transformSettingsRef.current = transformSettings
  timeBlocksRef.current = timeBlocks
  viewModeRef.current = viewMode
  splitPositionRef.current = splitPosition
  isMutedRef.current = isMuted

  // Update canvas dimensions when aspect ratio changes
  useEffect(() => {
    updateCanvasDimensions()
  }, [updateCanvasDimensions, transformSettings.aspectRatio])

  // Sync playback rate to both video elements whenever smoothSettings.playbackSpeed changes
  useEffect(() => {
    const rate = smoothSettings.playbackSpeed || 1.0
    if (videoARef.current) videoARef.current.playbackRate = rate
    if (videoBRef.current) videoBRef.current.playbackRate = rate
  }, [smoothSettings.playbackSpeed])

  // When settings change while paused → bump version so RAF renders one extra frame
  useEffect(() => {
    settingsVersionRef.current += 1
  }, [smoothSettings, transformSettings])

  // Perform seek on the active video safely with fastSeek & queueing
  const performVideoSeek = useCallback(
    (targetTime: number) => {
      const activeVideo = getActiveVideo()
      if (!activeVideo) return

      if (activeVideo.seeking) {
        pendingSeekTimeRef.current = targetTime
        return
      }

      if ('fastSeek' in activeVideo && typeof (activeVideo as any).fastSeek === 'function') {
        try {
          ;(activeVideo as any).fastSeek(targetTime)
        } catch {
          activeVideo.currentTime = targetTime
        }
      } else {
        activeVideo.currentTime = targetTime
      }
    },
    [getActiveVideo]
  )

  // Handle seeked event on video element: dispatch queued seeks & refresh history buffers
  const handleVideoSeeked = useCallback(() => {
    const activeVideo = getActiveVideo()
    if (!activeVideo) return

    if (pendingSeekTimeRef.current !== null) {
      const nextTime = pendingSeekTimeRef.current
      pendingSeekTimeRef.current = null
      performVideoSeek(nextTime)
      return
    }

    // Refresh history canvases so motion blur doesn't blend black frames from seek
    if (historyCanvasesRef.current.length > 0 && activeVideo.videoWidth) {
      const w = canvasRef.current?.width || activeVideo.videoWidth || 1920
      const h = canvasRef.current?.height || activeVideo.videoHeight || 1080
      const curBlock =
        timeBlocks && timeBlocks.length > 0
          ? timeBlocks[activeClipIndexRef.current] || timeBlocks[0]
          : null
      const activeTrans = curBlock?.transformSettings || transformSettings
      const rect = calculateTransformRect(
        activeVideo.videoWidth || w,
        activeVideo.videoHeight || h,
        w,
        h,
        activeTrans.fitMode,
        activeTrans.zoom,
        activeTrans.panX,
        activeTrans.panY
      )
      historyCanvasesRef.current.forEach((c) => {
        const cCtx = c.getContext('2d')
        if (cCtx) {
          cCtx.fillStyle = '#000000'
          cCtx.fillRect(0, 0, w, h)
          try {
            cCtx.drawImage(activeVideo, rect.dx, rect.dy, rect.dw, rect.dh)
          } catch {}
        }
      })
    }

    // Instantly draw seeked frame on mobile canvas while paused
    if (activeVideo.paused) {
      forceDrawFrame()
    }
  }, [getActiveVideo, performVideoSeek, timeBlocks, transformSettings, forceDrawFrame])

  // FORCE VIDEO RELOAD & STREAM RESET ON MOBILE:
  // When a new video is uploaded or Blob URL switches, reset HTML5 video elements,
  // clear canvas buffers, and force mobile browsers to reset the video decoder pipeline.
  useEffect(() => {
    if (!videoUrl) return

    // 1. Reset state & readiness flags
    isVideoReadyRef.current = false
    setIsVideoReady(false)
    hasRenderedFirstFrameRef.current = false
    setIsPlaying(false)
    onIsPlayingChange?.(false)
    setCurrentTime(0)
    onCurrentTimeChange?.(0)
    activeVideoKeyRef.current = 'A'
    setActiveVideoKey('A')
    activeClipIndexRef.current = 0
    preloadedClipIndexRef.current = -1
    pendingSeekTimeRef.current = null

    // 2. Clear canvas context and buffer canvases immediately
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    if (lastValidFrameCanvasRef.current) {
      const lgCtx = lastValidFrameCanvasRef.current.getContext('2d')
      if (lgCtx) {
        lgCtx.clearRect(0, 0, lastValidFrameCanvasRef.current.width, lastValidFrameCanvasRef.current.height)
      }
      lastValidFrameCanvasRef.current.width = 0
      lastValidFrameCanvasRef.current.height = 0
    }
    historyCanvasesRef.current.forEach((c) => {
      const cCtx = c.getContext('2d')
      if (cCtx) {
        cCtx.clearRect(0, 0, c.width, c.height)
      }
    })

    // 3. Force Video Reload & Stream Reset on HTML5 Video Elements
    const videoA = videoARef.current
    const videoB = videoBRef.current

    if (videoA) {
      videoA.pause()
      try {
        videoA.currentTime = 0
      } catch {}
      try {
        // Explicitly reload to initialize decoder with new Blob URL
        videoA.load()
      } catch (e) {
        console.warn('Video A load error:', e)
      }
    }

    if (videoB) {
      videoB.pause()
      try {
        videoB.currentTime = 0
      } catch {}
      try {
        videoB.load()
      } catch (e) {
        console.warn('Video B load error:', e)
      }
    }

    return () => {
      if (videoARef.current) {
        videoARef.current.pause()
      }
      if (videoBRef.current) {
        videoBRef.current.pause()
      }
    }
  }, [videoUrl, onIsPlayingChange, onCurrentTimeChange])

  // External seek trigger
  useEffect(() => {
    if (seekTime !== undefined && seekTime !== null) {
      handleSeek(seekTime)
    }
  }, [seekTime])

  // External toggle play trigger
  useEffect(() => {
    if (togglePlayTrigger && togglePlayTrigger > 0) {
      togglePlay()
    }
  }, [togglePlayTrigger])

  // Handle video timeupdate
  const handleTimeUpdate = () => {
    const video = getActiveVideo()
    if (!video) return
    const cur = video.currentTime
    setCurrentTime(cur)
    onCurrentTimeChange?.(cur)

    if (timeBlocks && timeBlocks.length > 0) {
      const idx = timeBlocks.findIndex((b) => cur >= b.start && cur < b.end)
      if (idx !== -1 && idx !== activeClipIndexRef.current) {
        activeClipIndexRef.current = idx
        if (idx + 1 < timeBlocks.length) {
          preloadStandbyVideoForClip(idx + 1)
        }
      }
    }
  }

  // Main Render Loop (runs continuously via requestAnimationFrame)
  useEffect(() => {
    let animId: number

    const render = () => {
      const activeVideo = getActiveVideo()
      const canvas = canvasRef.current

      if (activeVideo && canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const w = canvas.width
          const h = canvas.height

          // Initialize lastValidFrame buffer if needed
          if (!lastValidFrameCanvasRef.current) {
            lastValidFrameCanvasRef.current = document.createElement('canvas')
          }
          if (
            lastValidFrameCanvasRef.current.width !== w ||
            lastValidFrameCanvasRef.current.height !== h
          ) {
            lastValidFrameCanvasRef.current.width = w
            lastValidFrameCanvasRef.current.height = h
          }

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

          // *** MOBILE FIX: Read latest values from refs — avoids stale closure on mobile ***
          const currentTimeBlocks = timeBlocksRef.current
          const currentSmSettings = smoothSettingsRef.current
          const currentTrSettings = transformSettingsRef.current
          const currentIsMuted = isMutedRef.current

          // Track settings version to force re-draw when paused
          const renderFn = render as any
          const prevVersion = renderFn._lastSettingsVersion ?? -1
          const curVersion = settingsVersionRef.current
          const settingsChangedWhilePaused = activeVideo.paused && curVersion !== prevVersion
          renderFn._lastSettingsVersion = curVersion

          // Track time changes while paused (e.g. seek / stepFrame)
          const prevTime = renderFn._lastRenderedTime ?? -1
          const curTime = activeVideo.currentTime
          const timeChangedWhilePaused = activeVideo.paused && Math.abs(curTime - prevTime) > 0.001

          // Frame-accurate seamless sequential playback across cuts with ZERO LATENCY
          if (!activeVideo.paused && !activeVideo.ended && currentTimeBlocks && currentTimeBlocks.length > 0) {
            const curIdx = activeClipIndexRef.current
            const curClip = currentTimeBlocks[curIdx] || currentTimeBlocks[0]

            if (curClip && activeVideo.currentTime >= curClip.end - 0.04) {
              if (curIdx + 1 < currentTimeBlocks.length) {
                const nextIdx = curIdx + 1
                const nextClip = currentTimeBlocks[nextIdx]
                const standbyVideo = getStandbyVideo()

                // Check if preloaded standby buffer is ready for instant switch
                if (standbyVideo && standbyVideo.readyState >= 2) {
                  standbyVideo.muted = currentIsMuted
                  standbyVideo.playbackRate =
                    nextClip.smoothSettings?.playbackSpeed || currentSmSettings.playbackSpeed || 1.0

                  standbyVideo.play().catch(console.warn)

                  activeVideo.pause()
                  activeVideo.muted = true

                  // Instant zero-latency switch
                  const newKey = activeVideoKeyRef.current === 'A' ? 'B' : 'A'
                  activeVideoKeyRef.current = newKey
                  setActiveVideoKey(newKey)
                  activeClipIndexRef.current = nextIdx
                  setCurrentTime(nextClip.start)
                  onCurrentTimeChange?.(nextClip.start)

                  // Preload the following cut on the newly freed standby video!
                  if (nextIdx + 1 < currentTimeBlocks.length) {
                    preloadStandbyVideoForClip(nextIdx + 1)
                  }
                } else {
                  // Direct seek fallback
                  activeVideo.currentTime = nextClip.start
                  activeClipIndexRef.current = nextIdx
                  setCurrentTime(nextClip.start)
                  onCurrentTimeChange?.(nextClip.start)
                }
              } else {
                // Sequence completed
                activeVideo.pause()
                const standby = getStandbyVideo()
                if (standby) standby.pause()
                setIsPlaying(false)
                onIsPlayingChange?.(false)
                activeClipIndexRef.current = 0
                activeVideo.currentTime = currentTimeBlocks[0].start
                setCurrentTime(currentTimeBlocks[0].start)
                onCurrentTimeChange?.(currentTimeBlocks[0].start)
                if (currentTimeBlocks.length > 1) {
                  preloadStandbyVideoForClip(1)
                }
              }
            } else if (curClip && activeVideo.currentTime < curClip.start - 0.1) {
              activeVideo.currentTime = curClip.start
            }
          }

          // MOBILE FIX: Verify stream readiness (readyState >= 2 HAVE_CURRENT_DATA, not seeking, videoWidth > 0)
          const isDecoderReady =
            (isVideoReadyRef.current || activeVideo.readyState >= 2) &&
            activeVideo.readyState >= 2 &&
            !activeVideo.seeking &&
            (activeVideo.videoWidth || 0) > 0

          if (isDecoderReady) {
            if (!isVideoReadyRef.current) {
              isVideoReadyRef.current = true
              setIsVideoReady(true)
            }

            // Update history canvases only when actively playing valid frames
            if (!activeVideo.paused && !activeVideo.ended) {
              const curBlock =
                currentTimeBlocks && currentTimeBlocks.length > 0
                  ? currentTimeBlocks[activeClipIndexRef.current] || currentTimeBlocks[0]
                  : null
              const activeTransform = curBlock?.transformSettings || currentTrSettings

              const list = historyCanvasesRef.current
              for (let i = list.length - 1; i > 0; i--) {
                const destCtx = list[i].getContext('2d')
                if (destCtx) {
                  destCtx.clearRect(0, 0, w, h)
                  destCtx.drawImage(list[i - 1], 0, 0)
                }
              }
              const firstCtx = list[0]?.getContext('2d')
              if (firstCtx) {
                const rect = calculateTransformRect(
                  activeVideo.videoWidth || w,
                  activeVideo.videoHeight || h,
                  w,
                  h,
                  activeTransform.fitMode,
                  activeTransform.zoom,
                  activeTransform.panX,
                  activeTransform.panY
                )
                firstCtx.fillStyle = '#000000'
                firstCtx.fillRect(0, 0, w, h)
                firstCtx.drawImage(activeVideo, rect.dx, rect.dy, rect.dw, rect.dh)
              }
            }

            // REDRAW CONDITIONS:
            // 1. Actively playing
            // 2. Settings tweaked while paused
            // 3. Time scrubbed/seeked while paused
            // 4. Initial frame after load/project switch not yet rendered
            const needsInitialRender = !hasRenderedFirstFrameRef.current
            const shouldRedraw =
              !activeVideo.paused ||
              settingsChangedWhilePaused ||
              timeChangedWhilePaused ||
              needsInitialRender

            if (shouldRedraw) {
              forceDrawFrame()
              renderFn._lastRenderedTime = curTime
            }
          } else {
            // HOLD LAST VALID FRAME of current session:
            // Only hold if first frame of this session was already rendered! Never clear to pitch black during seeking/transitions!
            if (
              hasRenderedFirstFrameRef.current &&
              lastValidFrameCanvasRef.current &&
              lastValidFrameCanvasRef.current.width > 0
            ) {
              ctx.clearRect(0, 0, w, h)
              ctx.drawImage(lastValidFrameCanvasRef.current, 0, 0)
            }
          }
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [
    getActiveVideo,
    getStandbyVideo,
    preloadStandbyVideoForClip,
    forceDrawFrame,
  ])

  // Playback control handlers
  const togglePlay = () => {
    const activeVideo = getActiveVideo()
    if (!activeVideo) return

    if (activeVideo.paused) {
      if (timeBlocks && timeBlocks.length > 0) {
        const lastClip = timeBlocks[timeBlocks.length - 1]
        if (activeVideo.currentTime >= lastClip.end - 0.05) {
          activeClipIndexRef.current = 0
          activeVideo.currentTime = timeBlocks[0].start
          if (timeBlocks.length > 1) {
            preloadStandbyVideoForClip(1)
          }
        } else {
          let idx = timeBlocks.findIndex(
            (b) => activeVideo.currentTime >= b.start && activeVideo.currentTime < b.end
          )
          if (idx === -1) {
            const nextIdx = timeBlocks.findIndex((b) => b.start > activeVideo.currentTime)
            idx = nextIdx !== -1 ? nextIdx : 0
            activeVideo.currentTime = timeBlocks[idx].start
          }
          activeClipIndexRef.current = idx
          if (idx + 1 < timeBlocks.length) {
            preloadStandbyVideoForClip(idx + 1)
          }
        }
      } else if (currentTime >= trimRange.end && trimRange.end > 0) {
        activeVideo.currentTime = trimRange.start
      }

      activeVideo.playbackRate = smoothSettings.playbackSpeed || 1.0
      activeVideo
        .play()
        .then(() => {
          setIsPlaying(true)
          onIsPlayingChange?.(true)
        })
        .catch(console.warn)
    } else {
      activeVideo.pause()
      const standby = getStandbyVideo()
      if (standby) standby.pause()
      setIsPlaying(false)
      onIsPlayingChange?.(false)
    }
  }

  const handleSeek = (time: number) => {
    setCurrentTime(time)
    onCurrentTimeChange?.(time)

    performVideoSeek(time)

    if (timeBlocks && timeBlocks.length > 0) {
      const idx = timeBlocks.findIndex((b) => time >= b.start && time <= b.end)
      const currentIdx =
        idx !== -1
          ? idx
          : timeBlocks.findIndex((b) => b.start > time) !== -1
          ? timeBlocks.findIndex((b) => b.start > time)
          : 0
      activeClipIndexRef.current = currentIdx

      if (currentIdx + 1 < timeBlocks.length) {
        preloadStandbyVideoForClip(currentIdx + 1)
      }
    }
  }

  const stepFrame = (frames: number) => {
    const activeVideo = getActiveVideo()
    if (!activeVideo) return
    const step = frames * (1 / 30)
    const target = Math.max(
      trimRange.start,
      Math.min(trimRange.end || duration, activeVideo.currentTime + step)
    )
    performVideoSeek(target)
    setCurrentTime(target)
    onCurrentTimeChange?.(target)
  }

  const toggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    const activeVideo = getActiveVideo()
    if (activeVideo) activeVideo.muted = nextMuted
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    const activeVideo = getActiveVideo()
    if (activeVideo) {
      activeVideo.volume = val
      activeVideo.muted = val === 0
    }
    const standbyVideo = getStandbyVideo()
    if (standbyVideo) {
      standbyVideo.volume = val
    }
    setIsMuted(val === 0)
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
      className={`relative flex flex-col w-full bg-[#0b0d14] rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl transition-all ${isMobileCompact ? 'p-2' : ''
        }`}
    >
      {/* Underlying native HTML5 video A (offscreen fixed positioning to prevent mobile browsers from suspending the video decoder) */}
      <video
        ref={videoARef}
        src={videoUrl}
        loop={false}
        muted={activeVideoKey === 'A' ? isMuted : true}
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        onTimeUpdate={() => {
          if (activeVideoKeyRef.current === 'A') handleTimeUpdate()
        }}
        onSeeked={() => {
          if (activeVideoKeyRef.current === 'A') handleVideoSeeked()
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={() => handleVideoReady('A')}
        onCanPlay={() => handleVideoReady('A')}
        onError={(e) => console.warn('Video A playback error:', e)}
        onPlay={() => {
          if (activeVideoKeyRef.current === 'A') setIsPlaying(true)
        }}
        onPause={() => {
          if (activeVideoKeyRef.current === 'A') setIsPlaying(false)
        }}
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Underlying native HTML5 video B for instant zero-latency ping-pong transitions */}
      <video
        ref={videoBRef}
        src={videoUrl}
        loop={false}
        muted={activeVideoKey === 'B' ? isMuted : true}
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        onTimeUpdate={() => {
          if (activeVideoKeyRef.current === 'B') handleTimeUpdate()
        }}
        onSeeked={() => {
          if (activeVideoKeyRef.current === 'B') handleVideoSeeked()
        }}
        onLoadedData={() => handleVideoReady('B')}
        onCanPlay={() => handleVideoReady('B')}
        onError={(e) => console.warn('Video B playback error:', e)}
        onPlay={() => {
          if (activeVideoKeyRef.current === 'B') setIsPlaying(true)
        }}
        onPause={() => {
          if (activeVideoKeyRef.current === 'B') setIsPlaying(false)
        }}
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
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
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'smoothed'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  {t.viewSmoothed}
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'split'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <SplitSquareVertical className="w-3 h-3 shrink-0" />
                  <span className="hidden sm:inline">{t.viewSplit}</span>
                </button>
                <button
                  onClick={() => setViewMode('original')}
                  className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'original'
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
            className={`relative flex-1 flex items-center justify-center p-1 sm:p-2 min-h-[140px] sm:min-h-[180px] lg:min-h-[300px] max-h-[30vh] sm:max-h-[40vh] lg:max-h-[60vh] select-none overflow-hidden bg-black/40 touch-none ${viewMode === 'split'
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
              className={`max-h-full max-w-full w-auto h-auto rounded-lg shadow-2xl object-contain ring-1 transition-shadow ${isPanning ? 'ring-2 ring-amber-400 shadow-amber-500/20' : 'ring-white/10'
                }`}
            />

            {/* Mobile Video Loading / Decoder Initializing Overlay */}
            {!isVideoReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 pointer-events-none">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-[11px] text-slate-300 font-medium">
                  {lang === 'la' ? 'ກຳລັງກຽມພ້ອມວິດີໂອ...' : 'Initializing video stream...'}
                </span>
              </div>
            )}

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
                <span>🖐 {t.panDragHint}</span>
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
          <div className="p-2 sm:p-3 bg-[#0e1018]/95 border-t border-white/[0.08] backdrop-blur-md flex flex-col gap-2 z-20 shrink-0">
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
                      className={`px-1.5 py-0.5 rounded font-mono transition-colors cursor-pointer ${transformSettings.aspectRatio === r
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
                  className={`p-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${isLooping
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
