import { Center, ContactShadows, Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Component, Suspense, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, DoubleSide, Euler, MOUSE, Vector3 } from 'three'
import type { GroundType, LightingPreset } from '../../domain/types'
import type { CameraActionSignal } from './ModelViewerModal'

export interface ModelViewerProps {
  url: string
  showGround?: boolean
  groundType?: GroundType
  groundColor?: string
  autoRotate?: boolean
  autoRotateSpeed?: number
  lighting?: LightingPreset
  wireframe?: boolean
  controlMode?: 'orbit' | 'pan' | 'fps'
  cameraSignal?: CameraActionSignal | null
  onFpsLockChange?: (locked: boolean) => void
}

interface LoadedModelProps {
  url: string
  wireframe?: boolean
  onBoundsCalculated?: (bottomY: number) => void
}

function LoadedModel({ url, wireframe = false, onBoundsCalculated }: LoadedModelProps) {
  const { scene } = useGLTF(url)

  // Toggle wireframe on all meshes if requested
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as any).isMesh && (child as any).material) {
        const mat = (child as any).material
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            m.wireframe = wireframe
          })
        } else {
          mat.wireframe = wireframe
        }
      }
    })
  }, [scene, wireframe])

  const normalizedScale = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    const size = new Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = maxDim > 0 ? 2.2 / maxDim : 1
    if (onBoundsCalculated) {
      const bottom = -(size.y * scale) / 2
      onBoundsCalculated(bottom)
    }
    return scale
  }, [scene, onBoundsCalculated])

  return (
    <Center scale={normalizedScale}>
      <primitive object={scene} />
    </Center>
  )
}

function LoadingModel() {
  return (
    <mesh>
      <sphereGeometry args={[0.45, 24, 16]} />
      <meshStandardMaterial color="#bd6948" wireframe />
    </mesh>
  )
}

function ViewerLighting({ preset = 'studio' }: { preset?: LightingPreset }) {
  switch (preset) {
    case 'dramatic':
      return (
        <>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 4]} intensity={4.5} color="#ffffff" castShadow />
          <directionalLight position={[-5, 0, -2]} intensity={0.4} color="#64748b" />
          <directionalLight position={[0, 5, -5]} intensity={3.0} color="#38bdf8" />
        </>
      )
    case 'warm':
      return (
        <>
          <ambientLight intensity={2.0} color="#fff1e6" />
          <directionalLight position={[4, 6, 4]} intensity={3.8} color="#ffe2b8" />
          <directionalLight position={[-4, 2, -2]} intensity={1.4} color="#fca5a5" />
          <directionalLight position={[0, 4, -4]} intensity={1.2} color="#fdba74" />
        </>
      )
    case 'soft':
      return (
        <>
          <ambientLight intensity={2.6} color="#f8fafc" />
          <directionalLight position={[2, 5, 3]} intensity={2.2} color="#ffffff" />
          <directionalLight position={[-3, 3, -2]} intensity={2.0} color="#e2e8f0" />
        </>
      )
    case 'studio':
    default:
      return (
        <>
          <ambientLight intensity={1.8} />
          <directionalLight position={[4, 6, 5]} intensity={3.5} color="#fff4de" />
          <directionalLight position={[-4, 2, -2]} intensity={1.3} color="#8fc5bd" />
          <directionalLight position={[0, 4, -4]} intensity={1.0} color="#e0e7ff" />
        </>
      )
  }
}

function GroundRenderer({
  groundType,
  groundColor = '#4f627d',
  bottomY = -1.1,
}: {
  groundType: GroundType
  groundColor?: string
  bottomY: number
}) {
  if (groundType === 'none') return null

  switch (groundType) {
    case 'pedestal':
      return (
        <group position={[0, bottomY - 0.08, 0]}>
          <mesh receiveShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[2.2, 2.3, 0.16, 48]} />
            <meshStandardMaterial
              color={groundColor}
              roughness={0.35}
              metalness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[2.14, 2.2, 48]} />
            <meshStandardMaterial color="#ffffff" opacity={0.6} transparent roughness={0.1} metalness={0.8} />
          </mesh>
          <ContactShadows position={[0, -0.09, 0]} opacity={0.8} scale={7} blur={2.0} far={2.5} />
        </group>
      )

    case 'shadow':
    default:
      return (
        <ContactShadows
          position={[0, bottomY, 0]}
          opacity={0.75}
          scale={9}
          blur={1.8}
          far={3.5}
          color={groundColor === '#4f627d' ? '#000000' : groundColor}
        />
      )
  }
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

/**
 * FirstPersonController: FPS / Free-fly camera navigation with WASD and mouse look
 */
function FirstPersonController({
  onLockChange,
  cameraSignal,
}: {
  onLockChange?: (locked: boolean) => void
  cameraSignal?: CameraActionSignal | null
}) {
  const { camera, gl } = useThree()
  const keysPressed = useRef<{ [key: string]: boolean }>({})
  const isLockedRef = useRef(false)
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'))

  // Synchronize euler when camera position / lookAt is updated via signals
  useEffect(() => {
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
  }, [camera, cameraSignal])

  useEffect(() => {
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      keysPressed.current[e.code] = true
    }

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return
      const movementX = e.movementX || 0
      const movementY = e.movementY || 0

      euler.current.y -= movementX * 0.0022
      euler.current.x -= movementY * 0.0022
      // Clamp pitch (-85 to +85 degrees)
      euler.current.x = Math.max(-Math.PI / 2.05, Math.min(Math.PI / 2.05, euler.current.x))

      camera.quaternion.setFromEuler(euler.current)
    }

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement
      isLockedRef.current = locked
      onLockChange?.(locked)
    }

    const onClickCanvas = () => {
      if (!isLockedRef.current) {
        gl.domElement.requestPointerLock()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    gl.domElement.addEventListener('click', onClickCanvas)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      gl.domElement.removeEventListener('click', onClickCanvas)
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock()
      }
    }
  }, [camera, gl, onLockChange])

  useFrame((_, delta) => {
    if (!isLockedRef.current) return
    const isSprint = keysPressed.current['ShiftLeft'] || keysPressed.current['ShiftRight']
    const speed = isSprint ? 6.5 : 3.2
    const moveDist = speed * Math.min(delta, 0.1)

    // Direction vectors
    const forward = new Vector3()
    camera.getWorldDirection(forward)

    // Flat horizontal forward for natural walking
    const forwardXZ = new Vector3(forward.x, 0, forward.z).normalize()
    const right = new Vector3().crossVectors(forwardXZ, new Vector3(0, 1, 0)).normalize()

    // Walk forward / backward
    if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) {
      camera.position.addScaledVector(forwardXZ, moveDist)
    }
    if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) {
      camera.position.addScaledVector(forwardXZ, -moveDist)
    }
    // Strafe left / right
    if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) {
      camera.position.addScaledVector(right, -moveDist)
    }
    if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) {
      camera.position.addScaledVector(right, moveDist)
    }
    // Elevate up / down
    if (keysPressed.current['Space'] || keysPressed.current['KeyE']) {
      camera.position.y += moveDist
    }
    if (keysPressed.current['KeyQ'] || keysPressed.current['ControlLeft']) {
      camera.position.y -= moveDist
    }
  })

  return null
}

/**
 * CameraDirector handles camera commands, panning, angle presets, and micro-zoom
 */
function CameraDirector({
  cameraSignal,
  controlMode = 'orbit',
  autoRotate = false,
  autoRotateSpeed = 2.0,
  onFpsLockChange,
}: {
  cameraSignal?: CameraActionSignal | null
  controlMode?: 'orbit' | 'pan' | 'fps'
  autoRotate?: boolean
  autoRotateSpeed?: number
  onFpsLockChange?: (locked: boolean) => void
}) {
  const { camera } = useThree()
  const controlsRef = useRef<any>(null)

  useEffect(() => {
    if (!cameraSignal) return
    const { type, payload } = cameraSignal

    if (controlsRef.current) {
      const controls = controlsRef.current
      switch (type) {
        case 'preset': {
          const { pos, target } = payload
          controls.target.set(target[0], target[1], target[2])
          camera.position.set(pos[0], pos[1], pos[2])
          camera.lookAt(target[0], target[1], target[2])
          controls.update()
          break
        }
        case 'zoomIn': {
          const dir = new Vector3().subVectors(camera.position, controls.target)
          if (dir.length() > 0.03) {
            camera.position.addScaledVector(dir, -0.25)
            controls.update()
          }
          break
        }
        case 'zoomOut': {
          const dir = new Vector3().subVectors(camera.position, controls.target)
          camera.position.addScaledVector(dir, 0.28)
          controls.update()
        }
          break
        case 'setTarget': {
          const [tx, ty, tz] = payload
          const offset = new Vector3().subVectors(camera.position, controls.target)
          controls.target.set(tx, ty, tz)
          camera.position.set(tx + offset.x, ty + offset.y, tz + offset.z)
          controls.update()
          break
        }
        case 'reset': {
          controls.target.set(0, 0, 0)
          camera.position.set(0, 0.5, 4.2)
          camera.lookAt(0, 0, 0)
          controls.update()
          break
        }
      }
    } else if (controlMode === 'fps') {
      // In FPS mode without OrbitControls
      switch (type) {
        case 'preset': {
          const { pos, target } = payload
          camera.position.set(pos[0], pos[1], pos[2])
          camera.lookAt(target[0], target[1], target[2])
          break
        }
        case 'reset': {
          camera.position.set(0, 0.5, 4.2)
          camera.lookAt(0, 0, 0)
          break
        }
      }
    }
  }, [cameraSignal, camera, controlMode])

  if (controlMode === 'fps') {
    return <FirstPersonController onLockChange={onFpsLockChange} cameraSignal={cameraSignal} />
  }

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={true}
      screenSpacePanning={true}
      minDistance={0.01}
      maxDistance={80}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      enableDamping={true}
      dampingFactor={0.08}
      mouseButtons={{
        LEFT: controlMode === 'pan' ? MOUSE.PAN : MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: controlMode === 'pan' ? MOUSE.ROTATE : MOUSE.PAN,
      }}
    />
  )
}

export function ModelViewer({
  url,
  showGround = true,
  groundType = 'shadow',
  groundColor = '#4f627d',
  autoRotate = false,
  autoRotateSpeed = 2.0,
  lighting = 'studio',
  wireframe = false,
  controlMode = 'orbit',
  cameraSignal = null,
  onFpsLockChange,
}: ModelViewerProps) {
  const [bottomY, setBottomY] = useState(-1.1)

  return (
    <>
      <ViewerLighting preset={lighting} />

      <ViewerErrorBoundary>
        <Suspense fallback={<LoadingModel />}>
          <LoadedModel url={url} wireframe={wireframe} onBoundsCalculated={setBottomY} />
        </Suspense>
      </ViewerErrorBoundary>

      {showGround && <GroundRenderer groundType={groundType} groundColor={groundColor} bottomY={bottomY} />}

      <CameraDirector
        cameraSignal={cameraSignal}
        controlMode={controlMode}
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
        onFpsLockChange={onFpsLockChange}
      />
    </>
  )
}
