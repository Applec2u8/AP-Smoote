import React, { useState } from 'react'
import {
  Film, Music, FileText, Download, X, CheckCircle2,
  Copy, ClipboardCheck, Clock, Scissors, Sparkles,
} from 'lucide-react'
import { ExportMode, TranscriptSegment, TTSMixSettings } from '../types'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmExport?: (mode: ExportMode) => void
  segments: TranscriptSegment[]
  ttsSettings: TTSMixSettings
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  segments,
  ttsSettings,
}) => {
  const [selectedMode, setSelectedMode] = useState<ExportMode>('text_only')
  const [copiedScript, setCopiedScript] = useState(false)
  const [textFormat, setTextFormat] = useState<'srt' | 'txt' | 'json'>('srt')

  if (!isOpen) return null

  // Active (kept) paragraphs
  const activeParagraphs = segments
    .map((seg) => ({
      segId: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.words
        .filter((w) => !w.isDeleted)
        .map((w) => w.text)
        .join(' ')
        .trim(),
    }))
    .filter((p) => p.text.length > 0)

  // Kept cut intervals
  const keptIntervals: Array<{ start: number; end: number; duration: number }> = []
  for (const seg of segments) {
    let current: { start: number; end: number } | null = null
    for (const w of seg.words) {
      if (!w.isDeleted) {
        if (!current) {
          current = { start: w.start, end: w.end }
        } else {
          current.end = w.end
        }
      } else if (current) {
        keptIntervals.push({
          start: current.start,
          end: current.end,
          duration: Number((current.end - current.start).toFixed(2)),
        })
        current = null
      }
    }
    if (current) {
      keptIntervals.push({
        start: current.start,
        end: current.end,
        duration: Number((current.end - current.start).toFixed(2)),
      })
    }
  }

  const getExportText = () => {
    if (textFormat === 'srt') {
      const formatSrtTime = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
        const secs = Math.floor(seconds % 60).toString().padStart(2, '0')
        const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0')
        return `${hrs}:${mins}:${secs},${ms}`
      }
      return activeParagraphs
        .map((p, idx) => `${idx + 1}\n${formatSrtTime(p.start)} --> ${formatSrtTime(p.end)}\n${p.text}\n`)
        .join('\n')
    }

    if (textFormat === 'json') {
      return JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          activeDurationSec: keptIntervals.reduce((a, b) => a + b.duration, 0),
          cutIntervals: keptIntervals,
          segments: activeParagraphs,
        },
        null,
        2
      )
    }

    // Default plain text with timestamps
    return activeParagraphs
      .map((p) => `[${p.start.toFixed(1)}s - ${p.end.toFixed(1)}s] ${p.text}`)
      .join('\n')
  }

  const handleCopyText = async () => {
    await navigator.clipboard.writeText(getExportText())
    setCopiedScript(true)
    setTimeout(() => setCopiedScript(false), 2000)
  }

  const handleDownloadFile = (content: string, filename: string, mimeType = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportOptions = [
    {
      id: 'text_only' as ExportMode,
      title: 'สคริปต์และคำบรรยาย (Subtitles & Timestamps)',
      subtitle: 'ส่งออกบทสรุปสคริปต์พร้อมไทม์โค้ดสำหรับทำคำบรรยายคลิป (.srt, .txt, .json)',
      badge: 'ดาวน์โหลดทันที 100%',
      icon: FileText,
      color: 'teal',
    },
    {
      id: 'final_video' as ExportMode,
      title: 'รายการช่วงเวลาตัดต่อ (Cut Decision List / JSON Timeline)',
      subtitle: 'บันทึกไทม์ไลน์และช่วงเวลาตัดต่อวิดีโอ (Cut Intervals) สำหรับนำไปตัดต่อต่อใน Premiere / CapCut',
      badge: 'Video Timeline',
      icon: Film,
      color: 'indigo',
    },
    {
      id: 'audio_only' as ExportMode,
      title: 'สคริปต์เสียงพากย์ AI (TTS Voice Script)',
      subtitle: 'ส่งออกข้อความสคริปต์ที่พร้อมสำหรับการสังเคราะห์เสียงพากย์ AI หรือดาวน์โหลดข้อความพากย์',
      badge: 'Voice Script',
      icon: Music,
      color: 'purple',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>ส่งออกผลลัพธ์ (Client-Side Export)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                100% Client-Side
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">ดาวน์โหลดผลลัพธ์สคริปต์และไทม์ไลน์ตรงจากเบราว์เซอร์</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3.5">
          {exportOptions.map((opt) => {
            const isSelected = selectedMode === opt.id
            const Icon = opt.icon
            return (
              <div
                key={opt.id}
                onClick={() => setSelectedMode(opt.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? `border-${opt.color}-500 bg-${opt.color}-500/10 shadow-lg shadow-${opt.color}-500/10`
                    : 'border-white/10 bg-slate-800/40 hover:bg-slate-800/70 hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-${opt.color}-500/20 text-${opt.color}-400 flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{opt.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold bg-${opt.color}-500/20 text-${opt.color}-300 border border-${opt.color}-500/30`}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.subtitle}</p>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Action Panels based on selected mode */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-white/5 space-y-3 animate-fade-in">
            {selectedMode === 'text_only' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">เลือกฟอร์แมตไฟล์สคริปต์:</span>
                  <div className="flex gap-1.5">
                    {(['srt', 'txt', 'json'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setTextFormat(fmt)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                          textFormat === fmt
                            ? 'bg-teal-500 text-white shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        .{fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  >
                    {copiedScript ? <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? 'คัดลอกแล้ว!' : 'คัดลอกสคริปต์'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(getExportText(), `ap_smooth_script_${Date.now()}.${textFormat}`)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow"
                  >
                    <Download className="w-3.5 h-3.5" /> ดาวน์โหลดไฟล์ .{textFormat}
                  </button>
                </div>
              </>
            )}

            {selectedMode === 'final_video' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300 leading-relaxed">
                  ดาวน์โหลดไทม์ไลน์ช่วงเวลาตัดต่อ (Cut Intervals {keptIntervals.length} ช่วง) เป็นไฟล์ JSON:
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(
                      JSON.stringify(
                        {
                          title: 'AP Smooth Video Cut Intervals',
                          exportedAt: new Date().toISOString(),
                          intervals: keptIntervals,
                          totalKeptDurationSec: keptIntervals.reduce((a, b) => a + b.duration, 0),
                        },
                        null,
                        2
                      ),
                      `ap_smooth_cut_timeline_${Date.now()}.json`
                    )
                  }
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow"
                >
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลดไฟล์ไทม์ไลน์ตัดต่อ (.JSON)
                </button>
              </div>
            )}

            {selectedMode === 'audio_only' && (
              <div className="space-y-2">
                <div className="text-xs text-slate-300 leading-relaxed">
                  ส่งออกข้อความสคริปต์พากย์ (Clean Voiceover Script) สำหรับนำไปใช้อัดเสียงหรือส่งต่อ AI:
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadFile(
                      activeParagraphs.map((p) => p.text).join('\n\n'),
                      `ap_smooth_voice_script_${Date.now()}.txt`
                    )
                  }
                  className="w-full py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow"
                >
                  <Download className="w-3.5 h-3.5" /> ดาวน์โหลดสคริปต์พากย์เสียง (.TXT)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-white/10 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
