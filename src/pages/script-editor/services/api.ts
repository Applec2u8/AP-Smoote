/**
 * Client-Side Direct AI Services (Groq Whisper & Gemini 1.5)
 * 100% Pure Client-Side — Direct Browser-to-API calls with Auto-Rotation.
 * Zero Backend Server, Zero FFmpeg on host, Deployable to Cloudflare Pages & Vercel.
 */
import {
  TranscriptSegment,
  TTSVoiceOption,
  SmartSummaryResult,
  ApiProviderCategory,
} from '../types'
import {
  executeWithKeyRotation,
  getApiKeyPoolState,
} from './apiKeyRotator'

// Common Thai & English filler words
export const FILLER_WORDS = [
  'เอ่อ', 'อ่า', 'แบบว่า', 'คือแบบ', 'งะ', 'นะคับ', 'นะค่ะ', 'แบบ', 'คือ', 'ก็คือ',
  'um', 'uh', 'er', 'like', 'you know', 'basically', 'actually', 'literally',
]

/**
 * Direct Client-Side Transcription via Groq Whisper Large v3
 */
async function callGroqWhisperDirect(audioBlob: Blob, apiKey: string): Promise<TranscriptSegment[]> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')
  formData.append('language', 'th')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (res.status === 429) {
    throw new Error('HTTP 429: Groq Rate limit or Quota exceeded')
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('HTTP 401/403: Groq API Key ไม่ถูกต้องหรือหมดอายุ')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(`Groq Whisper error (${res.status}): ${err?.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const wordsList = data.words || []
  const segmentsList = data.segments || []

  return segmentsList.map((seg: { start: number; end: number; text: string }, segIdx: number) => ({
    id: `seg_${segIdx}`,
    start: Number(seg.start) || 0,
    end: Number(seg.end) || 0,
    text: (seg.text || '').trim(),
    words: wordsList
      .filter((w: { start: number; end: number }) => w.start >= seg.start && w.end <= seg.end + 0.05)
      .map((w: { word: string; start: number; end: number; probability?: number }, wIdx: number) => ({
        id: `w_${segIdx}_${wIdx}`,
        text: (w.word || '').trim(),
        start: Number(w.start) || 0,
        end: Number(w.end) || 0,
        confidence: Number(w.probability) ?? 0.95,
        isDeleted: false,
      })),
  }))
}

/**
 * Direct Client-Side Transcription via Google Gemini 1.5 Flash
 */
async function callGeminiDirect(audioBlob: Blob, apiKey: string): Promise<TranscriptSegment[]> {
  // Convert blob to base64 in browser
  const arrayBuffer = await audioBlob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(arrayBuffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const audioBase64 = btoa(binary)

  const body = {
    contents: [
      {
        parts: [
          {
            text: 'Transcribe this audio into Thai text with exact word-level timestamps. Return valid JSON only: { "segments": [{ "start": 0.0, "end": 2.5, "text": "...", "words": [{ "word": "...", "start": 0.0, "end": 0.5, "confidence": 0.98 }] }] }',
          },
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: audioBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (res.status === 429) {
    throw new Error('HTTP 429: Gemini Quota Exceeded')
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error('HTTP 401/403: Gemini API Key Invalid')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(`Gemini STT error (${res.status}): ${err?.error?.message || res.statusText}`)
  }

  const data = await res.json()
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  const parsed = JSON.parse(rawText)

  return (parsed.segments || []).map((seg: { start: number; end: number; text: string; words: Array<{ word: string; start: number; end: number; confidence?: number }> }, segIdx: number) => ({
    id: `seg_${segIdx}`,
    start: Number(seg.start) || 0,
    end: Number(seg.end) || 0,
    text: seg.text || '',
    words: (seg.words || []).map((w, wIdx) => ({
      id: `w_${segIdx}_${wIdx}`,
      text: (w.word || '').trim(),
      start: Number(w.start) || 0,
      end: Number(w.end) || 0,
      confidence: Number(w.confidence) || 0.95,
      isDeleted: false,
    })),
  }))
}

/**
 * Transcribe Audio directly with Automatic Key Rotation & Failover
 */
export async function transcribeAudioWithRotation(
  audioBlob: Blob,
  category?: ApiProviderCategory
): Promise<TranscriptSegment[]> {
  const pool = getApiKeyPoolState()
  const activeCategory = category || pool.activeCategory || 'groq'

  return executeWithKeyRotation(activeCategory, async (apiKey) => {
    if (activeCategory === 'groq') {
      return await callGroqWhisperDirect(audioBlob, apiKey)
    } else {
      return await callGeminiDirect(audioBlob, apiKey)
    }
  })
}

/**
 * AI Smart Summary Direct from Browser
 */
export async function generateSmartSummaryDirect(
  segments: TranscriptSegment[],
  category?: ApiProviderCategory
): Promise<SmartSummaryResult> {
  const pool = getApiKeyPoolState()
  const activeCategory = category || pool.activeCategory || 'groq'

  const textWithTimestamps = segments
    .map((s) => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s] ${s.text}`)
    .join('\n')

  const prompt = `คุณคือผู้เชี่ยวชาญด้านการสรุปเนื้อหาวิดีโอและทำ Highlight คลิป
โปรดอ่าน Transcript ภาษาไทยพร้อม Timestamp ต่อไปนี้ แล้วทำการ "สรุปเนื้อหาสำคัญ" ให้อ่านง่าย กระชับ ได้ใจความครบถ้วน (ห้ามแต่งเติมหรือสรุปมั่ว)
และระบุช่วงเวลา (start, end เป็นวินาที) ของแต่ละประเด็นสำคัญ เพื่อให้ผู้ใช้เลือกตัดคลิปได้

Transcript:
${textWithTimestamps}

ตอบกลับในรูปแบบ JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "summary": "สรุปภาพรวมทั้งหมดของคลิปสั้นๆ 1-2 ประโยค",
  "keyPoints": [
    {
      "topic": "หัวข้อสำคัญสั้นๆ",
      "summary": "คำอธิบายเนื้อหาที่กระชับได้ใจความ",
      "start": 0.0,
      "end": 12.5
    }
  ]
}`

  return executeWithKeyRotation(activeCategory, async (apiKey) => {
    if (activeCategory === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      })

      if (res.status === 429) throw new Error('HTTP 429: Groq Rate Limit')
      if (res.status === 401 || res.status === 403) throw new Error('HTTP 401/403: Groq Key Invalid')
      if (!res.ok) throw new Error(`Groq Summarize error (${res.status})`)

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content || '{}'
      return JSON.parse(content)
    } else {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      if (res.status === 429) throw new Error('HTTP 429: Gemini Quota Exceeded')
      if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error('HTTP 401/403: Gemini Key Invalid')
      if (!res.ok) throw new Error(`Gemini Summarize error (${res.status})`)

      const data = await res.json()
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      return JSON.parse(rawText)
    }
  })
}

/**
 * Client-Side TTS Voices list (Web Speech API)
 */
export const AVAILABLE_TTS_VOICES: TTSVoiceOption[] = [
  { id: 'th-TH', name: 'เสียงภาษาไทย (Thai Natural Voice)', gender: 'female', language: 'ไทย', locale: 'th-TH' },
  { id: 'en-US', name: 'English US Voice', gender: 'female', language: 'English', locale: 'en-US' },
]

/**
 * Preview TTS Voice directly in browser using Web Speech API
 */
export function playBrowserTTSPreview(text: string, lang = 'th-TH', speed = 1.0): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      alert('เบราว์เซอร์ของคุณยังไม่รองรับ Web Speech API Preview')
      resolve()
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = speed
    utterance.lang = lang

    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()

    window.speechSynthesis.speak(utterance)
  })
}
