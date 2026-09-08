export type ModelFormat = 'glb' | 'gltf'

export type GroundType = 'grid' | 'shadow' | 'pedestal' | 'checker' | 'radial' | 'none'
export type LightingPreset = 'studio' | 'dramatic' | 'warm' | 'soft'

export interface ShelfViewerSettings {
  backgroundColor?: string
  showGround?: boolean
  groundType?: GroundType
  groundColor?: string
  autoRotate?: boolean
  autoRotateSpeed?: number
  lighting?: LightingPreset
}

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

export interface SceneInstance {
  id: string
  modelId: string
  position: [number, number, number]
  scale: number
}

export interface Shelf {
  id: string
  name: string
  modelIds: string[]
  createdAt: string
  itemsPerLevel?: number
  settings?: ShelfViewerSettings
}

export type SortOption =
  | 'custom'
  | 'name-asc'
  | 'name-desc'
  | 'date-desc'
  | 'date-asc'
  | 'size-desc'
  | 'size-asc'

export interface GlobalSettings {
  theme: 'light' | 'dark'
  defaultViewMode: 'showcase' | 'compact'
  defaultSortBy?: SortOption
  viewer: ShelfViewerSettings
}
