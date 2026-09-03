import { supportedModelFormats } from './formats'
import type { ModelFormat } from './types'

const MAX_FILE_SIZE = 250 * 1024 * 1024

export type FileValidationResult =
  | { valid: true; format: ModelFormat }
  | { valid: false; message: string }

export async function validateModelFile(file: File): Promise<FileValidationResult> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !supportedModelFormats.includes(extension as ModelFormat)) {
    return { valid: false, message: 'Use um arquivo GLB ou glTF.' }
  }
  if (file.size === 0) {
    return { valid: false, message: 'O arquivo está vazio.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: 'O arquivo ultrapassa o limite de 250 MB.' }
  }

  if (extension === 'glb') {
    const header = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    const signature = String.fromCharCode(...header)
    if (signature !== 'glTF') {
      return { valid: false, message: 'Este arquivo não parece ser um GLB válido.' }
    }
  } else {
    try {
      const document = JSON.parse(await file.text()) as { asset?: { version?: string } }
      if (document.asset?.version !== '2.0') {
        return { valid: false, message: 'O arquivo glTF precisa usar a versão 2.0.' }
      }
    } catch {
      return { valid: false, message: 'Não foi possível ler o JSON do arquivo glTF.' }
    }
  }

  return { valid: true, format: extension as ModelFormat }
}
