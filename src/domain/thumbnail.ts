import { AmbientLight, Box3, Color, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const THUMBNAIL_SIZE = 256

export async function generateModelThumbnail(file: Blob): Promise<Blob | null> {
  const objectUrl = URL.createObjectURL(file)
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_SIZE
  canvas.height = THUMBNAIL_SIZE
  let renderer: WebGLRenderer | null = null
  try {
    const gltf = await new GLTFLoader().loadAsync(objectUrl)
    const model = gltf.scene

    const size = new Vector3()
    const center = new Vector3()
    new Box3().setFromObject(model).getSize(size)
    new Box3().setFromObject(model).getCenter(center)
    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    const scale = 2.2 / maxDimension
    model.scale.setScalar(scale)
    model.position.sub(center.multiplyScalar(scale))

    const scene = new Scene()
    scene.background = new Color('#e8e0d4')
    scene.add(new AmbientLight(0xffffff, 1.8))
    const keyLight = new DirectionalLight(0xfff4de, 3.2)
    keyLight.position.set(4, 6, 5)
    scene.add(keyLight)
    const fillLight = new DirectionalLight(0x8fc5bd, 1.1)
    fillLight.position.set(-4, 2, -2)
    scene.add(fillLight)
    scene.add(model)

    const camera = new PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(3.2, 2.1, 4)
    camera.lookAt(0, 0, 0)

    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setSize(THUMBNAIL_SIZE, THUMBNAIL_SIZE)
    renderer.render(scene, camera)

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  } finally {
    renderer?.dispose()
    URL.revokeObjectURL(objectUrl)
  }
}
