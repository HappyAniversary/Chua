import * as THREE from 'three';
import { BONE_NAMES, MATERIAL_SLOTS, type AttachmentSocket, type BoneDefinition, type Vec3 } from './types.ts';

/**
 * Hệ thống xương chuẩn Humanoid (23 xương) và thuật toán gán trọng số da
 * Biến đổi các BufferGeometry tĩnh thành SkinnedMesh có thể cử động mượt mà ở 60fps.
 */

/**
 * 23 Xương chuẩn cho nhân vật người (Monk / Tượng đứng)
 */
export const STANDARD_HUMANOID_BONES: BoneDefinition[] = [
  // 1. Thân chính
  {
    name: BONE_NAMES.HIPS,
    parentName: null,
    head: [0, 0.92, 0],
    tail: [0, 1.08, 0],
    radius: 0.22,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.SPINE,
    parentName: BONE_NAMES.HIPS,
    head: [0, 1.08, 0],
    tail: [0, 1.25, 0],
    radius: 0.18,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.CHEST,
    parentName: BONE_NAMES.SPINE,
    head: [0, 1.25, 0],
    tail: [0, 1.45, 0],
    radius: 0.2,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.NECK,
    parentName: BONE_NAMES.CHEST,
    head: [0, 1.45, 0],
    tail: [0, 1.54, 0],
    radius: 0.11,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HEAD,
    parentName: BONE_NAMES.NECK,
    head: [0, 1.54, 0],
    tail: [0, 1.82, 0],
    radius: 0.18,
    weightPriority: 1.5,
  },

  // 2. Tay Trái
  {
    name: BONE_NAMES.SHOULDER_L,
    parentName: BONE_NAMES.CHEST,
    head: [-0.08, 1.42, 0],
    tail: [-0.2, 1.4, 0],
    radius: 0.12,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.UPPER_ARM_L,
    parentName: BONE_NAMES.SHOULDER_L,
    head: [-0.2, 1.4, 0],
    tail: [-0.26, 1.14, 0],
    radius: 0.12,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_ARM_L,
    parentName: BONE_NAMES.UPPER_ARM_L,
    head: [-0.26, 1.14, 0],
    tail: [-0.29, 0.88, 0],
    radius: 0.1,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HAND_L,
    parentName: BONE_NAMES.LOWER_ARM_L,
    head: [-0.29, 0.88, 0],
    tail: [-0.31, 0.74, 0.02],
    radius: 0.08,
    weightPriority: 1.8,
  },
  {
    name: BONE_NAMES.SLEEVE_L,
    parentName: BONE_NAMES.LOWER_ARM_L,
    head: [-0.26, 1.1, 0],
    tail: [-0.28, 0.78, -0.06],
    radius: 0.15,
    weightPriority: 0.9,
  },

  // 3. Tay Phải
  {
    name: BONE_NAMES.SHOULDER_R,
    parentName: BONE_NAMES.CHEST,
    head: [0.08, 1.42, 0],
    tail: [0.2, 1.4, 0],
    radius: 0.12,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.UPPER_ARM_R,
    parentName: BONE_NAMES.SHOULDER_R,
    head: [0.2, 1.4, 0],
    tail: [0.26, 1.14, 0],
    radius: 0.12,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_ARM_R,
    parentName: BONE_NAMES.UPPER_ARM_R,
    head: [0.26, 1.14, 0],
    tail: [0.29, 0.88, 0],
    radius: 0.1,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HAND_R,
    parentName: BONE_NAMES.LOWER_ARM_R,
    head: [0.29, 0.88, 0],
    tail: [0.31, 0.74, 0.02],
    radius: 0.08,
    weightPriority: 1.8,
  },
  {
    name: BONE_NAMES.SLEEVE_R,
    parentName: BONE_NAMES.LOWER_ARM_R,
    head: [0.26, 1.1, 0],
    tail: [0.28, 0.78, -0.06],
    radius: 0.15,
    weightPriority: 0.9,
  },

  // 4. Chân Trái
  {
    name: BONE_NAMES.UPPER_LEG_L,
    parentName: BONE_NAMES.HIPS,
    head: [-0.12, 0.9, 0],
    tail: [-0.13, 0.48, 0],
    radius: 0.14,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_LEG_L,
    parentName: BONE_NAMES.UPPER_LEG_L,
    head: [-0.13, 0.48, 0],
    tail: [-0.14, 0.1, 0],
    radius: 0.11,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.FOOT_L,
    parentName: BONE_NAMES.LOWER_LEG_L,
    head: [-0.14, 0.1, 0],
    tail: [-0.14, 0.04, 0.12],
    radius: 0.09,
    weightPriority: 1.4,
  },
  {
    name: BONE_NAMES.TOE_L,
    parentName: BONE_NAMES.FOOT_L,
    head: [-0.14, 0.04, 0.12],
    tail: [-0.14, 0.02, 0.18],
    radius: 0.06,
    weightPriority: 1.5,
  },

  // 5. Chân Phải
  {
    name: BONE_NAMES.UPPER_LEG_R,
    parentName: BONE_NAMES.HIPS,
    head: [0.12, 0.9, 0],
    tail: [0.13, 0.48, 0],
    radius: 0.14,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_LEG_R,
    parentName: BONE_NAMES.UPPER_LEG_R,
    head: [0.13, 0.48, 0],
    tail: [0.14, 0.1, 0],
    radius: 0.11,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.FOOT_R,
    parentName: BONE_NAMES.LOWER_LEG_R,
    head: [0.14, 0.1, 0],
    tail: [0.14, 0.04, 0.12],
    radius: 0.09,
    weightPriority: 1.4,
  },
  {
    name: BONE_NAMES.TOE_R,
    parentName: BONE_NAMES.FOOT_R,
    head: [0.14, 0.04, 0.12],
    tail: [0.14, 0.02, 0.18],
    radius: 0.06,
    weightPriority: 1.5,
  },
];

/**
 * Khung xương cho Đại Tượng Phật Thích Ca (Tọa thiền kiết già trên đài sen)
 */
export const BUDDHA_MEDITATION_BONES: BoneDefinition[] = [
  // 1. Đài Sen & Thân chính
  {
    name: 'LotusBase',
    parentName: null,
    head: [0, 0.40, 0],
    tail: [0, 0.05, 0],
    radius: 0.55,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.HIPS,
    parentName: 'LotusBase',
    head: [0, 0.46, 0],
    tail: [0, 0.65, 0],
    radius: 0.28,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.SPINE,
    parentName: BONE_NAMES.HIPS,
    head: [0, 0.65, 0],
    tail: [0, 0.90, 0],
    radius: 0.22,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.CHEST,
    parentName: BONE_NAMES.SPINE,
    head: [0, 0.90, 0],
    tail: [0, 1.22, 0],
    radius: 0.24,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.NECK,
    parentName: BONE_NAMES.CHEST,
    head: [0, 1.22, 0],
    tail: [0, 1.36, 0],
    radius: 0.12,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HEAD,
    parentName: BONE_NAMES.NECK,
    head: [0, 1.36, 0],
    tail: [0, 1.85, 0],
    radius: 0.22,
    weightPriority: 1.5,
  },

  // 2. Tay Trái (Ấn Thiền Định)
  {
    name: BONE_NAMES.SHOULDER_L,
    parentName: BONE_NAMES.CHEST,
    head: [-0.08, 1.20, 0],
    tail: [-0.24, 1.18, 0],
    radius: 0.12,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.UPPER_ARM_L,
    parentName: BONE_NAMES.SHOULDER_L,
    head: [-0.24, 1.18, 0],
    tail: [-0.28, 0.88, 0.05],
    radius: 0.12,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_ARM_L,
    parentName: BONE_NAMES.UPPER_ARM_L,
    head: [-0.28, 0.88, 0.05],
    tail: [-0.08, 0.65, 0.20],
    radius: 0.10,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HAND_L,
    parentName: BONE_NAMES.LOWER_ARM_L,
    head: [-0.08, 0.65, 0.20],
    tail: [0.0, 0.62, 0.24],
    radius: 0.10,
    weightPriority: 1.8,
  },

  // 3. Tay Phải (Ấn Thiền Định)
  {
    name: BONE_NAMES.SHOULDER_R,
    parentName: BONE_NAMES.CHEST,
    head: [0.08, 1.20, 0],
    tail: [0.24, 1.18, 0],
    radius: 0.12,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.UPPER_ARM_R,
    parentName: BONE_NAMES.SHOULDER_R,
    head: [0.24, 1.18, 0],
    tail: [0.28, 0.88, 0.05],
    radius: 0.12,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_ARM_R,
    parentName: BONE_NAMES.UPPER_ARM_R,
    head: [0.28, 0.88, 0.05],
    tail: [0.08, 0.66, 0.20],
    radius: 0.10,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HAND_R,
    parentName: BONE_NAMES.LOWER_ARM_R,
    head: [0.08, 0.66, 0.20],
    tail: [0.0, 0.64, 0.24],
    radius: 0.10,
    weightPriority: 1.8,
  },

  // 4. Chân Kiết Già (Lotus Posture)
  {
    name: BONE_NAMES.UPPER_LEG_L,
    parentName: BONE_NAMES.HIPS,
    head: [-0.14, 0.52, 0],
    tail: [-0.40, 0.48, 0.14],
    radius: 0.16,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_LEG_L,
    parentName: BONE_NAMES.UPPER_LEG_L,
    head: [-0.40, 0.48, 0.14],
    tail: [0.18, 0.52, 0.20],
    radius: 0.13,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.FOOT_L,
    parentName: BONE_NAMES.LOWER_LEG_L,
    head: [0.18, 0.52, 0.20],
    tail: [0.24, 0.53, 0.18],
    radius: 0.08,
    weightPriority: 1.5,
  },
  {
    name: BONE_NAMES.UPPER_LEG_R,
    parentName: BONE_NAMES.HIPS,
    head: [0.14, 0.52, 0],
    tail: [0.40, 0.48, 0.14],
    radius: 0.16,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_LEG_R,
    parentName: BONE_NAMES.UPPER_LEG_R,
    head: [0.40, 0.48, 0.14],
    tail: [-0.18, 0.46, 0.18],
    radius: 0.13,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.FOOT_R,
    parentName: BONE_NAMES.LOWER_LEG_R,
    head: [-0.18, 0.46, 0.18],
    tail: [-0.24, 0.47, 0.16],
    radius: 0.08,
    weightPriority: 1.5,
  },
];

/**
 * Khung xương cho Bồ Tát Quán Thế Âm (Dáng đứng khoan thai trên đài sen)
 */
export const QUANAM_STANDING_BONES: BoneDefinition[] = [
  // 1. Đài Sen Biển Cả & Thân chính
  {
    name: 'LotusBase',
    parentName: null,
    head: [0, 0.32, 0],
    tail: [0, 0.05, 0],
    radius: 0.48,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.HIPS,
    parentName: 'LotusBase',
    head: [0, 0.95, 0],
    tail: [0, 1.12, 0],
    radius: 0.20,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.SPINE,
    parentName: BONE_NAMES.HIPS,
    head: [0, 1.12, 0],
    tail: [0, 1.30, 0],
    radius: 0.18,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.CHEST,
    parentName: BONE_NAMES.SPINE,
    head: [0, 1.30, 0],
    tail: [0, 1.50, 0],
    radius: 0.20,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.NECK,
    parentName: BONE_NAMES.CHEST,
    head: [0, 1.50, 0],
    tail: [0, 1.60, 0],
    radius: 0.11,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HEAD,
    parentName: BONE_NAMES.NECK,
    head: [0, 1.60, 0],
    tail: [0, 1.96, 0],
    radius: 0.22,
    weightPriority: 1.5,
  },

  // 2. Tay Trái (Cầm Bình Tịnh Thủy)
  {
    name: BONE_NAMES.SHOULDER_L,
    parentName: BONE_NAMES.CHEST,
    head: [-0.08, 1.48, 0],
    tail: [-0.18, 1.45, 0],
    radius: 0.11,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.UPPER_ARM_L,
    parentName: BONE_NAMES.SHOULDER_L,
    head: [-0.18, 1.45, 0],
    tail: [-0.22, 1.25, 0.04],
    radius: 0.11,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_ARM_L,
    parentName: BONE_NAMES.UPPER_ARM_L,
    head: [-0.22, 1.25, 0.04],
    tail: [-0.12, 1.20, 0.22],
    radius: 0.09,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HAND_L,
    parentName: BONE_NAMES.LOWER_ARM_L,
    head: [-0.12, 1.20, 0.22],
    tail: [-0.08, 1.22, 0.25],
    radius: 0.08,
    weightPriority: 1.8,
  },

  // 3. Tay Phải (Cầm Cành Dương Liễu)
  {
    name: BONE_NAMES.SHOULDER_R,
    parentName: BONE_NAMES.CHEST,
    head: [0.08, 1.48, 0],
    tail: [0.18, 1.45, 0],
    radius: 0.11,
    weightPriority: 1.0,
  },
  {
    name: BONE_NAMES.UPPER_ARM_R,
    parentName: BONE_NAMES.SHOULDER_R,
    head: [0.18, 1.45, 0],
    tail: [0.22, 1.26, 0.04],
    radius: 0.11,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_ARM_R,
    parentName: BONE_NAMES.UPPER_ARM_R,
    head: [0.22, 1.26, 0.04],
    tail: [0.18, 1.44, 0.18],
    radius: 0.09,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.HAND_R,
    parentName: BONE_NAMES.LOWER_ARM_R,
    head: [0.18, 1.44, 0.18],
    tail: [0.18, 1.50, 0.20],
    radius: 0.08,
    weightPriority: 1.8,
  },

  // 4. Chân Đứng Khoan Thai
  {
    name: BONE_NAMES.UPPER_LEG_L,
    parentName: BONE_NAMES.HIPS,
    head: [-0.10, 0.95, 0],
    tail: [-0.10, 0.58, 0],
    radius: 0.16,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_LEG_L,
    parentName: BONE_NAMES.UPPER_LEG_L,
    head: [-0.10, 0.58, 0],
    tail: [-0.10, 0.32, 0],
    radius: 0.14,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.FOOT_L,
    parentName: BONE_NAMES.LOWER_LEG_L,
    head: [-0.10, 0.32, 0],
    tail: [-0.10, 0.30, 0.12],
    radius: 0.10,
    weightPriority: 1.5,
  },
  {
    name: BONE_NAMES.UPPER_LEG_R,
    parentName: BONE_NAMES.HIPS,
    head: [0.10, 0.95, 0],
    tail: [0.10, 0.58, 0],
    radius: 0.16,
    weightPriority: 1.1,
  },
  {
    name: BONE_NAMES.LOWER_LEG_R,
    parentName: BONE_NAMES.UPPER_LEG_R,
    head: [0.10, 0.58, 0],
    tail: [0.10, 0.32, 0],
    radius: 0.14,
    weightPriority: 1.2,
  },
  {
    name: BONE_NAMES.FOOT_R,
    parentName: BONE_NAMES.LOWER_LEG_R,
    head: [0.10, 0.32, 0],
    tail: [0.10, 0.30, 0.12],
    radius: 0.10,
    weightPriority: 1.5,
  },
];

/**
 * Điểm neo đính kèm đạo cụ tiêu chuẩn
 */
export const STANDARD_SOCKETS: AttachmentSocket[] = [
  {
    name: 'hand_r_socket',
    boneName: BONE_NAMES.HAND_R,
    offset: [0, -0.06, 0.04],
  },
  {
    name: 'hand_l_socket',
    boneName: BONE_NAMES.HAND_L,
    offset: [0, -0.06, 0.04],
  },
  {
    name: 'head_socket',
    boneName: BONE_NAMES.HEAD,
    offset: [0, 0.28, 0],
  },
  {
    name: 'chest_socket',
    boneName: BONE_NAMES.CHEST,
    offset: [0, 0.06, 0.14],
  },
];

/**
 * Tính khoảng cách từ điểm p đến đoạn thẳng nối điểm a và b
 */
function distanceToSegment(p: Vec3, a: Vec3, b: Vec3): number {
  const pax = p[0] - a[0];
  const pay = p[1] - a[1];
  const paz = p[2] - a[2];

  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];

  const baLengthSq = bax * bax + bay * bay + baz * baz;
  if (baLengthSq === 0) {
    return Math.sqrt(pax * pax + pay * pay + paz * paz);
  }

  const t = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / baLengthSq));

  const dx = pax - t * bax;
  const dy = pay - t * bay;
  const dz = paz - t * baz;

  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Smooth painted joint influences along the surface, preserving anatomical anchors. */
function relaxAvatarSkinWeights(
  geometry: THREE.BufferGeometry,
  boneCount: number,
  skinIndices: Uint16Array,
  skinWeights: Float32Array,
) {
  const index = geometry.getIndex();
  const position = geometry.getAttribute('position');
  const region = geometry.getAttribute('regionId') ?? geometry.getAttribute('_regionid');
  if (!index || !region) return;
  const neighbors = Array.from({ length: position.count }, () => new Set<number>());
  for (let face = 0; face < index.count; face += 3) {
    const a = index.getX(face), b = index.getX(face + 1), c = index.getX(face + 2);
    neighbors[a].add(b); neighbors[a].add(c);
    neighbors[b].add(a); neighbors[b].add(c);
    neighbors[c].add(a); neighbors[c].add(b);
  }
  const rings = neighbors.map((set, vertex) => {
    const ring = [...set].map((neighbor) => {
      const distance = Math.hypot(
        position.getX(vertex) - position.getX(neighbor),
        position.getY(vertex) - position.getY(neighbor),
        position.getZ(vertex) - position.getZ(neighbor),
      );
      return { neighbor, weight: 1 / Math.max(distance, 1e-6) };
    });
    const total = ring.reduce((sum, entry) => sum + entry.weight, 0) || 1;
    return ring.map(({ neighbor, weight }) => ({ neighbor, weight: weight / total }));
  });
  const free: number[] = [];
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = Math.abs(position.getX(vertex)), y = position.getY(vertex);
    const isPalm = region.getX(vertex) === MATERIAL_SLOTS.SKIN && x > 0.265 && y > 0.68 && y < 0.825;
    const isCore = x < 0.055 && y > 0.85 && y < 1.43;
    const isLowSkirt = region.getX(vertex) === MATERIAL_SLOTS.ROBE && y < 0.52 && y > 0.35;
    if (!(isPalm || isCore || isLowSkirt || y > 1.56 || y < 0.11) && rings[vertex].length) {
      free.push(vertex);
    }
  }
  let current = new Float32Array(position.count * boneCount);
  let next = new Float32Array(current.length);
  for (let vertex = 0; vertex < position.count; vertex++) for (let slot = 0; slot < 4; slot++) {
    current[vertex * boneCount + skinIndices[vertex * 4 + slot]] += skinWeights[vertex * 4 + slot];
  }
  for (let iteration = 0; iteration < 160; iteration++) {
    next.set(current);
    for (const vertex of free) {
      const offset = vertex * boneCount;
      for (let bone = 0; bone < boneCount; bone++) next[offset + bone] = current[offset + bone] * 0.5;
      for (const { neighbor, weight } of rings[vertex]) {
        const amount = 0.5 * weight;
        const neighborOffset = neighbor * boneCount;
        for (let bone = 0; bone < boneCount; bone++) next[offset + bone] += current[neighborOffset + bone] * amount;
      }
    }
    [current, next] = [next, current];
  }
  for (let vertex = 0; vertex < position.count; vertex++) {
    const influences = Array.from({ length: boneCount }, (_, bone) => ({ bone, weight: current[vertex * boneCount + bone] }));
    influences.sort((a, b) => b.weight - a.weight);
    // Shrink against the fifth influence before truncation. When fourth/fifth
    // places exchange, both approach zero instead of dropping a finite weight.
    let cutoff = influences[4]?.weight ?? 0;
    let total = influences.slice(0, 4).reduce((sum, influence) => sum + Math.max(0, influence.weight - cutoff), 0);
    if (total < 1e-8) {
      cutoff = 0;
      total = influences.slice(0, 4).reduce((sum, influence) => sum + influence.weight, 0) || 1;
    }
    for (let slot = 0; slot < 4; slot++) {
      skinIndices[vertex * 4 + slot] = influences[slot].bone;
      skinWeights[vertex * 4 + slot] = Math.max(0, influences[slot].weight - cutoff) / total;
    }
  }
}

/**
 * Tính toán trọng số da (Skinning Weights) cho toàn bộ đỉnh hình học
 * và đóng gói thành THREE.SkinnedMesh hoàn chỉnh
 */
export function rigGeometryToSkinnedMesh(
  geometry: THREE.BufferGeometry,
  boneDefs: BoneDefinition[] = STANDARD_HUMANOID_BONES,
  material: THREE.Material | THREE.Material[] = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.65,
    metalness: 0.1,
  }),
  customSockets: AttachmentSocket[] = STANDARD_SOCKETS
): {
  skinnedMesh: THREE.SkinnedMesh;
  rootBone: THREE.Bone;
  skeleton: THREE.Skeleton;
  boneMap: Map<string, THREE.Bone>;
} {
  const posAttr = geometry.getAttribute('position');
  const numVertices = posAttr.count;

  // 1. Khởi tạo Three.js Bone objects theo cấu trúc phân cấp cây
  const boneMap = new Map<string, THREE.Bone>();
  const bonesArray: THREE.Bone[] = [];
  let rootBone: THREE.Bone | null = null;

  for (const def of boneDefs) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    boneMap.set(def.name, bone);
    bonesArray.push(bone);
  }

  // Thiết lập cha - con và vị trí tương đối
  for (const def of boneDefs) {
    const bone = boneMap.get(def.name)!;
    if (def.parentName) {
      const parentBone = boneMap.get(def.parentName);
      if (parentBone) {
        parentBone.add(bone);
        // Tọa độ tương đối so với cha
        const parentDef = boneDefs.find((b) => b.name === def.parentName)!;
        bone.position.set(
          def.head[0] - parentDef.head[0],
          def.head[1] - parentDef.head[1],
          def.head[2] - parentDef.head[2]
        );
      }
    } else {
      rootBone = bone;
      bone.position.set(def.head[0], def.head[1], def.head[2]);
    }
  }

  if (!rootBone) {
    rootBone = bonesArray[0];
  }

  // 2. Tính toán trọng số da cho từng đỉnh
  const skinIndices = new Uint16Array(numVertices * 4);
  const skinWeights = new Float32Array(numVertices * 4);
  const regionAttr = geometry.getAttribute('regionId') ?? geometry.getAttribute('_regionid');
  const isAvatarRig = boneMap.has(BONE_NAMES.SLEEVE_L) && boneMap.has(BONE_NAMES.SLEEVE_R);

  for (let v = 0; v < numVertices; v++) {
    const p: Vec3 = [posAttr.getX(v), posAttr.getY(v), posAttr.getZ(v)];

    const influences: { index: number; weight: number }[] = [];
    let fixedWeights: Record<string, number> | undefined;
    if (isAvatarRig && regionAttr) {
      const region = regionAttr.getX(v);
      const side = p[0] < 0 ? 'L' : 'R';
      const absX = Math.abs(p[0]);
      const y = p[1];
      const smooth = THREE.MathUtils.smoothstep;
      fixedWeights = {};
      const add = (name: string, weight: number) => {
        if (weight > 0) fixedWeights![name] = (fixedWeights![name] ?? 0) + weight;
      };

      // A sleeve is connected to the torso: its influence must fade through
      // that join, rather than changing candidates abruptly at a material edge.
      const outerArm = smooth(absX, 0.12, 0.32);
      let armBlend = outerArm * smooth(y, 0.78, 1.05);
      if (region === MATERIAL_SLOTS.SKIN) {
        // Exposed palms continue the lower-arm weights below the sleeve cuff.
        const palm = smooth(absX, 0.18, 0.24) * (1 - smooth(y, 1.10, 1.25)) * smooth(y, 0.50, 0.65);
        armBlend = Math.max(armBlend, palm);
      }
      armBlend *= 1 - smooth(y, 1.42, 1.52);

      const hipToSpine = smooth(y, 0.98, 1.18);
      const spineToChest = smooth(y, 1.18, 1.37);
      const chestToNeck = smooth(y, 1.40, 1.49);
      const neckToHead = smooth(y, 1.49, 1.555);
      const body = 1 - armBlend;
      const thighs = 0.25 * smooth(y, 0.34, 0.45) * (1 - smooth(y, 0.45, 0.78));
      add('Hips', body * (1 - hipToSpine) * (1 - thighs));
      add('UpperLeg_L', body * (1 - hipToSpine) * thighs / 2);
      add('UpperLeg_R', body * (1 - hipToSpine) * thighs / 2);
      add('Spine', body * hipToSpine * (1 - spineToChest));
      add('Chest', body * spineToChest * (1 - chestToNeck));
      add('Neck', body * chestToNeck * (1 - neckToHead));
      add('Head', body * neckToHead);

      const upperArm = smooth(y, 1.03, 1.27);
      const hand = 1 - smooth(y, 0.79, 0.94);
      add(`UpperArm_${side}`, armBlend * upperArm);
      add(`LowerArm_${side}`, armBlend * (1 - upperArm) * (1 - hand));
      add(`Hand_${side}`, armBlend * (1 - upperArm) * hand);

      if (y < 0.34) {
        // Fade through the robe's bottom cap into the ankles spatially. A skin
        // versus cloth switch here would tear that shared ring while walking.
        const ankleDistance = Math.hypot(absX - 0.14, p[2] - 0.015);
        const legBlend = (1 - smooth(y, 0.14, 0.34)) * (1 - smooth(ankleDistance, 0.10, 0.40));
        for (const name of Object.keys(fixedWeights)) fixedWeights[name] *= 1 - legBlend;
        const right = smooth(p[0], -0.15, 0.15);
        add('Foot_L', legBlend * (1 - right));
        add('Foot_R', legBlend * right);
      }
    }

    for (let b = 0; b < boneDefs.length; b++) {
      const def = boneDefs[b];
      if (fixedWeights) {
        if (fixedWeights[def.name] > 0) influences.push({ index: b, weight: fixedWeights[def.name] });
        continue;
      }
      const dist = distanceToSegment(p, def.head, def.tail);
      const radius = def.radius;
      const priority = def.weightPriority ?? 1.0;

      // Hàm suy giảm theo khoảng cách (Inverse distance squared with priority)
      const normDist = Math.max(0.001, dist / radius);
      const rawWeight = (1.0 / Math.pow(normDist, 3.2)) * priority;

      influences.push({ index: b, weight: rawWeight });
    }

    // Sắp xếp lấy 4 xương có sức ảnh hưởng mạnh nhất
    influences.sort((a, b) => b.weight - a.weight);
    const top4 = influences.slice(0, 4);

    const sum = top4.reduce((acc, cur) => acc + cur.weight, 0) || 1.0;

    for (let i = 0; i < 4; i++) {
      skinIndices[v * 4 + i] = top4[i]?.index ?? 0;
      skinWeights[v * 4 + i] = (top4[i]?.weight ?? 0) / sum;
    }
  }

  if (isAvatarRig && regionAttr) relaxAvatarSkinWeights(geometry, boneDefs.length, skinIndices, skinWeights);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // 3. Tạo SkinnedMesh và Skeleton
  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  const skeleton = new THREE.Skeleton(bonesArray);

  skinnedMesh.add(rootBone);
  skinnedMesh.bind(skeleton);

  // 4. Thêm các Object3D Socket neo vào xương tương ứng
  for (const socketDef of customSockets) {
    const targetBone = boneMap.get(socketDef.boneName) || rootBone;
    if (targetBone) {
      const socketObj = new THREE.Object3D();
      socketObj.name = socketDef.name;
      socketObj.position.set(
        socketDef.offset[0],
        socketDef.offset[1],
        socketDef.offset[2]
      );
      if (socketDef.rotation) {
        socketObj.rotation.set(
          socketDef.rotation[0],
          socketDef.rotation[1],
          socketDef.rotation[2]
        );
      }
      targetBone.add(socketObj);
    }
  }

  return { skinnedMesh, rootBone, skeleton, boneMap };
}
