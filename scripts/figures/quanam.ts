import { MATERIAL_SLOTS as M, type BoundingBox3D, type SDFFunction, type Vec3 } from './types.ts';
import { opUnion, sdCapsule, sdCappedCone, sdSphere, sdTorus, translate } from './sdf.ts';
import { blend, drapedCone, ellipsoid, limb, lotusPedestal, sereneHead } from './statue-shapes.ts';

/** Standing white-robed statue; every part and socket uses the same model-space landmarks. */
export function createQuanAmFigureSDF(): {
  sdf: SDFFunction; bounds: BoundingBox3D; sockets: Record<string, { bone: string; position: Vec3 }>;
} {
  const bounds: BoundingBox3D = { min: [-0.59, -0.06, -0.55], max: [0.59, 2.18, 0.55] };
  const sockets: Record<string, { bone: string; position: Vec3 }> = {
    hand_r_socket: { bone: 'Hand_R', position: [0.255, 1.585, 0.20] },
    hand_l_socket: { bone: 'Hand_L', position: [-0.16, 1.30, 0.25] },
    head_socket: { bone: 'Head', position: [0, 2.055, 0.025] },
    halo_socket: { bone: 'Chest', position: [0, 1.75, -0.20] },
    chest_socket: { bone: 'Chest', position: [0, 1.40, 0.18] },
  };
  const sdf: SDFFunction = (p) => {
    let result = lotusPedestal(p, 0.46, M.STONE);
    result = blend(result, drapedCone(p, [0, 0.71, 0], 0.47, 0.285, 0.175), M.WHITE_SILK, 0.06);
    result = blend(result, ellipsoid(p, [0, 1.14, 0], [0.183, 0.22, 0.145]), M.WHITE_SILK, 0.065);
    result = blend(result, ellipsoid(p, [0, 1.37, 0.005], [0.207, 0.205, 0.16]), M.WHITE_SILK, 0.06);
    result = blend(result, sdCapsule(p, [0, 1.50, 0.01], [0, 1.66, 0.01], 0.062), M.STONE, 0.04);
    const left = limb(p, [-0.19, 1.435, 0], [-0.29, 1.20, 0.05], [-0.16, 1.30, 0.25], M.WHITE_SILK, M.STONE);
    const right = limb(p, [0.19, 1.435, 0], [0.30, 1.24, 0.04], [0.255, 1.585, 0.20], M.WHITE_SILK, M.STONE);
    result = blend(result, left.distance, left.materialId, 0.04);
    result = blend(result, right.distance, right.materialId, 0.04);
    // Veil is behind the face; shoulder panels are defined directly in model-space.
    result = blend(result, ellipsoid(p, [0, 1.755, -0.075], [0.170, 0.205, 0.115]), M.WHITE_SILK, 0.035);
    for (const side of [-1, 1]) {
      result = blend(result, sdCapsule(p, [side * 0.14, 1.80, -0.055], [side * 0.225, 1.40, -0.065], 0.055), M.WHITE_SILK, 0.035);
    }
    result = blend(result, ellipsoid(p, [0, 1.34, -0.115], [0.225, 0.36, 0.070]), M.WHITE_SILK, 0.045);
    const head = sereneHead(p, [0, 1.735, 0.025], { material: M.STONE, smile: 0.4, longEars: false });
    result = blend(result, head.distance, head.materialId, 0.025);
    // Crown follows the veil and forehead, with a central supported lotus medallion.
    result = blend(result, sdTorus(translate(p, [0, 1.87, 0.005]), 0.123, 0.026), M.GOLD, 0.02);
    result = blend(result, ellipsoid(p, [0, 1.945, 0.065], [0.081, 0.105, 0.037]), M.GOLD, 0.035);
    for (const side of [-1, 1]) {
      result = blend(result, ellipsoid(p, [side * 0.082, 1.92, 0.025], [0.043, 0.067, 0.037]), M.GOLD, 0.025);
    }
    result = blend(result, ellipsoid(p, [0, 1.966, 0.10], [0.028, 0.043, 0.019]), M.STONE, 0.015);
    // Rounded vase and a broad willow sprig survive the coarse LOD; both meet the hands.
    result = blend(result, ellipsoid(p, [-0.16, 1.37, 0.265], [0.058, 0.084, 0.058]), M.GOLD, 0.02);
    result = blend(result, sdCappedCone(translate(p, [-0.16, 1.458, 0.265]), 0.035, 0.028, 0.023), M.GOLD, 0.022);
    result = blend(result, sdCapsule(p, [-0.16, 1.39, 0.30], [-0.16, 1.43, 0.345], 0.022), M.GOLD, 0.022);
    // A visible branching sprig: leaves droop from separate twig tips with open gaps.
    result = blend(result, sdCapsule(p, [0.255, 1.575, 0.20], [0.33, 1.97, 0.23], 0.026), M.KASAYA_TRIM, 0.018);
    result = blend(result, sdCapsule(p, [0.30, 1.84, 0.22], [0.415, 1.92, 0.235], 0.024), M.KASAYA_TRIM, 0.015);
    result = blend(result, sdCapsule(p, [0.285, 1.80, 0.22], [0.21, 1.875, 0.235], 0.024), M.KASAYA_TRIM, 0.015);
    result = blend(result, sdCapsule(p, [0.415, 1.92, 0.235], [0.425, 1.85, 0.235], 0.022), M.KASAYA_TRIM, 0.015);
    result = blend(result, ellipsoid(p, [0.425, 1.845, 0.235], [0.024, 0.085, 0.025]), M.GOLD, 0.012);
    result = blend(result, ellipsoid(p, [0.20, 1.795, 0.235], [0.023, 0.085, 0.025]), M.GOLD, 0.012);
    result = blend(result, ellipsoid(p, [0.34, 1.91, 0.24], [0.023, 0.078, 0.025]), M.GOLD, 0.012);
    result = opUnion(result, { distance: sdSphere(translate(p, [0, 1.79, 0.15]), 0.012), materialId: M.GOLD });
    return result;
  };
  return { sdf, bounds, sockets };
}
