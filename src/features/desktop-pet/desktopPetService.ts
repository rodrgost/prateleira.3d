/**
 * Utilities for Desktop Pet mode and Tauri Window Integration
 */

export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

export const PET_ACTIVE_MODEL_KEY = 'prateleira_active_pet_model_id'

export function getStoredPetModelId(): string | null {
  return localStorage.getItem(PET_ACTIVE_MODEL_KEY)
}

export function setStoredPetModelId(modelId: string): void {
  localStorage.setItem(PET_ACTIVE_MODEL_KEY, modelId)
}

/**
 * Launch or switch Desktop Pet to a specific model.
 * Uses native Rust command in Tauri for zero-latency, reliable window creation.
 */
export async function launchDesktopPet(modelId: string): Promise<void> {
  setStoredPetModelId(modelId)

  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_desktop_pet', { modelId })
      return
    } catch (err) {
      console.error('Falha ao abrir Desktop Pet via comando nativo do Tauri:', err)
    }
  }

  // Web fallback: open lightweight floating popup window
  openWebPopup(modelId)
}

function openWebPopup(modelId: string) {
  const width = 340
  const height = 340
  const left = window.screen.width - width - 40
  const top = window.screen.height - height - 80

  window.open(
    `?mode=pet&modelId=${encodeURIComponent(modelId)}`,
    'DesktopPetWindow',
    `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`,
  )
}

/**
 * Bring main app window to focus.
 * NEVER navigates the pet window itself!
 */
export async function openMainWindow(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('focus_main_window')
      return
    } catch (err) {
      console.warn('Erro ao focar janela principal via Tauri:', err)
    }
  }

  // Web fallback: focus opener window if available
  if (window.opener && !window.opener.closed) {
    window.opener.focus()
  }
}

/**
 * Closes the pet window.
 */
export async function closePetWindow(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().close()
      return
    } catch (err) {
      console.warn('Erro ao fechar janela do pet:', err)
    }
  }
  window.close()
}
