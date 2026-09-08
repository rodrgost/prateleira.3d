import { Canvas } from '@react-three/fiber'
import {
  ArrowDown,
  ArrowUp,
  Box,
  ChevronLeft,
  Compass,
  Crosshair,
  Eye,
  Grid3X3,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Move,
  Orbit,
  Pin,
  PinOff,
  Plus,
  RefreshCcw,
  RotateCw,
  SlidersHorizontal,
  Sun,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { GroundType, LightingPreset, ModelAsset, ShelfViewerSettings } from '../../domain/types'
import { ModelViewer } from './ModelViewer'

export interface ModelViewerModalProps {
  model: ModelAsset
  modelUrl: string
  initialSettings: ShelfViewerSettings
  onClose: () => void
  onRotateModel?: (degrees: number) => Promise<void>
}

export type CameraPresetType = 'iso' | 'front' | 'back' | 'top' | 'left' | 'right'

export interface CameraActionSignal {
  type: 'preset' | 'zoomIn' | 'zoomOut' | 'setTarget' | 'reset'
  payload?: any
  id: number
}

export function ModelViewerModal({
  model,
  modelUrl,
  initialSettings,
  onClose,
  onRotateModel,
}: ModelViewerModalProps) {
  // Retractable Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false)
  const [isSidebarPinned, setIsSidebarPinned] = useState<boolean>(false)

  // Local active view settings for real-time adjustments inside the modal
  const [lighting, setLighting] = useState<LightingPreset>(initialSettings.lighting || 'studio')
  const [groundType, setGroundType] = useState<GroundType>(initialSettings.groundType || 'shadow')
  const [showGround, setShowGround] = useState<boolean>(initialSettings.showGround ?? true)
  const [groundColor, setGroundColor] = useState<string>(initialSettings.groundColor || '#4f627d')
  const [autoRotate, setAutoRotate] = useState<boolean>(initialSettings.autoRotate ?? false)
  const [autoRotateSpeed, setAutoRotateSpeed] = useState<number>(initialSettings.autoRotateSpeed ?? 2.0)
  const [backgroundColor, setBackgroundColor] = useState<string>(initialSettings.backgroundColor || '#111215')
  const [wireframe, setWireframe] = useState<boolean>(false)

  // Camera & Interaction states
  const [controlMode, setControlMode] = useState<'orbit' | 'pan' | 'fps'>('orbit')
  const [isFpsLocked, setIsFpsLocked] = useState<boolean>(false)
  const [cameraSignal, setCameraSignal] = useState<CameraActionSignal | null>(null)
  const [activeAnglePreset, setActiveAnglePreset] = useState<CameraPresetType | 'custom'>('custom')
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false)

  // Trigger camera actions
  const triggerCameraAction = useCallback((type: CameraActionSignal['type'], payload?: any) => {
    setCameraSignal({ type, payload, id: Date.now() })
  }, [])

  const setAnglePreset = (preset: CameraPresetType) => {
    setActiveAnglePreset(preset)
    switch (preset) {
      case 'iso':
        triggerCameraAction('preset', { pos: [2.8, 2.2, 3.2], target: [0, 0, 0] })
        break
      case 'front':
        triggerCameraAction('preset', { pos: [0, 0, 4.2], target: [0, 0, 0] })
        break
      case 'back':
        triggerCameraAction('preset', { pos: [0, 0, -4.2], target: [0, 0, 0] })
        break
      case 'top':
        triggerCameraAction('preset', { pos: [0, 4.5, 0.001], target: [0, 0, 0] })
        break
      case 'left':
        triggerCameraAction('preset', { pos: [-4.2, 0, 0], target: [0, 0, 0] })
        break
      case 'right':
        triggerCameraAction('preset', { pos: [4.2, 0, 0], target: [0, 0, 0] })
        break
    }
  }

  const handleResetCamera = () => {
    setActiveAnglePreset('custom')
    triggerCameraAction('reset')
  }

  const handleFocusCenter = () => {
    triggerCameraAction('setTarget', [0, 0, 0])
  }

  const handleFocusTop = () => {
    triggerCameraAction('setTarget', [0, 0.7, 0])
  }

  const handleFocusBottom = () => {
    triggerCameraAction('setTarget', [0, -0.7, 0])
  }

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

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'Escape') {
        if (isSidebarOpen && !isSidebarPinned) {
          setIsSidebarOpen(false)
          return
        }
        onClose()
      } else if (e.key === 'f' || e.key === 'F') {
        handleFocusCenter()
      } else if (e.key === 'r' || e.key === 'R') {
        handleResetCamera()
      } else if (e.key === ' ') {
        e.preventDefault()
        setAutoRotate((prev) => !prev)
      } else if (e.key === '+' || e.key === '=') {
        triggerCameraAction('zoomIn')
      } else if (e.key === '-' || e.key === '_') {
        triggerCameraAction('zoomOut')
      } else if (e.key === 'w' || e.key === 'W') {
        if (controlMode !== 'fps') {
          setWireframe((prev) => !prev)
        }
      } else if (e.key === 'p' || e.key === 'P') {
        setControlMode((prev) => (prev === 'orbit' ? 'pan' : prev === 'pan' ? 'fps' : 'orbit'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, triggerCameraAction, controlMode, isSidebarOpen, isSidebarPinned])

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      className="viewer-fullscreen-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualizador 3D em tela cheia de ${model.name}`}
    >
      {/* Top Header Bar */}
      <header className="viewer-fs-header">
        <div className="viewer-fs-title-group">
          <div className="viewer-fs-info">
            <h2>{model.name}</h2>
            {model.tags.length > 0 && (
              <div className="viewer-fs-meta">
                <span className="viewer-fs-tags">
                  {model.tags.map((t) => (
                    <span key={t} className="viewer-fs-tag">
                      #{t}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="viewer-fs-actions">
          {/* Quick theme / background swatches */}
          <div className="viewer-bg-swatches" title="Mudar cor do ambiente de fundo">
            {[
              { label: 'Escuro', color: '#111215' },
              { label: 'Grafite', color: '#1e2128' },
              { label: 'Azulado', color: '#0f172a' },
              { label: 'Claro', color: '#f1f5f9' },
            ].map((bg) => (
              <button
                key={bg.color}
                className={`viewer-bg-swatch ${backgroundColor === bg.color ? 'active' : ''}`}
                style={{ backgroundColor: bg.color }}
                onClick={() => setBackgroundColor(bg.color)}
                title={`Fundo ${bg.label}`}
                aria-label={`Fundo ${bg.label}`}
              />
            ))}
          </div>

          {/* Toggle 3D Control Sidebar Button */}
          <button
            type="button"
            className={`viewer-controls-toggle-btn ${isSidebarOpen || isSidebarPinned ? 'active' : ''}`}
            onClick={() => {
              setIsSidebarOpen((prev) => !prev)
            }}
            title={isSidebarOpen ? 'Ocultar Controles 3D' : 'Exibir Controles 3D'}
          >
            <SlidersHorizontal size={15} />
            <span>Controles 3D</span>
          </button>

          <button
            type="button"
            className="viewer-fs-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Sair da tela cheia do navegador' : 'Tela cheia do navegador'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            className="viewer-fs-close-btn"
            onClick={onClose}
            title="Fechar visualizador (ESC)"
            aria-label="Fechar visualizador"
          >
            <X size={18} />
            <span className="esc-hint">ESC</span>
          </button>
        </div>
      </header>

      {/* Main 3D Canvas Viewport */}
      <div className="viewer-fs-canvas-container">
        {modelUrl ? (
          <Canvas
            camera={{ position: [0, 0.5, 4.2], fov: 42, near: 0.005, far: 1000 }}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          >
            <color attach="background" args={[backgroundColor]} />
            <ModelViewer
              url={modelUrl}
              showGround={showGround}
              groundType={groundType}
              groundColor={groundColor}
              autoRotate={autoRotate}
              autoRotateSpeed={autoRotateSpeed}
              lighting={lighting}
              wireframe={wireframe}
              controlMode={controlMode}
              cameraSignal={cameraSignal}
              onFpsLockChange={setIsFpsLocked}
            />
          </Canvas>
        ) : (
          <div className="viewer-loading" role="status">
            <span>Carregando malha 3D...</span>
          </div>
        )}

        {/* FPS Mode In-Canvas Overlay (Crosshair & Prompt) */}
        {controlMode === 'fps' && (
          <div className={`viewer-fps-overlay ${isFpsLocked ? 'locked' : 'unlocked'}`}>
            {isFpsLocked ? (
              <>
                <div className="viewer-fps-crosshair" aria-hidden="true">
                  <div className="crosshair-dot" />
                </div>
                <div className="viewer-fps-active-pill">
                  <span>🎮 1ª Pessoa Ativa • [W, A, S, D] Andar • [Espaço/Shift] Altura • [ESC] Liberar Mouse</span>
                </div>
              </>
            ) : (
              <div className="viewer-fps-prompt">
                <Crosshair size={28} className="viewer-fps-prompt-icon" />
                <h3>Modo Primeira Pessoa (FPS)</h3>
                <p>Clique no espaço 3D para travar o mouse e navegar livremente.</p>
                <div className="viewer-fps-prompt-keys">
                  <span><b>W A S D</b> Andar</span>
                  <span><b>Mouse</b> Olhar 360°</span>
                  <span><b>Espaço / Q</b> Altura</span>
                  <span><b>Shift</b> Correr</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Retractable Control Sidebar */}
        <aside
          className={`viewer-sidebar-container ${isSidebarOpen || isSidebarPinned ? 'open' : ''}`}
          aria-label="Painel Lateral de Controles 3D"
        >
          {/* Collapsible Panel Content */}
          <div className="viewer-sidebar-panel">
            {/* Header */}
            <div className="viewer-sidebar-header">
              <div className="viewer-sidebar-title">
                <SlidersHorizontal size={16} />
                <span>Controles 3D</span>
              </div>
              <div className="viewer-sidebar-header-actions">
                <button
                  type="button"
                  className={`viewer-sidebar-pin-btn ${isSidebarPinned ? 'active' : ''}`}
                  onClick={() => setIsSidebarPinned((prev) => !prev)}
                  title={isSidebarPinned ? 'Desfixar barra lateral' : 'Fixar barra lateral aberta'}
                >
                  {isSidebarPinned ? <PinOff size={14} /> : <Pin size={14} />}
                  <span>{isSidebarPinned ? 'Fixado' : 'Fixar'}</span>
                </button>

                <button
                  type="button"
                  className="viewer-sidebar-close-btn"
                  onClick={() => {
                    setIsSidebarOpen(false)
                    setIsSidebarPinned(false)
                  }}
                  title="Fechar barra de controles"
                  aria-label="Fechar barra de controles"
                >
                  <X size={15} />
                </button>
            </div>
          </div>

            {/* Scrollable Group Content */}
            <div className="viewer-sidebar-scroll-area">
              {/* 1. Camera Mode */}
              <div className="viewer-hud-group">
                <span className="viewer-hud-label">Modo da Câmera</span>
                <div className="viewer-hud-row">
                  <button
                    type="button"
                    className={`viewer-hud-btn ${controlMode === 'orbit' ? 'active' : ''}`}
                    onClick={() => setControlMode('orbit')}
                    title="Modo Girar: Orbitar a câmera"
                  >
                    <Orbit size={14} />
                    <span>Girar</span>
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-btn ${controlMode === 'pan' ? 'active' : ''}`}
                    onClick={() => setControlMode('pan')}
                    title="Modo Mover: Deslocar ponto de foco"
                  >
                    <Move size={14} />
                    <span>Mover</span>
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-btn ${controlMode === 'fps' ? 'active' : ''}`}
                    onClick={() => setControlMode('fps')}
                    title="Modo FPS: Navegação em 1ª pessoa com WASD"
                  >
                    <Eye size={14} />
                    <span>FPS</span>
                  </button>
                </div>
              </div>

              {/* 2. Camera Angles */}
              <div className="viewer-hud-group">
                <span className="viewer-hud-label">Ângulo de Visão</span>
                <div className="viewer-hud-grid">
                  <button
                    type="button"
                    className={`viewer-hud-mini-btn ${activeAnglePreset === 'iso' ? 'active' : ''}`}
                    onClick={() => setAnglePreset('iso')}
                    title="Visão Isométrica 3D"
                  >
                    3D
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-mini-btn ${activeAnglePreset === 'front' ? 'active' : ''}`}
                    onClick={() => setAnglePreset('front')}
                    title="Visão Frontal"
                  >
                    Frente
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-mini-btn ${activeAnglePreset === 'top' ? 'active' : ''}`}
                    onClick={() => setAnglePreset('top')}
                    title="Visão Superior (Topo)"
                  >
                    Topo
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-mini-btn ${activeAnglePreset === 'left' ? 'active' : ''}`}
                    onClick={() => setAnglePreset('left')}
                    title="Visão Lateral Esquerda"
                  >
                    Esq.
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-mini-btn ${activeAnglePreset === 'right' ? 'active' : ''}`}
                    onClick={() => setAnglePreset('right')}
                    title="Visão Lateral Direita"
                  >
                    Dir.
                  </button>
                  <button
                    type="button"
                    className={`viewer-hud-mini-btn ${activeAnglePreset === 'back' ? 'active' : ''}`}
                    onClick={() => setAnglePreset('back')}
                    title="Visão Traseira"
                  >
                    Trás
                  </button>
                </div>
              </div>

              {/* 3. Focus Target & Zoom */}
              <div className="viewer-hud-group">
                <span className="viewer-hud-label">Ponto de Foco & Zoom</span>
                <div className="viewer-hud-row mb-2">
                  <button
                    type="button"
                    className="viewer-hud-btn"
                    onClick={handleFocusCenter}
                    title="Centralizar ponto de rotação e zoom no centro do modelo [F]"
                  >
                    <Crosshair size={14} />
                    <span>Centro</span>
                  </button>
                  <button
                    type="button"
                    className="viewer-hud-icon-btn"
                    onClick={handleFocusTop}
                    title="Focar ponto de zoom na parte superior do modelo"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="viewer-hud-icon-btn"
                    onClick={handleFocusBottom}
                    title="Focar ponto de zoom na base do modelo"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>

                <div className="viewer-hud-row">
                  <button
                    type="button"
                    className="viewer-hud-icon-btn"
                    onClick={() => triggerCameraAction('zoomIn')}
                    title="Aproximar zoom (+)"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    className="viewer-hud-icon-btn"
                    onClick={() => triggerCameraAction('zoomOut')}
                    title="Afastar zoom (-)"
                  >
                    <Minus size={16} />
                  </button>
                  <button
                    type="button"
                    className="viewer-hud-btn"
                    onClick={handleResetCamera}
                    title="Resetar câmera para enquadramento inicial [R]"
                  >
                    <RefreshCcw size={13} />
                    <span>Resetar</span>
                  </button>
                </div>
              </div>

              {/* 4. Auto-Giro & Velocidade */}
              <div className="viewer-hud-group">
                <button
                  type="button"
                  className={`viewer-hud-btn full-width ${autoRotate ? 'active' : ''}`}
                  onClick={() => setAutoRotate((prev) => !prev)}
                  title="Girar o modelo 3D continuamente em 360° [Espaço]"
                >
                  <RotateCw size={14} className={autoRotate ? 'spin' : ''} />
                  <span>Auto-Giro: {autoRotate ? 'Ativado' : 'Pausado'}</span>
                </button>

                {autoRotate && (
                  <div className="viewer-hud-speed-wrapper" style={{ marginTop: '8px' }}>
                    <div className="viewer-hud-speed-header">
                      <span>Velocidade</span>
                      <span className="viewer-hud-speed-badge">{autoRotateSpeed.toFixed(1)}x</span>
                    </div>
                    <div className="viewer-hud-speed-pills">
                      {[0.5, 1.0, 2.0, 4.0, 8.0, 12.0, 16.0, 24.0].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          className={`viewer-hud-speed-pill ${autoRotateSpeed === spd ? 'active' : ''}`}
                          onClick={() => setAutoRotateSpeed(spd)}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Lighting */}
              <div className="viewer-hud-group">
                <span className="viewer-hud-label">
                  <Sun size={12} /> Iluminação
                </span>
                <div className="viewer-hud-grid">
                  {(
                    [
                      { id: 'studio', label: 'Estúdio' },
                      { id: 'soft', label: 'Suave' },
                      { id: 'warm', label: 'Quente' },
                      { id: 'dramatic', label: 'Drama' },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`viewer-hud-mini-btn ${lighting === preset.id ? 'active' : ''}`}
                      onClick={() => setLighting(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Ground / Pedestal Type */}
              <div className="viewer-hud-group">
                <div className="viewer-hud-label-toggle">
                  <span>
                    <Layers size={12} /> Chão / Base
                  </span>
                  <button
                    type="button"
                    className="viewer-hud-toggle-link"
                    onClick={() => setShowGround((prev) => !prev)}
                  >
                    {showGround ? 'Ocultar' : 'Exibir'}
                  </button>
                </div>
                {showGround && (
                  <div className="viewer-hud-grid">
                    {(
                      [
                        { id: 'shadow', label: 'Sombra' },
                        { id: 'pedestal', label: 'Pedestal' },
                        { id: 'none', label: 'Sem' },
                      ] as const
                    ).map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        className={`viewer-hud-mini-btn ${groundType === type.id ? 'active' : ''}`}
                        onClick={() => setGroundType(type.id)}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Status / Navigation Legend */}
      <footer className="viewer-fs-footer">
        <div className="viewer-fs-shortcuts">
          {controlMode === 'fps' ? (
            <>
              <div className={`shortcut-chip ${isFpsLocked ? 'active-fps' : ''}`}>
                <span className="shortcut-key">🎮 Modo FPS</span>
                <span>{isFpsLocked ? 'Mouse Travado' : 'Clique p/ Travar'}</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">W A S D</span>
                <span>Andar</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">Mouse</span>
                <span>Olhar 360°</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">Espaço / E</span>
                <span>Subir</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">Shift / Q</span>
                <span>Descer / Correr</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">R</span>
                <span>Resetar Câmera</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">ESC</span>
                <span>Liberar Mouse</span>
              </div>
            </>
          ) : (
            <>
              <div className="shortcut-chip">
                <span className="shortcut-key">Clique Esq.</span>
                <span>{controlMode === 'orbit' ? 'Girar' : 'Mover (Pan)'}</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">Clique Dir. / Shift</span>
                <span>Mover Foco (Pan)</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">Scroll</span>
                <span>Super Zoom</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">R</span>
                <span>Resetar</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">F</span>
                <span>Focar Centro</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">Espaço</span>
                <span>Auto-Giro</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">W</span>
                <span>Malha</span>
              </div>
              <div className="shortcut-chip">
                <span className="shortcut-key">ESC</span>
                <span>Fechar</span>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  )
}
