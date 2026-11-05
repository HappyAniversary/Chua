import React, { useState, useMemo } from 'react';
import {
  Flame,
  Sparkles,
  HeartHandshake,
  Send,
  X,
  CheckCircle2,
  ScrollText,
  TreeDeciduous,
  Clock,
} from 'lucide-react';
import type { IncenseWish, InteractionZoneId, MonkProfile } from '../../types/game';
import { playIncenseChimeSound } from '../../utils/soundEffects';

export interface IncensePrayerModalProps {
  profile: MonkProfile;
  mode: Extract<InteractionZoneId, 'incense_altar' | 'bodhi_tree'>;
  recentWishes: IncenseWish[];
  onSubmitWish: (wishText: string) => Promise<void>;
  onClose: () => void;
}

const QUICK_WISH_SUGGESTIONS: string[] = [
  'Cầu gia đạo bình an',
  'Cầu cha mẹ mạnh khỏe',
  'Cầu học hành đỗ đạt',
  'Cầu công việc hanh thông',
  'Cầu tâm hồn thanh tịnh',
];

function formatWishTime(timestamp: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'Vừa xong';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const date = new Date(timestamp);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export const IncensePrayerModal: React.FC<IncensePrayerModalProps> = ({
  profile,
  mode,
  recentWishes,
  onSubmitWish,
  onClose,
}) => {
  const isIncenseAltar = mode === 'incense_altar';
  const meritReward = isIncenseAltar ? 10 : 5;

  const [wishText, setWishText] = useState<string>(QUICK_WISH_SUGGESTIONS[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [incenseLit, setIncenseLit] = useState<boolean>(false);

  // The session callback supplies the acknowledged wish with its canonical ID.
  const displayedWishes = useMemo(() => {
    const seen = new Set<string>();
    const unique: IncenseWish[] = [];

    for (const item of recentWishes) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
    }
    return unique.slice(0, 25);
  }, [recentWishes]);

  const handleSelectSuggestion = (suggestion: string) => {
    setWishText(suggestion);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = wishText.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await onSubmitWish(trimmed);
      playIncenseChimeSound();
      setIncenseLit(true);

      setSuccessMessage(
        isIncenseAltar
          ? `Hoan hỷ công đức (+${meritReward} Công Đức)! Nén tâm hương của ${profile.monkName} đã quyện tỏa lên Đại Hùng Bảo Điện.`
          : `Hoan hỷ công đức (+${meritReward} Công Đức)! Thẻ ước nguyện của ${profile.monkName} đã được treo lên Cội Bồ Đề linh thiêng.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Chưa gửi được lời nguyện ước. Nội dung được giữ lại để bạn thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-stone-900 via-stone-900/98 to-stone-950 text-amber-50 shadow-[0_0_60px_rgba(217,119,6,0.28)] overflow-hidden">
        {errorMessage && <p role="alert" className="border-b border-red-500/30 bg-red-950/70 px-5 py-3 text-xs text-red-200">{errorMessage}</p>}
        {/* Đường viền trang trí đỉnh chùa */}
        <div
          className={`h-1.5 w-full ${
            isIncenseAltar
              ? 'bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-700'
              : 'bg-gradient-to-r from-emerald-700 via-amber-400 to-emerald-700'
          }`}
        />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-amber-500/20 bg-stone-900/70">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${
                isIncenseAltar
                  ? 'bg-gradient-to-br from-amber-600/30 to-red-900/40 border-amber-400/50 text-amber-300'
                  : 'bg-gradient-to-br from-emerald-700/30 to-amber-900/40 border-emerald-400/50 text-emerald-300'
              }`}
            >
              {isIncenseAltar ? (
                <Flame className="w-6 h-6 text-amber-400 animate-pulse" />
              ) : (
                <TreeDeciduous className="w-6 h-6 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  +{meritReward} Công Đức
                </span>
                <span className="text-xs text-stone-400">
                  Pháp danh: <strong className="text-amber-200">{profile.monkName}</strong>
                </span>
              </div>
              <h2 className="mt-1 text-lg sm:text-xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200">
                {isIncenseAltar
                  ? 'Dâng Hương & Lễ Phật Tại Đại Hùng Bảo Điện (+10 Công Đức)'
                  : 'Treo Thẻ Ước Nguyện Lên Cội Bồ Đề (+5 Công Đức)'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="p-2 rounded-xl bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung chính có thể cuộn */}
        <div className="flex-1 overflow-y-auto scrollable-modal px-5 py-4 space-y-5">
          {/* Minh họa trực quan Lư Hương hoặc Thẻ Gỗ Bồ Đề */}
          <div className="relative rounded-2xl border border-amber-500/25 bg-gradient-to-r from-stone-950/90 via-amber-950/25 to-stone-950/90 p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl bg-stone-900/90 border border-amber-500/30 shrink-0 overflow-hidden">
              {isIncenseAltar ? (
                <>
                  {/* Ba nén tâm hương và làn khói */}
                  <div className="flex items-end gap-2 h-12 pt-2">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <span
                          className={`w-2 h-2 rounded-full mb-0.5 transition-all duration-500 ${
                            incenseLit
                              ? 'bg-orange-400 shadow-[0_0_10px_#fb923c] scale-125'
                              : 'bg-amber-500/80 shadow-[0_0_6px_#f59e0b]'
                          }`}
                        />
                        <div className="w-0.5 h-7 bg-gradient-to-b from-amber-300 to-red-700 rounded-full" />
                      </div>
                    ))}
                  </div>
                  {/* Bát lư hương đồng */}
                  <div className="w-16 h-6 rounded-b-xl rounded-t-sm bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 border border-amber-300/60 flex items-center justify-center shadow-md">
                    <span className="text-[9px] font-serif font-bold text-stone-950 tracking-wider">
                      PHẬT ĐÀI
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Thẻ gỗ đỏ treo cành Bồ Đề */}
                  <div className="w-1 h-3 bg-amber-400/80" />
                  <div className="w-12 h-16 rounded-lg bg-gradient-to-b from-red-800 via-red-900 to-red-950 border-2 border-amber-400/80 shadow-lg flex flex-col items-center justify-center px-1 text-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 mb-0.5" />
                    <span className="text-[9px] font-serif font-bold text-amber-200 leading-tight">
                      CÁT TƯỜNG
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center sm:text-left space-y-1">
              <p className="text-sm text-amber-100/90 leading-relaxed">
                {isIncenseAltar
                  ? 'Chắp tay trước Đại Hùng Bảo Điện, dâng nén tâm hương thanh tịnh và gửi lời cầu nguyện bình an đến gia quyến cùng chúng sinh.'
                  : 'Viết lời nguyện ước lên thẻ gỗ đỏ và treo dưới tán Bồ Đề cổ thụ nghìn năm để đón nhận năng lượng từ bi, trí tuệ.'}
              </p>
              <p className="text-xs text-amber-400/80 italic">
                “Tâm thành một nén hương thơm — Mười phương Chư Phật chứng minh phước lành.”
              </p>
            </div>
          </div>

          {/* Gợi ý lời nguyện ước nhanh */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300/90">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Gợi ý lời nguyện ước nhanh
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_WISH_SUGGESTIONS.map((suggestion) => {
                const isSelected = wishText.trim() === suggestion;
                return (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`text-xs sm:text-sm px-3 py-1.5 rounded-full border transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 font-semibold border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                        : 'bg-stone-800/80 hover:bg-stone-800 text-amber-100/90 border-amber-500/30 hover:border-amber-400/60'
                    }`}
                  >
                    {suggestion}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form nhập lời nguyện ước riêng */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="incense-wish-input"
                  className="text-xs font-semibold uppercase tracking-wider text-amber-300/90 flex items-center gap-1.5"
                >
                  <HeartHandshake className="w-3.5 h-3.5 text-amber-400" />
                  Lời nguyện ước của bạn
                </label>
                <span className="text-xs text-stone-400">{wishText.length}/160 ký tự</span>
              </div>
              <textarea
                id="incense-wish-input"
                rows={3}
                maxLength={160}
                value={wishText}
                onChange={(e) => setWishText(e.target.value)}
                placeholder="Nhập lời cầu nguyện chân thành của bạn tại đây..."
                className="allow-select w-full rounded-2xl bg-stone-950/90 border border-amber-500/35 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 px-4 py-3 text-sm text-amber-50 placeholder-stone-500 resize-none transition-all"
              />
            </div>

            {successMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-300">Nam Mô Hoan Hỷ Bồ Tát Ma Ha Tát!</p>
                  <p className="mt-0.5 text-emerald-100/90">{successMessage}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!wishText.trim() || isSubmitting}
              className="w-full py-3.5 px-5 rounded-2xl font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:via-yellow-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 shadow-[0_6px_25px_rgba(245,158,11,0.35)] transition-all active:scale-[0.99]"
            >
              <Send className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Đang thành tâm nguyện cầu...'
                  : isIncenseAltar
                  ? 'Thành Tâm Dâng Hương (+10 Công Đức)'
                  : 'Treo Thẻ Ước Nguyện (+5 Công Đức)'}
              </span>
            </button>
          </form>

          {/* Bảng Nguyện Ước Cộng Đồng */}
          <div className="pt-2 border-t border-amber-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-amber-400" />
                Bảng Nguyện Ước Cộng Đồng ({displayedWishes.length})
              </h3>
              <span className="text-[11px] text-stone-400">Trực tiếp tại sân chùa</span>
            </div>

            {displayedWishes.length === 0 ? (
              <div className="rounded-2xl border border-stone-800 bg-stone-950/60 p-5 text-center text-xs sm:text-sm text-stone-400">
                Chưa có lời ước nguyện nào. Hãy là người đầu tiên thắp sáng lời cầu nguyện bình an!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto scrollable-modal pr-1">
                {displayedWishes.map((wish) => (
                  <div
                    key={wish.id}
                    className="rounded-2xl border border-amber-500/20 bg-stone-950/75 px-3.5 py-2.5 flex items-start gap-3 hover:border-amber-500/40 transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 border border-white/25 shadow-sm mt-0.5"
                      style={{ backgroundColor: wish.robeColor }}
                      title={wish.monkName}
                    >
                      {wish.monkName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-amber-200 truncate">
                          {wish.monkName}
                        </span>
                        <span className="text-[11px] text-stone-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatWishTime(wish.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs sm:text-sm text-stone-200 leading-relaxed break-words">
                        “{wish.wishText}”
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncensePrayerModal;
