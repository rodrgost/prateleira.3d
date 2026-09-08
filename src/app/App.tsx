import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Box,
  Cloud,
  Download,
  Eye,
  FolderPlus,
  Grid3X3,
  LayoutGrid,
  Library,
  Moon,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateModelFile } from '../domain/fileValidation'
import { generateModelThumbnail } from '../domain/thumbnail'
import { rotateGlbModel } from '../domain/modelTransform'
import type { GlobalSettings, ModelAsset, Shelf, ShelfViewerSettings, SortOption } from '../domain/types'
import { shelfDatabase } from '../storage/db'
import {
  getStoredGlobalSettings,
  resolveViewerSettings,
  saveStoredGlobalSettings,
} from '../storage/settingsStorage'
import { GlobalSettingsModal } from '../features/settings/GlobalSettingsModal'
import { ShelfSettingsBar } from '../features/settings/ShelfSettingsBar'
import { AiModelGeneratorModal } from '../features/generator/AiModelGeneratorModal'
import { EditorPage } from '../features/editor/EditorPage'
import { ModelViewerModal } from '../features/viewer/ModelViewerModal'
import { ShelfShowcaseModal } from '../features/viewer/ShelfShowcaseModal'
import { ensureModelFileDownloaded } from '../features/gdrive/googleDriveService'
import { usePwaInstall } from '../pwa'

export function App() {
  const { isInstallable, promptInstall } = usePwaInstall()

  const [activePage, setActivePage] = useState<'library' | 'editor'>('library')
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(() => getStoredGlobalSettings())
  const [showGlobalSettingsModal, setShowGlobalSettingsModal] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'viewer' | 'appearance' | 'storage' | 'gdrive'>('viewer')
  const [showAiGeneratorModal, setShowAiGeneratorModal] = useState(false)

  const [activeShelfId, setActiveShelfId] = useState('all')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>(() => globalSettings.defaultSortBy || 'custom')
  const [viewMode, setViewMode] = useState<'showcase' | 'compact'>(() => globalSettings.defaultViewMode || 'showcase')
  const [models, setModels] = useState<ModelAsset[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [message, setMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Auto-dismiss message after 5 seconds when not processing
  useEffect(() => {
    if (!message || isProcessing) return
    const timer = setTimeout(() => {
      setMessage('')
    }, 5000)
    return () => clearTimeout(timer)
  }, [message, isProcessing])

  const [selectedModel, setSelectedModel] = useState<ModelAsset | null>(null)
  const [selectedModelUrl, setSelectedModelUrl] = useState('')
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})
  const [shelfDialog, setShelfDialog] = useState<{ mode: 'create' | 'rename'; shelf?: Shelf } | null>(null)
  const [shelfName, setShelfName] = useState('')
  const [storageUsed, setStorageUsed] = useState('calculando')

  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [editingModelName, setEditingModelName] = useState('')

  const [theme, setTheme] = useState<'light' | 'dark'>(() => globalSettings.theme || 'dark')

  const [showcaseShelf, setShowcaseShelf] = useState<{
    shelfId: string
    shelfName: string
    models: ModelAsset[]
    settings: ShelfViewerSettings
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailUrlsRef = useRef<Record<string, string>>({})

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    const nextTheme: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    const updated: GlobalSettings = { ...globalSettings, theme: nextTheme }
    setGlobalSettings(updated)
    saveStoredGlobalSettings(updated)
  }

  // Load initial data
  const reloadAllData = useCallback(async () => {
    setIsProcessing(true)
    const [storedModels, storedShelves] = await Promise.all([
      shelfDatabase.models.toArray(),
      shelfDatabase.shelves.toArray(),
    ])
    setModels(storedModels)
    setShelves(storedShelves)

    const loadedThumbnails = Object.fromEntries(
      storedModels.filter((model) => model.thumbnail).map((model) => [model.id, URL.createObjectURL(model.thumbnail!)])
    )
    Object.values(thumbnailUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    thumbnailUrlsRef.current = loadedThumbnails
    setThumbnailUrls(loadedThumbnails)

    const storedGlobal = getStoredGlobalSettings()
    setGlobalSettings(storedGlobal)
    setTheme(storedGlobal.theme || 'dark')
    setViewMode(storedGlobal.defaultViewMode || 'showcase')
    setSortBy(storedGlobal.defaultSortBy || 'custom')
    setIsProcessing(false)
  }, [])

  useEffect(() => {
    void reloadAllData()
  }, [reloadAllData])

  useEffect(() => {
    return () => {
      Object.values(thumbnailUrlsRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  // Storage calculation
  useEffect(() => {
    const updateStorage = async () => {
      const estimate = await navigator.storage?.estimate()
      if (estimate?.usage) setStorageUsed(formatBytes(estimate.usage))
      else if (models.length === 0) setStorageUsed('nenhum arquivo')
    }
    void updateStorage()
  }, [models])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedModel(null)
        setShowcaseShelf(null)
        setShelfDialog(null)
        setShowGlobalSettingsModal(false)
        setShowAiGeneratorModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Selected Model URL loader
  useEffect(() => {
    let objectUrl = ''
    if (selectedModel) {
      setIsProcessing(true)
      setMessage(`Carregando modelo 3D "${selectedModel.name}"...`)
      ensureModelFileDownloaded(selectedModel.id)
        .then((fileBlob) => {
          if (fileBlob) {
            objectUrl = URL.createObjectURL(fileBlob)
            setSelectedModelUrl(objectUrl)
            setModels((prev) =>
              prev.map((m) => (m.id === selectedModel.id ? { ...m, inCloud: false } : m))
            )
            setMessage('')
          } else {
            setMessage('Não foi possível carregar o arquivo 3D do modelo.')
          }
        })
        .catch((err) => {
          console.error(err)
          setMessage('Erro ao carregar modelo 3D do Google Drive.')
        })
        .finally(() => {
          setIsProcessing(false)
        })
    } else {
      setSelectedModelUrl('')
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [selectedModel])

  // Import files
  async function importFiles(files: FileList | File[]) {
    setIsProcessing(true)
    const imported: ModelAsset[] = []

    for (const file of Array.from(files)) {
      const validation = await validateModelFile(file)
      if (!validation.valid) {
        setMessage(validation.message)
        continue
      }
      const model: ModelAsset = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(glb|gltf)$/i, ''),
        format: validation.format,
        sizeBytes: file.size,
        shelfId: activeShelfId !== 'all' ? activeShelfId : undefined,
        tags: [],
        createdAt: new Date().toISOString(),
      }
      const targetShelf = activeShelfId !== 'all' ? shelves.find((s) => s.id === activeShelfId) : undefined
      const targetSettings = resolveViewerSettings(targetShelf?.settings, globalSettings, theme)
      const thumbnail = await generateModelThumbnail(file, targetSettings)
      await shelfDatabase.models.put({ ...model, file, thumbnail: thumbnail ?? undefined })

      if (thumbnail) {
        const url = URL.createObjectURL(thumbnail)
        thumbnailUrlsRef.current[model.id] = url
        setThumbnailUrls((current) => ({ ...current, [model.id]: url }))
      }
      imported.push(model)
    }

    if (imported.length > 0) {
      if (activeShelfId !== 'all') {
        const targetShelf = shelves.find((s) => s.id === activeShelfId)
        if (targetShelf) {
          const updatedShelf = {
            ...targetShelf,
            modelIds: [...(targetShelf.modelIds || []), ...imported.map((m) => m.id)],
          }
          await shelfDatabase.shelves.put(updatedShelf)
          setShelves((current) => current.map((s) => (s.id === targetShelf.id ? updatedShelf : s)))
        }
      }

      setModels((current) => [...imported, ...current])
      setMessage(`${imported.length} modelo(s) importado(s) com sucesso.`)
    }

    setIsProcessing(false)
  }

  // Model rotate 90°
  async function handleRotate90(model: ModelAsset) {
    try {
      setIsProcessing(true)
      const fileBlob = await ensureModelFileDownloaded(model.id)
      if (!fileBlob) {
        setMessage('Não foi possível obter o arquivo 3D para rotacionar.')
        return
      }
      const stored = await shelfDatabase.models.get(model.id)
      if (!stored) return

      const targetShelf = model.shelfId ? shelves.find((s) => s.id === model.shelfId) : undefined
      const targetSettings = resolveViewerSettings(targetShelf?.settings, globalSettings, theme)
      const rotatedFile = await rotateGlbModel(fileBlob, Math.PI / 2, model.name)
      const newThumbnail = await generateModelThumbnail(rotatedFile, targetSettings)

      await shelfDatabase.models.put({
        ...stored,
        file: rotatedFile,
        thumbnail: newThumbnail ?? undefined,
        sizeBytes: rotatedFile.size,
      })

      if (newThumbnail) {
        if (thumbnailUrlsRef.current[model.id]) {
          URL.revokeObjectURL(thumbnailUrlsRef.current[model.id])
        }
        const url = URL.createObjectURL(newThumbnail)
        thumbnailUrlsRef.current[model.id] = url
        setThumbnailUrls((current) => ({ ...current, [model.id]: url }))
      }

      setModels((current) =>
        current.map((m) => (m.id === model.id ? { ...m, sizeBytes: rotatedFile.size } : m))
      )
      setMessage(`Modelo "${model.name}" rotacionado 90° com sucesso.`)
    } catch (err) {
      console.error(err)
      setMessage('Erro ao rotacionar modelo 3D.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Regenerate all thumbnails
  async function regenerateAllThumbnails() {
    try {
      setIsProcessing(true)
      setMessage('Gerando novas miniaturas em alta resolução...')

      const storedModels = await shelfDatabase.models.toArray()
      let count = 0
      for (let i = 0; i < storedModels.length; i++) {
        const stored = storedModels[i]
        if (!stored.file) continue
        setMessage(`Atualizando miniatura (${i + 1}/${storedModels.length}): ${stored.name}...`)
        const modelShelf = stored.shelfId ? shelves.find((s) => s.id === stored.shelfId) : undefined
        const modelSettings = resolveViewerSettings(modelShelf?.settings, globalSettings, theme)
        const newThumbnail = await generateModelThumbnail(stored.file, modelSettings)
        if (newThumbnail) {
          await shelfDatabase.models.put({ ...stored, thumbnail: newThumbnail })
          if (thumbnailUrlsRef.current[stored.id]) {
            URL.revokeObjectURL(thumbnailUrlsRef.current[stored.id])
          }
          const url = URL.createObjectURL(newThumbnail)
          thumbnailUrlsRef.current[stored.id] = url
          setThumbnailUrls((current) => ({ ...current, [stored.id]: url }))
          count++
        }
      }

      setMessage(`Miniaturas verticais atualizadas com sucesso (${count} modelos).`)
    } catch (err) {
      console.error('Erro ao regenerar todas as miniaturas:', err)
      setMessage('Erro ao atualizar miniaturas.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Regenerate thumbnails for a specific shelf
  async function regenerateShelfThumbnails(shelfId: string, customSettings?: ShelfViewerSettings) {
    try {
      setIsProcessing(true)
      setMessage('Atualizando miniaturas com o ambiente configurado...')

      const targetShelf = shelves.find((s) => s.id === shelfId)
      const shelfSettings = customSettings || targetShelf?.settings
      const resolvedSettings = resolveViewerSettings(shelfSettings, globalSettings, theme)

      let targetModels: ModelAsset[] = []
      if (shelfId === 'all') {
        targetModels = unassignedModels.length > 0 ? unassignedModels : models
      } else if (targetShelf) {
        if (targetShelf.modelIds && targetShelf.modelIds.length > 0) {
          const idMap = new Map(models.map((m) => [m.id, m]))
          const shelfModels = targetShelf.modelIds.map((id) => idMap.get(id)).filter(Boolean) as ModelAsset[]
          const unlistedShelfModels = models.filter((m) => m.shelfId === shelfId && !targetShelf.modelIds.includes(m.id))
          targetModels = [...shelfModels, ...unlistedShelfModels]
        } else {
          targetModels = models.filter((m) => m.shelfId === shelfId)
        }
      }

      if (targetModels.length === 0) {
        setMessage('Nenhum modelo encontrado nesta biblioteca para atualizar.')
        return
      }

      let count = 0
      for (let i = 0; i < targetModels.length; i++) {
        const m = targetModels[i]
        setMessage(`Atualizando miniatura (${i + 1}/${targetModels.length}): ${m.name}...`)
        const stored = await shelfDatabase.models.get(m.id)
        if (stored?.file) {
          const thumb = await generateModelThumbnail(stored.file, resolvedSettings)
          if (thumb) {
            await shelfDatabase.models.put({ ...stored, thumbnail: thumb })
            if (thumbnailUrlsRef.current[m.id]) {
              URL.revokeObjectURL(thumbnailUrlsRef.current[m.id])
            }
            const url = URL.createObjectURL(thumb)
            thumbnailUrlsRef.current[m.id] = url
            setThumbnailUrls((current) => ({ ...current, [m.id]: url }))
            count++
          }
        }
      }
      setMessage(`Miniaturas atualizadas com o novo ambiente (${count} modelos).`)
    } catch (err) {
      console.error('Erro ao atualizar miniaturas da prateleira:', err)
      setMessage('Erro ao atualizar miniaturas.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Save model name
  async function saveModelName(model: ModelAsset) {
    const trimmed = editingModelName.trim()
    if (!trimmed || trimmed === model.name) {
      setEditingModelId(null)
      return
    }
    await updateModel(model, { name: trimmed })
    setEditingModelId(null)
  }

  // Shelf operations
  async function saveShelf() {
    const name = shelfName.trim()
    if (!name) return
    if (shelfDialog?.mode === 'rename' && shelfDialog.shelf) {
      const updatedShelf = { ...shelfDialog.shelf, name }
      await shelfDatabase.shelves.put(updatedShelf)
      setShelves((current) => current.map((item) => (item.id === updatedShelf.id ? updatedShelf : item)))
    } else {
      const shelf: Shelf = {
        id: crypto.randomUUID(),
        name,
        modelIds: [],
        createdAt: new Date().toISOString(),
      }
      await shelfDatabase.shelves.put(shelf)
      setShelves((current) => [...current, shelf])
      setActiveShelfId(shelf.id)
    }
    setShelfDialog(null)
    setShelfName('')
  }

  async function renameShelf(shelf: Shelf) {
    setShelfName(shelf.name)
    setShelfDialog({ mode: 'rename', shelf })
  }

  async function deleteShelf(shelf: Shelf) {
    if (!window.confirm(`Excluir a prateleira “${shelf.name}”? Os modelos ficarão sem biblioteca.`)) return
    await shelfDatabase.transaction('rw', shelfDatabase.shelves, shelfDatabase.models, async () => {
      const shelfModels = await shelfDatabase.models.where('shelfId').equals(shelf.id).toArray()
      await Promise.all(shelfModels.map((model) => shelfDatabase.models.update(model.id, { shelfId: undefined })))
      await shelfDatabase.shelves.delete(shelf.id)
    })
    setShelves((current) => current.filter((item) => item.id !== shelf.id))
    setModels((current) => current.map((model) => (model.shelfId === shelf.id ? { ...model, shelfId: undefined } : model)))
    setActiveShelfId('all')
  }

  async function updateModel(model: ModelAsset, changes: Partial<ModelAsset>) {
    const updatedModel = { ...model, ...changes }
    await shelfDatabase.models.update(model.id, changes)
    setModels((current) => current.map((item) => (item.id === model.id ? updatedModel : item)))
  }

  async function moveModelInShelf(model: ModelAsset, direction: 'up' | 'down') {
    const shelf = shelves.find((item) => item.id === model.shelfId)
    if (!shelf) return
    const index = shelf.modelIds.indexOf(model.id)
    const delta = direction === 'up' ? -1 : 1
    const nextIndex = index + delta
    if (index < 0 || nextIndex < 0 || nextIndex >= shelf.modelIds.length) return
    const modelIds = [...shelf.modelIds]
    ;[modelIds[index], modelIds[nextIndex]] = [modelIds[nextIndex], modelIds[index]]
    const updatedShelf = { ...shelf, modelIds }
    await shelfDatabase.shelves.put(updatedShelf)
    setShelves((current) => current.map((item) => (item.id === shelf.id ? updatedShelf : item)))
  }

  async function deleteModel(model: ModelAsset) {
    if (!window.confirm(`Excluir o modelo “${model.name}”?`)) return
    await shelfDatabase.transaction('rw', shelfDatabase.models, shelfDatabase.shelves, async () => {
      await shelfDatabase.models.delete(model.id)
      await Promise.all(
        shelves.map((shelf) =>
          shelf.modelIds.includes(model.id)
            ? shelfDatabase.shelves.put({ ...shelf, modelIds: shelf.modelIds.filter((id) => id !== model.id) })
            : Promise.resolve()
        )
      )
    })
    setModels((current) => current.filter((item) => item.id !== model.id))
    setShelves((current) => current.map((shelf) => ({ ...shelf, modelIds: shelf.modelIds.filter((id) => id !== model.id) })))
    const thumbnailUrl = thumbnailUrlsRef.current[model.id]
    if (thumbnailUrl) {
      URL.revokeObjectURL(thumbnailUrl)
      delete thumbnailUrlsRef.current[model.id]
      setThumbnailUrls((current) => {
        const next = { ...current }
        delete next[model.id]
        return next
      })
    }
    setMessage(`${model.name} excluído.`)
  }

  async function moveToShelf(model: ModelAsset, shelfId: string | undefined) {
    if (model.shelfId === shelfId) return
    const origin = shelves.find((shelf) => shelf.id === model.shelfId)
    const destination = shelfId ? shelves.find((shelf) => shelf.id === shelfId) : undefined
    if (shelfId && !destination) return
    await updateModel(model, { shelfId })
    const updatedShelves = shelves.map((shelf) => {
      if (shelf.id === origin?.id) return { ...shelf, modelIds: shelf.modelIds.filter((id) => id !== model.id) }
      if (shelf.id === destination?.id) return { ...shelf, modelIds: [...(shelf.modelIds || []), model.id] }
      return shelf
    })
    await shelfDatabase.shelves.bulkPut(updatedShelves)
    setShelves(updatedShelves)
  }

  // Showcase presentation mode trigger
  function handleStartShowcase(shelfId: string) {
    let targetShelf: Shelf | undefined
    let targetShelfName = 'Sem biblioteca'
    let targetModels: ModelAsset[] = []

    if (shelfId === 'all') {
      targetShelf = undefined
      targetShelfName = 'Sem biblioteca'
      targetModels = unassignedModels
    } else {
      targetShelf = shelves.find((s) => s.id === shelfId)
      targetShelfName = targetShelf?.name || 'Biblioteca'
      if (targetShelf && targetShelf.modelIds.length > 0) {
        const idMap = new Map(models.map((m) => [m.id, m]))
        targetModels = targetShelf.modelIds.map((id) => idMap.get(id)).filter(Boolean) as ModelAsset[]
      } else {
        targetModels = models.filter((m) => m.shelfId === shelfId)
      }
    }

    if (targetModels.length === 0) {
      setMessage(`A biblioteca "${targetShelfName}" não possui modelos 3D para exibir na apresentação.`)
      return
    }

    setShowcaseShelf({
      shelfId,
      shelfName: targetShelfName,
      models: targetModels,
      settings: resolveViewerSettings(targetShelf?.settings, globalSettings, theme),
    })
  }

  // Download model
  async function downloadModel(model: ModelAsset) {
    try {
      setIsProcessing(true)
      setMessage(`Baixando "${model.name}"...`)
      const fileBlob = await ensureModelFileDownloaded(model.id)
      if (!fileBlob) throw new Error('Arquivo não encontrado')
      const url = URL.createObjectURL(fileBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${model.name}.${model.format}`
      a.click()
      URL.revokeObjectURL(url)
      setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, inCloud: false } : m)))
      setMessage(`Download de "${model.name}" concluído!`)
    } catch (err) {
      console.error(err)
      setMessage('Erro ao baixar o modelo 3D.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Open model modal
  function openModel(model: ModelAsset) {
    setSelectedModel(model)
  }

  // Shelf settings handlers
  async function handleUpdateShelfSettings(shelfId: string, updates: ShelfViewerSettings) {
    if (shelfId === 'all') {
      const updatedGlobal: GlobalSettings = {
        ...globalSettings,
        viewer: { ...globalSettings.viewer, ...updates },
      }
      setGlobalSettings(updatedGlobal)
      saveStoredGlobalSettings(updatedGlobal)
      return
    }
    const targetShelf = shelves.find((s) => s.id === shelfId)
    if (!targetShelf) return

    const newSettings = { ...targetShelf.settings, ...updates }
    const updatedShelf = { ...targetShelf, settings: newSettings }
    await shelfDatabase.shelves.put(updatedShelf)
    setShelves((current) => current.map((s) => (s.id === shelfId ? updatedShelf : s)))
  }

  async function handleResetShelfSettings(shelfId: string) {
    if (shelfId === 'all') return
    const targetShelf = shelves.find((s) => s.id === shelfId)
    if (!targetShelf) return

    const updatedShelf = { ...targetShelf, settings: undefined }
    await shelfDatabase.shelves.put(updatedShelf)
    setShelves((current) => current.map((s) => (s.id === shelfId ? updatedShelf : s)))
  }

  // Global settings save
  function handleSaveGlobalSettings(newSettings: GlobalSettings) {
    setGlobalSettings(newSettings)
    saveStoredGlobalSettings(newSettings)
    setTheme(newSettings.theme)
    if (newSettings.defaultSortBy) setSortBy(newSettings.defaultSortBy)
    if (newSettings.defaultViewMode) setViewMode(newSettings.defaultViewMode)
    setMessage('Configurações salvas.')
  }

  // Catalog Export / Import
  async function handleExportCatalog() {
    try {
      setIsProcessing(true)
      const data = {
        models: await shelfDatabase.models.toArray(),
        shelves: await shelfDatabase.shelves.toArray(),
        globalSettings,
      }
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prateleira-3d-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage('Backup do catálogo exportado com sucesso.')
    } catch (err) {
      console.error(err)
      setMessage('Falha ao exportar catálogo.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleClearAllData() {
    if (!window.confirm('Tem certeza que deseja apagar TODOS os dados e modelos do aplicativo? Esta ação é irreversível.')) {
      return
    }
    try {
      setIsProcessing(true)
      await shelfDatabase.models.clear()
      await shelfDatabase.shelves.clear()
      await reloadAllData()
      setMessage('Todos os dados foram apagados com sucesso.')
    } catch (err) {
      console.error(err)
      setMessage('Erro ao apagar banco de dados.')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleViewModeChange(mode: 'showcase' | 'compact') {
    setViewMode(mode)
    const updated = { ...globalSettings, defaultViewMode: mode }
    setGlobalSettings(updated)
    saveStoredGlobalSettings(updated)
  }

  async function handleModelGeneratedAndImport(file: File) {
    await importFiles([file])
  }

  const activeShelf = shelves.find((shelf) => shelf.id === activeShelfId)
  const shelfMap = useMemo(() => Object.fromEntries(shelves.map((s) => [s.id, s.name])), [shelves])

  const unassignedModels = useMemo(() => {
    return models.filter((m) => {
      const hasValidShelfId = Boolean(m.shelfId && shelves.some((s) => s.id === m.shelfId))
      const isInShelfList = shelves.some((s) => s.modelIds?.includes(m.id))
      return !hasValidShelfId && !isInShelfList
    })
  }, [models, shelves])

  const visibleModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    let list: ModelAsset[] = []

    if (activeShelfId === 'all') {
      list = [...unassignedModels]
    } else if (activeShelf) {
      if (activeShelf.modelIds && activeShelf.modelIds.length > 0) {
        const idMap = new Map(models.map((m) => [m.id, m]))
        const shelfModels = activeShelf.modelIds.map((id) => idMap.get(id)).filter(Boolean) as ModelAsset[]
        const unlistedShelfModels = models.filter((m) => m.shelfId === activeShelfId && !activeShelf.modelIds.includes(m.id))
        list = [...shelfModels, ...unlistedShelfModels]
      } else {
        list = models.filter((m) => m.shelfId === activeShelfId)
      }
    } else {
      list = models.filter((m) => m.shelfId === activeShelfId)
    }

    if (normalizedQuery) {
      list = list.filter(
        (model) =>
          model.name.toLowerCase().includes(normalizedQuery) ||
          model.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      )
    }

    const sorted = [...list]
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
      case 'date-desc':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'date-asc':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'size-desc':
        return sorted.sort((a, b) => b.sizeBytes - a.sizeBytes)
      case 'size-asc':
        return sorted.sort((a, b) => a.sizeBytes - b.sizeBytes)
      case 'custom':
      default:
        return sorted
    }
  }, [models, activeShelfId, activeShelf, unassignedModels, query, sortBy])

  const openFilePicker = () => fileInputRef.current?.click()
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    void importFiles(event.dataTransfer.files)
  }

  const activeViewerConfig = useMemo(() => {
    const targetShelf = selectedModel?.shelfId
      ? shelves.find((s) => s.id === selectedModel.shelfId)
      : activeShelf
    return resolveViewerSettings(targetShelf?.settings, globalSettings, theme)
  }, [selectedModel, activeShelf, shelves, globalSettings, theme])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Grid3X3 size={18} strokeWidth={2.5} />
          </div>
          <span>
            prateleira<span className="brand-accent">.3d</span>
          </span>
        </div>

        <nav className="topbar-nav-tabs">
          <button
            type="button"
            className={`topbar-nav-tab ${activePage === 'library' ? 'active' : ''}`}
            onClick={() => setActivePage('library')}
            title="Biblioteca"
            aria-label="Biblioteca"
          >
            <Library size={16} />
            <span>Biblioteca</span>
          </button>
          <button
            type="button"
            className={`topbar-nav-tab ${activePage === 'editor' ? 'active' : ''}`}
            onClick={() => setActivePage('editor')}
            title="Editor 3D"
            aria-label="Editor 3D"
          >
            <Box size={16} />
            <span>Editor 3D</span>
          </button>
        </nav>

        <div className="topbar-status">
          <span className="status-dot" /> somente neste dispositivo
        </div>

        <div className="topbar-actions">
          {isInstallable && (
            <button
              type="button"
              className="pwa-install-topbar-btn"
              onClick={() => void promptInstall()}
              title="Instalar Prateleira 3D no Chrome"
            >
              <Download size={15} />
              <span className="topbar-btn-text">Instalar App</span>
            </button>
          )}

          <button
            type="button"
            className="gdrive-topbar-btn"
            onClick={() => {
              setSettingsInitialTab('gdrive')
              setShowGlobalSettingsModal(true)
            }}
            title="Backup e Sincronização no Google Drive"
          >
            <Cloud size={15} />
            <span className="topbar-btn-text">Google Drive</span>
          </button>

          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
            aria-label={theme === 'dark' ? 'Alternar para modo claro' : 'Alternar para modo escuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span className="theme-toggle-text">{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
          </button>
        </div>
      </header>

      {activePage === 'editor' ? (
        <div className="editor-page-container">
          <EditorPage
            availableModels={models}
            thumbnailUrls={thumbnailUrls}
            getModelUrl={async (asset) => {
              const stored = await shelfDatabase.models.get(asset.id)
              if (!stored?.file) throw new Error('Arquivo não encontrado')
              return URL.createObjectURL(stored.file)
            }}
            onClose={() => setActivePage('library')}
            onSaveToLibrary={async (file) => {
              await importFiles([file])
            }}
          />
        </div>
      ) : (
        <div className="workspace">
          <aside className="sidebar">
            <div className="sidebar-heading">
              <span>Biblioteca</span>
              <button
                className="small-icon-button"
                aria-label="Criar prateleira"
                onClick={() => {
                  setShelfName('Nova prateleira')
                  setShelfDialog({ mode: 'create' })
                }}
              >
                <Plus size={16} />
              </button>
            </div>

            <nav className="shelf-nav">
              <button
                type="button"
                className={`shelf-link ${activeShelfId === 'all' ? 'active' : ''}`}
                onClick={() => setActiveShelfId('all')}
              >
                <Library size={17} />
                <span>Sem biblioteca</span>
                <b>{unassignedModels.length}</b>
              </button>

              {shelves.map((shelf) => (
                <div key={shelf.id} className="shelf-row">
                  <button
                    type="button"
                    className={`shelf-link ${activeShelfId === shelf.id ? 'active' : ''}`}
                    onClick={() => setActiveShelfId(shelf.id)}
                  >
                    <FolderPlus size={17} />
                    <span>{shelf.name}</span>
                    <b>{shelf.modelIds?.length || 0}</b>
                  </button>
                  <div className="shelf-actions">
                    <button
                      type="button"
                      aria-label={`Modo Apresentação ${shelf.name}`}
                      title={`Modo Apresentação 3D: ${shelf.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartShowcase(shelf.id)
                      }}
                    >
                      <Play size={12} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Renomear ${shelf.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void renameShelf(shelf)
                      }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir ${shelf.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void deleteShelf(shelf)
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </nav>

            <div className="sidebar-foot">
              <button
                type="button"
                className="sidebar-settings-btn"
                onClick={() => {
                  setSettingsInitialTab('viewer')
                  setShowGlobalSettingsModal(true)
                }}
                title="Abrir configurações globais do aplicativo"
              >
                <Settings size={15} />
                <span>Configurações globais</span>
              </button>

              <div className="sidebar-storage-block">
                <span className="storage-label">armazenamento local</span>
                <div className="storage-track">
                  <span />
                </div>
                <span className="storage-value">{storageUsed} · limite 250 MB</span>
              </div>
            </div>
          </aside>

          <section className="content">
            <div className="content-head">
              <div>
                <p className="eyebrow">biblioteca / {(activeShelf?.name ?? 'sem biblioteca').toLowerCase()}</p>
                <h1>{activeShelf?.name ?? 'Sem biblioteca'}</h1>
              </div>
              <div className="content-actions">
                <button
                  type="button"
                  className="showcase-mode-header-btn"
                  onClick={() => handleStartShowcase(activeShelfId)}
                  disabled={isProcessing || visibleModels.length === 0}
                  title="Exibir modelos da biblioteca em tela cheia no modo detalhe (slideshow automático 3D)"
                >
                  <Play size={15} fill="currentColor" />
                  <span>Apresentação 3D</span>
                </button>
                <button
                  className="ai-generator-trigger-btn"
                  onClick={() => setShowAiGeneratorModal(true)}
                  disabled={isProcessing}
                  title="Gerar modelo 3D a partir de foto ou prompt com Inteligência Artificial (Tripo3D)"
                >
                  <Sparkles size={16} />
                  <span>Gerar com IA</span>
                </button>
                <button className="upload-button" onClick={openFilePicker} disabled={isProcessing}>
                  <Upload size={16} /> Importar modelos
                </button>
              </div>
            </div>

            <ShelfSettingsBar
              shelf={activeShelf}
              isAllShelf={activeShelfId === 'all'}
              isProcessing={isProcessing}
              globalViewerSettings={globalSettings.viewer}
              onUpdateSettings={(newViewerSettings) => handleUpdateShelfSettings(activeShelfId, newViewerSettings)}
              onResetToGlobal={() => handleResetShelfSettings(activeShelfId)}
              onRegenerateShelfThumbnails={(settings) => regenerateShelfThumbnails(activeShelfId, settings)}
            />

            <div className="toolbar">
              <label className="search-box">
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar modelo por nome ou tag..."
                />
              </label>

              <div className="sort-box" title="Ordenar biblioteca">
                <ArrowUpDown size={15} />
                <select
                  aria-label="Ordenar biblioteca por"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="custom">Ordem manual / padrão</option>
                  <option value="name-asc">Nome (A - Z)</option>
                  <option value="name-desc">Nome (Z - A)</option>
                  <option value="date-desc">Mais recentes primeiro</option>
                  <option value="date-asc">Mais antigos primeiro</option>
                  <option value="size-desc">Tamanho (Maior primeiro)</option>
                  <option value="size-asc">Tamanho (Menor primeiro)</option>
                </select>
              </div>

              {models.length > 0 && (
                <button
                  className="toolbar-action-btn"
                  title="Regenerar thumbnails verticais em alta resolução"
                  onClick={() => void regenerateAllThumbnails()}
                  disabled={isProcessing}
                >
                  <RefreshCw size={14} className={isProcessing ? 'spin' : ''} />
                  <span>Atualizar thumbnails</span>
                </button>
              )}

              <div className="view-controls">
                <button
                  className={`view-toggle ${viewMode === 'showcase' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('showcase')}
                  title="Visualização Detalhada em Cards (Showcase)"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  className={`view-toggle ${viewMode === 'compact' ? 'active' : ''}`}
                  onClick={() => handleViewModeChange('compact')}
                  title="Visualização Compacta em Grade (Compact Grid)"
                >
                  <Grid3X3 size={15} />
                </button>
              </div>
            </div>

            {message && (
              <div className="feedback">
                <span>{message}</span>
                <button
                  type="button"
                  className="feedback-close-btn"
                  onClick={() => setMessage('')}
                  title="Fechar mensagem"
                  aria-label="Fechar mensagem"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              className="file-input-hidden"
              type="file"
              accept=".glb,.gltf"
              multiple
              onChange={(event) => {
                if (event.target.files) void importFiles(event.target.files)
              }}
            />

            {visibleModels.length === 0 ? (
              <div className="empty-state" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
                <div className="empty-icon">
                  <Upload size={28} />
                </div>
                <h2>
                  {activeShelfId === 'all' && models.length > 0
                    ? 'Nenhum modelo sem biblioteca'
                    : 'Sua biblioteca 3D começa aqui'}
                </h2>
                <p>
                  {activeShelfId === 'all' && models.length > 0
                    ? 'Todos os seus modelos 3D estão organizados em prateleiras. Importe ou desvincule modelos para exibi-los aqui.'
                    : 'Adicione modelos GLB ou glTF para montar sua galeria com visualização vertical e detalhada.'}
                </p>
                <button className="empty-action" onClick={openFilePicker} disabled={isProcessing}>
                  <Plus size={16} /> Adicionar primeiro modelo
                </button>
                <span className="file-hint">arraste arquivos para cá ou use o botão acima</span>
              </div>
            ) : viewMode === 'compact' ? (
              <div className="compact-grid" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
                {visibleModels.map((model) => {
                  const shelfName = model.shelfId ? shelfMap[model.shelfId] : undefined
                  return (
                    <div
                      key={model.id}
                      className="compact-card"
                      onClick={() => void openModel(model)}
                      title={`Abrir ${model.name}`}
                    >
                      <div className="compact-card-media">
                        {thumbnailUrls[model.id] ? (
                          <img src={thumbnailUrls[model.id]} alt={model.name} loading="lazy" />
                        ) : (
                          <div className="compact-placeholder">
                            <Box size={18} />
                          </div>
                        )}
                        {model.inCloud && (
                          <span
                            className="compact-cloud-badge"
                            title="Modelo salvo no Google Drive (o arquivo 3D será baixado ao abrir)"
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: 'rgba(16, 185, 129, 0.85)',
                              color: '#fff',
                              borderRadius: '4px',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              zIndex: 2,
                            }}
                          >
                            <Cloud size={10} />
                          </span>
                        )}
                      </div>
                      <div className="compact-card-body">
                        <h3 className="compact-title">{model.name}</h3>
                        {shelfName && <span className="compact-shelf-badge">{shelfName}</span>}
                      </div>
                      <div className="compact-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="compact-action-btn"
                          title="Visualizar modelo 3D em tela cheia"
                          onClick={() => void openModel(model)}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="compact-action-btn"
                          title="Baixar modelo 3D"
                          onClick={() => void downloadModel(model)}
                        >
                          <Download size={13} />
                        </button>
                        <button
                          type="button"
                          className="compact-action-btn danger"
                          title="Excluir modelo"
                          onClick={() => void deleteModel(model)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`model-grid ${viewMode}`} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
                {visibleModels.map((model, index) => {
                  const isFirst = index === 0
                  const isLast = index === visibleModels.length - 1

                  return (
                    <article className="model-card" key={model.id}>
                      <div className="model-thumb-wrapper" onClick={() => openModel(model)}>
                        <button className="model-thumb-btn" aria-label={`Visualizar ${model.name}`}>
                          {thumbnailUrls[model.id] ? (
                            <img src={thumbnailUrls[model.id]} alt="" className="model-thumb-image" />
                          ) : (
                            <div className={`model-thumb-placeholder ${model.format}`}>
                              <Grid3X3 size={32} />
                            </div>
                          )}
                        </button>

                        <div className="thumb-overlay-top">
                          {model.inCloud && (
                            <span
                              className="model-cloud-badge"
                              title="Modelo salvo no Google Drive (o arquivo 3D será baixado ao abrir)"
                              style={{
                                background: 'rgba(16, 185, 129, 0.9)',
                                color: '#fff',
                                borderRadius: '12px',
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                              }}
                            >
                              <Cloud size={12} />
                              <span>Nuvem</span>
                            </span>
                          )}
                          <div className="thumb-hover-actions">
                            {model.shelfId && (
                              <>
                                <button
                                  className="thumb-icon-btn"
                                  title="Mover para cima"
                                  disabled={isFirst}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void moveModelInShelf(model, 'up')
                                  }}
                                >
                                  <ArrowUp size={13} />
                                </button>
                                <button
                                  className="thumb-icon-btn"
                                  title="Mover para baixo"
                                  disabled={isLast}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void moveModelInShelf(model, 'down')
                                  }}
                                >
                                  <ArrowDown size={13} />
                                </button>
                              </>
                            )}
                            <button
                              className="thumb-icon-btn"
                              title="Rotacionar 90°"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleRotate90(model)
                              }}
                            >
                              <RotateCw size={13} />
                            </button>
                            <button
                              className="thumb-icon-btn delete"
                              title="Excluir"
                              onClick={(e) => {
                                e.stopPropagation()
                                void deleteModel(model)
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="thumb-action-overlay">
                          <div className="thumb-preview-pill">
                            <Eye size={15} />
                            <span>Inspecionar 3D</span>
                          </div>
                        </div>

                        <div className="thumb-hover-bottom" onClick={(e) => e.stopPropagation()}>
                          <select
                            aria-label={`Mover ${model.name}`}
                            value={model.shelfId ?? ''}
                            onChange={(event) => void moveToShelf(model, event.target.value || undefined)}
                          >
                            <option value="">Sem biblioteca</option>
                            {shelves.map((shelf) => (
                              <option key={shelf.id} value={shelf.id}>
                                📁 {shelf.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="model-card-body">
                        <div className="model-title-row">
                          {editingModelId === model.id ? (
                            <input
                              autoFocus
                              className="model-name-input"
                              value={editingModelName}
                              onChange={(e) => setEditingModelName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  void saveModelName(model)
                                } else if (e.key === 'Escape') {
                                  setEditingModelId(null)
                                }
                              }}
                              onBlur={() => void saveModelName(model)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <>
                              <h2
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingModelId(model.id)
                                  setEditingModelName(model.name)
                                }}
                                title="Clique para renomear"
                                className="cursor-pointer"
                              >
                                {model.name}
                              </h2>
                              <button
                                type="button"
                                className="model-name-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingModelId(model.id)
                                  setEditingModelName(model.name)
                                }}
                                title="Renomear modelo"
                                aria-label="Renomear modelo"
                              >
                                <Pencil size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Global Settings Modal */}
      {showGlobalSettingsModal && (
        <GlobalSettingsModal
          settings={globalSettings}
          storageUsed={storageUsed}
          isProcessing={isProcessing}
          shelves={shelves}
          initialTab={settingsInitialTab}
          onSave={handleSaveGlobalSettings}
          onClose={() => {
            setShowGlobalSettingsModal(false)
            setSettingsInitialTab('viewer')
          }}
          onRegenerateThumbnails={regenerateAllThumbnails}
          onExportCatalog={handleExportCatalog}
          onClearAllData={handleClearAllData}
          onDataRestored={reloadAllData}
        />
      )}

      {/* AI 3D Generator Modal */}
      <AiModelGeneratorModal
        isOpen={showAiGeneratorModal}
        onClose={() => setShowAiGeneratorModal(false)}
        shelves={shelves}
        activeShelfId={activeShelfId}
        onModelGeneratedAndImport={handleModelGeneratedAndImport}
      />

      {/* 3D Model Single Inspection Modal */}
      {selectedModel && selectedModelUrl && (
        <ModelViewerModal
          model={selectedModel}
          modelUrl={selectedModelUrl}
          initialSettings={activeViewerConfig}
          onClose={() => setSelectedModel(null)}
          onRotateModel={async (deg) => handleRotate90(selectedModel)}
        />
      )}

      {/* Shelf Showcase 3D Fullscreen Slideshow Modal */}
      {showcaseShelf && (
        <ShelfShowcaseModal
          shelfName={showcaseShelf.shelfName}
          models={showcaseShelf.models}
          viewerSettings={showcaseShelf.settings}
          onClose={() => setShowcaseShelf(null)}
        />
      )}

      {/* Shelf Create/Rename Dialog */}
      {shelfDialog && (
        <div className="dialog-backdrop" role="presentation">
          <form
            className="name-dialog"
            onSubmit={(event) => {
              event.preventDefault()
              void saveShelf()
            }}
          >
            <span className="eyebrow">biblioteca</span>
            <h2>{shelfDialog.mode === 'create' ? 'Nova prateleira' : 'Renomear prateleira'}</h2>
            <input
              autoFocus
              value={shelfName}
              onChange={(event) => setShelfName(event.target.value)}
              aria-label="Nome da prateleira"
            />
            <div className="dialog-actions">
              <button type="button" onClick={() => setShelfDialog(null)}>
                cancelar
              </button>
              <button className="dialog-submit" type="submit">
                salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
