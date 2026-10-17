import React, { useState, useEffect, useCallback } from 'react'
import { Navbar } from './components/Navbar'
import { VideoUploader } from './components/VideoUploader'
import { VideoPreview } from './components/VideoPreview'
import { ControlPanel } from './components/ControlPanel'
import { ExportModal } from './components/ExportModal'
import { HistoryModal } from './components/HistoryModal'
import { SupabaseConfigModal } from './components/SupabaseConfigModal'
import { generateDemoVideoBlob } from './utils/sampleVideo'
import {
  saveProjectMetadata,
  fetchProjectHistory,
  deleteProjectMetadata,
  isSupabaseConfigured,
} from './utils/supabase'
import { ProjectMetadata, SmoothSettings, VideoMetadata } from './types'
import { Language, translations } from './utils/i18n'
import {
  Sparkles,
  Layers,
  Zap,
  ShieldCheck,
  Upload,
} from 'lucide-react'

export const defaultSmoothSettings: SmoothSettings = {
  intensity: 65,
  mode: 'blend',
  frameSamples: 5,
  blendDecay: 0.65,
  sharpness: 15,
  brightness: 100,
  contrast: 105,
  enableStabilizeSim: false,
}

export function App() {
  // Language State (Defaults to Lao 'la', supports 'en')
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('smoot_lang')
    return (saved === 'en' || saved === 'la') ? saved : 'la'
  })

  const t = translations[lang]

  const handleSetLang = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem('smoot_lang', newLang)
  }

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [projectName, setProjectName] = useState(() => (lang === 'la' ? 'ໂປຣເຈັກ Smoot' : 'My Smooth Project'))
  const [smoothSettings, setSmoothSettings] = useState<SmoothSettings>(defaultSmoothSettings)

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Status & History
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectMetadata[]>([])

  // Check Supabase connection and load history
  const reloadSupabaseStatus = useCallback(async () => {
    const configured = isSupabaseConfigured()
    setIsSupabaseConnected(configured)
    const list = await fetchProjectHistory()
    setProjects(list)
  }, [])

  useEffect(() => {
    reloadSupabaseStatus()
  }, [reloadSupabaseStatus])

  // Revoke object URLs to avoid memory leaks
  const cleanCurrentVideoUrl = () => {
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl)
    }
  }

  // Handle local video selection
  const handleVideoSelected = (file: File) => {
    cleanCurrentVideoUrl()
    const url = URL.createObjectURL(file)
    setVideoFile(file)
    setVideoUrl(url)
    const cleanName = file.name.replace(/\.[^/.]+$/, '')
    setProjectName(cleanName || (lang === 'la' ? 'ໂປຣເຈັກ Smoot' : 'My Smooth Project'))

    // Initial placeholder metadata until video loads
    setMetadata({
      name: file.name,
      size: file.size,
      type: file.type,
      duration: 0,
      width: 0,
      height: 0,
      aspectRatio: 16 / 9,
    })
  }

  // Handle Demo Video Generation
  const handleLoadDemo = async () => {
    cleanCurrentVideoUrl()
    setIsGeneratingDemo(true)
    try {
      const demo = await generateDemoVideoBlob()
      setVideoUrl(demo.url)
      setVideoFile(new File([demo.blob], demo.name, { type: 'video/webm' }))
      setProjectName(lang === 'la' ? 'ວິດີໂອຕົວຢ່າງ Motion (30 FPS)' : 'Motion Demo (30 FPS)')
      setMetadata({
        name: demo.name,
        size: demo.blob.size,
        type: 'video/webm',
        duration: 4.5,
        width: 1280,
        height: 720,
        aspectRatio: 16 / 9,
      })
      // Preset recommendation for demo motion
      setSmoothSettings((prev) => ({
        ...prev,
        intensity: 80,
        mode: 'blend',
        frameSamples: 6,
        blendDecay: 0.7,
      }))
    } catch (err) {
      console.error('Failed to create demo video:', err)
      alert('Error creating demo video')
    } finally {
      setIsGeneratingDemo(false)
    }
  }

  // Handle Save Project Metadata
  const handleSaveProject = async () => {
    setIsSaving(true)
    try {
      const payload: ProjectMetadata = {
        project_name: projectName,
        video_name: metadata?.name || videoFile?.name || 'video',
        video_size: metadata?.size || videoFile?.size || 0,
        duration: metadata?.duration || 0,
        width: metadata?.width || 0,
        height: metadata?.height || 0,
        smooth_settings: smoothSettings,
        export_settings: {
          fps: 60,
          resolution: '1080p',
          quality: 'high',
          format: 'webm',
        },
      }

      const res = await saveProjectMetadata(payload)
      if (res.success) {
        const timeStr = new Date().toLocaleTimeString()
        setLastSavedAt(timeStr)
        const updatedList = await fetchProjectHistory()
        setProjects(updatedList)
      }
    } catch (err) {
      console.warn('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Load project from history
  const handleSelectProject = (proj: ProjectMetadata) => {
    setProjectName(proj.project_name)
    if (proj.smooth_settings) {
      setSmoothSettings(proj.smooth_settings)
    }
  }

  // Handle Delete project from history
  const handleDeleteProject = async (id: string) => {
    await deleteProjectMetadata(id)
    const updated = await fetchProjectHistory()
    setProjects(updated)
  }

  const handleResetSettings = () => {
    setSmoothSettings(defaultSmoothSettings)
  }

  const handleClearVideo = () => {
    cleanCurrentVideoUrl()
    setVideoUrl(null)
    setVideoFile(null)
    setMetadata(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#08090e] text-slate-100 selection:bg-violet-600/30 selection:text-violet-200">
      {/* Top Navbar */}
      <Navbar
        projectName={projectName}
        setProjectName={setProjectName}
        hasVideo={Boolean(videoUrl)}
        isSupabaseConnected={isSupabaseConnected}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLoadDemo={handleLoadDemo}
        isGeneratingDemo={isGeneratingDemo}
        lang={lang}
        setLang={handleSetLang}
      />

      {/* Main Content Area (Full screen width on mobile, max-7xl on desktop) */}
      <main className="flex-1 flex flex-col w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 md:px-6 md:py-8">
        {!videoUrl ? (
          /* Landing & Video Uploader View */
          <div className="flex-1 flex flex-col justify-center items-center py-2 sm:py-6 w-full">
            {/* Hero Header (Balanced, non-wrapping on mobile, full width) */}
            <div className="text-center w-full max-w-3xl mx-auto mb-5 sm:mb-8 space-y-2.5 sm:space-y-4 px-1 sm:px-2">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 text-[10px] sm:text-xs font-semibold shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span>{t.heroBadge}</span>
              </div>

              <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-snug sm:leading-relaxed">
                <span>{t.heroTitle1}</span>
                <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                  {t.heroTitle2}
                </span>
              </h1>

              <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed px-1">
                {t.heroDesc}
              </p>
            </div>

            {/* Video Uploader Card */}
            <VideoUploader
              onVideoSelected={handleVideoSelected}
              onLoadDemo={handleLoadDemo}
              isGeneratingDemo={isGeneratingDemo}
              lang={lang}
            />

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-4xl w-full mt-8 sm:mt-12 text-left px-2 sm:px-0">
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#10121b]/60 border border-white/[0.06] space-y-1.5 sm:space-y-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">{t.feat1Title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {t.feat1Desc}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#10121b]/60 border border-white/[0.06] space-y-1.5 sm:space-y-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">{t.feat2Title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {t.feat2Desc}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#10121b]/60 border border-white/[0.06] space-y-1.5 sm:space-y-2 sm:col-span-2 lg:col-span-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">{t.feat3Title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {t.feat3Desc}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor Workspace (Responsive across Mobile, Tablet, PC) */
          <div className="flex-1 flex flex-col gap-3 sm:gap-4">
            {/* Top Workspace Bar */}
            <div className="flex items-center justify-between pb-1 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-md bg-white/[0.06] text-slate-300 truncate max-w-[160px] sm:max-w-[240px]">
                  {metadata?.name || 'video'}
                </span>
                {metadata && metadata.width > 0 && (
                  <span className="text-[11px] sm:text-xs text-slate-400 hidden sm:inline font-mono">
                    {metadata.width}×{metadata.height} ({metadata.duration.toFixed(1)}{t.seconds})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-slate-200 cursor-pointer transition-colors whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{t.changeVideo}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoSelected(e.target.files[0])
                      }
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleClearVideo}
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-transparent hover:border-red-500/20 text-xs transition-colors cursor-pointer whitespace-nowrap"
                  title={t.closeVideo}
                >
                  {t.closeVideo}
                </button>
              </div>
            </div>

            {/* Split Editor Grid: Left = Video Preview, Right = Control Panel */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
              {/* Video Player Column */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-[300px] sm:min-h-[420px] lg:min-h-[500px]">
                <VideoPreview
                  videoUrl={videoUrl}
                  metadata={metadata}
                  smoothSettings={smoothSettings}
                  onVideoLoaded={(meta) => {
                    setMetadata((prev) => ({
                      ...prev,
                      ...meta,
                      name: videoFile?.name || prev?.name || 'video',
                    }))
                  }}
                  lang={lang}
                />
              </div>

              {/* Control Panel Column */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col h-full">
                <ControlPanel
                  settings={smoothSettings}
                  setSettings={setSmoothSettings}
                  metadata={metadata}
                  onOpenExport={() => setIsExportOpen(true)}
                  onSaveProject={handleSaveProject}
                  isSaving={isSaving}
                  lastSavedAt={lastSavedAt}
                  onResetSettings={handleResetSettings}
                  lang={lang}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {videoUrl && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          videoSrc={videoUrl}
          metadata={metadata}
          smoothSettings={smoothSettings}
          projectName={projectName}
          lang={lang}
        />
      )}

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        projects={projects}
        onSelectProject={handleSelectProject}
        onDeleteProject={handleDeleteProject}
        isSupabaseConnected={isSupabaseConnected}
        lang={lang}
      />

      <SupabaseConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigUpdated={reloadSupabaseStatus}
        lang={lang}
      />
    </div>
  )
}

export default App
