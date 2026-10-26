import React, { useState } from 'react'
import { TTSMixSettings } from '../types'
import { AVAILABLE_TTS_VOICES, playBrowserTTSPreview } from '../services/api'
import { Mic, Volume2, Sliders, Play, Square, Music2, Sparkles } from 'lucide-react'

interface TTSVoiceMixerProps {
  settings: TTSMixSettings
  onChangeSettings: (settings: TTSMixSettings) => void
  scriptPreviewText?: string
}

export const TTSVoiceMixer: React.FC<TTSVoiceMixerProps> = ({
  settings,
  onChangeSettings,
  scriptPreviewText,
}) => {
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)

  const handleToggle = (enabled: boolean) => {
    onChangeSettings({ ...settings, enabled })
  }

  // Play browser Web Speech API preview (100% Client-Side)
  const handlePlayVoicePreview = () => {
    if (isPlayingPreview) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setIsPlayingPreview(false)
      return
    }

    const sample =
      scriptPreviewText?.slice(0, 150) ||
      'สวัสดีครับ ระบบกำลังสังเคราะห์เสียงพากย์สำหรับวิดีโอของคุณ'

    setIsPlayingPreview(true)
    playBrowserTTSPreview(sample, settings.voiceId, settings.speed).finally(() => {
      setIsPlayingPreview(false)
    })
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl p-6 shadow-2xl space-y-4">
      {/* Switch Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>สร้างเสียงพากย์ AI (Text-to-Speech Mixer)</span>
            </h4>
            <p className="text-xs text-slate-400">
              สังเคราะห์เสียงพูด AI จากสคริปต์ที่ตัดแต่งแล้ว ผ่านเบราว์เซอร์ 100%
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-12 h-6.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-pink-600 shadow-inner"></div>
        </label>
      </div>

      {settings.enabled ? (
        <div className="space-y-4 pt-1">
          {/* Select Voice */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              เลือกเสียง AI (Voice Actor)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_TTS_VOICES.map((voice) => {
                const isSelected = settings.voiceId === voice.id
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => onChangeSettings({ ...settings, voiceId: voice.id })}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/15 shadow-lg shadow-purple-500/10'
                        : 'border-white/5 bg-slate-800/40 hover:bg-slate-800/70 hover:border-white/10'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                        isSelected ? 'bg-purple-500 text-white shadow' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {voice.gender === 'female' ? '♀' : '♂'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {voice.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ภาษา: {voice.language} ({voice.locale})
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sliders: Speed, TTS Volume, Original Audio Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Speed */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" /> สปีดการพูด
                </span>
                <span className="font-mono text-purple-300 font-bold">{settings.speed}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.5"
                step="0.05"
                value={settings.speed}
                onChange={(e) =>
                  onChangeSettings({ ...settings, speed: parseFloat(e.target.value) })
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* TTS Volume */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-purple-400" /> ระดับเสียงพากย์
                </span>
                <span className="font-mono text-purple-300 font-bold">{settings.ttsVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.ttsVolume}
                onChange={(e) =>
                  onChangeSettings({ ...settings, ttsVolume: parseInt(e.target.value, 10) })
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Original Video Volume */}
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-white/5">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-semibold flex items-center gap-1">
                  <Music2 className="w-3.5 h-3.5 text-indigo-400" /> เสียงคลิปเดิม
                </span>
                <span className="font-mono text-indigo-300 font-bold">
                  {settings.originalVolume === 0 ? 'ปิดเสียง' : `${settings.originalVolume}%`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.originalVolume}
                onChange={(e) =>
                  onChangeSettings({ ...settings, originalVolume: parseInt(e.target.value, 10) })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Test Preview Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePlayVoicePreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-purple-200 bg-purple-500/20 border border-purple-500/40 hover:bg-purple-500/30 active:scale-95 transition-all cursor-pointer shadow"
            >
              {isPlayingPreview ? (
                <><Square className="w-3.5 h-3.5 text-red-400" /> หยุดฟังเสียง</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> ทดลองฟังตัวอย่างเสียงพากย์ AI</>
              )}
            </button>

            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" /> Web Speech Synthesis Engine
            </span>
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-slate-800/20 border border-dashed border-white/10 text-center text-xs text-slate-400">
          โหมดคงเสียงต้นฉบับเดิม: ระบบจะตัดต่อคลิปโดยใช้เสียงพูดจากวิดีโอจริงตามท่อนสคริปต์ที่เลือกไว้
        </div>
      )}
    </div>
  )
}
