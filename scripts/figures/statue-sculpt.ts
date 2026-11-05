import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ARHAT_METADATA_LIST, createArhatFigureSDF } from './arhats.ts';
import { createBuddhaFigureSDF } from './buddha.ts';
import { createQuanAmFigureSDF } from './quanam.ts';
import { MATERIAL_SLOTS as M, type Vec3 } from './types.ts';

type StatueId = 'buddha' | 'quanam' | `arhat_${string}`;
type Finish = { name: string; color: string; region: number; metalness?: number; roughness?: number };
type Profile = [radius: number, y: number, depth?: number];
const TAU = Math.PI * 2;
const V = (v: Vec3) => new THREE.Vector3(...v);
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((v, i) => THREE.MathUtils.lerp(v, b[i], t)) as Vec3;

/** Regular surfaces are authored in model units, then batched by finish for the game. */
class Sculpture {
  root = new THREE.Group();
  parts: THREE.Mesh[] = [];
  readonly segments: number;
  readonly lod: 0 | 1;
  constructor(lod: 0 | 1) { this.lod = lod; this.segments = lod ? 12 : 24; }

  add(name: string, geometry: THREE.BufferGeometry, finish: Finish, parent: THREE.Object3D = this.root): THREE.Mesh {
    geometry.deleteAttribute('uv');
    const position = geometry.getAttribute('position');
    const rgb = new THREE.Color(finish.color);
    const color = new Float32Array(position.count * 3);
    const region = new Uint8Array(position.count);
    for (let i = 0; i < position.count; i++) {
      color.set([rgb.r, rgb.g, rgb.b], i * 3);
      region[i] = finish.region;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
    geometry.setAttribute('regionId', new THREE.Uint8BufferAttribute(region, 1));
    const material = new THREE.MeshStandardMaterial({
      name: finish.name, color: '#ffffff', vertexColors: true,
      metalness: finish.metalness ?? 0.28, roughness: finish.roughness ?? 0.52,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData.figurePart = { closed: true, components: 1 };
    parent.add(mesh);
    this.parts.push(mesh);
    return mesh;
  }

  ball(name: string, p: Vec3, size: Vec3, finish: Finish, parent: THREE.Object3D = this.root, detail = false) {
    const n = detail ? (this.lod ? 8 : 12) : this.segments;
    const mesh = this.add(name, new THREE.SphereGeometry(1, n, Math.max(6, Math.floor(n * 0.7))), finish, parent);
    mesh.position.fromArray(p); mesh.scale.fromArray(size);
    return mesh;
  }

  stroke(name: string, points: Vec3[], radius: number, finish: Finish, parent: THREE.Object3D = this.root, radiusEnd = radius) {
    const curve = new THREE.CatmullRomCurve3(points.map(V));
    const widest = Math.max(radius, radiusEnd);
    const count = this.lod ? Math.max(6, Math.min(18, points.length * 2)) : Math.max(12, Math.min(32, points.length * 4));
    // Visible garment rims need a round cross-section; fine creases need fewer vertices.
    const sides = widest > 0.04 ? (this.lod ? 12 : 20) : widest > 0.015 ? (this.lod ? 8 : 12) : this.lod ? 6 : 8;
    const frames = curve.computeFrenetFrames(count, false);
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, p = curve.getPointAt(t), r = THREE.MathUtils.lerp(radius, radiusEnd, t);
      for (let j = 0; j < sides; j++) {
        const a = j / sides * TAU;
        const q = p.clone().addScaledVector(frames.normals[i], Math.cos(a) * r).addScaledVector(frames.binormals[i], Math.sin(a) * r);
        positions.push(q.x, q.y, q.z);
      }
      if (i > 0) for (let j = 0; j < sides; j++) {
        const a = (i - 1) * sides + j, b = (i - 1) * sides + (j + 1) % sides;
        const c = i * sides + j, d = i * sides + (j + 1) % sides;
        indices.push(a, b, c, b, d, c);
      }
    }
    const start = positions.length / 3, p0 = curve.getPoint(0), p1 = curve.getPoint(1);
    positions.push(...p0.toArray(), ...p1.toArray());
    for (let j = 0; j < sides; j++) {
      indices.push(start, (j + 1) % sides, j);
      indices.push(start + 1, count * sides + j, count * sides + (j + 1) % sides);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return this.add(name, geometry, finish, parent);
  }

  /** Closed elliptic lathe: clean fan caps, with broad shallow cloth folds. */
  lathe(name: string, profile: Profile[], finish: Finish, folds = 0, parent: THREE.Object3D = this.root) {
    const n = this.segments * 2, positions: number[] = [], indices: number[] = [];
    profile.forEach(([radius, y, depth = radius], row) => {
      for (let j = 0; j < n; j++) {
        const a = j / n * TAU;
        const weight = Math.sin(Math.PI * row / (profile.length - 1));
        const fold = 1 + folds * weight * (0.7 * Math.cos(a * 9 + y * 2) + 0.3 * Math.cos(a * 5 - y * 3));
        positions.push(Math.sin(a) * radius * fold, y, Math.cos(a) * depth * fold);
        if (row > 0) {
          const prev = (row - 1) * n + j, next = (row - 1) * n + (j + 1) % n;
          const now = row * n + j, after = row * n + (j + 1) % n;
          indices.push(prev, next, now, next, after, now);
        }
      }
    });
    const start = positions.length / 3;
    positions.push(0, profile[0][1], 0, 0, profile.at(-1)![1], 0);
    for (let j = 0; j < n; j++) {
      indices.push(start, (j + 1) % n, j);
      const last = (profile.length - 1) * n;
      indices.push(start + 1, last + j, last + (j + 1) % n);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return this.add(name, geometry, finish, parent);
  }

  ring(name: string, p: Vec3, radius: number, tube: number, finish: Finish, parent: THREE.Object3D = this.root) {
    const mesh = this.add(name, new THREE.TorusGeometry(radius, tube, this.lod ? 6 : 8, this.segments * 2), finish, parent);
    mesh.rotation.x = Math.PI / 2; mesh.position.fromArray(p); return mesh;
  }

  finish(): THREE.Group {
    this.root.updateMatrixWorld(true);
    const buckets = new Map<string, { geometry: THREE.BufferGeometry[]; material: THREE.Material; names: string[] }>();
    for (const mesh of this.parts) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      const key = material.name;
      const bucket = buckets.get(key) ?? { geometry: [], material, names: [] };
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      bucket.geometry.push(geometry); bucket.names.push(mesh.name); buckets.set(key, bucket);
    }
    for (const mesh of this.parts) mesh.removeFromParent();
    // Empty transform groups no longer participate in rendering after batching.
    for (const child of [...this.root.children]) if (child instanceof THREE.Group && !child.children.length) this.root.remove(child);
    for (const [name, bucket] of buckets) {
      const geometry = mergeGeometries(bucket.geometry, false);
      if (!geometry) throw new Error(`Could not batch statue finish ${name}`);
      geometry.normalizeNormals();
      const mesh = new THREE.Mesh(geometry, bucket.material);
      mesh.name = `${this.root.name}_${name}`;
      mesh.userData.figurePart = { closed: true, components: bucket.geometry.length };
      mesh.userData.authoredParts = bucket.names;
      mesh.castShadow = mesh.receiveShadow = true;
      this.root.add(mesh);
      bucket.geometry.forEach((g) => g.dispose());
    }
    this.root.userData.figureAssembly = 'authored-v3';
    this.root.updateMatrixWorld(true);
    return this.root;
  }
}

const GOLD: Finish = { name: 'AntiqueGold', color: '#c49a5a', region: M.GOLD, metalness: 0.44, roughness: 0.48 };
const BRONZE: Finish = { name: 'WarmBronze', color: '#ad824c', region: M.GOLD, metalness: 0.40, roughness: 0.54 };
const ROBE: Finish = { name: 'SaffronDrapery', color: '#9f592b', region: M.ROBE, metalness: 0.16, roughness: 0.74 };
const EDGE: Finish = { name: 'RaisedGoldBorders', color: '#e0bc77', region: M.KASAYA_TRIM, metalness: 0.40, roughness: 0.48 };
const INK: Finish = { name: 'SculptedCreases', color: '#68492f', region: M.PROP, metalness: 0.20, roughness: 0.76 };
const HAIR: Finish = { name: 'BlueBlackCurls', color: '#283333', region: M.HAIR, metalness: 0.12, roughness: 0.66 };
const IVORY: Finish = { name: 'WarmPorcelain', color: '#eee7d8', region: M.STONE, metalness: 0.02, roughness: 0.40 };
const SILK: Finish = { name: 'IvoryDrapery', color: '#ded6c5', region: M.WHITE_SILK, metalness: 0, roughness: 0.72 };
const BASE: Finish = { name: 'CarvedPlinth', color: '#48514a', region: M.STONE, metalness: 0.08, roughness: 0.77 };
const JADE: Finish = { name: 'JadeAccents', color: '#49796a', region: M.PROP, metalness: 0.08, roughness: 0.42 };

function pedestal(s: Sculpture, radius: number, porcelain = false, style = 'lotus') {
  const stone = porcelain ? { ...BASE, name: 'PaleStonePlinth', color: '#b9b7a7' } : BASE;
  s.lathe('carved_foot', [[radius * 0.94, 0.00], [radius, 0.022], [radius, 0.065], [radius * 0.94, 0.09], [radius * 0.82, 0.105]], stone);
  s.ring('plinth_lower_bead', [0, 0.075, 0], radius * 0.96, 0.009, EDGE);
  const cup = style === 'lotus'
    ? [[radius * 0.74, 0.09], [radius * 0.79, 0.14], [radius * 0.78, 0.205], [radius * 0.74, 0.24]]
    : [[radius * 0.80, 0.09], [radius * 0.91, 0.14], [radius * 0.90, 0.205], [radius * 0.74, 0.24]];
  s.lathe('lotus_cup', cup as Profile[], porcelain ? IVORY : GOLD);
  if (style === 'lotus') {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const petal = s.ball(`lotus_petal_${i}`, [Math.sin(a) * radius * 0.84, 0.168, Math.cos(a) * radius * 0.84], [radius * 0.175, 0.095, 0.040], porcelain ? IVORY : GOLD, s.root, true);
      sculptPetal(petal.geometry);
      petal.rotation.y = a; petal.rotation.x = -0.32;
      // A fine inner relief gives a petal edge without adding a jagged silhouette.
      const relief = s.ball(`lotus_petal_relief_${i}`, [Math.sin(a) * radius * 0.90, 0.179, Math.cos(a) * radius * 0.90], [radius * 0.112, 0.070, 0.009], porcelain ? { ...IVORY, name: 'PorcelainPetalRelief', color: '#e1d8c3' } : { ...GOLD, name: 'GoldPetalRelief', color: '#b68b50' }, s.root, true);
      sculptPetal(relief.geometry);
      relief.rotation.y = a; relief.rotation.x = -0.32;
    }
  } else {
    s.ring('plinth_upper_bead', [0, 0.20, 0], radius * 0.87, 0.012, porcelain ? IVORY : GOLD);
    if (style === 'water') for (let row = 0; row < 2; row++) {
      const points: Vec3[] = [];
      for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU; points.push([Math.sin(a) * radius * 0.9, 0.12 + row * 0.038 + Math.sin(a * 5) * 0.012, Math.cos(a) * radius * 0.9]); }
      // Nearly closed raised wave relief; its capped ends meet beneath the statue.
      s.stroke(`water_wave_${row}`, points, 0.007, EDGE);
    }
  }
  s.lathe('seat_cushion', [[radius * 0.75, 0.225], [radius * 0.80, 0.265], [radius * 0.76, 0.317]], porcelain ? SILK : ROBE);
}

/** A broad lower lobe narrows to a pointed tip; this reads as a leaf, never a coin. */
function sculptPetal(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), narrow = 0.20 + 0.65 * Math.pow(1 - y, 0.65);
    position.setXYZ(i, position.getX(i) * narrow, y, position.getZ(i) * narrow);
  }
  geometry.computeVertexNormals();
}

function face(s: Sculpture, center: Vec3, skin: Finish, options: { scale?: Vec3; tilt?: number; happy?: boolean; elder?: boolean; porcelain?: boolean } = {}) {
  const group = new THREE.Group(); group.name = 'sculpted_head'; group.position.fromArray(center);
  group.rotation.z = options.tilt ?? 0; group.scale.fromArray(options.scale ?? [1, 1, 1]); s.root.add(group);
  const r: Vec3 = [options.happy ? 0.145 : 0.133, options.elder ? 0.171 : 0.166, 0.123];
  const frontal = (x: number, y: number) => {
    const base = r[2] * Math.sqrt(Math.max(0.02, 1 - (x / r[0]) ** 2 - (y / r[1]) ** 2));
    const nose = 0.030 * Math.exp(-((x / 0.022) ** 2 + ((y + 0.011) / 0.047) ** 2));
    const cheek = 0.007 * (Math.exp(-(((x - 0.066) / 0.041) ** 2 + ((y + 0.029) / 0.044) ** 2)) + Math.exp(-(((x + 0.066) / 0.041) ** 2 + ((y + 0.029) / 0.044) ** 2)));
    return base + nose + cheek;
  };
  const geo = new THREE.SphereGeometry(1, s.lod ? 24 : 44, s.lod ? 16 : 30);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i), ny = pos.getY(i), nz = pos.getZ(i);
    let x = nx * r[0], y = ny * r[1], z = nz * r[2];
    x *= 0.88 + 0.12 * THREE.MathUtils.smoothstep(y, -0.13, 0.04);
    if (nz > 0) z += (frontal(x, y) - r[2] * Math.sqrt(Math.max(0.02, 1 - (x / r[0]) ** 2 - (y / r[1]) ** 2))) * Math.min(1, nz * 4);
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals(); s.add('head_sculpt', geo, skin, group);
  const crease: Finish = options.porcelain ? { ...INK, name: 'PorcelainFeatures', color: '#9b8f7c', metalness: 0 } : INK;
  const lip: Finish = options.porcelain ? { ...crease, name: 'PorcelainLips', color: '#b3a08c' } : { ...INK, name: 'BronzeLips', color: '#a47748' };
  for (const side of [-1, 1]) {
    const ear = s.ball(`ear_${side}`, [side * 0.137, -0.024, -0.007], [0.024, options.elder ? 0.078 : 0.067, 0.026], skin, group);
    ear.rotation.z = side * -0.09;
    s.ball(`ear_relief_${side}`, [side * 0.143, -0.016, 0.015], [0.011, 0.039, 0.009], { ...skin, name: `${skin.name}EarRelief`, color: options.porcelain ? '#d2caba' : '#9d7140' }, group, true);
    const lid: Vec3[] = [], brow: Vec3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = side * (0.027 + t * 0.051);
      const y = 0.026 - Math.sin(t * Math.PI) * (options.happy ? 0.002 : 0.009);
      lid.push([x, y, frontal(x, y) + 0.002]);
      const by = 0.060 + Math.sin(t * Math.PI) * 0.008;
      brow.push([x, by, frontal(x, by) + 0.001]);
    }
    s.stroke(`closed_eye_${side}`, lid, 0.0026, crease, group);
    s.stroke(`eyebrow_${side}`, brow, options.elder ? 0.0035 : 0.0023, crease, group, 0.0013);
    const nx = side * 0.011, ny = -0.026;
    s.ball(`nostril_${side}`, [nx, ny, frontal(nx, ny) - 0.001], [0.0045, 0.0024, 0.0021], crease, group, true);
  }
  const mouth: Vec3[] = [];
  for (let i = 0; i <= 10; i++) { const x = (i / 10 - 0.5) * (options.happy ? 0.084 : 0.061); const y = -0.072 + Math.pow(x / 0.035, 2) * (options.happy ? 0.012 : 0.005); mouth.push([x, y, frontal(x, y) + 0.001]); }
  s.stroke('gentle_smile', mouth, options.happy ? 0.0034 : 0.0025, lip, group);
  s.ball('lower_lip', [0, -0.079, frontal(0, -0.079)], [0.020, 0.005, 0.004], skin, group, true);
  return group;
}

function hands(s: Sculpture, shoulder: Vec3, elbow: Vec3, wrist: Vec3, skin: Finish, robe: Finish, name: string, covered = true) {
  const fore = mix(elbow, wrist, covered ? 0.70 : 0.15);
  const cuffRadius = covered ? 0.074 : 0.058;
  // The sweep starts inside the torso; the visible shoulder is one rounded fabric arc.
  const hiddenStart: Vec3 = [shoulder[0] * 0.62, shoulder[1] + 0.012, shoulder[2]];
  s.stroke(`${name}_flowing_sleeve`, [hiddenStart, shoulder, mix(shoulder, elbow, 0.55), elbow, fore], 0.079, robe, s.root, cuffRadius);
  s.stroke(`${name}_forearm`, [mix(elbow, wrist, covered ? 0.52 : 0.08), mix(elbow, wrist, 0.82), wrist], 0.039, skin, s.root, 0.027);
  const direction = V(wrist).sub(V(elbow)).normalize();
  const hand = new THREE.Group(); hand.position.fromArray(wrist);
  hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction); s.root.add(hand);
  s.ball(`${name}_palm`, [0, 0.004, 0], [0.035, 0.046, 0.026], skin, hand);
  // Grouped, gently tapered fingers and an opposing thumb give a readable silhouette.
  for (let finger = 0; finger < 4; finger++) {
    const offset = (finger - 1.5) * 0.013;
    s.ball(`${name}_finger_${finger}`, [offset, 0.037 + (finger === 1 || finger === 2 ? 0.006 : 0), 0.002], [0.009, 0.026, 0.020], skin, hand, true);
  }
  const thumb = s.ball(`${name}_thumb`, [name === 'left' ? 0.032 : -0.032, -0.004, 0.012], [0.014, 0.028, 0.018], skin, hand, true);
  thumb.rotation.z = name === 'left' ? -0.35 : 0.35;
  // A fine cuff follows the sleeve axis and conceals its join to the wrist.
  const cuff = s.ring(`${name}_cuff`, fore, cuffRadius, 0.0025, EDGE);
  cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(wrist).sub(V(elbow)).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
}

function seatedDrapery(s: Sculpture, y = 0.40, robe = ROBE) {
  const left = s.ball('crossed_left_knee', [-0.12, y + 0.035, 0.07], [0.31, 0.14, 0.225], robe); left.rotation.z = 0.13;
  const right = s.ball('crossed_right_knee', [0.14, y + 0.065, 0.04], [0.29, 0.135, 0.22], robe); right.rotation.z = -0.10;
  const hem = { ...EDGE, name: 'DraperyFoldHighlights', color: '#bc8448', metalness: 0.2, roughness: 0.72 };
  for (let side = -1; side <= 1; side += 2) for (let f = 0; f < 3; f++) {
    const cx = side < 0 ? -0.12 : 0.14, cy = y + (side < 0 ? 0.035 : 0.065), cz = side < 0 ? 0.07 : 0.04;
    const rx = side < 0 ? 0.31 : 0.29, ry = side < 0 ? 0.14 : 0.135, rz = side < 0 ? 0.225 : 0.22;
    const tilt = side < 0 ? 0.13 : -0.10, points: Vec3[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, lx = side * THREE.MathUtils.lerp(0.22, -0.015, t), ly = 0.016 + f * 0.021 + Math.sin(t * Math.PI) * 0.007;
      points.push([cx + lx * Math.cos(tilt) - ly * Math.sin(tilt), cy + lx * Math.sin(tilt) + ly * Math.cos(tilt), cz + rz * Math.sqrt(Math.max(0.03, 1 - (lx / rx) ** 2 - (ly / ry) ** 2)) - 0.003]);
    }
    s.stroke(`seated_fold_${side}_${f}`, points, 0.0045, hem);
  }
  s.ball('front_fold_panel', [0, y + 0.005, 0.175], [0.17, 0.080, 0.13], robe);
}

function torso(s: Sculpture, bottom: number, shoulders: number, width = 0.245, robe = ROBE, standing = false) {
  const height = shoulders - bottom;
  const profile: Profile[] = [];
  const count = s.lod ? 12 : 22;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const y = bottom + height * t;
    const radius = standing
      ? THREE.MathUtils.lerp(0.278, width, t) - Math.sin(t * Math.PI) * 0.037
      : width * (0.81 + 0.19 * Math.sin(t * Math.PI * 0.9));
    const neck = t > 0.88 ? THREE.MathUtils.lerp(1, 0.28, (t - 0.88) / 0.12) : 1;
    profile.push([radius * neck, y, radius * 0.72 * neck]);
  }
  s.lathe('flowing_outer_robe', profile, robe, standing ? 0.045 : 0.045);
  const surfaceZ = (x: number, y: number) => {
    const t = THREE.MathUtils.clamp((y - bottom) / height, 0, 1);
    const row = Math.min(profile.length - 2, Math.floor(t * (profile.length - 1)));
    const f = t * (profile.length - 1) - row;
    const r = THREE.MathUtils.lerp(profile[row][0], profile[row + 1][0], f);
    const d = THREE.MathUtils.lerp(profile[row][2]!, profile[row + 1][2]!, f);
    return Math.sqrt(Math.max(0.035, 1 - (x / r) ** 2)) * d + 0.005;
  };
  // Curved, raised overlapping hems replace the old pixelated painted diagonal stripe.
  for (let line = 0; line < 3; line++) {
    const points: Vec3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, x = THREE.MathUtils.lerp(-width * 0.76, width * 0.56, t);
      const y = shoulders - 0.075 - t * height * 0.58 - line * 0.054 - Math.sin(t * Math.PI) * line * 0.020;
      points.push([x, y, surfaceZ(x, y) - (line ? 0.010 : 0)]);
    }
    s.stroke(`overlap_border_${line}`, points, line === 0 ? 0.005 : 0.018, line === 0 ? EDGE : robe);
  }
}

function mala(s: Sculpture, p: Vec3, radius: number, count = 16) {
  for (let i = 0; i < count; i++) {
    const a = i / count * TAU;
    s.ball(`prayer_bead_${i}`, [p[0] + Math.cos(a) * radius, p[1] + Math.sin(a) * radius, p[2]], [0.010, 0.010, 0.010], { ...ROBE, name: 'PolishedPrayerBeads', color: '#69422c', roughness: 0.38 }, s.root, true);
  }
}

function curls(s: Sculpture, head: THREE.Group) {
  // The hair shell sits behind the forehead; each low dome is a carved spiral curl.
  s.ball('hair_cap', [0, 0.110, -0.017], [0.118, 0.083, 0.109], HAIR, head);
  for (let row = 0; row < 4; row++) {
    const elevation = 0.18 + row * 0.30;
    const count = s.lod ? 10 : 15;
    for (let j = 0; j < count; j++) {
      const a = j / count * TAU + row * 0.16;
      s.ball(`hair_curl_${row}_${j}`, [Math.sin(a) * 0.115 * Math.cos(elevation), 0.092 + Math.sin(elevation) * 0.081, -0.014 + Math.cos(a) * 0.105 * Math.cos(elevation)], [0.014, 0.013, 0.014], HAIR, head, true);
    }
  }
  s.ball('ushnisha', [0, 0.207, -0.018], [0.046, 0.052, 0.045], HAIR, head);
  s.ball('ushnisha_tip', [0, 0.249, -0.018], [0.018, 0.021, 0.018], GOLD, head, true);
}

function buddha(s: Sculpture) {
  pedestal(s, 0.55);
  seatedDrapery(s, 0.40);
  torso(s, 0.49, 1.295, 0.258);
  s.stroke('neck', [[0, 1.24, 0], [0, 1.395, 0.008]], 0.067, GOLD);
  const head = face(s, [0, 1.495, 0.012], GOLD, { scale: [1.06, 1.05, 1.04] });
  curls(s, head);
  s.ball('urna', [0, 0.075, 0.115], [0.009, 0.010, 0.006], EDGE, head, true);
  hands(s, [-0.22, 1.18, 0], [-0.29, 0.91, 0.04], [-0.055, 0.67, 0.235], GOLD, ROBE, 'left');
  hands(s, [0.22, 1.18, 0], [0.29, 0.91, 0.04], [0.055, 0.70, 0.235], GOLD, ROBE, 'right', false);
  // Resting palms lie horizontally in the lap instead of looking like dangling fists.
  s.ball('meditation_left_palm', [-0.025, 0.675, 0.247], [0.070, 0.019, 0.040], GOLD);
  s.ball('meditation_right_palm', [0.025, 0.704, 0.247], [0.070, 0.019, 0.040], GOLD);
  const { sockets } = createBuddhaFigureSDF();
  addSockets(s.root, sockets);
}

/** A doubled surface gives the veil a real edge and a closed, thin cloth volume. */
function veil(s: Sculpture) {
  const rows = s.lod ? 12 : 22, cols = s.lod ? 18 : 34;
  const positions: number[] = [], indices: number[] = [];
  for (let side = 0; side < 2; side++) for (let i = 0; i <= rows; i++) {
    const t = i / rows, y = 1.35 + t * 0.60;
    const r = 0.22 - 0.055 * Math.sin(t * Math.PI / 2) - Math.pow(t, 8) * 0.075;
    const depth = 0.11 - Math.pow(t, 8) * 0.025;
    for (let j = 0; j <= cols; j++) {
      const phi = -1.83 + j / cols * 3.66;
      const thick = side ? -0.009 : 0;
      positions.push(Math.sin(phi) * (r + thick), y, -0.045 - Math.cos(phi) * (depth + thick));
    }
  }
  const stride = cols + 1, layer = (rows + 1) * stride;
  for (let side = 0; side < 2; side++) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = side * layer + i * stride + j, b = a + 1, c = a + stride, d = c + 1;
    if (!side) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
  }
  const quad = (a: number, b: number) => indices.push(a, a + layer, b, b, a + layer, b + layer);
  for (let j = 0; j < cols; j++) { quad(j + 1, j); quad(rows * stride + j, rows * stride + j + 1); }
  for (let i = 0; i < rows; i++) { quad(i * stride, (i + 1) * stride); quad((i + 1) * stride + cols, i * stride + cols); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  s.add('porcelain_veil', geometry, SILK);
  for (const side of [-1, 1]) s.stroke(`veil_gold_edge_${side}`, [[side * 0.215, 1.35, -0.014], [side * 0.18, 1.56, 0.012], [side * 0.16, 1.76, 0.010], [side * 0.10, 1.93, -0.014]], 0.004, GOLD);
}

function quanam(s: Sculpture) {
  pedestal(s, 0.46, true);
  torso(s, 0.27, 1.535, 0.192, SILK, true);
  s.stroke('porcelain_neck', [[0, 1.48, 0], [0, 1.65, 0.013]], 0.058, IVORY);
  veil(s);
  const head = face(s, [0, 1.735, 0.025], IVORY, { scale: [0.94, 1.03, 1], porcelain: true });
  s.ball('urna', [0, 0.074, 0.118], [0.006, 0.008, 0.004], GOLD, head, true);
  hands(s, [-0.18, 1.435, 0], [-0.28, 1.20, 0.05], [-0.16, 1.30, 0.25], IVORY, SILK, 'left');
  hands(s, [0.18, 1.435, 0], [0.30, 1.24, 0.04], [0.255, 1.585, 0.20], IVORY, SILK, 'right');
  s.ring('crown_band', [0, 1.88, 0.010], 0.124, 0.013, GOLD);
  for (let i = -2; i <= 2; i++) {
    const leaf = s.ball(`crown_lotus_leaf_${i}`, [i * 0.042, 1.935 - Math.abs(i) * 0.015, 0.067 - Math.abs(i) * 0.015], [0.028, 0.075 - Math.abs(i) * 0.011, 0.014], GOLD);
    leaf.rotation.z = i * -0.19;
    const inset = s.ball(`crown_lotus_inset_${i}`, [i * 0.042, 1.938 - Math.abs(i) * 0.015, 0.080 - Math.abs(i) * 0.015], [0.013, 0.044 - Math.abs(i) * 0.006, 0.006], EDGE, s.root, true);
    inset.rotation.z = i * -0.19;
  }
  s.ball('crown_center_jade', [0, 1.953, 0.090], [0.012, 0.021, 0.009], JADE, s.root, true);
  const vase = s.lathe('purification_vase', [[0.024, 1.30], [0.044, 1.32], [0.051, 1.36], [0.038, 1.407], [0.021, 1.433], [0.021, 1.46], [0.030, 1.47]], IVORY);
  vase.position.set(-0.16, 0, 0.272);
  s.ring('vase_neck_gold', [-0.16, 1.45, 0.272], 0.023, 0.003, GOLD);
  s.stroke('willow_branch', [[0.255, 1.58, 0.20], [0.286, 1.76, 0.215], [0.33, 1.94, 0.23]], 0.006, JADE, s.root, 0.003);
  for (let i = 0; i < 5; i++) {
    const x = 0.285 + i * 0.011, y = 1.77 + i * 0.031;
    const sign = i % 2 ? 1 : -1;
    s.stroke(`willow_twig_${i}`, [[x, y, 0.22], [x + sign * 0.050, y + 0.025, 0.23], [x + sign * 0.063, y - 0.025, 0.23]], 0.0028, JADE, s.root, 0.0018);
    const leaf = s.ball(`willow_leaf_${i}`, [x + sign * 0.065, y - 0.032, 0.23], [0.010, 0.051, 0.005], JADE, s.root, true); leaf.rotation.z = sign * -0.19;
  }
  const { sockets } = createQuanAmFigureSDF(); addSockets(s.root, sockets);
}

function animal(s: Sculpture, center: Vec3, kind: 'tiger' | 'lion' | 'deer' | 'elephant') {
  const group = new THREE.Group(); group.name = `${kind}_companion`; group.position.fromArray(center); s.root.add(group);
  const body: Finish = kind === 'elephant' ? { ...IVORY, name: 'ElephantIvory', color: '#c7c2ae' } : { ...BRONZE, name: 'AnimalBronze', color: kind === 'tiger' ? '#bd9256' : '#ad7a40' };
  const small = kind === 'lion';
  const scale = small ? 0.62 : 1;
  group.scale.setScalar(scale);
  s.ball(`${kind}_body`, [0, 0, 0], kind === 'elephant' ? [0.27, 0.17, 0.23] : [0.10, 0.09, 0.17], body, group);
  for (const side of [-1, 1]) {
    s.ball(`${kind}_front_paw_${side}`, [side * (kind === 'elephant' ? 0.16 : 0.065), -0.065, 0.115], kind === 'elephant' ? [0.055, 0.095, 0.065] : [0.037, 0.035, 0.095], body, group, true);
    s.ball(`${kind}_rear_paw_${side}`, [side * (kind === 'elephant' ? 0.16 : 0.065), -0.07, -0.105], kind === 'elephant' ? [0.055, 0.095, 0.065] : [0.040, 0.030, 0.063], body, group, true);
  }
  const hy = kind === 'deer' ? 0.21 : kind === 'elephant' ? 0.10 : 0.12;
  if (kind === 'deer') s.stroke('deer_neck', [[0, 0.015, 0.10], [0, hy, 0.14]], 0.039, body, group);
  s.ball(`${kind}_head`, [0, hy, 0.15], kind === 'elephant' ? [0.128, 0.13, 0.125] : [0.071, 0.073, 0.070], body, group);
  for (const side of [-1, 1]) {
    s.ball(`${kind}_ear_${side}`, [side * (kind === 'elephant' ? 0.125 : 0.050), hy + 0.045, 0.115], kind === 'elephant' ? [0.080, 0.109, 0.025] : [0.023, kind === 'deer' ? 0.050 : 0.024, 0.018], body, group, true);
    s.ball(`${kind}_eye_${side}`, [side * 0.031, hy + 0.012, 0.212], [0.006, 0.007, 0.004], INK, group, true);
    if (kind === 'deer') {
      s.stroke(`antler_${side}`, [[side * 0.035, hy + 0.049, 0.135], [side * 0.045, hy + 0.125, 0.12], [side * 0.070, hy + 0.16, 0.105]], 0.006, EDGE, group, 0.003);
      s.stroke(`antler_branch_${side}`, [[side * 0.043, hy + 0.10, 0.125], [side * 0.018, hy + 0.133, 0.13]], 0.004, EDGE, group, 0.0025);
    }
  }
  if (kind === 'elephant') {
    s.stroke('elephant_trunk', [[0, hy, 0.245], [0, 0.01, 0.28], [0.015, -0.11, 0.29], [0.052, -0.12, 0.30]], 0.043, body, group, 0.023);
    for (const side of [-1, 1]) s.stroke(`elephant_tusk_${side}`, [[side * 0.055, hy - 0.04, 0.23], [side * 0.075, hy - 0.055, 0.30]], 0.012, IVORY, group, 0.003);
  } else {
    s.ball(`${kind}_muzzle`, [0, hy - 0.022, 0.207], [0.041, 0.025, 0.025], EDGE, group, true);
    s.ball(`${kind}_nose`, [0, hy - 0.006, 0.232], [0.011, 0.006, 0.005], INK, group, true);
    if (kind === 'lion') for (let j = 0; j < 12; j++) {
      const a = j / 12 * TAU;
      s.ball(`lion_mane_${j}`, [Math.cos(a) * 0.071, hy + Math.sin(a) * 0.076, 0.14], [0.025, 0.028, 0.031], ROBE, group, true);
    }
    if (kind === 'tiger') for (let side = -1; side <= 1; side += 2) for (let j = 0; j < 3; j++) {
      s.stroke(`tiger_band_${side}_${j}`, [[side * 0.073, 0.065, -0.09 + j * 0.07], [side * 0.099, 0.035, -0.085 + j * 0.07], [side * 0.102, -0.006, -0.08 + j * 0.07]], 0.004, INK, group);
    }
    s.stroke(`${kind}_tail`, [[0, -0.015, -0.15], [0.11, -0.025, -0.20], [0.15, 0.015, -0.13]], 0.009, body, group, 0.006);
  }
}

function arhatProps(s: Sculpture, index: number, a: Record<string, Vec3>) {
  const sy = a.leftShoulder[1];
  switch (index) {
    case 1: {
      s.stroke('coiling_dragon', [[0.30, sy - 0.02, 0.11], [0.42, sy + 0.06, 0.08], [0.40, sy + 0.20, 0.14], [0.35, sy + 0.28, 0.21]], 0.028, JADE, s.root, 0.036);
      s.ball('dragon_head', [0.35, sy + 0.28, 0.22], [0.047, 0.039, 0.060], JADE);
      for (const side of [-1, 1]) { s.ball(`dragon_eye_${side}`, [0.35 + side * 0.028, sy + 0.295, 0.263], [0.006, 0.005, 0.005], GOLD, s.root, true); s.stroke(`dragon_horn_${side}`, [[0.35 + side * 0.028, sy + 0.30, 0.20], [0.35 + side * 0.038, sy + 0.345, 0.18]], 0.008, GOLD, s.root, 0.003); }
      s.ball('dragon_pearl', [0.35, sy + 0.27, 0.292], [0.032, 0.032, 0.032], IVORY, s.root, true); break;
    }
    case 2: animal(s, [0.33, 0.35, 0.105], 'tiger'); break;
    case 3: {
      const bowl = s.lathe('alms_bowl', [[0.052, sy - 0.18], [0.085, sy - 0.16], [0.109, sy - 0.11], [0.111, sy - 0.08]], { ...BRONZE, name: 'PatinatedBowl', color: '#67533b' }); bowl.position.z = 0.29;
      s.ring('bowl_rolled_rim', [0, sy - 0.08, 0.29], 0.11, 0.006, GOLD); break;
    }
    case 5: for (const side of [-1, 1]) s.stroke(`long_white_brow_${side}`, [[side * 0.036, a.head[1] + 0.064, 0.13], [side * 0.09, a.head[1] + 0.055, 0.14], [side * 0.118, a.head[1] - 0.10, 0.16], [side * 0.14, sy + 0.025, 0.18]], 0.008, IVORY, s.root, 0.0025); break;
    case 6: {
      s.ball('heart_lotus_medallion', [0, sy - 0.065, 0.19], [0.065, 0.089, 0.025], EDGE);
      s.ball('heart_buddha_body', [0, sy - 0.075, 0.216], [0.029, 0.037, 0.015], GOLD, s.root, true);
      s.ball('heart_buddha_head', [0, sy - 0.028, 0.217], [0.018, 0.020, 0.014], GOLD, s.root, true); break;
    }
    case 7: mala(s, [0, sy - 0.12, 0.18], 0.12, 20); break;
    case 8: case 15: {
      const x = index === 8 ? 0.31 : 0.27, z = index === 8 ? 0.23 : 0.22, top = index === 8 ? 1.73 : 1.24;
      s.stroke('bamboo_staff', [[x, 0.23, z], [x, top, z]], 0.015, { ...ROBE, name: 'CarvedBamboo', color: '#785731' });
      for (let y = 0.36; y < top; y += 0.21) s.ring(`staff_node_${y}`, [x, y, z], 0.016, 0.003, EDGE);
      if (index === 15) animal(s, [-0.33, 0.35, 0.05], 'deer'); break;
    }
    case 9: s.stroke('vajra_shaft', [[0.30, sy + 0.005, 0.15], [0.30, sy + 0.31, 0.15]], 0.014, GOLD); for (const y of [sy + 0.01, sy + 0.29]) { s.ball(`vajra_end_${y}`, [0.30, y, 0.15], [0.037, 0.048, 0.037], GOLD); s.ring(`vajra_collar_${y}`, [0.30, y, 0.15], 0.040, 0.004, EDGE); } break;
    case 10: {
      s.stroke('plantain_stalk', [[-0.28, 0.24, -0.17], [-0.27, 1.17, -0.10], [-0.01, 1.82, -0.10]], 0.014, JADE);
      const leaf = s.ball('plantain_leaf', [-0.15, 1.48, -0.10], [0.145, 0.365, 0.018], JADE); leaf.rotation.z = -0.38;
      for (let i = 0; i < 6; i++) s.stroke(`plantain_vein_${i}`, [[-0.23 + i * 0.03, 1.27 + i * 0.08, -0.079], [-0.32 + i * 0.03, 1.34 + i * 0.08, -0.079]], 0.003, EDGE);
      break;
    }
    case 11: {
      const x = -0.14, y = sy - 0.08, z = 0.28;
      const tower = s.lathe('pagoda_core', [[0.047, y - 0.035], [0.047, y + 0.028], [0.023, y + 0.25]], GOLD); tower.position.set(x, 0, z);
      for (let tier = 0; tier < 7; tier++) {
        const r = 0.080 - tier * 0.006;
        const roof = s.add(`pagoda_roof_${tier}`, new THREE.CylinderGeometry(r * 0.38, r, 0.024, 4, 1), EDGE); roof.position.set(x, y + tier * 0.034, z); roof.rotation.y = Math.PI / 4;
      }
      s.ball('pagoda_finial', [x, y + 0.26, z], [0.018, 0.027, 0.018], GOLD, s.root, true); break;
    }
    case 12: animal(s, [0, 0.34, 0.06], 'elephant'); break;
    case 13: animal(s, [0, sy - 0.22, 0.30], 'lion'); break;
    case 16: {
      const bag = s.ball('travelling_bag', [-0.33, sy - 0.29, 0.10], [0.139, 0.16, 0.13], ROBE); bag.rotation.z = -0.12;
      s.stroke('bag_cord', [[-0.33, sy - 0.15, 0.12], [-0.30, sy - 0.07, 0.10], [-0.22, sy + 0.01, 0]], 0.009, EDGE); break;
    }
    case 18: mala(s, [0.25, sy - 0.27, 0.26], 0.074); s.ball('cloth_sack', [-0.30, 0.40, -0.02], [0.14, 0.14, 0.14], ROBE); break;
  }
}

function arhat(s: Sculpture, index: number) {
  const data = createArhatFigureSDF(index), meta = ARHAT_METADATA_LIST[index - 1];
  const a: Record<string, Vec3> = { ...data.anatomicalPoints, head: [...data.anatomicalPoints.head] as Vec3 };
  a.head[1] -= 0.065;
  const sy = a.leftShoulder[1], lift = index === 12 ? 0.13 : 0;
  const robe: Finish = { ...ROBE, name: 'ArhatDrapery', color: ['#9b683b', '#8c572f', '#a66d36'][index % 3] };
  pedestal(s, 0.46, false, meta.pedestalType);
  if (meta.isSeated) { seatedDrapery(s, 0.40 + lift, robe); torso(s, 0.49 + lift, sy + 0.07, index === 18 ? 0.275 : 0.235, robe); }
  else { torso(s, 0.255, sy + 0.07, 0.226, robe, true); for (const side of [-1, 1]) s.ball(`bare_foot_${side}`, [side * 0.117, 0.275, 0.103], [0.065, 0.043, 0.10], BRONZE); }
  s.stroke('neck', [[0, sy + 0.015, 0], [0, a.head[1] - 0.095, 0.01]], 0.063, BRONZE);
  face(s, a.head, BRONZE, { scale: data.headScale, tilt: data.headTilt, elder: [4, 5, 8, 10, 11, 14, 15].includes(index), happy: [7, 13, 18].includes(index) });
  hands(s, a.leftShoulder, a.leftElbow, a.leftHand, BRONZE, robe, 'left');
  hands(s, a.rightShoulder, a.rightElbow, a.rightHand, BRONZE, robe, 'right', ![1, 4, 9, 17].includes(index));
  if (index === 18) {
    s.ball('budai_belly', [0, sy - 0.20, 0.11], [0.254, 0.205, 0.175], BRONZE);
    s.ball('budai_navel', [0, sy - 0.22, 0.284], [0.009, 0.006, 0.003], INK, s.root, true);
  }
  arhatProps(s, index, a);
  for (const [name, p] of Object.entries({ hand_l_socket: a.leftHand, hand_r_socket: a.rightHand, head_socket: [a.head[0], a.head[1] + 0.19, a.head[2]] as Vec3, chest_socket: [0, sy - 0.10, 0.19] as Vec3 })) {
    const socket = new THREE.Object3D(); socket.name = name; socket.position.fromArray(p); s.root.add(socket);
  }
}

function addSockets(root: THREE.Group, sockets: Record<string, { position: Vec3 }>) {
  for (const [name, value] of Object.entries(sockets)) { const anchor = new THREE.Object3D(); anchor.name = name; anchor.position.fromArray(value.position); root.add(anchor); }
}

/** Artist-authored procedural sculpture; no voxel extraction or per-frame construction. */
export function createStatueSculpt(id: StatueId, lod: 0 | 1): THREE.Group {
  const sculpture = new Sculpture(lod); sculpture.root.name = id;
  if (id === 'buddha') buddha(sculpture);
  else if (id === 'quanam') quanam(sculpture);
  else {
    const index = Number(id.slice('arhat_'.length));
    if (!Number.isInteger(index) || index < 1 || index > 18) throw new Error(`Unknown statue ${id}`);
    arhat(sculpture, index);
  }
  return sculpture.finish();
}
