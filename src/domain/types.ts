export type ModelFormat = 'glb' | 'gltf'

export interface ModelAsset {
  id: string
  name: string
  format: ModelFormat
  sizeBytes: number
  shelfId?: string
  tags: string[]
  createdAt: string
  thumbnailUrl?: string
}

export interface Shelf {
  id: string
  name: string
  modelIds: string[]
  itemsPerLevel?: number
  createdAt: string
}

export interface SceneInstance {
  id: string
  modelId: string
  position: [number, number, number]
  scale: number
}
