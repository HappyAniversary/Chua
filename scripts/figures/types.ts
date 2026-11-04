/**
 * Hợp đồng dữ liệu & định nghĩa kiểu cho Xưởng Điêu Khắc (Figure Sculpting Pipeline - Phase 10)
 */

export type Vec3 = [number, number, number];

export interface BoundingBox3D {
  min: Vec3;
  max: Vec3;
}

export interface SDFResult {
  distance: number;
  materialId: number; // 0: skin, 1: robe, 2: kasaya_trim, 3: gold, 4: stone, 5: hair, 6: prop
}

export type SDFFunction = (p: Vec3) => SDFResult;

export interface MesherOptions {
  /** Độ phân giải lưới voxels trên các trục [nx, ny, nz] hoặc số nguyên chung (mặc định: 80) */
  resolution: [number, number, number] | number;
  /** Hộp bao không gian cần quét isosurface */
  bounds: BoundingBox3D;
  /** Số vòng lặp làm mịn Laplacian để làm trơn bề mặt (mặc định: 3) */
  smoothIterations?: number;
  /** Hệ số làm mịn (0.1 - 0.5, mặc định: 0.25) */
  smoothFactor?: number;
}

/**
 * Định nghĩa một xương trong bộ xương chuẩn humanoid
 */
export interface BoneDefinition {
  name: string;
  parentName: string | null;
  /** Tọa độ tuyệt đối (World Space) của đầu khớp xương */
  head: Vec3;
  /** Tọa độ tuyệt đối của đuôi khớp xương (xác định phương và chiều) */
  tail: Vec3;
  /** Bán kính viên nang tầm ảnh hưởng của xương (dùng tính trọng số da skinning) */
  radius: number;
  /** Trọng số ưu tiên (giúp xương con như ngón tay/bàn tay không bị xương cẳng tay lấn át) */
  weightPriority?: number;
}

/**
 * Điểm neo gắn đạo cụ 3D (socket)
 */
export interface AttachmentSocket {
  name: string;
  boneName: string;
  offset: Vec3;
  rotation?: Vec3;
}

/**
 * Cấu trúc một mục trong manifest.json
 */
export interface FigureManifestEntry {
  id: string;
  name: string;
  category: 'player' | 'buddha' | 'quanam' | 'arhat';
  files: {
    lod0: string;
    lod1?: string;
  };
  triangles: {
    lod0: number;
    lod1?: number;
  };
  isRigged: boolean;
  bonesCount?: number;
  sockets?: Record<string, { bone: string; position: Vec3 }>;
  materials: string[];
}

export interface FigureManifest {
  version: string;
  generatedAt: string;
  figures: Record<string, FigureManifestEntry>;
}

export const MATERIAL_SLOTS = {
  SKIN: 0,
  ROBE: 1,
  KASAYA_TRIM: 2,
  GOLD: 3,
  STONE: 4,
  HAIR: 5,
  PROP: 6,
  WHITE_SILK: 7,
} as const;

export type MaterialSlotId = (typeof MATERIAL_SLOTS)[keyof typeof MATERIAL_SLOTS];

/**
 * Tên 22 xương chuẩn Humanoid
 */
export const BONE_NAMES = {
  HIPS: 'Hips',
  SPINE: 'Spine',
  CHEST: 'Chest',
  NECK: 'Neck',
  HEAD: 'Head',

  SHOULDER_L: 'Shoulder_L',
  UPPER_ARM_L: 'UpperArm_L',
  LOWER_ARM_L: 'LowerArm_L',
  HAND_L: 'Hand_L',
  SLEEVE_L: 'Sleeve_L',

  SHOULDER_R: 'Shoulder_R',
  UPPER_ARM_R: 'UpperArm_R',
  LOWER_ARM_R: 'LowerArm_R',
  HAND_R: 'Hand_R',
  SLEEVE_R: 'Sleeve_R',

  UPPER_LEG_L: 'UpperLeg_L',
  LOWER_LEG_L: 'LowerLeg_L',
  FOOT_L: 'Foot_L',
  TOE_L: 'Toe_L',

  UPPER_LEG_R: 'UpperLeg_R',
  LOWER_LEG_R: 'LowerLeg_R',
  FOOT_R: 'Foot_R',
  TOE_R: 'Toe_R',
} as const;
