import { MATERIAL_SLOTS as M, type BoundingBox3D, type SDFFunction, type SDFResult, type Vec3 } from './types.ts';
import { opUnion, sdCapsule, sdCappedCone, sdCylinder, sdRoundedBox, sdSphere, sdTorus, translate } from './sdf.ts';
import { blend, diagonalSash, drapedCone, ellipsoid, limb, lotusPedestal, malaStrand, seatedLegs, sereneHead, shape } from './statue-shapes.ts';

export interface ArhatMetadata {
  id: string;
  index: number;
  name: string;
  vietnameseTitle: string;
  sanskritName: string;
  postureDescription: string;
  propName: string;
  isSeated: boolean;
  pedestalType: 'lotus' | 'rock' | 'water' | 'square';
}

export const ARHAT_METADATA_LIST: ArhatMetadata[] = [
  {
    id: 'arhat_01',
    index: 1,
    name: 'Hàng Long La Hán (Taming Dragon)',
    vietnameseTitle: 'Khánh Hữu Tôn Giả (Hàng Long)',
    sanskritName: 'Nantimitolo',
    postureDescription: 'Tư thế uy dũng, rồng ngậm dạ minh châu lượn quanh cánh tay',
    propName: 'Thần Long & Dạ Minh Châu',
    isSeated: false,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_02',
    index: 2,
    name: 'Phục Hổ La Hán (Taming Tiger)',
    vietnameseTitle: 'Đạt Ma Đa La Tôn Giả (Phục Hổ)',
    sanskritName: 'Dharmatrata',
    postureDescription: 'Tư thế thiền định dũng mãnh, bên cạnh hổ phục ngoan ngoãn',
    propName: 'Bạch Hổ Quy Phục',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_03',
    index: 3,
    name: 'Cử Bát La Hán (Alms Bowl)',
    vietnameseTitle: 'Ca Nặc Ca Bạt Ly Đọa Xà Tôn Giả (Cử Bát)',
    sanskritName: 'Kanaka Bharadvaja',
    postureDescription: 'Hai tay nâng bình bát trang nghiêm khất thực hoá duyên',
    propName: 'Bình Bát Như Ý',
    isSeated: true,
    pedestalType: 'lotus',
  },
  {
    id: 'arhat_04',
    index: 4,
    name: 'Trầm Tư La Hán (Thinking)',
    vietnameseTitle: 'La Hầu La Tôn Giả (Trầm Tư)',
    sanskritName: 'Rahula',
    postureDescription: 'Ngồi nghiêng đầu, tay chống cằm suy tư quán chiếu diệu đế',
    propName: 'Bàn Thạch Thiền Định',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_05',
    index: 5,
    name: 'Trường Mi La Hán (Long Eyebrows)',
    vietnameseTitle: 'A Thị Đa Tôn Giả (Trường Mi)',
    sanskritName: 'Asita',
    postureDescription: 'Hai dải lông mày dài trắng tinh buông rủ xuống tận ngực',
    propName: 'Bạch Mi Tường Vân',
    isSeated: true,
    pedestalType: 'lotus',
  },
  {
    id: 'arhat_06',
    index: 6,
    name: 'Khai Tâm La Hán (Open Heart)',
    vietnameseTitle: 'Thú Bác Ca Tôn Giả (Khai Tâm)',
    sanskritName: 'Jivaka',
    postureDescription: 'Vạch áo cà sa hé lộ hình tượng Phật ngồi tĩnh tọa nơi tâm thất',
    propName: 'Kim Thân Phật Tại Tâm',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_07',
    index: 7,
    name: 'Hoan Hỷ La Hán (Joyful)',
    vietnameseTitle: 'Ca Nặc Ca Phạt Tha Tôn Giả (Hoan Hỷ)',
    sanskritName: 'Kanakavatsa',
    postureDescription: 'Miệng cười rạng rỡ, hai tay dang rộng đón nhận niềm vui và ban phước',
    propName: 'Chuỗi Ngọc Hoan Hỷ',
    isSeated: false,
    pedestalType: 'lotus',
  },
  {
    id: 'arhat_08',
    index: 8,
    name: 'Quá Giang La Hán (River Crossing)',
    vietnameseTitle: 'Bạt Đà La Tôn Giả (Quá Giang)',
    sanskritName: 'Bhadra',
    postureDescription: 'Tay cầm gậy trúc, vạt áo bay trong gió nước lướt sóng qua sông',
    propName: 'Trượng Trúc Vượt Sóng',
    isSeated: false,
    pedestalType: 'water',
  },
  {
    id: 'arhat_09',
    index: 9,
    name: 'Phục Ma La Hán (Demon Subduing)',
    vietnameseTitle: 'Tô Tần Đà Tôn Giả (Phục Ma)',
    sanskritName: 'Subinda',
    postureDescription: 'Tay cầm chày kim cang oai linh hàng phục ma chướng',
    propName: 'Chày Kim Cang Phục Ma',
    isSeated: false,
    pedestalType: 'square',
  },
  {
    id: 'arhat_10',
    index: 10,
    name: 'Ba Tiêu La Hán (Plantain Leaf)',
    vietnameseTitle: 'Phạt Na Bà Tư Tôn Giả (Ba Tiêu)',
    sanskritName: 'Pantha the Younger',
    postureDescription: 'Ngồi tĩnh tâm thiền định dưới phiến lá chuối xanh ngát che chở',
    propName: 'Phiến Lá Ba Tiêu',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_11',
    index: 11,
    name: 'Thác Tháp La Hán (Pagoda Holding)',
    vietnameseTitle: 'Tô Pha Thoa Tôn Giả (Thác Tháp)',
    sanskritName: 'Pantha the Elder',
    postureDescription: 'Bàn tay nâng bảo tháp 7 tầng phát hào quang hộ trì Phật pháp',
    propName: 'Bảo Tháp Thất Bảo',
    isSeated: true,
    pedestalType: 'lotus',
  },
  {
    id: 'arhat_12',
    index: 12,
    name: 'Kỵ Tượng La Hán (Riding Elephant)',
    vietnameseTitle: 'Na Già Tư Na Tôn Giả (Kỵ Tượng)',
    sanskritName: 'Nagasena',
    postureDescription: 'Nét mặt từ hòa uy nghiêm, an tọa trên lưng linh tượng',
    propName: 'Bạch Tượng Cát Tường',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_13',
    index: 13,
    name: 'Tiếu Sư La Hán (Laughing Lion)',
    vietnameseTitle: 'Phạt Xà La Phất Đa La Tôn Giả (Tiếu Sư)',
    sanskritName: 'Vajraputra',
    postureDescription: 'Nụ cười hiền hậu, hai tay đùa giỡn nâng sư tử con hiền hòa',
    propName: 'Kim Sư Con',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_14',
    index: 14,
    name: 'Tịnh Tọa La Hán (Quiet Sitting)',
    vietnameseTitle: 'Nặc Cự La Tôn Giả (Tịnh Tọa)',
    sanskritName: 'Nakula',
    postureDescription: 'Ngồi kiết già trang nghiêm tuyệt đối trên phiến đá, ấn Thiền Định',
    propName: 'Bàn Thạch Thiền Định',
    isSeated: true,
    pedestalType: 'square',
  },
  {
    id: 'arhat_15',
    index: 15,
    name: 'Tọa Lộc La Hán (Deer Sitting)',
    vietnameseTitle: 'Tân Đầu Lô Phả La Đọa Tôn Giả (Tọa Lộc)',
    sanskritName: 'Pindola Bharadvaja',
    postureDescription: 'Tay tựa trượng trúc, dáng vẻ thoát tục bên cạnh nai hiền',
    propName: 'Linh Lộc Tường Thụy & Trượng',
    isSeated: true,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_16',
    index: 16,
    name: 'Khán Nang La Hán (Cloth Bag)',
    vietnameseTitle: 'Già Nhân Đề Tôn Giả (Khán Nang)',
    sanskritName: 'Angida',
    postureDescription: 'Tay vác bao đãy càn khôn chứa muôn vàn phước lộc báu vật',
    propName: 'Bao Đãy Càn Khôn',
    isSeated: false,
    pedestalType: 'rock',
  },
  {
    id: 'arhat_17',
    index: 17,
    name: 'Thám Thủ La Hán (Stretching)',
    vietnameseTitle: 'Bán Thác Ca Tôn Giả (Thám Thủ)',
    sanskritName: 'Panthaka',
    postureDescription: 'Hai tay vươn thẳng lên cao sảng khoái sau thời định thiền sâu',
    propName: 'Thủ Ấn Xuất Định',
    isSeated: true,
    pedestalType: 'lotus',
  },
  {
    id: 'arhat_18',
    index: 18,
    name: 'Bố Đại La Hán (Budai)',
    vietnameseTitle: 'Bố Đại Hòa Thượng (Di Lặc)',
    sanskritName: 'Budai / Maitreya',
    postureDescription: 'Bụng to tròn phúc hậu, nụ cười hả hê từ bi vô lượng, cầm tràng hạt',
    propName: 'Chuỗi Tràng Hạt & Túi Càn Khôn',
    isSeated: true,
    pedestalType: 'lotus',
  },
];

interface Anatomy {
  lift: number;
  shouldersY: number;
  chestY: number;
  head: Vec3;
  leftElbow: Vec3;
  leftHand: Vec3;
  rightElbow: Vec3;
  rightHand: Vec3;
}

function anatomyFor(meta: ArhatMetadata): Anatomy {
  const lift = meta.index === 12 ? 0.13 : 0;
  const sy = (meta.isSeated ? 0.98 : 1.30) + lift;
  const head: Vec3 = [0, (meta.isSeated ? 1.30 : 1.58) + lift, 0.01];
  const a: Anatomy = {
    lift, shouldersY: sy, chestY: sy - 0.11, head,
    leftElbow: [-0.30, sy - 0.18, 0.08], leftHand: [-0.10, sy - 0.29, 0.23],
    rightElbow: [0.30, sy - 0.18, 0.08], rightHand: [0.10, sy - 0.29, 0.23],
  };
  switch (meta.index) {
    case 1:
      a.rightElbow = [0.35, sy + 0.03, 0.06]; a.rightHand = [0.30, sy + 0.22, 0.17];
      a.leftHand = [-0.24, sy - 0.31, 0.14]; break;
    case 2:
      a.rightElbow = [0.33, sy - 0.22, 0.13]; a.rightHand = [0.34, sy - 0.39, 0.23]; break;
    case 3:
      a.leftHand = [-0.095, sy - 0.16, 0.27]; a.rightHand = [0.095, sy - 0.16, 0.27]; break;
    case 4:
      a.rightElbow = [0.30, sy - 0.18, 0.12]; a.rightHand = [0.075, head[1] - 0.135, 0.12];
      a.leftHand = [-0.26, sy - 0.31, 0.17]; break;
    case 6:
      a.leftHand = [-0.13, sy - 0.09, 0.18]; a.rightHand = [0.13, sy - 0.09, 0.18]; break;
    case 7:
      a.leftElbow = [-0.34, sy - 0.04, 0.04]; a.leftHand = [-0.47, sy + 0.06, 0.10];
      a.rightElbow = [0.34, sy - 0.04, 0.04]; a.rightHand = [0.47, sy + 0.06, 0.10]; break;
    case 8:
      a.rightHand = [0.31, sy - 0.15, 0.23]; a.leftHand = [-0.24, sy - 0.32, 0.10]; break;
    case 9:
      a.rightElbow = [0.34, sy + 0.02, 0.04]; a.rightHand = [0.30, sy + 0.16, 0.15];
      a.leftHand = [-0.30, sy - 0.14, 0.25]; break;
    case 11:
      a.leftHand = [-0.14, sy - 0.14, 0.28]; break;
    case 13:
      a.leftHand = [-0.12, sy - 0.23, 0.27]; a.rightHand = [0.12, sy - 0.23, 0.27]; break;
    case 14:
      a.leftHand = [-0.055, sy - 0.29, 0.24]; a.rightHand = [0.055, sy - 0.26, 0.24]; break;
    case 15:
      a.rightHand = [0.27, sy - 0.20, 0.22]; a.leftHand = [-0.26, sy - 0.30, 0.17]; break;
    case 16:
      a.leftHand = [-0.31, sy - 0.14, 0.15]; a.rightHand = [0.24, sy - 0.32, 0.10]; break;
    case 17:
      a.leftElbow = [-0.28, sy + 0.25, 0.01]; a.leftHand = [-0.22, sy + 0.57, 0.04];
      a.rightElbow = [0.28, sy + 0.25, 0.01]; a.rightHand = [0.22, sy + 0.57, 0.04]; break;
    case 18:
      a.leftHand = [-0.26, sy - 0.28, 0.20]; a.rightHand = [0.25, sy - 0.25, 0.23]; break;
  }
  return a;
}

function pedestal(p: Vec3, type: ArhatMetadata['pedestalType']): SDFResult {
  if (type === 'lotus') return lotusPedestal(p, 0.46, M.STONE);
  if (type === 'square') {
    return blend(shape(sdRoundedBox(translate(p, [0, 0.07, 0]), [0.46, 0.07, 0.40], 0.035), M.STONE),
      ellipsoid(p, [0, 0.16, 0], [0.40, 0.105, 0.35]), M.STONE, 0.04);
  }
  const wave = type === 'water' ? Math.sin(p[0] * 9 + p[2] * 5) * 0.008 : 0;
  return blend(shape(sdCappedCone(translate(p, [0, 0.065, 0]), 0.065, 0.47, 0.43) - wave, M.STONE),
    ellipsoid(p, [0, 0.16, 0], [0.41, 0.105, 0.35]), M.STONE, 0.04);
}

function animal(p: Vec3, center: Vec3, kind: 'tiger' | 'lion' | 'deer' | 'elephant'): number {
  const q = translate(p, center);
  if (kind === 'elephant') {
    let d = ellipsoid(q, [0, 0, 0], [0.32, 0.205, 0.26]);
    d = Math.min(d, ellipsoid(q, [0, 0.10, 0.23], [0.155, 0.15, 0.15]));
    for (const side of [-1, 1]) {
      d = Math.min(d, ellipsoid(q, [side * 0.16, 0.10, 0.20], [0.09, 0.13, 0.055]));
      d = Math.min(d, sdCapsule(q, [side * 0.20, -0.02, 0.12], [side * 0.20, -0.16, 0.12], 0.07));
    }
    d = Math.min(d, sdCapsule(q, [0, 0.08, 0.33], [0, -0.11, 0.40], 0.055));
    return Math.min(d, sdCapsule(q, [0, -0.11, 0.40], [0.05, -0.15, 0.43], 0.044));
  }
  const cub = kind === 'lion';
  let d = ellipsoid(q, [0, 0, 0], cub ? [0.10, 0.09, 0.11] : [0.13, 0.105, 0.205]);
  const hy = cub ? 0.09 : kind === 'deer' ? 0.20 : 0.12;
  const hz = cub ? 0.07 : 0.13;
  if (kind === 'deer') d = Math.min(d, sdCapsule(q, [0, 0.03, 0.10], [0, hy, hz], 0.047));
  d = Math.min(d, ellipsoid(q, [0, hy, hz], cub ? [0.072, 0.071, 0.068] : [0.078, 0.073, 0.08]));
  for (const side of [-1, 1]) {
    d = Math.min(d, ellipsoid(q, [side * 0.052, hy + 0.052, hz], [0.025, kind === 'deer' ? 0.052 : 0.025, 0.026]));
    if (kind === 'deer') d = Math.min(d, sdCapsule(q, [side * 0.035, hy + 0.05, hz], [side * 0.052, hy + 0.14, hz - 0.025], 0.019));
  }
  if (cub) d = Math.min(d, ellipsoid(q, [0, hy - 0.01, hz - 0.015], [0.088, 0.083, 0.07]));
  return d;
}

function props(p: Vec3, meta: ArhatMetadata, a: Anatomy): SDFResult {
  const sy = a.shouldersY;
  let result = shape(100, M.GOLD);
  const add = (distance: number, material: number = M.GOLD) => { result = blend(result, distance, material, 0.02); };
  switch (meta.index) {
    case 1: {
      // Dragon follows and touches the raised forearm; the pearl meets its muzzle.
      add(sdCapsule(p, [0.31, sy - 0.04, 0.09], [0.43, sy + 0.10, 0.04], 0.045), M.KASAYA_TRIM);
      add(sdCapsule(p, [0.43, sy + 0.10, 0.04], [0.37, sy + 0.28, 0.16], 0.042), M.KASAYA_TRIM);
      add(ellipsoid(p, [0.35, sy + 0.29, 0.20], [0.062, 0.055, 0.085]), M.KASAYA_TRIM);
      add(sdSphere(translate(p, [0.35, sy + 0.29, 0.30]), 0.038)); break;
    }
    case 2: add(animal(p, [0.33, 0.36, 0.10], 'tiger'), M.KASAYA_TRIM); break;
    case 3: {
      const q = translate(p, [0, sy - 0.12, 0.29]);
      // Solid, shallow bowl with a rolled rim; no one-cell shell that disappears in LOD1.
      add(sdCappedCone(q, 0.055, 0.072, 0.11));
      add(sdTorus(translate(q, [0, 0.055, 0]), 0.10, 0.021)); break;
    }
    case 5:
      for (const side of [-1, 1]) {
        add(sdCapsule(p, [side * 0.052, a.head[1] + 0.035, 0.135], [side * 0.105, a.head[1] - 0.10, 0.145], 0.020), M.STONE);
        add(sdCapsule(p, [side * 0.105, a.head[1] - 0.10, 0.145], [side * 0.13, sy - 0.02, 0.17], 0.019), M.STONE);
      }
      break;
    case 6:
      // Embossed heart medallion instead of a deep chest cavity.
      add(ellipsoid(p, [0, sy - 0.065, 0.175], [0.082, 0.10, 0.033]), M.KASAYA_TRIM);
      add(ellipsoid(p, [0, sy - 0.08, 0.21], [0.050, 0.043, 0.030]));
      add(sdSphere(translate(p, [0, sy - 0.015, 0.21]), 0.031)); break;
    case 7: add(malaStrand(p, [0, sy - 0.12, 0.135], 0.13), M.KASAYA_TRIM); break;
    case 8:
      add(sdCapsule(p, [0.31, 0.22, 0.23], [0.31, 1.73, 0.23], 0.028), M.KASAYA_TRIM);
      for (const y of [0.54, 0.90, 1.26, 1.61]) add(sdTorus(translate(p, [0.31, y, 0.23]), 0.029, 0.012), M.KASAYA_TRIM);
      break;
    case 9:
      add(sdCapsule(p, [0.30, sy + 0.005, 0.15], [0.30, sy + 0.32, 0.15], 0.026));
      add(ellipsoid(p, [0.30, sy + 0.30, 0.15], [0.055, 0.065, 0.055]));
      add(ellipsoid(p, [0.30, sy + 0.02, 0.15], [0.055, 0.065, 0.055])); break;
    case 10: {
      // Upright oblique plantain blade, supported along its midrib rather than a parasol disc.
      add(sdCapsule(p, [-0.28, 0.22, -0.17], [-0.27, 1.17, -0.10], 0.032), M.KASAYA_TRIM);
      add(sdCapsule(p, [-0.27, 1.17, -0.10], [-0.01, 1.82, -0.10], 0.026), M.KASAYA_TRIM);
      const q = translate(p, [-0.15, 1.48, -0.10]);
      const angle = -0.38, c = Math.cos(angle), s = Math.sin(angle);
      const leaf: Vec3 = [q[0] * c + q[1] * s, -q[0] * s + q[1] * c, q[2]];
      add(ellipsoid(leaf, [0, 0, 0], [0.16, 0.38, 0.047]), M.KASAYA_TRIM);
      add(sdCapsule(p, [-0.27, 1.17, -0.05], [-0.01, 1.82, -0.05], 0.016), M.GOLD); break;
    }
    case 11: {
      const q = translate(p, [-0.14, sy - 0.08, 0.28]);
      add(sdCylinder(q, 0.077, 0.035));
      add(sdCappedCone(translate(q, [0, 0.125, 0]), 0.125, 0.057, 0.025));
      for (let i = 0; i < 7; i++) add(sdCappedCone(translate(q, [0, 0.025 + i * 0.032, 0]), 0.014, 0.079 - i * 0.006, 0.052 - i * 0.004));
      add(sdSphere(translate(q, [0, 0.275, 0]), 0.027)); break;
    }
    case 12: add(animal(p, [0, 0.34, 0.06], 'elephant'), M.STONE); break;
    case 13: add(animal(p, [0, sy - 0.22, 0.29], 'lion'), M.KASAYA_TRIM); break;
    case 15:
      add(sdCapsule(p, [0.27, 0.23, 0.22], [0.27, 1.24, 0.22], 0.027), M.KASAYA_TRIM);
      add(animal(p, [-0.33, 0.35, 0.05], 'deer'), M.KASAYA_TRIM); break;
    case 16:
      add(ellipsoid(p, [-0.33, sy - 0.29, 0.10], [0.16, 0.19, 0.15]), M.KASAYA_TRIM);
      add(sdCapsule(p, [-0.33, sy - 0.10, 0.12], [-0.22, sy + 0.01, 0], 0.028), M.KASAYA_TRIM); break;
    case 18:
      add(malaStrand(p, [0.25, sy - 0.27, 0.25], 0.080), M.KASAYA_TRIM);
      add(ellipsoid(p, [-0.29, 0.40, -0.02], [0.15, 0.14, 0.14]), M.KASAYA_TRIM); break;
  }
  return result;
}

export interface ArhatSDFOutput {
  sdf: SDFFunction;
  bounds: BoundingBox3D;
  info: ArhatMetadata;
  /** Model-space body landmarks also used by geometry regression checks. */
  anatomicalPoints: Record<string, Vec3>;
  headScale: Vec3;
  headTilt: number;
}

export function createArhatFigureSDF(arhatIndex: number): ArhatSDFOutput {
  const meta = ARHAT_METADATA_LIST.find((m) => m.index === arhatIndex);
  if (!meta) throw new Error(`Không tìm thấy Arhat với index: ${arhatIndex}. Hợp lệ: 1 -> 18.`);
  const a = anatomyFor(meta);
  const headVariants: Vec3[] = [
    [0.95, 1.06, 0.98], [1.08, 0.98, 1.04], [1, 1, 1], [0.94, 1.06, 0.98],
    [0.92, 1.12, 0.96], [1.02, 1.02, 1.03], [1.08, 0.95, 1.04], [0.96, 1.08, 0.96],
    [1.10, 0.96, 1.02], [0.98, 1.05, 0.98], [0.94, 1.04, 0.98], [1.05, 1, 1.03],
    [1.12, 0.96, 1.08], [1, 1.04, 0.98], [0.93, 1.10, 0.95], [1.06, 0.97, 1.02],
    [0.94, 1, 0.97], [1.18, 0.94, 1.08],
  ];
  const headScale = headVariants[meta.index - 1];
  const headTilt = meta.index === 4 ? -0.10 : 0;
  const sy = a.shouldersY;
  const bounds: BoundingBox3D = { min: [-0.65, -0.055, -0.59], max: [0.65, 1.94, 0.66] };
  const leftShoulder: Vec3 = [-0.215, sy, 0];
  const rightShoulder: Vec3 = [0.215, sy, 0];
  const anatomicalPoints: Record<string, Vec3> = {
    hips: [0, (meta.isSeated ? 0.58 : 0.93) + a.lift, 0],
    chest: [0, a.chestY, 0], neck: [0, a.head[1] - 0.17, 0.01], head: a.head,
    leftShoulder, rightShoulder,
    leftElbow: a.leftElbow, rightElbow: a.rightElbow,
    leftHand: a.leftHand, rightHand: a.rightHand,
  };
  const sdf: SDFFunction = (p) => {
    let result = pedestal(p, meta.pedestalType);
    if (meta.isSeated) {
      result = blend(result, seatedLegs(p, 0.40 + a.lift).distance, M.ROBE, 0.055);
      result = blend(result, ellipsoid(p, [0, 0.58 + a.lift, 0], [0.255, 0.215, 0.18]), M.ROBE, 0.065);
    } else {
      result = blend(result, drapedCone(p, [0, 0.65, 0], 0.43, 0.285, 0.205), M.ROBE, 0.05);
      result = blend(result, ellipsoid(p, [0, 0.93, 0], [0.235, 0.215, 0.18]), M.ROBE, 0.065);
      for (const side of [-1, 1]) result = blend(result, ellipsoid(p, [side * 0.12, 0.235, 0.10], [0.08, 0.065, 0.12]), M.GOLD, 0.03);
    }
    result = blend(result, ellipsoid(p, [0, a.chestY, 0], [meta.index === 18 ? 0.27 : 0.24, 0.255, 0.18]), M.ROBE, 0.07);
    if (meta.index === 18) result = blend(result, ellipsoid(p, [0, a.chestY - 0.12, 0.105], [0.275, 0.225, 0.18]), M.GOLD, 0.05);
    result = blend(result, sdCapsule(p, [0, sy - 0.035, 0], [0, a.head[1] - 0.09, 0.01], 0.071), M.GOLD, 0.045);
    const left = limb(p, leftShoulder, a.leftElbow, a.leftHand);
    const right = limb(p, rightShoulder, a.rightElbow, a.rightHand);
    result = blend(result, left.distance, left.materialId, 0.04);
    result = blend(result, right.distance, right.materialId, 0.04);
    const head = sereneHead(p, a.head, {
      material: M.GOLD, smile: meta.index === 18 ? 1 : [7, 13].includes(meta.index) ? 0.8 : 0.25,
      cheeks: [13, 18].includes(meta.index), tilt: headTilt, proportions: headScale,
      earLength: meta.index === 5 ? 1.28 : [4, 8, 15].includes(meta.index) ? 1.12 : [2, 7, 18].includes(meta.index) ? 0.86 : 1,
    });
    result = blend(result, head.distance, head.materialId, 0.035);
    const accessories = props(p, meta, a);
    result = diagonalSash(result, p, [-0.19, sy + 0.02], [0.17, sy - 0.31]);
    return opUnion(result, accessories);
  };
  return { sdf, bounds, info: meta, anatomicalPoints, headScale, headTilt };
}
