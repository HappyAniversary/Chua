import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { ARHAT_METADATA_LIST } from './figures/arhats.ts';
import { createStatueSculpt } from './figures/statue-sculpt.ts';
import { countObjectTriangles } from './figures/materials.ts';
import { exportObjectToGLB, updateManifest } from './figures/exporter.ts';

export async function bakeArhats(outputDir = path.resolve(process.env.FIGURES_OUTPUT_DIR ?? 'public/models/figures')) {
  for (const meta of ARHAT_METADATA_LIST) {
    const triangles: number[] = [];
    const materials = new Set<string>();
    for (const lod of [0, 1] as const) {
      const group = createStatueSculpt(meta.id as `arhat_${string}`, lod);
      group.userData.figureAssembly = 'authored-v3';
      group.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh) return;
        const material = (node as THREE.Mesh).material;
        for (const item of Array.isArray(material) ? material : [material]) materials.add(item.name);
      });
      triangles.push(countObjectTriangles(group));
      const filename = `${meta.id}${lod ? '_lod1' : ''}.glb`;
      const exported = await exportObjectToGLB(group, path.join(outputDir, 'arhats', filename));
      console.log(`${filename}: ${triangles[lod]} triangles, ${exported.byteSize} bytes`);
    }
    updateManifest(path.join(outputDir, 'manifest.json'), {
      id: meta.id, name: meta.name, category: 'arhat',
      files: { lod0: `/models/figures/arhats/${meta.id}.glb`, lod1: `/models/figures/arhats/${meta.id}_lod1.glb` },
      triangles: { lod0: triangles[0], lod1: triangles[1] }, isRigged: false, materials: [...materials].sort(),
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bakeArhats().catch((error) => { console.error(error); process.exitCode = 1; });
}
