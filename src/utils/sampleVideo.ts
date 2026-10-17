/**
 * Generates an in-memory high-contrast motion video (bouncing particles & oscillating neon bar)
 * to test 30 FPS vs 60 FPS motion smoothing instantly without downloading external assets.
 */
export async function generateDemoVideoBlob(): Promise<{ blob: Blob; url: string; name: string }> {
  const canvas = document.createElement('canvas')
  const width = 1280
  const height = 720
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const stream = canvas.captureStream(30) // 30 FPS raw source to test smoothing!
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm',
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      resolve({ blob, url, name: 'demo-motion-sample-30fps.webm' })
    }
    recorder.onerror = reject

    recorder.start()

    // 4 seconds of animation at 30 fps = 120 frames
    const duration = 4.5
    const fps = 30
    const totalFrames = duration * fps
    let frame = 0

    const drawFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop()
        return
      }

      const t = frame / fps

      // Background
      ctx.fillStyle = '#0b0d14'
      ctx.fillRect(0, 0, width, height)

      // Cyberpunk grid
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)'
      ctx.lineWidth = 1
      const gridSize = 40
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // High-speed swinging pendulum / neon bar (shows motion judder at 30fps)
      const angle = Math.sin(t * 3.5) * 1.1
      const pivotX = width / 2
      const pivotY = 160
      const armLength = 340
      const bobX = pivotX + Math.sin(angle) * armLength
      const bobY = pivotY + Math.cos(angle) * armLength

      ctx.beginPath()
      ctx.moveTo(pivotX, pivotY)
      ctx.lineTo(bobX, bobY)
      ctx.strokeStyle = '#6366f1'
      ctx.lineWidth = 6
      ctx.shadowColor = '#818cf8'
      ctx.shadowBlur = 15
      ctx.stroke()
      ctx.shadowBlur = 0

      // Glowing pendulum bob
      ctx.beginPath()
      ctx.arc(bobX, bobY, 44, 0, Math.PI * 2)
      ctx.fillStyle = '#a855f7'
      ctx.shadowColor = '#c084fc'
      ctx.shadowBlur = 30
      ctx.fill()
      ctx.shadowBlur = 0

      // Fast moving horizontal kinetic tracker (great test for frame blending)
      const barX = ((Math.sin(t * 4.2) + 1) / 2) * (width - 240) + 120
      const barY = height - 140

      ctx.beginPath()
      ctx.roundRect(barX - 80, barY, 160, 48, 12)
      ctx.fillStyle = '#06b6d4'
      ctx.shadowColor = '#22d3ee'
      ctx.shadowBlur = 24
      ctx.fill()
      ctx.shadowBlur = 0

      // Speed indicator text
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 22px "Plus Jakarta Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Smoot Dynamic Motion Test (30 FPS Source)', width / 2, 70)
      ctx.font = '500 15px "JetBrains Mono", monospace'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`Frame: ${frame + 1} / ${totalFrames}  |  Time: ${t.toFixed(2)}s  |  Try Smooth Intensity > 50%`, width / 2, 105)

      frame++
      setTimeout(drawFrame, 1000 / fps)
    }

    drawFrame()
  })
}
