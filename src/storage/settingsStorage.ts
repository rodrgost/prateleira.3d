import type { GlobalSettings, ShelfViewerSettings } from '../domain/types'

export const DEFAULT_VIEWER_SETTINGS: Required<ShelfViewerSettings> = {
  backgroundColor: '#141519',
  showGround: true,
  groundType: 'shadow',
  groundColor: '#4f627d',
  autoRotate: false,
  autoRotateSpeed: 2.0,
  lighting: 'studio',
}

const STORAGE_KEY = 'prateleira-global-settings'

export function getStoredGlobalSettings(): GlobalSettings {
  const savedTheme = localStorage.getItem('prateleira-theme') as 'light' | 'dark' | null
  const defaultTheme: 'light' | 'dark' =
    savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GlobalSettings>
      return {
        theme: parsed.theme || defaultTheme,
        defaultViewMode: parsed.defaultViewMode || 'showcase',
        defaultSortBy: parsed.defaultSortBy || 'custom',
        viewer: {
          ...DEFAULT_VIEWER_SETTINGS,
          ...(parsed.viewer || {}),
        },
      }
    }
  } catch {
    // fallback
  }

  return {
    theme: defaultTheme,
    defaultViewMode: 'showcase',
    defaultSortBy: 'custom',
    viewer: {
      ...DEFAULT_VIEWER_SETTINGS,
      backgroundColor: defaultTheme === 'dark' ? '#141519' : '#eae5dc',
    },
  }
}

export function saveStoredGlobalSettings(settings: GlobalSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (err) {
    console.error('Failed to save global settings', err)
  }
}

export function resolveViewerSettings(
  shelfSettings: ShelfViewerSettings | undefined,
  globalSettings: GlobalSettings,
  currentTheme: 'light' | 'dark'
): Required<ShelfViewerSettings> {
  const defaultBg = currentTheme === 'dark' ? '#141519' : '#eae5dc'
  const fallback = {
    ...DEFAULT_VIEWER_SETTINGS,
    ...globalSettings.viewer,
    backgroundColor: globalSettings.viewer.backgroundColor || defaultBg,
  }

  return {
    backgroundColor: shelfSettings?.backgroundColor || fallback.backgroundColor,
    showGround: shelfSettings?.showGround !== undefined ? shelfSettings.showGround : fallback.showGround,
    groundType: shelfSettings?.groundType || fallback.groundType,
    groundColor: shelfSettings?.groundColor || fallback.groundColor,
    autoRotate: shelfSettings?.autoRotate !== undefined ? shelfSettings.autoRotate : fallback.autoRotate,
    autoRotateSpeed: shelfSettings?.autoRotateSpeed !== undefined ? shelfSettings.autoRotateSpeed : fallback.autoRotateSpeed,
    lighting: shelfSettings?.lighting || fallback.lighting,
  }
}
