import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  Folder,
  HelpCircle,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { GlobalSettings, Shelf } from '../../domain/types'
import {
  authenticateGoogle,
  backupAllDataToDrive,
  disconnectGoogle,
  getStoredClientId,
  getStoredFolderId,
  getStoredLastBackup,
  getStoredUser,
  restoreAllDataFromDrive,
} from './googleDriveService'
import type { GDriveSyncProgress, GDriveUser } from './types'

interface GoogleDriveTabProps {
  globalSettings: GlobalSettings
  shelves: Shelf[]
  onDataRestored?: () => Promise<void>
}

export function GoogleDriveTab({ globalSettings, shelves, onDataRestored }: GoogleDriveTabProps) {
  const clientId = getStoredClientId()
  const [user, setUser] = useState<GDriveUser | null>(() => getStoredUser())
  const [lastBackup, setLastBackup] = useState<string | null>(() => getStoredLastBackup())
  const [folderId, setFolderId] = useState<string | null>(() => getStoredFolderId())
  const [showHelp, setShowHelp] = useState(false)
  const [forceFullBackup, setForceFullBackup] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<GDriveSyncProgress | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
    setLastBackup(getStoredLastBackup())
    setFolderId(getStoredFolderId())
  }, [])

  const handleConnect = async (forceConsent: boolean = true) => {
    if (!clientId.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'A variável de ambiente VITE_GOOGLE_CLIENT_ID não está configurada.',
      })
      return
    }
    setIsProcessing(true)
    setStatusMessage(null)
    try {
      const { user: authUser } = await authenticateGoogle(clientId, forceConsent)
      setUser(authUser)
      setStatusMessage({ type: 'success', text: `Conectado com sucesso como ${authUser.name || authUser.email || 'Usuário'}!` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao autenticar com Google.'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDisconnect = () => {
    disconnectGoogle()
    setUser(null)
    setFolderId(null)
    setStatusMessage({ type: 'info', text: 'Desconectado do Google Drive.' })
  }

  const handleBackup = async () => {
    if (!clientId.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Configure a variável VITE_GOOGLE_CLIENT_ID para realizar o backup.',
      })
      return
    }
    setIsProcessing(true)
    setStatusMessage(null)
    setProgress({ phase: 'auth', current: 0, total: 100, detail: 'Iniciando backup...' })

    try {
      const result = await backupAllDataToDrive({
        globalSettings,
        shelves,
        clientIdOverride: clientId,
        forceAll: forceFullBackup,
        onProgress: (p) => setProgress(p),
      })
      setLastBackup(result.timestamp)
      setFolderId(getStoredFolderId())
      setUser(getStoredUser())

      let successText = `Backup concluído com sucesso!`
      if (result.uploadedCount === 0 && result.skippedCount > 0) {
        successText = `Backup concluído! Todos os ${result.skippedCount} modelo(s) já estavam sincronizados no Google Drive (arquivos não precisaram ser reenviados). Configurações e prateleiras atualizadas.`
      } else if (result.skippedCount > 0) {
        successText = `Backup concluído com sucesso! ${result.uploadedCount} modelo(s) novo(s)/alterado(s) enviado(s) e ${result.skippedCount} já existentes foram mantidos no Drive.`
      } else {
        successText = `Backup concluído com sucesso! ${result.uploadedCount} modelo(s) salvos na pasta do Google Drive.`
      }

      setStatusMessage({
        type: 'success',
        text: successText,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro durante o backup para o Google Drive.'
      setStatusMessage({ type: 'error', text: msg })
      setProgress(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRestore = async () => {
    if (!clientId.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'Configure a variável VITE_GOOGLE_CLIENT_ID para restaurar do Google Drive.',
      })
      return
    }
    if (!window.confirm('Deseja restaurar os modelos e configurações do Google Drive? Os dados locais serão sincronizados com a nuvem.')) {
      return
    }

    setIsProcessing(true)
    setStatusMessage(null)
    setProgress({ phase: 'auth', current: 0, total: 100, detail: 'Conectando ao Google Drive...' })

    try {
      const result = await restoreAllDataFromDrive({
        clientIdOverride: clientId,
        onProgress: (p) => setProgress(p),
      })
      setUser(getStoredUser())
      setFolderId(getStoredFolderId())
      if (onDataRestored) {
        await onDataRestored()
      }
      setStatusMessage({
        type: 'success',
        text: `Restauração concluída! ${result.restoredModelsCount} modelos e ${result.restoredShelvesCount} prateleiras restaurados.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao restaurar do Google Drive.'
      setStatusMessage({ type: 'error', text: msg })
      setProgress(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const driveFolderUrl = folderId
    ? `https://drive.google.com/drive/folders/${folderId}`
    : 'https://drive.google.com/drive/my-drive'

  return (
    <div className="settings-tab-panel">
      <p className="settings-tab-desc">
        Sincronize seus modelos 3D (.glb/.gltf), capas e preferências diretamente em uma pasta dedicada <strong>Prateleira 3D</strong> no seu Google Drive.
      </p>

      {/* Missing Env Variable Alert */}
      {!clientId && (
        <div className="gdrive-alert-banner error" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} />
          <div style={{ flex: 1 }}>
            <strong>Variável de ambiente VITE_GOOGLE_CLIENT_ID não configurada</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
              Para habilitar a integração com o Google Drive, adicione <code>VITE_GOOGLE_CLIENT_ID=seu_client_id</code> no arquivo <code>.env</code> ou nas variáveis de ambiente do Railway.
            </p>
          </div>
        </div>
      )}

      {/* 1. Account / Connection Status Card */}
      <div className="gdrive-status-card">
        <div className="gdrive-status-header">
          <div className="gdrive-user-info">
            {user?.picture ? (
              <img src={user.picture} alt="Avatar" className="gdrive-avatar" />
            ) : (
              <div className="gdrive-avatar-placeholder">
                <Cloud size={22} />
              </div>
            )}
            <div>
              <div className="gdrive-title-row">
                <h3>{user ? user.name || 'Conta Google Conectada' : 'Google Drive Não Conectado'}</h3>
                <span className={`gdrive-badge ${user ? 'connected' : 'disconnected'}`}>
                  <span className="badge-dot" />
                  {user ? 'Conectado' : 'Desconectado'}
                </span>
              </div>
              <p className="gdrive-subtitle">
                {user?.email ? user.email : 'Faça login com sua conta Google para salvar seus arquivos na nuvem.'}
              </p>
            </div>
          </div>

          <div className="gdrive-header-actions">
            {user ? (
              <button
                type="button"
                className="gdrive-btn-secondary"
                onClick={handleDisconnect}
                disabled={isProcessing}
                title="Desconectar conta Google"
              >
                <LogOut size={15} />
                <span>Desconectar</span>
              </button>
            ) : (
              <button
                type="button"
                className="gdrive-btn-primary"
                onClick={() => handleConnect()}
                disabled={isProcessing || !clientId.trim()}
              >
                <Cloud size={16} />
                <span>Conectar com Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Folder link & last sync */}
        <div className="gdrive-meta-row">
          <div className="gdrive-meta-item">
            <Folder size={14} />
            <span>Pasta no Drive: <strong>Prateleira 3D</strong></span>
            {folderId && (
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="gdrive-link"
                title="Abrir pasta no Google Drive"
              >
                <span>Abrir</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {lastBackup && (
            <div className="gdrive-meta-item">
              <Sparkles size={14} />
              <span>Último backup: <strong>{new Date(lastBackup).toLocaleString('pt-BR')}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Instructions / Help Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button
          type="button"
          className="gdrive-help-toggle"
          onClick={() => setShowHelp(!showHelp)}
          title="Como obter um Client ID no Google Cloud Console"
        >
          <HelpCircle size={14} />
          <span>{showHelp ? 'Ocultar instruções de configuração' : 'Instruções para obter o Client ID'}</span>
        </button>
      </div>

      {/* Tutorial / Help Box */}
      {showHelp && (
        <div className="gdrive-help-box" style={{ marginBottom: '16px' }}>
          <h4>Como configurar seu Google OAuth Client ID nas Variáveis de Ambiente:</h4>
          <ol>
            <li>
              Acesse o <strong>Google Cloud Console</strong> (<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">console.cloud.google.com</a>) e crie ou selecione seu projeto.
            </li>
            <li>
              No menu lateral, vá em <strong>APIs e Serviços</strong> &gt; <strong>Biblioteca</strong>, procure por <strong>Google Drive API</strong> e clique em <strong>Ativar</strong>.
            </li>
            <li>
              Vá em <strong>Tela de consentimento OAuth</strong>:
              <ul>
                <li>Adicione seu e-mail na lista de <strong>Usuários de teste</strong> (Test users).</li>
                <li>Em <strong>Escopos</strong>, clique em <em>Adicionar ou remover escopos</em> e marque <code>.../auth/drive.file</code>.</li>
              </ul>
            </li>
            <li>
              Em <strong>Credenciais</strong>, clique em <strong>Criar Credenciais</strong> &gt; <strong>ID do cliente OAuth</strong> &gt; selecione <strong>Aplicativo da Web</strong>.
            </li>
            <li>
              Em <strong>Origens JavaScript autorizadas</strong>, adicione a URL da aplicação (ex: <code>http://localhost:5173</code> ou a URL do Railway).
            </li>
            <li>
              Copie o <strong>ID do cliente</strong> gerado e defina na variável de ambiente <code>VITE_GOOGLE_CLIENT_ID</code> no arquivo <code>.env</code> ou no painel do Railway.
            </li>
          </ol>
        </div>
      )}

      {/* 3. Progress Bar & Realtime Feedback */}
      {isProcessing && progress && (
        <div className="gdrive-progress-card">
          <div className="gdrive-progress-header">
            <div className="gdrive-progress-label">
              <RefreshCw size={14} className="spin" />
              <span>{progress.detail}</span>
            </div>
            {progress.total > 0 && (
              <span className="gdrive-progress-count">
                {progress.current} / {progress.total}
              </span>
            )}
          </div>
          <div className="gdrive-progress-bar-bg">
            <div
              className="gdrive-progress-bar-fill"
              style={{
                width: `${
                  progress.total > 0
                    ? Math.round((progress.current / progress.total) * 100)
                    : 50
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Status Message Alert */}
      {statusMessage && (
        <div className={`gdrive-alert-banner ${statusMessage.type}`}>
          {statusMessage.type === 'success' && <CheckCircle2 size={16} />}
          {statusMessage.type === 'error' && <AlertCircle size={16} />}
          {statusMessage.type === 'info' && <CheckCircle2 size={16} />}
          <div style={{ flex: 1 }}>
            <span>{statusMessage.text}</span>
            {statusMessage.type === 'error' && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="gdrive-btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  onClick={() => handleConnect(true)}
                  disabled={isProcessing}
                >
                  <RefreshCw size={12} />
                  <span>Reconectar e conceder permissões</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Actions: Backup and Restore */}
      <div className="gdrive-actions-grid">
        <div className="gdrive-action-card">
          <div className="gdrive-action-icon upload">
            <CloudUpload size={22} />
          </div>
          <div className="gdrive-action-content">
            <h4>Fazer Backup no Google Drive</h4>
            <p>
              Salva configurações, prateleiras e modelos 3D na pasta <strong>Prateleira 3D</strong> no seu Drive.
            </p>

            <div className="gdrive-opt-badge">
              <Sparkles size={13} />
              <span>Backup Incremental: pula arquivos 3D e capas já enviados ao Drive</span>
            </div>

            <label className="gdrive-checkbox-label" title="Marque caso queira reenviar todos os arquivos do zero">
              <input
                type="checkbox"
                checked={forceFullBackup}
                onChange={(e) => setForceFullBackup(e.target.checked)}
                disabled={isProcessing}
              />
              <span>Forçar reenvio de todos os arquivos (ignora cache)</span>
            </label>

            <button
              type="button"
              className="gdrive-action-btn primary"
              onClick={handleBackup}
              disabled={isProcessing || !clientId.trim()}
            >
              <CloudUpload size={16} />
              <span>{isProcessing ? 'Enviando...' : 'Fazer Backup Agora'}</span>
            </button>
          </div>
        </div>

        <div className="gdrive-action-card">
          <div className="gdrive-action-icon download">
            <CloudDownload size={22} />
          </div>
          <div className="gdrive-action-content">
            <h4>Restaurar do Google Drive</h4>
            <p>
              Baixa as prateleiras, preferências e arquivos 3D salvos na pasta <strong>Prateleira 3D</strong> para este navegador.
            </p>
            <button
              type="button"
              className="gdrive-action-btn secondary"
              onClick={handleRestore}
              disabled={isProcessing || !clientId.trim()}
            >
              <CloudDownload size={16} />
              <span>{isProcessing ? 'Restaurando...' : 'Restaurar do Drive'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
