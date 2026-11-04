import * as THREE from 'three';
import type { RectXZ } from '../../types/game';

/** Four top corners shared by geometry and CPU verification. Y is the foot plane. */
export function getSurfaceCorners(rect: RectXZ, height: (x: number, z: number) => number) {
  return [
    [rect.minX, height(rect.minX, rect.minZ), rect.minZ],
    [rect.minX, height(rect.minX, rect.maxZ), rect.maxZ],
    [rect.maxX, height(rect.maxX, rect.maxZ), rect.maxZ],
    [rect.maxX, height(rect.maxX, rect.minZ), rect.minZ],
  ];
}

/** Vertical sides keep the top plane exact even on inclined approach spans. */
export function createSurfaceSlab(rect: RectXZ, height: (x: number, z: number) => number, thickness: number) {
  const top = getSurfaceCorners(rect, height);
  const vertices = [...top, ...top.map(([x, y, z]) => [x, y - thickness, z])];
  const indices = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    indices.push(i, i + 4, j + 4, i, j + 4, j);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(vertices.flatMap(([x, , z]) => [x * 0.5, z * 0.5]), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Circular holes crossing a rectangle side become notches in the exterior path.
 * Earcut only accepts holes strictly inside the exterior contour. Current layout
 * has no corner-crossing or overlapping holes; each edge notch has two crossings. */
export function createGroundWithPondHoles(rect: RectXZ, circularHoles: { x: number; z: number; radius: number }[], rectangularHoles: RectXZ[] = []) {
  const corners = [
    [rect.minX, rect.minZ], [rect.maxX, rect.minZ],
    [rect.maxX, rect.maxZ], [rect.minX, rect.maxZ],
  ];
  const shape = new THREE.Shape();
  shape.moveTo(corners[0][0], -corners[0][1]);
  const crossing = new Set<typeof circularHoles[number]>();
  for (let edge = 0; edge < 4; edge++) {
    const [ax, az] = corners[edge];
    const [bx, bz] = corners[(edge + 1) % 4];
    const dx = bx - ax, dz = bz - az;
    const lengthSq = dx * dx + dz * dz;
    const notches: { t0: number; t1: number; circle: typeof circularHoles[number] }[] = [];
    for (const circle of circularHoles) {
      const fx = ax - circle.x, fz = az - circle.z;
      const dot = fx * dx + fz * dz;
      const discriminant = dot * dot - lengthSq * (fx * fx + fz * fz - circle.radius ** 2);
      if (discriminant <= 0) continue;
      const root = Math.sqrt(discriminant);
      const t0 = (-dot - root) / lengthSq, t1 = (-dot + root) / lengthSq;
      if (t0 > 0 && t1 < 1) {
        notches.push({ t0, t1, circle });
        crossing.add(circle);
      }
    }
    notches.sort((a, b) => a.t0 - b.t0);
    for (const { t0, t1, circle } of notches) {
      const startX = ax + dx * t0, startZ = az + dz * t0;
      const endX = ax + dx * t1, endZ = az + dz * t1;
      shape.lineTo(startX, -startZ);
      const startAngle = Math.atan2(startZ - circle.z, startX - circle.x);
      const endAngle = Math.atan2(endZ - circle.z, endX - circle.x);
      const arc = (startAngle - endAngle + Math.PI * 2) % (Math.PI * 2);
      const segments = Math.ceil(arc / (Math.PI * 2) * 256);
      for (let i = 1; i < segments; i++) {
        const angle = startAngle - arc * i / segments;
        shape.lineTo(circle.x + Math.cos(angle) * circle.radius, -(circle.z + Math.sin(angle) * circle.radius));
      }
      shape.lineTo(endX, -endZ);
    }
    shape.lineTo(bx, -bz);
  }
  shape.closePath();
  circularHoles.forEach((circle) => {
    if (crossing.has(circle)) return;
    const { x, z, radius } = circle;
    if (x + radius <= rect.minX || x - radius >= rect.maxX || z + radius <= rect.minZ || z - radius >= rect.maxZ) return;
    const path = new THREE.Path();
    path.absarc(x, -z, radius, 0, Math.PI * 2, true);
    shape.holes.push(path);
  });
  rectangularHoles.forEach((r) => {
    const path = new THREE.Path();
    path.moveTo(r.minX, -r.minZ);
    path.lineTo(r.minX, -r.maxZ);
    path.lineTo(r.maxX, -r.maxZ);
    path.lineTo(r.maxX, -r.minZ);
    path.closePath();
    shape.holes.push(path);
  });
  const geometry = new THREE.ShapeGeometry(shape, 128);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, (positions.getX(i) - rect.minX) / (rect.maxX - rect.minX),
      (positions.getY(i) + rect.maxZ) / (rect.maxZ - rect.minZ));
  }
  return geometry;
}
