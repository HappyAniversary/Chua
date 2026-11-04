import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createArhatFigureSDF, ARHAT_METADATA_LIST } from '../../scripts/figures/arhats.ts';
import { createBuddhaFigureSDF } from '../../scripts/figures/buddha.ts';
import { createQuanAmFigureSDF } from '../../scripts/figures/quanam.ts';
import { extractSurfaceNets } from '../../scripts/figures/mesher.ts';
import type { SDFFunction, Vec3 } from '../../scripts/figures/types.ts';
import { FIGURE_CELL_SIZES, figureResolution } from '../../scripts/figures/materials.ts';

const statues = [
  { id: 'buddha', ...createBuddhaFigureSDF() },
  { id: 'quanam', ...createQuanAmFigureSDF() },
  ...ARHAT_METADATA_LIST.map((meta) => ({ id: meta.id, ...createArhatFigureSDF(meta.index) })),
];

function assertInsideSegment(sdf: SDFFunction, from: Vec3, to: Vec3, label: string) {
  for (let step = 0; step <= 20; step++) {
    const t = step / 20;
    const p: Vec3 = [0, 1, 2].map((axis) => from[axis] * (1 - t) + to[axis] * t) as Vec3;
    assert.ok(sdf(p).distance < -0.015, `${label} breaks at ${p.join(',')}`);
  }
}

test('all 18 arhat bodies have uninterrupted spines, necks, shoulders and wrists in either pose', () => {
  for (const { index, id } of ARHAT_METADATA_LIST) {
    const { sdf, anatomicalPoints: a } = createArhatFigureSDF(index);
    for (const [from, to] of [
      ['hips', 'chest'], ['chest', 'neck'], ['neck', 'head'],
      ['chest', 'leftShoulder'], ['chest', 'rightShoulder'],
      ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'],
      ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightHand'],
    ]) assertInsideSegment(sdf, a[from], a[to], `${id} ${from}→${to}`);
  }
});

test('Buddha and Quan Am use continuous model-space anatomy and physically supported facial surfaces', () => {
  const buddha = createBuddhaFigureSDF().sdf;
  const quanam = createQuanAmFigureSDF().sdf;
  assertInsideSegment(buddha, [0, 0.42, 0], [0, 1.56, 0.012], 'buddha spine');
  assertInsideSegment(quanam, [0, 0.24, 0], [0, 1.735, 0.025], 'quanam spine');
  // These formerly hollow regions are now occupied by the head under the closed eyelids.
  for (const side of [-1, 1]) {
    assert.ok(buddha([side * 0.052, 1.595, 0.115]).distance < 0);
    assert.ok(quanam([side * 0.052, 1.765, 0.128]).distance < 0);
  }
});

test('all statue fields are finite and remain clear of every meshing boundary', () => {
  for (const { id, sdf, bounds } of statues) {
    for (let x = 0; x <= 12; x++) for (let y = 0; y <= 12; y++) for (let z = 0; z <= 12; z++) {
      const p: Vec3 = [x, y, z].map((v, axis) => bounds.min[axis] + (bounds.max[axis] - bounds.min[axis]) * v / 12) as Vec3;
      const sample = sdf(p);
      assert.ok(Number.isFinite(sample.distance), `${id}: nonfinite at ${p}`);
      if ([x, y, z].some((v) => v === 0 || v === 12)) {
        assert.ok(sample.distance > 0.015, `${id}: clipped by bounds at ${p}`);
      }
    }
  }
});

test('standing and seated prototypes and all 20 statue LOD1 meshes retain a connected body and supported props', () => {
  for (const { id, sdf, bounds } of statues) {
    const category = id === 'buddha' ? 'buddha' : id === 'quanam' ? 'quanam' : 'arhat';
    const resolution = figureResolution(bounds, FIGURE_CELL_SIZES[category][1]);
    const { geometry } = extractSurfaceNets(sdf, { bounds, resolution, smoothIterations: 2, smoothFactor: 0.18 });
    try {
      const positions = geometry.getAttribute('position');
      const indices = geometry.getIndex()!;
      assert.ok(positions.count > 500, `${id}: missing mesh`);
      const parent = Uint32Array.from({ length: positions.count }, (_, i) => i);
      function root(index: number): number {
        while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index]; }
        return index;
      }
      for (let i = 0; i < indices.count; i += 3) {
        const a = root(indices.getX(i));
        parent[root(indices.getX(i + 1))] = a;
        parent[root(indices.getX(i + 2))] = a;
      }
      const components = new Map<number, number>();
      for (let i = 0; i < positions.count; i++) {
        assert.ok(Number.isFinite(positions.getX(i) + positions.getY(i) + positions.getZ(i)), `${id}: nonfinite vertex`);
        const key = root(i); components.set(key, (components.get(key) ?? 0) + 1);
      }
      // These designs intentionally support their props. This catches the separated heads,
      // arms and upper/lower bodies in the original models, including at coarse resolution.
      assert.equal(components.size, 1, `${id}: disconnected pieces ${[...components.values()].join(',')}`);
    } finally { geometry.dispose(); }
  }
});

test('statue anchor positions are model-space and stay within the corresponding model', () => {
  for (const model of [createBuddhaFigureSDF(), createQuanAmFigureSDF()]) {
    for (const [name, socket] of Object.entries(model.sockets)) {
      socket.position.forEach((value, axis) => {
        assert.ok(value > model.bounds.min[axis] && value < model.bounds.max[axis], `${name}: offset escaped model space`);
      });
      if (name.startsWith('hand')) assert.ok(model.sdf(socket.position).distance < 0, `${name}: detached from hand`);
    }
  }
});

test('diagonal sashes remain continuous on the exposed chest surface instead of buried material islands', () => {
  const samples = [
    { sdf: createBuddhaFigureSDF().sdf, start: [-0.18, 1.20], end: [0.17, 0.80] },
    { sdf: createArhatFigureSDF(1).sdf, start: [-0.19, 1.32], end: [0.17, 0.99] },
  ];
  for (const { sdf, start, end } of samples) {
    for (const t of [0.15, 0.25, 0.4, 0.5, 0.6, 0.75, 0.85]) {
      const x = start[0] * (1 - t) + end[0] * t, y = start[1] * (1 - t) + end[1] * t;
      let near = 0, far = 0.5;
      for (let i = 0; i < 30; i++) {
        const z = (near + far) / 2;
        if (sdf([x, y, z]).distance < 0) near = z; else far = z;
      }
      assert.ok(near > 0.10, 'expected the visible frontal torso surface');
      assert.equal(sdf([x, y, near]).materialId, 2, `sash breaks at ${x},${y},${near}`);
    }
  }
});
