import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { extractSurfaceNets } from './figures/mesher.ts';
import { createMonkFigureSDF } from './figures/samples.ts';
import { createBuddhaFigureSDF } from './figures/buddha.ts';
import { createQuanAmFigureSDF } from './figures/quanam.ts';
import { STANDARD_HUMANOID_BONES, STANDARD_SOCKETS, rigGeometryToSkinnedMesh } from './figures/skeleton.ts';
import { addMonkFaceDetails, addStatueFaceDetails } from './figures/face-details.ts';
import { assignStatueMaterials, countObjectTriangles, figureResolution, FIGURE_CELL_SIZES } from './figures/materials.ts';
import { exportObjectToGLB, updateManifest } from './figures/exporter.ts';
import type { FigureManifestEntry } from './figures/types.ts';

export async function bakeMainFigures(outputDir = path.resolve(process.env.FIGURES_OUTPUT_DIR ?? 'public/models/figures')) {
  const definitions = [
    { id: 'sample_monk', name: 'Chú Tiểu', category: 'player' as const, factory: createMonkFigureSDF },
    { id: 'buddha', name: 'Đức Phật Thích Ca Mâu Ni', category: 'buddha' as const, factory: createBuddhaFigureSDF },
    { id: 'quanam', name: 'Bồ Tát Quán Thế Âm', category: 'quanam' as const, factory: createQuanAmFigureSDF },
  ];
  for (const definition of definitions) {
    const figure = definition.factory();
    const triangles: number[] = [];
    const used = new Set<string>();
    for (const [lod, cellSize] of FIGURE_CELL_SIZES[definition.category].entries()) {
      const resolution = figureResolution(figure.bounds, cellSize);
      const result = extractSurfaceNets(figure.sdf, { resolution, bounds: figure.bounds, smoothIterations: 2, smoothFactor: 0.18 });
      let object: THREE.Object3D;
      if (definition.category === 'player') {
        const { skinnedMesh } = rigGeometryToSkinnedMesh(result.geometry, STANDARD_HUMANOID_BONES);
        skinnedMesh.name = 'sample_monk';
        (skinnedMesh.material as THREE.Material).name = 'MonkSurface';
        addMonkFaceDetails(skinnedMesh);
        object = skinnedMesh;
      } else {
        // These statues have a fixed sculpted pose; sockets are model-space anchors.
        const group = new THREE.Group();
        group.name = definition.id;
        const materials = assignStatueMaterials(result.geometry);
        const mesh = new THREE.Mesh(result.geometry, materials);
        mesh.name = `${definition.id}_surface`;
        group.add(mesh);
        addStatueFaceDetails(group, definition.id === 'buddha' ? [0, 1.565, 0.012] : [0, 1.735, 0.025], 0, definition.id === 'quanam');
        if ('sockets' in figure) {
          for (const [name, socket] of Object.entries(figure.sockets)) {
            const anchor = new THREE.Object3D();
            anchor.name = name;
            anchor.position.fromArray(socket.position);
            group.add(anchor);
          }
        }
        object = group;
      }
      object.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const material = (obj as THREE.Mesh).material;
        for (const item of Array.isArray(material) ? material : [material]) used.add(item.name);
      });
      triangles.push(countObjectTriangles(object));
      const filename = `${definition.id}${lod ? '_lod1' : ''}.glb`;
      const exported = await exportObjectToGLB(object, path.join(outputDir, filename));
      console.log(`${filename}: ${triangles[lod]} triangles, ${exported.byteSize} bytes`);
    }
    const entry: FigureManifestEntry = {
      id: definition.id, name: definition.name, category: definition.category,
      files: { lod0: `/models/figures/${definition.id}.glb`, lod1: `/models/figures/${definition.id}_lod1.glb` },
      triangles: { lod0: triangles[0], lod1: triangles[1] },
      isRigged: definition.category === 'player',
      ...(definition.category === 'player' ? {
        bonesCount: STANDARD_HUMANOID_BONES.length,
        sockets: Object.fromEntries(STANDARD_SOCKETS.map((s) => [s.name, { bone: s.boneName, position: s.offset }])),
      } : 'sockets' in figure ? {
        sockets: Object.fromEntries(Object.entries(figure.sockets).map(([name, s]) => [name, { bone: definition.id, position: s.position }])),
      } : {}),
      materials: [...used].sort(),
    };
    updateManifest(path.join(outputDir, 'manifest.json'), entry);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bakeMainFigures().catch((error) => { console.error(error); process.exitCode = 1; });
}
