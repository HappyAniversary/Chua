// Static Three/texture regression checks; no browser/GPU or visual result implied.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import * as roofTransforms from '../../src/components/world/PagodaRoofPrimitives';
import * as detail from '../../src/components/world/StableDetail';
import * as textures from '../../src/utils/proceduralTextures';
const roof = { ...roofTransforms, ...detail, ...textures };

test('roof instances preserve pivots, refreshed bounds, stable detail and seeded materials', () => {
  const drips = roof.createDripTileTransforms(20, 16, 4);
  const brackets = roof.createBracketTransforms(20, 16);
  assert.equal(drips.length, 60);
  assert.equal(brackets.length, 26);
  for (const [transforms, offset] of [[drips, [0, -0.07, 0]], [brackets, [0, 0.08, 0.38]]] as const) {
    const geometry = new THREE.BoxGeometry(0.32, 0.08, 0.18);
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    roof.setRoofInstanceTransforms(mesh, transforms, [...offset]);
    const actual = new THREE.Matrix4();
    for (let i = 0; i < transforms.length; i++) {
      const { pos, rot } = transforms[i];
      const group = new THREE.Group();
      group.position.set(...pos); group.rotation.set(...rot);
      const child = new THREE.Object3D(); child.position.set(...offset);
      group.add(child); group.updateMatrixWorld(true);
      mesh.getMatrixAt(i, actual);
      actual.elements.forEach((value, index) => assert.ok(Math.abs(value - child.matrixWorld.elements[index]) < 0.000002));
      assert.ok(mesh.boundingBox.containsPoint(new THREE.Vector3().setFromMatrixPosition(actual)));
    }
    const previousCenter = mesh.boundingSphere.center.clone();
    roof.setRoofInstanceTransforms(mesh, transforms.map(({ pos, rot }) => ({ pos: [pos[0] + 100, pos[1], pos[2]], rot })), offset);
    assert.ok(Math.abs(mesh.boundingSphere.center.x - previousCenter.x - 100) < 0.00001);
    mesh.dispose(); geometry.dispose(); material.dispose();
  }
  const geometry = roof.createCurvedPagodaRoofGeometry(20, 16, 4);
  assert.equal(geometry.attributes.position.count, 4 * 17 * 11);
  assert.equal(geometry.index.count, 4 * 16 * 10 * 6);
  assert.ok(Math.max(...geometry.attributes.uv.array) < 8, 'UV density must not multiply the eight-tile atlas again');
  geometry.dispose();
  assert.equal(roof.detailIsNear(40.1, 40, true), false);
  assert.equal(roof.detailIsNear(38, 40, false), false);
  assert.equal(roof.detailIsNear(35, 40, false), true);
  assert.equal(roof.detailIsNear(38, 40, true), true);
  const randomA = roof.createTextureRandom(1103), randomB = roof.createTextureRandom(1103), randomC = roof.createTextureRandom(2207);
  const valuesA = Array.from({ length: 100 }, randomA);
  assert.deepEqual(valuesA, Array.from({ length: 100 }, randomB));
  assert.notDeepEqual(valuesA, Array.from({ length: 100 }, randomC));
  assert.ok(valuesA.every((value) => value >= 0 && value < 1));

  // Record deterministic Canvas2D commands without claiming raster/visual validation.
  (globalThis as any).document = { createElement() {
    const operations: unknown[] = [];
    const context = new Proxy({} as Record<PropertyKey, unknown>, {
      set(target, key, value) { operations.push([key, value]); target[key] = value; return true; },
      get(target, key) {
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return (...args: unknown[]) => {
          operations.push([key, ...args]);
          return { addColorStop(...stop: unknown[]) { operations.push(['stop', ...stop]); } };
        };
        return (...args: unknown[]) => operations.push([key, ...args]);
      },
    });
    return { operations, width: 0, height: 0, getContext: () => context };
  } };
  for (const name of ['TerracottaTile', 'CarvedStone', 'LacquerWood', 'RoofTile', 'ZenSand']) {
    const getter = (roof as any)[`get${name}Texture`];
    const a = getter(1, 1), b = getter(2, 3);
    assert.equal(getter(1, 1), a, 'shared map cache must retain ownership');
    assert.equal(JSON.stringify(a.image.operations), JSON.stringify(b.image.operations), `${name}: repeat must not change seeded artwork`);
    assert.equal(a.colorSpace, THREE.SRGBColorSpace);
    assert.equal(a.minFilter, THREE.LinearMipmapLinearFilter);
    assert.equal(a.anisotropy, 1, 'renderer policy configures capability-clamped anisotropy');
    assert.deepEqual(b.repeat.toArray(), [2, 3]);
  }
  console.log('PASS: 60 drip/26 bracket transforms, child pivots, refreshed bounds, roof topology/UV, hysteresis, deterministic cached texture commands. Static mesh count: 172 -> 4 per tier (516 -> 12 for three tiers).');
});
