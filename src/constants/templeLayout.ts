import type {
  CollisionObstacle,
  InteractionZoneConfig,
  InteractionZoneId,
  RectXZ,
  RobeColorOption,
  Vector3Tuple,
  WalkableArea,
  WorldBounds,
} from '../types/game';

/**
 * ============================================================================
 * QUY HOẠCH ĐẠI QUẦN THỂ CHÙA THANH TỊNH (Phase 7 – Expanded Masterplan 96m × 92m)
 * ----------------------------------------------------------------------------
 * Hệ trục: +Z hướng ra Cổng Tam Quan / Hồ Phóng Sinh (phía trước),
 *          -Z hướng vào Đại Hùng Bảo Điện / Hậu Viện (phía sau).
 *          +X bên phải (Đông – Lầu Chuông, Bảo Tháp), -X bên trái (Tây – Lầu Trống, Đài Quan Âm).
 *
 * Bố cục "Tiền Phật Hậu Tổ – Tả Chung Hữu Khánh":
 *   z  +32 → +49 : Khu ngoại vi – Quảng trường, Hồ Phóng Sinh & Cầu Đá Bán Nguyệt
 *   z  +24       : Đại Cổng Tam Quan + Tường bao mặt tiền
 *   z  -5  → +24 : Đại sân Bái Đường – Bồ Đề, Lư Hương, Lầu Chuông/Trống, Quan Âm, Bảo Tháp
 *   z  -20 → -6  : Đại Hùng Bảo Điện + Hành lang Tả/Hữu Vu
 *   z  -40 → -20 : Hậu Viện – Vườn Thiền, Bàn Trà, Non Bộ, Nhà Tổ, Rừng Trúc
 *
 * MỌI component 3D phải dựng công trình đúng tọa độ trong `TEMPLE_LANDMARKS`
 * để khớp với hệ thống va chạm `COLLISION_OBSTACLES` bên dưới.
 * ============================================================================
 */

/**
 * Vị trí xuất hiện mặc định của Chú Tiểu (Quảng trường ngoại vi, trước Cầu Đá Bán Nguyệt).
 */
export const SPAWN_POINT: Vector3Tuple = { x: 0, y: 0, z: 46 };

/**
 * Hướng xoay mặc định khi xuất hiện (nhìn về phía Chánh Điện, trục -Z).
 */
export const SPAWN_ROTATION_Y = Math.PI;

/**
 * Giới hạn di chuyển trong khuôn viên chùa (mở rộng từ 44m × 40m lên ~90m × 88m).
 */
export const WORLD_BOUNDS: WorldBounds = {
  minX: -45,
  maxX: 45,
  minZ: -39,
  maxZ: 49,
};

/**
 * Kích thước mặt đất tổng thể cần phủ (lớn hơn WORLD_BOUNDS để không lộ mép bản đồ).
 */
export const GROUND_EXTENT = {
  width: 220,
  depth: 220,
  centerX: 0,
  centerZ: 5,
};

/**
 * Tốc độ di chuyển của nhân vật Chú Tiểu (m/s) – tăng nhẹ cho bản đồ lớn.
 */
export const PLAYER_MOVEMENT_SPEED = 6.5;

/**
 * Bán kính va chạm của nhân vật Chú Tiểu (mét).
 */
export const PLAYER_COLLISION_RADIUS = 0.35;

/**
 * Hệ số nội suy góc xoay nhân vật khi đổi hướng di chuyển.
 */
export const PLAYER_ROTATION_LERP = 0.15;

/**
 * Thông số mặc định của Camera 3D xoay quanh nhân vật.
 */
export const CAMERA_DEFAULTS = {
  yaw: 0,
  pitch: 0.42,
  distance: 8,
  minDistance: 3.5,
  maxDistance: 18,
  heightOffset: 1.6,
};

/**
 * Danh sách 5 lựa chọn màu áo cà sa dành cho Chú Tiểu.
 */
export const ROBE_COLOR_OPTIONS: RobeColorOption[] = [
  {
    id: 'saffron',
    name: 'Vàng Từ Bi',
    color: '#d97706',
    description: 'Sắc vàng ấm áp biểu trưng cho lòng từ bi, trí tuệ và ánh sáng giác ngộ.',
  },
  {
    id: 'crimson',
    name: 'Đỏ Hồng Phúc',
    color: '#991b1b',
    description: 'Sắc đỏ trầm mặc mang năng lượng bình an, may mắn và phúc lành đầu năm.',
  },
  {
    id: 'earth_brown',
    name: 'Nâu Thiền Định',
    color: '#78350f',
    description: 'Màu nâu đất mộc mạc gắn liền với sự tĩnh tại, khiêm cung và đời sống thiền môn.',
  },
  {
    id: 'ash_gray',
    name: 'Xám Khất Thực',
    color: '#4b5563',
    description: 'Sắc xám giản dị nhắc nhở tâm buông xả, an nhiên tự tại giữa dòng đời.',
  },
  {
    id: 'serenity_blue',
    name: 'Xanh Thanh Tịnh',
    color: '#1e3a8a',
    description: 'Sắc xanh sâu lắng như mặt hồ phẳng lặng, nuôi dưỡng chánh niệm và sự thanh tịnh.',
  },
];

/**
 * Các đoạn Cầu Cửu Khúc (zigzag) bằng gỗ sơn đỏ nối bờ Đông hồ Quan Âm ra đảo giữa hồ.
 * Component 3D dựng mặt cầu + lan can đúng theo các hình chữ nhật này.
 */
export const NINE_TURN_BRIDGE_SEGMENTS: RectXZ[] = [
  { minX: -20.6, maxX: -17.6, minZ: 10.4, maxZ: 12.2 },
  { minX: -20.6, maxX: -18.8, minZ: 7.8, maxZ: 12.2 },
  { minX: -22.4, maxX: -18.8, minZ: 7.8, maxZ: 9.6 },
  { minX: -22.4, maxX: -20.6, minZ: 7.8, maxZ: 11.2 },
  { minX: -24.4, maxX: -20.6, minZ: 9.4, maxZ: 11.2 },
];

/** Small courtyard basins; the west basin was removed to open the Quan Am approach. */
export const COURTYARD_LOTUS_PONDS = [
  { id: 'courtyard-lotus-east', x: 13, z: 12, outerRadius: 3.85, innerRadius: 3.45, collisionRadius: 4 },
] as const;

/**
 * Tọa độ & kích thước chuẩn của toàn bộ công trình kiến trúc trong chùa.
 * Đây là "bản vẽ quy hoạch" duy nhất mà các Agent 3D phải tuân thủ.
 */
export const TEMPLE_LANDMARKS = {
  /** Quảng trường lát đá ngoại vi nơi Chú Tiểu xuất hiện */
  outerPlaza: { x: 0, z: 45.5, width: 30, depth: 7 },

  /** Hồ Phóng Sinh ngoại vi (chữ nhật bo góc) */
  releasePond: { minX: -24, maxX: 24, minZ: 32, maxZ: 41, waterY: 0.12 },

  /** Cầu Đá Bán Nguyệt vòm cong bắc qua Hồ Phóng Sinh (dọc trục Z) */
  moonBridge: { minX: -2, maxX: 2, minZ: 31.2, maxZ: 41.8, archHeight: 1.1 },

  /** Đôi Sư Tử / Nghê đá hộ pháp hai bên lối vào */
  guardianLions: [
    { x: -4.5, z: 28.5 },
    { x: 4.5, z: 28.5 },
  ],

  /** Đại Cổng Tam Quan 3 tầng mái */
  tamQuanGate: {
    x: 0,
    z: 24,
    width: 18,
    depth: 3,
    pillarXs: [-7.5, -3, 3, 7.5],
    pillarRadius: 0.5,
  },

  /** Tường bao quanh chùa (cao ~2.6m, mái ngói đỏ) */
  perimeterWalls: {
    frontZ: 24,
    gateGapHalfWidth: 9,
    sideX: 46,
    backZ: -40,
    thickness: 0.8,
    height: 2.6,
  },

  /** Trục Thần Đạo lát đá xanh từ Cổng Tam Quan tới Chánh Điện */
  sacredPath: { x: 0, width: 4.2, fromZ: 23, toZ: -5.5 },

  /** Sân gạch Bát Tràng trung tâm */
  centralCourtyard: { minX: -16, maxX: 16, minZ: -6, maxZ: 22 },

  /** Cội Bồ Đề cổ thụ */
  bodhiTree: { x: 0, z: 10, planterRadius: 2.6 },

  /** Đỉnh Lư Hương đồng lớn trước Chánh Điện */
  mainIncenseBurner: { x: 0, z: -4, radius: 1.2 },

  /** Lầu Chuông Đại Hồng Chung (phía Đông) */
  bellTower: { x: 12, z: 3, size: 4.6 },

  /** Lầu Trống Bát Nhã (phía Tây, đối xứng Lầu Chuông) */
  drumTower: { x: -12, z: 3, size: 4.6 },

  /** Quầy Xin Xăm */
  fortuneStall: { x: -9, z: 14, width: 3.4, depth: 2.2 },

  /** Bàn Mõ Tụng Kinh */
  woodenFishStation: { x: -6, z: -1, width: 2, depth: 1.2 },

  /** Đại Hùng Bảo Điện (footprint gồm cả nền tam cấp) */
  mainSanctuary: {
    minX: -11,
    maxX: 11,
    minZ: -20,
    maxZ: -6,
    centerX: 0,
    centerZ: -13,
    /** Cao độ mặt nền đá Chánh Điện */
    platformHeight: 1.2,
  },

  /** Hành lang Tả Vu / Hữu Vu có mái che (18 vị La Hán) */
  sideCorridors: [
    { side: 'west' as const, minX: -19.6, maxX: -15, minZ: -19, maxZ: -3 },
    { side: 'east' as const, minX: 15, maxX: 19.6, minZ: -19, maxZ: -3 },
  ],

  /** Hồ Sen lớn + Đài Quan Âm Nam Hải trên đảo giữa hồ (Tây Uyển) */
  quanAmPond: {
    x: -27,
    z: 10,
    radius: 9,
    islandRadius: 3.2,
    statueRadius: 1.3,
    waterY: 0.12,
    deckY: 0.35,
  },

  /** Bảo Tháp Xá Lợi 7 tầng (Đông Uyển) + Vườn Lộc Uyển */
  stupa: { x: 27, z: 10, baseRadius: 4.2, height: 22, stories: 7 },

  /** Vườn Thiền Hậu Viện */
  zenGarden: {
    teaTable: { x: 0, z: -28, radius: 1 },
    sandGarden: { minX: -12, maxX: -3, minZ: -36, maxZ: -24 },
    zenRocks: [
      { x: -8.5, z: -31, radius: 1.2 },
      { x: -5.2, z: -27.5, radius: 0.7 },
      { x: -6, z: -34, radius: 0.9 },
    ],
    rockWaterfall: { x: 10, z: -30, radius: 3.2 },
  },

  /** Nhà Tổ (Tổ Đường) cuối hậu viện */
  ancestorHall: { minX: -9, maxX: 9, minZ: -39.5, maxZ: -34 },

  /** Rừng trúc cổ hai góc hậu viện (dùng InstancedMesh) */
  bambooGroves: [
    { minX: -45, maxX: -36, minZ: -39, maxZ: -22 },
    { minX: 36, maxX: 45, minZ: -39, maxZ: -22 },
  ] as RectXZ[],

  /** Tùng La Hán / Thông cổ thụ (có va chạm thân cây) */
  ancientPines: [
    { x: -14, z: 46 },
    { x: 14, z: 46 },
    { x: -30, z: 45 },
    { x: 30, z: 45 },
    { x: -38, z: 30 },
    { x: 38, z: 30 },
    { x: -11, z: 28 },
    { x: 11, z: 28 },
    { x: -38, z: -8 },
    { x: 38, z: -8 },
    { x: -30, z: -16 },
    { x: 30, z: -16 },
  ],
} as const;

/** Existing visible front steps; only their exposed footprint gains foot height.
 * The sanctuary remains blocked by the original solid collision boundary. */
export const SANCTUARY_FRONT_STEPS = [
  { step: 1, y: 0.18, z: -5.25, depth: 1.5, width: 5.4 },
  { step: 2, y: 0.54, z: -5.55, depth: 1.0, width: 5.2 },
  { step: 3, y: 0.9, z: -5.85, depth: 0.55, width: 5.0 },
] as const;

/** Avatar Y is the exact top of the walking surface, never the slab centre.
 * The render mesh uses these same linear spans, including the two approaches. */
export const MOON_BRIDGE_PROFILE = (() => {
  const bridge = TEMPLE_LANDMARKS.moonBridge;
  const profile = [{ z: bridge.minZ - 1.2, y: 0 }];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    profile.push({ z: bridge.minZ + t * (bridge.maxZ - bridge.minZ),
      y: 0.3 + 4 * t * (1 - t) * bridge.archHeight });
  }
  profile.push({ z: bridge.maxZ + 1.2, y: 0 });
  return profile;
})();

export function getMoonBridgeHeight(z: number): number {
  for (let i = 1; i < MOON_BRIDGE_PROFILE.length; i++) {
    const a = MOON_BRIDGE_PROFILE[i - 1];
    const b = MOON_BRIDGE_PROFILE[i];
    if (z >= a.z && z <= b.z) return a.y + (b.y - a.y) * (z - a.z) / (b.z - a.z);
  }
  return 0;
}

/** The east end of the first zigzag span slopes down onto the bank. */
export function getNineTurnBridgeHeight(x: number, _z: number): number {
  return TEMPLE_LANDMARKS.quanAmPond.deckY * Math.min(1, Math.max(0, (-17.6 - x) / 1.2));
}

/**
 * Bản đồ cấu hình chi tiết 8 khu vực tương tác tâm linh trong khuôn viên chùa.
 */
export const INTERACTION_ZONES: Record<InteractionZoneId, InteractionZoneConfig> = {
  incense_altar: {
    id: 'incense_altar',
    name: 'Lư Hương Chánh Điện',
    subtitle: 'Tam Bảo Điện Trang Nghiêm',
    description: 'Nơi dâng nén tâm hương lên Đức Phật và gửi lời cầu nguyện bình an cho gia đạo.',
    actionLabel: 'Thắp Hương & Lễ Phật',
    position: { x: 0, y: 0, z: -4 },
    radius: 3.0,
    meritReward: 10,
    highlightColor: '#f59e0b',
    approachPoint: { x: 0, y: 0, z: -1.4 },
    approachRotationY: Math.PI,
  },
  wooden_fish: {
    id: 'wooden_fish',
    name: 'Bàn Mõ Tụng Kinh',
    subtitle: 'Tịnh Tâm Niệm Phật',
    description: 'Gõ nhịp mõ đều đặn giúp lắng đọng tâm tư, gieo duyên lành và tích lũy công đức.',
    actionLabel: 'Gõ Mõ Tụng Kinh',
    position: { x: -6, y: 0, z: -1 },
    radius: 2.8,
    meritReward: 1,
    highlightColor: '#fbbf24',
    approachPoint: { x: -6, y: 0, z: 0.7 },
    approachRotationY: Math.PI,
  },
  temple_bell: {
    id: 'temple_bell',
    name: 'Lầu Chuông Đại Hồng Chung',
    subtitle: 'Tiếng Chuông Tỉnh Thức',
    description: 'Thỉnh tiếng chuông chùa ngân vang khắp không gian, xua tan phiền não và đem lại an lạc.',
    actionLabel: 'Thỉnh Chuông Chùa',
    position: { x: 12, y: 0, z: 3 },
    radius: 3.6,
    meritReward: 5,
    highlightColor: '#eab308',
    approachPoint: { x: 12, y: 0, z: 5.9 },
    approachRotationY: Math.PI,
  },
  fortune_stall: {
    id: 'fortune_stall',
    name: 'Quầy Xin Xăm Đầu Năm',
    subtitle: 'Quẻ Thẻ Cát Tường',
    description: 'Lắc ống xăm cầu quẻ đầu năm để đón nhận lời thơ kệ và lời khuyên hướng thiện.',
    actionLabel: 'Gieo Quẻ Xin Xăm',
    position: { x: -9, y: 0, z: 14 },
    radius: 3.0,
    meritReward: 2,
    highlightColor: '#ef4444',
    approachPoint: { x: -9, y: 0, z: 16 },
    approachRotationY: Math.PI,
  },
  bodhi_tree: {
    id: 'bodhi_tree',
    name: 'Cây Bồ Đề Nguyện Ước',
    subtitle: 'Cội Bồ Đề Cổ Thụ',
    description: 'Treo thẻ nguyện ước đỏ lên cành Bồ Đề và lắng nghe lời chúc lành từ thập phương.',
    actionLabel: 'Treo Thẻ Nguyện Ước',
    position: { x: 0, y: 0, z: 10 },
    radius: 3.8,
    meritReward: 5,
    highlightColor: '#10b981',
    approachPoint: { x: 0, y: 0, z: 13.2 },
    approachRotationY: Math.PI,
  },
  avalokitesvara_pavilion: {
    id: 'avalokitesvara_pavilion',
    name: 'Đài Quan Âm Nam Hải',
    subtitle: 'Đảo Sen Giữa Hồ – Cầu Cửu Khúc',
    description:
      'Băng qua Cầu Cửu Khúc ra đảo sen giữa hồ, chắp tay lễ Bồ Tát Quán Thế Âm cầu bình an và lòng từ bi.',
    actionLabel: 'Lễ Bái Quan Âm',
    position: { x: -24.6, y: 0, z: 10 },
    radius: 2.2,
    meritReward: 8,
    highlightColor: '#38bdf8',
    approachPoint: { x: -24.2, y: 0.35, z: 10 },
    approachRotationY: -Math.PI / 2,
  },
  seven_story_stupa: {
    id: 'seven_story_stupa',
    name: 'Bảo Tháp Xá Lợi 7 Tầng',
    subtitle: 'Tháp Báo Ân – Vườn Lộc Uyển',
    description:
      'Đi nhiễu quanh Bảo Tháp Xá Lợi theo chiều kim đồng hồ, niệm Phật và hồi hướng công đức cho muôn loài.',
    actionLabel: 'Đi Nhiễu Tháp',
    position: { x: 27, y: 0, z: 16 },
    radius: 3.0,
    meritReward: 6,
    highlightColor: '#a78bfa',
    approachPoint: { x: 27, y: 0, z: 16.5 },
    approachRotationY: Math.PI,
  },
  zen_tea_garden: {
    id: 'zen_tea_garden',
    name: 'Vườn Thiền & Bàn Trà',
    subtitle: 'Hậu Viện Tĩnh Tâm',
    description:
      'Ngồi thiền bên vườn đá khô và thác non bộ, thưởng một chén trà sen, lắng nghe tiếng trúc reo.',
    actionLabel: 'Ngồi Thiền Thưởng Trà',
    position: { x: 0, y: 0, z: -28 },
    radius: 3.0,
    meritReward: 4,
    highlightColor: '#84cc16',
    approachPoint: { x: 0, y: 0, z: -25.8 },
    approachRotationY: Math.PI,
  },
};

/**
 * Danh sách mảng các khu vực tương tác để thuận tiện duyệt và hiển thị.
 */
export const INTERACTION_ZONE_LIST: InteractionZoneConfig[] = [
  INTERACTION_ZONES.incense_altar,
  INTERACTION_ZONES.wooden_fish,
  INTERACTION_ZONES.temple_bell,
  INTERACTION_ZONES.fortune_stall,
  INTERACTION_ZONES.bodhi_tree,
  INTERACTION_ZONES.avalokitesvara_pavilion,
  INTERACTION_ZONES.seven_story_stupa,
  INTERACTION_ZONES.zen_tea_garden,
];

/**
 * Tìm khu vực tương tác gần nhất nằm trong bán kính kích hoạt tính từ vị trí hiện tại của Chú Tiểu.
 * Khoảng cách được tính trên mặt phẳng ngang 2D (trục X và Z).
 */
export function findNearestInteractionZone(
  position: Vector3Tuple
): InteractionZoneConfig | null {
  let nearestZone: InteractionZoneConfig | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const zone of INTERACTION_ZONE_LIST) {
    const dx = position.x - zone.position.x;
    const dz = position.z - zone.position.z;
    const distance = Math.hypot(dx, dz);

    if (distance <= zone.radius && distance < minDistance) {
      minDistance = distance;
      nearestZone = zone;
    }
  }

  return nearestZone;
}

/**
 * ============================================================================
 * HỆ THỐNG VA CHẠM (Collision) – khớp 1:1 với TEMPLE_LANDMARKS
 * ============================================================================
 */

const L = TEMPLE_LANDMARKS;
const W = L.perimeterWalls;

function rectObstacle(
  id: string,
  kind: 'solid' | 'water',
  r: RectXZ
): CollisionObstacle {
  return { id, kind, shape: 'rect', ...r };
}

function circleObstacle(
  id: string,
  kind: 'solid' | 'water',
  x: number,
  z: number,
  radius: number
): CollisionObstacle {
  return { id, kind, shape: 'circle', x, z, radius };
}

function centeredRect(x: number, z: number, width: number, depth: number): RectXZ {
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2,
  };
}

/**
 * Danh sách vật cản va chạm toàn bản đồ.
 */
export const COLLISION_OBSTACLES: CollisionObstacle[] = [
  // --- Tường bao ---
  rectObstacle('wall-front-west', 'solid', {
    minX: -W.sideX,
    maxX: -W.gateGapHalfWidth,
    minZ: W.frontZ - W.thickness / 2,
    maxZ: W.frontZ + W.thickness / 2,
  }),
  rectObstacle('wall-front-east', 'solid', {
    minX: W.gateGapHalfWidth,
    maxX: W.sideX,
    minZ: W.frontZ - W.thickness / 2,
    maxZ: W.frontZ + W.thickness / 2,
  }),

  // --- Cột Cổng Tam Quan ---
  ...L.tamQuanGate.pillarXs.map((px, idx) =>
    circleObstacle(`gate-pillar-${idx}`, 'solid', px, L.tamQuanGate.z, L.tamQuanGate.pillarRadius)
  ),

  // --- Hồ Phóng Sinh (mặt nước, Cầu Bán Nguyệt là vùng đi bộ) ---
  rectObstacle('release-pond', 'water', {
    minX: L.releasePond.minX,
    maxX: L.releasePond.maxX,
    minZ: L.releasePond.minZ,
    maxZ: L.releasePond.maxZ,
  }),

  // --- Sư tử đá ---
  ...L.guardianLions.map((lion, idx) =>
    circleObstacle(`guardian-lion-${idx}`, 'solid', lion.x, lion.z, 0.9)
  ),

  // --- Tùng cổ thụ ---
  ...L.ancientPines.map((pine, idx) =>
    circleObstacle(`ancient-pine-${idx}`, 'solid', pine.x, pine.z, 0.6)
  ),

  // --- Sân trung tâm ---
  ...COURTYARD_LOTUS_PONDS.map(pond =>
    circleObstacle(pond.id, 'solid', pond.x, pond.z, pond.collisionRadius)
  ),
  circleObstacle('bodhi-planter', 'solid', L.bodhiTree.x, L.bodhiTree.z, L.bodhiTree.planterRadius),
  circleObstacle(
    'main-incense-burner',
    'solid',
    L.mainIncenseBurner.x,
    L.mainIncenseBurner.z,
    L.mainIncenseBurner.radius
  ),
  rectObstacle(
    'bell-tower',
    'solid',
    centeredRect(L.bellTower.x, L.bellTower.z, L.bellTower.size, L.bellTower.size)
  ),
  rectObstacle(
    'drum-tower',
    'solid',
    centeredRect(L.drumTower.x, L.drumTower.z, L.drumTower.size, L.drumTower.size)
  ),
  rectObstacle(
    'fortune-stall',
    'solid',
    centeredRect(L.fortuneStall.x, L.fortuneStall.z, L.fortuneStall.width, L.fortuneStall.depth)
  ),
  rectObstacle(
    'wooden-fish-station',
    'solid',
    centeredRect(
      L.woodenFishStation.x,
      L.woodenFishStation.z,
      L.woodenFishStation.width,
      L.woodenFishStation.depth
    )
  ),

  // --- Đại Hùng Bảo Điện ---
  rectObstacle('main-sanctuary', 'solid', {
    minX: L.mainSanctuary.minX,
    maxX: L.mainSanctuary.maxX,
    minZ: L.mainSanctuary.minZ,
    maxZ: L.mainSanctuary.maxZ,
  }),

  // --- Tường hậu của Hành lang Tả/Hữu Vu (phía ngoài) ---
  rectObstacle('corridor-west-backwall', 'solid', {
    minX: -19.6,
    maxX: -19.0,
    minZ: -19,
    maxZ: -3,
  }),
  rectObstacle('corridor-east-backwall', 'solid', {
    minX: 19.0,
    maxX: 19.6,
    minZ: -19,
    maxZ: -3,
  }),

  // --- Hồ Quan Âm (mặt nước) + Tượng Quan Âm ---
  circleObstacle('quan-am-pond', 'water', L.quanAmPond.x, L.quanAmPond.z, L.quanAmPond.radius),
  circleObstacle(
    'quan-am-statue',
    'solid',
    L.quanAmPond.x,
    L.quanAmPond.z,
    L.quanAmPond.statueRadius
  ),

  // --- Bảo Tháp 7 tầng ---
  circleObstacle('seven-story-stupa', 'solid', L.stupa.x, L.stupa.z, L.stupa.baseRadius),

  // --- Hậu viện ---
  circleObstacle(
    'zen-tea-table',
    'solid',
    L.zenGarden.teaTable.x,
    L.zenGarden.teaTable.z,
    L.zenGarden.teaTable.radius
  ),
  ...L.zenGarden.zenRocks.map((rock, idx) =>
    circleObstacle(`zen-rock-${idx}`, 'solid', rock.x, rock.z, rock.radius)
  ),
  circleObstacle(
    'rock-waterfall',
    'solid',
    L.zenGarden.rockWaterfall.x,
    L.zenGarden.rockWaterfall.z,
    L.zenGarden.rockWaterfall.radius
  ),
  rectObstacle('ancestor-hall', 'solid', L.ancestorHall),
  ...L.bambooGroves.map((grove, idx) => rectObstacle(`bamboo-grove-${idx}`, 'solid', grove)),
];

/**
 * Vùng đi bộ được phép đè lên mặt nước (cầu & đảo).
 */
export const WALKABLE_AREAS: WalkableArea[] = [
  {
    id: 'moon-bridge',
    shape: 'rect',
    minX: L.moonBridge.minX,
    maxX: L.moonBridge.maxX,
    minZ: L.moonBridge.minZ,
    maxZ: L.moonBridge.maxZ,
  },
  {
    id: 'quan-am-island',
    shape: 'circle',
    x: L.quanAmPond.x,
    z: L.quanAmPond.z,
    radius: L.quanAmPond.islandRadius,
  },
  ...NINE_TURN_BRIDGE_SEGMENTS.map(
    (seg, idx): WalkableArea => ({ id: `nine-turn-bridge-${idx}`, shape: 'rect', ...seg })
  ),
];

function isInsideRect(x: number, z: number, r: RectXZ, inflate = 0): boolean {
  const epsilon = 1e-5; // Float32 render vertices must agree at shared surface edges.
  return (
    x >= r.minX - inflate - epsilon &&
    x <= r.maxX + inflate + epsilon &&
    z >= r.minZ - inflate - epsilon &&
    z <= r.maxZ + inflate + epsilon
  );
}

function isInsideObstacle(x: number, z: number, o: CollisionObstacle, inflate: number): boolean {
  if (o.shape === 'circle') {
    const r = o.radius + inflate;
    const dx = x - o.x;
    const dz = z - o.z;
    return dx * dx + dz * dz <= r * r;
  }
  return isInsideRect(x, z, o, inflate);
}

function isOnWalkableArea(x: number, z: number): boolean {
  for (const area of WALKABLE_AREAS) {
    if (area.shape === 'circle') {
      const dx = x - area.x;
      const dz = z - area.z;
      if (dx * dx + dz * dz <= area.radius * area.radius) return true;
    } else if (isInsideRect(x, z, area)) {
      return true;
    }
  }
  return false;
}

/**
 * Kiểm tra một điểm (x, z) có bị chặn bởi vật cản hay không.
 * - Vật cản `solid` được nới rộng theo bán kính nhân vật.
 * - Mặt nước `water` chỉ chặn tâm nhân vật và được "mở khóa" bởi `WALKABLE_AREAS`.
 */
export function isPositionBlocked(
  x: number,
  z: number,
  radius: number = PLAYER_COLLISION_RADIUS
): boolean {
  if (
    x < WORLD_BOUNDS.minX ||
    x > WORLD_BOUNDS.maxX ||
    z < WORLD_BOUNDS.minZ ||
    z > WORLD_BOUNDS.maxZ
  ) {
    return true;
  }

  let inWater = false;
  for (const o of COLLISION_OBSTACLES) {
    if (o.kind === 'solid') {
      if (isInsideObstacle(x, z, o, radius)) return true;
    } else if (!inWater && isInsideObstacle(x, z, o, 0)) {
      inWater = true;
    }
  }

  // Entry is through the low ends. Raised exposed edges cannot be climbed sideways.
  const moon = L.moonBridge;
  if (Math.abs(x) > moon.maxX && !isOnWalkableArea(x, z) && getMoonBridgeHeight(z) > 0.08 &&
      z >= moon.minZ - 1.2 && z <= moon.maxZ + 1.2 &&
      Math.abs(x) < moon.maxX + radius) return true;
  return inWater && !isOnWalkableArea(x, z);
}

/**
 * Giải quyết di chuyển có va chạm với cơ chế "trượt dọc tường":
 * thử di chuyển đầy đủ → chỉ trục X → chỉ trục Z → đứng yên.
 */
export function resolveMovement(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  radius: number = PLAYER_COLLISION_RADIUS
): { x: number; z: number } {
  const clampedX = Math.min(WORLD_BOUNDS.maxX, Math.max(WORLD_BOUNDS.minX, toX));
  const clampedZ = Math.min(WORLD_BOUNDS.maxZ, Math.max(WORLD_BOUNDS.minZ, toZ));

  // Nếu đang kẹt sẵn trong vật cản (ví dụ sau khi dịch chuyển), cho phép thoát ra tự do
  if (isPositionBlocked(fromX, fromZ, radius)) {
    return { x: clampedX, z: clampedZ };
  }

  if (!isPositionBlocked(clampedX, clampedZ, radius)) {
    return { x: clampedX, z: clampedZ };
  }
  if (!isPositionBlocked(clampedX, fromZ, radius)) {
    return { x: clampedX, z: fromZ };
  }
  if (!isPositionBlocked(fromX, clampedZ, radius)) {
    return { x: fromX, z: clampedZ };
  }
  return { x: fromX, z: fromZ };
}

/**
 * Cao độ mặt đất tại (x, z): Cầu Đá Bán Nguyệt cong vòm, Cầu Cửu Khúc & đảo Quan Âm.
 * Các vị trí khác trả về 0.
 */
export function getGroundHeight(x: number, z: number): number {
  let stepTop = 0;
  for (const step of SANCTUARY_FRONT_STEPS) {
    if (isInsideRect(x, z, { minX: -step.width / 2, maxX: step.width / 2,
      minZ: step.z - step.depth / 2, maxZ: step.z + step.depth / 2 })) {
      stepTop = Math.max(stepTop, step.y + 0.18);
    }
  }
  if (stepTop) return stepTop;
  const b = L.moonBridge;
  if (x >= b.minX && x <= b.maxX && z >= MOON_BRIDGE_PROFILE[0].z &&
      z <= MOON_BRIDGE_PROFILE[MOON_BRIDGE_PROFILE.length - 1].z) {
    return getMoonBridgeHeight(z);
  }

  const p = L.quanAmPond;
  const dx = x - p.x;
  const dz = z - p.z;
  if (dx * dx + dz * dz <= p.islandRadius * p.islandRadius) {
    return p.deckY;
  }
  for (const seg of NINE_TURN_BRIDGE_SEGMENTS) {
    if (isInsideRect(x, z, seg)) return getNineTurnBridgeHeight(x, z);
  }

  return 0;
}
