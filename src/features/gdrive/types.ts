import type { GlobalSettings, ModelAsset, Shelf } from '../../domain/types'

export interface GDriveUser {
  name?: string
  email?: string
  picture?: string
}

export interface GDriveFileMeta {
  id: string
  name: string
  mimeType: string
  size?: string
  modifiedTime?: string
  webViewLink?: string
}

export interface GDriveSyncProgress {
  phase: 'idle' | 'auth' | 'folder' | 'config' | 'uploading' | 'downloading' | 'complete' | 'error'
  current: number
  total: number
  detail: string
  error?: string
}

export interface GDriveBackupConfig {
  version: number
  exportedAt: string
  globalSettings: GlobalSettings
  shelves: Shelf[]
  models: ModelAsset[]
}

export interface GDriveStatus {
  isConnected: boolean
  clientId: string
  user: GDriveUser | null
  lastBackupAt: string | null
  appFolderId: string | null
  appFolderUrl: string | null
}
