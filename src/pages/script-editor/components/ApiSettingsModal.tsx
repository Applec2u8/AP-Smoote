import React, { useState, useEffect } from 'react'
import {
  Key, X, Eye, EyeOff, CheckCircle2, AlertTriangle, Loader2,
  Cpu, Zap, Plus, Trash2, RotateCcw, ShieldCheck, Check, Sparkles,
} from 'lucide-react'
import { ApiProviderCategory, ApiKeyPoolState } from '../types'
import {
  getApiKeyPoolState,
  saveApiKeyPoolState,
  addKeysToCategory,
  removeKeyFromCategory,
  toggleKeyStatus,
  resetCategoryPool,
} from '../services/apiKeyRotator'

interface ApiSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [poolState, setPoolState] = useState<ApiKeyPoolState>(getApiKeyPoolState())
  const [activeTab, setActiveTab] = useState<ApiProviderCategory>('groq')
  const [newKeyInput, setNewKeyInput] = useState('')
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      const state = getApiKeyPoolState()
      setPoolState(state)
      setActiveTab(state.activeCategory || 'groq')
      setTestStatus('idle')
      setTestMsg('')
      setNewKeyInput('')
    }
  }, [isOpen])

  const handleAddKeys = () => {
    if (!newKeyInput.trim()) return
    const updated = addKeysToCategory(activeTab, newKeyInput)
    setPoolState({ ...updated })
    setNewKeyInput('')
  }

  const handleRemoveKey = (id: string) => {
    const updated = removeKeyFromCategory(activeTab, id)
    setPoolState({ ...updated })
  }

  const handleToggleKey = (id: string, current: boolean) => {
    const updated = toggleKeyStatus(activeTab, id, !current)
    setPoolState({ ...updated })
  }

  const handleResetExhausted = () => {
    const updated = resetCategoryPool(activeTab)
    setPoolState({ ...updated })
  }

  const handleSelectActiveCategory = (cat: ApiProviderCategory) => {
    const updated = { ...poolState, activeCategory: cat }
    setPoolState(updated)
    saveApiKeyPoolState(updated)
  }

  // Direct client-to-API key test (Zero backend needed!)
  const handleTestDirectKey = async () => {
    const activeKeys = poolState[activeTab].filter((k) => k.isActive && !k.isExhausted)
    if (activeKeys.length === 0) {
      setTestStatus('fail')
      setTestMsg(`ไม่มีคีย์ที่เปิดใช้งานในกลุ่ม ${activeTab.toUpperCase()}`)
      return
    }

    setTestStatus('testing')
    setTestMsg('')
    const targetKey = activeKeys[0].key

    try {
      if (activeTab === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${targetKey}` },
        })
        if (res.ok) {
          setTestStatus('ok')
          setTestMsg('Groq API Key เชื่อมต่อสำเร็จ! พร้อมใช้งานถอดเสียง Whisper Large')
        } else {
          setTestStatus('fail')
          setTestMsg(`Groq API ตอบกลับรหัส ${res.status} (อาจเป็นคีย์ไม่ถูกต้องหรือโควตาหมด)`)
        }
      } else {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`
        )
        if (res.ok) {
          setTestStatus('ok')
          setTestMsg('Gemini API Key เชื่อมต่อสำเร็จ! พร้อมใช้งานวิเคราะห์เสียงและสคริปต์')
        } else {
          setTestStatus('fail')
          setTestMsg(`Gemini API ตอบกลับรหัส ${res.status}`)
        }
      }
    } catch {
      setTestStatus('fail')
      setTestMsg('เกิดข้อผิดพลาดในการเชื่อมต่ออินเทอร์เน็ตไปยัง API Server')
    }
  }

  if (!isOpen) return null

  const currentKeys = poolState[activeTab] || []
  const activeCount = currentKeys.filter((k) => k.isActive && !k.isExhausted).length
  const exhaustedCount = currentKeys.filter((k) => k.isExhausted).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Key className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">ระบบจัดการ API Key Pool (LocalStorage Rotator)</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> 100% Client-Side
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                เก็บไว้ในเบราว์เซอร์ของคุณ ปลอดภัย ไม่ส่งเข้าเซิร์ฟเวอร์ใดๆ พร้อมสลับคีย์อัตโนมัติเมื่อชนโควตา (HTTP 429)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Category Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
              เลือกหมวดหมู่ AI Engine (Active STT & Summary Provider)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'groq' as ApiProviderCategory, name: 'Groq Whisper Large v3', icon: Zap, color: 'orange', keys: poolState.groq },
                { id: 'gemini' as ApiProviderCategory, name: 'Google Gemini 1.5 Flash', icon: Cpu, color: 'blue', keys: poolState.gemini },
              ].map(({ id, name, icon: Icon, color, keys }) => {
                const isSelected = activeTab === id
                const isActiveProvider = poolState.activeCategory === id
                const validKeys = keys.filter((k) => k.isActive && !k.isExhausted).length
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveTab(id)
                      handleSelectActiveCategory(id)
                    }}
                    className={`relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? `border-${color}-500/60 bg-${color}-500/10 shadow-lg shadow-${color}-500/10`
                        : 'border-white/10 bg-slate-800/40 hover:bg-slate-800/70 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl bg-${color}-500/20 text-${color}-400 flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{name}</span>
                        {isActiveProvider && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ใช้งานอยู่
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {validKeys} คีย์พร้อมใช้ / ทั้งหมด {keys.length} คีย์
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Add Multiple Keys Section */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                เพิ่ม API Key ลงในกลุ่ม {activeTab.toUpperCase()}
              </span>
              <span className="text-[11px] text-slate-500">
                (วางได้หลายคีย์พร้อมกัน คั่นด้วยคอมม่าหรือบรรทัดใหม่)
              </span>
            </div>

            <textarea
              rows={2}
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              placeholder={
                activeTab === 'groq'
                  ? 'gsk_key1, gsk_key2...\nหรือวางหลายบรรทัด'
                  : 'AIzaSy_key1, AIzaSy_key2...\nหรือวางหลายบรรทัด'
              }
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-mono outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {activeTab === 'groq' ? (
                  <>รับ Key ฟรีได้ที่ <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-400 underline">console.groq.com</a></>
                ) : (
                  <>รับ Key ฟรีได้ที่ <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline">aistudio.google.com</a></>
                )}
              </span>
              <button
                type="button"
                onClick={handleAddKeys}
                disabled={!newKeyInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow"
              >
                <Plus className="w-3.5 h-3.5" /> บันทึกเข้า Pool
              </button>
            </div>
          </div>

          {/* Key Pool List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                รายการ Key ในเบราว์เซอร์ ({currentKeys.length}) — พร้อมใช้งาน {activeCount} คีย์
              </span>
              {exhaustedCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetExhausted}
                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> ล้างสถานะโควตาเต็ม ({exhaustedCount})
                </button>
              )}
            </div>

            {currentKeys.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-800/20 border border-dashed border-white/10 text-xs text-slate-400">
                ยังไม่มี API Key ในหมวดหมู่นี้ กรุณาวาง API Key ด้านบนเพื่อเริ่มใช้งาน
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                {currentKeys.map((item, idx) => {
                  const isVisible = showKeys[item.id] || false
                  const maskedKey = isVisible
                    ? item.key
                    : `${item.key.slice(0, 7)}••••••••${item.key.slice(-4)}`

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                        item.isExhausted
                          ? 'border-red-500/30 bg-red-950/20 text-red-300'
                          : !item.isActive
                          ? 'border-white/5 bg-slate-800/30 opacity-50'
                          : 'border-white/10 bg-slate-800/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 font-mono text-[10px] text-slate-400 shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="font-mono truncate select-all">{maskedKey}</span>
                        {item.isExhausted && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                            Quota Exceeded (429)
                          </span>
                        )}
                        {item.failCount > 0 && !item.isExhausted && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-amber-400 bg-amber-500/15 shrink-0">
                            Fail: {item.failCount}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => setShowKeys((prev) => ({ ...prev, [item.id]: !isVisible }))}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                          title={isVisible ? 'ซ่อน' : 'แสดงคีย์'}
                        >
                          {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleKey(item.id, item.isActive)}
                          className={`p-1.5 rounded-lg text-xs font-semibold ${
                            item.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-slate-500 hover:bg-white/10'
                          }`}
                          title={item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveKey(item.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                          title="ลบคีย์"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Test API Key Directly */}
          <div>
            <button
              type="button"
              onClick={handleTestDirectKey}
              disabled={testStatus === 'testing'}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white border border-white/10 bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            >
              {testStatus === 'testing' ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังตรวจสอบคีย์กับ API Server...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5 text-amber-400" /> ทดสอบการเชื่อมต่อ API Key ตัวแรกในลิสต์</>
              )}
            </button>
            {testStatus === 'ok' && (
              <p className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {testMsg}
              </p>
            )}
            {testStatus === 'fail' && (
              <p className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {testMsg}
              </p>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
            <span>
              <strong>100% Client-Side Privacy:</strong> API Key ของคุณจะถูกเก็บใน <code>localStorage</code> ของเบราว์เซอร์นี้เท่านั้น และถูกส่งตรงไปยัง Official API (Groq/Google) ผ่าน HTTPS โดยไม่ผ่านเซิร์ฟเวอร์ตัวกลางใดๆ
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10 bg-slate-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            เสร็จสิ้น & ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
