import { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

export async function exportSceneToGlb(
  targetObject: Object3D,
  filename: string = 'cenado-3d-editada.glb'
): Promise<File> {
  // Force matrix update across all nodes before parsing
  targetObject.updateMatrixWorld(true)

  const exporter = new GLTFExporter()
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      targetObject,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
        } else {
          const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
          blob.arrayBuffer().then(resolve).catch(reject)
        }
      },
      (error) => reject(error),
      { binary: true }
    )
  })

  const sanitizedName = filename.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '') || 'modelo-editado'
  const finalName = sanitizedName.endsWith('.glb') ? sanitizedName : `${sanitizedName}.glb`

  return new File([arrayBuffer], finalName, { type: 'model/gltf-binary' })
}
