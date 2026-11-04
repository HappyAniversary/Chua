import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Disc, Play, Pause, Sparkles, X, Volume2 } from 'lucide-react';
import type { InteractionZoneId, MonkProfile } from '../../types/game';
import {
  playWoodenFishSound,
  playTempleBellSound,
} from '../../utils/soundEffects';

export interface WoodenFishAndBellOverlayProps {
  profile: MonkProfile;
  mode: Extract<InteractionZoneId, 'wooden_fish' | 'temple_bell'>;
  onStrike: (
    mode: 'wooden_fish' | 'temple_bell',
    meritEarned: number,
    chantText: string
  ) => void;
  onClose: () => void;
}

interface FloatingChantItem {
  id: number;
  text: string;
  subText: string;
  offsetX: number;
}

interface RippleWaveItem {
  id: number;
}

const WOODEN_FISH_CHANTS: string[] = [
  '+1 Công Đức • Tâm Thanh Tịnh',
  'Nam Mô A Di Đà Phật',
  'Buông Bỏ Phiền Não',
  'Tâm An Vạn Sự An',
];

const TEMPLE_BELL_CHANTS: string[] = [
  '+5 Công Đức • Chuông Chùa Ngân Vang',
  'Nghe Chuông Phiền Não Tan',
  'Trí Tuệ Lớn, Bồ Đề Sanh',
  'Quốc Thái Dân An • Thiên Hạ Thái Bình',
];

export const WoodenFishAndBellOverlay: React.FC<WoodenFishAndBellOverlayProps> = ({
  profile,
  mode,
  onStrike,
  onClose,
}) => {
  const isWoodenFish = mode === 'wooden_fish';
  const [isPressed, setIsPressed] = useState<boolean>(false);
  const [autoChant, setAutoChant] = useState<boolean>(false);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [sessionMerit, setSessionMerit] = useState<number>(0);
  const [floatingChants, setFloatingChants] = useState<FloatingChantItem[]>([]);
  const [ripples, setRipples] = useState<RippleWaveItem[]>([]);

  const chantIndexRef = useRef<number>(0);
  const itemIdRef = useRef<number>(1);

  // Reset autoChant nếu chuyển sang mode chuông chùa
  useEffect(() => {
    setAutoChant(false);
  }, [mode]);

  const triggerStrike = useCallback(() => {
    setIsPressed(true);
    window.setTimeout(() => setIsPressed(false), 180);

    const nextId = itemIdRef.current++;
    const randomOffsetX = Math.floor(Math.random() * 120) - 60;

    if (isWoodenFish) {
      playWoodenFishSound();
      const chant =
        WOODEN_FISH_CHANTS[chantIndexRef.current % WOODEN_FISH_CHANTS.length];
      chantIndexRef.current += 1;

      setSessionCount((prev) => prev + 1);
      setSessionMerit((prev) => prev + 1);

      const floatingItem: FloatingChantItem = {
        id: nextId,
        text: '+1 Công Đức • Tâm Thanh Tịnh',
        subText: chant,
        offsetX: randomOffsetX,
      };
      setFloatingChants((prev) => [...prev.slice(-7), floatingItem]);
      onStrike('wooden_fish', 1, chant);
    } else {
      playTempleBellSound();
      const bellChant =
        TEMPLE_BELL_CHANTS[chantIndexRef.current % TEMPLE_BELL_CHANTS.length];
      chantIndexRef.current += 1;

      setSessionCount((prev) => prev + 1);
      setSessionMerit((prev) => prev + 5);

      const floatingItem: FloatingChantItem = {
        id: nextId,
        text: '+5 Công Đức • Chuông Chùa Ngân Vang',
        subText: bellChant,
        offsetX: randomOffsetX,
      };
      setFloatingChants((prev) => [...prev.slice(-7), floatingItem]);
      setRipples((prev) => [...prev.slice(-4), { id: nextId }]);
      onStrike('temple_bell', 5, bellChant);
    }

    window.setTimeout(() => {
      setFloatingChants((prev) => prev.filter((item) => item.id !== nextId));
      setRipples((prev) => prev.filter((item) => item.id !== nextId));
    }, 1750);
  }, [isWoodenFish, onStrike]);

  // Chế độ tự động gõ mõ nhịp thiền (mỗi 1.2 giây)
  useEffect(() => {
    if (!isWoodenFish || !autoChant) return;
    const intervalId = window.setInterval(() => {
      triggerStrike();
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [isWoodenFish, autoChant, triggerStrike]);

  // Hỗ trợ nhấn phím Space để gõ mõ / thỉnh chuông
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        triggerStrike();
      } else if (event.code === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerStrike, onClose]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      <style>{`
        @keyframes floatUpChant {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.9);
          }
          18% {
            opacity: 1;
            transform: translateY(0px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-110px) scale(1.06);
          }
        }
        @keyframes bellGoldenRipple {
          0% {
            opacity: 0.85;
            transform: scale(0.6);
          }
          100% {
            opacity: 0;
            transform: scale(2.8);
          }
        }
      `}</style>

      {/* Thanh tiêu đề nhỏ phía trên để không che Chú Tiểu 3D ở giữa */}
      <div className="w-full flex justify-center">
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full bg-stone-950/85 border border-amber-500/40 backdrop-blur-md shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
          <span className="flex items-center gap-1.5 text-xs sm:text-sm font-serif font-bold text-amber-300">
            {isWoodenFish ? (
              <Disc className="w-4 h-4 text-amber-400" />
            ) : (
              <Bell className="w-4 h-4 text-yellow-400" />
            )}
            {isWoodenFish ? 'Gõ Mõ Tụng Kinh' : 'Thỉnh Đại Hồng Chung'}
          </span>
          <span className="text-stone-600">•</span>
          <span className="text-xs text-amber-100/90">
            Phiên này: <strong className="text-amber-300">+{sessionMerit}</strong> Công Đức ({sessionCount}{' '}
            {isWoodenFish ? 'nhịp mõ' : 'tiếng chuông'})
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng tương tác"
            className="ml-1 p-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Vùng hiển thị chữ nổi bay lên và sóng âm vàng (ở trung tâm dưới, không cản chuột) */}
      <div className="relative flex-1 flex items-center justify-center pointer-events-none">
        {/* Sóng âm vàng lan tỏa khi thỉnh Đại Hồng Chung */}
        {!isWoodenFish &&
          ripples.map((ripple) => (
            <div
              key={ripple.id}
              style={{ animation: 'bellGoldenRipple 1.65s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
              className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border-2 border-amber-400/75 shadow-[0_0_40px_rgba(251,191,36,0.5)]"
            />
          ))}

        {/* Các dòng chữ công đức & câu niệm bay lên */}
        <div className="relative w-full max-w-md h-48 flex items-center justify-center">
          {floatingChants.map((item) => (
            <div
              key={item.id}
              style={{
                left: `calc(50% + ${item.offsetX}px)`,
                animation: 'floatUpChant 1.7s ease-out forwards',
              }}
              className="absolute -translate-x-1/2 flex flex-col items-center text-center whitespace-nowrap"
            >
              <span className="px-3 py-1 rounded-full bg-amber-500/25 border border-amber-300/60 text-amber-200 font-bold text-xs sm:text-sm shadow-[0_0_15px_rgba(245,158,11,0.45)] backdrop-blur-sm">
                {item.text}
              </span>
              {item.subText !== item.text && (
                <span className="mt-1 text-xs sm:text-sm font-serif italic text-yellow-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  “{item.subText}”
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bảng điều khiển nổi gọn gàng phía dưới màn hình */}
      <div className="w-full flex justify-center pb-1 sm:pb-3">
        <div className="pointer-events-auto w-full max-w-md rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-stone-900/95 to-stone-950/95 backdrop-blur-md px-5 py-4 shadow-[0_10px_45px_rgba(0,0,0,0.75)] flex flex-col items-center gap-3.5">
          {/* Nút bấm chính: Mõ Gỗ hoặc Đại Hồng Chung */}
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={triggerStrike}
              className={`group relative flex flex-col items-center justify-center rounded-full select-none transition-transform duration-150 focus:outline-none ${
                isPressed ? 'scale-90' : 'hover:scale-105 active:scale-90'
              } ${
                isWoodenFish
                  ? 'w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-b from-amber-600 via-amber-800 to-stone-900 border-4 border-amber-400/80 shadow-[0_0_35px_rgba(217,119,6,0.45)]'
                  : 'w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-b from-yellow-500 via-amber-700 to-yellow-950 border-4 border-yellow-300/90 shadow-[0_0_45px_rgba(250,204,21,0.55)]'
              }`}
            >
              {isWoodenFish ? (
                <>
                  {/* Hình tượng Mõ Gỗ truyền thống */}
                  <div className="w-16 h-11 rounded-full bg-gradient-to-b from-amber-400 to-amber-700 border-2 border-amber-200/70 flex flex-col items-center justify-center shadow-inner">
                    <div className="w-10 h-1.5 rounded-full bg-stone-950/80 my-0.5" />
                    <div className="w-2.5 h-2.5 rounded-full bg-stone-950/80" />
                  </div>
                  <span className="mt-1.5 text-xs font-serif font-bold text-amber-100 tracking-wide">
                    GÕ MÕ (+1)
                  </span>
                </>
              ) : (
                <>
                  {/* Hình tượng Đại Hồng Chung bằng đồng */}
                  <Bell
                    className={`w-11 h-11 text-yellow-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-transform ${
                      isPressed ? 'rotate-12 scale-110' : 'group-hover:rotate-6'
                    }`}
                  />
                  <span className="mt-1.5 text-xs font-serif font-bold text-yellow-100 tracking-wide">
                    THỈNH CHUÔNG (+5)
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Hướng dẫn phím tắt & thông tin Pháp danh */}
          <div className="text-center space-y-1">
            <p className="text-xs sm:text-sm text-amber-100 font-medium flex items-center justify-center gap-1.5">
              <Volume2 className="w-4 h-4 text-amber-400" />
              {isWoodenFish
                ? 'Chạm vào Mõ Gỗ hoặc nhấn phím [Space] để tụng kinh'
                : 'Chạm vào Đại Hồng Chung hoặc nhấn phím [Space] để thỉnh chuông'}
            </p>
            <p className="text-[11px] text-stone-400">
              Tổng công đức của <strong className="text-amber-300">{profile.monkName}</strong>:{' '}
              <strong className="text-amber-400">{profile.meritPoints}</strong> điểm
            </p>
          </div>

          {/* Nút bật/tắt Tự động gõ mõ nhịp thiền (chỉ dành cho wooden_fish) + nút Hoàn tất */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {isWoodenFish && (
              <button
                type="button"
                onClick={() => setAutoChant((prev) => !prev)}
                className={`flex-1 min-w-[210px] py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border transition-all ${
                  autoChant
                    ? 'bg-amber-500 text-stone-950 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.45)]'
                    : 'bg-stone-800/90 hover:bg-stone-800 text-amber-200 border-amber-500/35'
                }`}
              >
                {autoChant ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Đang tự động gõ mõ nhịp thiền (Auto)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Tự động gõ mõ nhịp thiền (Auto)</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-2xl text-xs sm:text-sm font-medium bg-stone-800/80 hover:bg-stone-700/90 text-stone-200 border border-stone-700 transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Xá chào & Tiếp tục dạo chùa</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WoodenFishAndBellOverlay;
