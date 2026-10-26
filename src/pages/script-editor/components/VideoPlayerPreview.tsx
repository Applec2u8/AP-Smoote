import React, { useRef, useEffect, useState } from 'react'
import { TranscriptSegment } from '../types'
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, Zap } from 'lucide-react'

interface VideoPlayerPreviewProps {
  videoUrl: string
  title: string
  segments: TranscriptSegment[]
  currentTime: number
  onTimeUpdate: (time: number) => void
  onDurationChange?: (duration: number) => void
}

export const VideoPlayerPreview: React.FC<VideoPlayerPreviewProps> = ({
  videoUrl,
  title,
  segments,
  currentTime,
  onTimeUpdate,
  onDurationChange,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [autoSkipDeleted, setAutoSkipDeleted] = useState(true)

  // Sync internal video currentTime if triggered from outside (e.g., clicking on word)
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime])

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  // Handle auto-skipping deleted word regions in preview
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime
    onTimeUpdate(cur)

    if (autoSkipDeleted && segments.length > 0) {
      // Find if current time falls in a deleted word
      for (const seg of segments) {
        for (const w of seg.words) {
          if (w.isDeleted && cur >= w.start && cur < w.end) {
            // Jump immediately to the end of this deleted word
            videoRef.current.currentTime = w.end + 0.05
            return
          }
        }
      }
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-white/5">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200 truncate">{title}</span>
        </div>

        {/* Auto-skip Toggle */}
        <button
          type="button"
          onClick={() => setAutoSkipDeleted(!autoSkipDeleted)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
            autoSkipDeleted
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'bg-slate-800 text-slate-400 border border-white/5'
          }`}
          title="ข้ามท่อนที่ลบทันทีตอนพรีวิว"
        >
          <Zap className="w-3 h-3" />
          <span>จำลองการตัดคำ ({autoSkipDeleted ? 'เปิด' : 'ปิด'})</span>
        </button>
      </div>

      {/* Video Canvas Container */}
      <div className="relative bg-black flex items-center justify-center min-h-[260px] sm:min-h-[340px]">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration)
              onDurationChange?.(videoRef.current.duration)
            }
          }}
          onEnded={() => setIsPlaying(false)}
          className="max-h-[380px] w-full object-contain"
        />

        {/* Center Play Button Overlay if Paused */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute w-14 h-14 rounded-full bg-indigo-600/80 hover:bg-indigo-500 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-2xl shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Play className="w-6 h-6 ml-0.5" />
          </button>
        )}
      </div>

      {/* Control Bar */}
      <div className="p-3 bg-slate-900/95 border-t border-white/5 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        {/* Seeker */}
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.05"
            value={currentTime}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (videoRef.current) videoRef.current.currentTime = val
              onTimeUpdate(val)
            }}
            className="w-full accent-indigo-500 cursor-pointer"
          />
        </div>

        {/* Time Stamp */}
        <div className="text-xs font-mono text-slate-400 shrink-0">
          {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
        </div>

        {/* Mute */}
        <button
          type="button"
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.muted = !isMuted
              setIsMuted(!isMuted)
            }
          }}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
