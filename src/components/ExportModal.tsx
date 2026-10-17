import React, { useState, useRef } from 'react'
import {
  X,
  Download,
  Gauge,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { ExportSettings, SmoothSettings, TargetFPS, VideoMetadata } from '../types'
import {
  calculateTargetDimensions,
  exportSmoothedVideo,
  RenderStats,
} from '../utils/videoProcessor'
import { Language, translations } from '../utils/i18n'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  videoSrc: string
  metadata: VideoMetadata | null
  smoothSettings: SmoothSettings
  projectName: string
  lang: Language
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  videoSrc,
  metadata,
  smoothSettings,
  projectName,
  lang,
}) => {
  const t = translations[lang]
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    fps: 60,
    resolution: '1080p',
    quality: 'high',
    format: 'webm',
  })

  const [isExporting, setIsExporting] = useState(false)
  const [progressStats, setProgressStats] = useState<RenderStats>({
    currentFps: 0,
    renderedFrames: 0,
    totalFrames: 0,
    progress: 0,
  })
  const [exportedUrl, setExportedUrl] = useState<string | null>(null)
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const cancelRef = useRef(false)

  if (!isOpen) return null

  // Calculate projected dimensions
  const dims = calculateTargetDimensions(
    metadata?.width || 1920,
    metadata?.height || 1080,
    exportSettings.resolution
  )

  const handleStartExport = async () => {
    setIsExporting(true)
    setErrorMsg(null)
    setExportedUrl(null)
    setExportedBlob(null)
    cancelRef.current = false

    try {
      const blob = await exportSmoothedVideo(
        videoSrc,
        smoothSettings,
        exportSettings,
        (stats) => setProgressStats(stats),
        () => cancelRef.current
      )

      const url = URL.createObjectURL(blob)
      setExportedBlob(blob)
      setExportedUrl(url)
      setIsExporting(false)

      // Trigger confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#a855f7', '#6366f1', '#06b6d4', '#10b981'],
        })
      } catch {
        // ignore
      }

      // Auto trigger download
      triggerDownload(url, blob)
    } catch (err: any) {
      if (!cancelRef.current) {
        setErrorMsg(err.message || 'Export error')
      }
      setIsExporting(false)
    }
  }

  const triggerDownload = (urlToUse?: string, _blobToUse?: Blob) => {
    const url = urlToUse || exportedUrl
    if (!url) return

    const a = document.createElement('a')
    a.href = url
    const safeName = (projectName || 'Smoot_Export').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    a.download = `${safeName}_${exportSettings.fps}fps_${dims.width}x${dims.height}.${exportSettings.format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCancel = () => {
    cancelRef.current = true
    setIsExporting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-[#0f121d] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-600/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {t.exportModalTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {t.exportModalSubtitle}
              </p>
            </div>
          </div>

          {!isExporting && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isExporting && !exportedUrl ? (
            <>
              {/* Framerate Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{t.fpsTargetLabel}</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                  {([30, 60, 120] as TargetFPS[]).map((fpsVal) => (
                    <button
                      key={fpsVal}
                      type="button"
                      onClick={() => setExportSettings((prev) => ({ ...prev, fps: fpsVal }))}
                      className={`p-2 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        exportSettings.fps === fpsVal
                          ? 'bg-violet-950/60 border-violet-500 text-white shadow-lg shadow-violet-600/20 ring-1 ring-violet-500'
                          : 'bg-slate-900/50 border-white/[0.06] text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="text-sm sm:text-lg font-bold font-mono text-white whitespace-nowrap">{fpsVal} FPS</div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 leading-tight">
                        {fpsVal === 30 && t.fps30Desc}
                        {fpsVal === 60 && t.fps60Desc}
                        {fpsVal === 120 && t.fps120Desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Selection */}
              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-violet-400 shrink-0" />
                  <span>{t.resTargetLabel}</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                  {(
                    [
                      { key: 'original', title: t.resOriginalTitle, desc: t.resOriginalDesc },
                      { key: '1080p', title: t.res1080Title, desc: t.res1080Desc },
                      { key: '720p', title: t.res720Title, desc: t.res720Desc },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setExportSettings((prev) => ({ ...prev, resolution: item.key }))
                      }
                      className={`p-2 sm:p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        exportSettings.resolution === item.key
                          ? 'bg-violet-950/60 border-violet-500 text-white shadow-lg shadow-violet-600/20 ring-1 ring-violet-500'
                          : 'bg-slate-900/50 border-white/[0.06] text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="text-xs sm:text-base font-bold text-white whitespace-nowrap">{item.title}</div>
                      <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 leading-tight">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Specs */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">{t.outputDimensions}</span>
                  <span className="font-mono font-semibold text-cyan-300">
                    {dims.width} × {dims.height} px
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">{t.targetSmoothFlow}</span>
                  <span className="font-mono font-semibold text-violet-300">
                    {exportSettings.fps} FPS ({smoothSettings.intensity}% Smooth)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">{t.fileFormat}</span>
                  <span className="font-mono font-semibold text-slate-200">
                    WebM VP9 (High Efficiency)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  {t.exportPrivacyNotice}
                </span>
              </div>
            </>
          ) : isExporting ? (
            /* Exporting Progress View */
            <div className="py-6 flex flex-col items-center text-center space-y-5">
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin flex items-center justify-center"></div>
                <div className="absolute text-xl font-bold font-mono text-white">
                  {progressStats.progress}%
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">{t.renderingTitle}</h4>
                <p className="text-xs text-slate-400">
                  {t.renderingFrameProgress} {progressStats.renderedFrames} {t.ofTotalFrames} {progressStats.totalFrames} {t.framesWord}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 h-full transition-all duration-150"
                  style={{ width: `${progressStats.progress}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between w-full text-xs text-slate-400 font-mono px-1">
                <span>{t.speedWord} {progressStats.currentFps} FPS</span>
                <span>{t.targetFpsWord} {exportSettings.fps} FPS</span>
              </div>

              <button
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-semibold text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
              >
                {t.cancelExportBtn}
              </button>
            </div>
          ) : (
            /* Completed Export View */
            <div className="py-6 flex flex-col items-center text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">{t.exportSuccessTitle}</h4>
                <p className="text-xs text-slate-400 font-mono">
                  {dims.width}×{dims.height} @ {exportSettings.fps} FPS ({((exportedBlob?.size || 0) / (1024 * 1024)).toFixed(2)} MB)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => triggerDownload()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.downloadAgainBtn}</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors cursor-pointer"
                >
                  {t.closeModalBtn}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isExporting && !exportedUrl && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.08] bg-slate-900/40">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              {t.cancelWord}
            </button>
            <button
              onClick={handleStartExport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-400 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.startExportBtn} ({exportSettings.fps} FPS)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
