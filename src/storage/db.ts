import Dexie, { type EntityTable } from 'dexie'
import type { ModelAsset, SceneInstance, Shelf } from '../domain/types'

export interface StoredModel extends ModelAsset {
  file: Blob
  thumbnail?: Blob
}

class ShelfDatabase extends Dexie {
  models!: EntityTable<StoredModel, 'id'>
  shelves!: EntityTable<Shelf, 'id'>
  sceneInstances!: EntityTable<SceneInstance, 'id'>

  constructor() {
    super('shelf-3d')
    this.version(1).stores({
      models: 'id, shelfId, createdAt, *tags',
      shelves: 'id, createdAt',
    })
    this.version(2).stores({
      models: 'id, shelfId, createdAt, *tags',
      shelves: 'id, createdAt',
      sceneInstances: 'id, modelId',
    })
  }
}

export const shelfDatabase = new ShelfDatabase()
