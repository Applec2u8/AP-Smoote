import React, { useState, useRef } from 'react'
import { UploadCloud, Film, Sparkles, ShieldCheck, Zap, HardDrive } from 'lucide-react'
import { Language, translations } from '../utils/i18n'

interface VideoUploaderProps {
  onVideoSelected: (file: File) => void
  onLoadDemo: () => void
  isGeneratingDemo: boolean
  lang: Language
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoSelected,
  onLoadDemo,
  isGeneratingDemo,
  lang,
}) => {
  const t = translations[lang]
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (file.type.startsWith('video/')) {
        onVideoSelected(file)
      } else {
        alert(t.invalidVideoAlert)
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (file.type.startsWith('video/')) {
        onVideoSelected(file)
      }
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-2 sm:py-6 md:py-8 px-0 sm:px-2 md:px-4">
      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl border-2 border-dashed p-4 sm:p-8 md:p-12 text-center transition-all duration-300 overflow-hidden w-full ${
          isDragging
            ? 'border-violet-500 bg-violet-950/20 shadow-2xl shadow-violet-500/20 scale-[1.01]'
            : 'border-slate-800 hover:border-violet-500/60 bg-gradient-to-b from-[#12141f]/70 to-[#0d0f17]/90 hover:bg-[#141724]/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Background ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-600/15 transition-all"></div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 mb-3 sm:mb-4 rounded-2xl bg-gradient-to-tr from-violet-600/20 via-indigo-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-110 group-hover:text-violet-300 transition-all shadow-inner shadow-white/5">
            <UploadCloud className="w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 animate-bounce group-hover:text-cyan-300" />
          </div>

          <h3 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2 tracking-tight">
            {t.dropTitle}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-4 sm:mb-6 leading-relaxed">
            {t.dropSubtitle} <span className="text-slate-200 font-semibold">MP4, WebM, MOV</span>
          </p>

          <div className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs sm:text-sm shadow-lg shadow-violet-600/30 group-hover:shadow-violet-600/50 transition-all whitespace-nowrap">
            <Film className="w-4 h-4 shrink-0" />
            <span>{t.selectVideoBtn}</span>
          </div>

          {/* Privacy & Client-side Assurance Badge (Clean grid on small screens) */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/[0.06] w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] sm:text-xs text-slate-400 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-cyan-400/90">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{t.badgeLocal}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-slate-400">
              <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
              <span>{t.badgeNoStorage}</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-400/90">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t.badgeHwAccel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alternative: Load Demo Video */}
      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl bg-[#11131c]/60 border border-white/[0.06]">
        <div className="flex items-center gap-2.5 sm:gap-3 text-left w-full sm:w-auto">
          <div className="p-2 sm:p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-semibold text-slate-200">{t.noVideoPrompt}</p>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-snug">{t.noVideoDesc}</p>
          </div>
        </div>

        <button
          onClick={onLoadDemo}
          disabled={isGeneratingDemo}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 rounded-lg transition-all shadow-sm hover:shadow-cyan-500/20 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{isGeneratingDemo ? t.preparingDemo : t.testWithDemoBtn}</span>
        </button>
      </div>
    </div>
  )
}
