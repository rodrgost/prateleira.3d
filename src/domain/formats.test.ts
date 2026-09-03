import { describe, expect, it } from 'vitest'
import { supportedModelFormats } from './formats'

describe('supported model formats', () => {
  it('starts with the web-friendly GLB and glTF formats', () => {
    expect(supportedModelFormats).toEqual(['glb', 'gltf'])
  })
})
