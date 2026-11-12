// Meshy.ai integration utilities
// Provides the same interface used by the previous Tripo3D service, but now targets
// the public Meshy.ai REST API (https://api.meshy.ai).
// The implementation follows the official Meshy documentation (see web search summary).

/** Storage key for the Meshy API token */
const MESHY_API_KEY_STORAGE = 'prateleira_meshy_api_key'
/** Base URL for Meshy.ai */
const MESHY_BASE = 'https://api.meshy.ai'

export interface MeshyTaskResult {
  /** Direct URL to the generated GLB model */
  modelUrl: string
  /** Optional thumbnail URL (if the API provides one) */
  thumbnailUrl?: string
}

/** ------------------------------------------------------------------
 *  API‑Key helpers (local storage – same pattern as Tripo service)
 * ------------------------------------------------------------------ */
export function getStoredMeshyApiKey(): string {
  return localStorage.getItem(MESHY_API_KEY_STORAGE)?.trim() || ''
}

export function saveStoredMeshyApiKey(apiKey: string): void {
  localStorage.setItem(MESHY_API_KEY_STORAGE, apiKey.trim())
}

/** ------------------------------------------------------------------
 *  Image upload helper
 * ------------------------------------------------------------------ */
// Meshy’s image‑to‑3D endpoint expects a publicly reachable URL. In a pure
// client‑side environment we cannot reliably host a file, therefore we expose a
// tiny helper that converts the image to a data‑URL. This works for the demo
// because Meshy accepts data URLs for the `image_url` field.
export async function uploadMeshyImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (e) => reject(e)
    reader.readAsDataURL(file)
  })
  return dataUrl // e.g. "data:image/png;base64,...."
}

/** ------------------------------------------------------------------
 *  Task creation – Text‑to‑3D (preview) and Image‑to‑3D
 * ------------------------------------------------------------------ */
export async function createTextToMeshyTask(
  prompt: string,
  apiKey: string,
  modelVersion = 'v3.1-20260211', // kept for compatibility – not used by Meshy
  options: { texture?: boolean; pbr?: boolean } = {}
): Promise<string> {
  const body = {
    mode: 'preview', // first step – generates geometry only
    prompt,
    ai_model: 'meshy-7.1',
    target_formats: ['glb'],
    // optional flags – Meshy accepts them but they are ignored in preview mode
    texture: options.texture ?? true,
    pbr: options.pbr ?? true,
  }
  const response = await fetch(`${MESHY_BASE}/openapi/v2/text-to-3d`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Meshy text‑to‑3D error (${response.status}): ${err}`)
  }
  const json = await response.json()
  const taskId = json?.result
  if (!taskId) {
    throw new Error('Meshy did not return a task id for text‑to‑3D.')
  }
  return taskId as string
}

export async function createImageToMeshyTask(
  imageUrl: string,
  apiKey: string,
  options: { texture?: boolean; pbr?: boolean } = {}
): Promise<string> {
  const body = {
    image_url: imageUrl,
    ai_model: 'meshy-7.1',
    target_formats: ['glb'],
    texture: options.texture ?? true,
    pbr: options.pbr ?? true,
  }
  const response = await fetch(`${MESHY_BASE}/openapi/v1/image-to-3d`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Meshy image‑to‑3D error (${response.status}): ${err}`)
  }
  const json = await response.json()
  const taskId = json?.result
  if (!taskId) {
    throw new Error('Meshy did not return a task id for image‑to‑3D.')
  }
  return taskId as string
}

/** ------------------------------------------------------------------
 *  Polling helper – repeatedly query the task status until it succeeds
 * ------------------------------------------------------------------ */
export async function pollMeshyTask(
  taskId: string,
  apiKey: string,
  onProgress?: (progress: number, statusText: string) => void,
  abortSignal?: AbortSignal
): Promise<MeshyTaskResult> {
  const maxAttempts = 180 // ~6 minutes (2 s interval)
  let attempts = 0
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

  while (attempts < maxAttempts) {
    if (abortSignal?.aborted) {
      throw new Error('Geração cancelada pelo usuário.')
    }

    const response = await fetch(`${MESHY_BASE}/openapi/v2/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey.trim()}` },
      signal: abortSignal,
    })
    if (!response.ok) {
      throw new Error(`Erro ao checar status da tarefa Meshy (${response.status})`)
    }
    const json = await response.json()
    const task = json?.result || json?.data || {}
    const status: string = task.status || task.state || 'unknown'
    const progress: number = typeof task.progress === 'number' ? task.progress : 0
    const statusDesc =
      status === 'queued'
        ? 'Na fila de processamento...'
        : status === 'running'
        ? 'Processando modelo 3D...'
        : status

    if (onProgress) onProgress(Math.max(0, Math.min(100, progress)), statusDesc

    if (status === 'succeeded' || status === 'completed') {
      const modelUrl = task.model_url || task.modelUrl || task.output?.model_url
      if (!modelUrl) {
        throw new Error('Meshy retornou sucesso, mas sem URL do modelo.')
      }
      const thumb = task.thumbnail_url || task.thumbnailUrl
      return { modelUrl, thumbnailUrl: thumb }
    }
    if (status === 'failed' || status === 'error') {
      const msg = task.error_message || task.message || 'Falha na geração Meshy.'
      throw new Error(msg)
    }

    attempts++
    await delay(2000)
  }
  throw new Error('Tempo limite ao aguardar tarefa Meshy.')
}

/** ------------------------------------------------------------------
 *  Download helper – fetch the GLB file and return a `File` object
 * ------------------------------------------------------------------ */
export async function downloadMeshyModel(url: string, fileName: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Falha ao baixar modelo Meshy (${response.status})`)
  }
  const blob = await response.blob()
  const ext = url.split('.').pop()?.toLowerCase() === 'glb' ? 'glb' : 'glb'
  return new File([blob], `${fileName}.${ext}`, { type: blob.type })
}

/** ------------------------------------------------------------------
 *  Exported helpers that keep the original Tripo naming for minimal UI change
 * ------------------------------------------------------------------ */
export const getStoredTripoApiKey = getStoredMeshyApiKey // alias for backward compatibility
export const saveStoredTripoApiKey = saveStoredMeshyApiKey
export const uploadTripoImage = uploadMeshyImage
export const createTextToModelTask = createTextToMeshyTask
export const createImageToModelTask = createImageToMeshyTask
export const pollTripoTask = pollMeshyTask
export const downloadModelAsFile = downloadMeshyModel
export type TripoTaskResult = MeshyTaskResult

