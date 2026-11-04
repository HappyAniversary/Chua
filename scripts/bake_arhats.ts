import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { extractSurfaceNets } from './figures/mesher.ts';
import { ARHAT_METADATA_LIST, createArhatFigureSDF } from './figures/arhats.ts';
import { assignStatueMaterials, countObjectTriangles, figureResolution, FIGURE_CELL_SIZES } from './figures/materials.ts';
import { addStatueFaceDetails } from './figures/face-details.ts';
import { addArhatPropDetails } from './figures/prop-details.ts';
import { exportObjectToGLB, updateManifest } from './figures/exporter.ts';

export async function bakeArhats(outputDir = path.resolve(process.env.FIGURES_OUTPUT_DIR ?? 'public/models/figures')) {
  for (const meta of ARHAT_METADATA_LIST) {
    const figure = createArhatFigureSDF(meta.index);
    const triangles: number[] = [];
    const materialNames = new Set<string>();
    for (const [lod, cellSize] of FIGURE_CELL_SIZES.arhat.entries()) {
      const resolution = figureResolution(figure.bounds, cellSize);
      const result = extractSurfaceNets(figure.sdf, { resolution, bounds: figure.bounds, smoothIterations: 2, smoothFactor: 0.18 });
      const materials = assignStatueMaterials(result.geometry);
      materials.forEach((m) => materialNames.add(m.name));
      materialNames.add('SculptedFeatures');
      const mesh = new THREE.Mesh(result.geometry, materials);
      mesh.name = meta.id;
      const group = new THREE.Group();
      group.name = meta.id;
      group.add(mesh);
      addStatueFaceDetails(group, figure.anatomicalPoints.head, figure.headTilt, false, meta.index === 18 ? 1 : [7, 13].includes(meta.index) ? 0.8 : 0.25, figure.headScale);
      addArhatPropDetails(group, meta.index, figure.anatomicalPoints);
      group.traverse((object) => {
        if (!(object as THREE.Mesh).isMesh) return;
        const material = (object as THREE.Mesh).material;
        for (const item of Array.isArray(material) ? material : [material]) materialNames.add(item.name);
      });
      triangles.push(countObjectTriangles(group));
      const filename = `${meta.id}${lod ? '_lod1' : ''}.glb`;
      const exported = await exportObjectToGLB(group, path.join(outputDir, 'arhats', filename));
      console.log(`${filename}: ${triangles[lod]} triangles, ${exported.byteSize} bytes`);
    }
    updateManifest(path.join(outputDir, 'manifest.json'), {
      id: meta.id, name: meta.name, category: 'arhat',
      files: { lod0: `/models/figures/arhats/${meta.id}.glb`, lod1: `/models/figures/arhats/${meta.id}_lod1.glb` },
      triangles: { lod0: triangles[0], lod1: triangles[1] }, isRigged: false, materials: [...materialNames].sort(),
    });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bakeArhats().catch((error) => { console.error(error); process.exitCode = 1; });
}
