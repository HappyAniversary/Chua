import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { FigureManifest } from './types.ts';

export interface AssetAudit {
  id: string; lod: string; bytes: number; triangles: number; bones: number;
  bodyComponents: number; boundaryEdges: number; nonmanifoldEdges: number; degenerateTriangles: number;
  errors: string[];
}

/** Weld exported material seams in model space before checking the surface topology. */
export function auditSurface(meshes: THREE.Mesh[]) {
  const ids = new Map<string, number>();
  const edges = new Map<string, number>();
  const parent: number[] = [];
  const find = (n: number): number => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  const union = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const point = new THREE.Vector3();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let degenerateTriangles = 0;
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g.getAttribute('position');
    const mapped = new Map<number, number>();
    const id = (i: number) => {
      if (mapped.has(i)) return mapped.get(i)!;
      point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const key = [point.x, point.y, point.z].map((v) => Math.round(v * 1e6)).join(',');
      let n = ids.get(key);
      if (n === undefined) { n = parent.length; ids.set(key, n); parent.push(n); }
      mapped.set(i, n); return n;
    };
    const count = g.index?.count ?? pos.count;
    for (let i = 0; i < count; i += 3) {
      const source = [0, 1, 2].map((j) => g.index ? g.index.getX(i + j) : i + j);
      const face = source.map(id);
      if (new Set(face).size < 3) { degenerateTriangles++; continue; }
      a.fromBufferAttribute(pos, source[0]).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(pos, source[1]).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(pos, source[2]).applyMatrix4(mesh.matrixWorld);
      ab.subVectors(b, a); ac.subVectors(c, a);
      const maxEdgeSq = Math.max(ab.lengthSq(), ac.lengthSq(), b.distanceToSquared(c));
      if (ab.cross(ac).lengthSq() <= Math.max(1e-28, maxEdgeSq * maxEdgeSq * 1e-14)) { degenerateTriangles++; continue; }
      union(face[0], face[1]); union(face[1], face[2]);
      for (let j = 0; j < 3; j++) {
        const a = face[j], b = face[(j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
  }
  return {
    bodyComponents: new Set(parent.map((_, i) => find(i))).size,
    boundaryEdges: [...edges.values()].filter((n) => n === 1).length,
    nonmanifoldEdges: [...edges.values()].filter((n) => n > 2).length,
    degenerateTriangles,
  };
}

export async function validateFigureDirectory(directory: string) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8')) as FigureManifest;
  const entries = Object.values(manifest.figures);
  if (entries.length !== 21) throw new Error(`Expected 21 figures, found ${entries.length}.`);
  const audits: AssetAudit[] = [];
  for (const entry of entries) for (const [lod, url] of Object.entries(entry.files)) {
    if (!url || !url.startsWith('/models/figures/')) throw new Error(`Invalid figure URL: ${url}`);
    const bytes = await fs.readFile(path.join(directory, url.slice('/models/figures/'.length)));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    gltf.scene.updateMatrixWorld(true);
    const audit: AssetAudit = { id: entry.id, lod, bytes: bytes.length, triangles: 0, bones: 0, bodyComponents: 0, boundaryEdges: 0, nonmanifoldEdges: 0, degenerateTriangles: 0, errors: [] };
    const surfaces: THREE.Mesh[] = [];
    const sockets = new Set<string>();
    gltf.scene.traverse((object) => {
      if (object.name.endsWith('_socket')) sockets.add(object.name);
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh, geometry = mesh.geometry, pos = geometry.getAttribute('position');
      const count = geometry.index?.count ?? pos.count;
      audit.triangles += count / 3;
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        for (let i = 0; i < attribute.array.length; i++) if (!Number.isFinite(attribute.array[i])) { audit.errors.push(`Nonfinite ${name} on ${mesh.name}`); break; }
      }
      if (geometry.index) for (let i = 0; i < geometry.index.count; i++) if (geometry.index.getX(i) >= pos.count) { audit.errors.push('Index out of bounds'); break; }
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinned = mesh as THREE.SkinnedMesh;
        audit.bones = Math.max(audit.bones, skinned.skeleton.bones.length);
        skinned.skeleton.update();
        const weight = geometry.getAttribute('skinWeight'), index = geometry.getAttribute('skinIndex');
        if (!weight || !index) audit.errors.push('Missing skin attributes');
        else for (let i = 0; i < pos.count; i++) {
          let sum = 0;
          for (let j = 0; j < 4; j++) { const w = weight.getComponent(i, j); sum += w; if (w < 0 || index.getComponent(i, j) >= skinned.skeleton.bones.length) audit.errors.push('Invalid skin influence'); }
          if (Math.abs(sum - 1) > 1e-4) { audit.errors.push('Unnormalized skin weights'); break; }
        }
      }
      // Facial ink is authored as separate small meshes; anatomical body is one continuous surface.
      if (geometry.getAttribute('_regionid')) surfaces.push(mesh);
    });
    if (!surfaces.length) audit.errors.push('Missing authored region IDs');
    Object.assign(audit, auditSurface(surfaces));
    if (audit.bodyComponents !== 1) audit.errors.push(`Anatomical surface has ${audit.bodyComponents} components`);
    if (audit.boundaryEdges) audit.errors.push(`${audit.boundaryEdges} open body edges`);
    if (audit.nonmanifoldEdges) audit.errors.push(`${audit.nonmanifoldEdges} nonmanifold body edges`);
    if (audit.degenerateTriangles) audit.errors.push(`${audit.degenerateTriangles} degenerate body triangles`);
    if (audit.triangles !== entry.triangles[lod as 'lod0' | 'lod1']) audit.errors.push('Manifest triangle count mismatch');
    if (entry.isRigged !== (audit.bones > 0)) audit.errors.push('Manifest rig mismatch');
    if (entry.bonesCount !== undefined && entry.bonesCount !== audit.bones) audit.errors.push('Manifest bone count mismatch');
    for (const name of Object.keys(entry.sockets ?? {})) if (!sockets.has(name)) audit.errors.push(`Missing socket ${name}`);
    audits.push(audit);
  }
  if (audits.length !== 42) throw new Error(`Expected 42 GLBs, found ${audits.length}.`);
  return { generatedAt: new Date().toISOString(), evidence: 'offline GLB structural validation', passed: audits.every((a) => !a.errors.length), assets: audits };
}
