import {
  Box,
  Copy,
  Download,
  FolderMinus,
  FolderPlus,
  Globe,
  Grid,
  Maximize2,
  Move,
  PanelRight,
  Plus,
  RotateCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import type { TransformMode, TransformSpace } from '../../domain/editorTypes'

export interface EditorToolbarProps {
  activeTransformMode: TransformMode
  onChangeTransformMode: (mode: TransformMode) => void
  transformSpace: TransformSpace
  onToggleTransformSpace: () => void
  snapToGrid: boolean
  onToggleSnapToGrid: () => void
  gridSize: number
  onChangeGridSize: (size: number) => void
  selectedCount: number
  canGroup: boolean
  canUngroup: boolean
  onGroupSelected: () => void
  onUngroupSelected: () => void
  onDuplicateSelected: () => void
  onDeleteSelected: () => void
  onOpenAddModal: () => void
  onExportGlb: () => void
  onSaveToLibrary: () => void
  onClose: () => void
  isExporting?: boolean
  showInspector?: boolean
  onToggleInspector?: () => void
}

export function EditorToolbar({
  activeTransformMode,
  onChangeTransformMode,
  transformSpace,
  onToggleTransformSpace,
  snapToGrid,
  onToggleSnapToGrid,
  gridSize,
  onChangeGridSize,
  selectedCount,
  canGroup,
  canUngroup,
  onGroupSelected,
  onUngroupSelected,
  onDuplicateSelected,
  onDeleteSelected,
  onOpenAddModal,
  onExportGlb,
  onSaveToLibrary,
  onClose,
  isExporting = false,
  showInspector = true,
  onToggleInspector,
}: EditorToolbarProps) {
  return (
    <header className="editor-top-toolbar">
      {/* Left: Transform Controls */}
      <div className="editor-toolbar-section">
        <div className="editor-toolbar-group" title="Ferramentas de Transformação">
          <button
            type="button"
            onClick={() => onChangeTransformMode('translate')}
            className={`editor-tool-btn ${activeTransformMode === 'translate' ? 'active' : ''}`}
            title="Mover objeto [G]"
          >
            <Move className="editor-icon" size={14} />
            <span>Mover</span>
            <kbd className="editor-kbd">G</kbd>
          </button>

          <button
            type="button"
            onClick={() => onChangeTransformMode('rotate')}
            className={`editor-tool-btn ${activeTransformMode === 'rotate' ? 'active' : ''}`}
            title="Rotacionar objeto [R]"
          >
            <RotateCw className="editor-icon" size={14} />
            <span>Rotacionar</span>
            <kbd className="editor-kbd">R</kbd>
          </button>

          <button
            type="button"
            onClick={() => onChangeTransformMode('scale')}
            className={`editor-tool-btn ${activeTransformMode === 'scale' ? 'active' : ''}`}
            title="Escalar objeto [S]"
          >
            <Maximize2 className="editor-icon" size={14} />
            <span>Escala</span>
            <kbd className="editor-kbd">S</kbd>
          </button>
        </div>

        <div className="editor-toolbar-divider" />

        {/* Space & Snap */}
        <div className="editor-toolbar-group">
          <button
            type="button"
            onClick={onToggleTransformSpace}
            className="editor-tool-btn"
            title={`Sistema de Coordenadas: ${transformSpace === 'world' ? 'Global (World)' : 'Local (Objeto)'}`}
          >
            {transformSpace === 'world' ? (
              <Globe className="editor-icon text-blue" size={14} />
            ) : (
              <Box className="editor-icon text-amber" size={14} />
            )}
            <span className="capitalize">{transformSpace === 'world' ? 'Global' : 'Local'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSnapToGrid}
            className={`editor-tool-btn ${snapToGrid ? 'active' : ''}`}
            title="Alinhar à Grade (Grid Snap)"
          >
            <Grid className="editor-icon" size={14} />
            <span>Snap</span>
          </button>

          {snapToGrid && (
            <select
              value={gridSize}
              onChange={(e) => onChangeGridSize(Number(e.target.value))}
              className="editor-toolbar-select"
              title="Tamanho do passo da grade"
            >
              <option value={0.1}>0.1m</option>
              <option value={0.25}>0.25m</option>
              <option value={0.5}>0.5m</option>
              <option value={1.0}>1.0m</option>
            </select>
          )}
        </div>
      </div>

      {/* Center: Add & Organization Actions */}
      <div className="editor-toolbar-section">
        <button
          type="button"
          onClick={onOpenAddModal}
          className="editor-tool-btn btn-primary"
          title="Adicionar modelo 3D da biblioteca ao cenário"
        >
          <Plus className="editor-icon" size={15} />
          <span>Adicionar Modelo</span>
        </button>

        <div className="editor-toolbar-group">
          <button
            type="button"
            onClick={onGroupSelected}
            disabled={!canGroup}
            className={`editor-tool-btn ${canGroup ? 'btn-warning' : ''}`}
            title="Agrupar objetos selecionados (mínimo 2 selecionados)"
          >
            <FolderPlus className="editor-icon" size={14} />
            <span>Agrupar</span>
          </button>

          {canUngroup && (
            <button
              type="button"
              onClick={onUngroupSelected}
              className="editor-tool-btn btn-warning"
              title="Desagrupar seleção"
            >
              <FolderMinus className="editor-icon" size={14} />
              <span>Desagrupar</span>
            </button>
          )}

          {selectedCount > 0 && (
            <>
              <button
                type="button"
                onClick={onDuplicateSelected}
                className="editor-tool-btn"
                title="Duplicar selecionados"
              >
                <Copy className="editor-icon" size={14} />
                <span>Duplicar</span>
              </button>

              <button
                type="button"
                onClick={onDeleteSelected}
                className="editor-tool-btn btn-danger"
                title="Remover selecionados [Delete]"
              >
                <Trash2 className="editor-icon" size={14} />
                <span>Excluir</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right: Export & Save & Close */}
      <div className="editor-toolbar-section">
        <div className="editor-toolbar-group">
          <button
            type="button"
            onClick={onExportGlb}
            disabled={isExporting}
            className="editor-tool-btn btn-outline"
            title="Baixar modelo GLB mesclado/composto"
          >
            <Download className="editor-icon text-blue" size={14} />
            <span>{isExporting ? 'Exportando...' : 'Exportar GLB'}</span>
          </button>

          <button
            type="button"
            onClick={onSaveToLibrary}
            disabled={isExporting}
            className="editor-tool-btn btn-indigo"
            title="Salvar modelo unificado na Biblioteca de Prateleiras"
          >
            <Save className="editor-icon" size={14} />
            <span>Salvar na Prateleira</span>
          </button>
        </div>

        {onToggleInspector && (
          <button
            type="button"
            onClick={onToggleInspector}
            className={`editor-tool-btn ${showInspector ? 'active' : ''}`}
            title={showInspector ? 'Ocultar Painel Lateral' : 'Exibir Painel Lateral'}
          >
            <PanelRight className="editor-icon" size={14} />
            <span className="editor-hide-mobile">{showInspector ? 'Painel' : 'Inspetor'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="editor-close-btn"
          title="Fechar Editor e Voltar à Biblioteca"
          aria-label="Fechar Editor"
        >
          <X size={16} />
        </button>
      </div>
    </header>
  )
}
