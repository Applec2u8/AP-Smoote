import React, { useState, useEffect } from 'react'
import {
  TranscriptSegment,
  TTSMixSettings,
  ScriptProjectMetadata,
} from './types'
import { VideoInput, type VideoReadyPayload } from './components/VideoInput'
import { VideoPlayerPreview } from './components/VideoPlayerPreview'
import { ScriptEditorView } from './components/ScriptEditorView'
import { TTSVoiceMixer } from './components/TTSVoiceMixer'
import { ExportModal } from './components/ExportModal'
import { ApiSettingsModal } from './components/ApiSettingsModal'
import { getApiKeyPoolState } from './services/apiKeyRotator'
import { saveScriptProjectMetadata } from './services/supabaseScriptDb'
import {
  Scissors,
  Sparkles,
  Download,
  Save,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Settings,
  Key,
  Cpu,
} from 'lucide-react'

export const ScriptEditorPage: React.FC = () => {
  // ── Video & Transcript State ─────────────────────────────────────────
  const [videoData, setVideoData] = useState<{
    videoId: string
    videoUrl: string
    title: string
    duration: number
    sourceType: 'upload' | 'url'
  } | null>(null)

  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [currentTime, setCurrentTime] = useState<number>(0)

  // ── TTS Settings ─────────────────────────────────────────────────────
  const [ttsSettings, setTtsSettings] = useState<TTSMixSettings>({
    enabled: false,
    voiceId: 'th-TH-PremwadeeNeural',
    speed: 1.0,
    pitch: 0,
    originalVolume: 20,
    ttsVolume: 90,
    duckOriginalAudio: true,
  })

  // ── Export Modal State ─────────────────────────────────────────────
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)

  // ── Notifications ─────────────────────────────────────────────────────
  const [savedSuccessBanner, setSavedSuccessBanner] = useState<string | null>(null)

  // ── Settings Modal ────────────────────────────────────────────────────
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [poolState, setPoolState] = useState(getApiKeyPoolState())

  // Refresh pool state whenever settings modal closes
  useEffect(() => {
    if (!isSettingsOpen) {
      setPoolState(getApiKeyPoolState())
    }
  }, [isSettingsOpen])

  const handleSettingsClose = () => {
    setIsSettingsOpen(false)
    setPoolState(getApiKeyPoolState())
  }

  // ── Handler: Video + Transcript Ready (from VideoInput) ───────────────
  const handleVideoAndTranscriptReady = (payload: VideoReadyPayload) => {
    setVideoData({
      videoId: payload.videoId,
      videoUrl: payload.videoUrl,
      title: payload.title,
      duration: payload.duration,
      sourceType: payload.sourceType,
    })
    setSegments(payload.transcript)
    setCurrentTime(0)
  }

  const handleSaveToDatabase = async (showBannerFlag = true) => {
    if (!videoData) return
    const project: ScriptProjectMetadata = {
      id: videoData.videoId,
      title: videoData.title,
      sourceType: videoData.sourceType,
      sourceUrl: videoData.sourceType === 'url' ? videoData.videoUrl : undefined,
      duration: videoData.duration,
      segments,
      ttsSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const res = await saveScriptProjectMetadata(project)
    if (showBannerFlag) {
      showBanner(
        res.isCloud
          ? 'บันทึกสคริปต์และ Timestamps ลง Supabase PostgreSQL สำเร็จ'
          : 'บันทึกข้อมูลสคริปต์ลง Local Database สำเร็จ'
      )
    }
  }

  const showBanner = (msg: string) => {
    setSavedSuccessBanner(msg)
    setTimeout(() => setSavedSuccessBanner(null), 4000)
  }

  const activeCategory = poolState.activeCategory || 'groq'
  const activeKeysCount = poolState[activeCategory]?.filter((k) => k.isActive && !k.isExhausted).length || 0

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* ── Sub-Header Bar ──────────────────────────────────────────────── */}
      <div className="border-b border-white/[0.08] bg-slate-900/60 backdrop-blur-md px-4 lg:px-8 py-3.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Module Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">AP Smooth: AI Script Video Editor</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                v2.0 Isolated
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ตัดต่อวิดีโอจากสคริปต์ STT → สรุปประเด็นด้วย AI → สร้างเสียงพากย์ Neural TTS
            </p>
          </div>
        </div>

        {/* Right: Engine Status & Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Client-Side Engine Status Pill */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <Cpu className="w-3.5 h-3.5" />
            <span>Browser Engine (100% Client-Side)</span>
          </div>

          {/* Active Key Pool Pill */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border border-purple-500/30 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 transition-all cursor-pointer font-medium"
          >
            <Key className="w-3 h-3 text-purple-400" />
            <span className="capitalize">{activeCategory} Pool ({activeKeysCount} keys)</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 active:scale-95 transition-all cursor-pointer"
            title="ตั้งค่า API Key Pool (Settings)"
          >
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span>Settings</span>
          </button>

          {/* Actions in Editor Mode */}
          {videoData && (
            <>
              <button
                type="button"
                onClick={() => handleSaveToDatabase(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-white/10 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-indigo-400" />
                <span>บันทึก</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ส่งออก</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Success Banner ───────────────────────────────────────────────── */}
      {savedSuccessBanner && (
        <div className="bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 px-4 py-2.5 text-xs flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedSuccessBanner}</span>
        </div>
      )}

      {/* ── Main Workspace ───────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {!videoData ? (
          /* ── Step 1: Input Page ──────────────────────────────────────── */
          <div className="max-w-3xl mx-auto py-8">
            <div className="text-center mb-8 space-y-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI-Powered Text-Based Video Editor
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                นำเข้าวิดีโอเพื่อเริ่มต้นตัดต่อตามสคริปต์
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                อัปโหลดไฟล์วิดีโอหรือเสียงจากเครื่อง — ระบบจะถอดเสียงด้วย Groq Whisper AI
                โดยตรงจากเบราว์เซอร์ ไม่ต้องติดตั้งซอฟต์แวร์ใดๆ
              </p>
            </div>

            <VideoInput
              onVideoAndTranscriptReady={handleVideoAndTranscriptReady}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>
        ) : (
          /* ── Step 2: Editor Studio ────────────────────────────────────── */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (confirm('ต้องการเปลี่ยนวิดีโอใหม่หรือไม่? การแก้ไขที่ยังไม่ได้บันทึกอาจสูญหาย')) {
                    setVideoData(null)
                    setSegments([])
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>เปลี่ยนวิดีโอ / นำเข้าใหม่</span>
              </button>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Local Temp Engine Safe & Isolated</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Video Player + TTS Voice Mixer */}
              <div className="lg:col-span-5 space-y-6">
                <VideoPlayerPreview
                  videoUrl={videoData.videoUrl}
                  title={videoData.title}
                  segments={segments}
                  currentTime={currentTime}
                  onTimeUpdate={(t) => setCurrentTime(t)}
                />
                <TTSVoiceMixer
                  settings={ttsSettings}
                  onChangeSettings={setTtsSettings}
                  scriptPreviewText={segments
                    .flatMap((s) => s.words.filter((w) => !w.isDeleted).map((w) => w.text))
                    .join(' ')}
                />
              </div>

              {/* Right Column: AI Script & Timeline Editor */}
              <div className="lg:col-span-7">
                <ScriptEditorView
                  segments={segments}
                  onUpdateSegments={setSegments}
                  onSeekToTime={(t) => setCurrentTime(t)}
                  currentTime={currentTime}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        segments={segments}
        ttsSettings={ttsSettings}
      />

      <ApiSettingsModal
        isOpen={isSettingsOpen}
        onClose={handleSettingsClose}
      />
    </div>
  )
}

export default ScriptEditorPage
