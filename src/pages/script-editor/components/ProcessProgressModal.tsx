import React from 'react'
import { ProcessProgress } from '../types'
import {
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Film,
  Scissors,
  Volume2,
} from 'lucide-react'

interface ProcessProgressModalProps {
  progress: ProcessProgress
  isOpen: boolean
  onClose: () => void
  onDownloadExport: () => void
  onPurgeAndClose: () => void
  isCleaningUp: boolean
}

export const ProcessProgressModal: React.FC<ProcessProgressModalProps> = ({
  progress,
  isOpen,
  onClose,
  onDownloadExport,
  onPurgeAndClose,
  isCleaningUp,
}) => {
  if (!isOpen) return null

  const isCompleted = progress.step === 'completed'
  const isError = progress.step === 'error'
  const isAudioOnly = progress.exportMode === 'audio_only'

  const stages = [
    { key: 'cutting_ffmpeg', label: 'ตัดต่อเฟรมวิดีโอด้วย FFmpeg', icon: Scissors },
    { key: 'generating_tts', label: 'สังเคราะห์เสียงพากย์ Neural Voice', icon: Volume2 },
    { key: 'mixing_export', label: 'มิกซ์ไฟล์เสียงและแปลงรหัสสมบูรณ์', icon: CheckCircle2 },
    { key: 'completed', label: 'ส่งออกสำเร็จ & พร้อมดาวน์โหลด', icon: ShieldCheck },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-indigo-500/10 text-white relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg ${
              isError
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : isCompleted
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
            }`}
          >
            {isError ? (
              <AlertTriangle className="w-7 h-7" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-7 h-7" />
            ) : (
              <Loader2 className="w-7 h-7 animate-spin" />
            )}
          </div>

          <h3 className="text-lg font-bold">
            {isError
              ? 'เกิดข้อผิดพลาดในการประมวลผล'
              : isCompleted
              ? isAudioOnly
                ? 'ส่งออกไฟล์เสียงพากย์ (.MP3) สำเร็จ!'
                : 'ตัดต่อและส่งออกวิดีโอ (.MP4) สำเร็จ!'
              : 'ระบบกำลังดำเนินการประมวลผล (Processing)'}
          </h3>

          <p className="text-xs text-slate-400 mt-1">
            {progress.message || 'กรุณารอสักครู่ ระบบกำลังประมวลผลอย่างแม่นยำ...'}
          </p>
        </div>

        {/* Progress Bar */}
        {!isError && (
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>ความคืบหน้า</span>
              <span className="text-indigo-400 font-semibold">{progress.percent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300 shadow-md"
                style={{ width: `${Math.min(100, Math.max(5, progress.percent))}%` }}
              />
            </div>
          </div>
        )}

        {/* Stage List Indicator */}
        <div className="space-y-2 p-3.5 rounded-2xl bg-slate-800/40 border border-white/5 mb-6 text-xs">
          {stages.map((stage, idx) => {
            const Icon = stage.icon
            const isCurrent = progress.step === stage.key
            return (
              <div
                key={stage.key}
                className={`flex items-center gap-2.5 py-1 px-2 rounded-lg transition-all ${
                  isCurrent
                    ? 'bg-indigo-500/20 text-indigo-300 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-700/80">
                  {idx + 1}
                </div>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1 truncate">{stage.label}</span>
                {isCurrent && (
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                )}
              </div>
            )
          })}
        </div>

        {/* Local Storage & Cleanup Notice */}
        <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-800/50 border border-white/5 text-[11px] text-slate-300 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Local Engine Pipeline:</strong> เมื่อดาวน์โหลดผลลัพธ์เสร็จ สามารถกดปุ่ม "ล้าง Temp" เพื่อลบไฟล์วิดีโอชั่วคราวทิ้ง 100% อัตโนมัติ ไม่เปลืองความจุเครื่อง
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {isCompleted ? (
            <>
              <button
                type="button"
                onClick={onDownloadExport}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isAudioOnly ? 'ดาวน์โหลดไฟล์เสียง (.MP3)' : 'ดาวน์โหลดวิดีโอไฟนอล (.MP4)'}
                </span>
              </button>

              <button
                type="button"
                onClick={onPurgeAndClose}
                disabled={isCleaningUp}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-red-500/20 hover:text-red-300 border border-white/10 active:scale-95 transition-all cursor-pointer"
                title="ลบไฟล์ต้นฉบับและแคชทั้งหมดออกจากฮาร์ดดิสก์ 100%"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>{isCleaningUp ? 'กำลังล้าง...' : 'ล้าง Temp & ปิด'}</span>
              </button>
            </>
          ) : isError ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          ) : (
            <div className="w-full text-center py-2 text-xs text-slate-400 animate-pulse">
              กรุณาอย่าปิดหน้านี้ ระบบกำลังรันคำสั่งตัดต่อ...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
