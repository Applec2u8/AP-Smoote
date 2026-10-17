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

/**
 * Client-side video exporter producing standard MP4 (H.264/AVC) files compatible with iOS & Android.
 * Uses WebCodecs VideoEncoder + mp4-muxer with deterministic frame stepping.
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

  // Calculate Active Duration and Slow Motion across blocks or trim
  const activeDuration = calculateActiveDuration(rawDuration, timeBlocks, trimRange)
  const trimStart = Math.max(0, trimRange ? trimRange.start : 0)

  const speed = Math.max(0.1, Math.min(1.0, smoothSettings.playbackSpeed || 1.0))
  const targetDuration = activeDuration / speed

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

  const targetFps = exportSettings.fps
  const totalFrames = Math.max(1, Math.floor(targetDuration * targetFps))

  const bitrateMap = {
    medium: 6_000_000,
    high: 12_000_000,
    maximum: 24_000_000,
  }
  const bitrate = bitrateMap[exportSettings.quality] || 12_000_000

  // Helper for seeking and applying frame effects
  const seekAndRender = async (sourceTime: number): Promise<void> => {
    return new Promise((res) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)

        // Shift history frames
        for (let i = historyCanvases.length - 1; i > 0; i--) {
          const destCtx = historyCanvases[i].getContext('2d')
          if (destCtx) {
            destCtx.clearRect(0, 0, width, height)
            destCtx.drawImage(historyCanvases[i - 1], 0, 0)
          }
        }
        // Check for per-cut specific settings
        const activeBlock = timeBlocks?.find((b) => sourceTime >= b.start && sourceTime <= b.end)
        const effSmooth = activeBlock?.smoothSettings || smoothSettings
        const effTransform = activeBlock?.transformSettings || transformSettings

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

        res()
      }

      video.addEventListener('seeked', onSeeked, { once: true })
      video.currentTime = Math.min(sourceTime, rawDuration - 0.001)
    })
  }

  // Method 1: WebCodecs VideoEncoder + mp4-muxer (Produces standard 100% iOS/Android compatible MP4 H.264)
  if (typeof (window as any).VideoEncoder !== 'undefined' && typeof (window as any).VideoFrame !== 'undefined') {
    try {
      const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
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

      // Configure H.264 Baseline Profile level 3.1 or Main (avc1.42E01F)
      await videoEncoder.configure({
        codec: 'avc1.42E01F',
        width,
        height,
        bitrate,
        framerate: targetFps,
      })

      const renderStartTime = performance.now()

      for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
        if (isCancelled()) {
          videoEncoder.close()
          throw new Error('Export cancelled by user')
        }
        if (encodeError) {
          throw encodeError
        }

        // Map output frame to source video time in trimmed portion or across time blocks
        const elapsedSec = (currentFrame / totalFrames) * activeDuration
        const sourceTime = timeBlocks && timeBlocks.length > 0
          ? getTimeFromTimeBlocks(timeBlocks, elapsedSec)
          : trimStart + elapsedSec
        await seekAndRender(sourceTime)

        const timestampUs = Math.round((currentFrame / targetFps) * 1_000_000)
        const frame = new (window as any).VideoFrame(offscreenCanvas, {
          timestamp: timestampUs,
          duration: Math.round((1 / targetFps) * 1_000_000),
        })

        videoEncoder.encode(frame, { keyFrame: currentFrame % (targetFps * 2) === 0 })
        frame.close()

        // Yield slightly for responsive UI progress
        if (currentFrame % 5 === 0) {
          await new Promise((r) => setTimeout(r, 0))
        }

        const elapsed = (performance.now() - renderStartTime) / 1000
        const currentFps = elapsed > 0 ? Math.round(currentFrame / elapsed) : targetFps
        const progress = Math.min(100, Math.round(((currentFrame + 1) / totalFrames) * 100))

        onProgress({
          currentFps,
          renderedFrames: currentFrame + 1,
          totalFrames,
          progress,
        })
      }

      await videoEncoder.flush()
      videoEncoder.close()
      muxer.finalize()

      const buffer = (muxer.target as ArrayBufferTarget).buffer
      return new Blob([buffer], { type: 'video/mp4' })
    } catch (err) {
      console.warn('WebCodecs MP4 export encountered error, attempting MediaRecorder fallback:', err)
    }
  }

  // Method 2: MediaRecorder Fallback (with MP4 preferred codecs)
  return new Promise(async (resolve, reject) => {
    const stream = offscreenCanvas.captureStream(targetFps)
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
      // Package into video/mp4 Blob
      const outputBlob = new Blob(chunks, { type: 'video/mp4' })
      resolve(outputBlob)
    }

    mediaRecorder.onerror = (e) => reject(e)
    mediaRecorder.start(200)

    const renderStartTime = performance.now()

    for (let currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
      if (isCancelled()) {
        mediaRecorder.stop()
        return reject(new Error('Export cancelled by user'))
      }

      const elapsedSec = (currentFrame / totalFrames) * activeDuration
      const sourceTime = timeBlocks && timeBlocks.length > 0
        ? getTimeFromTimeBlocks(timeBlocks, elapsedSec)
        : trimStart + elapsedSec
      await seekAndRender(sourceTime)

      await new Promise((r) => setTimeout(r, 10))

      const elapsed = (performance.now() - renderStartTime) / 1000
      const currentFps = elapsed > 0 ? Math.round(currentFrame / elapsed) : targetFps
      const progress = Math.min(100, Math.round(((currentFrame + 1) / totalFrames) * 100))

      onProgress({
        currentFps,
        renderedFrames: currentFrame + 1,
        totalFrames,
        progress,
      })
    }

    await new Promise((r) => setTimeout(r, 200))
    mediaRecorder.stop()
  })
}
