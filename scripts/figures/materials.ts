import * as THREE from 'three';
import type { BoundingBox3D, Vec3 } from './types.ts';

export const FIGURE_CELL_SIZES = { player: [0.027, 0.044], buddha: [0.034, 0.055], quanam: [0.034, 0.055], arhat: [0.045, 0.065] } as const;

/** Uniform world-space voxels avoid oversampling a narrow model's horizontal axes. */
export function figureResolution(bounds: BoundingBox3D, cellSize: number): Vec3 {
  return bounds.max.map((max, axis) => Math.ceil((max - bounds.min[axis]) / cellSize) + 1) as Vec3;
}

export const FIGURE_MATERIAL_NAMES = ['Skin', 'Robe', 'KasayaTrim', 'Gold', 'Stone', 'Hair', 'Prop', 'WhiteSilk'];

/** Group faces by authored region so gold, cloth and stone retain separate PBR responses. */
export function assignStatueMaterials(geometry: THREE.BufferGeometry): THREE.MeshStandardMaterial[] {
  const regions = geometry.getAttribute('regionId');
  if (!regions || !geometry.index) throw new Error('Statue export requires indexed regionId geometry.');
  const byRegion = new Map<number, number[]>();
  for (let i = 0; i < geometry.index.count; i += 3) {
    const ids = [geometry.index.getX(i), geometry.index.getX(i + 1), geometry.index.getX(i + 2)];
    const slots = ids.map((id) => regions.getX(id));
    const region = slots[0] === slots[1] || slots[0] === slots[2] ? slots[0] : slots[1] === slots[2] ? slots[1] : slots[0];
    const list = byRegion.get(region) ?? [];
    list.push(...ids);
    byRegion.set(region, list);
  }
  geometry.clearGroups();
  const indices: number[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  for (const [region, faces] of [...byRegion.entries()].sort((a, b) => a[0] - b[0])) {
    geometry.addGroup(indices.length, faces.length, materials.length);
    indices.push(...faces);
    materials.push(new THREE.MeshStandardMaterial({
      name: FIGURE_MATERIAL_NAMES[region], vertexColors: true,
      roughness: region === 3 ? 0.48 : region === 7 ? 0.82 : region === 4 ? 0.76 : 0.72,
      metalness: region === 3 ? 0.42 : region === 2 ? 0.08 : 0,
    }));
  }
  geometry.setIndex(indices);
  return materials;
}

export function countObjectTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const geometry = (obj as THREE.Mesh).geometry;
    triangles += (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  });
  return triangles;
}
