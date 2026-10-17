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
  ZoomIn,
  ZoomOut,
  Maximize2,
  Magnet,
  Film,
} from 'lucide-react'
import { TimeBlock, TrimRange } from '../types'
import { Language, translations } from '../utils/i18n'
import { getTimeFromTimeBlocks } from '../utils/videoProcessor'

interface TimelineTrimmerProps {
  duration: number
  currentTime: number
  timeBlocks?: TimeBlock[]
  onTimeBlocksChange?: (blocks: TimeBlock[]) => void
  selectedBlockId?: string | null
  onSelectBlock?: (id: string | null) => void
  trimRange?: TrimRange
  onTrimChange?: (range: TrimRange) => void
  onSeek: (time: number) => void
  isPlaying: boolean
  onTogglePlay: () => void
  lang: Language
}

/**
 * Calculates elapsed sequence time across all active time blocks up to current source time.
 * Seamlessly tracks playhead across sequential cuts.
 */
function getElapsedSeqTime(
  blocks: TimeBlock[],
  sourceTime: number
): number {
  if (!blocks || blocks.length === 0) return Math.max(0, sourceTime)

  let elapsed = 0
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const dur = Math.max(0.05, b.end - b.start)
    if (sourceTime < b.start) {
      return elapsed
    } else if (sourceTime >= b.start && sourceTime <= b.end) {
      return elapsed + Math.max(0, sourceTime - b.start)
    }
    elapsed += dur
  }
  return elapsed
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const safeDuration = Math.max(0.1, duration || 1)

  // 1. Zoom state (1x to 8x)
  const [zoom, setZoom] = useState<number>(1)
  const [isPinching, setIsPinching] = useState<boolean>(false)
  const pinchStartDistRef = useRef<number>(0)
  const pinchStartZoomRef = useRef<number>(1)

  // 2. Auto-Ripple Mode (default ON)
  // When ON: clips are packed continuously from 0:00 with no empty gaps in front.
  const [isAutoRipple, setIsAutoRipple] = useState<boolean>(true)

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

  // Currently selected block (null if unselected / deselected)
  const activeBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) || null : null

  // Total active selected duration across all blocks
  const totalActiveDuration = Math.max(
    0.05,
    blocks.reduce((acc, b) => acc + Math.max(0, b.end - b.start), 0)
  )

  // Track time span: scales with active sequence or safe duration
  const trackTimeSpan = isAutoRipple ? Math.max(safeDuration, totalActiveDuration) : safeDuration

  // Dragging state
  const [dragTarget, setDragTarget] = useState<'start' | 'end' | 'playhead' | null>(null)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const dragStartXRef = useRef(0)
  const dragInitialBlockRef = useRef<TimeBlock>({ id: '', start: 0, end: 0 })
  const dragTargetBlockIdRef = useRef<string>('')

  const formatTime = (secs: number) => {
    const s = Math.max(0, secs)
    const m = Math.floor(s / 60)
    const remS = Math.floor(s % 60)
    const ms = Math.floor((s % 1) * 100)
    return `${m}:${remS < 10 ? '0' : ''}${remS}.${ms < 10 ? '0' : ''}${ms}`
  }

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(8, Number((prev * 1.5).toFixed(1))))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(1, Number((prev / 1.5).toFixed(1))))
  }

  const handleCycleZoom = () => {
    if (zoom < 1.8) setZoom(2)
    else if (zoom < 3.8) setZoom(4)
    else setZoom(1)
  }

  const handleResetZoom = () => {
    setZoom(1)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0
    }
  }

  // Pinch-to-zoom on Mobile (2 fingers)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      pinchStartDistRef.current = dist
      pinchStartZoomRef.current = zoom
      setIsPinching(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current > 0) {
      if (e.cancelable) e.preventDefault()
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const scale = dist / pinchStartDistRef.current
      const newZoom = Math.max(1, Math.min(8, Number((pinchStartZoomRef.current * scale).toFixed(1))))
      setZoom(newZoom)
    }
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      setIsPinching(false)
      pinchStartDistRef.current = 0
    }
  }

  // Desktop Mouse Wheel Zoom with Ctrl / Meta
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY * -0.01
        setZoom((z) => Math.max(1, Math.min(8, Number((z + delta).toFixed(2)))))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Auto-scroll track to keep playhead in view when zoomed in
  useEffect(() => {
    if (zoom <= 1 || !scrollContainerRef.current || !trackRef.current) return
    const container = scrollContainerRef.current

    let currentFraction = 0
    if (isAutoRipple) {
      const elapsedSeq = getElapsedSeqTime(blocks, currentTime)
      currentFraction = elapsedSeq / safeDuration
    } else {
      currentFraction = currentTime / safeDuration
    }

    const trackWidth = trackRef.current.clientWidth
    const playheadPx = currentFraction * trackWidth

    const viewLeft = container.scrollLeft
    const viewRight = viewLeft + container.clientWidth
    const margin = 60

    if (playheadPx < viewLeft + margin) {
      container.scrollLeft = Math.max(0, playheadPx - margin)
    } else if (playheadPx > viewRight - margin) {
      container.scrollLeft = playheadPx - container.clientWidth + margin
    }
  }, [currentTime, zoom, isAutoRipple, blocks, safeDuration])

  // Map clientX to source timestamp
  const getSourceTimeFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0
      const rect = trackRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const trackTime = ratio * trackTimeSpan

      if (isAutoRipple) {
        let accumulated = 0
        for (const b of blocks) {
          const dur = Math.max(0.05, b.end - b.start)
          if (trackTime <= accumulated + dur) {
            const offset = Math.max(0, trackTime - accumulated)
            return b.start + offset
          }
          accumulated += dur
        }
        return blocks[blocks.length - 1]?.end || 0
      } else {
        return trackTime
      }
    },
    [isAutoRipple, blocks, trackTimeSpan]
  )

  // Start drag handler
  const handleStartDrag = (
    target: 'start' | 'end' | 'playhead',
    clientX: number,
    blockId?: string
  ) => {
    setDragTarget(target)
    dragStartXRef.current = clientX
    const targetBlock = blocks.find((b) => b.id === (blockId || activeBlock?.id)) || blocks[0]
    if (!targetBlock) return
    dragTargetBlockIdRef.current = targetBlock.id
    dragInitialBlockRef.current = { ...targetBlock }

    if (target === 'start') {
      setActiveTooltip(`In: ${formatTime(targetBlock.start)}`)
    } else if (target === 'end') {
      setActiveTooltip(`Out: ${formatTime(targetBlock.end)} (${(targetBlock.end - targetBlock.start).toFixed(2)}s)`)
    } else {
      setActiveTooltip(`Time: ${formatTime(currentTime)}`)
    }
  }

  // Pointer move handler (Real-time responsive dragging)
  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!dragTarget || !trackRef.current) return
      const trackWidth = trackRef.current.clientWidth
      if (trackWidth <= 0) return

      const deltaX = clientX - dragStartXRef.current
      const deltaTime = (deltaX / trackWidth) * trackTimeSpan
      const targetBlockId = dragTargetBlockIdRef.current || activeBlock?.id
      if (!targetBlockId && dragTarget !== 'playhead') return
      const initialBlock = dragInitialBlockRef.current

      const minGap = 0.15

      if (dragTarget === 'start') {
        const targetStart = Math.max(
          0,
          Math.min(initialBlock.end - minGap, initialBlock.start + deltaTime)
        )
        const roundedStart = Number(targetStart.toFixed(2))
        const updated = blocks.map((b) =>
          b.id === targetBlockId ? { ...b, start: roundedStart } : b
        )
        onTimeBlocksChange?.(updated)
        if (onTrimChange && updated.length === 1) {
          onTrimChange({ start: updated[0].start, end: updated[0].end })
        }
        const curDur = (initialBlock.end - roundedStart).toFixed(2)
        setActiveTooltip(`In: ${formatTime(roundedStart)} (${curDur}s)`)
        onSeek(roundedStart)
      } else if (dragTarget === 'end') {
        const targetEnd = Math.min(
          safeDuration,
          Math.max(initialBlock.start + minGap, initialBlock.end + deltaTime)
        )
        const roundedEnd = Number(targetEnd.toFixed(2))
        const updated = blocks.map((b) =>
          b.id === targetBlockId ? { ...b, end: roundedEnd } : b
        )
        onTimeBlocksChange?.(updated)
        if (onTrimChange && updated.length === 1) {
          onTrimChange({ start: updated[0].start, end: updated[0].end })
        }
        const curDur = (roundedEnd - initialBlock.start).toFixed(2)
        setActiveTooltip(`Out: ${formatTime(roundedEnd)} (${curDur}s)`)
        onSeek(roundedEnd)
      } else if (dragTarget === 'playhead') {
        const targetTime = getSourceTimeFromClientX(clientX)
        const clamped = Math.max(0, Math.min(safeDuration, targetTime))
        setActiveTooltip(`Time: ${formatTime(clamped)}`)
        onSeek(clamped)
      }
    },
    [
      dragTarget,
      safeDuration,
      activeBlock?.id,
      blocks,
      onTimeBlocksChange,
      onTrimChange,
      onSeek,
      getSourceTimeFromClientX,
      trackTimeSpan,
    ]
  )

  // Global mouse/touch listeners for continuous drag outside the element
  useEffect(() => {
    if (!dragTarget) return

    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        if (e.cancelable) e.preventDefault()
        handlePointerMove(e.touches[0].clientX)
      }
    }
    const onEnd = () => {
      setDragTarget(null)
      setActiveTooltip(null)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
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

  // Track click seeking and selection/deselection
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.trim-handle')) return
    if ((e.target as HTMLElement).closest('.timeline-block')) return

    // Clicked empty space on timeline -> Deselect / Unmark cut!
    onSelectBlock?.(null)

    // Seek playhead to clicked position
    const targetTime = getSourceTimeFromClientX(e.clientX)
    onSeek(targetTime)
  }

  // Split at playhead
  const handleSplitAtPlayhead = () => {
    const cur = Number(currentTime.toFixed(2))
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

  // Delete selected block (Remaining blocks automatically ripple to start)
  const handleDeleteSelectedBlock = (blockIdToDelete?: string) => {
    const id = blockIdToDelete || activeBlock?.id
    if (!id || blocks.length <= 1) return // Keep at least one block

    const nextBlocks = blocks.filter((b) => b.id !== id)
    onTimeBlocksChange?.(nextBlocks)

    const remainingActive = nextBlocks[0]
    if (remainingActive && onSelectBlock) {
      onSelectBlock(remainingActive.id)
      onSeek(remainingActive.start)
    }
  }

  // Set start / end at playhead
  const handleSetStartAtPlayhead = () => {
    const cur = Number(currentTime.toFixed(2))
    const targetBlock = activeBlock || blocks.find((b) => cur >= b.start && cur <= b.end) || blocks[0]
    if (!targetBlock || cur >= targetBlock.end - 0.2) return
    const updated = blocks.map((b) => (b.id === targetBlock.id ? { ...b, start: cur } : b))
    onTimeBlocksChange?.(updated)
    if (onTrimChange && updated.length === 1) {
      onTrimChange({ start: updated[0].start, end: updated[0].end })
    }
  }

  const handleSetEndAtPlayhead = () => {
    const cur = Number(currentTime.toFixed(2))
    const targetBlock = activeBlock || blocks.find((b) => cur >= b.start && cur <= b.end) || blocks[0]
    if (!targetBlock || cur <= targetBlock.start + 0.2) return
    const updated = blocks.map((b) => (b.id === targetBlock.id ? { ...b, end: cur } : b))
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

  // Playhead percentage along the track
  let playheadPercent = 0
  if (isAutoRipple) {
    const elapsedSeq = getElapsedSeqTime(blocks, currentTime)
    playheadPercent = Math.max(0, Math.min(100, (elapsedSeq / trackTimeSpan) * 100))
  } else {
    playheadPercent = Math.max(0, Math.min(100, (currentTime / safeDuration) * 100))
  }

  // Dynamic layout coordinates for blocks (proportional to duration so resizing works visually!)
  const blockLayouts = (() => {
    if (isAutoRipple) {
      let accumulatedSeq = 0
      return blocks.map((b) => {
        const dur = Math.max(0.05, b.end - b.start)
        const startSeq = accumulatedSeq
        accumulatedSeq += dur
        const leftPct = (startSeq / trackTimeSpan) * 100
        const widthPct = (dur / trackTimeSpan) * 100
        return {
          ...b,
          leftPct,
          widthPct,
          duration: dur,
        }
      })
    } else {
      return blocks.map((b) => {
        const bStartPct = (b.start / safeDuration) * 100
        const bEndPct = (b.end / safeDuration) * 100
        const bWidthPct = Math.max(0.5, bEndPct - bStartPct)
        return {
          ...b,
          leftPct: bStartPct,
          widthPct: bWidthPct,
          duration: b.end - b.start,
        }
      })
    }
  })()

  // Dynamic ruler ticks based on zoom
  const rulerTicks = (() => {
    const count = Math.min(60, Math.max(10, Math.round(12 * zoom)))
    return Array.from({ length: count + 1 }).map((_, i) => {
      const pct = (i / count) * 100
      const timeVal = (i / count) * trackTimeSpan
      const isMajor = i % (zoom >= 4 ? 2 : 4) === 0
      return { pct, timeVal, isMajor }
    })
  })()

  return (
    <div className="flex flex-col gap-2 w-full max-w-full overflow-hidden select-none">
      {/* Header Info & Controls Bar */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        {/* Title & Badge */}
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-amber-500/20 text-amber-400">
            <Scissors className="w-3.5 h-3.5" />
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
          </div>
        </div>

        {/* Zoom Controls & Auto-Ripple Toggle */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* Auto-Ripple Toggle Button */}
          <button
            type="button"
            onClick={() => setIsAutoRipple(!isAutoRipple)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${isAutoRipple
              ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/20'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            title={isAutoRipple ? t.autoRipple : t.sourceScale}
          >
            {isAutoRipple ? (
              <Magnet className="w-3 h-3 text-amber-400 animate-pulse" />
            ) : (
              <Film className="w-3 h-3" />
            )}
            <span>{isAutoRipple ? 'Auto-Ripple' : t.sourceScale}</span>
          </button>

          {/* Zoom Buttons Group */}
          <div className="inline-flex items-center bg-slate-900/80 border border-white/10 rounded-lg p-0.5 shadow-sm">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className={`p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${zoom <= 1 ? 'opacity-30 cursor-not-allowed' : ''
                }`}
              title={t.zoomOut}
            >
              <ZoomOut className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleCycleZoom}
              className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-300 hover:text-amber-200 cursor-pointer min-w-[32px] text-center"
              title="Click to toggle 1x / 2x / 4x"
            >
              {zoom.toFixed(1)}x
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 8}
              className={`p-1 rounded text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${zoom >= 8 ? 'opacity-30 cursor-not-allowed' : ''
                }`}
              title={t.zoomIn}
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Duration Badges */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded bg-violet-950/70 text-violet-300 border border-violet-500/30 font-semibold">
              {t.trimSelected} {formatTime(totalActiveDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Active Drag Tooltip */}
      {activeTooltip && (
        <div className="flex justify-center -mb-1 animate-in fade-in duration-100">
          <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-mono font-bold text-[11px] shadow-lg shadow-amber-500/30">
            {activeTooltip}
          </span>
        </div>
      )}

      {/* Timeline Outer Scrollable Viewport (Horizontal Scroll Only, Touch-Action None for Dragging) */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (
            !(e.target as HTMLElement).closest('.timeline-block') &&
            !(e.target as HTMLElement).closest('.trim-handle')
          ) {
            onSelectBlock?.(null)
          }
        }}
        className="relative w-full overflow-x-auto overflow-y-hidden py-1.5 rounded-xl border border-white/10 bg-[#07090e]/95 shadow-inner touch-pan-x scrollbar-thin scrollbar-thumb-white/10"
      >
        {/* Pinching indicator toast */}
        {isPinching && (
          <div className="absolute top-1 right-2 z-40 bg-black/80 backdrop-blur px-2 py-0.5 rounded text-[10px] text-amber-300 font-mono border border-amber-400/40">
            Pinch: {zoom.toFixed(1)}x
          </div>
        )}

        {/* Dynamic Zoomed Track Area */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          style={{
            width: `${zoom * 100}%`,
            minWidth: '100%',
            touchAction: 'none',
          }}
          className="relative h-14 sm:h-16 cursor-pointer select-none px-2 touch-none"
        >
          {/* Time Ruler & Sub-second Hashes */}
          <div className="absolute inset-x-0 top-0 h-4 flex justify-between pointer-events-none px-2 opacity-50 border-b border-white/[0.06]">
            {rulerTicks.map((tick, i) => (
              <div
                key={i}
                style={{ left: `${tick.pct}%` }}
                className="absolute top-0 flex flex-col items-center"
              >
                <div
                  className={`w-[1px] bg-slate-400 ${tick.isMajor ? 'h-2 bg-amber-400/70' : 'h-1 opacity-40'
                    }`}
                />
                {tick.isMajor && (
                  <span className="text-[8px] font-mono text-slate-400 -mt-0.5 select-none scale-90">
                    {formatTime(tick.timeVal)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Background Grid Lines */}
          <div className="absolute inset-x-0 top-4 bottom-0 flex justify-between pointer-events-none opacity-10">
            {rulerTicks
              .filter((t) => t.isMajor)
              .map((tick, i) => (
                <div
                  key={i}
                  style={{ left: `${tick.pct}%` }}
                  className="absolute top-0 bottom-0 border-r border-slate-400 border-dashed"
                />
              ))}
          </div>

          {/* Render All Active Time Blocks */}
          <div className="absolute inset-x-0 top-4 bottom-1 pointer-events-none">
            {blockLayouts.map((b, index) => {
              const isSelected = activeBlock ? b.id === activeBlock.id : false

              return (
                <div
                  key={b.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectBlock?.(b.id)
                    onSeek(b.start)
                  }}
                  style={{
                    left: `${b.leftPct}%`,
                    width: `${b.widthPct}%`,
                    touchAction: 'none',
                  }}
                  className={`timeline-block absolute top-0 bottom-0 rounded-xl flex flex-col justify-between py-1 cursor-pointer overflow-visible pointer-events-auto touch-none transition-shadow ${isSelected
                    ? 'bg-gradient-to-r from-amber-500/35 via-violet-500/30 to-amber-500/35 border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)] z-10'
                    : 'bg-violet-950/40 hover:bg-violet-900/50 border border-violet-500/30 opacity-75 z-0'
                    }`}
                >
                  {/* Block Header Info */}
                  <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-white/95 px-2 pointer-events-none truncate z-0">
                    <span className="font-bold flex items-center gap-1">
                      #{index + 1}
                    </span>
                    <span className="opacity-90 font-semibold text-amber-200">
                      {b.duration.toFixed(2)}s
                    </span>
                  </div>

                  {/* Sub-label timestamp range */}
                  <div className="text-[8px] sm:text-[9px] font-mono text-slate-300 px-2 pointer-events-none truncate text-center z-0">
                    {formatTime(b.start)} - {formatTime(b.end)}
                  </div>

                  {/* Left Trim Handle: Responsive Dragging */}
                  {isSelected && (
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleStartDrag('start', e.clientX, b.id)
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                        if (e.cancelable) e.preventDefault()
                        if (e.touches[0]) handleStartDrag('start', e.touches[0].clientX, b.id)
                      }}
                      style={{ touchAction: 'none' }}
                      className="trim-handle absolute -left-1.5 top-0 bottom-0 w-8 sm:w-6 bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center cursor-ew-resize rounded-l-xl shadow-xl active:scale-105 transition-transform z-30 touch-none select-none group"
                      title={t.trimStart}
                    >
                      {/* Extended Hit Area for Easy Touch */}
                      <span className="absolute -inset-y-2 -left-3 -right-2 content-['']" />
                      {/* Tactile Grip Ribs */}
                      <div className="flex items-center gap-0.5 pointer-events-none">
                        <div className="w-[2px] h-4 bg-slate-950/80 rounded-full" />
                        <div className="w-[2px] h-4 bg-slate-950/80 rounded-full" />
                      </div>
                    </div>
                  )}

                  {/* Right Trim Handle: Responsive Dragging */}
                  {isSelected && (
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleStartDrag('end', e.clientX, b.id)
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation()
                        if (e.cancelable) e.preventDefault()
                        if (e.touches[0]) handleStartDrag('end', e.touches[0].clientX, b.id)
                      }}
                      style={{ touchAction: 'none' }}
                      className="trim-handle absolute -right-1.5 top-0 bottom-0 w-8 sm:w-6 bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center cursor-ew-resize rounded-r-xl shadow-xl active:scale-105 transition-transform z-30 touch-none select-none group"
                      title={t.trimEnd}
                    >
                      {/* Extended Hit Area for Easy Touch */}
                      <span className="absolute -inset-y-2 -left-2 -right-3 content-['']" />
                      {/* Tactile Grip Ribs */}
                      <div className="flex items-center gap-0.5 pointer-events-none">
                        <div className="w-[2px] h-4 bg-slate-950/80 rounded-full" />
                        <div className="w-[2px] h-4 bg-slate-950/80 rounded-full" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Red/White Playhead Line with Touch-Friendly Scrubber */}
          <div
            style={{ left: `${playheadPercent}%` }}
            className="absolute top-1 bottom-0 w-[2px] bg-red-400 z-30 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.9)]"
          >
            {/* Top Scrubber Knob with Expanded Touch Target */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation()
                handleStartDrag('playhead', e.clientX)
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
                if (e.cancelable) e.preventDefault()
                if (e.touches[0]) handleStartDrag('playhead', e.touches[0].clientX)
              }}
              style={{ touchAction: 'none' }}
              className="trim-handle absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-red-500 border-2 border-white shadow-xl cursor-grab active:cursor-grabbing pointer-events-auto flex items-center justify-center active:scale-110 transition-transform touch-none select-none"
            >
              {/* Invisible Hit Area */}
              <span className="absolute -inset-3 content-['']" />
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Touch-Friendly Editing Action Bar */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 pt-0.5 w-full">
        {/* Split Button */}
        <button
          type="button"
          onClick={handleSplitAtPlayhead}
          disabled={!canSplit}
          className={`flex-1 min-h-[42px] h-10 px-2 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation shadow-sm relative group ${canSplit
            ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-900/20 active:scale-95'
            : 'bg-white/[0.04] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-50'
            }`}
          title={t.splitAtPlayhead}
          aria-label={t.splitAtPlayhead}
        >
          <Scissors className="w-4 h-4 text-amber-200" />
        </button>

        {/* Delete Selected Block Button */}
        <button
          type="button"
          onClick={() => handleDeleteSelectedBlock()}
          disabled={!activeBlock || blocks.length <= 1}
          className={`flex-1 min-h-[42px] h-10 px-2 rounded-xl flex items-center justify-center transition-all cursor-pointer touch-manipulation shadow-sm relative group ${activeBlock && blocks.length > 1
            ? 'bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-500/30 active:scale-95 shadow-red-950/20'
            : 'bg-white/[0.04] text-slate-500 border border-white/[0.05] cursor-not-allowed opacity-40'
            }`}
          title={activeBlock ? t.deleteSegment : 'Select a clip to delete'}
          aria-label={t.deleteSegment}
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>

        {/* Set Start (Cut In) */}
        <button
          type="button"
          onClick={handleSetStartAtPlayhead}
          className="flex-1 min-h-[42px] h-10 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shadow-sm"
          title={t.setStartAtPlayhead}
          aria-label={t.setStartAtPlayhead}
        >
          <div className="flex items-center gap-0.5 text-amber-300">
            <span className="font-mono text-sm font-black">[</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </div>
        </button>

        {/* Set End (Cut Out) */}
        <button
          type="button"
          onClick={handleSetEndAtPlayhead}
          className="flex-1 min-h-[42px] h-10 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-200 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shadow-sm"
          title={t.setEndAtPlayhead}
          aria-label={t.setEndAtPlayhead}
        >
          <div className="flex items-center gap-0.5 text-amber-300">
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-mono text-sm font-black">]</span>
          </div>
        </button>

        {/* Reset All Cuts Button */}
        <button
          type="button"
          onClick={handleResetAllCuts}
          className="min-h-[42px] h-10 w-10 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-slate-300 hover:text-amber-300 flex items-center justify-center cursor-pointer touch-manipulation active:scale-95 transition-all shrink-0 shadow-sm"
          title={t.resetSegments}
          aria-label={t.resetSegments}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Multi-Block Pills / Segment List */}
      <div className="flex flex-col gap-1 pt-1 border-t border-white/[0.06]">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
          <span className="flex items-center gap-1 font-medium">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>{t.activeSegments}</span>
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            {t.pinchZoomHint}
          </span>
        </div>

        {/* Horizontal scroll of segment chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
          {blocks.map((b, idx) => {
            const isSelected = activeBlock ? b.id === activeBlock.id : false
            const len = Math.max(0, b.end - b.start).toFixed(2)
            return (
              <div
                key={b.id}
                onClick={() => {
                  onSelectBlock?.(b.id)
                  onSeek(b.start)
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 cursor-pointer transition-all border ${isSelected
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
                    type="button"
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
