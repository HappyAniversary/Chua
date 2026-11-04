import { MATERIAL_SLOTS as M, type BoundingBox3D, type SDFFunction, type Vec3 } from './types.ts';
import { opUnion, sdCapsule, sdEllipsoid, sdSphere, translate } from './sdf.ts';
import { blend, diagonalSash, ellipsoid, limb, lotusPedestal, seatedLegs, sereneHead } from './statue-shapes.ts';

/** Gently stylized seated statue. Socket positions are model-space anchors, not bone offsets. */
export function createBuddhaFigureSDF(): {
  sdf: SDFFunction; bounds: BoundingBox3D; sockets: Record<string, { bone: string; position: Vec3 }>;
} {
  const bounds: BoundingBox3D = { min: [-0.66, -0.06, -0.61], max: [0.66, 1.99, 0.61] };
  const sockets: Record<string, { bone: string; position: Vec3 }> = {
    hand_socket: { bone: 'Hand_R', position: [0, 0.70, 0.24] },
    hand_l_socket: { bone: 'Hand_L', position: [-0.055, 0.66, 0.235] },
    hand_r_socket: { bone: 'Hand_R', position: [0.055, 0.69, 0.235] },
    head_socket: { bone: 'Head', position: [0, 1.87, 0.01] },
    halo_socket: { bone: 'Chest', position: [0, 1.52, -0.19] },
    chest_socket: { bone: 'Chest', position: [0, 1.06, 0.19] },
  };
  const sdf: SDFFunction = (p) => {
    let result = lotusPedestal(p, 0.55);
    result = blend(result, seatedLegs(p, 0.40).distance, M.ROBE, 0.055);
    result = blend(result, ellipsoid(p, [0, 0.66, 0], [0.25, 0.23, 0.185]), M.ROBE, 0.075);
    const chest = ellipsoid(p, [0, 1.015, 0], [0.265, 0.295, 0.19]);
    const chestMat = p[0] > 0.065 && p[1] > 0.99 ? M.GOLD : M.ROBE;
    result = blend(result, chest, chestMat, 0.075);
    result = blend(result, sdCapsule(p, [0, 1.24, 0], [0, 1.455, 0.012], 0.077), M.GOLD, 0.045);
    const left = limb(p, [-0.235, 1.18, 0], [-0.30, 0.91, 0.035], [-0.055, 0.66, 0.235], M.ROBE, M.GOLD);
    const right = limb(p, [0.235, 1.18, 0], [0.30, 0.91, 0.035], [0.055, 0.69, 0.235], M.GOLD, M.GOLD);
    result = blend(result, left.distance, left.materialId, 0.04);
    result = blend(result, right.distance, right.materialId, 0.04);
    // Overlapping palms make the gesture readable without fragile individual finger spikes.
    result = blend(result, ellipsoid(p, [-0.025, 0.665, 0.245], [0.078, 0.027, 0.052]), M.GOLD, 0.025);
    result = blend(result, ellipsoid(p, [0.025, 0.701, 0.245], [0.078, 0.027, 0.052]), M.GOLD, 0.025);
    const head = sereneHead(p, [0, 1.565, 0.012], { material: M.GOLD, smile: 0.4 });
    result = blend(result, head.distance, head.materialId, 0.035);
    // One continuous dark hair cap; scalloping is shallow, never separate beads over the head.
    const q = translate(p, [0, 1.665, -0.008]);
    const cap = Math.max(sdEllipsoid(q, [0.142, 0.090, 0.133]), 1.615 - p[1]);
    result = blend(result, cap, M.HAIR, 0.018);
    result = blend(result, ellipsoid(p, [0, 1.750, -0.005], [0.065, 0.057, 0.065]), M.HAIR, 0.035);
    // Urna is embossed onto the forehead and remains physically supported.
    result = opUnion(result, { distance: sdSphere(translate(p, [0, 1.625, 0.135]), 0.013), materialId: M.GOLD });
    return diagonalSash(result, p, [-0.18, 1.20], [0.17, 0.80]);
  };
  return { sdf, bounds, sockets };
}
