import * as THREE from 'three';
import type { RectXZ } from '../../types/game';

export type BridgePoint = { x: number; z: number };
export type BridgeEdge = { a: BridgePoint; b: BridgePoint };
type Island = { x: number; z: number; islandRadius: number };
const EPSILON = 1e-7;
const pointKey = (p: BridgePoint) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
const cross = (a: BridgePoint, b: BridgePoint, p: BridgePoint) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const lerp = (a: BridgePoint, b: BridgePoint, t: number): BridgePoint => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

/** Same 32-sided outer contour as the existing stone island cylinder. */
export function islandContour(island: Island): BridgePoint[] {
  return Array.from({ length: 32 }, (_, i) => ({
    x: island.x + Math.cos(i / 32 * Math.PI * 2) * island.islandRadius,
    z: island.z + Math.sin(i / 32 * Math.PI * 2) * island.islandRadius,
  }));
}

function clipPolygon(polygon: BridgePoint[], a: BridgePoint, b: BridgePoint, inside: boolean) {
  const output: BridgePoint[] = [];
  const distance = (p: BridgePoint) => cross(a, b, p) * (inside ? 1 : -1);
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    const dp = distance(p), dq = distance(q);
    if (dp >= -EPSILON) output.push(p);
    if ((dp > EPSILON && dq < -EPSILON) || (dp < -EPSILON && dq > EPSILON)) output.push(lerp(p, q, dp / (dp - dq)));
  }
  return output;
}

/** Partition rather than layering: every returned piece is outside the island. */
function subtractIsland(polygon: BridgePoint[], contour: BridgePoint[]) {
  const pieces: BridgePoint[][] = [];
  let remaining = polygon;
  for (let i = 0; i < contour.length && remaining.length >= 3; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    const outside = clipPolygon(remaining, a, b, false);
    if (outside.length >= 3) pieces.push(outside);
    remaining = clipPolygon(remaining, a, b, true);
  }
  return pieces;
}

function clipEdgeOutsideIsland(edge: BridgeEdge, contour: BridgePoint[]) {
  let lo = 0, hi = 1;
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i], b = contour[(i + 1) % contour.length];
    const start = cross(a, b, edge.a), end = cross(a, b, edge.b), delta = end - start;
    if (Math.abs(delta) < EPSILON) {
      if (start < -EPSILON) return [edge];
    } else if (delta > 0) lo = Math.max(lo, -start / delta);
    else hi = Math.min(hi, -start / delta);
  }
  if (lo >= hi || hi < 0 || lo > 1) return [edge];
  const output: BridgeEdge[] = [];
  if (lo > EPSILON) output.push({ a: edge.a, b: lerp(edge.a, edge.b, lo) });
  if (hi < 1 - EPSILON) output.push({ a: lerp(edge.a, edge.b, hi), b: edge.b });
  return output;
}

function mergeStraightEdges(edges: BridgeEdge[], height: (x: number, z: number) => number) {
  const remaining = [...edges], result: BridgeEdge[] = [];
  const slope = (edge: BridgeEdge) => (height(edge.b.x, edge.b.z) - height(edge.a.x, edge.a.z)) / Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z);
  while (remaining.length) {
    const edge = { ...remaining.shift()! };
    let changed = true;
    while (changed) {
      changed = false;
      const index = remaining.findIndex(next => pointKey(edge.b) === pointKey(next.a) &&
        Math.abs(cross(edge.a, edge.b, next.b)) < EPSILON && Math.abs(slope(edge) - slope(next)) < EPSILON);
      if (index >= 0) {
        edge.b = remaining[index].b;
        remaining.splice(index, 1);
        changed = true;
      }
    }
    result.push(edge);
  }
  return result;
}

export function createNineTurnBridgeLayout(segments: RectXZ[], island: Island, height: (x: number, z: number) => number) {
  const xs = [...new Set(segments.flatMap(s => [s.minX, s.maxX]))].sort((a, b) => a - b);
  const zs = [...new Set(segments.flatMap(s => [s.minZ, s.maxZ]))].sort((a, b) => a - b);
  const occupied = new Set<string>();
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const x = (xs[i] + xs[i + 1]) / 2, z = (zs[j] + zs[j + 1]) / 2;
    if (segments.some(s => x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ)) occupied.add(`${i},${j}`);
  }
  const boundary: BridgeEdge[] = [], deckPolygons: BridgePoint[][] = [];
  const contour = islandContour(island);
  for (const key of occupied) {
    const [i, j] = key.split(',').map(Number);
    const corners = [{ x: xs[i], z: zs[j] }, { x: xs[i + 1], z: zs[j] },
      { x: xs[i + 1], z: zs[j + 1] }, { x: xs[i], z: zs[j + 1] }];
    deckPolygons.push(...subtractIsland(corners, contour));
    const neighbours = [[i, j - 1], [i + 1, j], [i, j + 1], [i - 1, j]];
    neighbours.forEach(([ni, nj], edge) => {
      if (!occupied.has(`${ni},${nj}`)) boundary.push({ a: corners[edge], b: corners[(edge + 1) % 4] });
    });
  }
  const exposedBoundary = boundary.flatMap(edge => clipEdgeOutsideIsland(edge, contour));
  // An expanded contour keeps terminal posts entirely clear of the stone landing.
  const railingContour = islandContour({ ...island, islandRadius: island.islandRadius + 0.1 });
  const bankX = Math.max(...segments.map(s => s.maxX));
  const rails = mergeStraightEdges(boundary.filter(edge => !(Math.abs(edge.a.x - bankX) < EPSILON && Math.abs(edge.b.x - bankX) < EPSILON))
    .flatMap(edge => clipEdgeOutsideIsland(edge, railingContour)), height);
  const uniquePosts = new Map<string, BridgePoint>();
  rails.forEach(edge => {
    const count = Math.max(1, Math.ceil(Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z) / 1.6));
    for (let i = 0; i <= count; i++) {
      const point = lerp(edge.a, edge.b, i / count);
      uniquePosts.set(pointKey(point), point);
    }
  });
  return { deckPolygons, boundary: exposedBoundary, rails, posts: [...uniquePosts.values()] };
}

export function createNineTurnDeckGeometry(layout: ReturnType<typeof createNineTurnBridgeLayout>, height: (x: number, z: number) => number, thickness = 0.14) {
  const positions: number[] = [], uv: number[] = [];
  const vertex = (p: BridgePoint, offset = 0) => {
    positions.push(p.x, height(p.x, p.z) + offset, p.z);
    uv.push(p.x * 0.5, p.z * 0.5);
  };
  layout.deckPolygons.forEach(polygon => {
    for (let i = 1; i < polygon.length - 1; i++) {
      // CCW in XZ points down: reverse the top triangles.
      [polygon[0], polygon[i + 1], polygon[i]].forEach(p => vertex(p));
      [polygon[0], polygon[i], polygon[i + 1]].forEach(p => vertex(p, -thickness));
    }
  });
  layout.boundary.forEach(({ a, b }) => {
    vertex(a); vertex(b); vertex(b, -thickness);
    vertex(a); vertex(b, -thickness); vertex(a, -thickness);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Cylinder uses +Y as its length axis, including slopes at the bank approach. */
export function bridgeRailTransform(edge: BridgeEdge, height: (x: number, z: number) => number, offset: number) {
  const a = new THREE.Vector3(edge.a.x, height(edge.a.x, edge.a.z) + offset, edge.a.z);
  const b = new THREE.Vector3(edge.b.x, height(edge.b.x, edge.b.z) + offset, edge.b.z);
  const direction = b.clone().sub(a);
  return { position: a.clone().add(b).multiplyScalar(0.5), length: direction.length(),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()) };
}
