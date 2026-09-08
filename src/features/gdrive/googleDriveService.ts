import type { GlobalSettings, ModelAsset, Shelf } from '../../domain/types'
import { shelfDatabase } from '../../storage/db'
import type { GDriveBackupConfig, GDriveFileMeta, GDriveSyncProgress, GDriveUser } from './types'

const STORAGE_CLIENT_ID_KEY = 'prateleira_gdrive_client_id'
const STORAGE_USER_KEY = 'prateleira_gdrive_user'
const STORAGE_LAST_BACKUP_KEY = 'prateleira_gdrive_last_backup'
const STORAGE_FOLDER_ID_KEY = 'prateleira_gdrive_folder_id'

// Token caching in memory during session
let cachedAccessToken: string | null = null
let tokenExpiresAt: number = 0

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: {
              access_token?: string
              error?: string
              expires_in?: number
              scope?: string
            }) => void
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void
          }
        }
      }
    }
  }
}

/**
 * Loads the official Google Identity Services client script dynamically
 */
export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve()
    if (window.google?.accounts?.oauth2) return resolve()

    const existing = document.getElementById('google-gsi-script')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', (e) => reject(new Error('Falha ao carregar script do Google')))
      return
    }

    const script = document.createElement('script')
    script.id = 'google-gsi-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar script do Google Identity Services'))
    document.head.appendChild(script)
  })
}

/**
 * Client ID getters and setters
 */
export function getStoredClientId(): string {
  // Check Vite env variable first
  const envVal = (import.meta as unknown as { env?: { VITE_GOOGLE_CLIENT_ID?: string } })?.env?.VITE_GOOGLE_CLIENT_ID
  if (envVal?.trim()) return envVal.trim()

  if (typeof window === 'undefined') return ''
  const saved = localStorage.getItem(STORAGE_CLIENT_ID_KEY)?.trim()
  return saved || ''
}

export function saveStoredClientId(clientId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_CLIENT_ID_KEY, clientId.trim())
}

export function getStoredUser(): GDriveUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GDriveUser
  } catch {
    return null
  }
}

export function saveStoredUser(user: GDriveUser | null): void {
  if (typeof window === 'undefined') return
  if (!user) {
    localStorage.removeItem(STORAGE_USER_KEY)
  } else {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
  }
}

export function getStoredLastBackup(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_LAST_BACKUP_KEY)
}

export function setStoredLastBackup(timestamp: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_LAST_BACKUP_KEY, timestamp)
}

export function getStoredFolderId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_FOLDER_ID_KEY)
}

export function setStoredFolderId(folderId: string | null): void {
  if (typeof window === 'undefined') return
  if (!folderId) {
    localStorage.removeItem(STORAGE_FOLDER_ID_KEY)
  } else {
    localStorage.setItem(STORAGE_FOLDER_ID_KEY, folderId)
  }
}

/**
 * Checks if user is authenticated and token is still valid
 */
export function isGoogleConnected(): boolean {
  return !!cachedAccessToken && Date.now() < tokenExpiresAt
}

export function disconnectGoogle(): void {
  cachedAccessToken = null
  tokenExpiresAt = 0
  saveStoredUser(null)
  setStoredFolderId(null)
}

/**
 * Handles Drive API errors, resetting cached tokens and returning user-friendly messages
 */
function handleDriveApiError(res: Response, text: string, actionDesc: string): Error {
  cachedAccessToken = null
  tokenExpiresAt = 0
  if (
    res.status === 403 &&
    (text.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || text.includes('insufficientPermissions'))
  ) {
    return new Error(
      'Permissão insuficiente no Google Drive (403): O token não possui acesso aos arquivos. Ao fazer login na tela do Google, você DEVE marcar a caixa de seleção permitindo "Ver, criar e editar arquivos no Google Drive que você usar com este app". Clique em "Conectar com Google" novamente para marcar.'
    )
  }
  return new Error(`${actionDesc} (${res.status}): ${text}`)
}

/**
 * Requests an OAuth 2.0 access token using Google Identity Services
 */
export async function authenticateGoogle(
  clientIdOverride?: string,
  forceConsent: boolean = false
): Promise<{ token: string; user: GDriveUser }> {
  const clientId = clientIdOverride?.trim() || getStoredClientId()
  if (!clientId) {
    throw new Error('Google Client ID não configurado. Defina a variável de ambiente VITE_GOOGLE_CLIENT_ID.')
  }

  await loadGoogleScript()

  if (!window.google?.accounts?.oauth2) {
    throw new Error('SDK do Google Identity Services não disponível.')
  }

  // Check if current cached token is still valid (leave a 30s buffer) unless forceConsent requested
  if (!forceConsent && cachedAccessToken && Date.now() < tokenExpiresAt - 30000) {
    const user = getStoredUser() || (await fetchGoogleUserInfo(cachedAccessToken))
    return { token: cachedAccessToken, user }
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
        ].join(' '),
        callback: async (response) => {
          if (response.error) {
            cachedAccessToken = null
            tokenExpiresAt = 0
            reject(new Error(`Erro de autenticação Google: ${response.error}`))
            return
          }
          if (!response.access_token) {
            cachedAccessToken = null
            tokenExpiresAt = 0
            reject(new Error('Nenhum token de acesso foi retornado pelo Google.'))
            return
          }

          // Check if Google Drive scope was explicitly granted in the consent dialog
          if (response.scope) {
            const grantedScopes = response.scope.split(' ')
            const hasDriveScope = grantedScopes.some((s) => s.includes('drive'))
            if (!hasDriveScope) {
              cachedAccessToken = null
              tokenExpiresAt = 0
              reject(
                new Error(
                  'Atenção: A permissão para acessar o Google Drive NÃO foi marcada. Na tela de autorização do Google, marque a caixa de seleção autorizando o app a salvar arquivos no Google Drive.'
                )
              )
              return
            }
          }

          const token = response.access_token
          const expiresIn = response.expires_in || 3600
          cachedAccessToken = token
          tokenExpiresAt = Date.now() + expiresIn * 1000

          try {
            const user = await fetchGoogleUserInfo(token)
            saveStoredUser(user)
            saveStoredClientId(clientId)
            resolve({ token, user })
          } catch (err) {
            console.warn('Não foi possível obter dados do perfil Google:', err)
            const fallbackUser: GDriveUser = { name: 'Conta Google Conectada' }
            saveStoredUser(fallbackUser)
            resolve({ token, user: fallbackUser })
          }
        },
      })

      tokenClient.requestAccessToken({ prompt: forceConsent || !cachedAccessToken ? 'consent' : '' })
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Falha ao inicializar autenticação Google'))
    }
  })
}

/**
 * Fetches user profile from Google UserInfo endpoint
 */
async function fetchGoogleUserInfo(token: string): Promise<GDriveUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`Erro ao buscar dados do usuário: ${res.statusText}`)
  }
  const data = await res.json()
  return {
    name: data.name || data.given_name || 'Usuário Google',
    email: data.email,
    picture: data.picture,
  }
}

/**
 * Finds a folder by name in Google Drive
 */
export async function findFolder(name: string, parentId?: string, token?: string): Promise<GDriveFileMeta | null> {
  const activeToken = token || (await authenticateGoogle()).token
  let query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  if (parentId) {
    query += ` and '${parentId}' in parents`
  }

  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name, mimeType, webViewLink)&pageSize=1`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${activeToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw handleDriveApiError(res, errorText, 'Erro ao buscar pasta no Drive')
  }

  const data = await res.json()
  if (data.files && data.files.length > 0) {
    return data.files[0]
  }
  return null
}

/**
 * Creates a folder in Google Drive
 */
export async function createFolder(name: string, parentId?: string, token?: string): Promise<GDriveFileMeta> {
  const activeToken = token || (await authenticateGoogle()).token
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) {
    metadata.parents = [parentId]
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw handleDriveApiError(res, errorText, 'Erro ao criar pasta no Drive')
  }

  return await res.json()
}

/**
 * Ensures the app folder "Prateleira 3D" and subfolder "models" exist in Google Drive
 */
export async function getOrCreateAppFolders(token?: string): Promise<{
  rootFolder: GDriveFileMeta
  modelsFolder: GDriveFileMeta
}> {
  const activeToken = token || (await authenticateGoogle()).token

  // 1. Root folder: "Prateleira 3D"
  let rootFolder = await findFolder('Prateleira 3D', undefined, activeToken)
  if (!rootFolder) {
    rootFolder = await createFolder('Prateleira 3D', undefined, activeToken)
  }
  setStoredFolderId(rootFolder.id)

  // 2. Subfolder: "models"
  let modelsFolder = await findFolder('models', rootFolder.id, activeToken)
  if (!modelsFolder) {
    modelsFolder = await createFolder('models', rootFolder.id, activeToken)
  }

  return { rootFolder, modelsFolder }
}

/**
 * Lists all active files inside a folder in Google Drive (with pagination support)
 */
export async function listFilesInFolder(folderId: string, token?: string): Promise<GDriveFileMeta[]> {
  const activeToken = token || (await authenticateGoogle()).token
  const allFiles: GDriveFileMeta[] = []
  let pageToken: string | undefined = undefined

  do {
    const query = `'${folderId}' in parents and trashed=false`
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id, name, mimeType, size, modifiedTime, webViewLink)&pageSize=1000`
    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${activeToken}` },
    })

    if (!res.ok) {
      const errorText = await res.text()
      throw handleDriveApiError(res, errorText, 'Erro ao listar arquivos da pasta')
    }

    const data = await res.json()
    if (data.files && Array.isArray(data.files)) {
      allFiles.push(...data.files)
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return allFiles
}

/**
 * Uploads or updates a file in Google Drive using multipart upload
 */
export async function uploadOrUpdateFile(options: {
  name: string
  mimeType: string
  content: Blob | string
  parentId?: string
  existingFileId?: string
  token?: string
}): Promise<GDriveFileMeta> {
  const { name, mimeType, content, parentId, existingFileId } = options
  const activeToken = options.token || (await authenticateGoogle()).token

  const boundary = '-------PrateleiraBoundary' + Math.random().toString(36).substring(2)
  const delimiter = `\r\n--${boundary}\r\n`
  const closeDelimiter = `\r\n--${boundary}--`

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType,
  }
  if (parentId && !existingFileId) {
    metadata.parents = [parentId]
  }

  const contentBlob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content

  const metadataHeader = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n${delimiter}Content-Type: ${mimeType}\r\n\r\n`

  const metadataBlob = new Blob([metadataHeader], { type: 'text/plain' })
  const endBlob = new Blob([closeDelimiter], { type: 'text/plain' })

  const multipartBlob = new Blob([metadataBlob, contentBlob, endBlob], {
    type: `multipart/related; boundary=${boundary}`,
  })

  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink`

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${activeToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBlob,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw handleDriveApiError(res, errorText, `Falha no upload de "${name}"`)
  }

  return await res.json()
}

/**
 * Downloads a file as Blob
 */
export async function downloadFileBlob(fileId: string, token?: string): Promise<Blob> {
  const activeToken = token || (await authenticateGoogle()).token
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${activeToken}` },
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw handleDriveApiError(res, errorText, 'Erro ao baixar arquivo')
  }
  return await res.blob()
}

/**
 * Downloads a file and parses as JSON
 */
export async function downloadFileJson<T = unknown>(fileId: string, token?: string): Promise<T> {
  const activeToken = token || (await authenticateGoogle()).token
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${activeToken}` },
  })
  if (!res.ok) {
    const errorText = await res.text()
    throw handleDriveApiError(res, errorText, 'Erro ao baixar arquivo de configuração')
  }
  return await res.json()
}

/**
 * Performs backup of settings, shelves, and 3D models to Google Drive.
 * Uses smart incremental upload: skips models and thumbnails that already exist in Drive with identical size.
 */
export async function backupAllDataToDrive(options: {
  globalSettings: GlobalSettings
  shelves: Shelf[]
  onProgress?: (progress: GDriveSyncProgress) => void
  clientIdOverride?: string
  forceAll?: boolean
}): Promise<{
  rootFolderUrl: string
  uploadedCount: number
  skippedCount: number
  totalCount: number
  timestamp: string
}> {
  const { globalSettings, shelves, onProgress, clientIdOverride, forceAll = false } = options

  onProgress?.({
    phase: 'auth',
    current: 0,
    total: 100,
    detail: 'Conectando ao Google Drive...',
  })

  const { token } = await authenticateGoogle(clientIdOverride)

  onProgress?.({
    phase: 'folder',
    current: 10,
    total: 100,
    detail: 'Verificando pasta "Prateleira 3D" no Google Drive...',
  })

  const { rootFolder, modelsFolder } = await getOrCreateAppFolders(token)

  // 1. Prepare config.json
  onProgress?.({
    phase: 'config',
    current: 25,
    total: 100,
    detail: 'Salvando configurações e estrutura de prateleiras...',
  })

  const storedModels = await shelfDatabase.models.toArray()
  const modelsMetadata: ModelAsset[] = storedModels.map((m) => ({
    id: m.id,
    name: m.name,
    format: m.format,
    sizeBytes: m.sizeBytes,
    shelfId: m.shelfId,
    tags: m.tags || [],
    createdAt: m.createdAt,
  }))

  const backupConfig: GDriveBackupConfig = {
    version: 1,
    exportedAt: new Date().toISOString(),
    globalSettings,
    shelves,
    models: modelsMetadata,
  }

  // Find if config.json already exists in root folder
  const rootFiles = await listFilesInFolder(rootFolder.id, token)
  const existingConfig = rootFiles.find((f) => f.name === 'config.json')

  await uploadOrUpdateFile({
    name: 'config.json',
    mimeType: 'application/json',
    content: JSON.stringify(backupConfig, null, 2),
    parentId: rootFolder.id,
    existingFileId: existingConfig?.id,
    token,
  })

  // 2. Upload model files and thumbnails into modelsFolder (incremental / smart skip)
  onProgress?.({
    phase: 'uploading',
    current: 0,
    total: storedModels.length,
    detail: 'Verificando arquivos já salvos no Google Drive...',
  })

  const existingModelFiles = await listFilesInFolder(modelsFolder.id, token)
  const existingFilesMap = new Map(existingModelFiles.map((f) => [f.name, f]))

  let uploadedCount = 0
  let skippedCount = 0
  const totalItems = storedModels.length

  for (let i = 0; i < storedModels.length; i++) {
    const model = storedModels[i]
    let modelFileUploaded = false
    let thumbUploaded = false

    // Check 3D file (<model.id>.<format>)
    const modelFileName = `${model.id}.${model.format}`
    const existingFile = existingFilesMap.get(modelFileName)

    // Check if 3D file is already uploaded with the exact same size in bytes
    const modelSizeMatches =
      Boolean(existingFile) &&
      existingFile?.size != null &&
      Boolean(model.file) &&
      Number(existingFile?.size) === model.file.size

    const needsModelUpload = forceAll || !existingFile || !modelSizeMatches

    if (model.file && needsModelUpload) {
      onProgress?.({
        phase: 'uploading',
        current: i + 1,
        total: totalItems,
        detail: `Enviando arquivo 3D (${i + 1}/${totalItems}): ${model.name}`,
      })

      await uploadOrUpdateFile({
        name: modelFileName,
        mimeType: model.format === 'glb' ? 'model/gltf-binary' : 'model/gltf+json',
        content: model.file,
        parentId: modelsFolder.id,
        existingFileId: existingFile?.id,
        token,
      })
      modelFileUploaded = true
    }

    // Check thumbnail if exists (<model.id>.thumb.png)
    if (model.thumbnail) {
      const thumbFileName = `${model.id}.thumb.png`
      const existingThumb = existingFilesMap.get(thumbFileName)

      const thumbSizeMatches =
        Boolean(existingThumb) &&
        existingThumb?.size != null &&
        Number(existingThumb?.size) === model.thumbnail.size

      const needsThumbUpload = forceAll || !existingThumb || !thumbSizeMatches

      if (needsThumbUpload) {
        onProgress?.({
          phase: 'uploading',
          current: i + 1,
          total: totalItems,
          detail: `Enviando miniatura (${i + 1}/${totalItems}): ${model.name}`,
        })

        await uploadOrUpdateFile({
          name: thumbFileName,
          mimeType: 'image/png',
          content: model.thumbnail,
          parentId: modelsFolder.id,
          existingFileId: existingThumb?.id,
          token,
        })
        thumbUploaded = true
      }
    }

    if (modelFileUploaded || thumbUploaded) {
      uploadedCount++
    } else {
      skippedCount++
      onProgress?.({
        phase: 'uploading',
        current: i + 1,
        total: totalItems,
        detail: `[${i + 1}/${totalItems}] ${model.name} já salvo no Drive (ignorado)`,
      })
    }
  }

  const nowIso = new Date().toISOString()
  setStoredLastBackup(nowIso)

  onProgress?.({
    phase: 'complete',
    current: 100,
    total: 100,
    detail: 'Backup concluído com sucesso no Google Drive!',
  })

  return {
    rootFolderUrl: rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`,
    uploadedCount,
    skippedCount,
    totalCount: totalItems,
    timestamp: nowIso,
  }
}

/**
 * Restores catalog, shelves, and model files from Google Drive into local IndexedDB
 */
export async function restoreAllDataFromDrive(options: {
  onProgress?: (progress: GDriveSyncProgress) => void
  clientIdOverride?: string
}): Promise<{
  config: GDriveBackupConfig
  restoredModelsCount: number
  restoredShelvesCount: number
}> {
  const { onProgress, clientIdOverride } = options

  onProgress?.({
    phase: 'auth',
    current: 0,
    total: 100,
    detail: 'Conectando ao Google Drive...',
  })

  const { token } = await authenticateGoogle(clientIdOverride)

  onProgress?.({
    phase: 'folder',
    current: 10,
    total: 100,
    detail: 'Localizando pasta "Prateleira 3D"...',
  })

  const { rootFolder, modelsFolder } = await getOrCreateAppFolders(token)

  // 1. Read config.json
  onProgress?.({
    phase: 'config',
    current: 20,
    total: 100,
    detail: 'Carregando arquivo de configuração e modelos...',
  })

  const rootFiles = await listFilesInFolder(rootFolder.id, token)
  const configFile = rootFiles.find((f) => f.name === 'config.json')

  if (!configFile) {
    throw new Error('Nenhum arquivo "config.json" encontrado na pasta do Google Drive.')
  }

  const backupConfig = await downloadFileJson<GDriveBackupConfig>(configFile.id, token)

  if (!backupConfig || !backupConfig.models) {
    throw new Error('O arquivo de configuração no Google Drive está corrompido ou é inválido.')
  }

  // 2. Fetch models folder files
  const driveModelFiles = await listFilesInFolder(modelsFolder.id, token)
  const driveFilesByName = new Map(driveModelFiles.map((f) => [f.name, f]))

  // 3. Download each model and store in Dexie
  const totalModels = backupConfig.models.length
  let restoredModelsCount = 0

  for (let i = 0; i < backupConfig.models.length; i++) {
    const meta = backupConfig.models[i]
    const modelFileName = `${meta.id}.${meta.format}`
    const driveFile = driveFilesByName.get(modelFileName)

    const existingLocal = await shelfDatabase.models.get(meta.id)
    const localFileMatches =
      Boolean(existingLocal?.file) &&
      driveFile?.size != null &&
      existingLocal?.file?.size === Number(driveFile.size)

    let modelBlob: Blob | null = null
    if (localFileMatches && existingLocal?.file) {
      modelBlob = existingLocal.file
    } else if (driveFile) {
      onProgress?.({
        phase: 'downloading',
        current: i + 1,
        total: totalModels,
        detail: `Baixando modelo (${i + 1}/${totalModels}): ${meta.name}`,
      })
      modelBlob = await downloadFileBlob(driveFile.id, token)
    }

    // Try downloading thumbnail or reuse local
    let thumbBlob: Blob | undefined = undefined
    const thumbFileName = `${meta.id}.thumb.png`
    const driveThumb = driveFilesByName.get(thumbFileName)

    const localThumbMatches =
      Boolean(existingLocal?.thumbnail) &&
      driveThumb?.size != null &&
      existingLocal?.thumbnail?.size === Number(driveThumb.size)

    if (localThumbMatches && existingLocal?.thumbnail) {
      thumbBlob = existingLocal.thumbnail
    } else if (driveThumb) {
      thumbBlob = await downloadFileBlob(driveThumb.id, token)
    }

    if (modelBlob) {
      await shelfDatabase.models.put({
        ...meta,
        file: modelBlob,
        thumbnail: thumbBlob,
      })
      restoredModelsCount++
    }
  }

  // 4. Restore shelves
  if (backupConfig.shelves && backupConfig.shelves.length > 0) {
    await shelfDatabase.shelves.bulkPut(backupConfig.shelves)
  }

  onProgress?.({
    phase: 'complete',
    current: 100,
    total: 100,
    detail: `Restauração concluída! ${restoredModelsCount} modelos restaurados.`,
  })

  return {
    config: backupConfig,
    restoredModelsCount,
    restoredShelvesCount: backupConfig.shelves?.length || 0,
  }
}
