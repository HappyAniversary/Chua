import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { extractSurfaceNets } from '../../scripts/figures/mesher.ts';
import { assignStatueMaterials, countObjectTriangles } from '../../scripts/figures/materials.ts';
import { exportObjectToGLB } from '../../scripts/figures/exporter.ts';
import { auditSurface } from '../../scripts/figures/validate.ts';

test('surface audit rejects a collinear triangle even when all three corners are distinct', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 2, 0, 0], 3));
  geometry.setIndex([0, 1, 2]);
  const mesh = new THREE.Mesh(geometry);
  mesh.updateMatrixWorld(true);
  assert.equal(auditSurface([mesh]).degenerateTriangles, 1);
});

test('GLB export preserves region IDs, material seams, static socket space and exact triangle inventory', async () => {
  const { geometry } = extractSurfaceNets(p => ({ distance: Math.hypot(...p) - 0.6, materialId: p[0] > 0 ? 3 : 7 }), {
    resolution: 16, bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, smoothIterations: 1,
  });
  const materials = assignStatueMaterials(geometry);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, materials));
  const socket = new THREE.Object3D(); socket.name = 'hand_r_socket'; socket.position.set(0.2, 0.4, 0.1); group.add(socket);
  const directory = await mkdtemp(join(tmpdir(), 'figure-export-'));
  try {
    const { buffer } = await exportObjectToGLB(group, join(directory, 'fixture.glb'));
    const parsed = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
    parsed.scene.updateMatrixWorld(true);
    assert.equal(countObjectTriangles(parsed.scene), countObjectTriangles(group));
    assert.deepEqual(parsed.scene.getObjectByName('hand_r_socket')!.position.toArray(), [0.2, 0.4, 0.1]);
    const meshes: THREE.Mesh[] = [];
    const names = new Set<string>();
    parsed.scene.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh; meshes.push(mesh);
      assert.ok(mesh.geometry.getAttribute('_regionid'), 'custom region attribute must survive GLB round trip');
      names.add((mesh.material as THREE.Material).name);
    });
    assert.deepEqual([...names].sort(), ['Gold', 'WhiteSilk']);
    const topology = auditSurface(meshes);
    assert.equal(topology.bodyComponents, 1);
    assert.equal(topology.boundaryEdges, 0);
    assert.equal(topology.nonmanifoldEdges, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
