import type { MonkPresence } from '../types/game';
import type { MultiplayerConnectionStatus } from '../services/multiplayerService';

export function countHumanPlayers(monks: readonly MonkPresence[], selfUid: string): number {
  return new Set([selfUid, ...monks.filter((monk) => !monk.isNpc).map((monk) => monk.uid)]).size;
}

export function connectionPresentation(status: MultiplayerConnectionStatus) {
  if (status.mode === 'local' || status.state === 'local') return {
    label: 'Chơi cục bộ',
    detail: 'Chỉ đồng bộ các tab cùng trình duyệt. Người dùng trên thiết bị hoặc trình duyệt khác chưa thể thấy nhau.',
    tone: 'warning' as const,
    canRetry: false,
    isOnline: false,
  };
  if (status.state === 'connected') return {
    label: 'Đã vào phòng chung',
    detail: 'Đang đồng bộ người chơi và trò chuyện giữa các thiết bị.',
    tone: 'success' as const,
    canRetry: false,
    isOnline: true,
  };
  if (status.state === 'connecting') return {
    label: 'Đang kết nối phòng chung',
    detail: 'Đang kiểm tra kết nối. Danh sách người chơi sẽ cập nhật khi vào phòng chung.',
    tone: 'neutral' as const,
    canRetry: false,
    isOnline: false,
  };
  const code = status.code?.split('/').pop();
  const detail = code === 'permission-denied'
    ? 'Phòng chung chưa cho phép truy cập. Hãy liên hệ quản trị viên hoặc thử kết nối lại.'
    : code === 'unauthenticated'
      ? 'Phiên đăng nhập cần được xác nhận lại. Hãy đăng xuất và đăng nhập lại.'
      : code === 'unavailable' || code === 'deadline-exceeded'
        ? 'Không kết nối được phòng chung. Kiểm tra mạng rồi thử kết nối lại.'
        : 'Chưa kết nối được phòng chung. Hãy thử kết nối lại hoặc liên hệ quản trị viên.';
  return { label: 'Chưa kết nối phòng chung', detail, tone: 'danger' as const, canRetry: true, isOnline: false };
}

export function sendFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Chưa gửi được tin nhắn. Nội dung được giữ lại để bạn thử lại.';
}
