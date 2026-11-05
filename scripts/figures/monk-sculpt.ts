import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rigGeometryToSkinnedMesh, STANDARD_HUMANOID_BONES } from './skeleton.ts';
import { MATERIAL_SLOTS as M, type Vec3 } from './types.ts';

type SkinMode = 'body' | 'head' | 'armL' | 'armR' | 'handL' | 'handR' | 'footL' | 'footR';
type Part = { geometry: THREE.BufferGeometry; skin: SkinMode; name: string };
type Section = [number, number, number];

const PALETTE: Record<number, string> = {
  [M.SKIN]: '#efbf98', [M.ROBE]: '#d97706', [M.KASAYA_TRIM]: '#92400e',
  [M.HAIR]: '#382c27', [M.PROP]: '#55382b', [M.WHITE_SILK]: '#fff5e5',
};

function painted(geometry: THREE.BufferGeometry, region: number, shade?: (p: THREE.Vector3) => number): THREE.BufferGeometry {
  geometry.deleteAttribute('uv');
  const p = geometry.getAttribute('position');
  const rgb = new THREE.Color(PALETTE[region]);
  const colors = new Float32Array(p.count * 3), regions = new Uint8Array(p.count);
  const point = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    point.fromBufferAttribute(p, i);
    const intensity = shade?.(point) ?? 1;
    colors.set([rgb.r * intensity, rgb.g * intensity, rgb.b * intensity], i * 3);
    regions[i] = region;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('regionId', new THREE.Uint8BufferAttribute(regions, 1));
  return geometry;
}

/** Closed rings have no coincident seam vertices and keep folds continuous around the garment. */
function loft(sections: Section[], radial: number, steps: number, fold = 0): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(sections.map(([y, rx, rz]) => new THREE.Vector3(rx, y, rz)), false, 'centripetal');
  const points: number[] = [], indices: number[] = [];
  for (let j = 0; j <= steps; j++) {
    const t = j / steps, section = curve.getPoint(t);
    const cinchedWaist = fold > 0.015 ? 1 - 0.9 * Math.exp(-(((section.y - 1.0) / 0.085) ** 2)) : 1;
    const envelope = Math.sin(Math.PI * t) * (1 - t * 0.65) * cinchedWaist;
    for (let i = 0; i < radial; i++) {
      const a = i / radial * Math.PI * 2;
      const drape = fold * envelope * (Math.sin(a * 6 + t * 1.7) + 0.34 * Math.sin(a * 11 - t));
      points.push(Math.cos(a) * (section.x + drape), section.y, Math.sin(a) * (section.z + drape));
    }
  }
  for (let j = 0; j < steps; j++) for (let i = 0; i < radial; i++) {
    const a = j * radial + i, b = j * radial + (i + 1) % radial;
    const c = a + radial, d = b + radial;
    indices.push(a, c, b, c, d, b);
  }
  const bottom = points.length / 3;
  points.push(0, sections[0][0] + Math.min(sections[0][1], sections[0][2]) * 0.002, 0);
  const top = points.length / 3;
  const last = sections.at(-1)!;
  points.push(0, last[0] - Math.min(last[1], last[2]) * 0.002, 0);
  for (let i = 0; i < radial; i++) {
    indices.push(bottom, i, (i + 1) % radial);
    const a = steps * radial + i, b = steps * radial + (i + 1) % radial;
    indices.push(top, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function ellipsoid(center: Vec3, radii: Vec3, radial: number, rings: number, shape?: (point: THREE.Vector3) => void) {
  if (Math.max(...radii) < 0.13) {
    radial = radial >= 40 ? 24 : radial >= 28 ? 16 : radial;
    rings = rings >= 24 ? 14 : rings >= 16 ? 10 : rings;
  }
  const g = new THREE.SphereGeometry(1, radial, rings);
  g.deleteAttribute('uv');
  const position = g.getAttribute('position'), point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    shape?.(point);
    position.setXYZ(i, point.x * radii[0] + center[0], point.y * radii[1] + center[1], point.z * radii[2] + center[2]);
  }
  g.deleteAttribute('normal');
  const welded = mergeVertices(g, 1e-6);
  welded.computeVertexNormals();
  return welded;
}

function along(geometry: THREE.BufferGeometry, from: Vec3, to: Vec3) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  geometry.applyQuaternion(q); geometry.translate(...from);
  return geometry;
}

/** One continuous curved sleeve has a rounded shoulder and no cut edge across the elbow. */
function sleeve(side: number, radial: number, steps: number): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.118, 1.330, 0),
    new THREE.Vector3(side * 0.179, 1.358, 0),
    new THREE.Vector3(side * 0.233, 1.306, 0.002),
    new THREE.Vector3(side * 0.279, 1.115, 0.014),
    new THREE.Vector3(side * 0.315, 0.895, 0.033),
  ], false, 'centripetal');
  const vertices: number[] = [], indices: number[] = [];
  const front = new THREE.Vector3(0, 0, 1), normal = new THREE.Vector3();
  for (let j = 0; j <= steps; j++) {
    const t = j / steps, center = curve.getPoint(t), tangent = curve.getTangent(t);
    normal.crossVectors(tangent, front).normalize();
    const shoulder = THREE.MathUtils.smoothstep(t, 0, 0.22);
    const radius = THREE.MathUtils.lerp(0.018, 0.098 - t * 0.012, shoulder);
    for (let i = 0; i < radial; i++) {
      const a = Math.PI * 2 * i / radial;
      const fold = Math.sin(a * 4 + t * 4) * 0.003 * Math.sin(Math.PI * t);
      const v = center.clone().addScaledVector(normal, Math.cos(a) * (radius + fold)).addScaledVector(front, Math.sin(a) * (radius * 0.9 + fold));
      vertices.push(v.x, v.y, v.z);
    }
  }
  for (let j = 0; j < steps; j++) for (let i = 0; i < radial; i++) {
    const a = j * radial + i, b = j * radial + (i + 1) % radial;
    indices.push(a, a + radial, b, b, a + radial, b + radial);
  }
  for (const j of [0, steps]) {
    const center = curve.getPoint(j / steps), vertex = vertices.length / 3;
    // Recess the closed cuff cap so the skin of the wrist emerges naturally.
    if (j === steps) center.addScaledVector(curve.getTangent(1), -0.0002);
    vertices.push(center.x, center.y, center.z);
    for (let i = 0; i < radial; i++) {
      const a = j * radial + i, b = j * radial + (i + 1) % radial;
      if (j === 0) indices.push(vertex, a, b); else indices.push(vertex, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

function closedRibbon(points: Vec3[], width: number, depth: number, radial: number, steps: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const vertices: number[] = [], indices: number[] = [];
  const front = new THREE.Vector3(0, 0, 1), tangent = new THREE.Vector3(), right = new THREE.Vector3();
  for (let j = 0; j <= steps; j++) {
    const t = j / steps, center = curve.getPoint(t);
    tangent.copy(curve.getTangent(t)); right.crossVectors(tangent, front).normalize();
    for (let i = 0; i < radial; i++) {
      const angle = Math.PI * 2 * i / radial;
      const v = center.clone().addScaledVector(right, Math.cos(angle) * width).addScaledVector(front, Math.sin(angle) * depth);
      vertices.push(v.x, v.y, v.z);
    }
  }
  for (let j = 0; j < steps; j++) for (let i = 0; i < radial; i++) {
    const a = j * radial + i, b = j * radial + (i + 1) % radial;
    indices.push(a, b, a + radial, b, b + radial, a + radial);
  }
  for (const endpoint of [0, steps]) {
    const center = curve.getPoint(endpoint / steps), id = vertices.length / 3;
    vertices.push(center.x, center.y, center.z);
    for (let i = 0; i < radial; i++) {
      const a = endpoint * radial + i, b = endpoint * radial + (i + 1) % radial;
      if (endpoint === 0) indices.push(id, b, a); else indices.push(id, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

/** Authored overlapping garments use deliberate skin paints instead of distance-based joint guesses. */
function applyTailoredWeights(mesh: THREE.SkinnedMesh, parts: Part[]) {
  const index = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight');
  const names = new Map(mesh.skeleton.bones.map((bone, i) => [bone.name, i]));
  const pos = mesh.geometry.getAttribute('position');
  let offset = 0;
  const smooth = THREE.MathUtils.smoothstep;
  for (const part of parts) {
    for (let i = 0; i < part.geometry.getAttribute('position').count; i++) {
      const vertex = offset + i, y = pos.getY(vertex);
      let influences: [string, number][];
      if (part.skin === 'head') influences = [['Head', 1]];
      else if (part.skin === 'handL' || part.skin === 'handR') influences = [[`Hand_${part.skin.at(-1)}`, 1]];
      else if (part.skin === 'footL' || part.skin === 'footR') influences = [[`Foot_${part.skin.at(-1)}`, 1]];
      else if (part.skin === 'armL' || part.skin === 'armR') {
        const side = part.skin.at(-1), upper = smooth(y, 1.06, 1.26);
        const shoulder = smooth(y, 1.34, 1.45);
        influences = [[`UpperArm_${side}`, upper * (1 - shoulder)], [`LowerArm_${side}`, 1 - upper], ['Chest', shoulder * upper]];
      } else {
        const spine = smooth(y, 0.98, 1.20), chest = smooth(y, 1.17, 1.37);
        influences = [['Hips', 1 - spine], ['Spine', spine * (1 - chest)], ['Chest', spine * chest]];
      }
      for (let slot = 0; slot < 4; slot++) {
        index.setComponent(vertex, slot, names.get(influences[slot]?.[0] ?? 'Hips')!);
        weight.setComponent(vertex, slot, influences[slot]?.[1] ?? 0);
      }
    }
    offset += part.geometry.getAttribute('position').count;
  }
}

function attachFace(mesh: THREE.SkinnedMesh, radial: number, rings: number) {
  const head = mesh.skeleton.bones.find((bone) => bone.name === 'Head')!;
  const face = new THREE.Group(); face.name = 'monk_authored_face';
  // All face coordinates are authored in model space, then moved into Head bone space once.
  face.position.y = -1.54;
  const skin = new THREE.MeshStandardMaterial({ name: 'WarmSkinDetails', color: '#efbf98', roughness: 0.82 });
  const ear = new THREE.MeshStandardMaterial({ name: 'EarAndLips', color: '#cf8c73', roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ name: 'EyeIvory', color: '#fff6e8', roughness: 0.68 });
  const brown = new THREE.MeshStandardMaterial({ name: 'EyeDarkBrown', color: '#33251e', roughness: 0.65 });
  const glint = new THREE.MeshStandardMaterial({ name: 'EyeCatchlight', color: '#fffaf0', roughness: 0.45 });
  const add = (name: string, g: THREE.BufferGeometry, material: THREE.Material) => {
    const part = new THREE.Mesh(g, material); part.name = name;
    part.userData.figurePart = { closed: true, components: 1 };
    face.add(part); return part;
  };
  const faceZ = (x: number, y: number, raised = 0) => {
    const vertical = (y - 1.675) / 0.219;
    const jaw = THREE.MathUtils.smoothstep(-vertical, 0.2, 0.9);
    const width = 0.196 * (1 - jaw * 0.15);
    return 0.178 * Math.sqrt(Math.max(0, 1 - (x / width) ** 2 - vertical ** 2)) * (1 + jaw * 0.045) + raised;
  };
  const facialVolume = (x: number, y: number, raised: number, radii: Vec3) => {
    const centerZ = faceZ(x, y, raised);
    const g = ellipsoid([x, y, centerZ], radii, radial, rings);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + faceZ(p.getX(i), p.getY(i)) - faceZ(x, y));
    g.computeVertexNormals();
    return g;
  };
  for (const side of [-1, 1]) {
    const x = side * 0.066;
    add(`eye_white_${side}`, facialVolume(x, 1.697, 0.0015, [0.028, 0.017, 0.008]), white);
    add(`eye_iris_${side}`, facialVolume(x - side * 0.002, 1.696, 0.010, [0.0105, 0.0145, 0.0045]), brown);
    add(`eye_glint_${side}`, facialVolume(x - side * 0.004 - 0.003, 1.700, 0.014, [0.003, 0.0035, 0.0015]), glint);
    add(`gentle_brow_${side}`, closedRibbon([[x - 0.025, 1.729, faceZ(x - 0.025, 1.729, 0.001)], [x, 1.734, faceZ(x, 1.734, 0.001)], [x + 0.026, 1.729, faceZ(x + 0.026, 1.729, 0.001)]], 0.0034, 0.0023, 8, 12), brown);
    add(`upper_eyelid_${side}`, closedRibbon([[x - 0.024, 1.701, faceZ(x - 0.024, 1.701, 0.008)], [x, 1.713, faceZ(x, 1.713, 0.006)], [x + 0.024, 1.701, faceZ(x + 0.024, 1.701, 0.008)]], 0.0017, 0.0015, 8, 12), brown);
    add(`inner_ear_${side}`, ellipsoid([side * 0.207, 1.650, 0.026], [0.013, 0.032, 0.010], radial, rings), ear);
  }
  add('soft_nose', ellipsoid([0, 1.650, 0.181], [0.018, 0.025, 0.020], radial, rings), skin);
  add('gentle_smile', closedRibbon([[-0.028, 1.610, faceZ(-0.028, 1.610, 0.001)], [0, 1.603, faceZ(0, 1.603, 0.001)], [0.028, 1.610, faceZ(0.028, 1.610, 0.001)]], 0.0023, 0.0018, 8, 16), ear);
  head.add(face);
}

/** A new hand-authored, layered novice silhouette with the existing game's rig and interaction landmarks. */
export function createMonkSculpt(lod: 0 | 1): THREE.SkinnedMesh {
  const radial = lod === 0 ? 48 : 28, rings = lod === 0 ? 28 : 16;
  const parts: Part[] = [];
  const add = (name: string, geometry: THREE.BufferGeometry, region: number, skin: SkinMode, shade?: (p: THREE.Vector3) => number) => {
    parts.push({ name, geometry: painted(geometry, region, shade), skin });
  };
  const clothShade = (p: THREE.Vector3) => 0.94 + 0.06 * THREE.MathUtils.smoothstep(p.y, 0.3, 1.4);
  add('layered_wrap_robe', loft([
    [0.285, 0.236, 0.161], [0.32, 0.243, 0.167], [0.51, 0.230, 0.158],
    [0.76, 0.207, 0.151], [0.95, 0.183, 0.142], [1.10, 0.179, 0.143],
    [1.29, 0.196, 0.151], [1.38, 0.179, 0.133], [1.435, 0.084, 0.079],
  ], radial, lod === 0 ? 56 : 32, 0.018), M.ROBE, 'body', clothShade);
  add('soft_neck', ellipsoid([0, 1.455, 0.005], [0.072, 0.108, 0.069], radial, rings), M.SKIN, 'head');
  add('youthful_head', ellipsoid([0, 1.675, 0.0], [0.196, 0.219, 0.178], radial, rings, (p) => {
    const jaw = THREE.MathUtils.smoothstep(-p.y, 0.2, 0.9);
    p.x *= 1 - jaw * 0.15;
    p.z += Math.max(0, p.z) * jaw * 0.045;
  }), M.SKIN, 'head', (p) => {
    const cheek = Math.exp(-Math.pow((Math.abs(p.x) - 0.105) / 0.045, 2) - Math.pow((p.y - 1.635) / 0.048, 2));
    return 1 - cheek * Math.max(0, p.z) * 0.27;
  });
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'L' : 'R';
    add(`ear_${suffix}`, ellipsoid([side * 0.194, 1.651, -0.002], [0.036, 0.058, 0.031], radial, rings), M.SKIN, 'head');
    add(`flowing_sleeve_${suffix}`, sleeve(side, radial, lod === 0 ? 36 : 22), M.ROBE, `arm${suffix}` as SkinMode, clothShade);
    const c: Vec3 = [side * 0.315, 0.895, 0.033], d: Vec3 = [side * 0.278, 1.145, 0.012];
    add(`cuff_border_${suffix}`, along(loft([[0, 0.086, 0.079], [0.007, 0.089, 0.082], [0.020, 0.088, 0.080], [0.026, 0.085, 0.078]], radial, 5), c, d), M.KASAYA_TRIM, `arm${suffix}` as SkinMode);
    add(`wrist_${suffix}`, ellipsoid([side * 0.321, 0.869, 0.036], [0.027, 0.057, 0.027], radial, rings), M.SKIN, `hand${suffix}` as SkinMode);
    add(`palm_${suffix}`, ellipsoid([side * 0.322, 0.792, 0.047], [0.037, 0.069, 0.030], radial, rings), M.SKIN, `hand${suffix}` as SkinMode);
    add(`thumb_${suffix}`, ellipsoid([side * 0.297, 0.804, 0.058], [0.020, 0.038, 0.023], radial, rings), M.SKIN, `hand${suffix}` as SkinMode);
    const trouser = loft([[0.09, 0.058, 0.059], [0.15, 0.061, 0.063], [0.29, 0.076, 0.067], [0.40, 0.080, 0.070]], radial, lod === 0 ? 15 : 9, 0.005);
    trouser.translate(side * 0.13, 0, 0.008);
    add(`trouser_${suffix}`, trouser, M.KASAYA_TRIM, `foot${suffix}` as SkinMode);
    add(`cloth_shoe_${suffix}`, ellipsoid([side * 0.137, 0.060, 0.070], [0.069, 0.049, 0.120], radial, rings), M.PROP, `foot${suffix}` as SkinMode);
    add(`shoe_sole_${suffix}`, ellipsoid([side * 0.137, 0.025, 0.070], [0.070, 0.016, 0.121], radial, rings), M.PROP, `foot${suffix}` as SkinMode, () => 0.7);
  }
  // Two overlapping lapels follow the chest, with narrow piping rather than voxel-painted zigzags.
  add('under_collar', closedRibbon([[0.070, 1.446, 0.079], [0.124, 1.377, 0.120], [0.045, 1.255, 0.159], [0.020, 1.221, 0.160]], 0.024, 0.006, 10, lod === 0 ? 32 : 18), M.KASAYA_TRIM, 'body', () => 1.18);
  const lapel: Vec3[] = [[-0.069, 1.446, 0.081], [-0.126, 1.376, 0.122], [-0.035, 1.250, 0.162], [0.132, 1.048, 0.150]];
  add('outer_collar', closedRibbon(lapel, 0.032, 0.007, 12, lod === 0 ? 36 : 20), M.ROBE, 'body', () => 1.18);
  const piping: Vec3[] = lapel.map(([x, y, z]) => [x + 0.018, y + 0.013, z + 0.007]);
  add('collar_piping', closedRibbon(piping, 0.0037, 0.0025, 8, lod === 0 ? 36 : 20), M.KASAYA_TRIM, 'body');
  add('waist_sash', loft([[0.965, 0.194, 0.155], [0.978, 0.198, 0.158], [1.018, 0.197, 0.158], [1.031, 0.193, 0.154]], radial, 8, 0.001), M.KASAYA_TRIM, 'body', () => 1.1);
  add('sash_knot', ellipsoid([0.134, 1.000, 0.125], [0.040, 0.027, 0.027], radial, rings), M.KASAYA_TRIM, 'body');
  add('sash_end', closedRibbon([[0.139, 0.990, 0.142], [0.161, 0.916, 0.147], [0.148, 0.828, 0.155]], 0.019, 0.005, 8, 16), M.KASAYA_TRIM, 'body');
  add('rounded_hem', loft([[0.285, 0.2365, 0.1615], [0.290, 0.239, 0.164], [0.304, 0.242, 0.166], [0.311, 0.241, 0.165]], radial, 4), M.ROBE, 'body', () => 0.85);

  const geometry = mergeGeometries(parts.map((part) => part.geometry), false);
  if (!geometry) throw new Error('Unable to combine authored novice surfaces.');
  const material = new THREE.MeshStandardMaterial({ name: 'MonkTailoredSurface', vertexColors: true, roughness: 0.86, metalness: 0 });
  const { skinnedMesh } = rigGeometryToSkinnedMesh(geometry, STANDARD_HUMANOID_BONES, material);
  applyTailoredWeights(skinnedMesh, parts);
  skinnedMesh.name = 'sample_monk';
  skinnedMesh.userData.figureAssembly = 'authored-v3';
  skinnedMesh.userData.figurePart = { closed: true, components: parts.length };
  skinnedMesh.userData.robeColorBase = PALETTE[M.ROBE];
  skinnedMesh.userData.trimColorBase = PALETTE[M.KASAYA_TRIM];
  skinnedMesh.userData.figureRecolor = { robe: PALETTE[M.ROBE], trim: PALETTE[M.KASAYA_TRIM] };
  attachFace(skinnedMesh, lod === 0 ? 20 : 12, lod === 0 ? 14 : 8);
  skinnedMesh.updateMatrixWorld(true);
  return skinnedMesh;
}
