import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { createMonkSculpt } from './figures/monk-sculpt.ts';
import { createStatueSculpt } from './figures/statue-sculpt.ts';
import { STANDARD_HUMANOID_BONES, STANDARD_SOCKETS } from './figures/skeleton.ts';
import { countObjectTriangles } from './figures/materials.ts';
import { exportObjectToGLB, updateManifest } from './figures/exporter.ts';
import type { FigureManifestEntry } from './figures/types.ts';

/** The production models use authored smooth surfaces, with the original asset IDs. */
export async function bakeMainFigures(outputDir = path.resolve(process.env.FIGURES_OUTPUT_DIR ?? 'public/models/figures')) {
  const definitions = [
    { id: 'sample_monk', name: 'Chú Tiểu', category: 'player' as const },
    { id: 'buddha', name: 'Đức Phật Thích Ca Mâu Ni', category: 'buddha' as const },
    { id: 'quanam', name: 'Bồ Tát Quán Thế Âm', category: 'quanam' as const },
  ];
  for (const definition of definitions) {
    const triangles: number[] = [];
    const materials = new Set<string>();
    const sockets: NonNullable<FigureManifestEntry['sockets']> = {};
    for (const lod of [0, 1] as const) {
      const object = definition.category === 'player' ? createMonkSculpt(lod) : createStatueSculpt(definition.category, lod);
      object.userData.figureAssembly = 'authored-v3';
      object.traverse((node) => {
        if (node.name.endsWith('_socket')) sockets[node.name] = { bone: node.parent?.name ?? definition.id, position: node.position.toArray() };
        if (!(node as THREE.Mesh).isMesh) return;
        const material = (node as THREE.Mesh).material;
        for (const item of Array.isArray(material) ? material : [material]) materials.add(item.name);
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
      } : { sockets }),
      materials: [...materials].sort(),
    };
    updateManifest(path.join(outputDir, 'manifest.json'), entry);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  bakeMainFigures().catch((error) => { console.error(error); process.exitCode = 1; });
}
