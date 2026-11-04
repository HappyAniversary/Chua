import * as THREE from 'three';
import type { Vec3 } from './types.ts';

/** Authored detail meshes keep small identity cues readable in either body LOD. */
export function addArhatPropDetails(root: THREE.Object3D, index: number, anatomicalPoints: Record<string, Vec3>): void {
  if (![2, 11, 13].includes(index)) return;
  const sy = anatomicalPoints.leftShoulder?.[1];
  if (!Number.isFinite(sy)) throw new Error(`arhat_${index}: prop details require model-space shoulder landmarks`);

  const group = new THREE.Group();
  group.name = `arhat_${String(index).padStart(2, '0')}_prop_details`;
  const material = (name: string, color: string, metalness = 0.14) => new THREE.MeshStandardMaterial({ name, color, roughness: 0.78, metalness });
  const gold = material('PagodaRoofGold', '#b58a39', 0.48);
  const ink = material('AnimalFeatures', '#493625');
  const cream = material('AnimalMuzzle', '#dcc393');
  const mane = material('LionMane', '#81542c');
  const ear = material('AnimalEar', '#a8754a');

  const ball = (name: string, position: Vec3, scale: Vec3, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat);
    mesh.name = name;
    mesh.position.fromArray(position);
    mesh.scale.fromArray(scale);
    group.add(mesh);
    return mesh;
  };
  const stroke = (name: string, from: Vec3, to: Vec3, radius: number, mat: THREE.Material) => {
    const a = new THREE.Vector3().fromArray(from), b = new THREE.Vector3().fromArray(to);
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, a.distanceTo(b), 2, 6), mat);
    mesh.name = name;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    group.add(mesh);
  };

  if (index === 11) {
    const origin: Vec3 = [-0.14, sy - 0.08, 0.28];
    // The SDF tower is the solid supporting core. Discrete closed roofs preserve seven
    // square eaves instead of smoothing them into the silhouette of a bottle.
    for (let tier = 0; tier < 7; tier++) {
      const radius = 0.095 - tier * 0.006;
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.32, radius, 0.022, 4, 1, false), gold);
      roof.name = `pagoda_roof_tier_${tier + 1}`;
      roof.position.set(origin[0], origin[1] + 0.025 + tier * 0.032, origin[2]);
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    }
    root.add(group);
    return;
  }

  // Only the extracted body participates in support queries. Details have no regionId
  // attribute, matching the deliberate separate-surface contract used by facial details.
  const bodies: THREE.Mesh[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry.getAttribute('regionId')) bodies.push(mesh);
  });
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  function surface(point: Vec3, axis: 0 | 2 = 2, side = 1): Vec3 {
    const origin = new THREE.Vector3().fromArray(point);
    origin.setComponent(axis, side * 0.9);
    const direction = new THREE.Vector3();
    direction.setComponent(axis, -side);
    root.localToWorld(origin);
    direction.transformDirection(root.matrixWorld);
    ray.set(origin, direction);
    const hit = ray.intersectObjects(bodies, false)[0];
    if (!hit) return [...point];
    return root.worldToLocal(hit.point.clone()).toArray() as Vec3;
  }
  function frontalMark(name: string, point: Vec3, radii: Vec3, mat: THREE.Material) {
    const supported = surface(point);
    supported[2] += 0.001;
    return ball(name, supported, radii, mat);
  }

  const center: Vec3 = index === 2 ? [0.33, 0.48, 0.23] : [0, sy - 0.13, 0.36];
  const prefix = index === 2 ? 'tiger' : 'lion_cub';
  if (index === 13) {
    // A shallow mane stays on the cub's existing head, adding no oversized new head.
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10;
      frontalMark(`lion_mane_${i + 1}`, [center[0] + Math.cos(angle) * 0.062, center[1] + Math.sin(angle) * 0.061, center[2] + 0.04], [0.019, 0.020, 0.012], mane);
    }
  }
  for (const side of [-1, 1]) {
    frontalMark(`${prefix}_eye_${side < 0 ? 'l' : 'r'}`, [center[0] + side * 0.032, center[1] + 0.019, center[2] + 0.07], [0.008, 0.010, 0.007], ink);
    frontalMark(`${prefix}_ear_inner_${side < 0 ? 'l' : 'r'}`, [center[0] + side * 0.052, center[1] + 0.054, center[2] + 0.02], [0.012, 0.014, 0.007], ear);
  }
  const muzzle = surface([center[0], center[1] - 0.017, center[2] + 0.07]);
  ball(`${prefix}_muzzle`, [muzzle[0], muzzle[1], muzzle[2] + 0.003], [0.037, 0.026, 0.021], cream);
  ball(`${prefix}_nose`, [muzzle[0], muzzle[1] + 0.011, muzzle[2] + 0.027], [0.011, 0.007, 0.006], ink);
  stroke(`${prefix}_mouth_l`, [muzzle[0] - 0.014, muzzle[1] - 0.007, muzzle[2] + 0.023], [muzzle[0], muzzle[1] - 0.011, muzzle[2] + 0.025], 0.0024, ink);
  stroke(`${prefix}_mouth_r`, [muzzle[0], muzzle[1] - 0.011, muzzle[2] + 0.025], [muzzle[0] + 0.014, muzzle[1] - 0.007, muzzle[2] + 0.023], 0.0024, ink);

  if (index === 2) {
    // Three restrained bands on the exposed outer flank. The inner flank meets the
    // monk's knee, so projecting from that side would mark the knee before the animal.
    for (const side of [1]) for (let band = 0; band < 3; band++) {
      const points: Vec3[] = [];
      for (let i = 0; i < 4; i++) {
        const p = surface([0.33 + side * 0.10, 0.32 + i * 0.032, -0.03 + band * 0.068 + (i % 2 ? 0.006 : -0.004)], 0, side);
        p[0] += side * 0.001;
        points.push(p);
      }
      for (let i = 1; i < points.length; i++) stroke(`tiger_stripe_${side}_${band}_${i}`, points[i - 1], points[i], 0.0048, ink);
    }
    const brow = [-0.017, 0, 0.017].map((x, i) => {
      const p = surface([center[0] + x, center[1] + (i === 1 ? 0.037 : 0.047), center[2] + 0.05]);
      p[2] += 0.001;
      return p;
    });
    stroke('tiger_forehead_l', brow[0], brow[1], 0.0038, ink);
    stroke('tiger_forehead_r', brow[1], brow[2], 0.0038, ink);
  }
  root.add(group);
}
