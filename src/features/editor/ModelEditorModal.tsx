import { Download, Plus, Search, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Object3D } from 'three'
import type { EditorGroup, EditorItem, TransformMode, TransformSpace } from '../../domain/editorTypes'

import type { ModelAsset } from '../../domain/types'
import { exportSceneToGlb } from '../../domain/sceneExporter'
import { EditorCanvas } from './EditorCanvas'
import { EditorInspector } from './EditorInspector'
import { EditorToolbar } from './EditorToolbar'

export interface ModelEditorModalProps {
  availableModels: ModelAsset[]
  getModelUrl: (asset: ModelAsset) => Promise<string>
  onClose: () => void
  onSaveToLibrary: (file: File) => Promise<void>
}

export function ModelEditorModal({
  availableModels,
  getModelUrl,
  onClose,
  onSaveToLibrary,
}: ModelEditorModalProps) {
  const [items, setItems] = useState<EditorItem[]>([])
  const [groups, setGroups] = useState<EditorGroup[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [activeTransformMode, setActiveTransformMode] = useState<TransformMode>('translate')
  const [transformSpace, setTransformSpace] = useState<TransformSpace>('world')
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [gridSize, setGridSize] = useState(0.25)

  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const exportRootRef = useRef<Object3D | null>(null)

  const handleRegisterExportRoot = useCallback((root: Object3D | null) => {
    exportRootRef.current = root
  }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return

      if (e.key === 'g' || e.key === 'G') {
        setActiveTransformMode('translate')
      } else if (e.key === 'r' || e.key === 'R') {
        setActiveTransformMode('rotate')
      } else if (e.key === 's' || e.key === 'S') {
        setActiveTransformMode('scale')
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          handleDeleteSelected()
        }
      } else if (e.key === 'Escape') {
        setSelectedIds([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds])

  // Select items / groups
  const handleSelectIds = (ids: string[], multiSelect = false) => {
    if (multiSelect) {
      setSelectedIds((prev) => {
        const next = [...prev]
        ids.forEach((id) => {
          if (next.includes(id)) {
            const idx = next.indexOf(id)
            next.splice(idx, 1)
          } else {
            next.push(id)
          }
        })
        return next
      })
    } else {
      setSelectedIds(ids)
    }
  }

  // Update Item Position/Rotation/Scale
  const handleUpdateItemTransform = (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, position, rotation, scale } : item))
    )
  }

  // Update Group Position/Rotation/Scale
  const handleUpdateGroupTransform = (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => {
    setGroups((prev) =>
      prev.map((group) => (group.id === id ? { ...group, position, rotation, scale } : group))
    )
  }

  // Partial Update Item
  const handleUpdateItem = (id: string, updates: Partial<EditorItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
  }

  // Partial Update Group
  const handleUpdateGroup = (id: string, updates: Partial<EditorGroup>) => {
    setGroups((prev) => prev.map((group) => (group.id === id ? { ...group, ...updates } : group)))
  }

  // Reset transforms
  const handleResetTransforms = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } : item
      )
    )
    setGroups((prev) =>
      prev.map((group) =>
        group.id === id ? { ...group, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } : group
      )
    )
  }

  // Add model from library
  const handleAddModelFromLibrary = async (asset: ModelAsset) => {
    try {
      const url = await getModelUrl(asset)
      const newItem: EditorItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        modelAssetId: asset.id,
        name: asset.name,
        url,
        position: [(items.length % 3) * 0.8, 0, Math.floor(items.length / 3) * 0.8],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        visible: true,
        locked: false,
      }
      setItems((prev) => [...prev, newItem])
      setSelectedIds([newItem.id])
      setShowAddModal(false)
      showToast(`" ${asset.name} " adicionado ao cenário 3D`)
    } catch (err) {
      console.error(err)
      showToast('Erro ao carregar modelo 3D')
    }
  }

  // Group Selected
  const handleGroupSelected = () => {
    if (selectedIds.length < 2) return

    const newGroupId = `group-${Date.now()}`
    const newGroup: EditorGroup = {
      id: newGroupId,
      name: `Grupo ${groups.length + 1}`,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
    }

    setGroups((prev) => [...prev, newGroup])

    // Assign selected items to this new group
    setItems((prev) =>
      prev.map((item) => (selectedIds.includes(item.id) ? { ...item, groupId: newGroupId } : item))
    )

    // Assign selected sub-groups to this new group
    setGroups((prev) =>
      prev.map((g) => (selectedIds.includes(g.id) && g.id !== newGroupId ? { ...g, groupId: newGroupId } : g))
    )

    setSelectedIds([newGroupId])
    showToast(`Criado ${newGroup.name} com ${selectedIds.length} elementos`)
  }

  // Ungroup Selected
  const handleUngroupSelected = () => {
    const groupToUngroup = groups.find((g) => selectedIds.includes(g.id))
    if (!groupToUngroup) return

    // Remove group from state
    setGroups((prev) => prev.filter((g) => g.id !== groupToUngroup.id))

    // Unassign child items
    setItems((prev) =>
      prev.map((item) => (item.groupId === groupToUngroup.id ? { ...item, groupId: undefined } : item))
    )

    setSelectedIds([])
    showToast(`Desagrupado: ${groupToUngroup.name}`)
  }

  // Duplicate Selected
  const handleDuplicateSelected = () => {
    const selectedItems = items.filter((i) => selectedIds.includes(i.id))
    const newClonedItems: EditorItem[] = selectedItems.map((item) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `${item.name} (cópia)`,
      position: [item.position[0] + 0.4, item.position[1], item.position[2] + 0.4],
    }))

    if (newClonedItems.length > 0) {
      setItems((prev) => [...prev, ...newClonedItems])
      setSelectedIds(newClonedItems.map((i) => i.id))
      showToast(`Duplicado ${newClonedItems.length} objeto(s)`)
    }
  }

  // Delete Selected
  const handleDeleteSelected = () => {
    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)))
    setGroups((prev) => prev.filter((group) => !selectedIds.includes(group.id)))
    setSelectedIds([])
    showToast('Objeto(s) removido(s)')
  }

  // Export GLB
  const handleExportGlb = async () => {
    if (!exportRootRef.current) {
      showToast('Aguarde a renderização do cenário 3D...')
      return
    }

    try {
      setIsExporting(true)
      const file = await exportSceneToGlb(exportRootRef.current, 'composicao-3d.glb')
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
      showToast('Download do arquivo GLB iniciado!')
    } catch (err) {
      console.error(err)
      showToast('Falha ao exportar modelo GLB')
    } finally {
      setIsExporting(false)
    }
  }

  // Save to Library
  const handleSaveToLibrary = async () => {
    if (!exportRootRef.current) {
      showToast('Aguarde a renderização do cenário 3D...')
      return
    }

    try {
      setIsExporting(true)
      const filename = `Composição 3D - ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.glb`
      const file = await exportSceneToGlb(exportRootRef.current, filename)
      await onSaveToLibrary(file)
      showToast('Modelo unificado salvo com sucesso na biblioteca!')
    } catch (err) {
      console.error(err)
      showToast('Falha ao salvar modelo na biblioteca')
    } finally {
      setIsExporting(false)
    }
  }

  const canGroup = selectedIds.length >= 2
  const canUngroup = groups.some((g) => selectedIds.includes(g.id))

  const filteredLibraryModels = availableModels.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="editor-page-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="editor-toast">
          <Sparkles size={16} className="text-blue" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Header Toolbar */}
      <EditorToolbar
        activeTransformMode={activeTransformMode}
        onChangeTransformMode={setActiveTransformMode}
        transformSpace={transformSpace}
        onToggleTransformSpace={() => setTransformSpace((prev) => (prev === 'world' ? 'local' : 'world'))}
        snapToGrid={snapToGrid}
        onToggleSnapToGrid={() => setSnapToGrid((prev) => !prev)}
        gridSize={gridSize}
        onChangeGridSize={setGridSize}
        selectedCount={selectedIds.length}
        canGroup={canGroup}
        canUngroup={canUngroup}
        onGroupSelected={handleGroupSelected}
        onUngroupSelected={handleUngroupSelected}
        onDuplicateSelected={handleDuplicateSelected}
        onDeleteSelected={handleDeleteSelected}
        onOpenAddModal={() => setShowAddModal(true)}
        onExportGlb={handleExportGlb}
        onSaveToLibrary={handleSaveToLibrary}
        onClose={onClose}
        isExporting={isExporting}
      />

      {/* Main Content Area */}
      <div className="editor-main-area">
        {/* 3D Canvas Viewport */}
        <div className="editor-canvas-container">
          <EditorCanvas
            items={items}
            groups={groups}
            selectedIds={selectedIds}
            activeTransformMode={activeTransformMode}
            transformSpace={transformSpace}
            snapToGrid={snapToGrid}
            gridSize={gridSize}
            onSelectIds={handleSelectIds}
            onUpdateItemTransform={handleUpdateItemTransform}
            onUpdateGroupTransform={handleUpdateGroupTransform}
            onRegisterExportRoot={handleRegisterExportRoot}
          />
        </div>

        {/* Right Sidebar Inspector */}
        <EditorInspector
          items={items}
          groups={groups}
          selectedIds={selectedIds}
          onSelectIds={setSelectedIds}
          onUpdateItem={handleUpdateItem}
          onUpdateGroup={handleUpdateGroup}
          onResetTransforms={handleResetTransforms}
        />
      </div>

      {/* Add Model from Library Sub-Modal */}
      {showAddModal && (
        <div className="editor-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="editor-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="editor-modal-header">
              <h3 className="editor-modal-title">
                <Plus size={16} className="text-emerald" />
                <span>Adicionar Modelo 3D da Biblioteca</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="editor-tree-icon-btn"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="editor-modal-search">
              <Search size={15} className="editor-search-icon" />
              <input
                type="text"
                placeholder="Pesquisar modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="editor-search-input"
              />
            </div>

            <div className="editor-models-grid">
              {filteredLibraryModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleAddModelFromLibrary(model)}
                  className="editor-model-card-btn"
                >
                  {model.thumbnailUrl ? (
                    <img
                      src={model.thumbnailUrl}
                      alt={model.name}
                      className="editor-model-thumb"
                    />
                  ) : (
                    <div className="editor-model-thumb-placeholder">
                      3D
                    </div>
                  )}
                  <span className="editor-model-name">
                    {model.name}
                  </span>
                </button>
              ))}

              {filteredLibraryModels.length === 0 && (
                <div className="editor-empty-grid">
                  Nenhum modelo encontrado na biblioteca.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
