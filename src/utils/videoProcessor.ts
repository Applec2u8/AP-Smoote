import { ExportSettings, SmoothSettings } from '../types'

export interface RenderStats {
  currentFps: number
  renderedFrames: number
  totalFrames: number
  progress: number // 0 - 100
}

/**
 * Applies smoothing and frame blending filters to a destination 2D canvas context
 */
export function applyFrameEffects(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  settings: SmoothSettings,
  historyCanvases: HTMLCanvasElement[]
) {
  const { intensity, mode, blendDecay, sharpness, contrast, brightness } = settings

  // Base filter string
  const filters: string[] = []
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`)
  if (contrast !== 100) filters.push(`contrast(${contrast}%)`)
  if (sharpness > 0) {
    // Canvas doesn't have native sharpness filter, but we enhance contrast slightly for edge clarity
    filters.push(`contrast(${100 + sharpness * 0.25}%)`)
  }

  ctx.filter = filters.length > 0 ? filters.join(' ') : 'none'

  // If intensity is 0, draw plain video frame
  if (intensity === 0 || historyCanvases.length === 0) {
    ctx.globalAlpha = 1.0
    ctx.drawImage(video, 0, 0, width, height)
    ctx.filter = 'none'
    return
  }

  const factor = intensity / 100

  if (mode === 'blend' || mode === 'motion_blur') {
    // 1. Draw current video frame as base
    ctx.globalAlpha = 1.0
    ctx.drawImage(video, 0, 0, width, height)

    // 2. Blend previous historical frames on top with decreasing opacity
    const samplesToUse = Math.min(
      historyCanvases.length,
      Math.max(2, Math.round(settings.frameSamples * factor))
    )

    ctx.globalCompositeOperation = 'source-over'

    for (let i = 0; i < samplesToUse; i++) {
      const hist = historyCanvases[i]
      if (!hist) continue

      // Weight decays for older frames
      const age = i + 1
      const alpha = Math.min(0.7, (0.45 * factor * Math.pow(blendDecay, age)))

      ctx.globalAlpha = alpha
      ctx.drawImage(hist, 0, 0, width, height)
    }

    ctx.globalAlpha = 1.0
  } else if (mode === 'interpolation') {
    // Sub-frame Phase simulation
    ctx.globalAlpha = 1.0
    ctx.drawImage(video, 0, 0, width, height)

    if (historyCanvases.length > 0) {
      const prev = historyCanvases[0]
      // Overlay intermediate ghosting/interpolation layer
      ctx.globalAlpha = 0.35 * factor
      ctx.drawImage(prev, 0, 0, width, height)
      ctx.globalAlpha = 1.0
    }
  }

  ctx.filter = 'none'
}

/**
 * Calculates output dimensions based on target resolution
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  targetRes: ExportSettings['resolution']
): { width: number; height: number } {
  if (targetRes === 'original' || !origWidth || !origHeight) {
    // Ensure dimensions are even numbers (required by many video encoders)
    return {
      width: Math.floor(origWidth / 2) * 2,
      height: Math.floor(origHeight / 2) * 2,
    }
  }

  let targetHeight = origHeight
  if (targetRes === '1080p') targetHeight = 1080
  if (targetRes === '720p') targetHeight = 720
  if (targetRes === '480p') targetHeight = 480

  const aspectRatio = origWidth / origHeight
  let targetWidth = Math.round(targetHeight * aspectRatio)

  // Align to even numbers
  targetWidth = Math.floor(targetWidth / 2) * 2
  targetHeight = Math.floor(targetHeight / 2) * 2

  return { width: targetWidth, height: targetHeight }
}

/**
 * Client-side video exporter using deterministic frame stepping and MediaRecorder
 */
export async function exportSmoothedVideo(
  videoSrc: string,
  smoothSettings: SmoothSettings,
  exportSettings: ExportSettings,
  onProgress: (stats: RenderStats) => void,
  isCancelled: () => boolean
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = videoSrc
    video.muted = true
    video.playsInline = true

    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res()
      video.onerror = () => rej(new Error('Failed to load video source for export'))
    })

    const duration = video.duration
    if (!duration || isNaN(duration)) {
      return reject(new Error('Invalid video duration'))
    }

    const { width, height } = calculateTargetDimensions(
      video.videoWidth,
      video.videoHeight,
      exportSettings.resolution
    )

    const offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = width
    offscreenCanvas.height = height
    const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })

    if (!ctx) {
      return reject(new Error('Unable to create canvas 2D rendering context'))
    }

    // Prepare history buffers for frame blending
    const maxHistory = 6
    const historyCanvases: HTMLCanvasElement[] = []
    for (let i = 0; i < maxHistory; i++) {
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      historyCanvases.push(c)
    }

    const targetFps = exportSettings.fps
    const totalFrames = Math.max(1, Math.floor(duration * targetFps))
    const timeStep = 1 / targetFps

    // Capture stream from canvas
    const stream = offscreenCanvas.captureStream(targetFps)

    // Select preferred mimeType
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ]

    let chosenMime = ''
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        chosenMime = mime
        break
      }
    }

    const bitrateMap = {
      medium: 5_000_000,
      high: 12_000_000,
      maximum: 25_000_000,
    }

    const videoBitsPerSecond = bitrateMap[exportSettings.quality] || 12_000_000

    let mediaRecorder: MediaRecorder
    try {
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: chosenMime || undefined,
        videoBitsPerSecond,
      })
    } catch {
      mediaRecorder = new MediaRecorder(stream)
    }

    const recordedChunks: Blob[] = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data)
      }
    }

    mediaRecorder.onstop = () => {
      const outputBlob = new Blob(recordedChunks, {
        type: chosenMime || 'video/webm',
      })
      resolve(outputBlob)
    }

    mediaRecorder.onerror = (e) => {
      reject(e)
    }

    // Start recording
    mediaRecorder.start(250) // collect chunks every 250ms

    // Seek and render frame by frame
    let currentFrame = 0
    let currentTime = 0

    const seekAndRender = async (time: number): Promise<void> => {
      return new Promise((res) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked)

          // 1. Shift history frames
          for (let i = historyCanvases.length - 1; i > 0; i--) {
            const destCtx = historyCanvases[i].getContext('2d')
            if (destCtx) {
              destCtx.clearRect(0, 0, width, height)
              destCtx.drawImage(historyCanvases[i - 1], 0, 0)
            }
          }
          // Store most recent frame in history[0]
          const firstCtx = historyCanvases[0].getContext('2d')
          if (firstCtx) {
            firstCtx.clearRect(0, 0, width, height)
            firstCtx.drawImage(video, 0, 0, width, height)
          }

          // 2. Render onto export canvas with smoothing filter
          ctx.clearRect(0, 0, width, height)
          applyFrameEffects(ctx, video, width, height, smoothSettings, historyCanvases)

          res()
        }

        video.addEventListener('seeked', onSeeked, { once: true })
        video.currentTime = Math.min(time, duration - 0.001)
      })
    }

    const renderStartTime = performance.now()

    // Loop through all frames
    for (currentFrame = 0; currentFrame < totalFrames; currentFrame++) {
      if (isCancelled()) {
        mediaRecorder.stop()
        return reject(new Error('Export cancelled by user'))
      }

      currentTime = currentFrame * timeStep
      await seekAndRender(currentTime)

      // Allow stream to grab the frame
      await new Promise((r) => setTimeout(r, 8))

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

    // Final frame hold
    await new Promise((r) => setTimeout(r, 200))
    mediaRecorder.stop()
  })
}
