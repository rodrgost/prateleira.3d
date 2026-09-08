import {
  CircleDot,
  Compass,
  Grid,
  Layers,
  Lightbulb,
  Maximize2,
  Palette,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { GroundType, LightingPreset, Shelf, ShelfViewerSettings } from '../../domain/types'

interface ShelfSettingsBarProps {
  shelf: Shelf | undefined
  isAllShelf: boolean
  isProcessing?: boolean
  globalViewerSettings?: ShelfViewerSettings
  onUpdateSettings: (settings: ShelfViewerSettings) => void
  onResetToGlobal: () => void
  onRegenerateShelfThumbnails?: (currentSettings?: ShelfViewerSettings) => Promise<void> | void
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
  { type: 'grid', label: 'Grade 3D', desc: 'Linhas infinitas de perspectiva' },
  { type: 'shadow', label: 'Sombra Suave', desc: 'Oclusão de contato realista' },
  { type: 'pedestal', label: 'Pedestal 3D', desc: 'Podium chanfrado de vitrine' },
  { type: 'checker', label: 'Tabuleiro', desc: 'Piso xadrez de estúdio' },
  { type: 'radial', label: 'Disco Radial', desc: 'Anéis concêntricos' },
]

const LIGHTING_PRESETS: { preset: LightingPreset; label: string }[] = [
  { preset: 'studio', label: 'Estúdio' },
  { preset: 'dramatic', label: 'Dramática' },
  { preset: 'warm', label: 'Quente' },
  { preset: 'soft', label: 'Suave' },
]

const GROUND_COLOR_PRESETS = ['#4f627d', '#38bdf8', '#818cf8', '#34d399', '#f59e0b', '#94a3b8', '#ffffff', '#222226']

export function ShelfSettingsBar({
  shelf,
  isAllShelf,
  isProcessing = false,
  globalViewerSettings,
  onUpdateSettings,
  onResetToGlobal,
  onRegenerateShelfThumbnails,
}: ShelfSettingsBarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const settings: ShelfViewerSettings = isAllShelf
    ? (globalViewerSettings || {})
    : (shelf?.settings || {})

  const hasCustomSettings = isAllShelf
    ? false
    : Boolean(
        settings.backgroundColor ||
          settings.showGround !== undefined ||
          settings.groundType ||
          settings.groundColor ||
          settings.autoRotate !== undefined ||
          settings.autoRotateSpeed !== undefined ||
          settings.lighting
      )

  const currentBg = settings.backgroundColor || '#141519'
  const isGroundActive = settings.showGround ?? true
  const currentGroundType: GroundType = settings.groundType || 'grid'
  const currentGroundColor = settings.groundColor || '#4f627d'
  const isAutoRotate = settings.autoRotate ?? false
  const currentSpeed = settings.autoRotateSpeed ?? 2.0
  const currentLighting: LightingPreset = settings.lighting || 'studio'

  const update = (partial: Partial<ShelfViewerSettings>) => {
    onUpdateSettings({
      ...settings,
      ...partial,
    })
  }

  return (
    <div className="shelf-settings-container">
      <div className="shelf-settings-trigger-row">
        <button
          type="button"
          className={`shelf-settings-toggle-btn ${isOpen ? 'open' : ''} ${hasCustomSettings ? 'customized' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Configurações de visualização 3D desta biblioteca"
        >
          <SlidersHorizontal size={14} />
          <span>
            {isAllShelf ? 'Ambiente 3D Geral' : `Ambiente 3D · ${shelf?.name || 'Biblioteca'}`}
          </span>
          {hasCustomSettings && <span className="settings-active-badge">personalizado</span>}
          <div
            className="settings-bg-preview-dot"
            style={{ backgroundColor: currentBg }}
            title={`Fundo: ${currentBg}`}
          />
        </button>

        {hasCustomSettings && (
          <button
            type="button"
            className="shelf-settings-reset-link"
            onClick={onResetToGlobal}
            title="Restaurar para as configurações globais padrão"
          >
            Usar padrão global
          </button>
        )}
      </div>

      {isOpen && (
        <div className="shelf-settings-panel">
          <div className="shelf-settings-panel-head">
            <div className="panel-title-group">
              <Sparkles size={16} />
              <h3>Personalizar Visualização 3D ({isAllShelf ? 'Sem Biblioteca' : shelf?.name})</h3>
            </div>
            <button
              type="button"
              className="panel-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar painel"
            >
              <X size={15} />
            </button>
          </div>

          <div className="shelf-settings-grid">
            {/* 1. Cor de Fundo */}
            <div className="settings-block">
              <label className="settings-label">
                <Palette size={14} />
                <span>Cor de Fundo 3D</span>
              </label>
              <div className="color-swatches-row">
                {BG_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    className={`color-swatch-btn ${currentBg.toLowerCase() === preset.color.toLowerCase() ? 'active' : ''}`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                    onClick={() => update({ backgroundColor: preset.color })}
                  />
                ))}
                <label className="custom-color-picker" title="Escolher cor personalizada">
                  <input
                    type="color"
                    value={currentBg}
                    onChange={(e) => update({ backgroundColor: e.target.value })}
                  />
                  <span>Personalizada</span>
                </label>
              </div>
            </div>

            {/* 2. Chão e Modelo de Chão */}
            <div className="settings-block full-width">
              <div className="settings-header-toggle">
                <label className="settings-label">
                  <Layers size={14} />
                  <span>Chão no Modelo 3D</span>
                </label>
                <button
                  type="button"
                  className={`settings-switch ${isGroundActive ? 'on' : 'off'}`}
                  onClick={() => update({ showGround: !isGroundActive })}
                >
                  <span className="switch-knob" />
                  <span className="switch-text">{isGroundActive ? 'Habilitado' : 'Desabilitado'}</span>
                </button>
              </div>

              {isGroundActive && (
                <div className="ground-types-grid">
                  {GROUND_TYPES.map((g) => (
                    <button
                      key={g.type}
                      type="button"
                      className={`ground-type-card ${currentGroundType === g.type ? 'active' : ''}`}
                      onClick={() => update({ groundType: g.type })}
                    >
                      <div className="ground-icon-wrap">
                        {g.type === 'grid' && <Grid size={18} />}
                        {g.type === 'shadow' && <CircleDot size={18} />}
                        {g.type === 'pedestal' && <Layers size={18} />}
                        {g.type === 'checker' && <Maximize2 size={18} />}
                        {g.type === 'radial' && <Compass size={18} />}
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

            {/* 3. Cor do Chão / Grade */}
            {isGroundActive && currentGroundType !== 'shadow' && (
              <div className="settings-block">
                <label className="settings-label">
                  <Palette size={14} />
                  <span>Cor do Chão / Grade</span>
                </label>
                <div className="color-swatches-row">
                  {GROUND_COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-swatch-btn ${currentGroundColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => update({ groundColor: color })}
                    />
                  ))}
                  <label className="custom-color-picker" title="Cor personalizada da grade/piso">
                    <input
                      type="color"
                      value={currentGroundColor}
                      onChange={(e) => update({ groundColor: e.target.value })}
                    />
                    <span>Custom</span>
                  </label>
                </div>
              </div>
            )}

            {/* 4. Iluminação */}
            <div className="settings-block">
              <label className="settings-label">
                <Sun size={14} />
                <span>Iluminação 3D</span>
              </label>
              <div className="lighting-pills">
                {LIGHTING_PRESETS.map((lp) => (
                  <button
                    key={lp.preset}
                    type="button"
                    className={`lighting-pill ${currentLighting === lp.preset ? 'active' : ''}`}
                    onClick={() => update({ lighting: lp.preset })}
                  >
                    {lp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Auto-rotação & Velocidade */}
            <div className="settings-block">
              <label className="settings-label">
                <RotateCw size={14} />
                <span>Auto-rotação no Visualizador</span>
              </label>
              <div className="settings-rotation-controls">
                <button
                  type="button"
                  className={`settings-switch ${isAutoRotate ? 'on' : 'off'}`}
                  onClick={() => update({ autoRotate: !isAutoRotate })}
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
                      onChange={(e) => update({ autoRotateSpeed: parseFloat(e.target.value) })}
                      className="speed-slider"
                      aria-label="Velocidade de rotação"
                    />
                  </div>
                  <div className="speed-presets">
                    {[0.5, 1.0, 2.0, 4.0, 8.0, 12.0, 16.0, 24.0].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        className={`speed-preset-btn ${currentSpeed === spd ? 'active' : ''}`}
                        onClick={() => update({ autoRotateSpeed: spd })}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action to re-render thumbnails with this shelf's 3D settings */}
          {onRegenerateShelfThumbnails && (
            <div className="shelf-settings-footer-actions">
              <button
                type="button"
                className="shelf-regen-thumbnails-btn"
                onClick={() => onRegenerateShelfThumbnails(settings)}
                disabled={isProcessing}
                title="Regenerar as thumbnails dos modelos desta biblioteca aplicando o fundo e chão escolhidos"
              >
                <RefreshCw size={14} className={isProcessing ? 'spin' : ''} />
                <span>
                  {isAllShelf
                    ? 'Aplicar este ambiente nas thumbnails gerais'
                    : 'Aplicar este ambiente nas thumbnails da biblioteca'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
