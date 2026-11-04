import { MATERIAL_SLOTS as M, type SDFResult, type Vec3 } from './types.ts';
import { opSmoothUnion, opUnion, sdCapsule, sdCappedCone, sdEllipsoid, sdTorus, translate } from './sdf.ts';

/** Shared sculpting vocabulary. All landmarks passed to these helpers are model-space. */
export const shape = (distance: number, materialId: number): SDFResult => ({ distance, materialId });
export const ellipsoid = (p: Vec3, center: Vec3, radii: Vec3) => sdEllipsoid(translate(p, center), radii);
export const blend = (a: SDFResult, distance: number, materialId: number, amount = 0.035) =>
  opSmoothUnion(a, shape(distance, materialId), amount);

export function limb(p: Vec3, shoulder: Vec3, elbow: Vec3, wrist: Vec3, robe: number = M.ROBE, skin: number = M.GOLD): SDFResult {
  // Generous joint overlap preserves shoulders and wrists in the coarse statue LOD.
  let result = shape(sdCapsule(p, shoulder, elbow, 0.073), robe);
  result = blend(result, sdCapsule(p, elbow, wrist, 0.054), skin, 0.035);
  return blend(result, ellipsoid(p, wrist, [0.050, 0.060, 0.045]), skin, 0.025);
}

export function sereneHead(p: Vec3, center: Vec3, options: {
  material?: number; smile?: number; tilt?: number; cheeks?: boolean; longEars?: boolean; proportions?: Vec3; earLength?: number;
} = {}): SDFResult {
  const material = options.material ?? M.GOLD;
  const local = translate(p, center);
  const angle = options.tilt ?? 0;
  const c = Math.cos(angle), s = Math.sin(angle);
  const scale = options.proportions ?? [1, 1, 1];
  // Inverse domain transform: exposed tilt is the actual object-space rotation.z.
  const q: Vec3 = [(local[0] * c + local[1] * s) / scale[0], (-local[0] * s + local[1] * c) / scale[1], local[2] / scale[2]];
  let result = shape(sdEllipsoid(q, [0.136, 0.165, 0.127]), material);
  result = blend(result, ellipsoid(q, [0, -0.077, 0.025], [0.110, 0.100, 0.112]), material, 0.045);
  const cheekWidth = options.cheeks ? 0.057 : 0.045;
  for (const side of [-1, 1]) {
    result = blend(result, ellipsoid(q, [side * 0.071, -0.037, 0.082], [cheekWidth, 0.051, 0.046]), material, 0.025);
    result = blend(result, ellipsoid(q, [side * 0.137, -0.015, -0.005], [0.025, (options.longEars === false ? 0.055 : 0.077) * (options.earLength ?? 1), 0.033]), material, 0.025);
  }
  // Raised closed eyelids replace excavated eye sockets. No facial cutter can expose an interior.
  result = blend(result, ellipsoid(q, [0, -0.013, 0.121], [0.022, 0.039, 0.032]), material, 0.018);
  for (const side of [-1, 1]) {
    const eye = ellipsoid(q, [side * 0.052, 0.030, 0.119], [0.032, 0.010, 0.012]);
    result = opUnion(result, shape(eye, M.HAIR));
  }
  const smile = options.smile ?? 0.35;
  const mouthY = -0.073;
  const mouth = Math.min(
    sdCapsule(q, [-0.032, mouthY + 0.008 * smile, 0.122], [0, mouthY, 0.129], 0.007),
    sdCapsule(q, [0, mouthY, 0.129], [0.032, mouthY + 0.008 * smile, 0.122], 0.007),
  );
  result = opUnion(result, shape(mouth, M.KASAYA_TRIM));
  return { ...result, distance: result.distance * Math.min(...scale) };
}

/** Broad folds follow the skirt vertically; displacement stays below the low-LOD cell size. */
export function drapedCone(p: Vec3, center: Vec3, halfHeight: number, bottom: number, top: number): number {
  const q = translate(p, center);
  const angle = Math.atan2(q[2], q[0]);
  const extent = Math.max(0, 1 - Math.abs(q[1]) / halfHeight);
  return sdCappedCone(q, halfHeight, bottom, top) - Math.cos(angle * 7 + q[1] * 2) * 0.009 * extent;
}

export function lotusPedestal(p: Vec3, radius = 0.48, material: number = M.GOLD): SDFResult {
  let result = shape(sdCappedCone(translate(p, [0, 0.055, 0]), 0.055, radius, radius * 0.93), material);
  result = blend(result, sdCappedCone(translate(p, [0, 0.145, 0]), 0.065, radius * 0.83, radius * 0.91), material, 0.035);
  result = blend(result, ellipsoid(p, [0, 0.205, 0], [radius * 0.88, 0.070, radius * 0.88]), material, 0.035);
  // Broad overlapping petals, supported by the cup rather than floating teeth.
  const r = Math.hypot(p[0], p[2]);
  const sector = Math.PI * 2 / 12;
  const theta = Math.atan2(p[2], p[0]);
  const a = ((theta + sector / 2 + Math.PI * 4) % sector) - sector / 2;
  const petal = sdEllipsoid([r * Math.sin(a), p[1] - 0.155, r * Math.cos(a) - radius * 0.84], [0.095, 0.095, 0.060]);
  return blend(result, petal, material, 0.035);
}

export function seatedLegs(p: Vec3, y: number, material: number = M.ROBE): SDFResult {
  let result = shape(ellipsoid(p, [0, y, 0.025], [0.34, 0.145, 0.25]), material);
  result = blend(result, sdCapsule(p, [-0.30, y, 0.10], [0.16, y + 0.045, 0.21], 0.105), material, 0.04);
  return blend(result, sdCapsule(p, [0.30, y + 0.005, 0.10], [-0.16, y + 0.065, 0.20], 0.100), material, 0.04);
}

/** A supported bead strand in the frontal plane, thick enough to survive the statue LOD. */
export function malaStrand(p: Vec3, center: Vec3, radius = 0.10): number {
  const q = translate(p, center);
  // Torus primitive is Y-up; rotate into the chest plane.
  return sdTorus([q[0], q[2], q[1]], radius, 0.022);
}

/** Paint a continuous sash onto the actual robe surface, without a buried capsule. */
export function diagonalSash(result: SDFResult, p: Vec3, start: [number, number], end: [number, number], halfWidth = 0.033): SDFResult {
  if (result.materialId !== M.ROBE || p[2] < 0.025) return result;
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const t = Math.max(0, Math.min(1, ((p[0] - start[0]) * dx + (p[1] - start[1]) * dy) / (dx * dx + dy * dy)));
  const distance = Math.hypot(p[0] - start[0] - dx * t, p[1] - start[1] - dy * t);
  return distance < halfWidth ? { ...result, materialId: M.KASAYA_TRIM } : result;
}
