const TRIPO_API_KEY_STORAGE = 'prateleira_tripo_api_key'
const BASE_V3 = '/api/tripo'
const BASE_V2 = '/api/tripo-v2'

export interface TripoTaskResult {
  modelUrl: string
  thumbnailUrl?: string
}

export function getStoredTripoApiKey(): string {
  return localStorage.getItem(TRIPO_API_KEY_STORAGE)?.trim() || ''
}

export function saveStoredTripoApiKey(apiKey: string): void {
  localStorage.setItem(TRIPO_API_KEY_STORAGE, apiKey.trim())
}

/**
 * Upload an image file to Tripo3D API and return an image/file token
 */
export async function uploadTripoImage(file: File, apiKey: string): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  // 1. Try official v3 files endpoint
  let response = await fetch(`${BASE_V3}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: formData,
  })

  // 2. Fallback to /upload or /v2 if 404
  if (response.status === 404) {
    const formDataV3 = new FormData()
    formDataV3.append('file', file)
    response = await fetch(`${BASE_V3}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: formDataV3,
    })
  }

  if (response.status === 404) {
    const formDataV2 = new FormData()
    formDataV2.append('file', file)
    response = await fetch(`${BASE_V2}/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: formDataV2,
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `Erro no upload da imagem (${response.status})`
    try {
      const errJson = JSON.parse(errorText)
      if (errJson.message) errorMsg = errJson.message
      else if (errJson.error) errorMsg = errJson.error
    } catch {
      // fallback
    }
    throw new Error(errorMsg)
  }

  const result = await response.json()
  const imageToken =
    result?.data?.image_token ||
    result?.data?.file_token ||
    result?.data?.token ||
    (typeof result?.data === 'string' ? result?.data : null)

  if (!imageToken) {
    throw new Error('Não foi possível obter o token da imagem do servidor Tripo3D.')
  }

  return imageToken
}

export interface ImageToModelOptions {
  orientation?: 'align_image' | 'default'
  texture?: boolean
  pbr?: boolean
  textureAlignment?: 'original_image' | 'geometry'
}

/**
 * Starts an Image-to-3D generation task
 */
export async function createImageToModelTask(
  imageToken: string,
  imageType: string,
  apiKey: string,
  modelVersion = 'v3.1-20260211',
  options: ImageToModelOptions = {}
): Promise<string> {
  const {
    orientation = 'align_image',
    texture = true,
    pbr = true,
    textureAlignment = 'original_image',
  } = options

  let ext = imageType.toLowerCase().replace('.', '')
  if (ext === 'jpeg') ext = 'jpg'
  if (!['jpg', 'png', 'webp'].includes(ext)) {
    ext = 'png'
  }

  // Try v3 endpoint first
  const bodyV3: Record<string, any> = {
    file: {
      type: ext,
      file_token: imageToken,
    },
    model: modelVersion,
    orientation,
    texture,
    pbr,
    texture_alignment: textureAlignment,
  }

  let response = await fetch(`${BASE_V3}/generation/image-to-model`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(bodyV3),
  })

  // Fallback to v2 if 404
  if (response.status === 404) {
    response = await fetch(`${BASE_V2}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        type: 'image_to_model',
        file: {
          type: ext,
          file_token: imageToken,
        },
        orientation,
      }),
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `Falha ao iniciar geração 3D (${response.status})`
    try {
      const errJson = JSON.parse(errorText)
      if (errJson.message) errorMsg = errJson.message
      else if (errJson.error) errorMsg = errJson.error
    } catch {
      // fallback
    }
    throw new Error(errorMsg)
  }

  const result = await response.json()
  const taskId = result?.data?.task_id || result?.data?.taskId || result?.data
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Tripo3D não retornou um ID de tarefa válido.')
  }

  return taskId
}

export interface TextToModelOptions {
  texture?: boolean
  pbr?: boolean
}

/**
 * Starts a Text-to-3D generation task
 */
export async function createTextToModelTask(
  prompt: string,
  apiKey: string,
  modelVersion = 'v3.1-20260211',
  options: TextToModelOptions = {}
): Promise<string> {
  const { texture = true, pbr = true } = options

  let response = await fetch(`${BASE_V3}/generation/text-to-model`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify({
      prompt: prompt.trim(),
      model: modelVersion,
      texture,
      pbr,
    }),
  })

  if (response.status === 404) {
    response = await fetch(`${BASE_V2}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        type: 'text_to_model',
        prompt: prompt.trim(),
      }),
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `Falha ao iniciar geração 3D a partir de texto (${response.status})`
    try {
      const errJson = JSON.parse(errorText)
      if (errJson.message) errorMsg = errJson.message
      else if (errJson.error) errorMsg = errJson.error
    } catch {
      // fallback
    }
    throw new Error(errorMsg)
  }

  const result = await response.json()
  const taskId = result?.data?.task_id || result?.data?.taskId || result?.data
  if (!taskId || typeof taskId !== 'string') {
    throw new Error('Tripo3D não retornou um ID de tarefa válido.')
  }

  return taskId
}

/**
 * Polls the task until completion (or failure/cancellation)
 */
export async function pollTripoTask(
  taskId: string,
  apiKey: string,
  onProgress?: (progress: number, statusText: string) => void,
  abortSignal?: AbortSignal
): Promise<TripoTaskResult> {
  const maxAttempts = 180 // max 6 minutes (180 * 2s)
  let attempts = 0

  while (attempts < maxAttempts) {
    if (abortSignal?.aborted) {
      throw new Error('Geração cancelada pelo usuário.')
    }

    let response = await fetch(`${BASE_V3}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      signal: abortSignal,
    })

    if (response.status === 404) {
      response = await fetch(`${BASE_V2}/task/${taskId}`, {
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        signal: abortSignal,
      })
    }

    if (!response.ok) {
      throw new Error(`Erro ao verificar status da tarefa (${response.status})`)
    }

    const resJson = await response.json()
    const task = resJson?.data

    if (!task) {
      throw new Error('Resposta inválida do servidor Tripo3D.')
    }

    const status: string = task.status
    const progress: number = typeof task.progress === 'number' ? task.progress : 0

    let statusDescription = 'Processando modelo 3D...'
    if (status === 'queued') {
      statusDescription = 'Na fila de processamento...'
    } else if (progress < 40) {
      statusDescription = 'Construindo malha e geometria 3D...'
    } else if (progress < 85) {
      statusDescription = 'Calculando texturas e materiais PBR...'
    } else {
      statusDescription = 'Finalizando arquivo .GLB...'
    }

    onProgress?.(progress, statusDescription)

    if (status === 'success') {
      const modelUrl = task?.output?.model_url || task?.output?.model || task?.output?.pbr_model
      if (!modelUrl) {
        throw new Error('A tarefa foi concluída mas nenhuma URL de modelo 3D foi retornada.')
      }

      return {
        modelUrl,
        thumbnailUrl: task?.output?.rendered_image_url || task?.output?.rendered_image,
      }
    }

    if (['failed', 'cancelled', 'banned'].includes(status)) {
      throw new Error(`A geração falhou com status: ${status}`)
    }

    attempts++
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error('Tempo limite de geração excedido (timeout).')
}

/**
 * Downloads the resulting GLB file as a browser File object
 */
export async function downloadModelAsFile(modelUrl: string, modelName: string): Promise<File> {
  const response = await fetch(modelUrl)
  if (!response.ok) {
    throw new Error(`Erro ao baixar o arquivo 3D gerado (${response.status})`)
  }

  const blob = await response.blob()
  const sanitizedName = modelName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '') || 'modelo-tripo-3d'
  const fileName = sanitizedName.endsWith('.glb') ? sanitizedName : `${sanitizedName}.glb`

  return new File([blob], fileName, { type: 'model/gltf-binary' })
}
