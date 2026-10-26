import React from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from 'react-router-dom'
import { SlowMotionPage, defaultSmoothSettings } from './pages/slow-motion'
import { ScriptEditorPage } from './pages/script-editor'
import { Sparkles, Scissors, Film } from 'lucide-react'

// Re-export for backward compatibility
export { defaultSmoothSettings }

/**
 * Top Global Navigation Switcher
 * Provides clean, isolated navigation between the original Slow-Mo Studio and the new Script Editor
 */
const GlobalModuleSwitcher: React.FC = () => {
  const location = useLocation()
  const isScriptEditor = location.pathname.startsWith('/script-editor')
  const isSlowMo = location.pathname.startsWith('/slow-mo') || location.pathname === '/'

  return (
    <div className="bg-[#06080d] border-b border-white/[0.06] py-1 px-4 text-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-900/90 border border-white/10 shadow-inner">
          <NavLink
            to="/slow-mo"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                isActive || isSlowMo
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Film className="w-3.5 h-3.5" />
            <span>🎬 Slow-Mo Studio</span>
          </NavLink>

          <NavLink
            to="/script-editor"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                isActive || isScriptEditor
                  ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>📝 AI Script Video Editor</span>
            <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded bg-pink-500/30 text-pink-200 border border-pink-400/40">
              NEW
            </span>
          </NavLink>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
          <span>AP Smooth Studio Suite</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span className="text-emerald-400">100% Isolated Architecture</span>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
        {/* Module Switcher Bar */}
        <GlobalModuleSwitcher />

        {/* Isolated Routes */}
        <div className="flex-1">
          <Routes>
            <Route path="/slow-mo" element={<SlowMotionPage />} />
            <Route path="/script-editor" element={<ScriptEditorPage />} />
            <Route path="/" element={<Navigate to="/slow-mo" replace />} />
            <Route path="*" element={<Navigate to="/slow-mo" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
