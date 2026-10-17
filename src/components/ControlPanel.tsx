import React, { useState } from 'react'
import {
  Sliders,
  Sparkles,
  Layers,
  Wand2,
  Save,
  Download,
  Flame,
  Check,
  RefreshCw,
  Film,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { SmoothSettings, SmoothingMode, VideoMetadata } from '../types'
import { Language, translations } from '../utils/i18n'

interface ControlPanelProps {
  settings: SmoothSettings
  setSettings: React.Dispatch<React.SetStateAction<SmoothSettings>>
  metadata: VideoMetadata | null
  onOpenExport: () => void
  onSaveProject: () => void
  isSaving: boolean
  lastSavedAt: string | null
  onResetSettings: () => void
  lang: Language
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  setSettings,
  metadata,
  onOpenExport,
  onSaveProject,
  isSaving,
  lastSavedAt,
  onResetSettings,
  lang,
}) => {
  const t = translations[lang]
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Presets
  const applyPreset = (name: string) => {
    switch (name) {
      case 'silky':
        setSettings((prev) => ({
          ...prev,
          intensity: 75,
          mode: 'blend',
          frameSamples: 5,
          blendDecay: 0.6,
          sharpness: 20,
        }))
        break
      case 'cinematic':
        setSettings((prev) => ({
          ...prev,
          intensity: 60,
          mode: 'motion_blur',
          frameSamples: 4,
          blendDecay: 0.45,
          sharpness: 10,
        }))
        break
      case 'action':
        setSettings((prev) => ({
          ...prev,
          intensity: 45,
          mode: 'blend',
          frameSamples: 3,
          blendDecay: 0.75,
          sharpness: 30,
        }))
        break
      case 'ultra':
        setSettings((prev) => ({
          ...prev,
          intensity: 95,
          mode: 'blend',
          frameSamples: 7,
          blendDecay: 0.72,
          sharpness: 25,
        }))
        break
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0f17]/90 rounded-2xl border border-white/[0.08] backdrop-blur-xl p-4 sm:p-5 shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">{t.controlTitle}</h2>
            <p className="text-[11px] text-slate-400">{t.controlSubtitle}</p>
          </div>
        </div>

        <button
          onClick={onResetSettings}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] rounded-md transition-colors cursor-pointer"
          title={t.resetDefaultTooltip}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 py-4 space-y-6">
        {/* Main Smooth Intensity Slider */}
        <div className="space-y-2.5 p-3.5 rounded-xl bg-[#141724]/70 border border-violet-500/20 shadow-inner">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>{t.intensityLabel}</span>
            </label>
            <span className="text-sm font-mono font-bold text-violet-300 bg-violet-950/80 px-2 py-0.5 rounded border border-violet-500/30">
              {settings.intensity}%
            </span>
          </div>

          <div className="relative pt-1">
            <input
              type="range"
              min={0}
              max={100}
              value={settings.intensity}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, intensity: parseInt(e.target.value) }))
              }
              className="w-full"
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 px-0.5">
            <span>{t.intensityRaw}</span>
            <span>{t.intensityNatural}</span>
            <span>{t.intensityMax}</span>
          </div>
        </div>

        {/* Presets Quick Pills */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.presetsLabel}</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyPreset('silky')}
              className="px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-violet-950/40 hover:text-violet-200 hover:border-violet-500/30 border border-white/[0.06] transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <span>{t.silkyPreset}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-violet-300">75%</span>
            </button>
            <button
              onClick={() => applyPreset('cinematic')}
              className="px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-violet-950/40 hover:text-violet-200 hover:border-violet-500/30 border border-white/[0.06] transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <span>{t.cinematicPreset}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-violet-300">60%</span>
            </button>
            <button
              onClick={() => applyPreset('action')}
              className="px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-violet-950/40 hover:text-violet-200 hover:border-violet-500/30 border border-white/[0.06] transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <span>{t.actionPreset}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-violet-300">45%</span>
            </button>
            <button
              onClick={() => applyPreset('ultra')}
              className="px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-800/60 hover:bg-violet-950/40 hover:text-violet-200 hover:border-violet-500/30 border border-white/[0.06] transition-all text-left flex items-center justify-between group cursor-pointer"
            >
              <span>{t.ultraPreset}</span>
              <span className="text-[10px] text-slate-400 group-hover:text-violet-300">95%</span>
            </button>
          </div>
        </div>

        {/* Algorithm Modes */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.algorithmLabel}</span>
          </label>
          <div className="grid grid-cols-1 gap-2">
            {[
              {
                id: 'blend' as SmoothingMode,
                title: t.algoBlendTitle,
                desc: t.algoBlendDesc,
              },
              {
                id: 'motion_blur' as SmoothingMode,
                title: t.algoBlurTitle,
                desc: t.algoBlurDesc,
              },
              {
                id: 'interpolation' as SmoothingMode,
                title: t.algoInterpTitle,
                desc: t.algoInterpDesc,
              },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSettings((prev) => ({ ...prev, mode: m.id }))}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.mode === m.id
                    ? 'bg-violet-950/50 border-violet-500/50 text-white shadow-sm shadow-violet-500/10'
                    : 'bg-slate-900/40 border-white/[0.06] text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{m.title}</span>
                  {settings.mode === m.id && <Check className="w-3.5 h-3.5 text-violet-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Advanced Parameters */}
        <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-slate-900/30">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.advancedTuning}</span>
            </span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showAdvanced && (
            <div className="p-3.5 pt-1 space-y-4 border-t border-white/[0.06] text-xs">
              {/* Blend Decay */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{t.blendDecay}</span>
                  <span className="font-mono text-slate-200">
                    {Math.round(settings.blendDecay * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={0.9}
                  step={0.05}
                  value={settings.blendDecay}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, blendDecay: parseFloat(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>

              {/* Detail / Sharpness Boost */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{t.sharpnessBoost}</span>
                  <span className="font-mono text-slate-200">{settings.sharpness}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.sharpness}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, sharpness: parseInt(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>{t.contrastBoost}</span>
                  <span className="font-mono text-slate-200">{settings.contrast}%</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={130}
                  value={settings.contrast}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, contrast: parseInt(e.target.value) }))
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Video Specs Summary */}
        {metadata && (
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/[0.06] text-xs space-y-1.5 text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Film className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.videoMetaTitle}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 font-mono">
              <div>{t.metaResolution} {metadata.width}×{metadata.height}</div>
              <div>{t.metaDuration} {metadata.duration.toFixed(1)} {t.seconds}</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Footer */}
      <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
        {/* Save Metadata to Supabase */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onSaveProject}
            disabled={isSaving}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
            title={t.saveMetaBtn}
          >
            <Save className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isSaving ? t.savingBtn : t.saveMetaBtn}</span>
          </button>
        </div>

        {lastSavedAt && (
          <p className="text-[10px] text-center text-slate-500">
            {t.lastSavedAt} {lastSavedAt}
          </p>
        )}

        {/* Primary Export Button */}
        <button
          onClick={onOpenExport}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Download className="w-4 h-4" />
          <span>{t.exportCtaBtn}</span>
        </button>
      </div>
    </div>
  )
}
