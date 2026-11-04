import React, { useMemo, useState } from 'react';
import {
  Check,
  Palette,
  RefreshCw,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { ROBE_COLOR_OPTIONS } from '../../constants/templeLayout';
import { updateMonkProfile } from '../../services/authService';
import type { MonkProfile, RobeColor } from '../../types/game';

export interface MonkSetupModalProps {
  profile: MonkProfile;
  isInitialSetup?: boolean;
  onSave: (updatedProfile: MonkProfile) => void;
  onCancel?: () => void;
}

const SUGGESTED_DHARMA_NAMES: string[] = [
  'Thích Tâm An',
  'Chú Tiểu Minh Tuệ',
  'Thích Tâm Tịnh',
  'Tiểu Sư Minh Tâm',
  'Huệ Đăng',
  'Tâm Phúc',
  'Thanh Lương',
  'Giác Ngộ',
  'An Nhiên',
  'Thích Thiện Tâm',
  'Chú Tiểu Từ Bi',
  'Minh Chiếu',
  'Tâm Đức',
  'Phúc Điền',
  'Thích Hạnh Nguyện',
];

export const MonkSetupModal: React.FC<MonkSetupModalProps> = ({
  profile,
  isInitialSetup = false,
  onSave,
  onCancel,
}) => {
  const [monkName, setMonkName] = useState<string>(
    profile.monkName?.trim() || ''
  );
  const [selectedRobe, setSelectedRobe] = useState<RobeColor>(
    profile.robeColor || ROBE_COLOR_OPTIONS[0].color
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRobeInfo = useMemo(
    () =>
      ROBE_COLOR_OPTIONS.find((item) => item.color === selectedRobe) ??
      ROBE_COLOR_OPTIONS[0],
    [selectedRobe]
  );

  const handleSuggestName = () => {
    const candidates = SUGGESTED_DHARMA_NAMES.filter(
      (name) => name !== monkName.trim()
    );
    const randomPick =
      candidates[Math.floor(Math.random() * candidates.length)] ||
      SUGGESTED_DHARMA_NAMES[0];
    setMonkName(randomPick);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanedName = monkName.trim().replace(/\s+/g, ' ');
    if (cleanedName.length < 2) {
      setErrorMessage(
        'Vui lòng nhập Pháp Danh / Tên Chú Tiểu (tối thiểu 2 ký tự).'
      );
      return;
    }
    if (cleanedName.length > 28) {
      setErrorMessage('Pháp Danh không được vượt quá 28 ký tự.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateMonkProfile(profile.uid, {
        monkName: cleanedName,
        robeColor: selectedRobe,
      });
      onSave(updated);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể lưu hồ sơ Chú Tiểu. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const previewName = monkName.trim() || 'Chú Tiểu Tâm An';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md scrollable-modal overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto rounded-3xl bg-stone-900/95 border border-amber-500/35 shadow-[0_0_65px_rgba(245,158,11,0.2)] p-6 sm:p-8 text-amber-50">
        {/* Nút đóng (nếu đang mở chế độ chỉnh sửa từ trong chùa) */}
        {!isInitialSetup && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Đóng bảng thiết lập"
            className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-stone-800/80 hover:bg-stone-700 border border-amber-500/25 flex items-center justify-center text-amber-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Tiêu đề */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isInitialSetup
                ? 'Khởi Tạo Nhân Vật Chú Tiểu'
                : 'Chỉnh Sửa Pháp Danh & Trang Phục'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-amber-200 tracking-tight">
            Đặt Pháp Danh & Chọn Áo Cà Sa
          </h2>
          <p className="text-xs sm:text-sm text-amber-100/75 mt-1">
            Tài khoản <span className="text-amber-300 font-semibold">@{profile.username}</span> — Hãy chọn một Pháp danh an lành và màu áo cà sa hiển thị trên đầu nhân vật trong sân chùa 3D.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-red-950/80 border border-red-400/40 px-4 py-3 text-xs sm:text-sm text-red-200 flex items-center gap-2"
          >
            <span className="text-red-400 font-bold">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Bản Xem Trước Nhân Vật (Avatar Preview 3D-style) */}
            <div className="md:col-span-5 rounded-2xl bg-gradient-to-b from-stone-950 via-stone-900 to-amber-950/40 border border-amber-500/30 p-5 flex flex-col items-center justify-center relative overflow-hidden min-h-[260px]">
              {/* Vầng hào quang phía sau */}
              <div
                className="w-36 h-36 rounded-full blur-2xl opacity-35 absolute top-10 transition-colors duration-300"
                style={{ backgroundColor: selectedRobe }}
              />

              {/* Bảng tên nổi trên đầu giống trong không gian 3D */}
              <div className="relative z-10 mb-3 px-3.5 py-1.5 rounded-full bg-stone-950/90 border border-amber-400/50 shadow-lg flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                  style={{ backgroundColor: selectedRobe }}
                />
                <span className="text-xs font-bold text-amber-100 tracking-wide truncate max-w-[150px]">
                  {previewName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold">
                  ✦ {profile.meritPoints}
                </span>
              </div>

              {/* Hình minh họa Chú Tiểu chắp tay */}
              <div className="relative z-10 flex flex-col items-center">
                <svg
                  viewBox="0 0 140 160"
                  className="w-32 h-36 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]"
                  aria-label="Bản xem trước Chú Tiểu"
                >
                  {/* Vòng tròn hào quang thiền định sau đầu */}
                  <circle
                    cx="70"
                    cy="52"
                    r="34"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    opacity="0.65"
                  />

                  {/* Đầu Chú Tiểu */}
                  <circle cx="70" cy="52" r="24" fill="#fcd39c" />

                  {/* 6 chấm hương giới điệp trên đầu */}
                  <circle cx="64" cy="36" r="1.4" fill="#b45309" opacity="0.7" />
                  <circle cx="70" cy="35" r="1.4" fill="#b45309" opacity="0.7" />
                  <circle cx="76" cy="36" r="1.4" fill="#b45309" opacity="0.7" />
                  <circle cx="64" cy="40" r="1.4" fill="#b45309" opacity="0.7" />
                  <circle cx="70" cy="39" r="1.4" fill="#b45309" opacity="0.7" />
                  <circle cx="76" cy="40" r="1.4" fill="#b45309" opacity="0.7" />

                  {/* Đôi mắt hiền từ nhắm hờ thiền định */}
                  <path
                    d="M58 52 Q62 49 66 52"
                    stroke="#451a03"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <path
                    d="M74 52 Q78 49 82 52"
                    stroke="#451a03"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />

                  {/* Má hồng hiền hòa */}
                  <circle cx="55" cy="57" r="3" fill="#f97316" opacity="0.25" />
                  <circle cx="85" cy="57" r="3" fill="#f97316" opacity="0.25" />

                  {/* Nụ cười an nhiên */}
                  <path
                    d="M65 60 Q70 64 75 60"
                    stroke="#78350f"
                    strokeWidth="1.8"
                    fill="none"
                    strokeLinecap="round"
                  />

                  {/* Thân áo cà sa (đổi màu theo selectedRobe) */}
                  <path
                    d="M36 142 C36 96 48 78 70 78 C92 78 104 96 104 142 Z"
                    fill={selectedRobe}
                  />

                  {/* Nếp áo vạt chéo cà sa */}
                  <path
                    d="M55 79 L70 96 L85 79"
                    fill="none"
                    stroke="#fef3c7"
                    strokeWidth="3"
                    opacity="0.75"
                  />
                  <path
                    d="M48 92 L92 128"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    opacity="0.55"
                  />

                  {/* Đôi bàn tay chắp lễ Phật trước ngực */}
                  <ellipse cx="70" cy="108" rx="9" ry="12" fill="#fcd39c" />
                  <line
                    x1="70"
                    y1="97"
                    x2="70"
                    y2="119"
                    stroke="#b45309"
                    strokeWidth="1.2"
                  />
                </svg>
              </div>

              <div className="mt-2 text-center">
                <span className="text-xs font-semibold text-amber-200">
                  Áo Cà Sa: {selectedRobeInfo.name}
                </span>
                <p className="text-[11px] text-amber-100/65 mt-0.5 line-clamp-2">
                  {selectedRobeInfo.description}
                </p>
              </div>
            </div>

            {/* Cột phải: Nhập Pháp Danh + Chọn màu áo */}
            <div className="md:col-span-7 space-y-5">
              {/* Ô nhập Pháp Danh */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="monk-name-input"
                    className="text-xs font-semibold uppercase tracking-wider text-amber-200/90"
                  >
                    Pháp Danh / Tên Chú Tiểu
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestName}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 px-2.5 py-1 rounded-lg transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Gợi ý Pháp danh hay</span>
                  </button>
                </div>

                <input
                  id="monk-name-input"
                  type="text"
                  value={monkName}
                  onChange={(e) => setMonkName(e.target.value)}
                  placeholder="Ví dụ: Thích Tâm An, Chú Tiểu Minh Tuệ..."
                  maxLength={28}
                  disabled={isSaving}
                  className="w-full px-4 py-2.5 rounded-xl bg-stone-950/90 border border-amber-500/35 text-amber-50 placeholder-amber-200/35 text-sm font-medium focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                />

                {/* Các chip gợi ý nhanh */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Thích Tâm An',
                    'Chú Tiểu Minh Tuệ',
                    'An Nhiên',
                    'Huệ Đăng',
                    'Tâm Phúc',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => {
                        setMonkName(sample);
                        setErrorMessage(null);
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition ${
                        monkName.trim() === sample
                          ? 'bg-amber-500/25 border-amber-400 text-amber-100 font-semibold'
                          : 'bg-stone-950/70 border-amber-500/20 text-amber-200/75 hover:border-amber-400/40'
                      }`}
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bộ chọn 5 màu áo cà sa */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200/90 mb-2">
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>Chọn Màu Áo Cà Sa (5 Sắc Thái Thiền Môn)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ROBE_COLOR_OPTIONS.map((option) => {
                    const isSelected = option.color === selectedRobe;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedRobe(option.color)}
                        className={`p-2.5 rounded-xl border text-left transition flex items-center gap-3 ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-300 shadow-md'
                            : 'bg-stone-950/70 border-amber-500/20 hover:border-amber-400/40'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full shrink-0 border-2 border-white/70 flex items-center justify-center shadow"
                          style={{ backgroundColor: option.color }}
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-amber-100 truncate">
                            {option.name}
                          </div>
                          <div className="text-[10px] text-amber-200/65 truncate">
                            {option.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Nút Lưu Hồ Sơ & Bước Vào Sân Chùa */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-amber-500/20">
            {!isInitialSetup && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/30 text-sm font-semibold transition"
              >
                Hủy Bỏ
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {isSaving
                  ? 'Đang lưu Pháp danh...'
                  : isInitialSetup
                    ? 'Hoàn Tất & Bước Vào Sân Chùa'
                    : 'Lưu Pháp Danh & Màu Áo'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MonkSetupModal;
