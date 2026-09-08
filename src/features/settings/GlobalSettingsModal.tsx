import {
  ArrowUpDown,
  CircleDot,
  Cloud,
  Compass,
  Download,
  Grid,
  HardDrive,
  Layers,
  LayoutGrid,
  Maximize2,
  Moon,
  Palette,
  RefreshCw,
  RotateCw,
  Settings as SettingsIcon,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { GlobalSettings, GroundType, LightingPreset, Shelf, ShelfViewerSettings, SortOption } from '../../domain/types'
import { DEFAULT_VIEWER_SETTINGS } from '../../storage/settingsStorage'
import { GoogleDriveTab } from '../gdrive/GoogleDriveTab'

interface GlobalSettingsModalProps {
  settings: GlobalSettings
  storageUsed: string
  isProcessing: boolean
  shelves?: Shelf[]
  onSave: (settings: GlobalSettings) => void
  onClose: () => void
  onRegenerateThumbnails: () => Promise<void>
  onExportCatalog: () => void
  onClearAllData: () => Promise<void>
  onDataRestored?: () => Promise<void>
  initialTab?: 'viewer' | 'appearance' | 'storage' | 'gdrive'
}

const BG_PRESETS = [
  { name: 'Escuro Estúdio', color: '#141519' },
  { name: 'Grafite', color: '#1c1f26' },
  { name: 'Azul Meia-Noite', color: '#0d1726' },
  { name: 'Verde Floresta', color: '#102019' },
  { name: 'Roxo Minimal', color: '#1e1428' },
  { name: 'Claro Areia', color: '#eae5dc' },
  { name: 'Cinza Puro', color: '#27272a' },
  { name: 'Branco Studio', color: '#f8fafc' },
]

const GROUND_TYPES: { type: GroundType; label: string; desc: string }[] = [
  { type: 'shadow', label: 'Sombra Suave', desc: 'Oclusão de contato realista' },
  { type: 'pedestal', label: 'Pedestal 3D', desc: 'Podium chanfrado de vitrine' },
]

const LIGHTING_PRESETS: { preset: LightingPreset; label: string }[] = [
  { preset: 'studio', label: 'Estúdio' },
  { preset: 'dramatic', label: 'Dramática' },
  { preset: 'warm', label: 'Quente' },
  { preset: 'soft', label: 'Suave' },
]

const GROUND_COLOR_PRESETS = ['#4f627d', '#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#94a3b8', '#ffffff', '#222226']

export function GlobalSettingsModal({
  settings,
  storageUsed,
  isProcessing,
  shelves = [],
  onSave,
  onClose,
  onRegenerateThumbnails,
  onExportCatalog,
  onClearAllData,
  onDataRestored,
  initialTab = 'viewer',
}: GlobalSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'viewer' | 'appearance' | 'storage' | 'gdrive'>(initialTab)
  const [localSettings, setLocalSettings] = useState<GlobalSettings>(settings)

  const updateViewer = (partial: Partial<ShelfViewerSettings>) => {
    setLocalSettings((prev) => ({
      ...prev,
      viewer: {
        ...prev.viewer,
        ...partial,
      },
    }))
  }

  const handleSave = () => {
    onSave(localSettings)
    onClose()
  }

  const handleResetDefaults = () => {
    if (!window.confirm('Deseja restaurar as configurações globais para os valores padrão de fábrica?')) return
    const reset: GlobalSettings = {
      theme: 'dark',
      defaultViewMode: 'showcase',
      viewer: {
        ...DEFAULT_VIEWER_SETTINGS,
      },
    }
    setLocalSettings(reset)
  }

  const currentBg = localSettings.viewer.backgroundColor || '#141519'
  const isGroundActive = localSettings.viewer.showGround ?? true
  const currentGroundType = localSettings.viewer.groundType || 'grid'
  const currentGroundColor = localSettings.viewer.groundColor || '#4f627d'
  const isAutoRotate = localSettings.viewer.autoRotate ?? false
  const currentSpeed = localSettings.viewer.autoRotateSpeed ?? 2.0
  const currentLighting = localSettings.viewer.lighting || 'studio'

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Configurações Globais">
      <div className="settings-modal-dialog">
        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-modal-title-group">
            <div className="settings-modal-icon">
              <SettingsIcon size={20} />
            </div>
            <div>
              <span className="eyebrow">sistema & preferências</span>
              <h2>Configurações Globais</h2>
            </div>
          </div>
          <button type="button" className="settings-modal-close" onClick={onClose} aria-label="Fechar configurações">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'viewer'}
            className={`settings-tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
            onClick={() => setActiveTab('viewer')}
          >
            <Sliders size={16} />
            <span>Ambiente 3D Padrão</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            className={`settings-tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette size={16} />
            <span>Aparência & Interface</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'storage'}
            className={`settings-tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
          >
            <HardDrive size={16} />
            <span>Armazenamento Local</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'gdrive'}
            className={`settings-tab-btn ${activeTab === 'gdrive' ? 'active' : ''}`}
            onClick={() => setActiveTab('gdrive')}
          >
            <Cloud size={16} />
            <span>Google Drive</span>
          </button>
        </nav>

        {/* Tab Content Body */}
        <div className="settings-modal-body">
          {activeTab === 'viewer' && (
            <div className="settings-tab-panel">
              <p className="settings-tab-desc">
                Defina o padrão de fundo, chão e iluminação para novos modelos ou bibliotecas que não tenham configurações personalizadas.
              </p>

              {/* 1. Cor de Fundo */}
              <div className="settings-section">
                <label className="section-title">
                  <Palette size={15} />
                  <span>Cor de Fundo Padrão</span>
                </label>
                <div className="color-swatches-row">
                  {BG_PRESETS.map((preset) => (
                    <button
                      key={preset.color}
                      type="button"
                      className={`color-swatch-btn ${currentBg.toLowerCase() === preset.color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                      onClick={() => updateViewer({ backgroundColor: preset.color })}
                    />
                  ))}
                  <label className="custom-color-picker" title="Escolher cor personalizada">
                    <input
                      type="color"
                      value={currentBg}
                      onChange={(e) => updateViewer({ backgroundColor: e.target.value })}
                    />
                    <span>Personalizada</span>
                  </label>
                </div>
              </div>

              {/* 2. Chão Padrão */}
              <div className="settings-section">
                <div className="settings-header-toggle">
                  <label className="section-title">
                    <Layers size={15} />
                    <span>Exibir Chão por Padrão</span>
                  </label>
                  <button
                    type="button"
                    className={`settings-switch ${isGroundActive ? 'on' : 'off'}`}
                    onClick={() => updateViewer({ showGround: !isGroundActive })}
                  >
                    <span className="switch-knob" />
                    <span className="switch-text">{isGroundActive ? 'Habilitado' : 'Desabilitado'}</span>
                  </button>
                </div>

                {isGroundActive && (
                  <div className="ground-types-grid" style={{ marginTop: '0.75rem' }}>
                    {GROUND_TYPES.map((g) => (
                      <button
                        key={g.type}
                        type="button"
                        className={`ground-type-card ${currentGroundType === g.type ? 'active' : ''}`}
                        onClick={() => updateViewer({ groundType: g.type })}
                      >
                        <div className="ground-icon-wrap">
                          {g.type === 'shadow' && <CircleDot size={18} />}
                          {g.type === 'pedestal' && <Layers size={18} />}
                        </div>
                        <div className="ground-card-info">
                          <strong>{g.label}</strong>
                          <span>{g.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Cor do Chão / Grade Padrão */}
              {isGroundActive && currentGroundType !== 'shadow' && (
                <div className="settings-section">
                  <label className="section-title">
                    <Palette size={15} />
                    <span>Cor Padrão do Chão / Base</span>
                  </label>
                  <div className="color-swatches-row">
                    {GROUND_COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-swatch-btn ${currentGroundColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateViewer({ groundColor: color })}
                      />
                    ))}
                    <label className="custom-color-picker" title="Cor customizada">
                      <input
                        type="color"
                        value={currentGroundColor}
                        onChange={(e) => updateViewer({ groundColor: e.target.value })}
                      />
                      <span>Custom</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 4. Iluminação Padrão & Auto-rotação */}
              <div className="settings-columns-row">
                <div className="settings-section half">
                  <label className="section-title">
                    <Sun size={15} />
                    <span>Iluminação Padrão</span>
                  </label>
                  <div className="lighting-pills">
                    {LIGHTING_PRESETS.map((lp) => (
                      <button
                        key={lp.preset}
                        type="button"
                        className={`lighting-pill ${currentLighting === lp.preset ? 'active' : ''}`}
                        onClick={() => updateViewer({ lighting: lp.preset })}
                      >
                        {lp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-section half">
                  <label className="section-title">
                    <RotateCw size={15} />
                    <span>Auto-rotação Padrão</span>
                  </label>
                  <div className="settings-rotation-controls">
                    <button
                      type="button"
                      className={`settings-switch ${isAutoRotate ? 'on' : 'off'}`}
                      onClick={() => updateViewer({ autoRotate: !isAutoRotate })}
                    >
                      <span className="switch-knob" />
                      <span className="switch-text">{isAutoRotate ? 'Ativada' : 'Pausada'}</span>
                    </button>

                    <div className="rotation-speed-box">
                      <div className="speed-header">
                        <span className="speed-title">Velocidade de Giro</span>
                        <span className="speed-badge">{currentSpeed.toFixed(1)}x</span>
                      </div>
                      <div className="speed-slider-row">
                        <input
                          type="range"
                          min="0.5"
                          max="24"
                          step="0.5"
                          value={currentSpeed}
                          onChange={(e) => updateViewer({ autoRotateSpeed: parseFloat(e.target.value) })}
                          className="speed-slider"
                          aria-label="Velocidade de rotação padrão"
                        />
                      </div>
                      <div className="speed-presets">
                        {[0.5, 1.0, 2.0, 4.0, 8.0, 12.0, 16.0, 24.0].map((spd) => (
                          <button
                            key={spd}
                            type="button"
                            className={`speed-preset-btn ${currentSpeed === spd ? 'active' : ''}`}
                            onClick={() => updateViewer({ autoRotateSpeed: spd })}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="settings-tab-panel">
              <p className="settings-tab-desc">Personalize a aparência geral da interface do aplicativo.</p>

              {/* Tema */}
              <div className="settings-section">
                <label className="section-title">
                  <Palette size={15} />
                  <span>Tema da Interface</span>
                </label>
                <div className="choice-cards-row">
                  <button
                    type="button"
                    className={`choice-card ${localSettings.theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setLocalSettings((p) => ({ ...p, theme: 'dark' }))}
                  >
                    <Moon size={20} />
                    <div>
                      <strong>Modo Escuro</strong>
                      <span>Interface grafite focada no contraste 3D</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`choice-card ${localSettings.theme === 'light' ? 'active' : ''}`}
                    onClick={() => setLocalSettings((p) => ({ ...p, theme: 'light' }))}
                  >
                    <Sun size={20} />
                    <div>
                      <strong>Modo Claro</strong>
                      <span>Interface areia clara e aconchegante</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Modo de exibição padrão */}
              <div className="settings-section">
                <label className="section-title">
                  <LayoutGrid size={15} />
                  <span>Modo de Exibição Padrão da Galeria</span>
                </label>
                <div className="choice-cards-row">
                  <button
                    type="button"
                    className={`choice-card ${localSettings.defaultViewMode === 'showcase' ? 'active' : ''}`}
                    onClick={() => setLocalSettings((p) => ({ ...p, defaultViewMode: 'showcase' }))}
                  >
                    <LayoutGrid size={20} />
                    <div>
                      <strong>Vitrine Vertical</strong>
                      <span>Cards em formato retrato com preview em destaque</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`choice-card ${localSettings.defaultViewMode === 'compact' ? 'active' : ''}`}
                    onClick={() => setLocalSettings((p) => ({ ...p, defaultViewMode: 'compact' }))}
                  >
                    <Grid size={20} />
                    <div>
                      <strong>Grade Compacta</strong>
                      <span>Densidade alta para coleções grandes</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Ordenação padrão */}
              <div className="settings-section">
                <label className="section-title">
                  <ArrowUpDown size={15} />
                  <span>Ordenação Padrão da Galeria</span>
                </label>
                <select
                  className="settings-select"
                  value={localSettings.defaultSortBy || 'custom'}
                  onChange={(e) => setLocalSettings((p) => ({ ...p, defaultSortBy: e.target.value as SortOption }))}
                >
                  <option value="custom">Ordem manual / padrão</option>
                  <option value="name-asc">Nome (A - Z)</option>
                  <option value="name-desc">Nome (Z - A)</option>
                  <option value="date-desc">Mais recentes primeiro</option>
                  <option value="date-asc">Mais antigos primeiro</option>
                  <option value="size-desc">Tamanho (Maior primeiro)</option>
                  <option value="size-asc">Tamanho (Menor primeiro)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="settings-tab-panel">
              <p className="settings-tab-desc">
                Gerencie o armazenamento dos seus modelos 3D salvos localmente no navegador (IndexedDB).
              </p>

              <div className="storage-status-card">
                <div className="storage-status-icon">
                  <HardDrive size={24} />
                </div>
                <div className="storage-status-details">
                  <h3>Armazenamento Local Utilizado</h3>
                  <p className="storage-status-number">{storageUsed}</p>
                  <span>Os modelos e thumbnails ficam salvos exclusivamente neste navegador.</span>
                </div>
              </div>

              <div className="storage-actions-list">
                <div className="storage-action-item">
                  <div>
                    <strong>Regenerar Thumbnails Verticais</strong>
                    <p>Recria todas as capas dos modelos em alta resolução com o renderizador de retrato.</p>
                  </div>
                  <button
                    type="button"
                    className="action-outline-btn"
                    onClick={onRegenerateThumbnails}
                    disabled={isProcessing}
                  >
                    <RefreshCw size={14} className={isProcessing ? 'spin' : ''} />
                    <span>Regenerar</span>
                  </button>
                </div>

                <div className="storage-action-item">
                  <div>
                    <strong>Exportar Metadados do Catálogo</strong>
                    <p>Baixe um arquivo JSON com as bibliotecas, tags e informações dos modelos.</p>
                  </div>
                  <button type="button" className="action-outline-btn" onClick={onExportCatalog}>
                    <Download size={14} />
                    <span>Exportar JSON</span>
                  </button>
                </div>

                <div className="storage-action-item danger">
                  <div>
                    <strong>Limpar Todos os Dados Locais</strong>
                    <p>Remove todos os modelos, prateleiras e thumbnails deste navegador permanentemente.</p>
                  </div>
                  <button type="button" className="action-danger-btn" onClick={onClearAllData}>
                    <Trash2 size={14} />
                    <span>Limpar Tudo</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gdrive' && (
            <GoogleDriveTab
              globalSettings={localSettings}
              shelves={shelves}
              onDataRestored={onDataRestored}
            />
          )}
        </div>

        {/* Footer */}
        <div className="settings-modal-footer">
          <button type="button" className="settings-reset-btn" onClick={handleResetDefaults}>
            Restaurar Padrões
          </button>
          <div className="modal-footer-right">
            <button type="button" className="settings-cancel-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="settings-save-btn" onClick={handleSave}>
              Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
