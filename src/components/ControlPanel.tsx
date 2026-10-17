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
  Scissors,
  Crop,
  CopyCheck,
  RotateCcw,
} from 'lucide-react'
import {
  SmoothSettings,
  SmoothingMode,
  TimeBlock,
  TrimRange,
  VideoMetadata,
  VideoTransformSettings,
} from '../types'
import { Language, translations } from '../utils/i18n'
import { TimelineTrimmer } from './TimelineTrimmer'
import { AspectResizeControl } from './AspectResizeControl'
import { createExportPlan, formatDuration } from '../utils/videoProcessor'

export type PanelTab = 'trim' | 'smooth' | 'export'

interface ControlPanelProps {
  settings: SmoothSettings
  setSettings: React.Dispatch<React.SetStateAction<SmoothSettings>>
  metadata: VideoMetadata | null
  onOpenExport: () => void
  onSaveProject: () => void
  isSaving: boolean
  lastSavedAt: string | null
  onResetSettings: () => void
  trimRange: TrimRange
  onTrimChange: (range: TrimRange) => void
  timeBlocks?: TimeBlock[]
  onTimeBlocksChange?: (blocks: TimeBlock[]) => void
  selectedBlockId?: string | null
  onSelectBlock?: (id: string) => void
  currentTime: number
  onSeek: (time: number) => void
  isPlaying: boolean
  onTogglePlay: () => void
  transformSettings: VideoTransformSettings
  onTransformChange: (settings: VideoTransformSettings) => void
  activeTab?: PanelTab
  onTabChange?: (tab: PanelTab) => void
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
  trimRange,
  onTrimChange,
  timeBlocks,
  onTimeBlocksChange,
  selectedBlockId,
  onSelectBlock,
  currentTime,
  onSeek,
  isPlaying,
  onTogglePlay,
  transformSettings,
  onTransformChange,
  activeTab: controlledTab,
  onTabChange,
  lang,
}) => {
  const t = translations[lang]
  const [internalTab, setInternalTab] = useState<PanelTab>('trim')
  const currentTab = controlledTab || internalTab

  const handleTabSwitch = (tab: PanelTab) => {
    setInternalTab(tab)
    onTabChange?.(tab)
  }

  const [showAdvanced, setShowAdvanced] = useState(false)

  // Find currently selected block for Per-Cut Settings
  const activeBlock =
    timeBlocks?.find((b) => b.id === selectedBlockId) ||
    timeBlocks?.find((b) => currentTime >= b.start && currentTime <= b.end) ||
    (timeBlocks && timeBlocks[0])

  const activeBlockIndex =
    timeBlocks && activeBlock ? timeBlocks.findIndex((b) => b.id === activeBlock.id) : 0

  // Per-cut smooth and transform values
  const currentSmooth: SmoothSettings = activeBlock?.smoothSettings || settings
  const currentTransform: VideoTransformSettings = activeBlock?.transformSettings || transformSettings

  // Helper to update settings for active block
  const updateActiveSmooth = (updater: (prev: SmoothSettings) => SmoothSettings) => {
    const next = updater(currentSmooth)
    if (activeBlock && timeBlocks && onTimeBlocksChange) {
      const updated = timeBlocks.map((b) =>
        b.id === activeBlock.id ? { ...b, smoothSettings: next } : b
      )
      onTimeBlocksChange(updated)
    }
    setSettings(next)
  }

  // Helper to update transform for active block
  const updateActiveTransform = (next: VideoTransformSettings) => {
    if (activeBlock && timeBlocks && onTimeBlocksChange) {
      const updated = timeBlocks.map((b) =>
        b.id === activeBlock.id ? { ...b, transformSettings: next } : b
      )
      onTimeBlocksChange(updated)
    }
    onTransformChange(next)
  }

  // Copy current settings to all clips
  const handleApplyToAllClips = () => {
    if (!timeBlocks || !onTimeBlocksChange) return
    const updated = timeBlocks.map((b) => ({
      ...b,
      smoothSettings: { ...currentSmooth },
      transformSettings: { ...currentTransform },
    }))
    onTimeBlocksChange(updated)
  }

  // Category-specific Resets
  const resetSpeedCategory = () => {
    updateActiveSmooth((prev) => ({ ...prev, playbackSpeed: 1.0 }))
  }

  const resetIntensityCategory = () => {
    updateActiveSmooth((prev) => ({ ...prev, intensity: 65 }))
  }

  const resetModeCategory = () => {
    updateActiveSmooth((prev) => ({ ...prev, mode: 'blend' }))
  }

  const resetAdvancedCategory = () => {
    updateActiveSmooth((prev) => ({
      ...prev,
      blendDecay: 0.65,
      frameSamples: 5,
      sharpness: 15,
      enableStabilizeSim: false,
    }))
  }

  const resetCropCategory = () => {
    updateActiveTransform({
      aspectRatio: 'original',
      fitMode: 'contain',
      zoom: 1.0,
      panX: 0,
      panY: 0,
    })
  }

  // Presets
  const applyPreset = (name: string) => {
    switch (name) {
      case 'silky':
        updateActiveSmooth((prev) => ({
          ...prev,
          intensity: 75,
          mode: 'blend',
          frameSamples: 5,
          blendDecay: 0.6,
          sharpness: 20,
        }))
        break
      case 'cinematic':
        updateActiveSmooth((prev) => ({
          ...prev,
          intensity: 60,
          mode: 'motion_blur',
          frameSamples: 4,
          blendDecay: 0.45,
          sharpness: 10,
        }))
        break
      case 'action':
        updateActiveSmooth((prev) => ({
          ...prev,
          intensity: 45,
          mode: 'blend',
          frameSamples: 3,
          blendDecay: 0.75,
          sharpness: 30,
        }))
        break
      case 'ultra':
        updateActiveSmooth((prev) => ({
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
    <div className="flex flex-col h-full bg-[#0d0f17]/95 rounded-2xl border border-white/[0.08] backdrop-blur-xl p-3 sm:p-5 shadow-2xl overflow-y-auto max-w-full">
      {/* Header with Title and Global Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">{t.controlTitle}</h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400">{t.controlSubtitle}</p>
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

      {/* Main Navigation Tabs */}
      <div className="flex items-center p-1 mt-3 bg-slate-900/90 rounded-xl border border-white/10 gap-1 text-xs">
        {/* Tab 1: Trim & Cut */}
        <button
          onClick={() => handleTabSwitch('trim')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] touch-manipulation ${
            currentTab === 'trim'
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Scissors className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          <span className="truncate">{t.mobileTabTrim}</span>
        </button>

        {/* Tab 2: Slow & Smooth */}
        <button
          onClick={() => handleTabSwitch('smooth')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] touch-manipulation ${
            currentTab === 'smooth'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0 text-violet-300" />
          <span className="truncate">{t.mobileTabSmooth}</span>
        </button>

        {/* Tab 3: Settings & Export */}
        <button
          onClick={() => handleTabSwitch('export')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap min-h-[40px] touch-manipulation ${
            currentTab === 'export'
              ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0 text-cyan-300" />
          <span className="truncate">{t.mobileTabExport}</span>
        </button>
      </div>

      {/* Per-Cut Banner Indicator (Visible in Tab 2 and Tab 3 when clips are split) */}
      {timeBlocks && timeBlocks.length > 1 && (currentTab === 'smooth' || currentTab === 'export') && (
        <div className="mt-3 p-2 rounded-xl bg-violet-950/40 border border-violet-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-violet-300 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
            <span className="font-semibold truncate">
              ຕັ້ງຄ່າສະເພາະ: ບລັອກ #{activeBlockIndex + 1} ({activeBlock ? `${activeBlock.start.toFixed(1)}s - ${activeBlock.end.toFixed(1)}s` : ''})
            </span>
          </div>
          <button
            onClick={handleApplyToAllClips}
            className="text-[10px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1"
            title="ນຳການຕັ້ງຄ່ານີ້ໄປໃຊ້ກັບທຸກຄລິບ"
          >
            <CopyCheck className="w-3 h-3" />
            <span>ທຸກຄລິບ</span>
          </button>
        </div>
      )}

      {/* Tab Panels Container */}
      <div className="flex-1 py-4 space-y-5">
        {/* TAB 1: Trim & Split/Cut */}
        {currentTab === 'trim' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <TimelineTrimmer
              duration={metadata?.duration || 0}
              currentTime={currentTime}
              timeBlocks={timeBlocks}
              onTimeBlocksChange={onTimeBlocksChange}
              selectedBlockId={selectedBlockId}
              onSelectBlock={onSelectBlock}
              trimRange={trimRange}
              onTrimChange={onTrimChange}
              onSeek={onSeek}
              isPlaying={isPlaying}
              onTogglePlay={onTogglePlay}
              lang={lang}
            />

            {/* Editing Tips Box */}
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs space-y-1.5">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5" />
                <span>ຄຳແນະນຳການຕັດຕໍ່ (Trim & Cut Guide)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • <strong>Split:</strong> ເລື່ອນ Playhead ໄປຈຸດທີ່ຕ້ອງການແລ້ວກົດປຸ່ມ <strong>Scissors (ກັນໄກ)</strong> ເພື່ອຕັດແບ່ງຄລິບ
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                • <strong>Delete:</strong> ຈິ້ມເລືອກບລັອກທີ່ຕ້ອງການ ແລ້ວກົດປຸ່ມ <strong>Trash (ຖັງຂີ້ເຫຍື້ອ)</strong> ເພື່ອລົບຊ່ວງນັ້ນອອກທັນທີ
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: Slow & Smooth */}
        {currentTab === 'smooth' && (
          <div className="space-y-5 animate-in fade-in duration-150">
            {/* Quick Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.presetsLabel}</span>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'silky', label: t.silkyPreset, desc: '60 FPS Motion' },
                  { id: 'cinematic', label: t.cinematicPreset, desc: 'Shutter Blur' },
                  { id: 'action', label: t.actionPreset, desc: 'Sports / Fast' },
                  { id: 'ultra', label: t.ultraPreset, desc: 'Max 120 FPS' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-900/60 hover:bg-violet-900/30 border border-white/[0.06] hover:border-violet-500/40 text-left transition-all group cursor-pointer touch-manipulation min-h-[44px]"
                  >
                    <div className="text-xs font-bold text-slate-200 group-hover:text-violet-300">
                      {p.label}
                    </div>
                    <div className="text-[10px] text-slate-500">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Playback Speed / Slow Motion Slider with Category Reset */}
            <div className="space-y-2 p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/25">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <span>🐌</span>
                  <span>{t.slowSpeedLabel}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-900/50 text-cyan-200 border border-cyan-500/40">
                    {currentSmooth.playbackSpeed || 1.0}x
                  </span>
                  <button
                    onClick={resetSpeedCategory}
                    className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-900/30 transition-colors cursor-pointer"
                    title="Reset Speed to 1.0x"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={currentSmooth.playbackSpeed || 1.0}
                onChange={(e) =>
                  updateActiveSmooth((prev) => ({
                    ...prev,
                    playbackSpeed: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-2"
              />

              {/* Quick speed buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { val: 1.0, label: '1.0x ປົກກະຕິ' },
                  { val: 0.5, label: '0.5x ສະໂລ 2x' },
                  { val: 0.25, label: '0.25x ສະໂລ 4x' },
                  { val: 0.1, label: '0.1x ສະໂລ 10x' },
                ].map((s) => (
                  <button
                    key={s.val}
                    onClick={() =>
                      updateActiveSmooth((prev) => ({
                        ...prev,
                        playbackSpeed: s.val,
                      }))
                    }
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-mono font-semibold transition-all cursor-pointer touch-manipulation ${
                      (currentSmooth.playbackSpeed || 1.0) === s.val
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'bg-slate-900/60 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Smooth Intensity Slider with Category Reset */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <label className="text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span>{t.intensityLabel}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-violet-300 bg-violet-950/60 px-2 py-0.5 rounded border border-violet-500/30 text-xs">
                    {currentSmooth.intensity}%
                  </span>
                  <button
                    onClick={resetIntensityCategory}
                    className="p-1 rounded text-slate-400 hover:text-violet-300 hover:bg-violet-900/30 transition-colors cursor-pointer"
                    title="Reset Intensity to 65%"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={currentSmooth.intensity}
                onChange={(e) =>
                  updateActiveSmooth((prev) => ({
                    ...prev,
                    intensity: Number(e.target.value),
                  }))
                }
                className="w-full accent-violet-500 bg-slate-800 rounded-lg cursor-pointer h-2"
              />
            </div>

            {/* Smoothing Mode Selection with Category Reset */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.algorithmLabel}</span>
                </label>
                <button
                  onClick={resetModeCategory}
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-indigo-900/30 transition-colors cursor-pointer"
                  title="Reset Mode to Blend"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'blend', label: t.algoBlendTitle, desc: t.algoBlendDesc },
                  { id: 'motion_blur', label: t.algoBlurTitle, desc: t.algoBlurDesc },
                  { id: 'interpolation', label: t.algoInterpTitle, desc: t.algoInterpDesc },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() =>
                      updateActiveSmooth((prev) => ({
                        ...prev,
                        mode: m.id as SmoothingMode,
                      }))
                    }
                    className={`p-2 rounded-xl text-left border transition-all cursor-pointer touch-manipulation min-h-[44px] ${
                      currentSmooth.mode === m.id
                        ? 'bg-violet-950/60 border-violet-500 text-violet-200 shadow-md shadow-violet-900/20'
                        : 'bg-slate-900/40 border-white/[0.06] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold leading-tight truncate">{m.label}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Settings Collapsible with Category Reset */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between w-full py-1">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t.advancedTuning}</span>
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </button>
                {showAdvanced && (
                  <button
                    onClick={resetAdvancedCategory}
                    className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-cyan-900/30 transition-colors cursor-pointer"
                    title="Reset Advanced Tuning"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>

              {showAdvanced && (
                <div className="space-y-4 pt-3 animate-in fade-in duration-150">
                  {/* Blend Decay */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{t.blendDecay}</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(currentSmooth.blendDecay * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={currentSmooth.blendDecay}
                      onChange={(e) =>
                        updateActiveSmooth((prev) => ({
                          ...prev,
                          blendDecay: parseFloat(e.target.value),
                        }))
                      }
                      className="w-full accent-violet-500 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                    />
                  </div>

                  {/* Frame Samples */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Frame Samples</span>
                      <span className="font-mono text-slate-200">{currentSmooth.frameSamples} samples</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="8"
                      value={currentSmooth.frameSamples}
                      onChange={(e) =>
                        updateActiveSmooth((prev) => ({
                          ...prev,
                          frameSamples: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-violet-500 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                    />
                  </div>

                  {/* Sharpness */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{t.sharpnessBoost}</span>
                      <span className="font-mono text-slate-200">{currentSmooth.sharpness}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={currentSmooth.sharpness}
                      onChange={(e) =>
                        updateActiveSmooth((prev) => ({
                          ...prev,
                          sharpness: parseInt(e.target.value, 10),
                        }))
                      }
                      className="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer h-1.5"
                    />
                  </div>

                  {/* Stabilize Simulation Checkbox */}
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.06] cursor-pointer">
                    <span className="text-xs text-slate-300 font-medium">Auto Camera Stabilize Sim</span>
                    <input
                      type="checkbox"
                      checked={currentSmooth.enableStabilizeSim}
                      onChange={(e) =>
                        updateActiveSmooth((prev) => ({
                          ...prev,
                          enableStabilizeSim: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded accent-violet-600 cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Settings & Export */}
        {currentTab === 'export' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Aspect Ratio, Crop and Pan Controls with Per-Cut and Category Reset */}
            <AspectResizeControl
              settings={currentTransform}
              onChange={updateActiveTransform}
              onResetCategory={resetCropCategory}
              lang={lang}
            />

            {/* Video Specs & Accurate Export Duration Summary */}
            {metadata && (() => {
              const exportPlan = createExportPlan(
                metadata.duration || 0,
                currentSmooth,
                60,
                timeBlocks,
                trimRange,
                currentTransform
              )
              return (
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.08] text-xs space-y-2.5 text-slate-400">
                  <div className="flex items-center justify-between font-semibold text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.videoMetaTitle}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-950/60 border border-violet-500/30 text-violet-300">
                      {exportPlan.totalFrames} frames @ 60 FPS
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-950/60 border border-cyan-500/20 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-cyan-300 block">
                        {t.finalOutputDuration}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {t.finalDurationDesc}
                      </span>
                    </div>
                    <span className="text-sm font-bold font-mono text-cyan-300">
                      {formatDuration(exportPlan.totalOutputDuration)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5 font-mono">
                    <div>
                      <span className="text-slate-500">{t.metaResolution}</span> {metadata.width}×{metadata.height}
                    </div>
                    <div>
                      <span className="text-slate-500">{t.metaDuration}</span> {metadata.duration.toFixed(1)} {t.seconds}
                    </div>
                    {currentSmooth.playbackSpeed && currentSmooth.playbackSpeed < 1.0 && (
                      <div className="col-span-2 text-cyan-400/90 text-[10px]">
                        Slow Motion: {currentSmooth.playbackSpeed}x ({(1 / currentSmooth.playbackSpeed).toFixed(1)}x Slower)
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
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
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold border border-white/10 transition-colors disabled:opacity-50 cursor-pointer min-h-[40px] touch-manipulation"
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
        {(() => {
          const exportPlan = createExportPlan(
            metadata?.duration || 0,
            currentSmooth,
            60,
            timeBlocks,
            trimRange,
            currentTransform
          )
          return (
            <button
              onClick={onOpenExport}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 min-h-[44px] touch-manipulation"
            >
              <Download className="w-4 h-4" />
              <span>
                {t.exportCtaBtn}
                {metadata && metadata.duration > 0 && ` (${formatDuration(exportPlan.totalOutputDuration)})`}
              </span>
            </button>
          )
        })()}
      </div>
    </div>
  )
}
