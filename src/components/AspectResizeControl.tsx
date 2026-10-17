import React from 'react'
import {
  Maximize,
  Crop,
  Smartphone,
  Monitor,
  Square,
  ZoomIn,
  RotateCcw,
  Move,
  AlignCenter,
} from 'lucide-react'
import { VideoAspectRatio, VideoFitMode, VideoTransformSettings } from '../types'
import { Language, translations } from '../utils/i18n'

interface AspectResizeControlProps {
  settings: VideoTransformSettings
  onChange: (settings: VideoTransformSettings) => void
  onResetCategory?: () => void
  lang: Language
}

export const AspectResizeControl: React.FC<AspectResizeControlProps> = ({
  settings,
  onChange,
  onResetCategory,
  lang,
}) => {
  const t = translations[lang]

  const aspectOptions: {
    id: VideoAspectRatio
    label: string
    sub: string
    icon: React.ReactNode
  }[] = [
    {
      id: 'original',
      label: 'Original',
      sub: t.aspectOriginal,
      icon: <Maximize className="w-3.5 h-3.5" />,
    },
    {
      id: '16:9',
      label: '16:9',
      sub: 'YouTube / Wide',
      icon: <Monitor className="w-3.5 h-3.5" />,
    },
    {
      id: '9:16',
      label: '9:16',
      sub: 'TikTok / Shorts',
      icon: <Smartphone className="w-3.5 h-3.5" />,
    },
    {
      id: '1:1',
      label: '1:1',
      sub: 'Square Feed',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      id: '4:5',
      label: '4:5',
      sub: 'Social Portrait',
      icon: <Smartphone className="w-3.5 h-3.5" />,
    },
    {
      id: '21:9',
      label: '21:9',
      sub: 'Ultrawide Cinema',
      icon: <Monitor className="w-3.5 h-3.5" />,
    },
  ]

  const handleSelectAspect = (aspectRatio: VideoAspectRatio) => {
    onChange({
      ...settings,
      aspectRatio,
    })
  }

  const handleSelectFitMode = (fitMode: VideoFitMode) => {
    onChange({
      ...settings,
      fitMode,
    })
  }

  const handleZoomChange = (zoom: number) => {
    onChange({
      ...settings,
      zoom,
    })
  }

  const handlePanChange = (panX?: number, panY?: number) => {
    onChange({
      ...settings,
      panX: panX !== undefined ? panX : (settings.panX || 0),
      panY: panY !== undefined ? panY : (settings.panY || 0),
    })
  }

  const handleReset = () => {
    if (onResetCategory) {
      onResetCategory()
    } else {
      onChange({
        aspectRatio: 'original',
        fitMode: 'contain',
        zoom: 1.0,
        panX: 0,
        panY: 0,
      })
    }
  }

  return (
    <div className="w-full flex flex-col gap-4 p-3.5 rounded-xl bg-[#090b12] border border-white/[0.08]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Crop className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">{t.aspectToolTitle}</h3>
            <p className="text-[10px] text-slate-400">{t.aspectSubtitle}</p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
          title="Reset Aspect & Crop"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Aspect Ratio Buttons Grid */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-300">
          {t.aspectRatioLabel}
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {aspectOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSelectAspect(opt.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] touch-manipulation ${
                settings.aspectRatio === opt.id
                  ? 'bg-violet-950/60 border-violet-500 text-white shadow-md shadow-violet-500/20 ring-1 ring-violet-500'
                  : 'bg-slate-900/50 border-white/[0.06] text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                {opt.icon}
                <span>{opt.label}</span>
              </div>
              <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-full">
                {opt.sub}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Fit Mode Selection (Contain vs Cover/Crop) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-300">
          {t.fitModeLabel}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSelectFitMode('contain')}
            className={`flex items-center justify-center gap-2 p-2 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] touch-manipulation ${
              settings.fitMode === 'contain'
                ? 'bg-violet-950/60 border-violet-500 text-white shadow-md shadow-violet-500/20 ring-1 ring-violet-500'
                : 'bg-slate-900/50 border-white/[0.06] text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <div className="w-4 h-3 border border-current rounded-sm flex items-center justify-center">
              <div className="w-2.5 h-1.5 bg-current opacity-70" />
            </div>
            <span className="text-xs font-semibold">{t.fitContain}</span>
          </button>

          <button
            onClick={() => handleSelectFitMode('cover')}
            className={`flex items-center justify-center gap-2 p-2 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] touch-manipulation ${
              settings.fitMode === 'cover'
                ? 'bg-violet-950/60 border-violet-500 text-white shadow-md shadow-violet-500/20 ring-1 ring-violet-500'
                : 'bg-slate-900/50 border-white/[0.06] text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <div className="w-4 h-3 border border-current rounded-sm flex items-center justify-center overflow-hidden">
              <div className="w-full h-full bg-current opacity-80" />
            </div>
            <span className="text-xs font-semibold">{t.fitCover}</span>
          </button>
        </div>
      </div>

      {/* Custom Zoom & Scale Slider */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-slate-300 flex items-center gap-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{t.zoomScaleLabel}</span>
          </label>
          <span className="font-mono font-bold text-cyan-300 text-[11px] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
            {Math.round((settings.zoom || 1.0) * 100)}%
          </span>
        </div>

        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.05"
          value={settings.zoom || 1.0}
          onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-2"
        />

        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>100% (1.0x)</span>
          <span>200% (2.0x)</span>
          <span>300% (3.0x)</span>
        </div>
      </div>

      {/* Manual Pan & Position Control (X, Y) */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.panPositionTitle}</span>
          </span>
          <button
            onClick={() => handlePanChange(0, 0)}
            className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 cursor-pointer"
            title="Center Position"
          >
            <AlignCenter className="w-3 h-3" />
            <span>{t.centerPosition}</span>
          </button>
        </div>

        {/* Pan X Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t.panAxisX}</span>
            <span className="text-slate-200 font-mono">{settings.panX || 0}%</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.panX || 0}
            onChange={(e) => handlePanChange(parseInt(e.target.value, 10), undefined)}
            className="w-full accent-amber-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
          />
        </div>

        {/* Pan Y Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t.panAxisY}</span>
            <span className="text-slate-200 font-mono">{settings.panY || 0}%</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            step="1"
            value={settings.panY || 0}
            onChange={(e) => handlePanChange(undefined, parseInt(e.target.value, 10))}
            className="w-full accent-amber-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
          />
        </div>

        <p className="text-[10px] text-slate-500 italic">
          💡 ຄຳແນະນຳ: ສາມາດກົດລາກ (Drag & Pan) ຍ້າຍຕຳແໜ່ງວິດີໂອບົນໜ້າຈໍ Preview ໄດ້ໂດຍກົງ
        </p>
      </div>
    </div>
  )
}
