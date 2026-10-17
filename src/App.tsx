import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Navbar } from './components/Navbar'
import { VideoUploader } from './components/VideoUploader'
import { VideoPreview } from './components/VideoPreview'
import { ControlPanel, PanelTab } from './components/ControlPanel'
import { ExportModal } from './components/ExportModal'
import { HistoryModal } from './components/HistoryModal'
import { SupabaseConfigModal } from './components/SupabaseConfigModal'
import { generateDemoVideoBlob } from './utils/sampleVideo'
import {
  saveProjectMetadata,
  fetchProjectHistory,
  deleteProjectMetadata,
  isSupabaseConfigured,
} from './utils/supabase'
import {
  ProjectItem,
  ProjectMetadata,
  SmoothSettings,
  TimeBlock,
  TrimRange,
  VideoMetadata,
  VideoTransformSettings,
} from './types'
import { Language, translations } from './utils/i18n'
import {
  saveProjectToIDB,
  getAllProjectsFromIDB,
  deleteProjectFromIDB,
  saveActiveSessionToIDB,
  getActiveSessionFromIDB,
  clearActiveSessionFromIDB,
  captureCurrentCanvasThumbnail,
  generateVideoThumbnail,
  saveVideoToIDB,
  getVideoFromIDB,
  clearVideoFromIDB,
} from './utils/idbStorage'
import {
  Sparkles,
  Layers,
  Zap,
  ShieldCheck,
  Upload,
  Scissors,
  Sliders,
  Download,
  RotateCcw,
  CheckCircle2,
  Undo2,
  Redo2,
  Save,
  FolderOpen,
} from 'lucide-react'

export const defaultSmoothSettings: SmoothSettings = {
  intensity: 65,
  mode: 'blend',
  frameSamples: 5,
  blendDecay: 0.65,
  sharpness: 15,
  brightness: 100,
  contrast: 105,
  enableStabilizeSim: false,
  playbackSpeed: 1.0,
}

const defaultTransformSettings: VideoTransformSettings = {
  aspectRatio: 'original',
  fitMode: 'contain',
  zoom: 1.0,
  panX: 0,
  panY: 0,
}

interface HistorySnapshot {
  timeBlocks: TimeBlock[]
  smoothSettings: SmoothSettings
  transformSettings: VideoTransformSettings
  selectedBlockId: string | null
}

export function App() {
  // Language State (Defaults to Lao 'la', supports 'en')
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('smoot_lang')
    return saved === 'en' || saved === 'la' ? saved : 'la'
  })

  const t = translations[lang]

  const handleSetLang = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem('smoot_lang', newLang)
  }

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [projectName, setProjectName] = useState(() => (lang === 'la' ? 'ໂປຣເຈັກ Smoot' : 'My Smooth Project'))
  const [smoothSettings, setSmoothSettings] = useState<SmoothSettings>(() => {
    try {
      const saved = localStorage.getItem('smoot_settings')
      return saved ? JSON.parse(saved) : defaultSmoothSettings
    } catch {
      return defaultSmoothSettings
    }
  })

  // Multi-block trim & Transform settings
  const [trimRange, setTrimRange] = useState<TrimRange>({ start: 0, end: 0 })
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [transformSettings, setTransformSettings] = useState<VideoTransformSettings>(() => {
    try {
      const saved = localStorage.getItem('smoot_transform')
      return saved ? JSON.parse(saved) : defaultTransformSettings
    } catch {
      return defaultTransformSettings
    }
  })

  // ==========================================
  // UNDO / REDO HISTORY SYSTEM (Ctrl+Z / Ctrl+Y)
  // ==========================================
  const [historyStack, setHistoryStack] = useState<HistorySnapshot[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoActionRef = useRef(false)
  // Keep a ref in sync with historyIndex to avoid stale closure in pushSnapshot
  const historyIndexRef = useRef(-1)
  useEffect(() => {
    historyIndexRef.current = historyIndex
  }, [historyIndex])

  // Push snapshot — uses ref to avoid stale closure
  const pushSnapshot = useCallback(
    (
      blocks: TimeBlock[],
      smooth: SmoothSettings,
      transform: VideoTransformSettings,
      blockId: string | null
    ) => {
      if (isUndoRedoActionRef.current) return

      const newSnap: HistorySnapshot = {
        timeBlocks: JSON.parse(JSON.stringify(blocks)),
        smoothSettings: { ...smooth },
        transformSettings: { ...transform },
        selectedBlockId: blockId,
      }

      setHistoryStack((prev) => {
        const currentIdx = historyIndexRef.current
        const next = prev.slice(0, currentIdx + 1)
        const last = next[next.length - 1]
        if (
          last &&
          JSON.stringify(last.timeBlocks) === JSON.stringify(newSnap.timeBlocks) &&
          JSON.stringify(last.smoothSettings) === JSON.stringify(newSnap.smoothSettings) &&
          JSON.stringify(last.transformSettings) === JSON.stringify(newSnap.transformSettings) &&
          last.selectedBlockId === newSnap.selectedBlockId
        ) {
          return prev
        }
        const updated = [...next, newSnap]
        if (updated.length > 50) updated.shift()
        // Update the index ref immediately so subsequent pushes are correct
        historyIndexRef.current = updated.length - 1
        return updated
      })
      setHistoryIndex((prev) => Math.min(prev + 1, 49))
    },
    [] // no historyIndex dependency — uses ref instead
  )

  const handleUndo = useCallback(() => {
    const currentIdx = historyIndexRef.current
    setHistoryStack((stack) => {
      if (currentIdx <= 0) return stack
      isUndoRedoActionRef.current = true
      const target = stack[currentIdx - 1]
      setTimeBlocks(target.timeBlocks)
      setSmoothSettings(target.smoothSettings)
      setTransformSettings(target.transformSettings)
      setSelectedBlockId(target.selectedBlockId)
      setHistoryIndex(currentIdx - 1)
      historyIndexRef.current = currentIdx - 1
      setTimeout(() => { isUndoRedoActionRef.current = false }, 60)
      return stack
    })
  }, [])

  const handleRedo = useCallback(() => {
    const currentIdx = historyIndexRef.current
    setHistoryStack((stack) => {
      if (currentIdx >= stack.length - 1) return stack
      isUndoRedoActionRef.current = true
      const target = stack[currentIdx + 1]
      setTimeBlocks(target.timeBlocks)
      setSmoothSettings(target.smoothSettings)
      setTransformSettings(target.transformSettings)
      setSelectedBlockId(target.selectedBlockId)
      setHistoryIndex(currentIdx + 1)
      historyIndexRef.current = currentIdx + 1
      setTimeout(() => { isUndoRedoActionRef.current = false }, 60)
      return stack
    })
  }, [])

  // Global Keyboard Listener for Ctrl+Z and Ctrl+Y / Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const isModifier = isMac ? e.metaKey : e.ctrlKey

      if (!isModifier) return

      const target = e.target as HTMLElement
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        (target as HTMLInputElement).type === 'text'
      ) {
        return
      }

      const key = e.key.toLowerCase()

      if (key === 'z') {
        if (e.shiftKey) {
          e.preventDefault()
          handleRedo()
        } else {
          e.preventDefault()
          handleUndo()
        }
      } else if (key === 'y') {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // Tracked State Setters
  const handleTimeBlocksChange = (nextBlocks: TimeBlock[]) => {
    setTimeBlocks(nextBlocks)
    pushSnapshot(nextBlocks, smoothSettings, transformSettings, selectedBlockId)
  }

  const handleSmoothSettingsChange = (
    nextOrUpdater: SmoothSettings | ((prev: SmoothSettings) => SmoothSettings)
  ) => {
    setSmoothSettings((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      pushSnapshot(timeBlocks, next, transformSettings, selectedBlockId)
      return next
    })
  }

  const handleTransformSettingsChange = (nextTransform: VideoTransformSettings) => {
    setTransformSettings(nextTransform)
    pushSnapshot(timeBlocks, smoothSettings, nextTransform, selectedBlockId)
  }

  // Active navigation tab on mobile & desktop
  const [activeTab, setActiveTab] = useState<PanelTab>('trim')

  // Shared playback state bridged between VideoPreview ↔ ControlPanel
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0)
  const [previewIsPlaying, setPreviewIsPlaying] = useState(false)
  const [seekTime, setSeekTime] = useState<number | null>(null)
  const [togglePlayTrigger, setTogglePlayTrigger] = useState(0)

  // Project Workspace & Session Management State
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [localProjects, setLocalProjects] = useState<ProjectItem[]>([])
  const [isAutoSaved, setIsAutoSaved] = useState(false)
  const [showRestoredNotice, setShowRestoredNotice] = useState(false)
  const [showProjectSavedToast, setShowProjectSavedToast] = useState(false)
  const [showProjectSwitchToast, setShowProjectSwitchToast] = useState(false)

  // Modals
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Status & History
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false)
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectMetadata[]>([])

  // Bridge seek and play toggle
  const handleControlPanelSeek = (time: number) => {
    setSeekTime(time)
    setPreviewCurrentTime(time)
  }
  const handleControlPanelTogglePlay = () => {
    setTogglePlayTrigger((n) => n + 1)
  }

  // Reload local projects list from IndexedDB
  const reloadLocalProjects = useCallback(async () => {
    const list = await getAllProjectsFromIDB()
    setLocalProjects(list)
  }, [])

  // Check Supabase connection and load history
  const reloadSupabaseStatus = useCallback(async () => {
    const configured = isSupabaseConfigured()
    setIsSupabaseConnected(configured)
    const list = await fetchProjectHistory()
    setProjects(list)
  }, [])

  useEffect(() => {
    reloadSupabaseStatus()
    reloadLocalProjects()
  }, [reloadSupabaseStatus, reloadLocalProjects])

  // Revoke object URLs to avoid memory leaks
  const cleanCurrentVideoUrl = () => {
    if (videoUrl && videoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(videoUrl)
    }
  }

  // 1. Auto-Restore session from IndexedDB on initial mount (Active Session -> Legacy Video)
  useEffect(() => {
    async function restoreSession() {
      try {
        // Priority 1: Check active session in IndexedDB (Full Project Item with video Blob)
        const activeSession = await getActiveSessionFromIDB()
        if (activeSession && activeSession.videoBlob) {
          const url = URL.createObjectURL(activeSession.videoBlob)
          setVideoUrl(url)
          setVideoFile(new File([activeSession.videoBlob], activeSession.videoName, { type: activeSession.videoType }))
          setActiveProjectId(activeSession.id)
          if (activeSession.name) setProjectName(activeSession.name)
          if (activeSession.metadata) setMetadata(activeSession.metadata)
          if (activeSession.smoothSettings) setSmoothSettings(activeSession.smoothSettings)
          if (activeSession.transformSettings) setTransformSettings(activeSession.transformSettings)
          if (activeSession.trimRange) setTrimRange(activeSession.trimRange)
          if (Array.isArray(activeSession.timeBlocks) && activeSession.timeBlocks.length > 0) {
            setTimeBlocks(activeSession.timeBlocks)
            setSelectedBlockId(activeSession.timeBlocks[0].id)
          }

          const initialSnap: HistorySnapshot = {
            timeBlocks: activeSession.timeBlocks || [],
            smoothSettings: activeSession.smoothSettings || defaultSmoothSettings,
            transformSettings: activeSession.transformSettings || defaultTransformSettings,
            selectedBlockId: activeSession.timeBlocks?.[0]?.id || null,
          }
          setHistoryStack([initialSnap])
          setHistoryIndex(0)
          setIsAutoSaved(true)

          setShowRestoredNotice(true)
          setTimeout(() => setShowRestoredNotice(false), 5000)
          return
        }

        // Priority 2: Fallback to legacy video restore
        const stored = await getVideoFromIDB()
        if (stored && stored.blob) {
          const url = URL.createObjectURL(stored.blob)
          setVideoUrl(url)
          setVideoFile(new File([stored.blob], stored.name, { type: stored.type }))

          const savedName = localStorage.getItem('smoot_project_name')
          if (savedName) setProjectName(savedName)

          const savedMeta = localStorage.getItem('smoot_metadata')
          if (savedMeta) {
            try {
              setMetadata(JSON.parse(savedMeta))
            } catch {
              // ignore
            }
          }

          let loadedBlocks: TimeBlock[] = []
          const savedBlocks = localStorage.getItem('smoot_time_blocks')
          if (savedBlocks) {
            try {
              const parsed = JSON.parse(savedBlocks)
              if (Array.isArray(parsed) && parsed.length > 0) {
                loadedBlocks = parsed
                setTimeBlocks(parsed)
                setSelectedBlockId(parsed[0].id)
              }
            } catch {
              // ignore
            }
          }

          // Initial snapshot for restored session
          const initialSnap: HistorySnapshot = {
            timeBlocks: loadedBlocks,
            smoothSettings,
            transformSettings,
            selectedBlockId: loadedBlocks[0]?.id || null,
          }
          setHistoryStack([initialSnap])
          setHistoryIndex(0)

          setShowRestoredNotice(true)
          setTimeout(() => setShowRestoredNotice(false), 5000)
        }
      } catch (err) {
        console.warn('Failed to restore session:', err)
      }
    }

    restoreSession()
  }, [])

  // 2. Real-time Persistence to localStorage whenever state changes
  useEffect(() => {
    if (projectName) localStorage.setItem('smoot_project_name', projectName)
  }, [projectName])

  useEffect(() => {
    localStorage.setItem('smoot_settings', JSON.stringify(smoothSettings))
  }, [smoothSettings])

  useEffect(() => {
    localStorage.setItem('smoot_transform', JSON.stringify(transformSettings))
  }, [transformSettings])

  useEffect(() => {
    if (timeBlocks && timeBlocks.length > 0) {
      localStorage.setItem('smoot_time_blocks', JSON.stringify(timeBlocks))
    }
  }, [timeBlocks])

  useEffect(() => {
    if (metadata) {
      localStorage.setItem('smoot_metadata', JSON.stringify(metadata))
    }
  }, [metadata])

  // 3. Real-time Auto-Save session to IndexedDB (debounced)
  useEffect(() => {
    if (!videoUrl) return

    setIsAutoSaved(false)
    const timer = setTimeout(async () => {
      try {
        // Use videoFile directly (it's a File which extends Blob), or fetch from URL
        let blob: Blob | undefined = videoFile ?? undefined
        if (!blob) {
          const fetched = await fetch(videoUrl).then((r) => r.blob()).catch(() => null)
          if (!fetched) return
          blob = fetched
        }

        const projectId = activeProjectId || `proj_${Date.now().toString(36)}`
        const thumb = captureCurrentCanvasThumbnail()

        const sessionRecord: ProjectItem = {
          id: projectId,
          name: projectName,
          videoBlob: blob,
          videoName: metadata?.name || videoFile?.name || 'video.mp4',
          videoSize: blob.size,
          videoType: blob.type || 'video/mp4',
          metadata: metadata || {
            name: videoFile?.name || 'video',
            size: blob.size,
            type: blob.type || 'video/mp4',
            duration: 0,
            width: 0,
            height: 0,
            aspectRatio: 16 / 9,
          },
          smoothSettings,
          timeBlocks,
          trimRange,
          transformSettings,
          thumbnailDataUrl: thumb,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        await saveActiveSessionToIDB(sessionRecord)
        if (activeProjectId) {
          await saveProjectToIDB(sessionRecord)
          const updated = await getAllProjectsFromIDB()
          setLocalProjects(updated)
        }
        setIsAutoSaved(true)
      } catch (err) {
        console.warn('Auto-save error:', err)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [
    videoUrl,
    videoFile,
    projectName,
    smoothSettings,
    transformSettings,
    timeBlocks,
    trimRange,
    metadata,
    activeProjectId,
  ])

  // Handle local video selection
  const handleVideoSelected = async (file: File) => {
    cleanCurrentVideoUrl()
    const url = URL.createObjectURL(file)
    setVideoFile(file)
    setVideoUrl(url)
    const cleanName = file.name.replace(/\.[^/.]+$/, '')
    const name = cleanName || (lang === 'la' ? 'ໂປຣເຈັກ Smoot' : 'My Smooth Project')
    setProjectName(name)
    setTrimRange({ start: 0, end: 0 })
    setTimeBlocks([])
    setTransformSettings(defaultTransformSettings)

    const initialMeta: VideoMetadata = {
      name: file.name,
      size: file.size,
      type: file.type,
      duration: 0,
      width: 0,
      height: 0,
      aspectRatio: 16 / 9,
    }
    setMetadata(initialMeta)

    const newProjId = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    setActiveProjectId(newProjId)

    // Generate initial thumbnail
    const thumb = await generateVideoThumbnail(file)

    const newProject: ProjectItem = {
      id: newProjId,
      name,
      videoBlob: file,
      videoName: file.name,
      videoSize: file.size,
      videoType: file.type,
      metadata: initialMeta,
      smoothSettings: defaultSmoothSettings,
      timeBlocks: [],
      trimRange: { start: 0, end: 0 },
      transformSettings: defaultTransformSettings,
      thumbnailDataUrl: thumb,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Save to IndexedDB project & session
    await saveProjectToIDB(newProject)
    await saveActiveSessionToIDB(newProject)
    await saveVideoToIDB(file, file.name)
    localStorage.setItem('smoot_project_name', name)

    const updatedProjects = await getAllProjectsFromIDB()
    setLocalProjects(updatedProjects)
    setIsAutoSaved(true)

    // Initial history snapshot
    const initialSnap: HistorySnapshot = {
      timeBlocks: [],
      smoothSettings: defaultSmoothSettings,
      transformSettings: defaultTransformSettings,
      selectedBlockId: null,
    }
    setHistoryStack([initialSnap])
    setHistoryIndex(0)
  }

  // Handle Demo Video Generation
  const handleLoadDemo = async () => {
    cleanCurrentVideoUrl()
    setIsGeneratingDemo(true)
    try {
      const demo = await generateDemoVideoBlob()
      setVideoUrl(demo.url)
      const demoFile = new File([demo.blob], demo.name, { type: 'video/webm' })
      setVideoFile(demoFile)
      const name = lang === 'la' ? 'ວິດີໂອຕົວຢ່າງ Motion (30 FPS)' : 'Motion Demo (30 FPS)'
      setProjectName(name)
      const demoBlocks: TimeBlock[] = [{ id: 'demo-1', start: 0, end: 4.5 }]
      setTrimRange({ start: 0, end: 4.5 })
      setTimeBlocks(demoBlocks)
      setSelectedBlockId('demo-1')
      setTransformSettings(defaultTransformSettings)
      const demoMeta: VideoMetadata = {
        name: demo.name,
        size: demo.blob.size,
        type: 'video/webm',
        duration: 4.5,
        width: 1280,
        height: 720,
        aspectRatio: 16 / 9,
      }
      setMetadata(demoMeta)
      const newSmooth = {
        ...defaultSmoothSettings,
        intensity: 80,
        mode: 'blend' as const,
        frameSamples: 6,
        blendDecay: 0.7,
      }
      setSmoothSettings(newSmooth)

      const demoProjId = `proj_demo_${Date.now().toString(36)}`
      setActiveProjectId(demoProjId)

      const thumb = await generateVideoThumbnail(demo.blob)

      const demoProject: ProjectItem = {
        id: demoProjId,
        name,
        videoBlob: demo.blob,
        videoName: demo.name,
        videoSize: demo.blob.size,
        videoType: 'video/webm',
        metadata: demoMeta,
        smoothSettings: newSmooth,
        timeBlocks: demoBlocks,
        trimRange: { start: 0, end: 4.5 },
        transformSettings: defaultTransformSettings,
        thumbnailDataUrl: thumb,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await saveProjectToIDB(demoProject)
      await saveActiveSessionToIDB(demoProject)
      await saveVideoToIDB(demo.blob, demo.name)
      localStorage.setItem('smoot_project_name', name)

      const updatedProjects = await getAllProjectsFromIDB()
      setLocalProjects(updatedProjects)
      setIsAutoSaved(true)

      // Initial history snapshot
      const initialSnap: HistorySnapshot = {
        timeBlocks: demoBlocks,
        smoothSettings: newSmooth,
        transformSettings: defaultTransformSettings,
        selectedBlockId: 'demo-1',
      }
      setHistoryStack([initialSnap])
      setHistoryIndex(0)
    } catch (err) {
      console.error('Failed to create demo video:', err)
      alert('Error creating demo video')
    } finally {
      setIsGeneratingDemo(false)
    }
  }

  // Handle Save Project (Full Video Blob + Settings to IndexedDB & Metadata to Supabase)
  const handleSaveProject = async () => {
    if (!videoUrl) return
    setIsSaving(true)
    try {
      // Get blob: prefer in-memory videoFile, otherwise fetch from object URL
      let blob: Blob = videoFile!
      if (!blob) {
        blob = await fetch(videoUrl).then((r) => r.blob())
      }
      const projectId = activeProjectId || `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
      const canvasThumb = captureCurrentCanvasThumbnail()
      const thumb = canvasThumb || (await generateVideoThumbnail(blob))

      const projectItem: ProjectItem = {
        id: projectId,
        name: projectName,
        videoBlob: blob,
        videoName: metadata?.name || videoFile?.name || 'video.mp4',
        videoSize: blob.size,
        videoType: blob.type || 'video/mp4',
        metadata: metadata || {
          name: videoFile?.name || 'video',
          size: blob.size,
          type: blob.type || 'video/mp4',
          duration: 0,
          width: 0,
          height: 0,
          aspectRatio: 16 / 9,
        },
        smoothSettings,
        timeBlocks,
        trimRange,
        transformSettings,
        thumbnailDataUrl: thumb,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      // 1. Save complete project + active session to IndexedDB
      await saveProjectToIDB(projectItem)
      await saveActiveSessionToIDB(projectItem)
      setActiveProjectId(projectId)

      const updatedList = await getAllProjectsFromIDB()
      setLocalProjects(updatedList)

      // 2. Sync metadata to Supabase if connected
      const payload: ProjectMetadata = {
        id: projectId,
        project_name: projectName,
        video_name: projectItem.videoName,
        video_size: projectItem.videoSize,
        duration: metadata?.duration || 0,
        width: metadata?.width || 0,
        height: metadata?.height || 0,
        smooth_settings: smoothSettings,
        export_settings: {
          fps: 60,
          resolution: '1080p',
          quality: 'high',
          format: 'mp4',
        },
        trim_range: trimRange,
        time_blocks: timeBlocks,
        transform_settings: transformSettings,
      }

      await saveProjectMetadata(payload)
      const updatedCloud = await fetchProjectHistory()
      setProjects(updatedCloud)

      const timeStr = new Date().toLocaleTimeString()
      setLastSavedAt(timeStr)
      setIsAutoSaved(true)

      setShowProjectSavedToast(true)
      setTimeout(() => setShowProjectSavedToast(false), 4500)
    } catch (err) {
      console.warn('Save failed:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Load project 100% from IndexedDB (Video Blob + Settings)
  const handleOpenLocalProject = async (proj: ProjectItem) => {
    try {
      cleanCurrentVideoUrl()
      const newUrl = URL.createObjectURL(proj.videoBlob)
      const file = new File([proj.videoBlob], proj.videoName, { type: proj.videoType })
      setVideoUrl(newUrl)
      setVideoFile(file)
      setActiveProjectId(proj.id)
      setProjectName(proj.name)
      if (proj.metadata) setMetadata(proj.metadata)
      if (proj.smoothSettings) setSmoothSettings(proj.smoothSettings)
      if (proj.transformSettings) setTransformSettings(proj.transformSettings)
      if (proj.trimRange) setTrimRange(proj.trimRange)
      if (Array.isArray(proj.timeBlocks) && proj.timeBlocks.length > 0) {
        setTimeBlocks(proj.timeBlocks)
        setSelectedBlockId(proj.timeBlocks[0].id)
      } else {
        setTimeBlocks([])
        setSelectedBlockId(null)
      }

      await saveActiveSessionToIDB(proj)
      setIsAutoSaved(true)

      const initialSnap: HistorySnapshot = {
        timeBlocks: proj.timeBlocks || [],
        smoothSettings: proj.smoothSettings || defaultSmoothSettings,
        transformSettings: proj.transformSettings || defaultTransformSettings,
        selectedBlockId: proj.timeBlocks?.[0]?.id || null,
      }
      setHistoryStack([initialSnap])
      setHistoryIndex(0)

      setShowProjectSwitchToast(true)
      setTimeout(() => setShowProjectSwitchToast(false), 4500)
    } catch (err) {
      console.error('Failed to open local project:', err)
      alert('Error opening project')
    }
  }

  // Handle Delete local project from IndexedDB
  const handleDeleteLocalProject = async (id: string) => {
    await deleteProjectFromIDB(id)
    if (activeProjectId === id) {
      await clearActiveSessionFromIDB()
      setActiveProjectId(null)
    }
    const updated = await getAllProjectsFromIDB()
    setLocalProjects(updated)
  }

  // Handle Load project from history (Cloud Supabase)
  const handleSelectProject = (proj: ProjectMetadata) => {
    setProjectName(proj.project_name)
    if (proj.smooth_settings) {
      setSmoothSettings(proj.smooth_settings)
    }
    if (proj.time_blocks && proj.time_blocks.length > 0) {
      setTimeBlocks(proj.time_blocks)
      setSelectedBlockId(proj.time_blocks[0].id)
    } else if (proj.trim_range) {
      setTrimRange(proj.trim_range)
    }
    if (proj.transform_settings) {
      setTransformSettings(proj.transform_settings)
    }
  }

  // Handle Delete project from history (Cloud Supabase)
  const handleDeleteProject = async (id: string) => {
    await deleteProjectMetadata(id)
    const updated = await fetchProjectHistory()
    setProjects(updated)
  }

  const handleResetSettings = () => {
    setSmoothSettings(defaultSmoothSettings)
    pushSnapshot(timeBlocks, defaultSmoothSettings, transformSettings, selectedBlockId)
  }

  // Create New Project / Close project & return to manager/uploader
  const handleNewProject = async () => {
    cleanCurrentVideoUrl()
    setVideoUrl(null)
    setVideoFile(null)
    setMetadata(null)
    setActiveProjectId(null)
    setTrimRange({ start: 0, end: 0 })
    setTimeBlocks([])
    setTransformSettings(defaultTransformSettings)
    setSmoothSettings(defaultSmoothSettings)
    setHistoryStack([])
    setHistoryIndex(-1)

    await clearActiveSessionFromIDB()
    localStorage.removeItem('smoot_project_name')
    localStorage.removeItem('smoot_metadata')
    localStorage.removeItem('smoot_time_blocks')
  }

  const handleClearVideo = handleNewProject

  return (
    <div className={`${videoUrl ? 'h-full h-[100dvh] max-h-[100dvh] overflow-hidden' : 'min-h-[100dvh]'} flex flex-col bg-[#08090e] text-slate-100 selection:bg-violet-600/30 selection:text-violet-200`}>
      {/* Top Navbar with Undo & Redo buttons */}
      <Navbar
        projectName={projectName}
        setProjectName={setProjectName}
        hasVideo={Boolean(videoUrl)}
        isSupabaseConnected={isSupabaseConnected}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLoadDemo={handleLoadDemo}
        isGeneratingDemo={isGeneratingDemo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < historyStack.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        projectsCount={localProjects.length}
        isAutoSaved={isAutoSaved}
        lang={lang}
        setLang={handleSetLang}
      />

      {/* Auto-Restored Session Banner */}
      {showRestoredNotice && (
        <div className="w-full bg-gradient-to-r from-violet-900/90 via-indigo-900/90 to-cyan-900/90 border-b border-cyan-500/30 py-1.5 px-3 flex items-center justify-between text-xs text-cyan-200 shadow-md animate-in slide-in-from-top duration-200 z-40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-300 shrink-0" />
            <span>{t.sessionRestored}</span>
          </div>
          <button
            onClick={() => setShowRestoredNotice(false)}
            className="text-[10px] text-white/70 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Project Saved Toast */}
      {showProjectSavedToast && (
        <div className="w-full bg-gradient-to-r from-emerald-900/90 via-green-900/90 to-teal-900/90 border-b border-emerald-500/30 py-1.5 px-3 flex items-center justify-between text-xs text-emerald-200 shadow-md animate-in slide-in-from-top duration-200 z-40">
          <div className="flex items-center gap-2">
            <Save className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{t.projectSavedSuccess}</span>
          </div>
          <button
            onClick={() => setShowProjectSavedToast(false)}
            className="text-[10px] text-white/70 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Project Switch Toast */}
      {showProjectSwitchToast && (
        <div className="w-full bg-gradient-to-r from-indigo-900/90 via-violet-900/90 to-purple-900/90 border-b border-violet-500/30 py-1.5 px-3 flex items-center justify-between text-xs text-violet-200 shadow-md animate-in slide-in-from-top duration-200 z-40">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-violet-300 shrink-0" />
            <span>{t.switchProjectNotice}</span>
          </div>
          <button
            onClick={() => setShowProjectSwitchToast(false)}
            className="text-[10px] text-white/70 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col w-full max-w-7xl mx-auto px-2 py-1 sm:px-3 sm:py-2 md:px-4 md:py-2.5 ${videoUrl ? 'overflow-hidden min-h-0' : 'overflow-y-auto pb-8'}`}>
        {!videoUrl ? (
          /* Landing & Video Uploader View */
          <div className="flex-1 flex flex-col justify-center items-center py-2 sm:py-6 w-full">
            {/* Hero Header */}
            <div className="text-center w-full max-w-3xl mx-auto mb-5 sm:mb-8 space-y-2.5 sm:space-y-4 px-1 sm:px-2">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 text-[10px] sm:text-xs font-semibold shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span>{t.heroBadge}</span>
              </div>

              <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-snug sm:leading-relaxed">
                <span>{t.heroTitle1}</span>
                <span className="block mt-1 sm:mt-2 bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                  {t.heroTitle2}
                </span>
              </h1>

              <p className="text-slate-400 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed px-1">
                {t.heroDesc}
              </p>
            </div>

            {/* Video Uploader Card */}
            <VideoUploader
              onVideoSelected={handleVideoSelected}
              onLoadDemo={handleLoadDemo}
              isGeneratingDemo={isGeneratingDemo}
              lang={lang}
            />

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-4xl w-full mt-8 sm:mt-12 text-left px-2 sm:px-0">
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#10121b]/60 border border-white/[0.06] space-y-1.5 sm:space-y-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">{t.feat1Title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {t.feat1Desc}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#10121b]/60 border border-white/[0.06] space-y-1.5 sm:space-y-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">{t.feat2Title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {t.feat2Desc}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-xl bg-[#10121b]/60 border border-white/[0.06] space-y-1.5 sm:space-y-2 sm:col-span-2 lg:col-span-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">{t.feat3Title}</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
                  {t.feat3Desc}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Editor Workspace */
          <div className="flex-1 overflow-hidden flex flex-col gap-1.5 sm:gap-2 w-full max-w-full pb-14 lg:pb-0 min-h-0">
            {/* Top Workspace Bar */}
            <div className="flex items-center justify-between gap-2 pb-1 flex-wrap">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-md bg-white/[0.06] text-slate-300 truncate max-w-[120px] sm:max-w-[200px]">
                  {metadata?.name || 'video'}
                </span>
                {metadata && metadata.width > 0 && (
                  <span className="text-[11px] sm:text-xs text-slate-400 hidden sm:inline font-mono">
                    {metadata.width}×{metadata.height} ({metadata.duration.toFixed(1)}{t.seconds})
                  </span>
                )}
                {timeBlocks.length > 1 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-mono hidden sm:inline">
                    ✂ {timeBlocks.length} {t.segmentLabel}s
                  </span>
                )}
              </div>

              {/* Undo / Redo Toolbar Buttons + Change/Close Video */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Prominent Undo & Redo Controls */}
                <div className="flex items-center gap-0.5 bg-slate-900/90 p-0.5 rounded-xl border border-white/10 shadow-sm shrink-0">
                  <button
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className={`min-h-[34px] px-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer touch-manipulation ${historyIndex > 0
                      ? 'bg-violet-950/60 text-violet-200 hover:bg-violet-900/80 border border-violet-500/40 active:scale-95'
                      : 'text-slate-600 border border-transparent cursor-not-allowed opacity-40'
                      }`}
                    title="Undo (Ctrl + Z)"
                  >
                    <Undo2 className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11px] font-bold">Undo</span>
                    <span className="hidden sm:inline text-[9px] font-mono opacity-60">Ctrl+Z</span>
                  </button>

                  <button
                    onClick={handleRedo}
                    disabled={historyIndex >= historyStack.length - 1}
                    className={`min-h-[34px] px-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer touch-manipulation ${historyIndex < historyStack.length - 1
                      ? 'bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/80 border border-cyan-500/40 active:scale-95'
                      : 'text-slate-600 border border-transparent cursor-not-allowed opacity-40'
                      }`}
                    title="Redo (Ctrl + Y)"
                  >
                    <Redo2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[11px] font-bold">Redo</span>
                    <span className="hidden sm:inline text-[9px] font-mono opacity-60">Ctrl+Y</span>
                  </button>
                </div>

                <label className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 text-xs font-medium text-slate-200 cursor-pointer transition-colors whitespace-nowrap min-h-[34px] touch-manipulation">
                  <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="hidden sm:inline">{t.changeVideo}</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoSelected(e.target.files[0])
                      }
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={handleClearVideo}
                  className="px-2 sm:px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-transparent hover:border-red-500/20 text-xs transition-colors cursor-pointer whitespace-nowrap min-h-[34px] touch-manipulation"
                  title={t.clearStorage}
                >
                  {t.closeVideo}
                </button>
              </div>
            </div>

            {/* Split Editor Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 w-full max-w-full overflow-hidden min-h-0">
              {/* Video Player Column */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-1 z-30 bg-[#08090e]/95 backdrop-blur-md pt-0.5 pb-1 lg:py-0 max-w-full overflow-hidden shrink-0 max-h-[45vh] sm:max-h-[50vh] lg:max-h-full">
                <VideoPreview
                  videoUrl={videoUrl}
                  metadata={metadata}
                  smoothSettings={smoothSettings}
                  onVideoLoaded={(meta) => {
                    setMetadata((prev) => ({
                      ...prev,
                      ...meta,
                      name: videoFile?.name || prev?.name || 'video',
                    }))
                    setTimeBlocks((prev) =>
                      prev.length === 0
                        ? [{ id: 'block-root', start: 0, end: meta.duration }]
                        : prev
                    )
                  }}
                  trimRange={trimRange.end === 0 ? { start: 0, end: metadata?.duration || 0 } : trimRange}
                  onTrimChange={setTrimRange}
                  timeBlocks={timeBlocks}
                  onTimeBlocksChange={handleTimeBlocksChange}
                  transformSettings={transformSettings}
                  onTransformChange={handleTransformSettingsChange}
                  currentTime={previewCurrentTime}
                  onCurrentTimeChange={setPreviewCurrentTime}
                  isPlaying={previewIsPlaying}
                  onIsPlayingChange={setPreviewIsPlaying}
                  seekTime={seekTime}
                  togglePlayTrigger={togglePlayTrigger}
                  showTrimmerInPlayer={false}
                  activeTab={activeTab}
                  lang={lang}
                />
              </div>

              {/* Control Panel Column with Per-Cut settings */}
              <div className="flex-1 lg:col-span-5 xl:col-span-4 flex flex-col max-w-full overflow-hidden min-h-0">
                <ControlPanel
                  settings={smoothSettings}
                  setSettings={handleSmoothSettingsChange}
                  metadata={metadata}
                  onOpenExport={() => setIsExportOpen(true)}
                  onSaveProject={handleSaveProject}
                  isSaving={isSaving}
                  lastSavedAt={lastSavedAt}
                  onResetSettings={handleResetSettings}
                  trimRange={trimRange.end === 0 ? { start: 0, end: metadata?.duration || 0 } : trimRange}
                  onTrimChange={setTrimRange}
                  timeBlocks={timeBlocks}
                  onTimeBlocksChange={handleTimeBlocksChange}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  currentTime={previewCurrentTime}
                  onSeek={handleControlPanelSeek}
                  isPlaying={previewIsPlaying}
                  onTogglePlay={handleControlPanelTogglePlay}
                  transformSettings={transformSettings}
                  onTransformChange={handleTransformSettingsChange}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  lang={lang}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR: Visible only on Mobile (< lg) when a video is loaded */}
      {videoUrl && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0f17]/95 backdrop-blur-xl border-t border-white/10 px-2 py-2 flex items-center justify-around shadow-2xl safe-area-pb">
          {/* Tab 1: Trim & Cut */}
          <button
            onClick={() => setActiveTab('trim')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer touch-manipulation min-h-[48px] ${activeTab === 'trim'
              ? 'bg-amber-500/20 text-amber-300 font-bold shadow-inner'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <Scissors className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="text-[11px] truncate">{t.mobileTabTrim}</span>
          </button>

          {/* Tab 2: Slow & Smooth */}
          <button
            onClick={() => setActiveTab('smooth')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer touch-manipulation min-h-[48px] ${activeTab === 'smooth'
              ? 'bg-violet-500/20 text-violet-300 font-bold shadow-inner'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-violet-400" />
            <span className="text-[11px] truncate">{t.mobileTabSmooth}</span>
          </button>

          {/* Tab 3: Settings & Export */}
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer touch-manipulation min-h-[48px] ${activeTab === 'export'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold shadow-inner'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <Download className="w-4 h-4 shrink-0 text-cyan-400" />
            <span className="text-[11px] truncate">{t.mobileTabExport}</span>
          </button>
        </div>
      )}

      {/* Modals */}
      {videoUrl && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          videoSrc={videoUrl}
          metadata={metadata}
          smoothSettings={smoothSettings}
          projectName={projectName}
          trimRange={trimRange.end === 0 ? undefined : trimRange}
          transformSettings={
            transformSettings.aspectRatio === 'original' && transformSettings.zoom === 1.0
              ? undefined
              : transformSettings
          }
          timeBlocks={timeBlocks.length > 0 ? timeBlocks : undefined}
          lang={lang}
        />
      )}

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        localProjects={localProjects}
        onOpenLocalProject={handleOpenLocalProject}
        onDeleteLocalProject={handleDeleteLocalProject}
        onNewProject={handleNewProject}
        cloudProjects={projects}
        onSelectCloudProject={handleSelectProject}
        onDeleteCloudProject={handleDeleteProject}
        isSupabaseConnected={isSupabaseConnected}
        activeProjectId={activeProjectId}
        lang={lang}
      />

      <SupabaseConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigUpdated={reloadSupabaseStatus}
        lang={lang}
      />
    </div>
  )
}

export default App
