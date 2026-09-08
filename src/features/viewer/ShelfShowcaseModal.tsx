import { SafeCanvas } from '../../components/SafeCanvas'
import {
  Clock,
  Maximize2,
  Minimize2,
  Sparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModelAsset, ShelfViewerSettings } from '../../domain/types'
import { shelfDatabase } from '../../storage/db'
import { ensureModelFileDownloaded } from '../gdrive/googleDriveService'
import { ModelViewer } from './ModelViewer'

export interface ShelfShowcaseModalProps {
  shelfName: string
  models: ModelAsset[]
  viewerSettings: ShelfViewerSettings
  onClose: () => void
}

const SPEED_OPTIONS = [
  { label: '3s', value: 3000 },
  { label: '6s', value: 6000 },
  { label: '10s', value: 10000 },
  { label: '15s', value: 15000 },
]

export function ShelfShowcaseModal({
  shelfName,
  models,
  viewerSettings,
  onClose,
}: ShelfShowcaseModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [durationMs, setDurationMs] = useState(6000)
  const [progress, setProgress] = useState(0)
  const [currentModelUrl, setCurrentModelUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isUiVisible, setIsUiVisible] = useState(true)

  const startTimeRef = useRef<number>(Date.now())
  const animationFrameRef = useRef<number | null>(null)
  const currentObjectUrlRef = useRef<string>('')
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetIdleTimer = useCallback(() => {
    setIsUiVisible(true)
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
    idleTimeoutRef.current = setTimeout(() => {
      setIsUiVisible(false)
    }, 2800)
  }, [])

  // Auto-hide UI controls when mouse/user is idle
  useEffect(() => {
    resetIdleTimer()

    const handleActivity = () => {
      resetIdleTimer()
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('mousedown', handleActivity)
    window.addEventListener('touchstart', handleActivity, { passive: true })
    window.addEventListener('keydown', handleActivity)

    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
      }
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [resetIdleTimer])

  const currentModel = models[currentIndex] || null

  // Load the current model GLB blob
  useEffect(() => {
    if (!currentModel) return

    let isMounted = true
    setIsLoading(true)

    ensureModelFileDownloaded(currentModel.id)
      .then((fileBlob) => {
        if (!isMounted) return

        if (currentObjectUrlRef.current) {
          URL.revokeObjectURL(currentObjectUrlRef.current)
          currentObjectUrlRef.current = ''
        }

        if (fileBlob) {
          const objectUrl = URL.createObjectURL(fileBlob)
          currentObjectUrlRef.current = objectUrl
          setCurrentModelUrl(objectUrl)
        } else {
          setCurrentModelUrl('')
        }
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [currentModel?.id])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (currentObjectUrlRef.current) {
        URL.revokeObjectURL(currentObjectUrlRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const handleNext = useCallback(() => {
    if (models.length <= 1) return
    setCurrentIndex((prev) => (prev + 1) % models.length)
    setProgress(0)
    startTimeRef.current = Date.now()
  }, [models.length])

  const handlePrev = useCallback(() => {
    if (models.length <= 1) return
    setCurrentIndex((prev) => (prev - 1 + models.length) % models.length)
    setProgress(0)
    startTimeRef.current = Date.now()
  }, [models.length])

  const togglePlay = () => {
    if (!isPlaying) {
      startTimeRef.current = Date.now() - (progress / 100) * durationMs
    }
    setIsPlaying((prev) => !prev)
  }

  // Timer tick for slideshow auto-advancing
  useEffect(() => {
    if (!isPlaying || models.length <= 1) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    startTimeRef.current = Date.now() - (progress / 100) * durationMs

    const updateTimer = () => {
      const elapsed = Date.now() - startTimeRef.current
      const currentProgress = Math.min(100, (elapsed / durationMs) * 100)
      setProgress(currentProgress)

      if (elapsed >= durationMs) {
        handleNext()
      } else {
        animationFrameRef.current = requestAnimationFrame(updateTimer)
      }
    }

    animationFrameRef.current = requestAnimationFrame(updateTimer)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, durationMs, currentIndex, handleNext, models.length])

  // Toggle browser fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
        handlePrev()
      } else if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, handleNext, handlePrev, isPlaying, progress, durationMs])

  const bgColor = viewerSettings.backgroundColor || '#111215'

  return (
    <div
      className={`showcase-overlay ${!isUiVisible ? 'showcase-idle-hidden' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Modo Apresentação da biblioteca ${shelfName}`}
    >
      {/* Top Progress Bar */}
      <div className="showcase-progress-track">
        <div
          className="showcase-progress-fill"
          style={{ width: `${models.length > 1 ? progress : 100}%` }}
        />
      </div>

      {/* Header Info & Actions */}
      <header className="showcase-header">
        <div className="showcase-title-block">
          <div className="showcase-shelf-pill">
            <Sparkles size={13} className="showcase-pulse-icon" />
            <span>{shelfName}</span>
          </div>
          {currentModel && (
            <div className="showcase-model-info">
              <h1 className="showcase-model-name">{currentModel.name}</h1>
              {currentModel.tags.length > 0 && (
                <div className="showcase-model-meta">
                  <span className="showcase-tag-list">
                    {currentModel.tags.map((tag) => (
                      <span key={tag} className="showcase-tag">
                        #{tag}
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="showcase-header-actions">
          {/* Duration Selector */}
          <div className="showcase-speed-selector" title="Tempo de exibição de cada modelo">
            <Clock size={13} />
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`showcase-speed-btn ${durationMs === opt.value ? 'active' : ''}`}
                onClick={() => {
                  setDurationMs(opt.value)
                  setProgress(0)
                  startTimeRef.current = Date.now()
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="showcase-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
            aria-label="Alternar tela cheia"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            className="showcase-close-btn"
            onClick={onClose}
            title="Sair da apresentação (ESC)"
            aria-label="Sair da apresentação"
          >
            <X size={18} />
            <span className="esc-key-badge">ESC</span>
          </button>
        </div>
      </header>

      {/* 3D Canvas Viewport (Uses library default viewer settings, no config UI) */}
      <div className="showcase-canvas-container">
        {currentModelUrl && !isLoading ? (
          <SafeCanvas
            key={currentModel?.id}
            camera={{ position: [0, 0.5, 4.2], fov: 42, near: 0.005, far: 1000 }}
          >
            <color attach="background" args={[bgColor]} />
            <ModelViewer
              url={currentModelUrl}
              showGround={viewerSettings.showGround ?? true}
              groundType={viewerSettings.groundType || 'grid'}
              groundColor={viewerSettings.groundColor || '#4f627d'}
              autoRotate={true}
              autoRotateSpeed={viewerSettings.autoRotateSpeed ?? 2.0}
              lighting={viewerSettings.lighting || 'studio'}
              wireframe={false}
              controlMode="orbit"
            />
          </SafeCanvas>
        ) : (
          <div className="showcase-loading">
            <div className="showcase-spinner" />
            <span>Carregando modelo 3D...</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Bar */}
      <footer className="showcase-footer">
        {/* Quick model thumbnails / step dots at bottom */}
        {models.length > 1 && (
          <div className="showcase-dots">
            {models.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                className={`showcase-dot ${idx === currentIndex ? 'active' : ''}`}
                onClick={() => {
                  setCurrentIndex(idx)
                  setProgress(0)
                  startTimeRef.current = Date.now()
                }}
                title={`Ir para ${m.name}`}
                aria-label={`Ir para modelo ${idx + 1}: ${m.name}`}
              />
            ))}
          </div>
        )}

        <div className="showcase-shortcuts-hint">
          <span>[Espaço] {isPlaying ? 'Pausar' : 'Reproduzir'}</span>
          <span>[← →] Navegar</span>
          <span>[F] Tela Cheia</span>
          <span>[ESC] Sair</span>
        </div>
      </footer>
    </div>
  )
}
