import type { SceneInstance } from './types'

export const SHELF_ITEMS_PER_LEVEL = 4

const SHELF_ITEM_SPACING = 1.7
const SHELF_BOTTOM_LEVEL_Y = -1.25
export const SHELF_LEVEL_HEIGHT = 1.75
export const SHELF_ITEM_Z = 0.1

export function getShelfLevelCount(itemCount: number, itemsPerLevel = SHELF_ITEMS_PER_LEVEL) {
  if (itemCount === 0) return 1
  return Math.ceil(itemCount / itemsPerLevel)
}

export function getShelfItemPosition(index: number, itemCount: number, itemsPerLevel = SHELF_ITEMS_PER_LEVEL): [number, number, number] {
  const level = Math.floor(index / itemsPerLevel)
  const indexInLevel = index % itemsPerLevel
  const levelStart = level * itemsPerLevel
  const levelItemCount = Math.min(itemsPerLevel, itemCount - levelStart)
  const centeredIndex = indexInLevel - (levelItemCount - 1) / 2

  return [centeredIndex * SHELF_ITEM_SPACING, SHELF_BOTTOM_LEVEL_Y + level * SHELF_LEVEL_HEIGHT, SHELF_ITEM_Z]
}

export function layoutShelfInstances<T extends SceneInstance>(instances: T[], itemsPerLevel = SHELF_ITEMS_PER_LEVEL): T[] {
  return instances.map((instance, index) => ({
    ...instance,
    position: getShelfItemPosition(index, instances.length, itemsPerLevel),
  }))
}