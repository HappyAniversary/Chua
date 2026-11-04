import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { extractSurfaceNets } from '../../scripts/figures/mesher.ts';
import { createArhatFigureSDF } from '../../scripts/figures/arhats.ts';
import { createMonkFigureSDF } from '../../scripts/figures/samples.ts';
import { rigGeometryToSkinnedMesh } from '../../scripts/figures/skeleton.ts';
import { createFigureAnimator } from '../../src/utils/figureAnimation';
import {
  opSmoothSubtraction, opSmoothUnion, sdCapsule, sdCappedCone, sdEllipsoid,
} from '../../scripts/figures/sdf.ts';

test('robe cones keep their specified side surface at every scale', () => {
  // A cylinder is the equal-radius cone case: x=radius is its side surface.
  assert.ok(Math.abs(sdCappedCone([0.2, 0, 0], 0.4, 0.2, 0.2)) < 1e-10);
  // Halfway up a tapered cone the side radius is halfway between its ends.
  assert.ok(Math.abs(sdCappedCone([0.285, 0, 0], 0.45, 0.22, 0.35)) < 1e-10);
  assert.ok(sdCappedCone([0, 0, 0], 0.4, 0.2, 0.2) < 0);
  assert.ok(sdCappedCone([0.25, 0, 0], 0.4, 0.2, 0.2) > 0);
});

test('avatar arm movement cannot pull the robe hem or the opposite hand', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0.27, 0.78, 0.03, // robe alongside the hand, not part of the hand
    0.32, 0.78, 0.05, // right palm
    -0.32, 0.78, 0.05, // left palm
    0.04, 1.72, 0.12, // rigid upper face
  ], 3));
  geometry.setAttribute('regionId', new THREE.Uint8BufferAttribute([1, 0, 0, 0], 1));
  const { skinnedMesh, skeleton, boneMap } = rigGeometryToSkinnedMesh(geometry);
  skinnedMesh.updateMatrixWorld(true);
  skeleton.update();
  const before = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), 0);
  skinnedMesh.applyBoneTransform(0, before);
  boneMap.get('UpperArm_R')!.rotation.x = -1;
  boneMap.get('LowerArm_R')!.rotation.y = -0.5;
  skinnedMesh.updateMatrixWorld(true);
  skeleton.update();
  const after = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), 0);
  skinnedMesh.applyBoneTransform(0, after);
  assert.ok(before.distanceTo(after) < 1e-6, 'sleeve and hand bones must not drag skirt vertices');
  const indices = geometry.getAttribute('skinIndex');
  const weights = geometry.getAttribute('skinWeight');
  for (const [vertex, excludedSide] of [[1, '_L'], [2, '_R']] as const) {
    for (let slot = 0; slot < 4; slot++) {
      const boneName = skeleton.bones[indices.array[vertex * 4 + slot]].name;
      if (weights.array[vertex * 4 + slot] > 1e-6) assert.ok(!boneName.endsWith(excludedSide));
    }
  }
  for (let slot = 0; slot < 4; slot++) {
    if (weights.array[3 * 4 + slot] > 1e-6) {
      assert.equal(skeleton.bones[indices.array[3 * 4 + slot]].name, 'Head');
    }
  }
});

test('smoothing a steep implicit field keeps a closed round surface without spikes', () => {
  const { geometry } = extractSurfaceNets((p) => ({
    distance: 100 * (Math.hypot(...p) - 0.5),
    materialId: p[0] > 0 ? 1 : 0,
  }), {
    bounds: { min: [-0.7, -0.7, -0.7], max: [0.7, 0.7, 0.7] },
    resolution: 24,
    smoothIterations: 3,
  });
  const positions = geometry.getAttribute('position');
  const regions = geometry.getAttribute('regionId');
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const radius = Math.hypot(positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex));
    assert.ok(radius > 0.45 && radius < 0.55, `surface spike at vertex ${vertex}: ${radius}`);
    assert.equal(regions?.getX(vertex), positions.getX(vertex) > 0 ? 1 : 0);
  }
  const edges = new Map<string, number>();
  const indices = geometry.getIndex()!;
  for (let face = 0; face < indices.count; face += 3) {
    const corners = [indices.getX(face), indices.getX(face + 1), indices.getX(face + 2)];
    const [a, b, c] = corners.map((vertex) => new THREE.Vector3().fromBufferAttribute(positions, vertex));
    const outward = b.clone().sub(a).cross(c.clone().sub(a));
    assert.ok(outward.dot(a.clone().add(b).add(c)) > 0, 'sphere faces must face outward');
    for (let edge = 0; edge < 3; edge++) {
      const [a, b] = [corners[edge], corners[(edge + 1) % 3]].sort((a, b) => a - b);
      const key = `${a}:${b}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  assert.ok(edges.size > 0);
  for (const count of edges.values()) assert.equal(count, 2, 'round surface must be closed and manifold');
});

test('primitive centers and zero smoothing cannot poison an extraction with NaN', () => {
  assert.equal(sdEllipsoid([0, 0, 0], [0.1, 0.2, 0.3]), -0.1);
  assert.equal(sdCapsule([0, 0, 0], [0, 0, 0], [0, 0, 0], 0.1), -0.1);
  const a = { distance: -0.2, materialId: 1 };
  const b = { distance: 0.3, materialId: 2 };
  assert.deepEqual(opSmoothUnion(a, b, 0), a);
  assert.equal(opSmoothSubtraction(a, b, 0).distance, 0.3);
  assert.equal(sdCappedCone([0, 0, 0], 0, 0, 0), 0);
});

test('a statue with close garment folds has two faces at every welded surface edge', () => {
  const figure = createArhatFigureSDF(3);
  const { geometry } = extractSurfaceNets(figure.sdf, {
    bounds: figure.bounds, resolution: 38, smoothIterations: 2, smoothFactor: 0.18,
  });
  const indices = geometry.getIndex()!;
  const edges = new Map<string, number>();
  for (let face = 0; face < indices.count; face += 3) {
    const corners = [indices.getX(face), indices.getX(face + 1), indices.getX(face + 2)];
    for (let edge = 0; edge < 3; edge++) {
      const [a, b] = [corners[edge], corners[(edge + 1) % 3]].sort((a, b) => a - b);
      const key = `${a}:${b}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  const invalid = [...edges.values()].filter((count) => count !== 2);
  assert.equal(invalid.length, 0, `${invalid.length} ambiguous or open statue edges`);
});

test('both production monk LODs keep connected cloth edges short through all six actions', () => {
  const figure = createMonkFigureSDF();
  const failures: string[] = [];
  for (const cell of [0.027, 0.044]) {
    const resolution = figure.bounds.max.map((max, axis) => Math.ceil((max - figure.bounds.min[axis]) / cell) + 1) as Vec3;
    const { geometry } = extractSurfaceNets(figure.sdf, {
      bounds: figure.bounds, resolution, smoothIterations: 2, smoothFactor: 0.18,
    });
    const { skinnedMesh, skeleton } = rigGeometryToSkinnedMesh(geometry);
    const drive = createFigureAnimator(skinnedMesh);
    const positions = geometry.getAttribute('position');
    const rest = Array.from({ length: positions.count }, (_, vertex) => new THREE.Vector3().fromBufferAttribute(positions, vertex));
    const posed = rest.map((point) => point.clone());
    const indices = geometry.getIndex()!;
    let worst = { excess: -Infinity, description: '', a: 0, b: 0 };
    for (const action of ['idle', 'walking', 'praying', 'wooden_fish', 'fortune', 'bell'] as const) {
      const rate = { idle: 2.2, walking: 7, praying: 3, wooden_fish: 8, fortune: 14, bell: 3.2 }[action];
      // Include both exact sine extrema, especially the deep bow and beater lift.
      const phases = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / (2 * rate), Math.PI * 3 / (2 * rate)];
      for (const phase of phases) {
        drive('none', 0, 1 / 60);
        for (let frame = 0; frame < 60; frame++) drive(action, phase, 1 / 60, phase);
        skinnedMesh.updateMatrixWorld(true);
        skeleton.update();
        posed.forEach((point, vertex) => skinnedMesh.applyBoneTransform(vertex, point.copy(rest[vertex])));
        for (let face = 0; face < indices.count; face += 3) for (let edge = 0; edge < 3; edge++) {
          const a = indices.getX(face + edge), b = indices.getX(face + (edge + 1) % 3);
          const originalLength = rest[a].distanceTo(rest[b]);
          const posedLength = posed[a].distanceTo(posed[b]);
          const excess = posedLength - (originalLength * 4 + 0.012);
          if (excess > worst.excess) worst = {
            excess,
            a, b,
            description: `${action} phase ${phase}, cell ${cell}: edge ${a}→${b} stretched ${originalLength.toFixed(5)}→${posedLength.toFixed(5)} near ${rest[a].toArray()}`,
          };
        }
      }
    }
    const describeWeights = (vertex: number) => {
      const weights = geometry.getAttribute('skinWeight');
      const bones = geometry.getAttribute('skinIndex');
      return Array.from({ length: 4 }, (_, slot) => `${skeleton.bones[bones.array[vertex * 4 + slot]].name}:${weights.array[vertex * 4 + slot].toFixed(3)}`).join(', ');
    };
    if (worst.excess > 0) failures.push(`${worst.description}; ${describeWeights(worst.a)} vs ${describeWeights(worst.b)} at ${rest[worst.b].toArray()}`);
    geometry.dispose();
  }
  assert.deepEqual(failures, []);
});
