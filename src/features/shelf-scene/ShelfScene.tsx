import { Center, OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { useMemo } from 'react'
import type { SceneInstance } from '../../domain/types'
import { getShelfLevelCount, SHELF_LEVEL_HEIGHT } from '../../domain/shelfLayout'

interface ShelfSceneProps {
  instances: Array<SceneInstance & { url: string }>
  itemsPerLevel: number
}

function SceneModel({ instance }: { instance: SceneInstance & { url: string } }) {
  const { scene } = useGLTF(instance.url)
  const model = useMemo(() => scene.clone(), [scene])
  const normalizedScale = useMemo(() => {
    const size = new Vector3()
    new Box3().setFromObject(model).getSize(size)
    return size.length() > 0 ? 1.45 / Math.max(size.x, size.y, size.z) : 1
  }, [model])
  return <Center position={instance.position} scale={instance.scale * normalizedScale}><primitive object={model} /></Center>
}

export function ShelfScene({ instances, itemsPerLevel }: ShelfSceneProps) {
  const levelCount = getShelfLevelCount(instances.length, itemsPerLevel)
  const shelfHeights = Array.from({ length: levelCount + 1 }, (_, index) => -2 + index * SHELF_LEVEL_HEIGHT)
  const sideHeight = levelCount * SHELF_LEVEL_HEIGHT + 0.7
  const sideY = -2 + sideHeight / 2

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={3} color="#fff5df" />
      <directionalLight position={[-4, 3, -2]} intensity={1.1} color="#9bcac1" />
      {shelfHeights.map((height, index) => <mesh key={height} position={[0, height, 0]}><boxGeometry args={[9.5, 0.24, 2.8]} /><meshStandardMaterial color={index === 0 ? '#b9784a' : '#c88959'} roughness={0.7} /></mesh>)}
      {[-4.5, 4.5].map((x) => <mesh key={x} position={[x, sideY, 0]}><boxGeometry args={[0.22, sideHeight, 2.4]} /><meshStandardMaterial color="#9f5e3c" roughness={0.72} /></mesh>)}
      {instances.map((instance) => <SceneModel key={instance.id} instance={instance} />)}
      <OrbitControls enablePan={false} minDistance={6} maxDistance={16} target={[0, 0, 0]} />
    </>
  )
}
