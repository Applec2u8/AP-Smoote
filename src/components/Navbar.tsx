import {
  Sparkles,
  Database,
  History,
  Settings,
  Film,
  Menu,
  X,
} from 'lucide-react'
import { Language, translations } from '../utils/i18n'
import { useState } from 'react'

interface NavbarProps {
  projectName: string
  setProjectName: (name: string) => void
  hasVideo: boolean
  isSupabaseConnected: boolean
  onOpenHistory: () => void
  onOpenSettings: () => void
  onLoadDemo: () => void
  isGeneratingDemo: boolean
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  projectsCount?: number
  isAutoSaved?: boolean
  lang: Language
  setLang: (lang: Language) => void
}

export const Navbar: React.FC<NavbarProps> = ({
  projectName,
  setProjectName,
  hasVideo,
  isSupabaseConnected,
  onOpenHistory,
  onOpenSettings,
  onLoadDemo,
  isGeneratingDemo,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  projectsCount = 0,
  isAutoSaved = false,
  lang,
  setLang,
}) => {
  const t = translations[lang]
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleMobileAction = (action: () => void) => {
    action()
    setMobileMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090b10]/95 backdrop-blur-md px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Brand Logo & Project Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 shadow-md shadow-violet-500/25 ring-1 ring-white/20 group-hover:scale-105 transition-transform shrink-0">
              <Film className="w-4 h-4 text-white" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-violet-300 bg-clip-text text-transparent">
                  {t.appTitle}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 whitespace-nowrap">
                  {t.aiBlend}
                </span>
              </div>
            </div>
          </div>

          {/* Project Name editable (Large screens) */}
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-white/10">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder={t.untitledProject}
              className="bg-transparent text-xs sm:text-sm font-medium text-slate-200 hover:bg-white/[0.04] focus:bg-white/[0.08] focus:text-white px-2 py-1 rounded-md border border-transparent focus:border-violet-500/50 outline-none transition-all w-36 xl:w-48 truncate"
              title="Click to rename project"
            />
            {hasVideo && isAutoSaved && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-full whitespace-nowrap animate-in fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{t.autoSavedBadge}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Controls: Desktop Toolbar vs Mobile Hamburger */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Language Switcher (Always visible on all screens) */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/90 border border-white/10 text-[11px] sm:text-xs shadow-inner shrink-0">
            <button
              onClick={() => setLang('la')}
              className={`px-2 py-1 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer ${lang === 'la'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
              title="ພາສາລາວ (Lao)"
            >
              LA
            </button>
            <button
              onClick={() => setLang('en')}
              className={`px-2 py-1 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer ${lang === 'en'
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
              title="English"
            >
              EN
            </button>
          </div>

          {/* Desktop Toolbar (Hidden on Mobile < md) */}
          <div className="hidden md:flex items-center gap-2">
            {/* Quick Demo Video Button */}
            {!hasVideo && (
              <button
                onClick={onLoadDemo}
                disabled={isGeneratingDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 rounded-lg transition-all shadow-sm hover:shadow-cyan-500/10 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>{isGeneratingDemo ? t.generatingDemoBtn : t.tryDemoBtn}</span>
              </button>
            )}

            {/* Project Workspace Button */}
            <button
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 group"
              title={t.projectManagerBtn}
            >
              <History className="w-3.5 h-3.5 text-violet-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span>{t.projectManagerBtn}</span>
              {projectsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 font-mono text-[10px]">
                  {projectsCount}
                </span>
              )}
            </button>

            {/* Supabase Status Badge */}
            <button
              onClick={onOpenSettings}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 ${isSupabaseConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
                : 'bg-amber-950/30 text-amber-300 border-amber-500/30 hover:bg-amber-900/40'
                }`}
              title={
                isSupabaseConnected
                  ? t.supabaseConnectedTooltip
                  : t.supabaseLocalTooltip
              }
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>{isSupabaseConnected ? t.supabaseSync : t.localMode}</span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${isSupabaseConnected ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
              />
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/70 border border-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
              title={t.settingsBtn}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Hamburger Button (Visible ONLY on Mobile < md) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors cursor-pointer"
            title="Menu"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-violet-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu Drawer (Shows: ຕົວຢ່າງ, ປະຫວັດ, setting) */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 pt-2 pb-1 border-t border-white/[0.08] animate-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col gap-1.5 bg-[#12141e] border border-white/[0.08] rounded-xl p-2 shadow-2xl">
            {/* 1. ຕົວຢ່າງ (Demo Video) */}
            {!hasVideo && (
              <button
                onClick={() => handleMobileAction(onLoadDemo)}
                disabled={isGeneratingDemo}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition-all text-left cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{isGeneratingDemo ? t.generatingDemoBtn : 'ຕົວຢ່າງ (Demo Video)'}</span>
              </button>
            )}

            {/* 2. ໂປຣເຈັກ & ປະຫວັດ (Project Workspace) */}
            <button
              onClick={() => handleMobileAction(onOpenHistory)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-white/[0.06] transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4 text-violet-400 shrink-0" />
                <span>{t.projectManagerBtn}</span>
              </div>
              {projectsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-violet-500/20 text-violet-300 font-mono text-[10px]">
                  {projectsCount}
                </span>
              )}
            </button>

            {/* 3. Setting (Supabase & System Settings) */}
            <button
              onClick={() => handleMobileAction(onOpenSettings)}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-white/[0.06] transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Setting (Supabase & ຕັ້ງຄ່າ)</span>
              </div>

              {/* Supabase status inside mobile setting button */}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${isSupabaseConnected
                ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/60 border-amber-500/30 text-amber-300'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>{isSupabaseConnected ? 'Sync' : 'Local'}</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
