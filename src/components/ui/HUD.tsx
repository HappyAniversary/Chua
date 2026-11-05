import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Camera,
  Compass,
  Eye,
  EyeOff,
  Gauge,
  LogOut,
  MapPin,
  Moon,
  Music,
  Palette,
  Sliders,
  Sparkles,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  INTERACTION_ZONE_LIST,
  ROBE_COLOR_OPTIONS,
} from '../../constants/templeLayout';
import type { MultiplayerConnectionStatus } from '../../services/multiplayerService';
import { connectionPresentation } from '../../utils/multiplayerPresentation';
import { MultiplayerStatus } from './MultiplayerStatus';
import type {
  GraphicsQuality,
  InteractionZoneConfig,
  MonkActionState,
  MonkProfile,
  TimeOfDay,
  Vector3Tuple,
} from '../../types/game';

export interface HUDProps {
  profile: MonkProfile;
  position: Vector3Tuple;
  activeZone: InteractionZoneConfig | null;
  onlineCount: number;
  connectionStatus: MultiplayerConnectionStatus;
  onRetryConnection?: () => void;
  timeOfDay: TimeOfDay;
  graphicsQuality?: GraphicsQuality;
  soundEnabled: boolean;
  ambientMusicEnabled: boolean;
  currentActionState: MonkActionState;
  onChangeTimeOfDay: (time: TimeOfDay) => void;
  onChangeGraphicsQuality?: (quality: GraphicsQuality) => void;
  onToggleSound: () => void;
  onToggleAmbientMusic: () => void;
  onResetCamera: () => void;
  onOpenEditMonk: () => void;
  onOpenFigureLab?: () => void;
  onLogout: () => void;
  onTriggerZoneActivity: (zone: InteractionZoneConfig) => void;
  onTeleportToZone: (zone: InteractionZoneConfig) => void;
  onQuickActionState: (state: MonkActionState) => void;
}

const TIME_OPTIONS: Array<{
  id: TimeOfDay;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'day', label: 'Ban Ngày', icon: Sun },
  { id: 'sunset', label: 'Hoàng Hôn', icon: Sunset },
  { id: 'night', label: 'Đêm Trăng', icon: Moon },
];

const QUALITY_OPTIONS: Array<{
  id: GraphicsQuality;
  label: string;
  badge: string;
  desc: string;
}> = [
  { id: 'high', label: 'Cao (High)', badge: '2K', desc: 'Bóng đổ 2K, khử răng cưa DPR 2x' },
  { id: 'balanced', label: 'Cân Bằng', badge: '1.5x', desc: 'Chi tiết vừa, bóng đổ mềm 1K' },
  { id: 'low', label: 'Tiết Kiệm', badge: '1x', desc: 'Tắt bóng đổ, nhẹ máy cho Mobile' },
];

const QUICK_ACTIONS: Array<{
  state: MonkActionState;
  label: string;
  emoji: string;
}> = [
  { state: 'idle', label: 'Đứng Tĩnh Tâm', emoji: '🧘' },
  { state: 'praying', label: 'Lễ Phật', emoji: '🙏' },
  { state: 'wooden_fish', label: 'Gõ Mõ', emoji: '🪘' },
  { state: 'bell', label: 'Thỉnh Chuông', emoji: '🔔' },
  { state: 'fortune', label: 'Xin Xăm', emoji: '🎋' },
];

function useFpsCounter(): number {
  const [fps, setFps] = useState<number>(60);
  const framesRef = useRef(0);
  const prevTimeRef = useRef(performance.now());

  useEffect(() => {
    let animId: number;
    const loop = (now: number) => {
      framesRef.current++;
      if (now - prevTimeRef.current >= 500) {
        const measured = Math.round(
          (framesRef.current * 1000) / Math.max(1, now - prevTimeRef.current)
        );
        setFps(measured);
        framesRef.current = 0;
        prevTimeRef.current = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return fps;
}

export const HUD: React.FC<HUDProps> = memo(({
  profile,
  position,
  activeZone,
  onlineCount,
  connectionStatus,
  onRetryConnection,
  timeOfDay,
  graphicsQuality = 'balanced',
  soundEnabled,
  ambientMusicEnabled,
  currentActionState,
  onChangeTimeOfDay,
  onChangeGraphicsQuality,
  onToggleSound,
  onToggleAmbientMusic,
  onResetCamera,
  onOpenEditMonk,
  onOpenFigureLab,
  onLogout,
  onTriggerZoneActivity,
  onTeleportToZone,
  onQuickActionState,
}) => {
  const [isMapOpen, setIsMapOpen] = useState<boolean>(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const fps = useFpsCounter();

  const robeInfo =
    ROBE_COLOR_OPTIONS.find((opt) => opt.color === profile.robeColor) ??
    ROBE_COLOR_OPTIONS[0];

  const coordX = Math.round(position.x);
  const coordZ = Math.round(position.z);

  return (
    <>
      {/* Thanh Trạng Thái Phía Trên (Top Bar) */}
      <header className="fixed top-0 inset-x-0 z-30 p-2.5 sm:p-4 pointer-events-none flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-2.5">
        {/* Cụm Bên Trái: Hồ sơ Chú Tiểu, Công Đức, Đạo Hữu Online, Tọa Độ, FPS */}
        <div className="pointer-events-auto lg:max-w-[50%] flex flex-wrap items-center gap-2 bg-stone-950/85 border border-amber-500/35 rounded-2xl px-3.5 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {/* Huy hiệu màu áo cà sa + Pháp danh + @username */}
          <div className="flex items-center gap-2.5 pr-2 border-r border-amber-500/20">
            <span
              className="w-4 h-4 rounded-full shrink-0 border-2 border-white/80 shadow"
              style={{ backgroundColor: profile.robeColor }}
              title={`Áo Cà Sa: ${robeInfo.name}`}
            />
            <div className="leading-tight">
              <div className="text-xs sm:text-sm font-bold text-amber-100 flex items-center gap-1.5">
                <span>{profile.monkName}</span>
                <span className="text-[11px] font-normal text-amber-300/75">
                  @{profile.username}
                </span>
              </div>
              <div className="text-[10px] text-amber-200/65">
                {robeInfo.name}
              </div>
            </div>
          </div>

          {/* Điểm Công Đức */}
          <div
            className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-200 flex items-center gap-1"
            title="Tổng điểm Công Đức tích lũy"
          >
            <span>✨ {profile.meritPoints}</span>
            <span className="hidden sm:inline text-[11px] font-medium text-amber-200/80">
              Công Đức
            </span>
          </div>

          {/* Số Đạo Hữu đang ở chùa */}
          <div
            className="px-2.5 py-1 rounded-xl bg-stone-900/90 border border-amber-500/25 text-xs font-semibold text-amber-100 flex items-center gap-1"
            title="Số người chơi thật, bao gồm bạn; không tính NPC"
          >
            <span>👥 {onlineCount} {connectionPresentation(connectionStatus).isOnline ? 'online' : 'trong phiên'}</span>
          </div>

          {/* Tọa độ (X, Z) */}
          <div
            className="px-2.5 py-1 rounded-xl bg-stone-900/90 border border-amber-500/20 text-[11px] font-mono text-amber-200/80 flex items-center gap-1"
            title="Tọa độ hiện tại trong khuôn viên sân chùa (X, Z)"
          >
            <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              ({coordX}, {coordZ})
            </span>
          </div>

          {/* Bộ đếm FPS thời gian thực */}
          <div
            className="px-2.5 py-1 rounded-xl bg-stone-900/90 border border-amber-500/20 text-[11px] font-mono flex items-center gap-1.5"
            title="Tốc độ khung hình thời gian thực (Frames Per Second)"
          >
            <Activity
              className={`w-3 h-3 ${
                fps >= 50
                  ? 'text-emerald-400'
                  : fps >= 30
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            />
            <span
              className={`font-bold ${
                fps >= 50
                  ? 'text-emerald-300'
                  : fps >= 30
                  ? 'text-amber-300'
                  : 'text-red-300'
              }`}
            >
              {fps} FPS
            </span>
          </div>
          <MultiplayerStatus status={connectionStatus} onRetry={onRetryConnection} />
        </div>

        {/* Cụm Bên Phải: Thời gian, Đồ họa, Âm thanh, Bản đồ dịch chuyển, Camera, Đổi Pháp danh, Đăng xuất */}
        <div className="pointer-events-auto flex min-w-0 flex-col items-end gap-1.5 lg:max-w-[50%]">
          <button
            type="button"
            aria-label={areControlsVisible ? 'Ẩn giao diện tương tác' : 'Hiện giao diện tương tác'}
            aria-expanded={areControlsVisible}
            aria-controls="hud-interaction-controls"
            onClick={() => {
              setAreControlsVisible((visible) => !visible);
              setIsMapOpen(false);
              setIsQualityMenuOpen(false);
            }}
            className="min-h-11 px-3 py-2 rounded-xl bg-stone-950/85 hover:bg-stone-900 border border-amber-500/35 text-xs font-semibold text-amber-100 flex items-center gap-1.5 backdrop-blur-md shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {areControlsVisible ? <EyeOff className="w-4 h-4 text-amber-300" /> : <Eye className="w-4 h-4 text-amber-300" />}
            <span>{areControlsVisible ? 'Ẩn giao diện' : 'Hiện giao diện'}</span>
          </button>
          <div
            id="hud-interaction-controls"
            hidden={!areControlsVisible}
            className={`${areControlsVisible ? 'flex' : 'hidden'} max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2`}
          >
            {/* Bộ chuyển đổi thời gian: Ban Ngày / Hoàng Hôn / Đêm Trăng */}
            <div className="flex items-center bg-stone-950/85 border border-amber-500/35 rounded-xl p-1 backdrop-blur-md shadow">
              {TIME_OPTIONS.map((item) => {
                const Icon = item.icon;
                const active = timeOfDay === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    aria-pressed={active}
                    onClick={() => onChangeTimeOfDay(item.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      active
                        ? 'bg-amber-500 text-stone-950 shadow'
                        : 'text-amber-200/75 hover:text-amber-100 hover:bg-stone-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Bộ chọn chất lượng đồ họa (High / Balanced / Low) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsQualityMenuOpen((prev) => !prev)}
                title="Cài đặt chất lượng đồ họa (Cao / Cân bằng / Tiết kiệm pin)"
                className="px-2.5 py-2 rounded-xl bg-stone-950/85 hover:bg-stone-900 border border-amber-500/35 text-xs font-semibold text-amber-100 flex items-center gap-1.5 backdrop-blur-md shadow transition"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden md:inline">
                  {graphicsQuality === 'high'
                    ? 'Đồ Họa: Cao'
                    : graphicsQuality === 'low'
                    ? 'Đồ Họa: Tiết Kiệm'
                    : 'Đồ Họa: Cân Bằng'}
                </span>
              </button>
              {isQualityMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-stone-950/95 border border-amber-500/45 shadow-2xl backdrop-blur-xl p-2.5 text-amber-50 z-50">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 px-2 py-1 border-b border-amber-500/20 mb-1.5 flex items-center justify-between">
                    <span>Chất Lượng Đồ Họa</span>
                    <button
                      type="button"
                      onClick={() => setIsQualityMenuOpen(false)}
                      className="text-[10px] text-amber-400 hover:text-amber-200"
                    >
                      Đóng
                    </button>
                  </div>
                  {QUALITY_OPTIONS.map((q) => {
                    const active = graphicsQuality === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          onChangeGraphicsQuality?.(q.id);
                          setIsQualityMenuOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition mb-1 flex items-center justify-between ${
                          active
                            ? 'bg-amber-500/25 border border-amber-400/60 text-amber-200 font-bold'
                            : 'hover:bg-stone-800/80 text-amber-100/80'
                        }`}
                      >
                        <div>
                          <div>{q.label}</div>
                          <div className="text-[10px] text-amber-200/60">{q.desc}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 border border-amber-500/20 font-mono">
                          {q.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Nút bật/tắt Âm thanh hiệu ứng & Nhạc thiền nền */}
            <div className="flex items-center gap-1 bg-stone-950/85 border border-amber-500/35 rounded-xl p-1 backdrop-blur-md shadow">
              <button
                type="button"
                onClick={onToggleSound}
                title={
                  soundEnabled
                    ? 'Đang bật âm thanh hiệu ứng (Chuông, Mõ, Quẻ Xăm)'
                    : 'Đang tắt âm thanh hiệu ứng'
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  soundEnabled
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                    : 'text-stone-400 hover:text-amber-200'
                }`}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-amber-300" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span className="hidden md:inline">Âm Thanh</span>
              </button>

              <button
                type="button"
                onClick={onToggleAmbientMusic}
                title={
                  ambientMusicEnabled
                    ? 'Đang bật nhạc thiền nền thanh tịnh'
                    : 'Bật nhạc thiền nền thanh tịnh'
                }
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  ambientMusicEnabled
                    ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40'
                    : 'text-stone-400 hover:text-amber-200'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Nhạc Thiền</span>
              </button>
            </div>

            {/* Menu / Popover Bản Đồ & Dịch Chuyển Nhanh */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMapOpen((prev) => !prev)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 backdrop-blur-md shadow transition ${
                  isMapOpen
                    ? 'bg-amber-500 text-stone-950 border-amber-300'
                    : 'bg-stone-950/85 hover:bg-stone-900 text-amber-100 border-amber-500/35'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Bản Đồ & Dịch Chuyển Nhanh</span>
              </button>

              {isMapOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-stone-950/95 border border-amber-500/45 shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-xl p-3.5 text-amber-50 z-40">
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-amber-500/20">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Bản Đồ 5 Khu Vực Tâm Linh
                      </h3>
                      <p className="text-[11px] text-amber-200/65">
                        Chọn khu vực để dịch chuyển Chú Tiểu tới ngay
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMapOpen(false)}
                      className="text-xs text-amber-300 hover:text-amber-100 px-2 py-0.5 rounded-lg bg-stone-900 border border-amber-500/25"
                    >
                      Đóng
                    </button>
                  </div>

                  {/* Danh sách 5 khu vực trong INTERACTION_ZONE_LIST */}
                  <div className="space-y-1.5 mb-3">
                    {INTERACTION_ZONE_LIST.map((zone) => {
                      const isHere = activeZone?.id === zone.id;
                      return (
                        <div
                          key={zone.id}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                            isHere
                              ? 'bg-amber-500/20 border-amber-400/60'
                              : 'bg-stone-900/80 border-amber-500/20 hover:border-amber-400/40'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-amber-100 truncate flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: zone.highlightColor }}
                              />
                              <span className="truncate">{zone.name}</span>
                            </div>
                            <div className="text-[10px] text-amber-200/70 truncate">
                              {zone.subtitle} • +{zone.meritReward} Công Đức
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onTeleportToZone(zone);
                              setIsMapOpen(false);
                            }}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500 text-amber-200 hover:text-stone-950 border border-amber-400/40 text-[11px] font-bold transition"
                          >
                            Dịch chuyển
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chọn nhanh động tác Chú Tiểu */}
                  <div className="pt-2.5 border-t border-amber-500/20">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-2">
                      Động Tác Chú Tiểu Nhanh
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_ACTIONS.map((act) => {
                        const active = currentActionState === act.state;
                        return (
                          <button
                            key={act.state}
                            type="button"
                            onClick={() => {
                              onQuickActionState(act.state);
                              setIsMapOpen(false);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                              active
                                ? 'bg-amber-500 text-stone-950 border-amber-300 shadow'
                                : 'bg-stone-900/90 hover:bg-stone-800 text-amber-100 border-amber-500/25'
                            }`}
                          >
                            <span>{act.emoji}</span>
                            <span>{act.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Nút Đặt lại Camera */}
            <button
              type="button"
              onClick={onResetCamera}
              title="Đặt lại góc nhìn Camera sau lưng Chú Tiểu"
              className="px-2.5 py-2 rounded-xl bg-stone-950/85 hover:bg-stone-900 border border-amber-500/35 text-xs font-semibold text-amber-100 flex items-center gap-1.5 backdrop-blur-md shadow transition"
            >
              <Camera className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden xl:inline">Đặt lại Camera</span>
            </button>

            {/* Nút Đổi Pháp Danh / Áo */}
            <button
              type="button"
              onClick={onOpenEditMonk}
              title="Đổi Pháp Danh hoặc Màu Áo Cà Sa"
              className="px-2.5 py-2 rounded-xl bg-stone-950/85 hover:bg-stone-900 border border-amber-500/35 text-xs font-semibold text-amber-100 flex items-center gap-1.5 backdrop-blur-md shadow transition"
            >
              <Palette className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Đổi Pháp Danh / Áo</span>
            </button>

            {/* Nút Mở Phòng Thử Nghiệm Tượng 3D (Figure Lab) */}
            {onOpenFigureLab && (
              <button
                type="button"
                onClick={onOpenFigureLab}
                title="Mở phòng thí nghiệm & xem trước mô hình 3D (Figure Lab)"
                className="px-2.5 py-2 rounded-xl bg-gradient-to-r from-amber-600/30 to-amber-500/20 hover:from-amber-600/50 hover:to-amber-500/40 border border-amber-400/50 text-xs font-semibold text-amber-200 flex items-center gap-1.5 backdrop-blur-md shadow transition"
              >
                <Box className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span className="hidden lg:inline">Xưởng Tượng 3D</span>
              </button>
            )}

            {/* Nút Đăng Xuất */}
            <button
              type="button"
              onClick={onLogout}
              title="Đăng xuất tài khoản"
              className="px-2.5 py-2 rounded-xl bg-red-950/80 hover:bg-red-900/90 border border-red-400/35 text-xs font-semibold text-red-100 flex items-center gap-1.5 backdrop-blur-md shadow transition"
            >
              <LogOut className="w-3.5 h-3.5 text-red-300" />
              <span className="hidden sm:inline">Đăng Xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Thẻ Tương Tác Khu Vực Nổi Bật Ở Chính Giữa Phía Dưới (Bottom-Center Prompt) */}
      {activeZone !== null && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-md pointer-events-auto">
          <div className="rounded-3xl bg-stone-950/92 border-2 border-amber-400/65 shadow-[0_0_40px_rgba(245,158,11,0.35)] backdrop-blur-md p-4 text-amber-50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-center sm:text-left min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-amber-300 mb-1">
                <Sparkles className="w-3 h-3" />
                <span>+{activeZone.meritReward} Công Đức</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-amber-100 truncate">
                {activeZone.name}
              </h2>
              <p className="text-xs text-amber-200/75 line-clamp-2 mt-0.5">
                {activeZone.description}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onTriggerZoneActivity(activeZone)}
              className="w-full sm:w-auto shrink-0 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-extrabold text-sm shadow-lg shadow-amber-500/30 transition transform active:scale-95"
            >
              {activeZone.actionLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
});

HUD.displayName = 'HUD';

export default HUD;
