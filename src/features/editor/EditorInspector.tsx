import {
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  Layers,
  Lock,
  RotateCcw,
  Unlock,
} from 'lucide-react'
import { useState } from 'react'
import type { EditorGroup, EditorItem } from '../../domain/editorTypes'

export interface EditorInspectorProps {
  items: EditorItem[]
  groups: EditorGroup[]
  selectedIds: string[]
  onSelectIds: (ids: string[]) => void
  onUpdateItem: (id: string, updates: Partial<EditorItem>) => void
  onUpdateGroup: (id: string, updates: Partial<EditorGroup>) => void
  onResetTransforms: (id: string) => void
}

export function EditorInspector({
  items,
  groups,
  selectedIds,
  onSelectIds,
  onUpdateItem,
  onUpdateGroup,
  onResetTransforms,
}: EditorInspectorProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  // Identify single selected item or group
  const singleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const selectedItem = items.find((i) => i.id === singleSelectedId)
  const selectedGroup = groups.find((g) => g.id === singleSelectedId)

  const radToDeg = (rad: number) => Math.round((rad * 180) / Math.PI)
  const degToRad = (deg: number) => (deg * Math.PI) / 180

  // Handle position change
  const handlePosChange = (axisIndex: 0 | 1 | 2, val: number) => {
    if (selectedItem) {
      const nextPos: [number, number, number] = [...selectedItem.position]
      nextPos[axisIndex] = val
      onUpdateItem(selectedItem.id, { position: nextPos })
    } else if (selectedGroup) {
      const nextPos: [number, number, number] = [...selectedGroup.position]
      nextPos[axisIndex] = val
      onUpdateGroup(selectedGroup.id, { position: nextPos })
    }
  }

  // Handle rotation change (degree input)
  const handleRotChange = (axisIndex: 0 | 1 | 2, degVal: number) => {
    const radVal = degToRad(degVal)
    if (selectedItem) {
      const nextRot: [number, number, number] = [...selectedItem.rotation]
      nextRot[axisIndex] = radVal
      onUpdateItem(selectedItem.id, { rotation: nextRot })
    } else if (selectedGroup) {
      const nextRot: [number, number, number] = [...selectedGroup.rotation]
      nextRot[axisIndex] = radVal
      onUpdateGroup(selectedGroup.id, { rotation: nextRot })
    }
  }

  // Handle scale change
  const handleScaleChange = (axisIndex: 0 | 1 | 2, val: number) => {
    if (val <= 0.001) val = 0.001
    if (selectedItem) {
      const nextScale: [number, number, number] = [...selectedItem.scale]
      nextScale[axisIndex] = val
      onUpdateItem(selectedItem.id, { scale: nextScale })
    } else if (selectedGroup) {
      const nextScale: [number, number, number] = [...selectedGroup.scale]
      nextScale[axisIndex] = val
      onUpdateGroup(selectedGroup.id, { scale: nextScale })
    }
  }

  // Items directly under root (not in any group)
  const rootItems = items.filter((i) => !i.groupId)
  const rootGroups = groups.filter((g) => !g.groupId)

  return (
    <aside className="editor-inspector-root">
      {/* Sidebar Header */}
      <div className="editor-inspector-header">
        <div className="editor-inspector-title">
          <Layers className="editor-icon text-blue" size={16} />
          <span>Inspetor 3D & Hierarquia</span>
        </div>
        <span className="editor-inspector-badge">
          {items.length} {items.length === 1 ? 'objeto' : 'objetos'}
        </span>
      </div>

      {/* Scene Tree (Árvore de Objetos e Grupos) */}
      <div className="editor-tree-container">
        <div className="editor-tree-heading">Cenário 3D</div>

        {/* Groups & nested items */}
        {rootGroups.map((group) => {
          const groupChildItems = items.filter((i) => i.groupId === group.id)
          const isSelected = selectedIds.includes(group.id)
          const isCollapsed = collapsedGroups[group.id]

          return (
            <div key={group.id} className="editor-group-wrapper">
              <div
                onClick={() => onSelectIds([group.id])}
                className={`editor-tree-row group-row ${isSelected ? 'selected' : ''}`}
              >
                <div className="editor-tree-label-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleGroupCollapse(group.id)
                    }}
                    className="editor-tree-icon-btn"
                  >
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isCollapsed ? (
                    <Folder className="editor-icon text-amber" size={14} />
                  ) : (
                    <FolderOpen className="editor-icon text-amber" size={14} />
                  )}
                  <span className="editor-tree-name">{group.name}</span>
                </div>

                <div className="editor-tree-actions">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUpdateGroup(group.id, { visible: !group.visible })
                    }}
                    className="editor-tree-icon-btn"
                    title={group.visible ? 'Ocultar grupo' : 'Exibir grupo'}
                  >
                    {group.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-rose" />}
                  </button>
                </div>
              </div>

              {/* Group Children */}
              {!isCollapsed && (
                <div className="editor-tree-children">
                  {groupChildItems.map((item) => {
                    const isChildSelected = selectedIds.includes(item.id)
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectIds([item.id])}
                        className={`editor-tree-row child-row ${isChildSelected ? 'selected' : ''}`}
                      >
                        <div className="editor-tree-label-wrap">
                          <Box className="editor-icon text-blue" size={14} />
                          <span className="editor-tree-name">{item.name}</span>
                        </div>
                        <div className="editor-tree-actions">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onUpdateItem(item.id, { visible: !item.visible })
                            }}
                            className="editor-tree-icon-btn"
                            title={item.visible ? 'Ocultar objeto' : 'Exibir objeto'}
                          >
                            {item.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-rose" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onUpdateItem(item.id, { locked: !item.locked })
                            }}
                            className="editor-tree-icon-btn"
                            title={item.locked ? 'Destravar objeto' : 'Travar objeto'}
                          >
                            {item.locked ? <Lock size={13} className="text-amber" /> : <Unlock size={13} />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Ungrouped Root Items */}
        {rootItems.map((item) => {
          const isSelected = selectedIds.includes(item.id)
          return (
            <div
              key={item.id}
              onClick={() => onSelectIds([item.id])}
              className={`editor-tree-row root-item ${isSelected ? 'selected' : ''}`}
            >
              <div className="editor-tree-label-wrap">
                <Box className="editor-icon text-blue" size={14} />
                <span className="editor-tree-name">{item.name}</span>
              </div>
              <div className="editor-tree-actions">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateItem(item.id, { visible: !item.visible })
                  }}
                  className="editor-tree-icon-btn"
                  title={item.visible ? 'Ocultar objeto' : 'Exibir objeto'}
                >
                  {item.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-rose" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateItem(item.id, { locked: !item.locked })
                  }}
                  className="editor-tree-icon-btn"
                  title={item.locked ? 'Destravar objeto' : 'Travar objeto'}
                >
                  {item.locked ? <Lock size={13} className="text-amber" /> : <Unlock size={13} />}
                </button>
              </div>
            </div>
          )
        })}

        {items.length === 0 && (
          <div className="editor-empty-tree">
            Nenhum objeto no cenário.<br />Clique em "Adicionar" para incluir modelos 3D.
          </div>
        )}
      </div>

      {/* Numeric Inspector Controls */}
      <div className="editor-transform-panel">
        <div className="editor-transform-header">
          <span>Transformação</span>
          {singleSelectedId && (
            <button
              type="button"
              onClick={() => onResetTransforms(singleSelectedId)}
              className="editor-reset-btn"
              title="Resetar Posição, Rotação e Escala"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>

        {selectedItem || selectedGroup ? (
          <div className="editor-transform-fields">
            {/* Object Title */}
            <div className="editor-selected-title">
              {selectedGroup ? (
                <>
                  <Folder className="editor-icon text-amber" size={14} />
                  <span>{selectedGroup.name}</span>
                </>
              ) : (
                <>
                  <Box className="editor-icon text-blue" size={14} />
                  <span>{selectedItem?.name}</span>
                </>
              )}
            </div>

            {/* Position (X, Y, Z) */}
            <div className="editor-control-field">
              <label className="editor-control-label">Posição (m)</label>
              <div className="editor-axis-grid">
                {(['x', 'y', 'z'] as const).map((axis, i) => {
                  const val = selectedItem ? selectedItem.position[i] : selectedGroup!.position[i]
                  return (
                    <div key={axis} className="editor-axis-input-box">
                      <span className="editor-axis-tag axis-x">{axis}</span>
                      <input
                        type="number"
                        step="0.05"
                        value={Number(val.toFixed(3))}
                        onChange={(e) => handlePosChange(i as any, Number(e.target.value))}
                        className="editor-axis-input"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rotation (X, Y, Z in degrees) */}
            <div className="editor-control-field">
              <label className="editor-control-label">Rotação (° Graus)</label>
              <div className="editor-axis-grid">
                {(['x', 'y', 'z'] as const).map((axis, i) => {
                  const radVal = selectedItem ? selectedItem.rotation[i] : selectedGroup!.rotation[i]
                  const degVal = radToDeg(radVal)
                  return (
                    <div key={axis} className="editor-axis-input-box">
                      <span className="editor-axis-tag axis-y">{axis}</span>
                      <input
                        type="number"
                        step="5"
                        value={degVal}
                        onChange={(e) => handleRotChange(i as any, Number(e.target.value))}
                        className="editor-axis-input"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Scale (X, Y, Z) */}
            <div className="editor-control-field">
              <label className="editor-control-label">Escala</label>
              <div className="editor-axis-grid">
                {(['x', 'y', 'z'] as const).map((axis, i) => {
                  const val = selectedItem ? selectedItem.scale[i] : selectedGroup!.scale[i]
                  return (
                    <div key={axis} className="editor-axis-input-box">
                      <span className="editor-axis-tag axis-z">{axis}</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.01"
                        value={Number(val.toFixed(2))}
                        onChange={(e) => handleScaleChange(i as any, Number(e.target.value))}
                        className="editor-axis-input"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : selectedIds.length > 1 ? (
          <div className="editor-hint-box multi-selected">
            {selectedIds.length} objetos selecionados.<br />Clique em "Agrupar" no topo para combiná-los.
          </div>
        ) : (
          <div className="editor-hint-box empty">
            Selecione um objeto no canvas 3D ou na lista para ajustar transformações.
          </div>
        )}
      </div>
    </aside>
  )
}
