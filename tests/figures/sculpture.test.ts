import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createMonkSculpt } from '../../scripts/figures/monk-sculpt.ts';
import { createStatueSculpt } from '../../scripts/figures/statue-sculpt.ts';
import { ARHAT_METADATA_LIST } from '../../scripts/figures/arhats.ts';
import { STANDARD_HUMANOID_BONES, STANDARD_SOCKETS } from '../../scripts/figures/skeleton.ts';
import { countObjectTriangles } from '../../scripts/figures/materials.ts';
import { auditSurface } from '../../scripts/figures/validate.ts';
import { exportObjectToGLB } from '../../scripts/figures/exporter.ts';
import { createFigureAnimator } from '../../src/utils/figureAnimation';
import { createFigureInstance } from '../../src/utils/figureAssets';

const statueIds = ['buddha', 'quanam', ...ARHAT_METADATA_LIST.map(({ id }) => id)] as Parameters<typeof createStatueSculpt>[0][];
const monks = new Map<0 | 1, THREE.SkinnedMesh>();
const statues = new Map<string, THREE.Group>();
function monk(lod: 0 | 1) {
  if (!monks.has(lod)) monks.set(lod, createMonkSculpt(lod));
  return monks.get(lod)!;
}
function statue(id: Parameters<typeof createStatueSculpt>[0], lod: 0 | 1) {
  const key = `${id}:${lod}`;
  if (!statues.has(key)) statues.set(key, createStatueSculpt(id, lod));
  return statues.get(key)!;
}

function meshParts(root: THREE.Object3D) {
  const groups = new Map<THREE.Object3D, THREE.Mesh[]>();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return;
    let owner: THREE.Object3D | null = object;
    while (owner && !owner.userData.figurePart) owner = owner.parent;
    assert.ok(owner, `${object.name}: surface has no declared authored part`);
    const meshes = groups.get(owner) ?? [];
    meshes.push(object as THREE.Mesh);
    groups.set(owner, meshes);
  });
  return groups;
}

test('authored monk and all twenty statue assemblies have finite, manifold declared surfaces in both LODs', () => {
  for (const lod of [0, 1] as const) {
    const models = [['sample_monk', monk(lod)], ...statueIds.map((id) => [id, statue(id, lod)])] as [string, THREE.Object3D][];
    for (const [id, root] of models) {
      const parts = meshParts(root);
      assert.ok(parts.size > 0, `${id} LOD${lod}: no sculpted surfaces`);
      for (const [owner, meshes] of parts) {
        const label = `${id} LOD${lod} ${owner.name}`;
        const specification = owner.userData.figurePart as { closed: boolean; components: number };
        assert.equal(typeof specification.closed, 'boolean', `${label}: missing closure declaration`);
        assert.ok(Number.isInteger(specification.components) && specification.components > 0, `${label}: invalid part inventory`);
        for (const mesh of meshes) {
          const geometry = mesh.geometry;
          const position = geometry.getAttribute('position');
          assert.ok(position?.count > 2, `${label}: empty surface`);
          for (const [name, attribute] of Object.entries(geometry.attributes)) {
            assert.equal(attribute.count, position.count, `${label}: ${name} count differs from positions`);
            assert.ok(Array.from(attribute.array).every(Number.isFinite), `${label}: nonfinite ${name}`);
          }
          if (geometry.index) for (const index of geometry.index.array) {
            assert.ok(index >= 0 && index < position.count, `${label}: index outside position buffer`);
          }
        }
        const topology = auditSurface(meshes);
        assert.equal(topology.bodyComponents, specification.components, `${label}: unexpected separated component`);
        assert.equal(topology.degenerateTriangles, 0, `${label}: collapsed triangle`);
        assert.equal(topology.nonmanifoldEdges, 0, `${label}: nonmanifold edge`);
        if (specification.closed) assert.equal(topology.boundaryEdges, 0, `${label}: unintentional hole`);
      }
    }
  }
});

test('both sculpture LODs preserve placement envelopes and lower LOD reduces actual rendered triangles', () => {
  const models = ['sample_monk', ...statueIds];
  for (const id of models) {
    const objects = ([0, 1] as const).map((lod) => id === 'sample_monk' ? monk(lod) : statue(id as Parameters<typeof createStatueSculpt>[0], lod));
    const bounds = objects.map((object) => {
      object.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(object);
    });
    const highSize = bounds[0].getSize(new THREE.Vector3());
    assert.ok(highSize.y > 1.2 && highSize.y < 2.7, `${id}: height changed beyond the temple placement range`);
    assert.ok(highSize.x > 0.3 && highSize.x < 2.1 && highSize.z > 0.15 && highSize.z < 1.8, `${id}: width/depth no longer fits its placement`);
    assert.ok(bounds[0].min.y >= -0.1 && bounds[1].min.y >= -0.1, `${id}: model sinks below its origin`);
    assert.ok(bounds[0].min.distanceTo(bounds[1].min) < 0.08 && bounds[0].max.distanceTo(bounds[1].max) < 0.08, `${id}: LOD switch changes the silhouette envelope`);
    assert.ok(countObjectTriangles(objects[1]) < countObjectTriangles(objects[0]), `${id}: LOD1 does not reduce submitted triangles`);
  }
});

test('new playable sculpture retains the complete rig, attachment sockets and normalized skin influences', () => {
  for (const lod of [0, 1] as const) {
    const model = monk(lod);
    assert.deepEqual(model.skeleton.bones.map(({ name }) => name), STANDARD_HUMANOID_BONES.map(({ name }) => name));
    for (const { name, boneName } of STANDARD_SOCKETS) {
      const socket = model.getObjectByName(name);
      assert.ok(socket, `LOD${lod}: missing ${name}`);
      assert.equal(socket.parent?.name, boneName, `LOD${lod}: ${name} attached to wrong bone`);
    }
    const indices = model.geometry.getAttribute('skinIndex');
    const weights = model.geometry.getAttribute('skinWeight');
    assert.ok(indices && weights, `LOD${lod}: absent skin attributes`);
    for (let vertex = 0; vertex < weights.count; vertex++) {
      let sum = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights.getComponent(vertex, slot);
        assert.ok(weight >= 0 && indices.getComponent(vertex, slot) < model.skeleton.bones.length, `LOD${lod}: invalid joint influence`);
        sum += weight;
      }
      assert.ok(Math.abs(sum - 1) < 1e-5, `LOD${lod}: unnormalized skin weights`);
    }
  }
});

test('authored cloth edges and coincident smooth seams stay closed through all six game actions in both LODs', () => {
  for (const lod of [0, 1] as const) {
    const model = monk(lod);
    const drive = createFigureAnimator(model);
    const geometry = model.geometry;
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const rest = Array.from({ length: positions.count }, (_, vertex) => new THREE.Vector3().fromBufferAttribute(positions, vertex));
    const posed = rest.map((point) => point.clone());
    const indices = geometry.getIndex()!;
    const seamPairs: [number, number][] = [];
    const seen = new Map<string, number>();
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const key = rest[vertex].toArray().map((value) => Math.round(value * 1e6)).join(',');
      const previous = seen.get(key);
      if (previous !== undefined && new THREE.Vector3().fromBufferAttribute(normals, previous).dot(new THREE.Vector3().fromBufferAttribute(normals, vertex)) > 0.999) seamPairs.push([previous, vertex]);
      else seen.set(key, vertex);
    }
    let worst = { excess: -Infinity, description: '' };
    for (const action of ['idle', 'walking', 'praying', 'wooden_fish', 'fortune', 'bell'] as const) {
      const rate = { idle: 2.2, walking: 7, praying: 3, wooden_fish: 8, fortune: 14, bell: 3.2 }[action];
      for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / (2 * rate), Math.PI * 3 / (2 * rate)]) {
        drive('none', 0, 1 / 60);
        for (let frame = 0; frame < 60; frame++) drive(action, phase, 1 / 60, phase);
        model.updateMatrixWorld(true);
        model.skeleton.update();
        posed.forEach((point, vertex) => model.applyBoneTransform(vertex, point.copy(rest[vertex])));
        for (let face = 0; face < indices.count; face += 3) for (let edge = 0; edge < 3; edge++) {
          const a = indices.getX(face + edge), b = indices.getX(face + (edge + 1) % 3);
          const original = rest[a].distanceTo(rest[b]);
          const deformed = posed[a].distanceTo(posed[b]);
          // Keep the existing production regression gate: no tolerance widening for the remodel.
          const excess = deformed - (original * 4 + 0.012);
          if (excess > worst.excess) worst = { excess, description: `LOD${lod} ${action} at ${phase}: edge ${a}-${b} ${original} -> ${deformed}` };
        }
        for (const [a, b] of seamPairs) assert.ok(posed[a].distanceTo(posed[b]) < 1e-5, `LOD${lod} ${action}: seam ${a}-${b} opens`);
        assert.ok(posed.every(({ x, y, z }) => Number.isFinite(x + y + z)), `LOD${lod} ${action}: nonfinite posed vertex`);
      }
    }
    drive('none', 0, 1 / 60);
    model.updateMatrixWorld(true);
    assert.ok(worst.excess <= 0, worst.description);
  }
});

test('authored surface inventories and rig survive the same GLB export/load path used by the game', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'chua-sculpture-export-'));
  try {
    for (const lod of [0, 1] as const) {
      const models: [string, THREE.Object3D][] = [
        ['sample_monk', monk(lod)], ['buddha', statue('buddha', lod)],
        ['quanam', statue('quanam', lod)], ['arhat_11', statue('arhat_11', lod)],
      ];
      for (const [id, source] of models) {
        const sourcePartInventory = [...meshParts(source)].map(([owner]) => owner.userData.figurePart.components).sort((a, b) => a - b);
        const { buffer } = await exportObjectToGLB(source, join(directory, `${id}-${lod}.glb`));
        const { scene } = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
        assert.equal(countObjectTriangles(scene), countObjectTriangles(source), `${id} LOD${lod}: triangles lost on export`);
        const exportedParts = meshParts(scene);
        assert.deepEqual([...exportedParts].map(([owner]) => owner.userData.figurePart.components).sort((a, b) => a - b), sourcePartInventory, `${id} LOD${lod}: part declarations lost on export`);
        for (const [owner, meshes] of exportedParts) {
          const actual = auditSurface(meshes);
          assert.equal(actual.bodyComponents, owner.userData.figurePart.components, `${id} LOD${lod}: exported component count changed`);
          assert.equal(actual.degenerateTriangles, 0, `${id} LOD${lod}: export collapsed triangle`);
        }
        if (id === 'sample_monk') {
          const instance = createFigureInstance(scene, true);
          assert.equal(instance.bones.size, 23, `LOD${lod}: exported skeleton incomplete`);
          for (const { name } of STANDARD_SOCKETS) assert.ok(instance.sockets.has(name), `LOD${lod}: exported socket ${name} missing`);
          assert.ok(instance.meshes.some((mesh) => mesh.geometry.getAttribute('_regionid')), `LOD${lod}: recolor region IDs lost on export`);
          instance.dispose();
        }
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('wardrobe changes affect the new garments without bleaching the skin or shared sculpture source', () => {
  for (const lod of [0, 1] as const) {
    const source = monk(lod);
    const instance = createFigureInstance(source, true);
    const sourceColors = Array.from(source.geometry.getAttribute('color').array);
    const before = instance.meshes.map((mesh) => Array.from(mesh.geometry.getAttribute('color')?.array ?? []));
    instance.recolorRobe('#991b1b', '#78350f');
    let changedGarmentVertices = 0, skinVertices = 0;
    instance.meshes.forEach((mesh, meshIndex) => {
      const color = mesh.geometry.getAttribute('color');
      const region = mesh.geometry.getAttribute('regionId') ?? mesh.geometry.getAttribute('_regionid');
      if (!color || !region) return;
      for (let vertex = 0; vertex < color.count; vertex++) {
        const original = before[meshIndex].slice(vertex * color.itemSize, vertex * color.itemSize + 3);
        const current = [color.getX(vertex), color.getY(vertex), color.getZ(vertex)];
        if (region.getX(vertex) === 0) { skinVertices++; assert.deepEqual(current, original, `LOD${lod}: recolor altered the skin`); }
        if ([1, 2].includes(region.getX(vertex)) && current.some((value, channel) => value !== original[channel])) changedGarmentVertices++;
      }
    });
    assert.ok(changedGarmentVertices > 0 && skinVertices > 0, `LOD${lod}: missing independent garment/skin regions`);
    assert.deepEqual(Array.from(source.geometry.getAttribute('color').array), sourceColors, `LOD${lod}: shared source mutated`);
    instance.dispose();
  }
});
