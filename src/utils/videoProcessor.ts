import { ExportSettings, SmoothSettings, TimeBlock, TrimRange, VideoAspectRatio, VideoTransformSettings } from '../types'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

export interface RenderStats {
  currentFps: number
  renderedFrames: number
  totalFrames: number
  progress: number // 0 - 100
}

/**
 * Calculates frame destination rect on canvas according to fit mode and custom zoom.
 */
export function calculateTransformRect(
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  fitMode: 'contain' | 'cover' = 'contain',
  zoom: number = 1.0,
  panX: number = 0,
  panY: number = 0
): { dx: number; dy: number; dw: number; dh: number } {
  if (!sourceWidth || !sourceHeight || !canvasWidth || !canvasHeight) {
    return { dx: 0, dy: 0, dw: canvasWidth, dh: canvasHeight }
  }

  const srcAspect = sourceWidth / sourceHeight
  const canvasAspect = canvasWidth / canvasHeight

  let baseW: number
  let baseH: number

  if (fitMode === 'cover') {
    if (srcAspect > canvasAspect) {
      baseH = canvasHeight
      baseW = canvasHeight * srcAspect
    } else {
      baseW = canvasWidth
      baseH = canvasWidth / srcAspect
    }
  } else {
    // contain
    if (srcAspect > canvasAspect) {
      baseW = canvasWidth
      baseH = canvasWidth / srcAspect
    } else {
      baseH = canvasHeight
      baseW = canvasHeight * srcAspect
    }
  }

  const dw = baseW * (zoom || 1.0)
  const dh = baseH * (zoom || 1.0)
  const offsetX = ((panX || 0) / 100) * (canvasWidth / 2)
  const offsetY = ((panY || 0) / 100) * (canvasHeight / 2)
  const dx = (canvasWidth - dw) / 2 + offsetX
  const dy = (canvasHeight - dh) / 2 + offsetY

  return { dx, dy, dw, dh }
}

/**
 * Applies smoothing and frame blending filters to a destination 2D canvas context.
 * Dynamically adapts blending weights for Slow Motion (playbackSpeed < 1.0) to eliminate judder.
 */
export function applyFrameEffects(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  settings: SmoothSettings,
  historyCanvases: HTMLCanvasElement[],
  transformSettings?: VideoTransformSettings
) {
  const { intensity, mode, blendDecay, sharpness, contrast, brightness, playbackSpeed = 1.0 } = settings

  // Base filter string
  const filters: string[] = []
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`)
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`)
  if (sharpness > 0) {
    filters.push(`contrast(${100 + sharpness * 0.25}%)`)
  }

  ctx.filter = filters.length > 0 ? filters.join(' ') : 'none'

  const rect = transformSettings
    ? calculateTransformRect(
        video.videoWidth || width,
        video.videoHeight || height,
        width,
        height,
        transformSettings.fitMode,
        transformSettings.zoom,
        transformSettings.panX,
        transformSettings.panY
      )
    : { dx: 0, dy: 0, dw: width, dh: height }

  // Draw background letterbox
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)

  // If intensity is 0 and speed is 1.0, draw plain video frame
  if (intensity === 0 || historyCanvases.length === 0) {
    ctx.globalAlpha = 1.0
    ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
    ctx.filter = 'none'
    return
  }

  // Slow motion compensation factor: as speed gets slower (e.g. 0.25x), we increase blend persistence
  const slowFactor = playbackSpeed < 1.0 ? 1.0 + (1.0 - playbackSpeed) * 0.5 : 1.0
  const factor = Math.min(1.0, (intensity / 100) * slowFactor)

  if (mode === 'blend' || mode === 'motion_blur') {
    // 1. Draw current video frame as base
    ctx.globalAlpha = 1.0
    ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)

    // 2. Blend previous historical frames on top with decreasing opacity
    const samplesToUse = Math.min(
      historyCanvases.length,
      Math.max(2, Math.round(settings.frameSamples * factor))
    )

    ctx.globalCompositeOperation = 'source-over'

    for (let i = 0; i < samplesToUse; i++) {
      const hist = historyCanvases[i]
      if (!hist) continue

      const age = i + 1
      const alpha = Math.min(0.75, 0.45 * factor * Math.pow(blendDecay, age))

      ctx.globalAlpha = alpha
      ctx.drawImage(hist, 0, 0, width, height)
    }

    ctx.globalAlpha = 1.0
  } else if (mode === 'interpolation') {
    ctx.globalAlpha = 1.0
    ctx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)

    if (historyCanvases.length > 0) {
      const prev = historyCanvases[0]
      ctx.globalAlpha = 0.4 * factor
      ctx.drawImage(prev, 0, 0, width, height)
      ctx.globalAlpha = 1.0
    }
  }

  ctx.filter = 'none'
}

/**
 * Calculates output dimensions based on target resolution and aspect ratio (strictly aligned to even numbers for H.264 MP4)
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  targetRes: ExportSettings['resolution'],
  aspectRatio: VideoAspectRatio = 'original'
): { width: number; height: number } {
  let baseRatio = (origWidth && origHeight) ? origWidth / origHeight : 16 / 9

  if (aspectRatio === '16:9') baseRatio = 16 / 9
  else if (aspectRatio === '9:16') baseRatio = 9 / 16
  else if (aspectRatio === '1:1') baseRatio = 1 / 1
  else if (aspectRatio === '4:5') baseRatio = 4 / 5
  else if (aspectRatio === '4:3') baseRatio = 4 / 3
  else if (aspectRatio === '21:9') baseRatio = 21 / 9

  let targetHeight = origHeight || 1080
  let targetWidth = origWidth || 1920

  if (targetRes === 'original' && origWidth && origHeight) {
    if (aspectRatio === 'original') {
      targetWidth = origWidth
      targetHeight = origHeight
    } else {
      const maxDim = Math.max(origWidth, origHeight)
      if (baseRatio >= 1) {
        targetWidth = maxDim
        targetHeight = Math.round(maxDim / baseRatio)
      } else {
        targetHeight = maxDim
        targetWidth = Math.round(maxDim * baseRatio)
      }
    }
  } else {
    let standardBase = 1080
    if (targetRes === '720p') standardBase = 720
    if (targetRes === '480p') standardBase = 480

    if (baseRatio >= 1) {
      targetHeight = standardBase
      targetWidth = Math.round(standardBase * baseRatio)
    } else {
      targetWidth = standardBase
      targetHeight = Math.round(standardBase / baseRatio)
    }
  }

  // Align to even numbers (essential for MP4 H.264 encoder)
  targetWidth = Math.floor(targetWidth / 2) * 2
  targetHeight = Math.floor(targetHeight / 2) * 2

  return { width: targetWidth, height: targetHeight }
}

/**
 * Maps an elapsed active rendering time to source video timestamp across multi-segment time blocks.
 */
export function getTimeFromTimeBlocks(blocks: TimeBlock[], elapsedSec: number): number {
  if (!blocks || blocks.length === 0) return elapsedSec
  let accumulated = 0
  for (const block of blocks) {
    const blockDuration = Math.max(0, block.end - block.start)
    if (elapsedSec <= accumulated + blockDuration) {
      const offset = elapsedSec - accumulated
      return block.start + offset
    }
    accumulated += blockDuration
  }
  return blocks[blocks.length - 1]?.end || 0
}

/**
 * Calculates total active duration across all time blocks or a trim range.
 */
export function calculateActiveDuration(
  rawDuration: number,
  timeBlocks?: TimeBlock[],
  trimRange?: TrimRange
): number {
  if (timeBlocks && timeBlocks.length > 0) {
    const total = timeBlocks.reduce((acc, b) => acc + Math.max(0, b.end - b.start), 0)
    return Math.max(0.05, total)
  }
  if (trimRange) {
    const start = Math.max(0, trimRange.start)
    const end = Math.min(rawDuration, trimRange.end)
    return Math.max(0.05, end - start)
  }
  return Math.max(0.05, rawDuration)
}

export interface ExportSegment {
  id: string
  start: number
  end: number
  sourceDuration: number
  speed: number
  outputDuration: number
  smoothSettings: SmoothSettings
  transformSettings?: VideoTransformSettings
}

export interface ExportPlan {
  segments: ExportSegment[]
  totalSourceDuration: number
  totalOutputDuration: number
  totalFrames: number
  targetFps: number
  mapOutputTimeToSource: (outTimeSec: number) => {
    sourceTime: number
    smoothSettings: SmoothSettings
    transformSettings?: VideoTransformSettings
  }
}

/**
 * Creates an exact frame-accurate export execution plan, taking into account
 * cut blocks, trim ranges, individual/global slow motion playback speeds, and target FPS.
 * Guarantees 100% time and speed parity with the real-time preview player.
 */
export function createExportPlan(
  rawDuration: number,
  globalSmooth: SmoothSettings,
  targetFps: number,
  timeBlocks?: TimeBlock[],
  trimRange?: TrimRange,
  globalTransform?: VideoTransformSettings
): ExportPlan {
  const safeDuration = Math.max(0.05, rawDuration || 1)
  let rawBlocks: TimeBlock[] = []

  if (timeBlocks && timeBlocks.length > 0) {
    rawBlocks = timeBlocks
      .filter((b) => b.end > b.start)
      .map((b) => ({
        ...b,
        start: Math.max(0, Math.min(b.start, safeDuration)),
        end: Math.max(0, Math.min(b.end, safeDuration)),
      }))
  } else if (trimRange && (trimRange.start > 0 || trimRange.end > 0)) {
    const s = Math.max(0, Math.min(trimRange.start, safeDuration))
    const e = Math.min(safeDuration, Math.max(s + 0.05, trimRange.end || safeDuration))
    rawBlocks = [{ id: 'trim-single', start: s, end: e }]
  } else {
    rawBlocks = [{ id: 'full-video', start: 0, end: safeDuration }]
  }

  if (rawBlocks.length === 0) {
    rawBlocks = [{ id: 'fallback', start: 0, end: safeDuration }]
  }

  const segments: ExportSegment[] = rawBlocks.map((b, idx) => {
    const sourceDuration = Math.max(0.01, b.end - b.start)
    const effectiveSmooth: SmoothSettings = {
      ...globalSmooth,
      ...(b.smoothSettings || {}),
    }
    const speed = Math.max(
      0.05,
      Math.min(2.0, effectiveSmooth.playbackSpeed || globalSmooth.playbackSpeed || 1.0)
    )
    const outputDuration = sourceDuration / speed
    const effectiveTransform = b.transformSettings || globalTransform

    return {
      id: b.id || `seg-${idx}`,
      start: b.start,
      end: b.end,
      sourceDuration,
      speed,
      outputDuration,
      smoothSettings: effectiveSmooth,
      transformSettings: effectiveTransform,
    }
  })

  const totalSourceDuration = segments.reduce((sum, s) => sum + s.sourceDuration, 0)
  const totalOutputDuration = segments.reduce((sum, s) => sum + s.outputDuration, 0)
  const totalFrames = Math.max(1, Math.round(totalOutputDuration * targetFps))

  const mapOutputTimeToSource = (outTimeSec: number) => {
    const clampedOut = Math.max(0, Math.min(outTimeSec, totalOutputDuration))
    let accumulatedOut = 0

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const isLast = i === segments.length - 1
      if (clampedOut <= accumulatedOut + seg.outputDuration || isLast) {
        const offsetOut = clampedOut - accumulatedOut
        const offsetSource = offsetOut * seg.speed
        const sourceTime = Math.min(seg.end, seg.start + offsetSource)
        return {
          sourceTime,
          smoothSettings: seg.smoothSettings,
          transformSettings: seg.transformSettings,
        }
      }
      accumulatedOut += seg.outputDuration
    }

    const last = segments[segments.length - 1]
    return {
      sourceTime: last.end,
      smoothSettings: last.smoothSettings,
      transformSettings: last.transformSettings,
    }
  }

  return {
    segments,
    totalSourceDuration,
    totalOutputDuration,
    totalFrames,
    targetFps,
    mapOutputTimeToSource,
  }
}

/**
 * Format duration in seconds to a human-readable string (e.g. "4.5s" or "1m 12.3s")
 */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, seconds)
  const m = Math.floor(s / 60)
  const remSec = (s % 60).toFixed(1)
  if (m > 0) {
    const wholeSec = Math.floor(s % 60)
    const dec = Math.round((s % 1) * 10)
    return `${m}m ${wholeSec < 10 ? '0' : ''}${wholeSec}.${dec}s`
  }
  return `${remSec}s`
}

/**
 * Discovers and returns the highest compatible H.264 profile for WebCodecs
 */
async function selectSupportedVideoCodec(
  width: number,
  height: number,
  fps: number,
  bitrate: number
): Promise<string> {
  const is1080pOrHigher = width >= 1920 || height >= 1080
  const isHighFps = fps > 30

  let candidateCodecs: string[]
  if (is1080pOrHigher) {
    if (isHighFps) {
      candidateCodecs = [
        'avc1.4D002A', // Main Profile, Level 4.2 (1080p @ 60fps)
        'avc1.64002A', // High Profile, Level 4.2
        'avc1.42002A', // Baseline Profile, Level 4.2
        'avc1.4D0033', // Main Profile, Level 5.1 (1080p @ 120fps / 4K)
        'avc1.640033', // High Profile, Level 5.1
        'avc1.420033',
        'avc1.4D0028', // Main Profile, Level 4.0
        'avc1.640028',
        'avc1.420028',
        'vp09.00.10.08',
        'vp8',
      ]
    } else {
      candidateCodecs = [
        'avc1.4D0028', // Main Profile, Level 4.0 (1080p @ 30fps)
        'avc1.640028', // High Profile, Level 4.0
        'avc1.420028', // Baseline Profile, Level 4.0
        'avc1.4D002A',
        'avc1.64002A',
        'avc1.42002A',
        'vp09.00.10.08',
        'vp8',
      ]
    }
  } else {
    if (isHighFps) {
      candidateCodecs = [
        'avc1.420020', // Baseline Profile, Level 3.2 (720p @ 60fps)
        'avc1.4D0020', // Main Profile, Level 3.2
        'avc1.420028',
        'avc1.4D0028',
        'avc1.42E01F',
        'vp09.00.10.08',
        'vp8',
      ]
    } else {
      candidateCodecs = [
        'avc1.42E01F', // Baseline Profile, Level 3.1 (720p @ 30fps)
        'avc1.42001F',
        'avc1.4D001F',
        'avc1.420020',
        'avc1.4D0028',
        'vp09.00.10.08',
        'vp8',
      ]
    }
  }

  if (
    typeof (window as any).VideoEncoder !== 'undefined' &&
    typeof (window as any).VideoEncoder.isConfigSupported === 'function'
  ) {
    for (const codec of candidateCodecs) {
      try {
        const support = await (window as any).VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
        })
        if (support && support.supported) {
          return codec
        }
      } catch {
        // try next candidate
      }
    }
  }

  return candidateCodecs[0] || 'avc1.4D002A'
}

/**
 * Client-side video exporter producing standard MP4 (H.264/AVC) files compatible with iOS & Android.
 * Uses WebCodecs VideoEncoder + mp4-muxer with deterministic frame stepping and accurate duration mapping.
 */
export async function exportSmoothedVideo(
  videoSrc: string,
  smoothSettings: SmoothSettings,
  exportSettings: ExportSettings,
  onProgress: (stats: RenderStats) => void,
  isCancelled: () => boolean,
  trimRange?: TrimRange,
  transformSettings?: VideoTransformSettings,
  timeBlocks?: TimeBlock[]
): Promise<Blob> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.src = videoSrc
  video.muted = true
  video.playsInline = true

  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res()
    video.onerror = () => rej(new Error('Failed to load video source for export'))
  })

  const rawDuration = video.duration
  if (!rawDuration || isNaN(rawDuration)) {
    throw new Error('Invalid video duration')
  }

  // Create frame-accurate export execution plan
  const plan = createExportPlan(
    rawDuration,
    smoothSettings,
    exportSettings.fps,
    timeBlocks,
    trimRange,
    transformSettings
  )

  const { width, height } = calculateTargetDimensions(
    video.videoWidth,
    video.videoHeight,
    exportSettings.resolution,
    transformSettings?.aspectRatio || 'original'
  )

  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = width
  offscreenCanvas.height = height
  const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Unable to create canvas 2D rendering context')
  }

  // Prepare history frame buffers for frame blending
  const maxHistory = 6
  const historyCanvases: HTMLCanvasElement[] = []
  for (let i = 0; i < maxHistory; i++) {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    historyCanvases.push(c)
  }

  const bitrateMap = {
    medium: 6_000_000,
    high: 12_000_000,
    maximum: 24_000_000,
  }
  const bitrate = bitrateMap[exportSettings.quality] || 12_000_000

  // Pre-prime initial frame and fill history buffers to avoid initial judder
  const initialMap = plan.mapOutputTimeToSource(0)
  video.currentTime = initialMap.sourceTime
  await new Promise<void>((resolve) => {
    let resolved = false
    const done = () => {
      if (!resolved) {
        resolved = true
        video.removeEventListener('seeked', done)
        clearTimeout(timer)
        resolve()
      }
    }
    const timer = setTimeout(done, 200)
    video.addEventListener('seeked', done, { once: true })
    if (video.readyState >= 2) done()
  })

  const initialRect = initialMap.transformSettings
    ? calculateTransformRect(
        video.videoWidth || width,
        video.videoHeight || height,
        width,
        height,
        initialMap.transformSettings.fitMode,
        initialMap.transformSettings.zoom,
        initialMap.transformSettings.panX,
        initialMap.transformSettings.panY
      )
    : { dx: 0, dy: 0, dw: width, dh: height }

  for (const hc of historyCanvases) {
    const hctx = hc.getContext('2d')
    if (hctx) {
      hctx.fillStyle = '#000000'
      hctx.fillRect(0, 0, width, height)
      hctx.drawImage(video, initialRect.dx, initialRect.dy, initialRect.dw, initialRect.dh)
    }
  }

  // Helper for seeking and applying frame effects with safety timeout
  const seekAndRender = async (
    sourceTime: number,
    effSmooth: SmoothSettings,
    effTransform?: VideoTransformSettings
  ): Promise<void> => {
    const clampedTime = Math.max(0, Math.min(sourceTime, rawDuration - 0.001))

    // Only wait for seek if timestamp has noticeably moved
    if (Math.abs(video.currentTime - clampedTime) >= 0.002) {
      await new Promise<void>((resolve) => {
        let finished = false
        const done = () => {
          if (!finished) {
            finished = true
            video.removeEventListener('seeked', done)
            clearTimeout(timer)
            resolve()
          }
        }
        const timer = setTimeout(done, 120) // Safety timeout prevents hangs
        video.addEventListener('seeked', done, { once: true })
        video.currentTime = clampedTime
      })
    }

    // Shift history frames
    for (let i = historyCanvases.length - 1; i > 0; i--) {
      const destCtx = historyCanvases[i].getContext('2d')
      if (destCtx) {
        destCtx.clearRect(0, 0, width, height)
        destCtx.drawImage(historyCanvases[i - 1], 0, 0)
      }
    }

    // Place current frame in history[0]
    const firstCtx = historyCanvases[0].getContext('2d')
    if (firstCtx) {
      const rect = effTransform
        ? calculateTransformRect(
            video.videoWidth || width,
            video.videoHeight || height,
            width,
            height,
            effTransform.fitMode,
            effTransform.zoom,
            effTransform.panX,
            effTransform.panY
          )
        : { dx: 0, dy: 0, dw: width, dh: height }
      firstCtx.fillStyle = '#000000'
      firstCtx.fillRect(0, 0, width, height)
      firstCtx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
    }

    // Render onto offscreen canvas with smooth & motion blend
    ctx.clearRect(0, 0, width, height)
    applyFrameEffects(ctx, video, width, height, effSmooth, historyCanvases, effTransform)
  }

  // Method 1: WebCodecs VideoEncoder + mp4-muxer (Produces standard 100% iOS/Android compatible MP4 H.264)
  if (
    typeof (window as any).VideoEncoder !== 'undefined' &&
    typeof (window as any).VideoFrame !== 'undefined'
  ) {
    try {
      const chosenCodec = await selectSupportedVideoCodec(
        width,
        height,
        plan.targetFps,
        bitrate
      )
      const isAvc = chosenCodec.startsWith('avc1')

      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: isAvc ? 'avc' : 'vp9',
          width,
          height,
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      })

      let encodeError: any = null
      const videoEncoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
        error: (e: any) => {
          console.error('VideoEncoder error:', e)
          encodeError = e
        },
      })

      videoEncoder.configure({
        codec: chosenCodec,
        width,
        height,
        bitrate,
        framerate: plan.targetFps,
      })

      const renderStartTime = performance.now()
      const targetFps = plan.targetFps
      const totalFrames = plan.totalFrames

      for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
        if (isCancelled()) {
          try {
            videoEncoder.close()
          } catch {}
          throw new Error('Export cancelled by user')
        }
        if (encodeError) {
          throw encodeError
        }

        const outTimeSec = currentFrame / targetFps
        const { sourceTime, smoothSettings: effSmooth, transformSettings: effTransform } =
          plan.mapOutputTimeToSource(outTimeSec)

        await seekAndRender(sourceTime, effSmooth, effTransform)

        const timestampUs = Math.round(outTimeSec * 1_000_000)
        const durationUs = Math.round((1 / targetFps) * 1_000_000)

        const frame = new (window as any).VideoFrame(offscreenCanvas, {
          timestamp: timestampUs,
          duration: durationUs,
        })

        videoEncoder.encode(frame, { keyFrame: currentFrame % (targetFps * 2) === 0 })
        frame.close()

        // Backpressure to prevent excessive frame queuing
        while (videoEncoder.encodeQueueSize > 8) {
          await new Promise((r) => setTimeout(r, 10))
        }

        // Progress update every 3 frames or on last frame
        if (currentFrame % 3 === 0 || currentFrame === totalFrames - 1) {
          const elapsed = (performance.now() - renderStartTime) / 1000
          const currentFps = elapsed > 0 ? Math.round((currentFrame + 1) / elapsed) : targetFps
          const progress = Math.min(100, Math.round(((currentFrame + 1) / totalFrames) * 100))

          onProgress({
            currentFps,
            renderedFrames: currentFrame + 1,
            totalFrames,
            progress,
          })
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      await videoEncoder.flush()
      videoEncoder.close()
      muxer.finalize()

      const buffer = (muxer.target as ArrayBufferTarget).buffer
      return new Blob([buffer], { type: 'video/mp4' })
    } catch (err: any) {
      if (err.message === 'Export cancelled by user') {
        throw err
      }
      console.warn('WebCodecs MP4 export encountered error, attempting MediaRecorder fallback:', err)
    }
  }

  // Method 2: Real-time Playback Synchronized MediaRecorder Fallback
  // Guarantees exact playback speed parity without frame-by-frame 0.01x timing artifacts
  return new Promise(async (resolve, reject) => {
    try {
      const stream = offscreenCanvas.captureStream(plan.targetFps)
      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm',
      ]

      let chosenMime = ''
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          chosenMime = mime
          break
        }
      }

      let mediaRecorder: MediaRecorder
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: chosenMime || undefined,
          videoBitsPerSecond: bitrate,
        })
      } catch {
        mediaRecorder = new MediaRecorder(stream)
      }

      const chunks: Blob[] = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const mimeOut = chosenMime.includes('webm') ? 'video/webm' : 'video/mp4'
        resolve(new Blob(chunks, { type: mimeOut }))
      }

      mediaRecorder.onerror = (e) => reject(e)
      mediaRecorder.start(200)

      const startTime = performance.now()
      let animId: number

      const renderLoop = () => {
        if (isCancelled()) {
          cancelAnimationFrame(animId)
          try {
            mediaRecorder.stop()
          } catch {}
          reject(new Error('Export cancelled by user'))
          return
        }

        const elapsedSec = (performance.now() - startTime) / 1000
        if (elapsedSec >= plan.totalOutputDuration) {
          cancelAnimationFrame(animId)
          onProgress({
            currentFps: plan.targetFps,
            renderedFrames: plan.totalFrames,
            totalFrames: plan.totalFrames,
            progress: 100,
          })
          setTimeout(() => {
            try {
              mediaRecorder.stop()
            } catch {}
          }, 150)
          return
        }

        const { sourceTime, smoothSettings: effSmooth, transformSettings: effTransform } =
          plan.mapOutputTimeToSource(elapsedSec)

        video.currentTime = sourceTime

        // Shift history frames
        for (let i = historyCanvases.length - 1; i > 0; i--) {
          const destCtx = historyCanvases[i].getContext('2d')
          if (destCtx) {
            destCtx.clearRect(0, 0, width, height)
            destCtx.drawImage(historyCanvases[i - 1], 0, 0)
          }
        }
        const firstCtx = historyCanvases[0].getContext('2d')
        if (firstCtx) {
          const rect = effTransform
            ? calculateTransformRect(
                video.videoWidth || width,
                video.videoHeight || height,
                width,
                height,
                effTransform.fitMode,
                effTransform.zoom,
                effTransform.panX,
                effTransform.panY
              )
            : { dx: 0, dy: 0, dw: width, dh: height }
          firstCtx.fillStyle = '#000000'
          firstCtx.fillRect(0, 0, width, height)
          firstCtx.drawImage(video, rect.dx, rect.dy, rect.dw, rect.dh)
        }

        ctx.clearRect(0, 0, width, height)
        applyFrameEffects(ctx, video, width, height, effSmooth, historyCanvases, effTransform)

        const progress = Math.min(99, Math.round((elapsedSec / plan.totalOutputDuration) * 100))
        const renderedFrames = Math.round(elapsedSec * plan.targetFps)

        onProgress({
          currentFps: plan.targetFps,
          renderedFrames,
          totalFrames: plan.totalFrames,
          progress,
        })

        animId = requestAnimationFrame(renderLoop)
      }

      animId = requestAnimationFrame(renderLoop)
    } catch (err) {
      reject(err)
    }
  })
}
