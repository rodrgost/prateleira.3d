import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderPlus,
  Image as ImageIcon,
  Key,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Type,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  createImageToModelTask,
  createTextToModelTask,
  downloadModelAsFile,
  getStoredTripoApiKey,
  pollTripoTask,
  saveStoredTripoApiKey,
  uploadTripoImage,
  type TripoTaskResult,
} from './tripoService'
import type { Shelf } from '../../domain/types'
import { rotateGlbModel } from '../../domain/modelTransform'

interface AiModelGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  shelves: Shelf[]
  activeShelfId: string
  onModelGeneratedAndImport: (file: File, shelfId: string, modelName: string) => Promise<void>
}

type GeneratorMode = 'image' | 'text'

export function AiModelGeneratorModal({
  isOpen,
  onClose,
  shelves,
  activeShelfId,
  onModelGeneratedAndImport,
}: AiModelGeneratorModalProps) {
  const [apiKey, setApiKey] = useState(() => getStoredTripoApiKey())
  const [showApiKey, setShowApiKey] = useState(false)
  const [isKeySaved, setIsKeySaved] = useState(Boolean(getStoredTripoApiKey()))

  const [mode, setMode] = useState<GeneratorMode>('image')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('')
  const [textPrompt, setTextPrompt] = useState('')
  const [modelName, setModelName] = useState('')
  const [selectedShelfId, setSelectedShelfId] = useState(activeShelfId !== 'all' ? activeShelfId : '')
  const [modelVersion, setModelVersion] = useState('v3.1-20260211')
  const [imageOrientation, setImageOrientation] = useState<'align_image' | 'default'>('align_image')
  const [rotationDegrees, setRotationDegrees] = useState<number>(-90)

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [taskResult, setTaskResult] = useState<TripoTaskResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (activeShelfId !== 'all') {
        setSelectedShelfId(activeShelfId)
      } else if (shelves.length > 0) {
        setSelectedShelfId(shelves[0].id)
      } else {
        setSelectedShelfId('')
      }
    }
  }, [isOpen, activeShelfId, shelves])

  useEffect(() => {
    if (selectedImage) {
      const url = URL.createObjectURL(selectedImage)
      setImagePreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setImagePreviewUrl('')
    }
  }, [selectedImage])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  if (!isOpen) return null

  const handleSaveApiKey = () => {
    saveStoredTripoApiKey(apiKey)
    setIsKeySaved(true)
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).')
      return
    }

    setErrorMessage('')
    setSelectedImage(file)
    if (!modelName) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setModelName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, arraste um arquivo de imagem válido (PNG, JPG, WEBP).')
      return
    }

    setErrorMessage('')
    setSelectedImage(file)
    if (!modelName) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setModelName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1))
    }
  }

  const handleStartGeneration = async () => {
    const trimmedKey = apiKey.trim()
    if (!trimmedKey) {
      setErrorMessage('Por favor, insira sua Chave de API da Tripo3D.')
      return
    }

    if (mode === 'image' && !selectedImage) {
      setErrorMessage('Por favor, selecione uma imagem para converter em 3D.')
      return
    }

    if (mode === 'text' && !textPrompt.trim()) {
      setErrorMessage('Por favor, digite uma descrição para o modelo 3D.')
      return
    }

    // Save key automatically
    saveStoredTripoApiKey(trimmedKey)
    setIsKeySaved(true)

    setIsGenerating(true)
    setProgress(5)
    setStatusMessage('Iniciando comunicação com Tripo3D...')
    setErrorMessage('')
    setTaskResult(null)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      let taskId = ''
      if (mode === 'image' && selectedImage) {
        setStatusMessage('Fazendo upload da imagem...')
        setProgress(15)
        const imageToken = await uploadTripoImage(selectedImage, trimmedKey)

        setStatusMessage('Criando tarefa de reconstrução 3D...')
        setProgress(25)
        const ext = selectedImage.name.split('.').pop() || 'png'
        taskId = await createImageToModelTask(imageToken, ext, trimmedKey, modelVersion, {
          orientation: imageOrientation,
          texture: true,
          pbr: true,
          textureAlignment: 'original_image',
        })
      } else {
        setStatusMessage('Criando modelo a partir do prompt de texto...')
        setProgress(25)
        taskId = await createTextToModelTask(textPrompt, trimmedKey, modelVersion, {
          texture: true,
          pbr: true,
        })
      }

      setStatusMessage('Processando modelo 3D com IA...')
      const result = await pollTripoTask(
        taskId,
        trimmedKey,
        (currentProgress, currentStatus) => {
          setProgress(Math.max(25, currentProgress))
          setStatusMessage(currentStatus)
        },
        abortController.signal
      )

      setProgress(100)
      setStatusMessage('Modelo 3D gerado com sucesso!')
      setTaskResult(result)

      // Auto-import immediately after generation!
      const defaultName = modelName.trim() || (mode === 'text' ? textPrompt.slice(0, 30) : 'Modelo IA')
      setIsImporting(true)
      setStatusMessage('Baixando arquivo .GLB da IA...')
      let file = await downloadModelAsFile(result.modelUrl, defaultName)

      if (rotationDegrees !== 0) {
        setStatusMessage('Alinhando rotação frontal do modelo 3D...')
        const rad = (rotationDegrees * Math.PI) / 180
        file = await rotateGlbModel(file, rad, defaultName)
      }

      setStatusMessage('Renderizando thumbnail e adicionando à biblioteca...')
      await onModelGeneratedAndImport(file, selectedShelfId, defaultName)
      setIsImporting(false)
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('cancelada')) {
        setStatusMessage('Geração cancelada.')
      } else {
        setErrorMessage(err.message || 'Ocorreu um erro desconhecido durante a geração.')
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleResetForm = () => {
    setSelectedImage(null)
    setImagePreviewUrl('')
    setTextPrompt('')
    setModelName('')
    setImageOrientation('align_image')
    setRotationDegrees(-90)
    setTaskResult(null)
    setProgress(0)
    setStatusMessage('')
    setErrorMessage('')
  }

  return (
    <div className="modal-backdrop" onClick={!isGenerating ? onClose : undefined}>
      <div className="modal-dialog ai-generator-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header ai-modal-header">
          <div className="ai-badge-title">
            <div className="ai-icon-bubble">
              <Sparkles size={20} className="ai-sparkle-icon" />
            </div>
            <div>
              <h3>Gerador 3D com Inteligência Artificial</h3>
              <p className="ai-subtitle">Transforme fotos ou prompts em modelos 3D (.glb) usando a API Tripo3D</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={isGenerating} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body ai-generator-body">
          {/* API Key Configuration Section */}
          <div className="ai-config-box">
            <div className="ai-config-header">
              <label className="ai-field-label">
                <Key size={14} /> Chave de API da Tripo3D
              </label>
              <a
                href="https://platform.tripo3d.ai"
                target="_blank"
                rel="noreferrer"
                className="ai-api-link"
                title="Obter chave no painel da Tripo"
              >
                <span>Obter chave gratuita</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="ai-key-input-wrapper">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setIsKeySaved(false)
                }}
                placeholder="Insira sua chave (ex: tpo_live_...)"
                className="ai-input ai-key-input"
                disabled={isGenerating}
              />
              <button
                type="button"
                className="ai-key-toggle-btn"
                onClick={() => setShowApiKey(!showApiKey)}
                title={showApiKey ? 'Ocultar chave' : 'Mostrar chave'}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className={`ai-key-save-btn ${isKeySaved ? 'saved' : ''}`}
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim() || isGenerating}
                title="Salvar chave neste navegador"
              >
                {isKeySaved ? <CheckCircle2 size={15} /> : 'Salvar'}
              </button>
            </div>
            <p className="ai-helper-text">
              A chave é armazenada de forma segura apenas no seu navegador (localStorage).
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="ai-mode-selector">
            <button
              type="button"
              className={`ai-mode-btn ${mode === 'image' ? 'active' : ''}`}
              onClick={() => {
                if (!isGenerating) setMode('image')
              }}
              disabled={isGenerating}
            >
              <ImageIcon size={16} />
              <span>Imagem para 3D</span>
            </button>
            <button
              type="button"
              className={`ai-mode-btn ${mode === 'text' ? 'active' : ''}`}
              onClick={() => {
                if (!isGenerating) setMode('text')
              }}
              disabled={isGenerating}
            >
              <Type size={16} />
              <span>Texto para 3D</span>
            </button>
          </div>

          {/* Mode Inputs */}
          {mode === 'image' ? (
            <div className="ai-upload-section">
              <label className="ai-field-label">Foto / Imagem do Objeto ou Personagem</label>
              <div
                className={`ai-dropzone ${selectedImage ? 'has-file' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => !isGenerating && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleImageFileChange}
                  style={{ display: 'none' }}
                  disabled={isGenerating}
                />

                {imagePreviewUrl ? (
                  <div className="ai-preview-container">
                    <img src={imagePreviewUrl} alt="Preview" className="ai-image-preview" />
                    <div className="ai-preview-overlay">
                      <p className="ai-preview-name">{selectedImage?.name}</p>
                      <span className="ai-change-text">Clique ou arraste para trocar de imagem</span>
                    </div>
                  </div>
                ) : (
                  <div className="ai-dropzone-prompt">
                    <div className="ai-upload-icon-circle">
                      <Upload size={24} />
                    </div>
                    <p className="ai-drop-title">Arraste uma foto aqui ou clique para selecionar</p>
                    <p className="ai-drop-hint">PNG, JPG ou WEBP (objetos com fundo limpo geram os melhores resultados)</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="ai-text-section">
              <label className="ai-field-label">Descrição do Modelo 3D (Prompt)</label>
              <textarea
                value={textPrompt}
                onChange={(e) => {
                  setTextPrompt(e.target.value)
                  if (!modelName && e.target.value.trim()) {
                    setModelName(e.target.value.slice(0, 30))
                  }
                }}
                placeholder="Ex: a cute low-poly robot with blue neon eyes and metallic armor..."
                className="ai-textarea"
                rows={3}
                disabled={isGenerating}
              />
            </div>
          )}

          {/* Model Options */}
          <div className="ai-options-grid">
            <div className="ai-option-field">
              <label className="ai-field-label">Nome do Modelo</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Ex: Escultura Futurista"
                className="ai-input"
                disabled={isGenerating}
              />
            </div>

            <div className="ai-option-field">
              <label className="ai-field-label">Prateleira de Destino</label>
              <select
                value={selectedShelfId}
                onChange={(e) => setSelectedShelfId(e.target.value)}
                className="ai-select"
                disabled={isGenerating}
              >
                <option value="">(Sem prateleira específica)</option>
                {shelves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ai-option-field">
              <label className="ai-field-label">Versão do Modelo de IA</label>
              <select
                value={modelVersion}
                onChange={(e) => setModelVersion(e.target.value)}
                className="ai-select"
                disabled={isGenerating}
              >
                <option value="v3.1-20260211">Tripo v3.1 (Mais Recente & Alta Definição)</option>
                <option value="v3.0-20250812">Tripo v3.0 (Estável)</option>
                <option value="v2.5-20250123">Tripo v2.5 (Rápido)</option>
                <option value="P2-20260801">Tripo P2 (Produção)</option>
                <option value="P1-20260311">Tripo P1</option>
              </select>
            </div>

            {mode === 'image' && (
              <>
                <div className="ai-option-field">
                  <label className="ai-field-label">Enquadramento / Ângulo</label>
                  <select
                    value={imageOrientation}
                    onChange={(e) => setImageOrientation(e.target.value as 'align_image' | 'default')}
                    className="ai-select"
                    disabled={isGenerating}
                  >
                    <option value="align_image">Alinhado à Foto Frontal (Recomendado)</option>
                    <option value="default">Padrão da IA (Sem forçar rotação)</option>
                  </select>
                </div>

                <div className="ai-option-field">
                  <label className="ai-field-label">Girar Modelo (Ajuste Frontal)</label>
                  <select
                    value={rotationDegrees}
                    onChange={(e) => setRotationDegrees(Number(e.target.value))}
                    className="ai-select"
                    disabled={isGenerating}
                  >
                    <option value={-90}>Girar -90° (Frontal para IA Tripo) [Padrão]</option>
                    <option value={0}>0° (Sem Rotação / Original)</option>
                    <option value={90}>Girar +90°</option>
                    <option value={180}>Girar 180°</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Generation Progress & Status */}
          {(isGenerating || isImporting) && (
            <div className="ai-progress-card">
              <div className="ai-progress-top">
                <div className="ai-status-pulse">
                  <Loader2 size={18} className="spin-icon text-accent" />
                  <span className="ai-status-label">{statusMessage || 'Processando com Tripo3D...'}</span>
                </div>
                <span className="ai-progress-percent">{progress}%</span>
              </div>
              <div className="ai-progress-bar-track">
                <div className="ai-progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="ai-progress-hint">
                A geração geralmente leva de 20 a 60 segundos. O modelo será importado automaticamente!
              </p>
            </div>
          )}

          {/* Task Completion Banner */}
          {taskResult && !isGenerating && !isImporting && (
            <div className="ai-success-card">
              <div className="ai-success-content">
                <CheckCircle2 size={24} className="text-success" />
                <div className="ai-success-info">
                  <h4>Modelo gerado e importado com sucesso!</h4>
                  <p>O arquivo .GLB já foi salvo na sua biblioteca local com miniatura renderizada.</p>
                </div>
              </div>
              {taskResult.thumbnailUrl && (
                <div className="ai-result-thumbnail">
                  <img src={taskResult.thumbnailUrl} alt="Thumbnail Gerada" />
                </div>
              )}
            </div>
          )}

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="ai-error-banner">
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer ai-modal-footer">
          {isGenerating ? (
            <button type="button" className="btn btn-danger" onClick={handleCancelGeneration}>
              Cancelar Geração
            </button>
          ) : taskResult ? (
            <div className="ai-footer-completed-actions">
              <button type="button" className="btn btn-secondary" onClick={handleResetForm}>
                <RefreshCw size={15} /> Gerar Outro Modelo
              </button>
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Ver na Biblioteca
              </button>
            </div>
          ) : (
            <div className="ai-footer-default-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary ai-submit-btn"
                onClick={handleStartGeneration}
                disabled={!apiKey.trim() || (mode === 'image' && !selectedImage) || (mode === 'text' && !textPrompt.trim())}
              >
                <Sparkles size={16} />
                <span>Gerar Modelo 3D</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
