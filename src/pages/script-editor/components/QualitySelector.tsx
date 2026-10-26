import React from 'react'
import { VideoQualityOption } from '../types'
import { Check, Sparkles, Film, ArrowRight } from 'lucide-react'

interface QualitySelectorProps {
  qualities: VideoQualityOption[]
  selectedFormatId: string
  onSelectQuality: (formatId: string) => void
  onConfirmDownload: () => void
  isLoading: boolean
  videoTitle?: string
}

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  qualities,
  selectedFormatId,
  onSelectQuality,
  onConfirmDownload,
  isLoading,
  videoTitle,
}) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl p-5 shadow-2xl transition-all">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">
            เลือกระดับความละเอียด (Quality Selector)
          </h3>
          <p className="text-xs text-slate-400">
            {videoTitle ? `วิดีโอ: ${videoTitle}` : 'เลือกคุณภาพที่ต้องการให้ระบบดาวน์โหลดลง Local Storage'}
          </p>
        </div>
      </div>

      {/* Grid of Qualities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
        {qualities.map((item) => {
          const isSelected = item.formatId === selectedFormatId
          const isHighRes = item.height >= 1080

          return (
            <button
              key={item.formatId}
              type="button"
              disabled={isLoading}
              onClick={() => onSelectQuality(item.formatId)}
              className={`relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/15 shadow-md shadow-indigo-500/10'
                  : 'border-white/5 bg-slate-800/40 hover:bg-slate-800/80 hover:border-white/15'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isSelected
                      ? 'bg-indigo-500 text-white shadow'
                      : 'bg-slate-800 text-slate-400 border border-white/10'
                  }`}
                >
                  {isSelected ? <Check className="w-4 h-4" /> : item.height ? `${item.height}p` : 'HD'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{item.label}</span>
                    {isHighRes && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Sparkles className="w-2.5 h-2.5" /> แนะนำ
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span>{item.resolution}</span>
                    <span>•</span>
                    <span className="uppercase">{item.ext}</span>
                    {item.filesizeApprox && (
                      <>
                        <span>•</span>
                        <span>~{(item.filesizeApprox / (1024 * 1024)).toFixed(1)} MB</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Confirmation Button */}
      <div className="flex justify-end pt-2 border-t border-white/5">
        <button
          type="button"
          disabled={isLoading || !selectedFormatId}
          onClick={onConfirmDownload}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>กำลังดึงข้อมูลเข้าสู่ Local Storage...</span>
            </>
          ) : (
            <>
              <span>ยืนยันดาวน์โหลดความละเอียดนี้</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
