/**
 * Hợp đồng kiểu dữ liệu trung tâm (Shared Types & Interface Contracts)
 * cho dự án Web Game 3D Giả Lập Đi Chùa.
 */

/**
 * Trạng thái hành động hiện tại của Chú Tiểu trong không gian 3D.
 * - `'idle'`: Đứng yên
 * - `'walking'`: Đang bước đi
 * - `'praying'`: Đang chắp tay cầu nguyện / thắp nhang
 * - `'wooden_fish'`: Đang gõ mõ tụng kinh
 * - `'bell'`: Đang thỉnh chuông chùa
 * - `'fortune'`: Đang lắc ống xăm cầu quẻ
 */
export type MonkActionState =
  | 'idle'
  | 'walking'
  | 'praying'
  | 'wooden_fish'
  | 'bell'
  | 'fortune';

/**
 * Mã màu Hex đại diện cho các màu áo cà sa của Chú Tiểu.
 * - `'#d97706'`: Vàng Từ Bi
 * - `'#991b1b'`: Đỏ Hồng Phúc
 * - `'#78350f'`: Nâu Thiền Định
 * - `'#4b5563'`: Xám Khất Thực
 * - `'#1e3a8a'`: Xanh Thanh Tịnh
 */
export type RobeColor =
  | '#d97706'
  | '#991b1b'
  | '#78350f'
  | '#4b5563'
  | '#1e3a8a';

/**
 * Thời điểm trong ngày của cảnh quan ngôi chùa, quyết định ánh sáng và bầu trời.
 * - `'day'`: Ban ngày nắng ấm
 * - `'sunset'`: Hoàng hôn chiều tà
 * - `'night'`: Đêm trăng thanh tịnh
 */
export type TimeOfDay = 'day' | 'sunset' | 'night';

/**
 * Định danh các khu vực tương tác tâm linh trong khuôn viên chùa.
 * - `'incense_altar'`: Lư Hương Đại Hùng Bảo Điện (Thắp nhang & gửi lời nguyện ước)
 * - `'wooden_fish'`: Bàn Mõ Tụng Kinh (Gõ mõ tích công đức)
 * - `'temple_bell'`: Đại Hồng Chung (Thỉnh chuông ngân vang)
 * - `'fortune_stall'`: Quầy Xin Xăm Đầu Năm (Rút quẻ thẻ bình an)
 * - `'bodhi_tree'`: Cội Bồ Đề Cổ Thụ (Thiền định & xem lời ước nguyện)
 * - `'avalokitesvara_pavilion'`: Đài Quan Âm Nam Hải giữa hồ sen (Lễ Quan Âm cầu bình an)
 * - `'seven_story_stupa'`: Bảo Tháp Xá Lợi 7 Tầng (Đi nhiễu tháp tích công đức)
 * - `'zen_tea_garden'`: Vườn Thiền & Bàn Trà Hậu Viện (Ngồi thiền, thưởng trà tĩnh tâm)
 */
export type InteractionZoneId =
  | 'incense_altar'
  | 'wooden_fish'
  | 'temple_bell'
  | 'fortune_stall'
  | 'bodhi_tree'
  | 'avalokitesvara_pavilion'
  | 'seven_story_stupa'
  | 'zen_tea_garden';

/**
 * Tọa độ 3 chiều (X, Y, Z) trong không gian Three.js.
 */
export interface Vector3Tuple {
  /** Tọa độ trục ngang (Trái / Phải) */
  x: number;
  /** Tọa độ trục dọc (Độ cao) */
  y: number;
  /** Tọa độ trục sâu (Trước / Sau) */
  z: number;
}

/**
 * Thông tin cấu hình cho một lựa chọn màu áo cà sa khi tạo hoặc đổi trang phục.
 */
export interface RobeColorOption {
  /** Mã định danh lựa chọn màu áo (ví dụ: 'saffron', 'crimson') */
  id: string;
  /** Tên hiển thị tiếng Việt (ví dụ: "Vàng Từ Bi", "Đỏ Hồng Phúc") */
  name: string;
  /** Mã màu Hex chuẩn của áo cà sa */
  color: RobeColor;
  /** Mô tả ý nghĩa tâm linh của màu sắc */
  description: string;
}

/**
 * Cấu hình chi tiết cho một khu vực tương tác trong sân chùa.
 */
export interface InteractionZoneConfig {
  /** Mã định danh duy nhất của khu vực */
  id: InteractionZoneId;
  /** Tên hiển thị của khu vực tương tác */
  name: string;
  /** Phụ đề ngắn gọn mô tả khu vực */
  subtitle: string;
  /** Mô tả chi tiết ý nghĩa và hoạt động tại khu vực */
  description: string;
  /** Nhãn hiển thị trên nút bấm tương tác (ví dụ: "Dâng Hương Cầu Nguyện") */
  actionLabel: string;
  /** Vị trí tâm của khu vực tương tác trong không gian 3D */
  position: Vector3Tuple;
  /** Bán kính kích hoạt tương tác khi Chú Tiểu tiến lại gần (đơn vị mét/unit) */
  radius: number;
  /** Số điểm công đức nhận được mỗi lần hoàn thành tương tác */
  meritReward: number;
  /** Màu sắc vòng sáng chỉ dẫn dưới mặt đất (Hex/CSS color) */
  highlightColor: string;
  /** Điểm đứng an toàn khi dịch chuyển nhanh tới khu vực (không nằm trong vật cản) */
  approachPoint?: Vector3Tuple;
  /** Hướng xoay nhân vật (radian) khi dịch chuyển tới `approachPoint` */
  approachRotationY?: number;
}

/**
 * Hồ sơ người chơi (Chú Tiểu) lưu trữ lâu dài trong cơ sở dữ liệu / bộ nhớ cục bộ.
 */
export interface MonkProfile {
  /** Định danh duy nhất của người chơi (Firebase Auth UID hoặc Local ID) */
  uid: string;
  /** Tên tài khoản đăng nhập của người chơi */
  username: string;
  /** Pháp danh / Tên hiển thị của Chú Tiểu trong chùa */
  monkName: string;
  /** Màu áo cà sa người chơi đã chọn */
  robeColor: RobeColor;
  /** Tổng điểm công đức tích lũy được */
  meritPoints: number;
  /** Thời điểm tạo hồ sơ (Unix timestamp tính bằng ms) */
  createdAt: number;
  /** Thời điểm cập nhật hồ sơ gần nhất (Unix timestamp tính bằng ms) */
  updatedAt?: number;
}

/**
 * Trạng thái bong bóng thoại hiển thị lơ lửng trên đầu Chú Tiểu.
 */
export interface ChatBubbleState {
  /** Nội dung lời nói hoặc câu niệm hiển thị trong bong bóng */
  text: string;
  /** Thời điểm bong bóng thoại tự động biến mất (Unix timestamp tính bằng ms) */
  expiresAt: number;
}

/**
 * Trạng thái hiện diện thời gian thực (Realtime Presence) của một Chú Tiểu trong sân chùa,
 * dùng để đồng bộ vị trí và hành động giữa nhiều người chơi.
 */
export interface MonkPresence {
  /** Distinguishes simulated companions from real player sessions. */
  isNpc?: boolean;
  /** Định danh duy nhất của người chơi */
  uid: string;
  /** Pháp danh hiển thị trên đầu nhân vật */
  monkName: string;
  /** Màu áo cà sa của nhân vật */
  robeColor: RobeColor;
  /** Tọa độ hiện tại trong không gian 3D */
  position: Vector3Tuple;
  /** Góc xoay nhân vật quanh trục Y (tính bằng radian) */
  rotationY: number;
  /** Hành động hiện tại của nhân vật */
  actionState: MonkActionState;
  /** Bong bóng chat đang hiển thị trên đầu (nếu có) */
  chatBubble?: ChatBubbleState | null;
  /** Điểm công đức hiện tại của nhân vật */
  meritPoints: number;
  /** Thời điểm đồng bộ trạng thái gần nhất (Unix timestamp tính bằng ms) */
  lastUpdated: number;
}

/**
 * Tin nhắn trò chuyện hoặc thông báo trong kênh giao lưu sân chùa.
 */
export interface ChatMessage {
  /** Định danh duy nhất của tin nhắn */
  id: string;
  /** UID của người gửi tin nhắn */
  uid: string;
  /** Pháp danh của người gửi */
  monkName: string;
  /** Màu áo cà sa của người gửi (dùng để tô màu badge/avatar) */
  robeColor: RobeColor;
  /** Nội dung tin nhắn */
  text: string;
  /** Thời điểm gửi tin nhắn (Unix timestamp tính bằng ms) */
  createdAt: number;
  /** Phân loại tin nhắn: trò chuyện thường ('chat'), thông báo hệ thống ('system'), hoặc lời nguyện ước ('wish') */
  type: 'chat' | 'system' | 'wish';
}

/**
 * Lời nguyện ước khi dâng hương tại Lư Hương hoặc treo lên Cội Bồ Đề.
 */
export interface IncenseWish {
  /** Định danh duy nhất của lời nguyện ước */
  id: string;
  /** UID của người gửi lời nguyện ước */
  uid: string;
  /** Pháp danh của người ước nguyện */
  monkName: string;
  /** Màu áo cà sa của người ước nguyện */
  robeColor: RobeColor;
  /** Nội dung lời cầu nguyện bình an, sức khỏe, trí tuệ... */
  wishText: string;
  /** Thời điểm dâng lời nguyện ước (Unix timestamp tính bằng ms) */
  createdAt: number;
}

/**
 * Phân hạng cát tường của quẻ xăm đầu năm (tất cả đều mang năng lượng tích cực, hướng thiện).
 */
export type FortuneRank =
  | 'Thượng Thượng'
  | 'Thượng Cát'
  | 'Trung Cát'
  | 'Bình An';

/**
 * Thông tin chi tiết của một thẻ xăm (Quẻ Xăm) trong chùa.
 */
export interface FortuneSlip {
  /** Số thứ tự của quẻ xăm (ví dụ: 1 -> 12) */
  id: number;
  /** Cấp bậc cát tường của quẻ xăm */
  rank: FortuneRank;
  /** Tên quẻ xăm (ví dụ: "Hoa Khai Kiến Phật", "Thuận Buồm Xuôi Gió") */
  title: string;
  /** Các câu thơ kệ (thường là 4 câu thơ lục bát hoặc thất ngôn) */
  poem: string[];
  /** Lời giải nghĩa chi tiết cho quẻ xăm */
  meaning: string;
  /** Lời khuyên tu tâm dưỡng tính và hành xử trong cuộc sống */
  advice: string;
}

/**
 * Vector điều khiển di chuyển từ cần gạt ảo (Virtual Joystick) hoặc bàn phím (WASD/Arrow).
 */
export interface JoystickVector {
  /** Giá trị trục ngang từ -1 (Trái) đến +1 (Phải) */
  x: number;
  /** Giá trị trục dọc từ -1 (Lùi) đến +1 (Tiến) */
  y: number;
  /** Trạng thái người chơi có đang tác động điều khiển hay không */
  active: boolean;
  /** Nguồn phát sinh tín hiệu điều khiển hiện tại */
  source: 'joystick' | 'keyboard' | 'none';
}

/**
 * Giới hạn biên độ di chuyển trong khuôn viên sân chùa để tránh nhân vật đi ra khỏi bản đồ.
 */
export interface WorldBounds {
  /** Giới hạn tọa độ X tối thiểu (Biên trái) */
  minX: number;
  /** Giới hạn tọa độ X tối đa (Biên phải) */
  maxX: number;
  /** Giới hạn tọa độ Z tối thiểu (Biên sau / Hậu điện) */
  minZ: number;
  /** Giới hạn tọa độ Z tối đa (Biên trước / Cổng Tam Quan) */
  maxZ: number;
}

/**
 * Hình chữ nhật trên mặt phẳng XZ (dùng cho va chạm, cầu, lối đi).
 */
export interface RectXZ {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Vật cản va chạm trên mặt phẳng XZ.
 * - `'solid'`: Luôn chặn (tường, cột, bệ tượng, lầu chuông...)
 * - `'water'`: Mặt nước – chặn trừ khi người chơi đứng trên vùng đi bộ (`WALKABLE_AREAS`: cầu, đảo)
 */
export type CollisionObstacle =
  | {
      id: string;
      kind: 'solid' | 'water';
      shape: 'circle';
      x: number;
      z: number;
      radius: number;
    }
  | ({
      id: string;
      kind: 'solid' | 'water';
      shape: 'rect';
    } & RectXZ);

/**
 * Vùng đi bộ được phép đè lên mặt nước (cầu đá, cầu cửu khúc, đảo giữa hồ).
 */
export type WalkableArea =
  | { id: string; shape: 'circle'; x: number; z: number; radius: number }
  | ({ id: string; shape: 'rect' } & RectXZ);

/**
 * Mức chất lượng đồ họa.
 * - `'high'`: Bóng đổ 2048, DPR tối đa 2, đầy đủ hiệu ứng
 * - `'balanced'`: Bóng đổ 1024, DPR tối đa 1.5 (mặc định)
 * - `'low'`: Tắt bóng đổ động, DPR 1, giảm mật độ cây cối / hạt (tiết kiệm pin)
 */
export type GraphicsQuality = 'high' | 'balanced' | 'low';

/**
 * Trạng thái góc nhìn của Camera 3D xoay quanh nhân vật Chú Tiểu.
 */
export interface CameraControlState {
  /** Góc xoay ngang quanh nhân vật (Radian) */
  yaw: number;
  /** Góc ngẩng / cúi của camera (Radian) */
  pitch: number;
  /** Khoảng cách thu phóng (Zoom) từ camera tới nhân vật */
  distance: number;
  /** Tăng khi dịch chuyển hoặc đặt lại góc nhìn để bỏ nội suy từ vị trí cũ. */
  resetVersion?: number;
}
