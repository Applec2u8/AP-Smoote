import React, { useEffect } from 'react'
import { X, History, Trash2, Clock, Video, Sparkles } from 'lucide-react'
import { ProjectMetadata } from '../types'
import { Language, translations } from '../utils/i18n'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  projects: ProjectMetadata[]
  onSelectProject: (proj: ProjectMetadata) => void
  onDeleteProject: (id: string) => void
  isSupabaseConnected: boolean
  lang: Language
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  onDeleteProject,
  isSupabaseConnected,
  lang,
}) => {
  const t = translations[lang]

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0f121d] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {t.historyModalTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {isSupabaseConnected ? t.historySyncedNotice : t.historyLocalNotice}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {projects.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Video className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">{t.noHistoryTitle}</p>
              <p className="text-xs text-slate-500">{t.noHistoryDesc}</p>
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-xl bg-[#141724]/80 border border-white/[0.06] hover:border-violet-500/40 transition-all flex items-center justify-between gap-4 group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">
                      {p.project_name || t.untitledProject}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono">
                      Smooth: {p.smooth_settings?.intensity ?? 50}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 flex items-center gap-3">
                    <span>{t.fileWord} {p.video_name || 'video'}</span>
                    {p.duration > 0 && <span>{t.metaDuration} {p.duration.toFixed(1)}{t.seconds}</span>}
                    {p.width > 0 && (
                      <span className="font-mono">
                        {p.width}×{p.height}
                      </span>
                    )}
                  </p>

                  <p className="text-[10px] text-slate-500 flex items-center gap-1 pt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{p.updated_at ? new Date(p.updated_at).toLocaleString() : ''}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectProject(p)
                      onClose()
                    }}
                    className="px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t.loadConfigBtn}</span>
                  </button>

                  {p.id && (
                    <button
                      onClick={() => onDeleteProject(p.id!)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                      title={t.deleteItemTooltip}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-slate-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            {t.closeWord}
          </button>
        </div>
      </div>
    </div>
  )
}
