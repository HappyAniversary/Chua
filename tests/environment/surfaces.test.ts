import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getGroundHeight, getMoonBridgeHeight, getNineTurnBridgeHeight, INTERACTION_ZONE_LIST,
  isPositionBlocked, MOON_BRIDGE_PROFILE, NINE_TURN_BRIDGE_SEGMENTS, TEMPLE_LANDMARKS,
  COURTYARD_LOTUS_PONDS, resolveMovement,
} from '../../src/constants/templeLayout';
import { createGroundWithPondHoles, createSurfaceSlab } from '../../src/components/world/SurfaceGeometry';

const close = (a: number, b: number, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('moon slab top vertices and interpolated triangle heights equal avatar ground height', () => {
  const bridge = TEMPLE_LANDMARKS.moonBridge;
  for (let i = 1; i < MOON_BRIDGE_PROFILE.length; i++) {
    const a = MOON_BRIDGE_PROFILE[i - 1], b = MOON_BRIDGE_PROFILE[i];
    const geometry = createSurfaceSlab({ minX: bridge.minX, maxX: bridge.maxX, minZ: a.z, maxZ: b.z },
      (_, z) => getMoonBridgeHeight(z), 0.22);
    const positions = geometry.getAttribute('position');
    for (let j = 0; j < 4; j++) close(positions.getY(j), getGroundHeight(positions.getX(j), positions.getZ(j)), 2e-5);
    for (const t of [0, 0.13, 0.5, 0.91, 1]) close(getGroundHeight(0, a.z + (b.z - a.z) * t), a.y + (b.y - a.y) * t);
    geometry.dispose();
  }
});

test('moon approaches meet ground continuously and pass bank walls above their tops', () => {
  const first = MOON_BRIDGE_PROFILE[0], last = MOON_BRIDGE_PROFILE.at(-1)!;
  close(first.y, 0); close(last.y, 0);
  for (const { z } of MOON_BRIDGE_PROFILE) close(getGroundHeight(0, z - 1e-7), getGroundHeight(0, z + 1e-7));
  for (const z of [31.6, 32.4, 40.6, 41.4]) assert.ok(getGroundHeight(0, z) >= 0.375);
  for (let z = first.z; z <= last.z; z += 0.05) assert.equal(isPositionBlocked(0, z), false);
});

test('zigzag deck and island share exact top Y and entrance joins the bank', () => {
  for (const seg of NINE_TURN_BRIDGE_SEGMENTS) {
    const geometry = createSurfaceSlab(seg, getNineTurnBridgeHeight, 0.14);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < 4; i++) close(positions.getY(i), getGroundHeight(positions.getX(i), positions.getZ(i)), 2e-5);
    geometry.dispose();
  }
  close(getGroundHeight(-17.6, 11), 0);
  close(getGroundHeight(-18.8, 11), TEMPLE_LANDMARKS.quanAmPond.deckY);
  for (const x of [-17.6, -18, -18.8, -19.7, -20.3]) assert.equal(isPositionBlocked(x, 11.3), false);
  close(getGroundHeight(-24.2, 10), TEMPLE_LANDMARKS.quanAmPond.deckY);
});

test('interaction approach points are reachable and use the exact foot plane', () => {
  for (const zone of INTERACTION_ZONE_LIST) {
    assert.equal(isPositionBlocked(zone.approachPoint.x, zone.approachPoint.z), false, zone.id);
    close(zone.approachPoint.y, getGroundHeight(zone.approachPoint.x, zone.approachPoint.z));
  }
});

test('pond water and raised basin rims block movement outside their explicit bridges', () => {
  for (const [x, z] of [[5, 36], [-27, 17], [13, 12], [10, -30]]) {
    assert.equal(isPositionBlocked(x, z), true, `${x},${z}`);
  }
  assert.equal(isPositionBlocked(0, 36), false);
  assert.equal(isPositionBlocked(-24.2, 10), false);
});

test('ground holes contain no opaque top triangles across water', () => {
  const geometry = createGroundWithPondHoles({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, [{ x: 0, z: 0, radius: 3 }]);
  const positions = geometry.getAttribute('position'), index = geometry.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const x = [0, 1, 2].reduce((sum, j) => sum + positions.getX(index.getX(i + j)), 0) / 3;
    const z = [0, 1, 2].reduce((sum, j) => sum + positions.getY(index.getX(i + j)), 0) / 3;
    assert.ok(Math.hypot(x, z) > 2.99);
  }
  geometry.dispose();
});

function triangleCoversPoint(geometry: ReturnType<typeof createGroundWithPondHoles>, x: number, z: number) {
  const p = geometry.getAttribute('position'), index = geometry.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const sign = (u: number, v: number) => (x - p.getX(v)) * (p.getY(u) - p.getY(v)) - (-z - p.getY(v)) * (p.getX(u) - p.getX(v));
    const ab = sign(a, b), bc = sign(b, c), ca = sign(c, a);
    if ((ab >= -1e-9 && bc >= -1e-9 && ca >= -1e-9) || (ab <= 1e-9 && bc <= 1e-9 && ca <= 1e-9)) return true;
  }
  return false;
}

test('remaining courtyard pond has a ground cutout and the removed west pond has solid ground', () => {
  const court = TEMPLE_LANDMARKS.centralCourtyard;
  const geometry = createGroundWithPondHoles(court,
    COURTYARD_LOTUS_PONDS.map(pond => ({ x: pond.x, z: pond.z, radius: pond.innerRadius })));
  for (const { x: cx } of COURTYARD_LOTUS_PONDS) {
    for (let x = Math.max(court.minX, cx - 3.4); x < Math.min(court.maxX, cx + 3.4); x += 0.17) {
      for (let z = 8.6; z < 15.4; z += 0.17) {
        if (Math.hypot(x - cx, z - 12) < 3.44) assert.equal(triangleCoversPoint(geometry, x, z), false, `${x},${z}`);
      }
    }
  }
  for (let x = -15.9; x < -9.6; x += 0.2) {
    for (let z = 8.6; z < 15.4; z += 0.2) {
      if (Math.hypot(x + 13, z - 12) < 3.4) {
        assert.equal(triangleCoversPoint(geometry, x, z), true, `unfilled west pond at ${x},${z}`);
      }
    }
  }
  for (const [x, z] of [[0, 12], [12, 6], [-12, 6], [15.9, 0], [-15.9, 0]]) assert.equal(triangleCoversPoint(geometry, x, z), true);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    assert.ok(uv.getX(i) >= -1e-6 && uv.getX(i) <= 1 + 1e-6);
    assert.ok(uv.getY(i) >= -1e-6 && uv.getY(i) <= 1 + 1e-6);
  }
  geometry.dispose();
});

test('removed west basin opens a continuous walking route from courtyard to Quan Am island', () => {
  for (const [x, z] of [[-13, 12], [-13, 15.9], [-16, 12]]) {
    assert.equal(isPositionBlocked(x, z), false, `stale west basin collider at ${x},${z}`);
    close(getGroundHeight(x, z), 0);
  }
  const route = [[-10, 11.3], [-19.7, 11.3], [-19.7, 8.7], [-21.5, 8.7], [-21.5, 10.3], [-24.2, 10.3]];
  let previous = { x: route[0][0], z: route[0][1] };
  let height = getGroundHeight(previous.x, previous.z);
  for (let leg = 1; leg < route.length; leg++) {
    const start = { ...previous }, [x, z] = route[leg];
    const steps = Math.ceil(Math.hypot(x - start.x, z - start.z) / 0.04);
    for (let i = 1; i <= steps; i++) {
      const next = { x: start.x + (x - start.x) * i / steps, z: start.z + (z - start.z) * i / steps };
      assert.equal(isPositionBlocked(next.x, next.z), false, `route blocked at ${next.x},${next.z}`);
      const resolved = resolveMovement(previous.x, previous.z, next.x, next.z);
      close(resolved.x, next.x); close(resolved.z, next.z);
      const nextHeight = getGroundHeight(next.x, next.z);
      assert.ok(Math.abs(nextHeight - height) < 0.02, `bridge height jumps at ${next.x},${next.z}`);
      previous = resolved;
      height = nextHeight;
    }
  }
  close(height, TEMPLE_LANDMARKS.quanAmPond.deckY);
});

test('exposed sanctuary steps support feet without opening the blocked sanctuary', () => {
  for (const [z, top] of [[-4.8, 0.36], [-5.4, 0.72], [-5.6, 1.08]]) {
    assert.equal(isPositionBlocked(2, z), false);
    close(getGroundHeight(2, z), top);
  }
  assert.equal(isPositionBlocked(2, -6), true);
  close(getGroundHeight(3, -5.4), 0);
});
