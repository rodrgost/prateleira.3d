import { Canvas } from '@react-three/fiber'
import { Component, type ComponentProps, type CSSProperties, type ReactNode, useCallback, useState } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface WebGLErrorBoundaryProps {
  children: ReactNode
  onReset?: () => void
}

interface WebGLErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class WebGLErrorBoundary extends Component<WebGLErrorBoundaryProps, WebGLErrorBoundaryState> {
  state: WebGLErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('SafeCanvas: 3D render error caught by boundary:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: '#0d0e12',
            color: '#f8fafc',
            padding: '24px',
            textAlign: 'center',
            zIndex: 30,
          }}
        >
          <div
            style={{
              padding: '12px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <AlertTriangle size={32} color="#f59e0b" />
          </div>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Instabilidade na GPU do Dispositivo</h4>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', maxWidth: '340px', lineHeight: '1.5' }}>
            A renderização 3D foi interrompida pelo sistema operacional ou pelo navegador.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#38bdf8',
              color: '#0f172a',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '4px',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)',
            }}
          >
            <RefreshCcw size={14} />
            <span>Recarregar Visualização 3D</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export type SafeCanvasProps = ComponentProps<typeof Canvas> & {
  containerClassName?: string
  containerStyle?: CSSProperties
}

export function SafeCanvas({
  children,
  gl,
  dpr,
  camera,
  containerClassName = '',
  containerStyle,
  onCreated,
  ...restProps
}: SafeCanvasProps) {
  const [key, setKey] = useState(0)
  const [isContextLost, setIsContextLost] = useState(false)

  const handleReset = useCallback(() => {
    setIsContextLost(false)
    setKey((prev) => prev + 1)
  }, [])

  // Optimized GL config for mobile Android devices & GPUs
  const defaultGlConfig = {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false, // Don't hold drawing buffers in GPU RAM after render
    powerPreference: 'high-performance' as const,
    failIfMajorPerformanceCaveat: false,
  }

  const mergedGl = typeof gl === 'object' && gl !== null ? { ...defaultGlConfig, ...gl } : defaultGlConfig

  // Cap max DPR to 1.75 on mobile phones to prevent high-DPI (3x/3.5x) GPU OOM crashes
  const maxDpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1.5
  const safeDpr = dpr || [1, maxDpr]

  return (
    <WebGLErrorBoundary key={key} onReset={handleReset}>
      <div
        className={containerClassName}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          touchAction: 'none', // Prevents touch gesture conflicts on Android touchscreens
          ...containerStyle,
        }}
      >
        {isContextLost && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              background: 'rgba(13, 14, 18, 0.94)',
              backdropFilter: 'blur(8px)',
              color: '#f8fafc',
              padding: '24px',
              textAlign: 'center',
              zIndex: 35,
            }}
          >
            <div
              style={{
                padding: '10px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
              }}
            >
              <AlertTriangle size={30} color="#f59e0b" />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Conexão 3D (WebGL) perdida. Restaurando...</span>
            <button
              type="button"
              onClick={handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              <RefreshCcw size={13} />
              <span>Forçar Recarregamento</span>
            </button>
          </div>
        )}

        <Canvas
          gl={mergedGl}
          dpr={safeDpr}
          camera={camera}
          onCreated={(state) => {
            const renderer = state.gl
            const canvasEl = renderer?.domElement
            if (canvasEl) {
              const onContextLost = (e: Event) => {
                // MANDATORY: Call preventDefault() to allow Android Chrome/WebView to restore WebGL context
                e.preventDefault()
                console.warn('SafeCanvas: WebGL Context Lost event caught and handled.')
                setIsContextLost(true)
              }

              const onContextRestored = () => {
                console.log('SafeCanvas: WebGL Context Restored successfully.')
                setIsContextLost(false)
                setKey((prev) => prev + 1)
              }

              canvasEl.addEventListener('webglcontextlost', onContextLost, false)
              canvasEl.addEventListener('webglcontextrestored', onContextRestored, false)
            }

            if (onCreated) {
              onCreated(state)
            }
          }}
          {...restProps}
        >
          {children}
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  )
}
