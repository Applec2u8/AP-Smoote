import React, { useEffect, useState } from 'react'
import {
  X,
  History,
  Trash2,
  Clock,
  Video,
  Sparkles,
  FolderOpen,
  PlusCircle,
  HardDrive,
  Cloud,
  Film,
  Scissors,
  CheckCircle,
} from 'lucide-react'
import { ProjectItem, ProjectMetadata } from '../types'
import { Language, translations } from '../utils/i18n'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  localProjects: ProjectItem[]
  onOpenLocalProject: (proj: ProjectItem) => void
  onDeleteLocalProject: (id: string) => void
  onNewProject: () => void
  cloudProjects: ProjectMetadata[]
  onSelectCloudProject: (proj: ProjectMetadata) => void
  onDeleteCloudProject: (id: string) => void
  isSupabaseConnected: boolean
  activeProjectId?: string | null
  lang: Language
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  localProjects,
  onOpenLocalProject,
  onDeleteLocalProject,
  onNewProject,
  cloudProjects,
  onSelectCloudProject,
  onDeleteCloudProject,
  isSupabaseConnected,
  activeProjectId,
  lang,
}) => {
  const t = translations[lang]
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB'
    const mb = bytes / (1024 * 1024)
    if (mb >= 1000) {
      return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(1)} MB`
  }

  const handleDeleteLocal = (id: string) => {
    if (deleteConfirmId === id) {
      onDeleteLocalProject(id)
      setDeleteConfirmId(null)
    } else {
      setDeleteConfirmId(id)
      setTimeout(() => {
        setDeleteConfirmId((curr) => (curr === id ? null : curr))
      }, 4000)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#0e111a] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/[0.08] bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>{t.historyModalTitle}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.historyModalSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewProject()
                onClose()
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap"
              title={t.newProjectBtn}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{t.newProjectBtn}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector: Local Projects (IndexedDB) vs Cloud History (Supabase) */}
        <div className="px-5 sm:px-6 pt-3 pb-2 border-b border-white/[0.06] bg-slate-950/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-900/90 border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('local')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t.tabLocalProjects}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
                {localProjects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('cloud')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                activeTab === 'cloud'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>{t.tabCloudProjects}</span>
              {cloudProjects.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
                  {cloudProjects.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>IndexedDB 100% Local Storage</span>
          </div>
        </div>

        {/* List Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 min-h-[280px]">
          {activeTab === 'local' ? (
            /* TAB 1: LOCAL PROJECTS IN INDEXEDDB (With Video Blobs & 100% Restoration) */
            localProjects.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-950/40 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Film className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-slate-200">{t.noHistoryTitle}</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">{t.noHistoryDesc}</p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onNewProject()
                      onClose()
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t.newProjectBtn}</span>
                  </button>
                </div>
              </div>
            ) : (
              localProjects.map((p) => {
                const isActive = activeProjectId === p.id
                return (
                  <div
                    key={p.id}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 group ${
                      isActive
                        ? 'bg-violet-950/30 border-violet-500/60 shadow-lg shadow-violet-500/10'
                        : 'bg-[#131622]/90 border-white/[0.08] hover:border-violet-500/40'
                    }`}
                  >
                    {/* Thumbnail + Info */}
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                      {/* Video Thumbnail Preview */}
                      <div className="relative w-24 h-14 sm:w-28 sm:h-16 rounded-lg bg-black/70 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                        {p.thumbnailDataUrl ? (
                          <img
                            src={p.thumbnailDataUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-slate-600">
                            <Film className="w-6 h-6" />
                          </div>
                        )}
                        {/* Duration pill overlay */}
                        {p.metadata?.duration > 0 && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[9px] text-white/90">
                            {p.metadata.duration.toFixed(1)}s
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-white truncate max-w-[240px]">
                            {p.name || t.untitledProject}
                          </h4>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono">
                            Smooth: {p.smoothSettings?.intensity ?? 50}%
                          </span>
                          {p.smoothSettings?.playbackSpeed && p.smoothSettings.playbackSpeed < 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                              {p.smoothSettings.playbackSpeed}x
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 flex items-center gap-2 sm:gap-3 flex-wrap">
                          <span className="truncate max-w-[160px] sm:max-w-[220px]">
                            {p.videoName || 'video'}
                          </span>
                          <span className="text-slate-500 font-mono">
                            {formatFileSize(p.videoSize || p.videoBlob?.size || 0)}
                          </span>
                          {p.metadata?.width > 0 && (
                            <span className="font-mono text-slate-400">
                              {p.metadata.width}×{p.metadata.height}
                            </span>
                          )}
                          {p.timeBlocks && p.timeBlocks.length > 1 && (
                            <span className="text-[10px] text-amber-300 font-mono flex items-center gap-1">
                              <Scissors className="w-3 h-3" />
                              {p.timeBlocks.length} cuts
                            </span>
                          )}
                        </p>

                        <p className="text-[10px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {p.updatedAt ? new Date(p.updatedAt).toLocaleString() : ''}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons: Resume Project / Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => {
                          onOpenLocalProject(p)
                          onClose()
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>{t.openProjectBtn}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteLocal(p.id)}
                        className={`p-2 rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1 ${
                          deleteConfirmId === p.id
                            ? 'bg-red-600 text-white font-semibold px-3 animate-pulse'
                            : 'text-slate-500 hover:text-red-400 hover:bg-red-950/40'
                        }`}
                        title={t.deleteItemTooltip}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deleteConfirmId === p.id && <span>Confirm?</span>}
                      </button>
                    </div>
                  </div>
                )
              })
            )
          ) : (
            /* TAB 2: SUPABASE CLOUD HISTORY (Metadata Only) */
            cloudProjects.length === 0 ? (
              <div className="py-14 text-center text-slate-400 space-y-2">
                <Cloud className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm">
                  {isSupabaseConnected ? t.noHistoryTitle : t.historyLocalNotice}
                </p>
                <p className="text-xs text-slate-500">{t.noHistoryDesc}</p>
              </div>
            ) : (
              cloudProjects.map((p) => (
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
                        onSelectCloudProject(p)
                        onClose()
                      }}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t.loadConfigBtn}</span>
                    </button>

                    {p.id && (
                      <button
                        onClick={() => onDeleteCloudProject(p.id!)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                        title={t.deleteItemTooltip}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-slate-900/40 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            {isSupabaseConnected ? t.historySyncedNotice : t.historyLocalNotice}
          </p>
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
