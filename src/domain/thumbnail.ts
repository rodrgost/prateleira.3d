import {
  AmbientLight,
  Box3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { ShelfViewerSettings } from './types'

const THUMBNAIL_WIDTH = 512
const THUMBNAIL_HEIGHT = 680

export async function generateModelThumbnail(
  file: Blob,
  settings?: ShelfViewerSettings
): Promise<Blob | null> {
  const objectUrl = URL.createObjectURL(file)
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_WIDTH
  canvas.height = THUMBNAIL_HEIGHT
  let renderer: WebGLRenderer | null = null

  try {
    const gltf = await new GLTFLoader().loadAsync(objectUrl)
    const model = gltf.scene

    const size = new Vector3()
    const center = new Vector3()
    new Box3().setFromObject(model).getSize(size)
    new Box3().setFromObject(model).getCenter(center)
    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const scale = 2.05 / maxDimension
    model.scale.setScalar(scale)
    model.position.sub(center.multiplyScalar(scale))
    model.updateMatrixWorld(true)

    const bbox = new Box3().setFromObject(model)
    const bottomY = bbox.min.y

    const scene = new Scene()
    const bgColor = settings?.backgroundColor || '#141519'
    scene.background = new Color(bgColor)

    // Lighting setup based on settings
    const lightingPreset = settings?.lighting || 'studio'
    if (lightingPreset === 'dramatic') {
      scene.add(new AmbientLight(0xffffff, 0.8))
      const keyLight = new DirectionalLight(0xffffff, 4.2)
      keyLight.position.set(3, 6, 4)
      scene.add(keyLight)
      const fillLight = new DirectionalLight(0x64748b, 0.5)
      fillLight.position.set(-4, 0, -2)
      scene.add(fillLight)
      const rimLight = new DirectionalLight(0x38bdf8, 3.0)
      rimLight.position.set(0, 5, -4)
      scene.add(rimLight)
    } else if (lightingPreset === 'warm') {
      scene.add(new AmbientLight(0xfff1e6, 2.0))
      const keyLight = new DirectionalLight(0xffe2b8, 3.6)
      keyLight.position.set(2, 5, 4)
      scene.add(keyLight)
      const fillLight = new DirectionalLight(0xfca5a5, 1.4)
      fillLight.position.set(-3.5, 2, -2)
      scene.add(fillLight)
      const rimLight = new DirectionalLight(0xfdba74, 1.2)
      rimLight.position.set(0, 4, -3)
      scene.add(rimLight)
    } else if (lightingPreset === 'soft') {
      scene.add(new AmbientLight(0xf8fafc, 2.6))
      const keyLight = new DirectionalLight(0xffffff, 2.2)
      keyLight.position.set(2, 4, 3)
      scene.add(keyLight)
      const fillLight = new DirectionalLight(0xe2e8f0, 2.0)
      fillLight.position.set(-3, 2, -2)
      scene.add(fillLight)
    } else {
      // studio
      scene.add(new AmbientLight(0xffffff, 1.9))
      const keyLight = new DirectionalLight(0xfff4de, 3.4)
      keyLight.position.set(2, 5, 4.5)
      scene.add(keyLight)
      const fillLight = new DirectionalLight(0x8fc5bd, 1.3)
      fillLight.position.set(-3.5, 1.5, 2)
      scene.add(fillLight)
      const rimLight = new DirectionalLight(0xe0e7ff, 1.1)
      rimLight.position.set(0, 4, -3)
      scene.add(rimLight)
    }

    // Ground rendering in thumbnail
    const showGround = settings?.showGround ?? true
    const groundType = settings?.groundType || 'grid'
    const groundColorHex = settings?.groundColor || '#4f627d'
    const groundColor = new Color(groundColorHex)

    if (showGround && groundType !== 'none') {
      switch (groundType) {
        case 'grid': {
          const grid = new GridHelper(10, 20, groundColor, groundColor)
          grid.position.set(0, bottomY, 0)
          const mat = grid.material as Material
          mat.transparent = true
          mat.opacity = 0.6
          scene.add(grid)
          // subtle contact shadow
          const shadow = new Mesh(
            new CircleGeometry(1.2, 32),
            new MeshBasicMaterial({ color: 0x000000, opacity: 0.35, transparent: true, side: DoubleSide })
          )
          shadow.rotation.x = -Math.PI / 2
          shadow.position.set(0, bottomY + 0.002, 0)
          scene.add(shadow)
          break
        }
        case 'shadow': {
          const shadow = new Mesh(
            new CircleGeometry(1.3, 32),
            new MeshBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true, side: DoubleSide })
          )
          shadow.rotation.x = -Math.PI / 2
          shadow.position.set(0, bottomY + 0.005, 0)
          scene.add(shadow)
          break
        }
        case 'pedestal': {
          const pedestalGroup = new Group()
          pedestalGroup.position.set(0, bottomY - 0.06, 0)
          const cyl = new Mesh(
            new CylinderGeometry(1.5, 1.6, 0.12, 48),
            new MeshStandardMaterial({ color: groundColor, roughness: 0.35, metalness: 0.2 })
          )
          pedestalGroup.add(cyl)
          const ring = new Mesh(
            new RingGeometry(1.46, 1.54, 48),
            new MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.8, opacity: 0.6, transparent: true })
          )
          ring.rotation.x = -Math.PI / 2
          ring.position.y = 0.061
          pedestalGroup.add(ring)
          scene.add(pedestalGroup)
          break
        }
        case 'checker': {
          const checkerGroup = new Group()
          checkerGroup.position.set(0, bottomY, 0)
          const grid = new GridHelper(8, 12, 0xffffff, groundColor)
          checkerGroup.add(grid)
          const basePlane = new Mesh(
            new CircleGeometry(2.8, 32),
            new MeshBasicMaterial({ color: groundColor, opacity: 0.25, transparent: true, side: DoubleSide })
          )
          basePlane.rotation.x = -Math.PI / 2
          checkerGroup.add(basePlane)
          scene.add(checkerGroup)
          break
        }
        case 'radial': {
          const radialGroup = new Group()
          radialGroup.position.set(0, bottomY, 0)
          const rings = [0.5, 0.9, 1.3, 1.7, 2.1]
          rings.forEach((r, idx) => {
            const ring = new Mesh(
              new RingGeometry(r - 0.015, r + 0.015, 48),
              new MeshBasicMaterial({ color: groundColor, opacity: 0.7 - idx * 0.12, transparent: true, side: DoubleSide })
            )
            ring.rotation.x = -Math.PI / 2
            radialGroup.add(ring)
          })
          const shadow = new Mesh(
            new CircleGeometry(1.1, 32),
            new MeshBasicMaterial({ color: 0x000000, opacity: 0.35, transparent: true, side: DoubleSide })
          )
          shadow.rotation.x = -Math.PI / 2
          radialGroup.add(shadow)
          scene.add(radialGroup)
          break
        }
      }
    }

    scene.add(model)

    // Vertical portrait camera with balanced 3D perspective framing
    const camera = new PerspectiveCamera(38, THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT, 0.1, 100)
    camera.position.set(0.55, 0.48, 3.4)
    camera.lookAt(0, 0.05, 0)

    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.outputColorSpace = SRGBColorSpace
    renderer.setSize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    renderer.render(scene, camera)

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch (err) {
    console.error('generateModelThumbnail failed:', err)
    return null
  } finally {
    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
    }
    URL.revokeObjectURL(objectUrl)
  }
}
