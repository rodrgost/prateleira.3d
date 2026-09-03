import { describe, expect, it } from 'vitest'
import { validateModelFile } from './fileValidation'

describe('validateModelFile', () => {
  it('accepts a GLB with the glTF binary signature', async () => {
    const file = new File([new Uint8Array([0x67, 0x6c, 0x54, 0x46])], 'chair.glb')
    await expect(validateModelFile(file)).resolves.toEqual({ valid: true, format: 'glb' })
  })

  it('rejects unsupported extensions', async () => {
    const file = new File(['model'], 'chair.obj')
    await expect(validateModelFile(file)).resolves.toMatchObject({ valid: false })
  })
})
