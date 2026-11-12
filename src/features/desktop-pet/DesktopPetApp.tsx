import {
  ExternalLink,
  Loader2,
  Move,
  Pin,
  PinOff,
  RotateCw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { shelfDatabase, type StoredModel } from '../../storage/db'
import { ensureModelFileDownloaded } from '../gdrive/googleDriveService'
import { validateModelFile } from '../../domain/fileValidation'
import { generateModelThumbnail } from '../../domain/thumbnail'
import {
  closePetWindow,
  getStoredPetModelId,
  isTauriEnvironment,
  openMainWindow,
  setStoredPetModelId,
} from './desktopPetService'
import { DesktopPetScene } from './DesktopPetScene'

export function DesktopPetApp() {
  const [model, setModel] = useState<StoredModel | null>(null)
  const [allModels, setAllModels] = useState<StoredModel[]>([])
  const [modelUrl, setModelUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadingText, setLoadingText] = useState('Carregando pet 3D...')
  const [autoRotate, setAutoRotate] = useState(true)
  const [rotateSpeed] = useState(1.2)
  const [floatingAnimation, setFloatingAnimation] = useState(true)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true)
  const [petSize, setPetSize] = useState<'sm' | 'md' | 'lg'>('md')
  const [showControls, setShowControls] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)
  const [notification, setNotification] = useState<string>('')

  // Configure body for transparency
  useEffect(() => {
    document.documentElement.classList.add('desktop-pet-mode')
    document.body.classList.add('desktop-pet-mode')
    return () => {
      document.documentElement.classList.remove('desktop-pet-mode')
      document.body.classList.remove('desktop-pet-mode')
    }
  }, [])

  // Auto-clear notification
  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(''), 2500)
    return () => clearTimeout(timer)
  }, [notification])

  // Load available models for switching
  const loadAvailableModels = useCallback(async () => {
    try {
      const list = await shelfDatabase.models.toArray()
      setAllModels(list)
    } catch (err) {
      console.warn('Erro ao listar modelos:', err)
    }
  }, [])

  // Load target model
  const loadModelById = useCallback(async (id?: string | null) => {
    setIsLoading(true)
    setLoadingText('Carregando modelo 3D...')
    try {
      const params = new URLSearchParams(window.location.search)
      const targetId = id || params.get('modelId') || getStoredPetModelId()

      let targetModel: StoredModel | undefined
      if (targetId) {
        targetModel = await shelfDatabase.models.get(targetId)
      }

      // Fallback: pick the first model from the database if id not found
      if (!targetModel) {
        const list = await shelfDatabase.models.toArray()
        if (list.length > 0) {
          targetModel = list[0]
        }
      }

      if (targetModel) {
        setModel(targetModel)
        setStoredPetModelId(targetModel.id)

        // Ensure blob is loaded (from DB or Google Drive)
        const fileBlob = await ensureModelFileDownloaded(targetModel.id)
        if (fileBlob) {
          const url = URL.createObjectURL(fileBlob)
          setModelUrl(url)
        } else if (targetModel.file) {
          const url = URL.createObjectURL(targetModel.file)
          setModelUrl(url)
        } else {
          console.warn('Arquivo do modelo 3D não encontrado.')
          setModelUrl('')
        }
      } else {
        setModel(null)
        setModelUrl('')
      }
    } catch (err) {
      console.error('Erro ao carregar modelo para o pet:', err)
      setModelUrl('')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadModelById()
    loadAvailableModels()
  }, [loadModelById, loadAvailableModels])

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (modelUrl && modelUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modelUrl)
      }
    }
  }, [modelUrl])

  // Start window dragging via Tauri API
  const handleStartDrag = async (e: React.MouseEvent) => {
    if (e.button === 0 && isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().startDragging()
      } catch (err) {
        console.warn('Tauri startDragging failed:', err)
      }
    }
  }

  // Direct Drag and Drop of .glb/.gltf files into the Pet Window
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    const file = files[0]
    const validation = await validateModelFile(file)
    if (!validation.valid) {
      setNotification(validation.message || 'Formato inválido. Arraste um arquivo .glb ou .gltf')
      return
    }

    setIsLoading(true)
    setLoadingText(`Importando ${file.name}...`)
    try {
      const format = validation.format
      const thumbnail = await generateModelThumbnail(file)
      const newModel: StoredModel = {
        id: `pet-drop-${Date.now()}`,
        name: file.name.replace(/\.(glb|gltf)$/i, ''),
        format,
        sizeBytes: file.size,
        tags: ['pet'],
        createdAt: new Date().toISOString(),
        file,
        thumbnail: thumbnail ?? undefined,
      }
      await shelfDatabase.models.put(newModel)
      setModel(newModel)
      setStoredPetModelId(newModel.id)
      const url = URL.createObjectURL(file)
      setModelUrl(url)
      setNotification(`Carregado: ${newModel.name}`)
      loadAvailableModels()
    } catch (err) {
      console.error('Erro ao importar arquivo arrastado:', err)
      setNotification('Erro ao carregar modelo')
    } finally {
      setIsLoading(false)
    }
  }

  // Toggle Always on top
  const handleToggleAlwaysOnTop = async () => {
    const nextVal = !isAlwaysOnTop
    setIsAlwaysOnTop(nextVal)
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().setAlwaysOnTop(nextVal)
      } catch (err) {
        console.warn('Erro ao alterar always-on-top:', err)
      }
    }
    setNotification(nextVal ? 'Sempre no topo: Ativado' : 'Sempre no topo: Desativado')
  }

  // Change window size
  const handleChangeSize = async (size: 'sm' | 'md' | 'lg') => {
    setPetSize(size)
    const dim = size === 'sm' ? 240 : size === 'md' ? 340 : 460
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const { LogicalSize } = await import('@tauri-apps/api/dpi')
        await getCurrentWindow().setSize(new LogicalSize(dim, dim))
      } catch (err) {
        console.warn('Erro ao redimensionar janela do pet:', err)
      }
    }
    setNotification(`Tamanho: ${size.toUpperCase()}`)
  }

  // Handle right click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    loadAvailableModels()
  }

  useEffect(() => {
    const closeMenu = () => setContextMenuPos(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  return (
    <div
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: 'transparent',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Drag Surface Overlay (top bar) */}
      <div
        onMouseDown={handleStartDrag}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '42px',
          zIndex: 20,
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      >
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '999px',
            padding: '4px 12px',
            color: '#cbd5e1',
            fontSize: '11px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          <Move size={12} />
          <span>Arrastar Pet</span>
        </div>
      </div>

      {/* Floating Toolbar (bottom) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 25,
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(10px)',
          padding: '6px 10px',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* Toggle Spin */}
        <button
          type="button"
          title={autoRotate ? 'Pausar rotação' : 'Girar automaticamente'}
          onClick={() => setAutoRotate(!autoRotate)}
          style={{
            background: autoRotate ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            color: autoRotate ? '#38bdf8' : '#94a3b8',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <RotateCw size={14} />
        </button>

        {/* Toggle Floating Bob */}
        <button
          type="button"
          title={floatingAnimation ? 'Desativar flutuação' : 'Ativar flutuação'}
          onClick={() => setFloatingAnimation(!floatingAnimation)}
          style={{
            background: floatingAnimation ? 'rgba(196, 104, 67, 0.25)' : 'transparent',
            color: floatingAnimation ? '#c46843' : '#94a3b8',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={14} />
        </button>

        {/* Toggle Always on top */}
        <button
          type="button"
          title={isAlwaysOnTop ? 'Desafixar do topo' : 'Fixar sempre no topo'}
          onClick={handleToggleAlwaysOnTop}
          style={{
            background: isAlwaysOnTop ? 'rgba(34, 197, 94, 0.25)' : 'transparent',
            color: isAlwaysOnTop ? '#4ade80' : '#94a3b8',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {isAlwaysOnTop ? <Pin size={14} /> : <PinOff size={14} />}
        </button>

        {/* Size Cycle */}
        <button
          type="button"
          title={`Tamanho: ${petSize.toUpperCase()} (Clique para alternar)`}
          onClick={() => {
            const next = petSize === 'sm' ? 'md' : petSize === 'md' ? 'lg' : 'sm'
            handleChangeSize(next)
          }}
          style={{
            background: 'transparent',
            color: '#cbd5e1',
            border: 'none',
            borderRadius: '12px',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {petSize.toUpperCase()}
        </button>

        {/* Divider */}
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />

        {/* Open Main Shelf */}
        <button
          type="button"
          title="Focar janela da Prateleira 3D"
          onClick={openMainWindow}
          style={{
            background: 'transparent',
            color: '#cbd5e1',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ExternalLink size={14} />
        </button>

        {/* Close Pet */}
        <button
          type="button"
          title="Fechar Pet"
          onClick={closePetWindow}
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Floating Notification */}
      {notification && (
        <div
          style={{
            position: 'absolute',
            top: '46px',
            zIndex: 30,
            background: 'rgba(15, 23, 42, 0.92)',
            color: '#f8fafc',
            padding: '5px 12px',
            borderRadius: '999px',
            fontSize: '11px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {notification}
        </div>
      )}

      {/* Right Click Context Menu */}
      {contextMenuPos && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: `${contextMenuPos.y}px`,
            left: `${contextMenuPos.x}px`,
            zIndex: 99,
            background: '#181a20',
            border: '1px solid #2d3343',
            borderRadius: '10px',
            padding: '6px',
            minWidth: '190px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            color: '#f1f5f9',
            fontSize: '12px',
          }}
        >
          <div style={{ padding: '6px 8px', fontWeight: 600, color: '#94a3b8', fontSize: '11px' }}>
            {model?.name || 'Desktop Pet 3D'}
          </div>

          <button
            type="button"
            onClick={() => {
              setAutoRotate(!autoRotate)
              setContextMenuPos(null)
            }}
            style={contextMenuItemStyle}
          >
            <RotateCw size={13} />
            <span>{autoRotate ? 'Pausar Rotação' : 'Ativar Rotação'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFloatingAnimation(!floatingAnimation)
              setContextMenuPos(null)
            }}
            style={contextMenuItemStyle}
          >
            <Sparkles size={13} />
            <span>{floatingAnimation ? 'Desativar Levitação' : 'Ativar Levitação'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleToggleAlwaysOnTop()
              setContextMenuPos(null)
            }}
            style={contextMenuItemStyle}
          >
            {isAlwaysOnTop ? <PinOff size={13} /> : <Pin size={13} />}
            <span>{isAlwaysOnTop ? 'Desafixar do Topo' : 'Sempre no Topo'}</span>
          </button>

          {/* Switch Model List if multiple models exist */}
          {allModels.length > 1 && (
            <>
              <div style={{ height: '1px', background: '#2d3343', margin: '4px 0' }} />
              <div style={{ padding: '4px 8px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                ESCOLHER MODELO:
              </div>
              <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                {allModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      loadModelById(m.id)
                      setContextMenuPos(null)
                    }}
                    style={{
                      ...contextMenuItemStyle,
                      fontWeight: m.id === model?.id ? 700 : 400,
                      color: m.id === model?.id ? '#38bdf8' : '#cbd5e1',
                    }}
                  >
                    <span>{m.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ height: '1px', background: '#2d3343', margin: '4px 0' }} />

          <button
            type="button"
            onClick={() => {
              openMainWindow()
              setContextMenuPos(null)
            }}
            style={contextMenuItemStyle}
          >
            <ExternalLink size={13} />
            <span>Abrir Prateleira 3D</span>
          </button>

          <button
            type="button"
            onClick={() => {
              closePetWindow()
              setContextMenuPos(null)
            }}
            style={{ ...contextMenuItemStyle, color: '#f87171' }}
          >
            <X size={13} />
            <span>Fechar Pet</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div
          onMouseDown={handleStartDrag}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            borderRadius: '16px',
            padding: '16px 24px',
            color: '#f8fafc',
            cursor: 'grab',
          }}
        >
          <Loader2 size={24} color="#38bdf8" className="animate-spin" />
          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{loadingText}</span>
        </div>
      ) : modelUrl ? (
        <Canvas
          gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
          camera={{ position: [0, 0, 3.8], fov: 45 }}
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            pointerEvents: 'auto',
          }}
          onMouseDown={handleStartDrag}
        >
          <DesktopPetScene
            url={modelUrl}
            autoRotate={autoRotate}
            rotateSpeed={rotateSpeed}
            floatingAnimation={floatingAnimation}
            onModelClick={() => {
              setNotification(model?.name || 'Pet 3D!')
            }}
          />
        </Canvas>
      ) : (
        <div
          onMouseDown={handleStartDrag}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            background: 'rgba(24, 26, 32, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px dashed rgba(255,255,255,0.2)',
            borderRadius: '16px',
            padding: '20px',
            color: '#f8fafc',
            textAlign: 'center',
            maxWidth: '240px',
            cursor: 'grab',
          }}
        >
          <Sparkles size={28} color="#c46843" />
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Nenhum modelo selecionado</div>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
            Arraste um arquivo <b>.glb</b> aqui ou clique em <b>"Desktop Pet"</b> na Prateleira 3D.
          </p>
          <button
            type="button"
            onClick={openMainWindow}
            style={{
              marginTop: '4px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: '#2d5b58',
              color: '#ffffff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Abrir Prateleira
          </button>
        </div>
      )}
    </div>
  )
}

const contextMenuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  width: '100%',
  padding: '7px 10px',
  borderRadius: '6px',
  background: 'transparent',
  border: 'none',
  color: '#cbd5e1',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '12px',
}
