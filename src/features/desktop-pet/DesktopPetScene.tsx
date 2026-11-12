import { Center, ContactShadows, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import { Box3, Group, Vector3 } from 'three'

export interface DesktopPetSceneProps {
  url: string
  autoRotate: boolean
  rotateSpeed: number
  floatingAnimation: boolean
  onModelClick?: () => void
}

function PetModel({
  url,
  autoRotate,
  rotateSpeed,
  floatingAnimation,
  onModelClick,
}: DesktopPetSceneProps) {
  const { scene } = useGLTF(url)
  const groupRef = useRef<Group>(null)
  const [isExcited, setIsExcited] = useState(false)
  const excitementTimer = useRef<number | null>(null)

  // Normalize scale so any 3D model fits nicely in the pet viewport
  const normalizedScale = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    return maxDim > 0 ? 2.0 / maxDim : 1
  }, [scene])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Floating bobbing animation
    if (floatingAnimation) {
      const freq = isExcited ? 5 : 2
      const amp = isExcited ? 0.15 : 0.06
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * freq) * amp
    } else {
      groupRef.current.position.y = 0
    }

    // Auto rotate
    if (autoRotate || isExcited) {
      const speed = isExcited ? rotateSpeed * 3 : rotateSpeed
      groupRef.current.rotation.y += delta * speed
    }
  })

  const handleClick = (e: any) => {
    e.stopPropagation()
    setIsExcited(true)
    if (excitementTimer.current) window.clearTimeout(excitementTimer.current)
    excitementTimer.current = window.setTimeout(() => {
      setIsExcited(false)
    }, 1200)

    onModelClick?.()
  }

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerOver={() => {
        document.body.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default'
      }}
    >
      <Center scale={normalizedScale}>
        <primitive object={scene} />
      </Center>
    </group>
  )
}

function PetFallback() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.5, 20, 20]} />
      <meshStandardMaterial color="#c46843" wireframe />
    </mesh>
  )
}

export function DesktopPetScene(props: DesktopPetSceneProps) {
  return (
    <>
      {/* Optimized lighting to make 3D models pop against light/dark desktops */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 7, 5]} intensity={1.5} castShadow />
      <directionalLight position={[-4, -2, -3]} intensity={0.6} color="#90cdf4" />
      <pointLight position={[0, 3, 2]} intensity={0.8} />

      <Suspense fallback={<PetFallback />}>
        <PetModel {...props} />
      </Suspense>

      {/* Subtle floor contact shadow */}
      <ContactShadows
        position={[0, -1.15, 0]}
        opacity={0.5}
        scale={3.5}
        blur={1.6}
        far={2.2}
      />
    </>
  )
}

