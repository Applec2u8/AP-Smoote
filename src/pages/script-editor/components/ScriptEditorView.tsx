import React, { useState, useMemo } from 'react'
import { TranscriptSegment, SmartSummaryResult } from '../types'
import {
  Scissors, RotateCcw, Sparkles, Trash2, Clock, Edit2, Check,
  Play, Volume2, ClipboardCopy, ClipboardCheck, ChevronDown, ChevronUp,
  FileText, Eye, Pencil, Plus, Split, Sliders, Loader2, BookmarkCheck,
} from 'lucide-react'
import { FILLER_WORDS, generateSmartSummaryDirect } from '../services/api'

interface ScriptEditorViewProps {
  segments: TranscriptSegment[]
  onUpdateSegments: (segments: TranscriptSegment[]) => void
  onSeekToTime: (timeSec: number) => void
  currentTime: number
}

export const ScriptEditorView: React.FC<ScriptEditorViewProps> = ({
  segments,
  onUpdateSegments,
  onSeekToTime,
  currentTime,
}) => {
  const [editingWordId, setEditingWordId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [copied, setCopied] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewEditId, setReviewEditId] = useState<string | null>(null)
  const [reviewEditText, setReviewEditText] = useState('')

  // AI Smart Summary State
  const [smartSummary, setSmartSummary] = useState<SmartSummaryResult | null>(null)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)

  // Segment adjustment mode
  const [adjustingSegId, setAdjustingSegId] = useState<string | null>(null)

  // ── Stats Calculation ──────────────────────────────────────────────────
  const totalWords = useMemo(() => segments.reduce((a, s) => a + s.words.length, 0), [segments])
  const cutWords = useMemo(
    () => segments.reduce((a, s) => a + s.words.filter((w) => w.isDeleted).length, 0),
    [segments]
  )
  const originalDuration = useMemo(
    () => (segments.length > 0 ? segments[segments.length - 1].end - segments[0].start : 0),
    [segments]
  )
  const activeDuration = useMemo(
    () =>
      segments.reduce(
        (acc, seg) =>
          acc + seg.words.filter((w) => !w.isDeleted).reduce((wa, w) => wa + (w.end - w.start), 0),
        0
      ),
    [segments]
  )
  const savedSec = Math.max(0, originalDuration - activeDuration)

  // ── Build Clean Review Text ───────────────────────────────────────────
  const reviewParagraphs = useMemo(() => {
    return segments
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
  }, [segments])

  const reviewFullText = reviewParagraphs.map((p) => `[${p.start.toFixed(1)}s - ${p.end.toFixed(1)}s] ${p.text}`).join('\n')

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleToggleWord = (wordId: string) => {
    onUpdateSegments(
      segments.map((seg) => ({
        ...seg,
        words: seg.words.map((w) => (w.id === wordId ? { ...w, isDeleted: !w.isDeleted } : w)),
      }))
    )
  }

  const handleToggleSegment = (segmentId: string, deleteState: boolean) => {
    onUpdateSegments(
      segments.map((seg) =>
        seg.id === segmentId ? { ...seg, words: seg.words.map((w) => ({ ...w, isDeleted: deleteState })) } : seg
      )
    )
  }

  const handleRemoveAllFillerWords = () => {
    onUpdateSegments(
      segments.map((seg) => ({
        ...seg,
        words: seg.words.map((w) => {
          const isFiller = FILLER_WORDS.some(
            (f) =>
              w.text.toLowerCase().trim() === f.toLowerCase() ||
              w.text.toLowerCase().includes(f.toLowerCase())
          )
          return isFiller ? { ...w, isDeleted: true } : w
        }),
      }))
    )
  }

  const handleRestoreAll = () => {
    onUpdateSegments(segments.map((seg) => ({ ...seg, words: seg.words.map((w) => ({ ...w, isDeleted: false })) })))
  }

  const handleSaveWordEdit = (wordId: string) => {
    if (!editText.trim()) { setEditingWordId(null); return }
    onUpdateSegments(
      segments.map((seg) => ({
        ...seg,
        words: seg.words.map((w) =>
          w.id === wordId ? { ...w, text: editText.trim(), originalText: w.originalText || w.text, isEdited: true } : w
        ),
      }))
    )
    setEditingWordId(null)
  }

  // Adjust Segment Start or End time (+/- delta seconds)
  const handleAdjustSegmentTime = (segId: string, field: 'start' | 'end', delta: number) => {
    onUpdateSegments(
      segments.map((seg) => {
        if (seg.id !== segId) return seg
        const updatedStart = field === 'start' ? Math.max(0, seg.start + delta) : seg.start
        const updatedEnd = field === 'end' ? Math.max(updatedStart + 0.1, seg.end + delta) : seg.end
        return {
          ...seg,
          start: Number(updatedStart.toFixed(2)),
          end: Number(updatedEnd.toFixed(2)),
        }
      })
    )
  }

  // Trigger AI Smart Summary
  const handleRequestSmartSummary = async () => {
    setIsSummarizing(true)
    setSummaryError(null)
    try {
      const result = await generateSmartSummaryDirect(segments)
      setSmartSummary(result)
      setShowSummaryModal(true)
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสรุปเนื้อหา')
    } finally {
      setIsSummarizing(false)
    }
  }

  // Keep only the selected summary highlight key point (cuts other segments)
  const handleKeepOnlyHighlight = (start: number, end: number) => {
    onUpdateSegments(
      segments.map((seg) => ({
        ...seg,
        words: seg.words.map((w) => {
          const inRange = w.start >= start - 0.2 && w.end <= end + 0.2
          return { ...w, isDeleted: !inRange }
        }),
      }))
    )
    onSeekToTime(start)
    setShowSummaryModal(false)
  }

  const handleCopyReview = async () => {
    await navigator.clipboard.writeText(reviewFullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl p-6 shadow-2xl flex flex-col space-y-5">
      {/* ── Header & Action Buttons ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>โปรแกรมตัดต่อและสรุปสคริปต์ (AI Script Editor)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            คลิกคำเพื่อตัดคลิป | ดับเบิลคลิกเพื่อแก้คำสะกด | ปรับแต่งช่วงเวลาอย่างแม่นยำ
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Smart Summary Button */}
          <button
            type="button"
            onClick={handleRequestSmartSummary}
            disabled={isSummarizing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-200 bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/40 hover:from-purple-600/40 hover:to-pink-600/40 active:scale-95 transition-all cursor-pointer shadow-lg shadow-purple-500/10 disabled:opacity-50"
          >
            {isSummarizing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI กำลังสรุป...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5 text-pink-400" /> สรุปประเด็นด้วย AI</>
            )}
          </button>

          {/* Remove Filler Words */}
          <button
            type="button"
            onClick={handleRemoveAllFillerWords}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" /> ตัดคำอุทาน Auto
          </button>

          {/* Restore All */}
          <button
            type="button"
            onClick={handleRestoreAll}
            disabled={cutWords === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> กู้คืน
          </button>
        </div>
      </div>

      {summaryError && (
        <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-xs text-red-300">
          {summaryError}
        </div>
      )}

      {/* ── Stats Bar ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-2xl bg-slate-800/40 border border-white/5 text-xs">
        {[
          { label: 'ความยาววิดีโอเดิม', value: `${originalDuration.toFixed(1)}s`, color: 'text-white' },
          { label: 'ความยาวหลังตัด', value: `${activeDuration.toFixed(1)}s`, color: 'text-emerald-400' },
          { label: 'เวลาที่ประหยัดได้', value: `-${savedSec.toFixed(1)}s`, color: 'text-amber-400' },
          { label: 'คำที่ตัดออก', value: `${cutWords}/${totalWords} คำ`, color: 'text-indigo-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-2 rounded-xl bg-slate-900/40 border border-white/5">
            <span className="text-slate-400 block text-[11px] mb-0.5">{label}</span>
            <span className={`font-bold font-mono text-sm ${color}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── Word Trimmer & Segment Timeline ─────────────────────────────── */}
      <div className="space-y-3.5 overflow-y-auto max-h-[440px] pr-1.5 custom-scrollbar">
        {segments.map((seg, segIdx) => {
          const isAllDeleted = seg.words.every((w) => w.isDeleted)
          const isAdjusting = adjustingSegId === seg.id

          return (
            <div
              key={seg.id}
              className={`rounded-2xl border p-4 transition-all duration-200 ${
                isAllDeleted
                  ? 'border-red-500/20 bg-red-950/15 opacity-60'
                  : 'border-white/5 bg-slate-800/35 hover:border-white/15'
              }`}
            >
              {/* Segment Header */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-white/10 font-mono text-slate-300 font-semibold">
                    #{segIdx + 1}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-slate-300">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {seg.start.toFixed(2)}s – {seg.end.toFixed(2)}s
                  </span>
                  <span className="text-slate-500">
                    ({(seg.end - seg.start).toFixed(1)}s)
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Precision Time Tuning Toggle */}
                  <button
                    type="button"
                    onClick={() => setAdjustingSegId(isAdjusting ? null : seg.id)}
                    className={`p-1 rounded-lg text-xs transition-all cursor-pointer ${
                      isAdjusting ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="ปรับแต่งเวลาช่วงนี้อย่างละเอียด"
                  >
                    <Sliders className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onSeekToTime(seg.start)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                    title="เล่นวิดีโอจากจุดนี้"
                  >
                    <Play className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleSegment(seg.id, !isAllDeleted)}
                    className={`p-1 rounded-lg text-xs transition-all cursor-pointer ${
                      isAllDeleted ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-red-400 hover:bg-red-500/10'
                    }`}
                    title={isAllDeleted ? 'กู้คืนทั้งท่อน' : 'ตัดทิ้งทั้งท่อน'}
                  >
                    {isAllDeleted ? <RotateCcw className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Precision Time Tuning Bar (Expandable) */}
              {isAdjusting && (
                <div className="mb-3 p-2.5 rounded-xl bg-slate-900/80 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">Start:</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustSegmentTime(seg.id, 'start', -0.1)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px]"
                    >
                      -0.1s
                    </button>
                    <span className="font-mono text-indigo-300 font-semibold">{seg.start.toFixed(2)}s</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustSegmentTime(seg.id, 'start', 0.1)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px]"
                    >
                      +0.1s
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">End:</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustSegmentTime(seg.id, 'end', -0.1)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px]"
                    >
                      -0.1s
                    </button>
                    <span className="font-mono text-indigo-300 font-semibold">{seg.end.toFixed(2)}s</span>
                    <button
                      type="button"
                      onClick={() => handleAdjustSegmentTime(seg.id, 'end', 0.1)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono text-[10px]"
                    >
                      +0.1s
                    </button>
                  </div>
                </div>
              )}

              {/* Word Chips */}
              <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
                {seg.words.map((word) => {
                  const isCurrent = currentTime >= word.start && currentTime <= word.end
                  if (editingWordId === word.id) {
                    return (
                      <span key={word.id} className="inline-flex items-center gap-1 bg-indigo-500/20 p-1 rounded-lg border border-indigo-500">
                        <input
                          type="text"
                          value={editText}
                          autoFocus
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveWordEdit(word.id)
                            if (e.key === 'Escape') setEditingWordId(null)
                          }}
                          className="px-2 py-0.5 bg-slate-900 text-xs text-white rounded-md outline-none border border-white/20 w-28"
                        />
                        <button type="button" onClick={() => handleSaveWordEdit(word.id)} className="p-1 text-emerald-400 hover:bg-white/10 rounded">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    )
                  }
                  return (
                    <span
                      key={word.id}
                      onClick={() => handleToggleWord(word.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingWordId(word.id)
                        setEditText(word.text)
                      }}
                      title={`${word.start.toFixed(2)}s → ${word.end.toFixed(2)}s\n(คลิก: ตัด/กู้คืน | ดับเบิลคลิก: แก้ไขคำ)`}
                      className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium cursor-pointer select-none transition-all duration-150 ${
                        word.isDeleted
                          ? 'line-through text-red-400/70 bg-red-500/10 border border-red-500/20 opacity-60'
                          : isCurrent
                          ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 scale-105'
                          : word.isEdited
                          ? 'bg-purple-500/15 text-purple-200 border border-purple-500/30 hover:bg-purple-500/25'
                          : 'bg-slate-800/80 text-slate-200 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-700/80'
                      }`}
                    >
                      <span>{word.text}</span>
                      {word.isDeleted && <Scissors className="w-2.5 h-2.5 text-red-400 shrink-0" />}
                      {word.isEdited && !word.isDeleted && <Edit2 className="w-2.5 h-2.5 text-purple-400 shrink-0" />}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── AI Smart Summary Modal ──────────────────────────────────────── */}
      {showSummaryModal && smartSummary && (
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/30 space-y-3 animate-fade-in shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-pink-400" /> บทสรุปเนื้อหาสำคัญจาก AI (Smart Highlights)
            </span>
            <button
              type="button"
              onClick={() => setShowSummaryModal(false)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 leading-relaxed">
            <strong>ภาพรวม:</strong> {smartSummary.summary}
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              ประเด็นสำคัญและช่วงเวลา (คลิกเพื่อเลือกตัดช่วงนั้น):
            </span>
            <div className="grid grid-cols-1 gap-2">
              {smartSummary.keyPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-800/60 border border-white/5 hover:border-purple-500/30 transition-all text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-white">{point.topic}</span>
                      <span className="font-mono text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">
                        {point.start.toFixed(1)}s - {point.end.toFixed(1)}s
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">{point.summary}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSeekToTime(point.start)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5" /> เล่น
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeepOnlyHighlight(point.start, point.end)}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[11px] flex items-center gap-1 cursor-pointer shadow"
                      title="เลือกเฉพาะช่วงนี้ ตัดช่วงอื่นทิ้ง"
                    >
                      <BookmarkCheck className="w-3 h-3" /> เลือกท่อนนี้
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Script Review Panel ─────────────────────────────────────────── */}
      <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-900/60">
        <button
          type="button"
          onClick={() => setShowReview(!showReview)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-800/90 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="text-left">
              <span className="text-xs font-bold text-white block">
                ตรวจสอบสคริปต์ก่อน Render (Script Review)
              </span>
              <span className="text-[11px] text-slate-400">
                {reviewParagraphs.length} ย่อหน้า · รวม {reviewParagraphs.reduce((a, p) => a + p.text.split(/\s+/).length, 0)} คำ ที่คงไว้
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-teal-400 font-semibold">ดูข้อความทั้งหมด</span>
            {showReview ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {showReview && (
          <div className="p-4 space-y-3 bg-slate-900/80 border-t border-white/5">
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
              {reviewParagraphs.length === 0 ? (
                <p className="text-xs text-center text-slate-500 py-6">ไม่มีข้อความที่เหลืออยู่ (ทุกคำถูกตัดออกหมดแล้ว)</p>
              ) : (
                reviewParagraphs.map((para, idx) => (
                  <div
                    key={para.segId}
                    className="p-3 rounded-xl bg-slate-800/40 border border-white/5 text-xs text-slate-200 leading-relaxed flex items-start gap-2.5"
                  >
                    <span className="text-slate-500 font-mono text-[10px] mt-0.5 shrink-0">[{idx + 1}]</span>
                    <div className="flex-1 min-w-0">
                      <p>{para.text}</p>
                      <span className="font-mono text-[10px] text-teal-400 mt-1 block">
                        {para.start.toFixed(1)}s → {para.end.toFixed(1)}s
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {reviewParagraphs.length > 0 && (
              <button
                type="button"
                onClick={handleCopyReview}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-98 cursor-pointer bg-teal-500/10 border-teal-500/30 text-teal-300 hover:bg-teal-500/20"
              >
                {copied ? (
                  <><ClipboardCheck className="w-4 h-4 text-emerald-400" /> คัดลอกสำเร็จ!</>
                ) : (
                  <><ClipboardCopy className="w-4 h-4" /> คัดลอกสคริปต์และ Timestamps ทั้งหมด</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
