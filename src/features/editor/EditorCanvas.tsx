import { ContactShadows, Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, Group, Mesh, Object3D, Vector3 } from 'three'
import { SafeCanvas } from '../../components/SafeCanvas'
import type { EditorGroup, EditorItem, TransformMode, TransformSpace } from '../../domain/editorTypes'

export interface EditorCanvasProps {
  items: EditorItem[]
  groups: EditorGroup[]
  selectedIds: string[]
  activeTransformMode: TransformMode
  transformSpace: TransformSpace
  snapToGrid: boolean
  gridSize: number
  onSelectIds: (ids: string[], multiSelect?: boolean) => void
  onUpdateItemTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void
  onUpdateGroupTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void
  onRegisterExportRoot?: (root: Object3D | null) => void
}

/**
 * Individual GLTF model loader component with auto-normalization
 */
function SingleModel({ item }: { item: EditorItem }) {
  const { scene } = useGLTF(item.url)

  // Clone scene so multiple instances of same URL don't share matrices
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  // Center geometry origin once
  useMemo(() => {
    const box = new Box3().setFromObject(clonedScene)
    const center = new Vector3()
    box.getCenter(center)
    // Offset children so model pivot is centered at origin
    clonedScene.position.sub(center)
  }, [clonedScene])

  return <primitive object={clonedScene} />
}

interface SelectionTransformControlsProps {
  selectedTargetId: string | null
  objectsMap: Map<string, Object3D>
  activeTransformMode: TransformMode
  transformSpace: TransformSpace
  snapToGrid: boolean
  gridSize: number
  orbitControlsRef: React.RefObject<any>
  groups: EditorGroup[]
  onUpdateItemTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void
  onUpdateGroupTransform: (
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => void
}

/**
 * Component that safely binds TransformControls only when target 3D object is attached to scene graph
 */
function SelectionTransformControls({
  selectedTargetId,
  objectsMap,
  activeTransformMode,
  transformSpace,
  snapToGrid,
  gridSize,
  orbitControlsRef,
  groups,
  onUpdateItemTransform,
  onUpdateGroupTransform,
}: SelectionTransformControlsProps) {
  const transformControlsRef = useRef<any>(null)
  const [targetObject, setTargetObject] = useState<Object3D | null>(null)

  // Safely find and set target object when selectedTargetId changes or node mounts
  useEffect(() => {
    if (!selectedTargetId) {
      setTargetObject(null)
      return
    }

    let animationFrameId: number
    let attempts = 0
    const maxAttempts = 10

    const checkAndSetTarget = () => {
      const obj = objectsMap.get(selectedTargetId)
      if (obj && obj.parent !== null) {
        setTargetObject(obj)
      } else if (attempts < maxAttempts) {
        attempts++
        animationFrameId = requestAnimationFrame(checkAndSetTarget)
      } else {
        setTargetObject(null)
      }
    }

    checkAndSetTarget()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [selectedTargetId, objectsMap])

  // Continuous frame check to immediately detach if target object loses its parent
  useFrame(() => {
    if (targetObject && targetObject.parent === null) {
      setTargetObject(null)
    }
  })

  // Disable OrbitControls during transform drag and record final position/rotation/scale
  useEffect(() => {
    const transformControls = transformControlsRef.current
    if (!transformControls || !targetObject || !selectedTargetId) return

    const handleDraggingChange = (event: any) => {
      if (orbitControlsRef.current) {
        orbitControlsRef.current.enabled = !event.value
      }

      if (!event.value) {
        const pos: [number, number, number] = [
          targetObject.position.x,
          targetObject.position.y,
          targetObject.position.z,
        ]
        const rot: [number, number, number] = [
          targetObject.rotation.x,
          targetObject.rotation.y,
          targetObject.rotation.z,
        ]
        const sca: [number, number, number] = [
          targetObject.scale.x,
          targetObject.scale.y,
          targetObject.scale.z,
        ]

        if (groups.some((g) => g.id === selectedTargetId)) {
          onUpdateGroupTransform(selectedTargetId, pos, rot, sca)
        } else {
          onUpdateItemTransform(selectedTargetId, pos, rot, sca)
        }
      }
    }

    transformControls.addEventListener('dragging-changed', handleDraggingChange)
    return () => {
      transformControls.removeEventListener('dragging-changed', handleDraggingChange)
    }
  }, [targetObject, selectedTargetId, groups, orbitControlsRef, onUpdateGroupTransform, onUpdateItemTransform])

  if (!targetObject || targetObject.parent === null) {
    return null
  }

  return (
    <TransformControls
      ref={transformControlsRef}
      object={targetObject}
      mode={activeTransformMode}
      space={transformSpace}
      translationSnap={snapToGrid ? gridSize : null}
      rotationSnap={snapToGrid ? (15 * Math.PI) / 180 : null}
      scaleSnap={snapToGrid ? gridSize : null}
      size={0.85}
    />
  )
}

/**
 * Main Scene Content inside R3F Canvas
 */
function EditorSceneContent({
  items,
  groups,
  selectedIds,
  activeTransformMode,
  transformSpace,
  snapToGrid,
  gridSize,
  onSelectIds,
  onUpdateItemTransform,
  onUpdateGroupTransform,
  onRegisterExportRoot,
}: EditorCanvasProps) {
  const sceneRootRef = useRef<Group>(null)
  const orbitControlsRef = useRef<any>(null)

  // Map of item/group ID to Object3D ref for TransformControls attachment
  const objectsRefMap = useRef<Map<string, Object3D>>(new Map())

  // Expose export root to parent
  useEffect(() => {
    if (onRegisterExportRoot && sceneRootRef.current) {
      onRegisterExportRoot(sceneRootRef.current)
    }
  }, [onRegisterExportRoot])

  // Single selected target ID
  const selectedTargetId = selectedIds.length === 1 ? selectedIds[0] : null

  const registerRef = (id: string, node: Object3D | null) => {
    if (node) {
      objectsRefMap.current.set(id, node)
    } else {
      objectsRefMap.current.delete(id)
    }
  }

  // Root ungrouped items & root groups
  const rootItems = items.filter((i) => !i.groupId)
  const rootGroups = groups.filter((g) => !g.groupId)

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 16, 12]} intensity={2.2} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={1.0} color="#93c5fd" />
      <directionalLight position={[0, -5, 10]} intensity={0.4} />
      <hemisphereLight intensity={0.6} groundColor="#0b0d14" color="#f1f5f9" />

      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={50}
      />

      {/* Ground Grid */}
      <group position={[0, -0.01, 0]}>
        <Grid
          args={[40, 40]}
          cellSize={0.5}
          cellThickness={0.8}
          cellColor="#2a3348"
          sectionSize={2.0}
          sectionThickness={1.4}
          sectionColor="#4b6b94"
          fadeDistance={35}
          fadeStrength={1}
          infiniteGrid
        />
        <ContactShadows opacity={0.65} scale={25} blur={2.5} far={5} resolution={256} frames={1} color="#000000" />
      </group>

      {/* Main Scene Root Group */}
      <group
        ref={sceneRootRef}
        onPointerDown={(e) => {
          // Deselect if clicking on empty ground / canvas background
          if (e.target === e.currentTarget || (e.target as any)?.type === 'GridHelper') {
            onSelectIds([])
          }
        }}
      >
        {/* Render Root Groups */}
        {rootGroups.map((group) => {
          if (!group.visible) return null
          const childItems = items.filter((i) => i.groupId === group.id)

          return (
            <group
              key={group.id}
              ref={(node) => registerRef(group.id, node)}
              position={group.position}
              rotation={group.rotation}
              scale={group.scale}
              onClick={(e) => {
                e.stopPropagation()
                onSelectIds([group.id], e.shiftKey)
              }}
            >
              {childItems.map((item) => {
                if (!item.visible) return null
                return (
                  <group
                    key={item.id}
                    ref={(node) => registerRef(item.id, node)}
                    position={item.position}
                    rotation={item.rotation}
                    scale={item.scale}
                    onClick={(e) => {
                      e.stopPropagation()
                      // If grouped, select the group or item depending on shift key
                      onSelectIds([group.id], e.shiftKey)
                    }}
                  >
                    <Suspense fallback={null}>
                      <SingleModel item={item} />
                    </Suspense>
                  </group>
                )
              })}
            </group>
          )
        })}

        {/* Render Ungrouped Root Items */}
        {rootItems.map((item) => {
          if (!item.visible) return null
          return (
            <group
              key={item.id}
              ref={(node) => registerRef(item.id, node)}
              position={item.position}
              rotation={item.rotation}
              scale={item.scale}
              onClick={(e) => {
                e.stopPropagation()
                onSelectIds([item.id], e.shiftKey)
              }}
            >
              <Suspense fallback={null}>
                <SingleModel item={item} />
              </Suspense>
            </group>
          )
        })}
      </group>

      {/* TransformControls attached to single selected object safely */}
      <SelectionTransformControls
        selectedTargetId={selectedTargetId}
        objectsMap={objectsRefMap.current}
        activeTransformMode={activeTransformMode}
        transformSpace={transformSpace}
        snapToGrid={snapToGrid}
        gridSize={gridSize}
        orbitControlsRef={orbitControlsRef}
        groups={groups}
        onUpdateItemTransform={onUpdateItemTransform}
        onUpdateGroupTransform={onUpdateGroupTransform}
      />
    </>
  )
}

export function EditorCanvas(props: EditorCanvasProps) {
  return (
    <div className="editor-canvas-wrapper">
      <SafeCanvas
        camera={{ position: [3.5, 3.5, 5], fov: 45, near: 0.01, far: 1000 }}
      >
        <color attach="background" args={['#0e1118']} />
        <fog attach="fog" args={['#0e1118', 18, 60]} />
        <EditorSceneContent {...props} />
      </SafeCanvas>
    </div>
  )
}

