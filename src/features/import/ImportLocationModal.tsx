import {
  Check,
  CornerDownRight,
  FolderInput,
  FolderOpen,
  HardDrive,
  Info,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type ImportLocationChoice,
  type SelectedImportItem,
  getStoredImportPreference,
  getSystemModelsDirectory,
  openSystemModelsDirectory,
  saveStoredImportPreference,
  pickCustomCentralFolder,
  getCentralFolderPath,
} from './importService'

export interface ImportLocationModalProps {
  items: SelectedImportItem[]
  isOpen: boolean
  onConfirm: (choice: ImportLocationChoice) => void
  onCancel: () => void
}

export function ImportLocationModal({
  items,
  isOpen,
  onConfirm,
  onCancel,
}: ImportLocationModalProps) {
  import { pickCustomCentralFolder, getCentralFolderPath } from './importService'
import type { ImportLocationChoice } from './importService'

const [selectedChoice, setSelectedChoice] = useState<ImportLocationChoice>('move')
const [customPath, setCustomPath] = useState<string>(getCentralFolderPath() || '')
  const [rememberPreference, setRememberPreference] = useState(false)
  const [systemDir, setSystemDir] = useState<string>('Carregando caminho...')

  useEffect(() => {
    if (isOpen) {
      getSystemModelsDirectory().then(setSystemDir)
    }
    // Carrega caminho centralizado salvo, se houver
    const stored = getCentralFolderPath()
    if (stored) {
      setCustomPath(stored)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (rememberPreference) {
      saveStoredImportPreference(selectedChoice)
    }
    onConfirm(selectedChoice)
  }

  const formatTotalSize = () => {
    const totalBytes = items.reduce((acc, cur) => acc + (cur.sizeBytes || 0), 0)
    if (totalBytes < 1024 * 1024) {
      return `${Math.max(1, Math.round(totalBytes / 1024))} KB`
    }
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="import-location-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-dialog, #1a1d24)',
          border: '1px solid var(--border-medium, #2d3343)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          padding: '24px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.45)',
          color: 'var(--text-main, #f8fafc)',
          animation: 'fadeInScale 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <span
              style={{
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent-orange, #c46843)',
              }}
            >
              Importação de Modelos 3D
            </span>
            <h2 id="import-dialog-title" style={{ margin: '4px 0 0', fontSize: '19px', fontWeight: 700 }}>
              Onde deseja manter os arquivos?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title="Cancelar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected files summary */}
        <div
          style={{
            background: 'var(--bg-status, rgba(255, 255, 255, 0.04))',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '18px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <b>{items.length} arquivo(s) selecionado(s)</b>
            <div
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '11px',
                marginTop: '2px',
                maxWidth: '380px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {items.map((i) => i.name).join(', ')}
            </div>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--accent-orange, #c46843)', fontSize: '12px' }}>
            {formatTotalSize()}
          </span>
        </div>

        {/* Choice Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {/* Option 1: Move to system folder */}
          <div
            onClick={() => setSelectedChoice('move')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '12px',
              border: `2px solid ${selectedChoice === 'move' ? 'var(--accent-orange, #c46843)' : 'var(--border-subtle, #2d3343)'
                }`,
              background:
                selectedChoice === 'move'
                  ? 'rgba(196, 104, 67, 0.08)'
                  : 'var(--bg-card, rgba(255, 255, 255, 0.02))',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: selectedChoice === 'move' ? 'var(--accent-orange, #c46843)' : 'rgba(255, 255, 255, 0.06)',
                color: selectedChoice === 'move' ? '#ffffff' : 'var(--text-main, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              <FolderInput size={20} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  Mover para a pasta da biblioteca
                </span>
                {selectedChoice === 'move' && (
                  <span
                    style={{
                      background: 'var(--accent-orange, #c46843)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '12px',
                  color: 'var(--text-sub, #94a3b8)',
                  lineHeight: '1.45',
                }}
              >
                Transfere os arquivos originais para a pasta central da Prateleira 3D no computador.
                Ideal para manter todos os seus modelos centralizados em um só lugar.
              </p>

              {/* System folder preview */}
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '11px',
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                <HardDrive size={12} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '360px',
                  }}
                  title={systemDir}
                >
                  {systemDir}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openSystemModelsDirectory()
                  }}
                  title="Abrir pasta no Windows Explorer"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-orange, #c46843)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 4px',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  <FolderOpen size={12} />
                  <span>Abrir</span>
                </button>
              </div>
            </div>
          </div>

          {/* Option 2: Keep in original place */}
          <div
            onClick={() => setSelectedChoice('keep')}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              padding: '14px 16px',
              borderRadius: '12px',
              border: `2px solid ${selectedChoice === 'keep' ? 'var(--accent-primary, #2d5b58)' : 'var(--border-subtle, #2d3343)'
                }`,
              background:
                selectedChoice === 'keep'
                  ? 'rgba(45, 91, 88, 0.12)'
                  : 'var(--bg-card, rgba(255, 255, 255, 0.02))',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background:
                  selectedChoice === 'keep' ? 'var(--accent-primary, #2d5b58)' : 'rgba(255, 255, 255, 0.06)',
                color: selectedChoice === 'keep' ? '#ffffff' : 'var(--text-main, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '2px',
              }}
            >
              <CornerDownRight size={20} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  Deixar onde está
                </span>
                {selectedChoice === 'keep' && (
                  <span
                    style={{
                      background: 'var(--accent-primary, #2d5b58)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '12px',
                  color: 'var(--text-sub, #94a3b8)',
                  lineHeight: '1.45',
                }}
              >
                Mantém os arquivos originais intactos no local atual (Downloads, Área de Trabalho, etc.).
                O sistema apenas adiciona o modelo à sua biblioteca sem mover os arquivos.
              </p>
            </div>
          </div>
        </div>

        {/* Remember choice checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--text-sub, #94a3b8)',
            cursor: 'pointer',
            marginBottom: '22px',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={rememberPreference}
            onChange={(e) => setRememberPreference(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent-orange, #c46843)' }}
          />
          <span>Lembrar desta escolha para as próximas importações</span>
        </label>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-medium, #2d3343)',
              background: 'transparent',
              color: 'var(--text-main, #f8fafc)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #c46843 0%, #aa5431 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(196, 104, 67, 0.35)',
            }}
          >
            Confirmar e Importar
          </button>
        </div>
      </div>
    </div>
  )
}

