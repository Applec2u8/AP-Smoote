import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  Scissors,
  RotateCcw,
  Clock,
  Play,
  Pause,
  Trash2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { TimeBlock, TrimRange } from '../types'
import { Language, translations } from '../utils/i18n'

interface TimelineTrimmerProps {
  duration: number
  currentTime: number
  timeBlocks?: TimeBlock[]
  onTimeBlocksChange?: (blocks: TimeBlock[]) => void
  selectedBlockId?: string | null
  onSelectBlock?: (id: string) => void
  trimRange?: TrimRange
  onTrimChange?: (range: TrimRange) => void
  onSeek: (time: number) => void
  isPlaying: boolean
  onTogglePlay: () => void
  lang: Language
}

export const TimelineTrimmer: React.FC<TimelineTrimmerProps> = ({
  duration,
  currentTime,
  timeBlocks,
  onTimeBlocksChange,
  selectedBlockId,
  onSelectBlock,
  trimRange,
  onTrimChange,
  onSeek,
  isPlaying,
  onTogglePlay,
  lang,
}) => {
  const t = translations[lang]
  const trackRef = useRef<HTMLDivElement>(null)

  const safeDuration = Math.max(0.1, duration || 1)

  // Fallback to single block if timeBlocks is not provided
  const blocks: TimeBlock[] =
    timeBlocks && timeBlocks.length > 0
      ? timeBlocks
      : [
          {
            id: 'block-root',
            start: trimRange?.start || 0,
            end: trimRange?.end || safeDuration,
          },
        ]

  // Currently selected block
  const activeBlock =
    blocks.find((b) => b.id === selectedBlockId) ||
    blocks.find((b) => currentTime >= b.start && currentTime <= b.end) ||
    blocks[0]

  // Dragging state for handles on the active block
  const [dragTarget, setDragTarget] = useState<'start' | 'end' | 'playhead' | null>(null)
  const dragStartXRef = useRef(0)
  const dragInitialBlockRef = useRef<TimeBlock>({ id: '', start: 0, end: 0 })

  const formatTime = (secs: number) => {
    const s = Math.max(0, secs)
    const m = Math.floor(s / 60)
    const remS = Math.floor(s % 60)
    const ms = Math.floor((s % 1) * 100)
    return `${m}:${remS < 10 ? '0' : ''}${remS}.${ms < 10 ? '0' : ''}${ms}`
  }

  // Calculate total active selected duration
  const totalActiveDuration = blocks.reduce((acc, b) => acc + Math.max(0, b.end - b.start), 0)

  // Calculate time from clientX
  const getTimeFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0
      const rect = trackRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
      const ratio = x / rect.width
      return ratio * safeDuration
    },
    [safeDuration]
  )

  // Handle Drag Start
  const handleStartDrag = (target: 'start' | 'end' | 'playhead', clientX: number) => {
    setDragTarget(target)
    dragStartXRef.current = clientX
    dragInitialBlockRef.current = { ...activeBlock }
  }

  // Pointer move handler
  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!dragTarget || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const deltaX = clientX - dragStartXRef.current
      const deltaTime = (deltaX / rect.width) * safeDuration

      const minGap = 0.2

      if (dragTarget === 'start') {
        const newStart = Math.max(
          0,
          Math.min(dragInitialBlockRef.current.end - minGap, dragInitialBlockRef.current.start + deltaTime)
        )
        const updated = blocks.map((b) =>
          b.id === activeBlock.id ? { ...b, start: Number(newStart.toFixed(2)) } : b
        )
        onTimeBlocksChange?.(updated)
        if (onTrimChange && updated.length === 1) {
          onTrimChange({ start: updated[0].start, end: updated[0].end })
        }
        onSeek(newStart)
      } else if (dragTarget === 'end') {
        const newEnd = Math.min(
          safeDuration,
          Math.max(dragInitialBlockRef.current.start + minGap, dragInitialBlockRef.current.end + deltaTime)
        )
        const updated = blocks.map((b) =>
          b.id === activeBlock.id ? { ...b, end: Number(newEnd.toFixed(2)) } : b
        )
        onTimeBlocksChange?.(updated)
        if (onTrimChange && updated.length === 1) {
          onTrimChange({ start: updated[0].start, end: updated[0].end })
        }
        onSeek(newEnd)
      } else if (dragTarget === 'playhead') {
        const targetTime = getTimeFromClientX(clientX)
        onSeek(Math.max(0, Math.min(safeDuration, targetTime)))
      }
    },
    [dragTarget, safeDuration, activeBlock, blocks, onTimeBlocksChange, onTrimChange, onSeek, getTimeFromClientX]
  )

  // Global mouse/touch up & move
  useEffect(() => {
    if (!dragTarget) return

    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) handlePointerMove(e.touches[0].clientX)
    }
    const onEnd = () => setDragTarget(null)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [dragTarget, handlePointerMove])

  // Track click seeking
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.trim-handle')) return
    const time = getTimeFromClientX(e.clientX)
    onSeek(Math.max(0, Math.min(safeDuration, time)))

    // Select block if clicked inside one
    const clickedBlock = blocks.find((b) => time >= b.start && time <= b.end)
    if (clickedBlock && onSelectBlock) {
      onSelectBlock(clickedBlock.id)
    }
  }

  // Split at playhead
  const handleSplitAtPlayhead = () => {
    const cur = Number(currentTime.toFixed(2))
    // Find block containing current playhead
    const targetBlockIndex = blocks.findIndex((b) => cur > b.start + 0.15 && cur < b.end - 0.15)
    if (targetBlockIndex === -1) return

    const targetBlock = blocks[targetBlockIndex]
    const blockA: TimeBlock = {
      id: `block-${Date.now()}-a`,
      start: targetBlock.start,
      end: cur,
    }
    const blockB: TimeBlock = {
      id: `block-${Date.now()}-b`,
      start: cur,
      end: targetBlock.end,
    }

    const nextBlocks = [...blocks]
    nextBlocks.splice(targetBlockIndex, 1, blockA, blockB)
    onTimeBlocksChange?.(nextBlocks)
    onSelectBlock?.(blockB.id)
  }

  // Delete selected block
  const handleDeleteSelectedBlock = (blockIdToDelete?: string) => {
    const id = blockIdToDelete || activeBlock.id
    if (blocks.length <= 1) return // Keep at least one block

    const nextBlocks = blocks.filter((b) => b.id !== id)
    onTimeBlocksChange?.(nextBlocks)

    const remainingActive = nextBlocks[0]
    if (remainingActive && onSelectBlock) {
      onSelectBlock(remainingActive.id)
      onSeek(remainingActive.start)
    }
  }

  // Set start / end at playhead for active block
  const handleSetStartAtPlayhead = () => {
    const cur = Number(currentTime.toFixed(2))
    if (cur >= activeBlock.end - 0.2) return
    const updated = blocks.map((b) => (b.id === activeBlock.id ? { ...b, start: cur } : b))
    onTimeBlocksChange?.(updated)
    if (onTrimChange && updated.length === 1) {
      onTrimChange({ start: updated[0].start, end: updated[0].end })
    }
  }

  const handleSetEndAtPlayhead = () => {
    const cur = Number(currentTime.toFixed(2))
    if (cur <= activeBlock.start + 0.2) return
    const updated = blocks.map((b) => (b.id === activeBlock.id ? { ...b, end: cur } : b))
    onTimeBlocksChange?.(updated)
    if (onTrimChange && updated.length === 1) {
      onTrimChange({ start: updated[0].start, end: updated[0].end })
    }
  }

  // Reset all blocks back to 1 full block
  const handleResetAllCuts = () => {
    const single: TimeBlock[] = [{ id: `block-${Date.now()}`, start: 0, end: safeDuration }]
    onTimeBlocksChange?.(single)
    onSelectBlock?.(single[0].id)
    onTrimChange?.({ start: 0, end: safeDuration })
    onSeek(0)
  }

  // Can split?
  const canSplit = blocks.some((b) => currentTime > b.start + 0.15 && currentTime < b.end - 0.15)

  const playheadPercent = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100))

  return (
    <div className="flex flex-col gap-3 w-full max-w-full overflow-hidden select-none">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>{t.trimToolTitle}</span>
              {blocks.length > 1 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-semibold border border-amber-400/40">
                  {blocks.length} {t.segmentLabel}s
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">{t.trimSubtitle}</p>
          </div>
        </div>

        {/* Duration Badges */}
        <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
          <span className="text-slate-400 hidden sm:inline">
            {t.trimOriginal} <strong className="text-slate-300">{formatTime(safeDuration)}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-500/30 font-semibold">
            {t.trimSelected} {formatTime(totalActiveDuration)}
          </span>
        </div>
      </div>

      {/* Main Interactive Timeline Canvas / Track */}
      <div className="relative w-full pt-4 pb-2">
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className="relative h-14 sm:h-16 w-full bg-slate-950/90 rounded-xl border border-white/10 overflow-hidden cursor-pointer shadow-inner"
        >
          {/* Background Grid Time Hashes */}
          <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-20">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-full border-r border-slate-500 border-dashed" />
            ))}
          </div>

          {/* Render All Active Time Blocks */}
          {blocks.map((b, index) => {
            const bStartPct = (b.start / safeDuration) * 100
            const bEndPct = (b.end / safeDuration) * 100
            const bWidthPct = Math.max(1, bEndPct - bStartPct)
            const isSelected = b.id === activeBlock.id

            return (
              <div
                key={b.id}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectBlock?.(b.id)
                  onSeek(b.start)
                }}
                style={{
                  left: `${bStartPct}%`,
                  width: `${bWidthPct}%`,
                }}
                className={`absolute top-1 bottom-1 rounded-lg transition-all flex flex-col justify-between p-1 cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500/35 via-violet-500/35 to-amber-500/35 border-2 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.4)] z-10'
                    : 'bg-violet-950/40 hover:bg-violet-900/50 border border-violet-500/30 opacity-75 z-0'
                }`}
              >
                {/* Block header label */}
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-white/90 px-1 pointer-events-none truncate">
                  <span className="font-bold flex items-center gap-1">
                    #{index + 1}
                  </span>
                  <span className="opacity-80">
                    {(b.end - b.start).toFixed(1)}s
                  </span>
                </div>

                {/* Sub-label timestamp */}
                <div className="text-[8px] sm:text-[9px] font-mono text-amber-200/80 px-1 pointer-events-none truncate text-center">
                  {formatTime(b.start)} - {formatTime(b.end)}
                </div>

                {/* Left Drag Handle for selected block */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      handleStartDrag('start', e.clientX)
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      if (e.touches[0]) handleStartDrag('start', e.touches[0].clientX)
                    }}
                    className="trim-handle absolute left-0 top-0 bottom-0 w-4 bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center cursor-ew-resize rounded-l-md shadow-lg active:scale-105 z-20"
                    title={t.trimStart}
                  >
                    <div className="w-0.5 h-4 bg-slate-900/60 rounded-full" />
                  </div>
                )}

                {/* Right Drag Handle for selected block */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      handleStartDrag('end', e.clientX)
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation()
                      if (e.touches[0]) handleStartDrag('end', e.touches[0].clientX)
                    }}
                    className="trim-handle absolute right-0 top-0 bottom-0 w-4 bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center cursor-ew-resize rounded-r-md shadow-lg active:scale-105 z-20"
                    title={t.trimEnd}
                  >
                    <div className="w-0.5 h-4 bg-slate-900/60 rounded-full" />
                  </div>
                )}
              </div>
            )
          })}

          {/* Red/Cyan Playhead Indicator */}
          <div
            style={{ left: `${playheadPercent}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-red-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(248,113,113,0.9)]"
          >
            {/* Top Playhead Scrubber Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation()
                handleStartDrag('playhead', e.clientX)
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
                if (e.touches[0]) handleStartDrag('playhead', e.touches[0].clientX)
              }}
              className="trim-handle absolute -top-3.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-md cursor-grab active:cursor-grabbing pointer-events-auto"
            />
          </div>
        </div>
      </div>

      {/* Main Touch-Friendly Editing Action Bar (Icon-Only to eliminate text wrapping) */}
      <div className="flex items-center justify-between gap-2 pt-1 w-full">
        {/* Split Button */}
        <button
          onClick={handleSplitAtPlayhead}
          disabled={!canSplit}
          className={`flex-1 min-h-[44px] h-11 px-2 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation shadow-sm relative group ${
            canSplit
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/20 active:scale-95'
              : 'bg-white/[0.04] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-50'
          }`}
          title={t.splitAtPlayhead}
          aria-label={t.splitAtPlayhead}
        >
          <Scissors className="w-5 h-5 text-amber-200" />
        </button>

        {/* Delete Selected Block Button */}
        <button
          onClick={() => handleDeleteSelectedBlock()}
          disabled={blocks.length <= 1}
          className={`flex-1 min-h-[44px] h-11 px-2 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation shadow-sm relative group ${
            blocks.length > 1
              ? 'bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-500/30 active:scale-95 shadow-red-950/20'
              : 'bg-white/[0.04] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-40'
          }`}
          title={t.deleteSegment}
          aria-label={t.deleteSegment}
        >
          <Trash2 className="w-5 h-5 text-red-400" />
        </button>

        {/* Set Start (Cut In) */}
        <button
          onClick={handleSetStartAtPlayhead}
          className="flex-1 min-h-[44px] h-11 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shadow-sm"
          title={t.setStartAtPlayhead}
          aria-label={t.setStartAtPlayhead}
        >
          <div className="flex items-center gap-0.5 text-amber-300">
            <span className="font-mono text-base font-black">[</span>
            <ChevronLeft className="w-4 h-4" />
          </div>
        </button>

        {/* Set End (Cut Out) */}
        <button
          onClick={handleSetEndAtPlayhead}
          className="flex-1 min-h-[44px] h-11 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shadow-sm"
          title={t.setEndAtPlayhead}
          aria-label={t.setEndAtPlayhead}
        >
          <div className="flex items-center gap-0.5 text-amber-300">
            <ChevronRight className="w-4 h-4" />
            <span className="font-mono text-base font-black">]</span>
          </div>
        </button>

        {/* Reset All Cuts Button */}
        <button
          onClick={handleResetAllCuts}
          className="min-h-[44px] h-11 w-11 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-amber-300 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shrink-0 shadow-sm"
          title={t.resetSegments}
          aria-label={t.resetSegments}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Multi-Block Pills / Segment List */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
          <span className="flex items-center gap-1 font-medium">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>{t.activeSegments}</span>
          </span>
          <button
            onClick={handleResetAllCuts}
            className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t.resetSegments}</span>
          </button>
        </div>

        {/* Horizontal scroll of segment chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          {blocks.map((b, idx) => {
            const isSelected = b.id === activeBlock.id
            const len = Math.max(0, b.end - b.start).toFixed(1)
            return (
              <div
                key={b.id}
                onClick={() => {
                  onSelectBlock?.(b.id)
                  onSeek(b.start)
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono shrink-0 cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                    : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-violet-500/40'
                }`}
              >
                <span className="font-bold text-[10px] text-violet-400">#{idx + 1}</span>
                <span>
                  {formatTime(b.start)} - {formatTime(b.end)}
                </span>
                <span className="text-[10px] opacity-70">({len}s)</span>

                {blocks.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteSelectedBlock(b.id)
                    }}
                    className="ml-1 p-0.5 hover:bg-red-500/30 rounded text-slate-400 hover:text-red-300 transition-colors"
                    title={t.deleteSegment}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
