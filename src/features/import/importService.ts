import { isTauriEnvironment } from '../desktop-pet/desktopPetService'

export type ImportLocationChoice = 'move' | 'keep' | 'custom'

export interface SelectedImportItem {
  file?: File
  filePath?: string
  name: string
  sizeBytes: number
}

const PREFERENCE_KEY = 'prateleira_import_move_preference'

export function getStoredImportPreference(): 'ask' | 'move' | 'keep' {
  const val = localStorage.getItem(PREFERENCE_KEY)
  if (val === 'move' || val === 'keep') return val
  return 'ask'
}

export function saveStoredImportPreference(pref: 'ask' | 'move' | 'keep'): void {
  localStorage.setItem(PREFERENCE_KEY, pref)
}

/**
 * Returns the system folder path where 3D models are stored (e.g. Documents/Prateleira 3D/Modelos)
 */
export async function getSystemModelsDirectory(): Promise<string> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke('get_system_models_dir')
    } catch (err) {
      console.warn('Erro ao obter pasta do sistema via Tauri:', err)
    }
  }
  // Fallback to stored central folder or default location
  const stored = getCentralFolderPath()
  return stored || 'Pasta Local do Aplicativo'
}

/**
 * Returns the central folder path where user wants to centralizar arquivos.
 */
export function getCentralFolderPath(): string | null {
  return localStorage.getItem('prateleira_central_folder_path')
}

/**
 * Saves the central folder path chosen by the user.
 */
export function setCentralFolderPath(path: string): void {
  localStorage.setItem('prateleira_central_folder_path', path)
}

/**
 * Opens a folder picker dialog (Tauri) to select a custom central folder.
 */
export async function pickCustomCentralFolder(): Promise<string | null> {
  if (isTauriEnvironment()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const result = await open({
        directory: true,
        multiple: false,
        title: 'Selecionar Pasta Centralizada para Modelos',
      })
      if (result && typeof result === 'string') {
        setCentralFolderPath(result)
        return result
      }
    } catch (err) {
      console.warn('Erro ao abrir seletor de pasta:', err)
    }
  }
  return null
}

  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      return await invoke<string>('get_system_models_dir')
    } catch (err) {
      console.warn('Erro ao obter pasta do sistema via Tauri:', err)
    }
  }
  return 'Pasta Local do Aplicativo'
}

/**
 * Opens the system folder in Windows Explorer
 */
export async function openSystemModelsDirectory(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_system_models_dir')
    } catch (err) {
      console.warn('Erro ao abrir pasta no Explorer:', err)
    }
  }
}

/**
 * Native file dialog for selecting 3D files in desktop mode
 */
export async function select3DFilesNative(): Promise<string[] | null> {
  if (isTauriEnvironment()) {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const result = await open({
        multiple: true,
        title: 'Selecionar Modelos 3D para Importar',
        filters: [
          {
            name: 'Modelos 3D (*.glb, *.gltf)',
            extensions: ['glb', 'gltf'],
          },
        ],
      })

      if (!result) return null
      return Array.isArray(result) ? result : [result]
    } catch (err) {
      console.warn('Falha no diálogo nativo, usando seletor web:', err)
    }
  }
  return null
}

export interface ProcessedImportFile {
  name: string
  blob: Blob
  originalPath?: string
  finalPath?: string
  wasMoved: boolean
}

/**
 * Process a file for import, optionally moving it to the system folder
 */
export async function processFileForImport(
  item: SelectedImportItem,
  moveToSystemFolder: boolean,
): Promise<ProcessedImportFile> {
  // If running in Tauri and we have the native file path
  if (isTauriEnvironment() && item.filePath) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<{
        name: string
        original_path: string
        final_path: string
        moved: boolean
        bytes: number[]
      }>('process_import_file', {
        sourcePath: item.filePath,
        moveToSystemFolder,
      })

      const uint8 = new Uint8Array(result.bytes)
      const blob = new Blob([uint8], {
        type: result.name.toLowerCase().endsWith('.gltf') ? 'model/gltf+json' : 'model/gltf-binary',
      })

      return {
        name: result.name,
        blob,
        originalPath: result.original_path,
        finalPath: result.final_path,
        wasMoved: result.moved,
      }
    } catch (err) {
      console.error('Erro ao processar importação via Tauri:', err)
    }
  }

  // Fallback when only File object is available
  if (item.file) {
    let finalPath: string | undefined

    // If in Tauri and user chose to move/save to system folder, write bytes to disk
    if (isTauriEnvironment() && moveToSystemFolder) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const arrayBuf = await item.file.arrayBuffer()
        const bytes = Array.from(new Uint8Array(arrayBuf))
        finalPath = await invoke<string>('save_bytes_to_system_folder', {
          fileName: item.file.name,
          bytes,
        })
      } catch (err) {
        console.warn('Erro ao salvar bytes na pasta do sistema:', err)
      }
    }

    return {
      name: item.name,
      blob: item.file,
      finalPath,
      wasMoved: moveToSystemFolder,
    }
  }

  throw new Error(`Dados do arquivo inválidos para ${item.name}`)
}

