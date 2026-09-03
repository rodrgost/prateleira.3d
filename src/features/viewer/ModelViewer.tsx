import { Center, OrbitControls, useGLTF } from '@react-three/drei'
import { Component, Suspense, type ReactNode } from 'react'
import { Box3, Vector3 } from 'three'
import { useMemo } from 'react'

interface ModelViewerProps {
  url: string
}

function LoadedModel({ url }: ModelViewerProps) {
  const { scene } = useGLTF(url)
  const normalizedScale = useMemo(() => {
    const size = new Vector3()
    new Box3().setFromObject(scene).getSize(size)
    return size.length() > 0 ? 2.2 / Math.max(size.x, size.y, size.z) : 1
  }, [scene])
  return <Center scale={normalizedScale}><primitive object={scene} /></Center>
}

function LoadingModel() {
  return <mesh><sphereGeometry args={[0.45, 24, 16]} /><meshStandardMaterial color="#bd6948" wireframe /></mesh>
}

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? <LoadingModel /> : this.props.children
  }
}

export function ModelViewer({ url }: ModelViewerProps) {
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[4, 6, 5]} intensity={3.5} color="#fff4de" />
      <directionalLight position={[-4, 2, -2]} intensity={1.2} color="#8fc5bd" />
      <ViewerErrorBoundary>
        <Suspense fallback={<LoadingModel />}>
          <LoadedModel url={url} />
        </Suspense>
      </ViewerErrorBoundary>
      <OrbitControls makeDefault enablePan={false} minDistance={1.5} maxDistance={12} />
    </>
  )
}
