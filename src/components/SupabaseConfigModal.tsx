import React, { useState, useEffect } from 'react'
import {
  X,
  Database,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ShieldCheck,
  Save,
  Lock,
  EyeOff,
  RefreshCw,
  Sliders,
} from 'lucide-react'
import {
  getEffectiveSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  getMaskedSupabaseUrl,
  getSupabase,
  isSupabaseConfigured,
} from '../utils/supabase'
import { Language, translations } from '../utils/i18n'

interface SupabaseConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onConfigUpdated: () => void
  lang: Language
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
  lang,
}) => {
  const t = translations[lang]
  const isConfigured = isSupabaseConfigured()
  const maskedUrl = getMaskedSupabaseUrl()

  // Custom Override Form (starts EMPTY to ensure secrets are NEVER in DOM)
  const [showOverride, setShowOverride] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newKey, setNewKey] = useState('')

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [copiedSql, setCopiedSql] = useState(false)

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

  const sqlSchema = `-- Schema for video_projects (Stores only metadata, zero video blobs)
CREATE TABLE IF NOT EXISTS video_projects (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  video_name TEXT,
  video_size BIGINT,
  duration NUMERIC,
  width INT,
  height INT,
  smooth_settings JSONB,
  export_settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and public policy
ALTER TABLE video_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all access" ON video_projects FOR ALL USING (true) WITH CHECK (true);`

  const handleTestAndSave = async () => {
    if (!newUrl.trim() && !newKey.trim()) {
      // Just test current configuration
      setTestStatus('testing')
      setTestMessage(t.testingMsg)

      const supabase = getSupabase()
      if (!supabase) {
        setTestStatus('error')
        setTestMessage(t.testInvalidUrlMsg)
        return
      }

      try {
        const { error } = await supabase.from('video_projects').select('id').limit(1)
        if (error && error.code !== 'PGRST116') {
          setTestStatus('error')
          setTestMessage(`Supabase error: ${error.message}`)
        } else {
          setTestStatus('success')
          setTestMessage(t.testSuccessMsg)
        }
      } catch (err: any) {
        setTestStatus('error')
        setTestMessage(`Connection error: ${err.message}`)
      }
      return
    }

    // Save custom override
    setTestStatus('testing')
    setTestMessage(t.testingMsg)

    saveCustomSupabaseConfig({ url: newUrl.trim(), key: newKey.trim() })

    // Instantly wipe inputs from DOM for maximum security
    setNewUrl('')
    setNewKey('')
    setShowOverride(false)

    const supabase = getSupabase()
    if (!supabase) {
      setTestStatus('error')
      setTestMessage(t.testInvalidUrlMsg)
      return
    }

    try {
      const { error } = await supabase.from('video_projects').select('id').limit(1)
      if (error && error.code !== 'PGRST116') {
        setTestStatus('error')
        setTestMessage(`Supabase error: ${error.message}`)
      } else {
        setTestStatus('success')
        setTestMessage(t.testSuccessMsg)
      }
    } catch (err: any) {
      setTestStatus('error')
      setTestMessage(`Connection error: ${err.message}`)
    }

    onConfigUpdated()
  }

  const handleResetToEnv = () => {
    clearCustomSupabaseConfig()
    setNewUrl('')
    setNewKey('')
    setShowOverride(false)
    setTestStatus('idle')
    setTestMessage('')
    onConfigUpdated()
  }

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchema)
    setCopiedSql(true)
    setTimeout(() => setCopiedSql(false), 2000)
  }

  // Prevent copying of protected tokens
  const preventSecretCopy = (e: React.ClipboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#0f121d] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>{t.supabaseModalTitle}</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30">
                  Protected
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {t.supabaseModalSubtitle}
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-xs">
          {/* Strict Token Security Notice */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-violet-950/40 border border-violet-500/30 text-violet-200 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white flex items-center gap-1.5">
                <span>{t.tokenSecurityTitle}</span>
              </p>
              <p className="text-[11px] text-violet-300/90 mt-0.5 leading-relaxed">
                {t.tokenSecurityDesc}
              </p>
            </div>
          </div>

          {/* Connection Status & Masked Display (NEVER renders secret in DOM value) */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-[#131622] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold">{t.connectedServerTitle}</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isConfigured
                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/30 text-amber-300'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                <span>{isConfigured ? t.connectedStatusActive : t.connectedStatusLocal}</span>
              </span>
            </div>

            {/* Masked URL Display (Copy & Inspection Protected) */}
            <div>
              <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                {t.maskedUrlLabel}
              </label>
              <div
                onCopy={preventSecretCopy}
                onCut={preventSecretCopy}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-slate-300 font-mono text-xs select-none secure-masked-field flex items-center justify-between"
              >
                <span className="truncate">{maskedUrl || 'https://••••••••••••••••'}</span>
                <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-2" />
              </div>
            </div>

            {/* Masked Key Display (Pure bullet characters in DOM, zero token leak) */}
            <div>
              <label className="block text-slate-400 font-medium mb-1 text-[11px]">
                {t.maskedKeyLabel}
              </label>
              <div
                onCopy={preventSecretCopy}
                onCut={preventSecretCopy}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-slate-400 font-mono text-xs select-none secure-masked-field flex items-center justify-between tracking-widest"
              >
                <span>••••••••••••••••••••••••••••••••</span>
                <span className="text-[10px] text-emerald-400/90 font-sans tracking-normal flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Masked 100%</span>
                </span>
              </div>
            </div>
          </div>

          {/* Test Status feedback */}
          {testStatus !== 'idle' && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                testStatus === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
                  : testStatus === 'testing'
                  ? 'bg-cyan-950/50 border-cyan-500/30 text-cyan-300'
                  : 'bg-amber-950/50 border-amber-500/30 text-amber-300'
              }`}
            >
              {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {testStatus === 'error' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              <span className="truncate">{testMessage}</span>
            </div>
          )}

          {/* Toggle Custom Key Override (Inputs start empty, values wiped on save) */}
          <div className="border border-white/[0.08] rounded-xl p-3 sm:p-4 bg-slate-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-200 text-xs">{t.overrideCredentialsBtn}</p>
                <p className="text-[10px] text-slate-400">{t.overrideCredentialsDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowOverride(!showOverride)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors cursor-pointer"
              >
                {showOverride ? t.closeWord : 'ປ້ອນ Key ໃໝ່'}
              </button>
            </div>

            {showOverride && (
              <div className="space-y-3 pt-2 border-t border-white/[0.06] animate-in fade-in">
                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-[11px]">
                    Supabase URL (ໃໝ່)
                  </label>
                  <input
                    type="text"
                    placeholder={t.enterNewUrlPlaceholder}
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1 text-[11px]">
                    Publishable Key (ໃໝ່)
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    placeholder={t.enterNewKeyPlaceholder}
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={handleResetToEnv}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t.clearOverrideBtn}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SQL Setup Helper */}
          <div className="space-y-2 pt-1 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300">
                {t.sqlHelperTitle}
              </span>
              <button
                onClick={copySql}
                className="text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedSql ? t.copiedSqlBtn : t.copySqlBtn}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 border border-white/[0.06] rounded-xl text-[10px] text-slate-400 overflow-x-auto font-mono max-h-28">
              {sqlSchema}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-white/[0.08] bg-slate-900/40 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {t.closeWord}
          </button>

          <button
            onClick={handleTestAndSave}
            disabled={testStatus === 'testing'}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-lg shadow-violet-600/30 transition-all cursor-pointer whitespace-nowrap"
          >
            <Save className="w-4 h-4" />
            <span>{t.testAndSaveBtn}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
