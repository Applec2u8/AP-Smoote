/**
 * Client-Side Audio Extractor & Resampler (Web Audio API)
 * Decodes audio from any video/audio file (.mp4, .mov, .webm, .mp3, .wav)
 * and exports a clean 16kHz Mono WAV Blob directly in the browser!
 * 100% Client-Side — Zero Server, Zero FFmpeg dependency.
 */

export async function extractAudioFromMediaFile(
  file: File,
  onProgress?: (percent: number, msg: string) => void
): Promise<Blob> {
  onProgress?.(10, 'กำลังอ่านข้อมูลไฟล์วิดีโอเข้าสู่หน่วยความจำ...')
  const arrayBuffer = await file.arrayBuffer()

  onProgress?.(30, 'กำลังถอดรหัสเสียงผ่าน Web Audio API...')
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const audioCtx = new AudioCtx()

  let decodedBuffer: AudioBuffer
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer)
  } catch (err) {
    throw new Error('เบราว์เซอร์ไม่สามารถถอดรหัสเสียงจากไฟล์นี้ได้ (อาจเป็นไฟล์ที่ไม่มีแทร็กเสียง หรือเข้ารหัสไม่รองรับ)')
  } finally {
    audioCtx.close().catch(() => {})
  }

  onProgress?.(60, 'กำลังแปลงสัญญาณเสียงเป็น 16kHz Mono WAV สำหรับ AI...')

  // Whisper performs best at 16,000 Hz Mono
  const targetSampleRate = 16000
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(decodedBuffer.duration * targetSampleRate),
    targetSampleRate
  )

  const source = offlineCtx.createBufferSource()
  source.buffer = decodedBuffer
  source.connect(offlineCtx.destination)
  source.start(0)

  const renderedBuffer = await offlineCtx.startRendering()
  onProgress?.(85, 'กำลังสร้างไฟล์ WAV Blob...')

  const wavBlob = audioBufferToWavBlob(renderedBuffer)
  onProgress?.(100, 'สกัดเสียงเสร็จสมบูรณ์!')

  return wavBlob
}

/**
 * Encode AudioBuffer to 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1
  const sampleRate = audioBuffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  const channelData = audioBuffer.getChannelData(0)
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample

  const buffer = new ArrayBuffer(44 + channelData.length * bytesPerSample)
  const view = new DataView(buffer)

  /* RIFF identifier */
  writeString(view, 0, 'RIFF')
  /* file length */
  view.setUint32(4, 36 + channelData.length * bytesPerSample, true)
  /* RIFF type */
  writeString(view, 8, 'WAVE')
  /* format chunk identifier */
  writeString(view, 12, 'fmt ')
  /* format chunk length */
  view.setUint32(16, 16, true)
  /* sample format (raw) */
  view.setUint16(20, format, true)
  /* channel count */
  view.setUint16(22, numChannels, true)
  /* sample rate */
  view.setUint32(24, sampleRate, true)
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true)
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true)
  /* bits per sample */
  view.setUint16(34, bitDepth, true)
  /* data chunk identifier */
  writeString(view, 36, 'data')
  /* data chunk length */
  view.setUint32(40, channelData.length * bytesPerSample, true)

  // Write PCM samples
  let offset = 44
  for (let i = 0; i < channelData.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
