import { describe, expect, it } from 'vitest'
import { getShelfItemPosition, getShelfLevelCount, layoutShelfInstances } from './shelfLayout'
import type { SceneInstance } from './types'

describe('shelf layout', () => {
  it('centers a single item on its level', () => {
    expect(getShelfItemPosition(0, 1)).toEqual([0, -1.35, 0.3])
  })

  it('splits two items around the center of the same level', () => {
    expect(getShelfItemPosition(0, 2)).toEqual([-0.85, -1.35, 0.3])
    expect(getShelfItemPosition(1, 2)).toEqual([0.85, -1.35, 0.3])
  })

  it('starts and centers a new level after the configured capacity', () => {
    expect(getShelfLevelCount(5, 4)).toBe(2)
    expect(getShelfItemPosition(4, 5, 4)).toEqual([0, 0.4, 0.3])
  })

  it('keeps every level centered when applying the layout to instances', () => {
    const instances: SceneInstance[] = Array.from({ length: 6 }, (_, index) => ({
      id: String(index),
      modelId: `model-${index}`,
      position: [99, 99, 99],
      scale: 0.72,
    }))

    expect(layoutShelfInstances(instances, 4).map((instance) => instance.position)).toEqual([
      [-2.55, -1.35, 0.3],
      [-0.85, -1.35, 0.3],
      [0.85, -1.35, 0.3],
      [2.55, -1.35, 0.3],
      [-0.85, 0.4, 0.3],
      [0.85, 0.4, 0.3],
    ])
  })
})