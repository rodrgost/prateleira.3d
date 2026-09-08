export type TransformMode = 'translate' | 'rotate' | 'scale'
export type TransformSpace = 'world' | 'local'

export interface Vector3Tuple {
  x: number
  y: number
  z: number
}

export interface EditorItem {
  id: string
  modelAssetId?: string
  name: string
  url: string
  position: [number, number, number]
  rotation: [number, number, number] // in radians
  scale: [number, number, number]
  groupId?: string
  visible: boolean
  locked: boolean
}

export interface EditorGroup {
  id: string
  name: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  groupId?: string // nested grouping support
  visible: boolean
}

export interface EditorState {
  items: EditorItem[]
  groups: EditorGroup[]
  selectedIds: string[]
  activeTransformMode: TransformMode
  transformSpace: TransformSpace
  snapToGrid: boolean
  gridSize: number
}
