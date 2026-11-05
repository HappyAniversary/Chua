import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Share2,
  RotateCcw,
  Scroll,
  Compass,
  BookOpen,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { FortuneRank, FortuneSlip, MonkProfile } from '../../types/game';
import {
  playFortuneShakeSound,
  playFortuneRevealSound,
} from '../../utils/soundEffects';
import { drawRandomFortuneSlip, FORTUNE_SLIPS } from '../../data/fortunes';

export interface FortuneDrawModalProps {
  profile: MonkProfile;
  onFortuneDrawn: (slip: FortuneSlip) => void;
  onShareFortune?: (slip: FortuneSlip) => Promise<void> | void;
  onClose: () => void;
}

type DrawStage = 'ready' | 'shaking' | 'revealed';

function getRankBadgeStyle(rank: FortuneRank): string {
  switch (rank) {
    case 'Thượng Thượng':
      return 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-red-950 border-yellow-100 shadow-[0_0_20px_rgba(253,224,71,0.6)]';
    case 'Thượng Cát':
      return 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-stone-950 border-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.45)]';
    case 'Trung Cát':
      return 'bg-amber-500/90 text-stone-950 border-amber-300';
    case 'Bình An':
    default:
      return 'bg-emerald-500/90 text-stone-950 border-emerald-200';
  }
}

export const FortuneDrawModal: React.FC<FortuneDrawModalProps> = ({
  profile,
  onFortuneDrawn,
  onShareFortune,
  onClose,
}) => {
  const [stage, setStage] = useState<DrawStage>('ready');
  const [drawnSlip, setDrawnSlip] = useState<FortuneSlip | null>(null);
  const [stickEmerging, setStickEmerging] = useState<boolean>(false);
  const [sharedSuccess, setSharedSuccess] = useState<boolean>(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const shakeTimerRef = useRef<number | null>(null);
  const emergeTimerRef = useRef<number | null>(null);
  const secondRattleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
      if (emergeTimerRef.current) window.clearTimeout(emergeTimerRef.current);
      if (secondRattleTimerRef.current) window.clearTimeout(secondRattleTimerRef.current);
    };
  }, []);

  const handleShakeTube = () => {
    if (stage === 'shaking') return;

    setSharedSuccess(false);
    setShareError(null);
    setStickEmerging(false);
    setStage('shaking');

    // Phát tiếng lắc ống xăm tre lách cách
    playFortuneShakeSound();
    secondRattleTimerRef.current = window.setTimeout(() => {
      playFortuneShakeSound();
    }, 450);

    // Sau 0.72s bắt đầu hiệu ứng 1 thẻ xăm đầu đỏ trồi cao lên khỏi ống tre
    emergeTimerRef.current = window.setTimeout(() => {
      setStickEmerging(true);
    }, 720);

    // Đúng 1.1 giây hoàn tất lắc ống xăm và mở tờ sớ giải quẻ
    shakeTimerRef.current = window.setTimeout(() => {
      const slip = drawRandomFortuneSlip();
      playFortuneRevealSound();
      setDrawnSlip(slip);
      setStage('revealed');
      onFortuneDrawn(slip);
    }, 1100);
  };

  const handleDrawAgain = () => {
    if (isSharing) return;
    setDrawnSlip(null);
    setStickEmerging(false);
    setSharedSuccess(false);
    setShareError(null);
    setStage('ready');
  };

  const handleShare = async () => {
    if (!drawnSlip || !onShareFortune || isSharing) return;
    setIsSharing(true);
    setShareError(null);
    try {
      await onShareFortune(drawnSlip);
      setSharedSuccess(true);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Chưa chia sẻ được quẻ. Hãy thử lại.');
    } finally {
      setIsSharing(false);
    }
  };

  const totalSlipsCount = FORTUNE_SLIPS.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget && stage !== 'shaking') {
          onClose();
        }
      }}
    >
      <style>{`
        @keyframes bambooTubeShake {
          0%, 100% { transform: rotate(0deg) translateY(0px); }
          15% { transform: rotate(-9deg) translateY(-6px); }
          30% { transform: rotate(9deg) translateY(3px); }
          45% { transform: rotate(-11deg) translateY(-8px); }
          60% { transform: rotate(10deg) translateY(4px); }
          75% { transform: rotate(-7deg) translateY(-5px); }
          90% { transform: rotate(6deg) translateY(2px); }
        }
      `}</style>

      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl border-2 border-amber-500/45 bg-gradient-to-b from-stone-900 via-stone-900/98 to-stone-950 text-amber-50 shadow-[0_0_65px_rgba(217,119,6,0.32)] overflow-hidden">
        {/* Đường viền vàng son trên đỉnh */}
        <div className="h-1.5 w-full bg-gradient-to-r from-red-800 via-yellow-400 to-red-800" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-amber-500/20 bg-stone-900/75">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-800/60 to-amber-700/40 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
              <Scroll className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  +8 Công Đức
                </span>
                <span className="text-xs text-stone-400">
                  Bộ {totalSlipsCount} Quẻ Xăm Cát Tường
                </span>
              </div>
              <h2 className="mt-1 text-lg sm:text-xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200">
                Xin Xăm Đầu Năm & Giải Quẻ Bình An
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={stage === 'shaking'}
            aria-label="Đóng cửa sổ"
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 disabled:opacity-40 text-stone-300 hover:text-white border border-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung chính */}
        <div className="flex-1 overflow-y-auto scrollable-modal px-5 py-5">
          {stage !== 'revealed' || !drawnSlip ? (
            /* BƯỚC 1 & BƯỚC 2: Minh họa Ống Xăm Tre truyền thống & Hiệu ứng lắc */
            <div className="flex flex-col items-center text-center py-4 space-y-6">
              <div className="space-y-1.5 max-w-md">
                <p className="text-sm sm:text-base text-amber-100/95">
                  Pháp danh <strong className="text-amber-300">{profile.monkName}</strong> hãy tĩnh tâm,
                  chắp tay niệm danh hiệu Phật và thành tâm lắc ống xăm tre để thỉnh quẻ lành.
                </p>
                <p className="text-xs text-amber-400/80 italic">
                  “Hữu duyên thiên lý năng tương ngộ — Tâm thành ắt ứng quẻ cát tường”
                </p>
              </div>

              {/* Hình minh họa Ống Xăm Tre truyền thống */}
              <div className="relative w-52 h-64 flex flex-col items-center justify-end py-4">
                {/* Hào quang nền */}
                <div
                  className={`absolute inset-4 rounded-full bg-amber-500/15 blur-2xl transition-all duration-500 ${
                    stage === 'shaking' ? 'scale-125 bg-amber-400/30' : 'scale-100'
                  }`}
                />

                {/* Khối Ống Xăm Tre + Các thẻ xăm */}
                <div
                  style={
                    stage === 'shaking'
                      ? { animation: 'bambooTubeShake 0.42s ease-in-out infinite' }
                      : undefined
                  }
                  className="relative flex flex-col items-center"
                >
                  {/* Các thẻ xăm tre bên trong ống */}
                  <div className="relative flex items-end justify-center gap-1.5 h-24 -mb-4 z-10 px-4">
                    {[-22, -11, -3, 6, 15, 24].map((deg, index) => {
                      const isChosenStick = index === 2;
                      return (
                        <div
                          key={index}
                          style={{
                            transform:
                              isChosenStick && stickEmerging
                                ? 'translateY(-44px) rotate(0deg) scale(1.08)'
                                : `rotate(${deg}deg)`,
                          }}
                          className={`w-3.5 rounded-t-md border border-amber-900/60 transition-all duration-300 flex flex-col items-center overflow-hidden shadow-md ${
                            isChosenStick
                              ? 'h-24 bg-gradient-to-b from-amber-200 via-amber-300 to-amber-500 z-20'
                              : 'h-20 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600'
                          }`}
                        >
                          {/* Đầu sơn đỏ của thẻ xăm */}
                          <div className="w-full h-4 bg-gradient-to-b from-red-600 to-red-800 border-b border-amber-300/60" />
                          {isChosenStick && stickEmerging && (
                            <span className="mt-1 text-[8px] font-bold text-red-900 leading-none">
                              吉
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Thân Ống Xăm Tre chạm khắc truyền thống */}
                  <div className="relative z-20 w-32 h-40 rounded-b-3xl rounded-t-xl bg-gradient-to-r from-amber-900 via-amber-700 to-amber-950 border-2 border-amber-400/80 shadow-[0_12px_35px_rgba(0,0,0,0.75)] flex flex-col items-center justify-between py-3 overflow-hidden">
                    {/* Đai đồng trên */}
                    <div className="w-full h-2.5 bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-700 border-y border-amber-200/50" />

                    {/* Nhãn chữ Hán / Việt ở giữa ống xăm */}
                    <div className="w-16 h-20 rounded-xl bg-red-900/95 border-2 border-amber-300/90 shadow-inner flex flex-col items-center justify-center px-1">
                      <span className="text-[10px] text-amber-300 font-semibold tracking-widest">
                        LINH XĂM
                      </span>
                      <span className="text-lg font-serif font-extrabold text-yellow-300 leading-tight my-0.5">
                        ĐẠI CÁT
                      </span>
                      <span className="text-[9px] text-amber-200/80">BÌNH AN</span>
                    </div>

                    {/* Đai đồng dưới */}
                    <div className="w-full h-2.5 bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-700 border-y border-amber-200/50" />
                  </div>
                </div>
              </div>

              {/* Trạng thái đang lắc hoặc nút bấm */}
              <div className="w-full max-w-sm space-y-3">
                <button
                  type="button"
                  onClick={handleShakeTube}
                  disabled={stage === 'shaking'}
                  className="w-full py-4 px-6 rounded-2xl font-serif font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-800 via-amber-500 to-red-800 hover:from-red-700 hover:via-yellow-400 hover:to-red-700 disabled:opacity-75 text-stone-950 border-2 border-amber-200/80 shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all active:scale-95"
                >
                  <Sparkles className={`w-5 h-5 ${stage === 'shaking' ? 'animate-spin' : ''}`} />
                  <span>
                    {stage === 'shaking'
                      ? 'Đang lắc ống xăm thỉnh quẻ...'
                      : 'Thành Tâm Lắc Ống Xăm'}
                  </span>
                </button>

                <p className="text-xs text-stone-400">
                  Mỗi lần xin xăm đầu năm tích lũy thêm +8 Công Đức cho Chú Tiểu.
                </p>
              </div>
            </div>
          ) : (
            /* BƯỚC 3: Mở tờ giấy sớ đỏ viền vàng hiển thị chi tiết Quẻ Xăm */
            <div className="space-y-5 animate-fadeIn">
              {/* Tờ giấy sớ đỏ viền vàng truyền thống */}
              <div className="relative rounded-3xl border-2 border-yellow-400/90 bg-gradient-to-b from-red-950 via-red-900/95 to-red-950 p-5 sm:p-6 shadow-[0_0_45px_rgba(220,38,38,0.35)] overflow-hidden">
                {/* Hoa văn góc tờ sớ */}
                <div className="pointer-events-none absolute inset-2 rounded-2xl border border-amber-300/35" />

                {/* Số quẻ & Hạng quẻ */}
                <div className="relative flex flex-col items-center text-center border-b border-amber-400/30 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest bg-red-950/90 text-amber-300 border border-amber-400/50">
                      Quẻ Số {drawnSlip.id}
                    </span>
                    <span
                      className={`px-3.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider border ${getRankBadgeStyle(
                        drawnSlip.rank
                      )}`}
                    >
                      {drawnSlip.rank}
                    </span>
                  </div>

                  {/* Tên quẻ */}
                  <h3 className="text-2xl sm:text-3xl font-serif font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-200 drop-shadow">
                    {drawnSlip.title}
                  </h3>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Quẻ lành ứng duyên cho Pháp danh{' '}
                    <strong className="text-yellow-300">{profile.monkName}</strong>
                  </p>
                </div>

                {/* 4 câu Thơ Kệ */}
                <div className="relative my-4 py-4 px-4 rounded-2xl bg-red-950/75 border border-amber-400/40 text-center space-y-1.5 shadow-inner">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400/90 mb-2 flex items-center justify-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Thơ Kệ Cát Tường</span>
                  </div>
                  {drawnSlip.poem.map((line, idx) => (
                    <p
                      key={idx}
                      className="text-sm sm:text-base font-serif italic text-yellow-100 leading-relaxed tracking-wide"
                    >
                      {line}
                    </p>
                  ))}
                </div>

                {/* Lời Giải Nghĩa & Lời Khuyên Tu Tâm */}
                <div className="relative space-y-3 text-left">
                  <div className="rounded-2xl bg-stone-950/55 border border-amber-400/30 p-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      Lời Giải Nghĩa
                    </h4>
                    <p className="text-xs sm:text-sm text-amber-50/95 leading-relaxed">
                      {drawnSlip.meaning}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-stone-950/55 border border-amber-400/30 p-3.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 mb-1">
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      Lời Khuyên Tu Tâm
                    </h4>
                    <p className="text-xs sm:text-sm text-amber-50/95 leading-relaxed">
                      {drawnSlip.advice}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thông báo đã chia sẻ lên Kênh Chat Chùa */}
              {shareError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/70 p-3 text-xs text-red-200">{shareError}</p>}
              {sharedSuccess && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Đã chia sẻ quẻ lành lên Kênh Chat Chùa để lan tỏa năng lượng bình an!</span>
                </div>
              )}

              {/* Các nút hành động: Chia sẻ quẻ lành & Xin lại quẻ khác */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {onShareFortune && (
                  <button
                    type="button"
                    onClick={handleShare}
                    disabled={sharedSuccess || isSharing}
                    className="flex-1 py-3.5 px-4 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-60 text-stone-950 shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>
                      {isSharing ? 'Đang chia sẻ…' : sharedSuccess
                        ? 'Đã Chia Sẻ Lên Kênh Chat Chùa'
                        : 'Chia sẻ quẻ lành lên Kênh Chat Chùa'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDrawAgain}
                  disabled={isSharing}
                  className="py-3.5 px-5 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/35 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Xin Lại Quẻ Khác</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FortuneDrawModal;
