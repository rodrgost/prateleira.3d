import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Rotates a GLB model file along the Y axis and returns a new File object
 */
export async function rotateGlbModel(
  fileOrBlob: Blob,
  rotationYRad: number,
  outputName: string
): Promise<File> {
  const objectUrl = URL.createObjectURL(fileOrBlob)
  try {
    const gltf = await new GLTFLoader().loadAsync(objectUrl)
    const root = gltf.scene

    // Apply rotation around Y axis
    root.rotation.y += rotationYRad
    root.updateMatrixWorld(true)

    const exporter = new GLTFExporter()
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      exporter.parse(
        root,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result)
          } else {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
            blob.arrayBuffer().then(resolve).catch(reject)
          }
        },
        (error) => reject(error),
        { binary: true, animations: gltf.animations }
      )
    })

    const sanitizedName = outputName.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '') || 'modelo-3d'
    const fileName = sanitizedName.endsWith('.glb') ? sanitizedName : `${sanitizedName}.glb`

    return new File([arrayBuffer], fileName, { type: 'model/gltf-binary' })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
