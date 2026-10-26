import React, { useState, useRef, useEffect } from 'react'
import {
  UploadCloud, Link2, Film, AlertCircle, FileVideo, CheckCircle2,
  Loader2, ShieldCheck, Search, X, Key, Sparkles, Play,
} from 'lucide-react'
import {
  extractAudioFromMediaFile,
} from '../services/clientAudioExtractor'
import {
  transcribeAudioWithRotation,
} from '../services/api'
import { getApiKeyPoolState } from '../services/apiKeyRotator'

export type VideoReadyPayload = {
  sourceType: 'upload' | 'url'
  videoId: string
  videoUrl: string
  title: string
  duration: number
  formatId?: string
  transcript: import('../types').TranscriptSegment[]
}

interface LoadingStage {
  step: 'extracting' | 'stt'
  message: string
  percent: number
}

interface VideoInputProps {
  onVideoAndTranscriptReady: (payload: VideoReadyPayload) => void
  onOpenSettings: () => void
  isProcessing?: boolean
}

export const VideoInput: React.FC<VideoInputProps> = ({
  onVideoAndTranscriptReady,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload')
  const [urlInput, setUrlInput] = useState('')

  // Full pipeline loading state
  const [loading, setLoading] = useState<LoadingStage | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [poolState, setPoolState] = useState(getApiKeyPoolState())

  useEffect(() => {
    setPoolState(getApiKeyPoolState())
  }, [])

  const activeCategory = poolState.activeCategory || 'groq'
  const activeKeysCount = poolState[activeCategory]?.filter((k) => k.isActive && !k.isExhausted).length || 0

  // ── Handle Local Video File (100% Pure Client-Side via Web Audio API) ──────
  const handleProcessMediaFile = async (file: File) => {
    if (activeKeysCount === 0) {
      setErrorMsg(`กรุณาเพิ่ม API Key ในกลุ่ม ${activeCategory.toUpperCase()} ในปุ่ม Settings ก่อนเริ่มถอดเสียง`)
      onOpenSettings()
      return
    }

    try {
      setErrorMsg(null)
      const localVideoUrl = URL.createObjectURL(file)

      // Step 1: Decode audio in browser memory
      setLoading({
        step: 'extracting',
        message: 'กำลังอ่านและสกัดเสียงผ่าน Web Audio API...',
        percent: 20,
      })

      const wavBlob = await extractAudioFromMediaFile(file, (percent, msg) => {
        setLoading({ step: 'extracting', message: msg, percent: Math.round(percent * 0.5) })
      })

      // Step 2: Direct Client-to-API Whisper STT with Automatic Key Rotation
      setLoading({
        step: 'stt',
        message: `กำลังส่งเสียงไปแกะคำผ่าน ${activeCategory.toUpperCase()} API (Auto-Failover)...`,
        percent: 65,
      })

      const transcript = await transcribeAudioWithRotation(wavBlob, activeCategory)

      if (!transcript || transcript.length === 0) {
        throw new Error('ไม่พบเสียงพูดในไฟล์นี้ หรือการถอดเสียงไม่สำเร็จ')
      }

      setLoading(null)

      // Calculate duration from transcript or HTML5 video
      const duration = transcript.length > 0 ? transcript[transcript.length - 1].end : 60

      onVideoAndTranscriptReady({
        sourceType: 'upload',
        videoId: `local_${Date.now()}`,
        videoUrl: localVideoUrl,
        title: file.name,
        duration,
        transcript,
      })
    } catch (err: unknown) {
      setLoading(null)
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการประมวลผลไฟล์')
    }
  }

  // ── Handle URL input (Client-Side Guidance) ──────────────────────────────
  const handleUrlSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const url = urlInput.trim()
    if (!url) {
      setErrorMsg('กรุณาวาง URL หรือเลือกลากไฟล์วิดีโอจากเครื่องของคุณ')
      return
    }

    setErrorMsg(
      '💡 ข้อแนะนำ: เนื่องจากเบราว์เซอร์มีนโยบายความปลอดภัย (CORS) ไม่อนุญาตให้ดึงวิดีโอจาก YouTube/TikTok โดยตรงโดยไม่ผ่านเซิร์ฟเวอร์ส่วนตัว\n\nโปรดดาวน์โหลดคลิปลงเครื่อง แล้วเลือกไฟล์ในแท็บ "เลือกไฟล์วิดีโอจากเครื่อง" เพื่อประมวลผลผ่าน Web Audio API บนเบราว์เซอร์ได้ทันที 100% ฟรีและเร็วที่สุดครับ!'
    )
  }

  // Demo sample loader
  const handleLoadDemo = async () => {
    if (activeKeysCount === 0) {
      setErrorMsg(`กรุณาเพิ่ม API Key ในกลุ่ม ${activeCategory.toUpperCase()} ก่อนใช้งาน`)
      onOpenSettings()
      return
    }
    // Generate synthetic sample
    setLoading({ step: 'stt', message: 'กำลังสร้างตัวอย่างสคริปต์ Demo...', percent: 50 })
    await new Promise((r) => setTimeout(r, 800))
    setLoading(null)

    const demoTranscript = [
      {
        id: 'seg_1', start: 0.0, end: 4.5, text: 'สวัสดีครับทุกคน วันนี้ เอ่อ เราจะมาแนะนำระบบตัดต่อวิดีโอจากสคริปต์',
        words: [
          { id: 'w1', text: 'สวัสดีครับ', start: 0.1, end: 0.9, confidence: 0.98, isDeleted: false },
          { id: 'w2', text: 'ทุกคน', start: 1.0, end: 1.4, confidence: 0.95, isDeleted: false },
          { id: 'w3', text: 'วันนี้', start: 1.6, end: 2.1, confidence: 0.97, isDeleted: false },
          { id: 'w4', text: 'เอ่อ', start: 2.2, end: 2.7, confidence: 0.85, isDeleted: true },
          { id: 'w5', text: 'เราจะมา', start: 2.8, end: 3.4, confidence: 0.96, isDeleted: false },
          { id: 'w6', text: 'แนะนำระบบตัดต่อ', start: 3.5, end: 4.5, confidence: 0.99, isDeleted: false },
        ],
      },
      {
        id: 'seg_2', start: 4.8, end: 9.8, text: 'ระบบทำงานบน Browser 100% แบบ Pure Frontend ไม่ต้องพึ่งพาเซิร์ฟเวอร์',
        words: [
          { id: 'w7', text: 'ระบบทำงาน', start: 4.9, end: 5.7, confidence: 0.96, isDeleted: false },
          { id: 'w8', text: 'บน Browser 100%', start: 5.8, end: 7.2, confidence: 0.98, isDeleted: false },
          { id: 'w9', text: 'แบบ Pure Frontend', start: 7.3, end: 8.5, confidence: 0.97, isDeleted: false },
          { id: 'w10', text: 'ไม่ต้องพึ่งพาเซิร์ฟเวอร์', start: 8.6, end: 9.8, confidence: 0.99, isDeleted: false },
        ],
      },
    ]

    onVideoAndTranscriptReady({
      sourceType: 'upload',
      videoId: `demo_${Date.now()}`,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      title: 'ตัวอย่างวิดีโอสาธิต (Pure Client-Side Demo)',
      duration: 15,
      transcript: demoTranscript,
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files?.[0]) handleProcessMediaFile(e.dataTransfer.files[0])
  }

  return (
    <div className="space-y-5">
      {/* ── Key Pool Status Bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-white/10 text-xs backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">
            AI Engine (Direct Client):{' '}
            <strong className="text-white capitalize">{activeCategory} Pool</strong>{' '}
            <span className="text-slate-400">({activeKeysCount} คีย์พร้อมใช้ในเบราว์เซอร์)</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-purple-300 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 transition-all cursor-pointer font-medium"
        >
          <Key className="w-3.5 h-3.5" /> จัดการ Key Pool
        </button>
      </div>

      {/* ── Tab Switcher ─────────────────────────────────────────────────── */}
      <div className="flex p-1 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-xl">
        {[
          { id: 'upload', label: 'อัปโหลดไฟล์วิดีโอ/เสียงจากเครื่อง (เร็วที่สุด)', icon: UploadCloud },
          { id: 'url', label: 'ลิงก์ออนไลน์ (YouTube / URL)', icon: Link2 },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={loading !== null}
            onClick={() => { setActiveTab(tab.id as 'upload' | 'url'); setErrorMsg(null) }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            } disabled:opacity-50`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Loading Overlay ──────────────────────────────────────────────── */}
      {loading && (
        <div className="rounded-3xl border border-indigo-500/40 bg-slate-900/90 backdrop-blur-2xl p-6 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{loading.message}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {loading.step === 'extracting'
                  ? 'ประมวลผลถอดรหัสเสียงบนเครื่องของคุณ 100% (Web Audio API)'
                  : 'ส่งตรงไปยัง AI จากเบราว์เซอร์ของคุณ (พร้อม Auto-Rotation)'}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>ความคืบหน้า</span>
              <span className="text-indigo-300 font-mono font-bold">{loading.percent}%</span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 shadow-md"
                style={{ width: `${Math.max(6, loading.percent)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Error Alert ──────────────────────────────────────────────────── */}
      {errorMsg && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-950/70 border border-red-500/40 text-red-300 shadow-xl animate-fade-in">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-xs font-bold text-red-200">แจ้งเตือนระบบ</p>
            <p className="text-xs whitespace-pre-line leading-relaxed text-red-300">{errorMsg}</p>
            {errorMsg.includes('API Key') && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 active:scale-95 transition-all cursor-pointer shadow"
              >
                <Key className="w-3.5 h-3.5" /> เปิด Settings เพื่อเพิ่ม API Key
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-red-400 hover:text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── File Upload Tab (Pure Client-Side) ────────────────────────────── */}
      {activeTab === 'upload' && !loading && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-3xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-300 backdrop-blur-xl ${
              isDragOver
                ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                : 'border-white/15 bg-slate-900/60 hover:border-indigo-500/50 hover:bg-slate-900/80 shadow-2xl'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,audio/mp3,audio/wav,audio/m4a"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleProcessMediaFile(e.target.files[0]) }}
            />
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4 text-indigo-400 shadow-xl shadow-indigo-500/10">
              <FileVideo className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">คลิกเพื่อเลือกไฟล์ หรือลากวิดีโอ/ไฟล์เสียงมาวางที่นี่</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              รองรับ <span className="text-indigo-400 font-mono font-semibold">.MP4</span>,{' '}
              <span className="text-purple-400 font-mono font-semibold">.MOV</span>,{' '}
              <span className="text-pink-400 font-mono font-semibold">.WEBM</span>,{' '}
              <span className="text-amber-400 font-mono font-semibold">.MP3</span>, และ{' '}
              <span className="text-emerald-400 font-mono font-semibold">.WAV</span>
            </p>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-white/10 text-xs text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              100% Pure Client-Side — สกัดเสียงและประมวลผลบนเครื่องของคุณทันที ไม่ต้องมีเซิร์ฟเวอร์
            </div>
          </div>

          {/* Test Demo Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-purple-300 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> หรือคลิกที่นี่เพื่อทดสอบด้วยคลิปตัวอย่าง (Demo Video)
            </button>
          </div>
        </div>
      )}

      {/* ── URL Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'url' && !loading && (
        <form
          onSubmit={handleUrlSubmit}
          className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              URL ลิงก์วิดีโอ (YouTube, Facebook, หรือ TikTok)
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 text-slate-400 pointer-events-none">
                <Film className="w-5 h-5" />
              </div>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-12 pr-32 py-4 bg-slate-800/80 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-sans"
              />
              <button
                type="submit"
                className="absolute right-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
              >
                ตรวจสอบ
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 leading-relaxed space-y-1.5">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ระบบ Pure Client-Side ปลอดภัย 100%:
            </div>
            <p className="text-[11px] text-slate-300">
              เพื่อความเสถียร ไม่ติดปัญหาบล็อกดาวน์โหลดจาก YouTube หรือ Server 500 แนะนำให้ดาวน์โหลดคลิปมาไว้ในเครื่อง แล้วลากไฟล์ลงในแท็บ <strong>"อัปโหลดไฟล์วิดีโอจากเครื่อง"</strong> ระบบจะถอดเสียงและให้คุณตัดคำได้อย่างราบรื่นที่สุดครับ!
            </p>
          </div>
        </form>
      )}
    </div>
  )
}
