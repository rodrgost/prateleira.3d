import { Canvas } from '@react-three/fiber'
import { ArrowDown, ArrowUp, Camera, FolderPlus, Grid3X3, Library, Pencil, Plus, Search, SlidersHorizontal, Tag, Trash2, Upload, X } from 'lucide-react'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { validateModelFile } from '../domain/fileValidation'
import type { ModelAsset, SceneInstance, Shelf } from '../domain/types'
import { shelfDatabase } from '../storage/db'
import { ModelViewer } from '../features/viewer/ModelViewer'
import { ShelfScene } from '../features/shelf-scene/ShelfScene'

function ShelfPreview() {
  return (
    <>
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 6, 4]} intensity={3} color="#fff5df" />
      <mesh position={[0, -1.8, 0]}>
        <boxGeometry args={[8.4, 0.22, 2.4]} />
        <meshStandardMaterial color="#b9784a" roughness={0.7} />
      </mesh>
      {[-0.55, 0.8].map((height) => (
        <mesh key={height} position={[0, height, 0]}>
          <boxGeometry args={[8.4, 0.18, 2.1]} />
          <meshStandardMaterial color="#c88959" roughness={0.7} />
        </mesh>
      ))}
      {[-4, 4].map((x) => (
        <mesh key={x} position={[x, -0.1, 0]}>
          <boxGeometry args={[0.22, 4.1, 2.1]} />
          <meshStandardMaterial color="#9f5e3c" roughness={0.72} />
        </mesh>
      ))}
      <mesh position={[-2.7, -1.3, 0.05]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color="#e6b45e" roughness={0.35} />
      </mesh>
      <mesh position={[2.1, -0.8, 0.05]}>
        <sphereGeometry args={[0.75, 32, 20]} />
        <meshStandardMaterial color="#65a6a0" roughness={0.3} />
      </mesh>
      <mesh position={[1.2, 1.35, 0.05]} rotation={[0, 0, Math.PI / 6]}>
        <coneGeometry args={[0.62, 1.3, 6]} />
        <meshStandardMaterial color="#d76c4c" roughness={0.4} />
      </mesh>
      <OrbitControls enablePan={false} minDistance={7} maxDistance={13} />
    </>
  )
}

export function App() {
  const [activeShelfId, setActiveShelfId] = useState('all')
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<ModelAsset[]>([])
  const [shelves, setShelves] = useState<Shelf[]>([])
  const [message, setMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelAsset | null>(null)
  const [selectedModelUrl, setSelectedModelUrl] = useState('')
  const [sceneInstances, setSceneInstances] = useState<SceneInstance[]>([])
  const [sceneUrls, setSceneUrls] = useState<Record<string, string>>({})
  const [shelfDialog, setShelfDialog] = useState<{ mode: 'create' | 'rename'; shelf?: Shelf } | null>(null)
  const [shelfName, setShelfName] = useState('')
  const [storageUsed, setStorageUsed] = useState('calculando')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true
    Promise.all([shelfDatabase.models.toArray(), shelfDatabase.shelves.toArray(), shelfDatabase.sceneInstances.toArray()]).then(async ([storedModels, storedShelves, storedInstances]) => {
      let nextShelves = storedShelves
      if (nextShelves.length === 0) {
        const defaultShelf: Shelf = { id: 'default', name: 'Minha prateleira', modelIds: storedModels.map((model) => model.id), createdAt: new Date().toISOString() }
        await shelfDatabase.shelves.put(defaultShelf)
        nextShelves = [defaultShelf]
      }
      if (mounted) { setModels(storedModels); setShelves(nextShelves); setSceneInstances(storedInstances) }
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const updateStorage = async () => {
      const estimate = await navigator.storage?.estimate()
      if (estimate?.usage) setStorageUsed(formatBytes(estimate.usage))
      else if (models.length === 0) setStorageUsed('nenhum arquivo')
    }
    void updateStorage()
  }, [models])

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedModel(null)
        setShelfDialog(null)
      }
    }
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [])

  useEffect(() => {
    let objectUrl = ''
    if (selectedModel) {
      shelfDatabase.models.get(selectedModel.id).then((storedModel) => {
        if (storedModel) {
          objectUrl = URL.createObjectURL(storedModel.file)
          setSelectedModelUrl(objectUrl)
        }
      })
    } else {
      setSelectedModelUrl('')
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selectedModel])

  useEffect(() => {
    let cancelled = false
    const loadUrls = async () => {
      const entries = await Promise.all(sceneInstances.map(async (instance) => {
        const model = await shelfDatabase.models.get(instance.modelId)
        return model ? [instance.id, URL.createObjectURL(model.file)] as const : null
      }))
      if (!cancelled) setSceneUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)))
      else entries.forEach((entry) => { if (entry) URL.revokeObjectURL(entry[1]) })
    }
    void loadUrls()
    return () => { cancelled = true; setSceneUrls((current) => { Object.values(current).forEach((url) => URL.revokeObjectURL(url)); return {} }) }
  }, [sceneInstances])

  async function importFiles(files: FileList | File[]) {
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
        shelfId: 'default',
        tags: [],
        createdAt: new Date().toISOString(),
      }
      await shelfDatabase.models.put({ ...model, file })
      const defaultShelf = shelves.find((shelf) => shelf.id === 'default') ?? shelves[0]
      if (defaultShelf) {
        const updatedShelf = { ...defaultShelf, modelIds: [...defaultShelf.modelIds, model.id] }
        await shelfDatabase.shelves.put(updatedShelf)
        setShelves((current) => current.map((shelf) => shelf.id === updatedShelf.id ? updatedShelf : shelf))
      }
      imported.push(model)
    }
    if (imported.length > 0) {
      setModels((current) => [...imported, ...current])
      setMessage(`${imported.length} modelo${imported.length > 1 ? 's' : ''} importado${imported.length > 1 ? 's' : ''}.`)
    }
  }

  async function saveShelf() {
    const name = shelfName.trim()
    if (!name) return
    if (shelfDialog?.mode === 'rename' && shelfDialog.shelf) {
      const updatedShelf = { ...shelfDialog.shelf, name }
      await shelfDatabase.shelves.put(updatedShelf)
      setShelves((current) => current.map((item) => item.id === updatedShelf.id ? updatedShelf : item))
    } else {
      const shelf: Shelf = { id: crypto.randomUUID(), name, modelIds: [], createdAt: new Date().toISOString() }
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
    if (shelves.length === 1 || !window.confirm(`Excluir a prateleira “${shelf.name}”?`)) return
    const fallback = shelves.find((item) => item.id !== shelf.id)!
    await shelfDatabase.transaction('rw', shelfDatabase.shelves, shelfDatabase.models, async () => {
      const shelfModels = await shelfDatabase.models.where('shelfId').equals(shelf.id).toArray()
      await Promise.all(shelfModels.map((model) => shelfDatabase.models.update(model.id, { shelfId: fallback.id })))
      await shelfDatabase.shelves.delete(shelf.id)
      await shelfDatabase.shelves.put({ ...fallback, modelIds: [...fallback.modelIds, ...shelf.modelIds] })
    })
    setShelves((current) => current.filter((item) => item.id !== shelf.id).map((item) => item.id === fallback.id ? { ...item, modelIds: [...item.modelIds, ...shelf.modelIds] } : item))
    setModels((current) => current.map((model) => model.shelfId === shelf.id ? { ...model, shelfId: fallback.id } : model))
    setActiveShelfId(fallback.id)
  }

  async function updateModel(model: ModelAsset, changes: Partial<ModelAsset>) {
    const updatedModel = { ...model, ...changes }
    await shelfDatabase.models.update(model.id, changes)
    setModels((current) => current.map((item) => item.id === model.id ? updatedModel : item))
  }

  async function moveModel(model: ModelAsset, direction: -1 | 1) {
    const shelf = shelves.find((item) => item.id === model.shelfId)
    if (!shelf) return
    const index = shelf.modelIds.indexOf(model.id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= shelf.modelIds.length) return
    const modelIds = [...shelf.modelIds]
    ;[modelIds[index], modelIds[nextIndex]] = [modelIds[nextIndex], modelIds[index]]
    const updatedShelf = { ...shelf, modelIds }
    await shelfDatabase.shelves.put(updatedShelf)
    setShelves((current) => current.map((item) => item.id === shelf.id ? updatedShelf : item))
  }

  async function moveToShelf(model: ModelAsset, shelfId: string) {
    if (model.shelfId === shelfId) return
    const origin = shelves.find((shelf) => shelf.id === model.shelfId)
    const destination = shelves.find((shelf) => shelf.id === shelfId)
    if (!destination) return
    await updateModel(model, { shelfId })
    const updatedShelves = shelves.map((shelf) => {
      if (shelf.id === origin?.id) return { ...shelf, modelIds: shelf.modelIds.filter((id) => id !== model.id) }
      if (shelf.id === destination.id) return { ...shelf, modelIds: [...shelf.modelIds, model.id] }
      return shelf
    })
    await shelfDatabase.shelves.bulkPut(updatedShelves)
    setShelves(updatedShelves)
  }

  async function addToScene(model: ModelAsset) {
    if (sceneInstances.some((instance) => instance.modelId === model.id)) return setMessage('Este modelo já está na cena.')
    const index = sceneInstances.length
    const instance: SceneInstance = { id: crypto.randomUUID(), modelId: model.id, position: [((index % 4) - 1.5) * 1.7, index < 4 ? -1.25 : 0.5, 0.1], scale: 0.72 }
    await shelfDatabase.sceneInstances.put(instance)
    setSceneInstances((current) => [...current, instance])
    setMessage(`${model.name} adicionado à cena.`)
  }

  async function removeFromScene(instanceId: string) {
    await shelfDatabase.sceneInstances.delete(instanceId)
    setSceneInstances((current) => current.filter((instance) => instance.id !== instanceId))
  }

  async function resetScene() {
    await shelfDatabase.sceneInstances.clear()
    setSceneInstances([])
  }

  const activeShelf = shelves.find((shelf) => shelf.id === activeShelfId)
  const visibleModels = models.filter((model) => {
    const normalizedQuery = query.trim().toLowerCase()
    const inShelf = activeShelfId === 'all' || model.shelfId === activeShelfId
    return inShelf && (!normalizedQuery || model.name.toLowerCase().includes(normalizedQuery) || model.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)))
  })
  const openFilePicker = () => fileInputRef.current?.click()
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    void importFiles(event.dataTransfer.files)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Grid3X3 size={18} strokeWidth={2.5} /></div>
          <span>prateleira<span className="brand-accent">.3d</span></span>
        </div>
        <div className="topbar-status"><span className="status-dot" /> somente neste dispositivo</div>
        <button className="icon-button" aria-label="Configurações"><SlidersHorizontal size={18} /></button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading"><span>Biblioteca</span><button className="small-icon-button" aria-label="Criar prateleira" onClick={() => { setShelfName('Nova prateleira'); setShelfDialog({ mode: 'create' }) }}><Plus size={17} /></button></div>
          <nav className="shelf-nav">
            <button className={`shelf-link ${activeShelfId === 'all' ? 'active' : ''}`} onClick={() => setActiveShelfId('all')}><Library size={17} /><span>Todos os modelos</span><b>{models.length}</b></button>
            {shelves.map((shelf) => <div className="shelf-row" key={shelf.id}><button className={`shelf-link ${activeShelfId === shelf.id ? 'active' : ''}`} onClick={() => setActiveShelfId(shelf.id)}><FolderPlus size={17} /><span>{shelf.name}</span><b>{shelf.modelIds.length}</b></button><div className="shelf-actions"><button aria-label={`Renomear ${shelf.name}`} onClick={() => void renameShelf(shelf)}><Pencil size={12} /></button><button aria-label={`Excluir ${shelf.name}`} onClick={() => void deleteShelf(shelf)}><Trash2 size={12} /></button></div></div>)}
          </nav>
          <div className="sidebar-foot"><span className="storage-label">armazenamento local</span><div className="storage-track"><span /></div><span className="storage-value">{storageUsed} · limite por arquivo 250 MB</span></div>
        </aside>

        <section className="content">
          <div className="content-head">
            <div><p className="eyebrow">biblioteca / {(activeShelf?.name ?? 'todos os modelos').toLowerCase()}</p><h1>{activeShelf?.name ?? 'Todos os modelos'}</h1></div>
            <button className="upload-button" onClick={openFilePicker}><Upload size={17} /> Importar modelos</button>
          </div>
          <div className="toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou tag..." /></label><button className="view-toggle active" aria-label="Visualização em grade"><Grid3X3 size={17} /></button><button className="view-toggle" aria-label="Visualização de cena"><Camera size={17} /></button></div>
          <input ref={fileInputRef} className="file-input" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" multiple onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = '' }} />
          {message && <div className="feedback" role="status">{message}</div>}
          {visibleModels.length === 0 ? <div className="empty-state" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><div className="empty-icon"><Upload size={26} /></div><h2>Sua biblioteca começa aqui</h2><p>Adicione modelos GLB ou glTF para montar sua coleção visual.</p><button className="empty-action" onClick={openFilePicker}><Plus size={17} /> Adicionar primeiro modelo</button><span className="file-hint">arraste arquivos para esta área ou use o botão acima</span></div> : <div className="model-grid" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>{visibleModels.map((model) => <article className="model-card" key={model.id}><button className={`model-thumb ${model.format}`} aria-label={`Visualizar ${model.name}`} onClick={() => setSelectedModel(model)}><Grid3X3 size={28} /></button><div className="model-card-body"><h2>{model.name}</h2><span>{model.format.toUpperCase()} · {formatBytes(model.sizeBytes)}</span><div className="tag-line"><Tag size={12} /><input placeholder="adicionar tag" onKeyDown={(event) => { if (event.key === 'Enter' && event.currentTarget.value.trim()) { void updateModel(model, { tags: [...model.tags, event.currentTarget.value.trim()] }); event.currentTarget.value = '' } }} />{model.tags.map((tag) => <em key={tag}>{tag}</em>)}</div><div className="card-actions"><select aria-label={`Mover ${model.name}`} value={model.shelfId} onChange={(event) => void moveToShelf(model, event.target.value)}>{shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}</select><button aria-label="Adicionar à cena" onClick={() => void addToScene(model)}><Camera size={14} /></button><button aria-label="Mover para cima" onClick={() => void moveModel(model, -1)}><ArrowUp size={14} /></button><button aria-label="Mover para baixo" onClick={() => void moveModel(model, 1)}><ArrowDown size={14} /></button></div></div></article>)}</div>}
          {selectedModel && <div className="viewer-overlay" role="dialog" aria-modal="true" aria-label={`Visualizador de ${selectedModel.name}`}><div className="viewer-panel"><div className="viewer-header"><div><span className="eyebrow">visualizador / {selectedModel.format.toUpperCase()}</span><h2>{selectedModel.name}</h2></div><button className="viewer-close" aria-label="Fechar visualizador" onClick={() => setSelectedModel(null)}><X size={19} /></button></div><div className="viewer-canvas">{selectedModelUrl ? <Canvas camera={{ position: [3.8, 2.5, 4.8], fov: 42 }}><color attach="background" args={['#e8e0d4']} /><ModelViewer url={selectedModelUrl} /></Canvas> : <div className="viewer-loading" role="status">carregando modelo...</div>}</div><div className="viewer-footer"><span>órbita · zoom · enquadramento automático · esc para fechar</span><span>{formatBytes(selectedModel.sizeBytes)}</span></div></div></div>}
          <section className="scene-section"><div className="section-label"><span>Prateleira de exposição</span><span className="muted-label">cena · {sceneInstances.length} itens <button className="reset-scene" onClick={() => void resetScene()}>limpar</button></span></div><div className="scene-frame"><Canvas camera={{ position: [8.5, 4.5, 9], fov: 38 }}><color attach="background" args={['#e8e0d4']} /><ShelfScene instances={sceneInstances.filter((instance) => sceneUrls[instance.id]).map((instance) => ({ ...instance, url: sceneUrls[instance.id] }))} /></Canvas><div className="scene-caption"><span>cena conjunta</span><span>arraste para explorar</span></div></div><div className="scene-instance-list">{sceneInstances.map((instance) => <button key={instance.id} onClick={() => void removeFromScene(instance.id)}>remover · {models.find((model) => model.id === instance.modelId)?.name ?? 'modelo'}</button>)}</div></section>
        </section>
      </div>
      {shelfDialog && <div className="dialog-backdrop" role="presentation"><form className="name-dialog" onSubmit={(event) => { event.preventDefault(); void saveShelf() }}><span className="eyebrow">biblioteca</span><h2>{shelfDialog.mode === 'create' ? 'Nova prateleira' : 'Renomear prateleira'}</h2><input autoFocus value={shelfName} onChange={(event) => setShelfName(event.target.value)} aria-label="Nome da prateleira" /><div className="dialog-actions"><button type="button" onClick={() => setShelfDialog(null)}>cancelar</button><button className="dialog-submit" type="submit">salvar</button></div></form></div>}
    </main>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
