import type { SDFResult, Vec3 } from './types.ts';

/**
 * Thư viện các hàm khoảng cách có dấu (Signed Distance Functions - SDF)
 * và toán tử điêu khắc hữu cơ (Smooth Blending & Deformations)
 */

// ============================================================================
// 1. Vector Math Helpers
// ============================================================================

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function length2(v: [number, number]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

// ============================================================================
// 2. SDF Primitives
// ============================================================================

/**
 * Khối cầu (Sphere)
 */
export function sdSphere(p: Vec3, r: number): number {
  return length(p) - r;
}

/**
 * Khối Elipsoid (hình trứng, phù hợp cho đầu, ngực, mắt, cơ bắp)
 */
export function sdEllipsoid(p: Vec3, r: Vec3): number {
  const rx = Math.max(Math.abs(r[0]), 1e-8);
  const ry = Math.max(Math.abs(r[1]), 1e-8);
  const rz = Math.max(Math.abs(r[2]), 1e-8);
  const k0 = length([p[0] / rx, p[1] / ry, p[2] / rz]);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const k1 = length([p[0] / (rx * rx), p[1] / (ry * ry), p[2] / (rz * rz)]);
  return k0 * (k0 - 1.0) / k1;
}

/**
 * Khối Capsule 3D tự do (giữa 2 điểm a và b) - lý tưởng cho ngón tay, cẳng tay, cánh tay, cẳng chân
 */
export function sdCapsule(p: Vec3, a: Vec3, b: Vec3, r: number): number {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const segmentLengthSq = dot(ba, ba);
  const h = segmentLengthSq > 0 ? clamp(dot(pa, ba) / segmentLengthSq, 0.0, 1.0) : 0;
  return length(sub(pa, scale(ba, h))) - r;
}

/**
 * Khối Capsule thẳng đứng theo trục Y
 */
export function sdVerticalCapsule(p: Vec3, h: number, r: number): number {
  const pClampedY = p[1] - clamp(p[1], 0.0, h);
  return length([p[0], pClampedY, p[2]]) - r;
}

/**
 * Khối hộp bo góc (Rounded Box)
 */
export function sdRoundedBox(p: Vec3, b: Vec3, r: number): number {
  const q: Vec3 = [
    Math.abs(p[0]) - b[0] + r,
    Math.abs(p[1]) - b[1] + r,
    Math.abs(p[2]) - b[2] + r,
  ];
  return (
    length([Math.max(q[0], 0.0), Math.max(q[1], 0.0), Math.max(q[2], 0.0)]) +
    Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0.0) -
    r
  );
}

/**
 * Khối hình trụ thẳng đứng theo trục Y (Vertical Cylinder: bán kính r, nửa chiều cao h)
 */
export function sdCylinder(p: Vec3, r: number, h: number): number {
  const dX = length2([p[0], p[2]]) - r;
  const dY = Math.abs(p[1]) - h;
  return Math.min(Math.max(dX, dY), 0.0) + length2([Math.max(dX, 0.0), Math.max(dY, 0.0)]);
}

/**
 * Khối nón cụt (Capped Cone) - lý tưởng cho tà áo, cổ áo, đài sen
 */
export function sdCappedCone(p: Vec3, h: number, r1: number, r2: number): number {
  const q: [number, number] = [length2([p[0], p[2]]), p[1]];
  const k1: [number, number] = [r2, h];
  const k2: [number, number] = [r2 - r1, 2.0 * h];
  const ca: [number, number] = [q[0] - Math.min(q[0], q[1] < 0.0 ? r1 : r2), Math.abs(q[1]) - h];
  const sideLengthSq = dot2D(k2);
  const sideProjection = sideLengthSq > 0
    ? clamp(((k1[0] - q[0]) * k2[0] + (k1[1] - q[1]) * k2[1]) / sideLengthSq, 0.0, 1.0)
    : 0;
  const cb: [number, number] = [
    q[0] - k1[0] + k2[0] * sideProjection,
    q[1] - k1[1] + k2[1] * sideProjection,
  ];
  const s = cb[0] < 0.0 && ca[1] < 0.0 ? -1.0 : 1.0;
  return s * Math.sqrt(Math.min(dot2D(ca), dot2D(cb)));
}

function dot2D(v: [number, number]): number {
  return v[0] * v[0] + v[1] * v[1];
}

/**
 * Khối Torus (hình vành khăn) - lý tưởng cho tràng hạt, vòng cổ, chân xếp bằng
 */
export function sdTorus(p: Vec3, rMajor: number, rMinor: number): number {
  const q: [number, number] = [length2([p[0], p[2]]) - rMajor, p[1]];
  return length2(q) - rMinor;
}

// ============================================================================
// 3. Smooth Blending Operators
// ============================================================================

/**
 * Smooth Minimum (Polynomial) - trộn mềm hai bề mặt để tạo liên kết tự nhiên (như da thịt nối vào nhau)
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * (1.0 / 4.0);
}

/**
 * Smooth Maximum (Polynomial)
 */
export function smax(a: number, b: number, k: number): number {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.max(a, b) + h * h * k * (1.0 / 4.0);
}

/**
 * Phép Hợp Trơn (Smooth Union) - kết hợp 2 SDF kèm nội suy chất liệu
 */
export function opSmoothUnion(resA: SDFResult, resB: SDFResult, k: number): SDFResult {
  if (k <= 0) return opUnion(resA, resB);
  const h = Math.max(k - Math.abs(resA.distance - resB.distance), 0.0) / k;
  const dist = Math.min(resA.distance, resB.distance) - h * h * k * 0.25;
  // Ưu tiên vật liệu gần tâm khối hơn
  const materialId = resA.distance < resB.distance ? resA.materialId : resB.materialId;
  return { distance: dist, materialId };
}

/**
 * Phép Hợp Cứng (Union)
 */
export function opUnion(resA: SDFResult, resB: SDFResult): SDFResult {
  return resA.distance < resB.distance ? resA : resB;
}

/**
 * Phép Trừ Trơn (Smooth Subtraction) - đục khoét hõm mắt, tai, nếp gấp áo
 */
export function opSmoothSubtraction(cutter: SDFResult, target: SDFResult, k: number): SDFResult {
  const dist = smax(target.distance, -cutter.distance, k);
  return { distance: dist, materialId: target.materialId };
}

// ============================================================================
// 4. Domain Transformations
// ============================================================================

/**
 * Đối xứng trục X (Mirror X) - dùng cho các bộ phận đối xứng hai bên cơ thể
 */
export function mirrorX(p: Vec3): Vec3 {
  return [Math.abs(p[0]), p[1], p[2]];
}

/**
 * Tịnh tiến không gian
 */
export function translate(p: Vec3, offset: Vec3): Vec3 {
  return [p[0] - offset[0], p[1] - offset[1], p[2] - offset[2]];
}

/**
 * Xoay quanh trục Y (Radian)
 */
export function rotateY(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
}

/**
 * Xoay quanh trục X (Radian)
 */
export function rotateX(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]];
}

/**
 * Xoay quanh trục Z (Radian)
 */
export function rotateZ(p: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
}

// ============================================================================
// 5. Procedural Cloth Folds & Biological Details
// ============================================================================

/**
 * Tạo nếp nhăn vải cà sa tự nhiên bằng hàm sóng lượng giác đa tầng
 */
export function clothFoldsDisplacement(p: Vec3, intensity = 0.015): number {
  const wave1 = Math.sin(p[1] * 18.0 + p[0] * 6.0) * 0.5 + 0.5;
  const wave2 = Math.cos(p[1] * 32.0 - p[2] * 8.0) * 0.25;
  const wave3 = Math.sin((p[0] + p[2]) * 14.0) * 0.25;
  return (wave1 + wave2 + wave3) * intensity;
}

/**
 * Tạo nếp gấp gấu áo rủ (drape waves)
 */
export function robeHemDrape(p: Vec3, frequency = 12.0, amplitude = 0.02): number {
  const angle = Math.atan2(p[2], p[0]);
  return Math.sin(angle * frequency) * amplitude;
}

/**
 * Tạo các búp tóc xoắn ốc (Curly Snails Hair) của Phật Thích Ca
 */
export function buddhaHairCurl(p: Vec3, curlRadius = 0.022): number {
  const angle = Math.atan2(p[2], p[0]);
  const h = p[1];
  const spiral = Math.sin(angle * 16.0 + h * 30.0) * 0.5 + 0.5;
  return spiral * curlRadius;
}
