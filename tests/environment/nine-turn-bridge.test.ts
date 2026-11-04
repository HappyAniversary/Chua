import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { NINE_TURN_BRIDGE_SEGMENTS, TEMPLE_LANDMARKS, getNineTurnBridgeHeight } from '../../src/constants/templeLayout';
import {
  bridgeRailTransform, createNineTurnBridgeLayout, createNineTurnDeckGeometry, islandContour,
  type BridgePoint,
} from '../../src/components/world/NineTurnBridgeGeometry';

const island = TEMPLE_LANDMARKS.quanAmPond;
const layout = createNineTurnBridgeLayout(NINE_TURN_BRIDGE_SEGMENTS, island, getNineTurnBridgeHeight);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 2e-5, `${a} != ${b}`);
const inFootprint = (x: number, z: number) => NINE_TURN_BRIDGE_SEGMENTS.some(s => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ);
const orient = (a: BridgePoint, b: BridgePoint, p: BridgePoint) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const contour = islandContour(island);
const insideIsland = (point: BridgePoint) => contour.every((a, i) => orient(a, contour[(i + 1) % contour.length], point) >= -1e-7);

function topTriangles() {
  const geometry = createNineTurnDeckGeometry(layout, getNineTurnBridgeHeight);
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  const triangles: BridgePoint[][] = [];
  for (let i = 0; i < p.count; i += 3) {
    if (n.getY(i) <= 0.9) continue;
    const triangle = [0, 1, 2].map(j => ({ x: p.getX(i + j), z: p.getZ(i + j) }));
    if (Math.abs(orient(triangle[0], triangle[1], triangle[2])) < 1e-7) continue;
    for (let j = 0; j < 3; j++) close(p.getY(i + j), getNineTurnBridgeHeight(p.getX(i + j), p.getZ(i + j)));
    triangles.push(triangle);
  }
  geometry.dispose();
  return triangles;
}

function covers(triangle: BridgePoint[], point: BridgePoint) {
  const signs = triangle.map((a, i) => orient(a, triangle[(i + 1) % 3], point));
  return signs.every(s => s >= -1e-8) || signs.every(s => s <= 1e-8);
}

test('bridge deck covers union once and leaves the exact stone-island landing uncovered', () => {
  const triangles = topTriangles();
  assert.ok(triangles.length > 0);
  for (let x = -24.383; x < -17.6; x += 0.157) for (let z = 7.831; z < 12.2; z += 0.163) {
    const point = { x, z };
    const count = triangles.filter(t => covers(t, point)).length;
    assert.equal(count, inFootprint(x, z) && !insideIsland(point) ? 1 : 0, `${x},${z}: count=${count}`);
  }
});

test('railing spans lie only on union exterior and leave bank/island entrances open', () => {
  assert.ok(layout.rails.length > 0);
  for (const edge of layout.rails) {
    assert.ok(!(edge.a.x === -17.6 && edge.b.x === -17.6), 'east bank opening blocked');
    const dx = edge.b.x - edge.a.x, dz = edge.b.z - edge.a.z;
    const length = Math.hypot(dx, dz);
    for (const t of [0.01, 0.25, 0.5, 0.75, 0.99]) {
      const x = edge.a.x + dx * t, z = edge.a.z + dz * t;
      const normal = { x: -dz / length * 0.001, z: dx / length * 0.001 };
      assert.notEqual(inFootprint(x + normal.x, z + normal.z), inFootprint(x - normal.x, z - normal.z), `${x},${z} internal rail`);
      assert.equal(insideIsland({ x, z }), false);
    }
  }
  const postKeys = layout.posts.map(p => `${p.x.toFixed(6)},${p.z.toFixed(6)}`);
  assert.equal(new Set(postKeys).size, postKeys.length, 'duplicate post');
});

test('continuous centerline through every bend crosses no rails or posts', () => {
  const route = [{ x: -10, z: 11.3 }, { x: -19.7, z: 11.3 }, { x: -19.7, z: 8.7 },
    { x: -21.5, z: 8.7 }, { x: -21.5, z: 10.3 }, { x: -24.2, z: 10.3 }];
  const distanceToSegment = (p: BridgePoint, a: BridgePoint, b: BridgePoint) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
  };
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i];
    for (const edge of layout.rails) {
      const crossed = orient(a, b, edge.a) * orient(a, b, edge.b) < 0 && orient(edge.a, edge.b, a) * orient(edge.a, edge.b, b) < 0;
      assert.equal(crossed, false, `rail crosses route segment${i}`);
    }
    for (const post of layout.posts) assert.ok(distanceToSegment(post, a, b) > 0.35 + 0.085, `post blocks route segment${i}`);
  }
});

test('sloped rails use the same deck top at both ends and post foot anchors', () => {
  for (const edge of layout.rails) {
    const transform = bridgeRailTransform(edge, getNineTurnBridgeHeight, 0.8);
    const direction = new THREE.Vector3(0, transform.length / 2, 0).applyQuaternion(transform.quaternion);
    const a = transform.position.clone().sub(direction), b = transform.position.clone().add(direction);
    close(a.x, edge.a.x); close(a.z, edge.a.z); close(a.y, getNineTurnBridgeHeight(edge.a.x, edge.a.z) + 0.8);
    close(b.x, edge.b.x); close(b.z, edge.b.z); close(b.y, getNineTurnBridgeHeight(edge.b.x, edge.b.z) + 0.8);
  }
  assert.ok(layout.posts.some(point => getNineTurnBridgeHeight(point.x, point.z) < island.deckY), 'missing ramp coverage');
});
