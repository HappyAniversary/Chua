import { MATERIAL_SLOTS as M, type BoundingBox3D, type SDFFunction, type SDFResult, type Vec3 } from './types.ts';
import { mirrorX, opSmoothUnion, opUnion, sdCapsule, sdCappedCone, sdEllipsoid, sdRoundedBox, sdTorus, translate } from './sdf.ts';

/** Broad, connected forms; small facial details are authored on the Head bone at bake time. */
export function createMonkFigureSDF(): { sdf: SDFFunction; bounds: BoundingBox3D } {
  const bounds: BoundingBox3D = { min: [-0.56, -0.04, -0.36], max: [0.56, 1.88, 0.38] };
  const sdf: SDFFunction = (p: Vec3): SDFResult => {
    let result: SDFResult = { distance: sdEllipsoid(translate(p, [0, 1.65, 0.02]), [0.145, 0.168, 0.136]), materialId: M.SKIN };
    const join = (distance: number, materialId: number, blend = 0.035) => {
      result = opSmoothUnion(result, { distance, materialId }, blend);
    };
    join(sdEllipsoid(translate(p, [0, 1.565, 0.045]), [0.116, 0.092, 0.107]), M.SKIN, 0.055);
    const sym = mirrorX(p);
    join(sdEllipsoid(translate(sym, [0.071, 1.616, 0.105]), [0.057, 0.046, 0.041]), M.SKIN, 0.025);
    join(sdEllipsoid(translate(sym, [0.148, 1.642, 0.015]), [0.025, 0.051, 0.034]), M.SKIN, 0.028);
    join(sdCapsule(p, [0, 1.652, 0.146], [0, 1.618, 0.16], 0.019), M.SKIN, 0.018);
    join(sdCapsule(p, [0, 1.43, 0.01], [0, 1.56, 0.025], 0.081), M.SKIN, 0.04);
    join(sdEllipsoid(translate(p, [0, 1.265, 0]), [0.218, 0.235, 0.154]), M.ROBE, 0.055);
    const radial = Math.hypot(p[0], p[2]);
    const foldMask = Math.min(1, Math.max(0, (radial - 0.10) / 0.10));
    const folds = Math.cos(Math.atan2(p[2], p[0]) * 8) * 0.005 * foldMask;
    // Wider at the hem, overlapping the chest rather than two separated tiers.
    join(sdCappedCone(translate(p, [0, 0.665, 0]), 0.525, 0.284, 0.198) - folds, M.ROBE, 0.055);
    join(sdCapsule(sym, [0.175, 1.415, 0], [0.265, 1.16, 0], 0.087), M.ROBE, 0.055);
    join(sdCappedCone(translate(sym, [0.277, 1.105, -0.005]), 0.157, 0.115, 0.091), M.ROBE, 0.042);
    join(sdCapsule(sym, [0.315, 1.01, 0.016], [0.335, 0.855, 0.04], 0.045), M.SKIN, 0.025);
    // Grouped fingers stay smooth at both voxel sizes.
    join(sdEllipsoid(translate(sym, [0.322, 0.792, 0.047]), [0.038, 0.065, 0.029]), M.SKIN, 0.025);
    join(sdCapsule(sym, [0.326, 0.812, 0.047], [0.304, 0.765, 0.057], 0.022), M.SKIN, 0.029);
    for (let finger = 0; finger < 4; finger++) {
      const x = 0.303 + finger * 0.014;
      join(sdCapsule(sym, [x, 0.765, 0.047], [x + 0.002, 0.714 + Math.abs(finger - 1) * 0.007, 0.047], 0.013), M.SKIN, 0.014);
    }
    join(sdCapsule(sym, [0.14, 0.26, 0], [0.14, 0.084, 0.015], 0.047), M.SKIN, 0.024);
    join(sdRoundedBox(translate(sym, [0.14, 0.046, 0.058]), [0.057, 0.036, 0.117], 0.022), M.KASAYA_TRIM, 0.022);
    // The diagonal border follows the robe surface, rather than forming a neck-like torus.
    if (result.materialId === M.ROBE && p[1] > 1.0 && p[1] < 1.45 && p[2] > 0.08 && Math.abs(p[0] + p[1] * 0.92 - 1.12) < 0.024) {
      result = { ...result, materialId: M.KASAYA_TRIM };
    }
    // A level neckline keeps the skin/cloth boundary from reading as a jagged white beard.
    if (Math.abs(p[0]) < 0.20 && p[1] > 1.40) {
      result = { ...result, materialId: p[1] >= 1.475 ? M.SKIN : M.ROBE };
    }
    result = opUnion(result, { distance: sdTorus(translate(p, [0, 1.451, 0.018]), 0.083, 0.012), materialId: M.PROP });
    return result;
  };
  return { sdf, bounds };
}
