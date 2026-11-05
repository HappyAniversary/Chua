import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GraphicsQuality } from '../types/game';

export const FIGURE_ASSET_VERSION = 'sculpture-v3';

export function figureAssetUrl(url: string): string {
  const [path, query = ''] = url.split('?');
  const params = new URLSearchParams(query);
  params.set('v', FIGURE_ASSET_VERSION);
  return `${path}?${params}`;
}

export function figureLodUrl(url: string): string {
  return url.replace(/(?:_lod1)?\.glb(?=\?|$)/, '_lod1.glb');
}

/** Two metre-wide hysteresis band, scaled with the displayed figure. */
export function nextFigureLod(current: 0 | 1, distance: number, quality: GraphicsQuality, scale = 1): 0 | 1 {
  const threshold = ({ low: 8, balanced: 12, high: 18 } as const)[quality] * Math.max(0.5, scale);
  const band = Math.max(1, scale);
  return current === 0 ? (distance > threshold + band ? 1 : 0) : (distance < threshold - band ? 0 : 1);
}

export function kasayaTrimColor(robeColor: string): string {
  return ({ '#d97706': '#92400e', '#991b1b': '#78350f', '#78350f': '#451a03', '#4b5563': '#374151', '#1e3a8a': '#1e293b' } as Record<string, string>)[robeColor] ?? '#78350f';
}

/** A cached GLTF is immutable; each displayed instance owns everything it mutates. */
export function createFigureInstance(source: THREE.Object3D, mutableColors = false) {
  const scene = cloneSkeleton(source);
  const meshes: THREE.Mesh[] = [];
  const sockets = new Map<string, THREE.Object3D>();
  const bones = new Map<string, THREE.Bone>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const skeletons = new Set<THREE.Skeleton>();
  const originalColors = new Map<THREE.BufferGeometry, Float32Array>();
  let vertices = 0;
  let triangles = 0;
  scene.traverse((object) => {
    if ((object as THREE.Bone).isBone) bones.set(object.name, object as THREE.Bone);
    if (object.name.endsWith('_socket')) sockets.set(object.name, object);
    if (!(object as THREE.Mesh).isMesh) return;
    const mesh = object as THREE.Mesh;
    meshes.push(mesh);
    const cloneMaterial = (material: THREE.Material) => {
      const result = material.clone();
      materials.add(result);
      return result;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
    if (mutableColors && mesh.geometry.getAttribute('color')) {
      mesh.geometry = mesh.geometry.clone();
      geometries.add(mesh.geometry);
      const color = mesh.geometry.getAttribute('color');
      originalColors.set(mesh.geometry, Float32Array.from(color.array));
    }
    const position = mesh.geometry.getAttribute('position');
    vertices += position?.count ?? 0;
    triangles += (mesh.geometry.index?.count ?? position?.count ?? 0) / 3;
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
      // Pose changes can move vertices beyond the bind-pose bounds.
      mesh.frustumCulled = false;
      skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
    }
  });
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  return {
    scene, meshes, sockets, bones, materials, bounds,
    stats: { vertices, triangles: Math.round(triangles), bones: bones.size },
    recolorRobe(robeColor: string, trimColor = kasayaTrimColor(robeColor)) {
      const robe = new THREE.Color(robeColor);
      const trim = new THREE.Color(trimColor);
      meshes.forEach((mesh) => {
        const color = mesh.geometry.getAttribute('color');
        const region = mesh.geometry.getAttribute('_regionid') ?? mesh.geometry.getAttribute('regionId');
        const original = originalColors.get(mesh.geometry);
        if (!color || !region || !original) return;
        const reference = mesh.userData.figureRecolor as { robe?: string; trim?: string } | undefined;
        const luminance = (r: number, g: number, b: number) => r * 0.2126 + g * 0.7152 + b * 0.0722;
        const referenceLuminance = (css?: string) => {
          if (!css) return undefined;
          const rgb = new THREE.Color(css);
          return luminance(rgb.r, rgb.g, rgb.b);
        };
        const bases = [referenceLuminance(reference?.robe), referenceLuminance(reference?.trim)];
        for (let i = 0; i < color.count; i++) {
          const id = Math.round(region.getX(i));
          const rgb = id === 1 ? robe : id === 2 ? trim : null;
          if (rgb) {
            const base = bases[id - 1];
            const offset = i * color.itemSize;
            const shade = base ? luminance(original[offset], original[offset + 1], original[offset + 2]) / base : 1;
            color.setXYZ(i, rgb.r * shade, rgb.g * shade, rgb.b * shade);
          }
          else color.setXYZ(i, original[i * color.itemSize], original[i * color.itemSize + 1], original[i * color.itemSize + 2]);
        }
        color.needsUpdate = true;
      });
    },
    setVisible(visible: boolean) {
      meshes.forEach((mesh) => {
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
          // Sockets are children of the canonical skeleton. Hide only its
          // surface, so props remain reachable while the other LOD is drawn.
          mesh.visible = true;
          const surface = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          surface.forEach((material) => { material.visible = visible; });
        } else mesh.visible = visible;
      });
    },
    dispose() {
      // Texture maps and immutable geometry remain owned by the useGLTF cache.
      materials.forEach((material) => material.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      skeletons.forEach((skeleton) => skeleton.dispose());
    },
  };
}

export type FigureInstance = ReturnType<typeof createFigureInstance>;
