import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useCompactLayout } from '../../hooks/useCompactLayout';
import type { JoystickVector } from '../../types/game';

export interface VirtualJoystickProps {
  vector: JoystickVector;
  onChange: (x: number, y: number, active: boolean) => void;
  size?: number;
  disabled?: boolean;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  vector,
  onChange,
  size = 132,
  disabled = false,
}) => {
  const isCompactLayout = useCompactLayout();
  const actualSize = isCompactLayout ? Math.min(size, 104) : size;
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const previousSizeRef = useRef(actualSize);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const knobSize = Math.round(actualSize * 0.42);
  const maxRadius = Math.max(24, Math.round((actualSize - knobSize) / 2 - 4));

  const updateFromClientPoint = useCallback(
    (clientX: number, clientY: number) => {
      const baseEl = baseRef.current;
      if (!baseEl) return;

      const rect = baseEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const rawDx = clientX - centerX;
      const rawDy = clientY - centerY;
      const dist = Math.hypot(rawDx, rawDy);

      const clampScale = dist > maxRadius ? maxRadius / dist : 1;
      const clampedDx = rawDx * clampScale;
      const clampedDy = rawDy * clampScale;

      setDragOffset({ x: clampedDx, y: clampedDy });

      // Chuyển đổi sang hệ trục chuẩn:
      // x: -1 (Trái) -> +1 (Phải)
      // y: +1 (Tiến / Đẩy lên) -> -1 (Lùi / Kéo xuống)
      const normX = Math.max(-1, Math.min(1, clampedDx / maxRadius));
      const normY = Math.max(-1, Math.min(1, -clampedDy / maxRadius));

      onChange(normX, normY, true);
    },
    [maxRadius, onChange]
  );

  const releaseJoystick = useCallback(() => {
    if (activePointerIdRef.current !== null && baseRef.current) {
      try {
        if (baseRef.current.hasPointerCapture(activePointerIdRef.current)) {
          baseRef.current.releasePointerCapture(activePointerIdRef.current);
        }
      } catch {
        // Bỏ qua nếu pointer đã tự giải phóng
      }
    }
    activePointerIdRef.current = null;
    setIsDragging(false);
    setDragOffset({ x: 0, y: 0 });
    onChange(0, 0, false);
  }, [onChange]);

  useEffect(() => {
    if (disabled && (isDragging || activePointerIdRef.current !== null)) {
      releaseJoystick();
    }
  }, [disabled, isDragging, releaseJoystick]);

  useEffect(() => {
    const releaseAfterResize = () => {
      if (activePointerIdRef.current !== null) releaseJoystick();
    };
    window.addEventListener('resize', releaseAfterResize);
    window.addEventListener('orientationchange', releaseAfterResize);
    return () => {
      window.removeEventListener('resize', releaseAfterResize);
      window.removeEventListener('orientationchange', releaseAfterResize);
    };
  }, [releaseJoystick]);

  useEffect(() => {
    if (previousSizeRef.current !== actualSize) {
      previousSizeRef.current = actualSize;
      if (activePointerIdRef.current !== null) releaseJoystick();
    }
  }, [actualSize, releaseJoystick]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // Với chuột máy tính, chỉ nhận chuột trái (button === 0)
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.stopPropagation();
    e.preventDefault();

    activePointerIdRef.current = e.pointerId;
    setIsDragging(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Fallback an toàn nếu trình duyệt không hỗ trợ setPointerCapture
    }

    updateFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (activePointerIdRef.current !== e.pointerId) return;

    e.stopPropagation();
    updateFromClientPoint(e.clientX, e.clientY);
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    releaseJoystick();
  };

  // Tính độ lệch hiển thị của núm gạt (knob):
  // - Khi đang kéo bằng chuột/chạm: bám trực tiếp theo dragOffset
  // - Khi bấm phím WASD / Arrow (vector.source === 'keyboard'): nghiêng theo vector
  const displayOffsetX = isDragging
    ? dragOffset.x
    : vector.active
      ? vector.x * maxRadius
      : 0;
  const displayOffsetY = isDragging
    ? dragOffset.y
    : vector.active
      ? -vector.y * maxRadius
      : 0;

  const isActive = !disabled && (isDragging || vector.active);

  const activeUp = isActive && vector.y > 0.25;
  const activeDown = isActive && vector.y < -0.25;
  const activeLeft = isActive && vector.x < -0.25;
  const activeRight = isActive && vector.x > 0.25;

  return (
    <div
      className={`temple-joystick fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-30 flex flex-col items-center gap-1.5 select-none pointer-events-auto ${
        disabled ? 'opacity-45 pointer-events-none' : 'opacity-100'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Đế cần gạt tròn phong cách La Bàn Thiền Môn */}
      <div
        ref={baseRef}
        role="slider"
        aria-label="Cần gạt di chuyển Chú Tiểu"
        aria-disabled={disabled}
        aria-valuetext={`X: ${vector.x.toFixed(2)}, Y: ${vector.y.toFixed(2)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onLostPointerCapture={releaseJoystick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: `${actualSize}px`,
          height: `${actualSize}px`,
          touchAction: 'none',
        }}
        className={`relative rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-shadow duration-200 bg-stone-950/80 backdrop-blur-md border-2 ${
          isActive
            ? 'border-amber-400/80 shadow-[0_0_28px_rgba(245,158,11,0.35)]'
            : 'border-amber-500/40 shadow-[0_8px_24px_rgba(0,0,0,0.65)] hover:border-amber-400/60'
        }`}
      >
        {/* Vòng tròn trang trí nội tâm và trục tọa độ mảnh */}
        <div className="absolute inset-3 rounded-full border border-amber-500/20 pointer-events-none" />
        <div className="absolute inset-7 rounded-full border border-dashed border-amber-400/15 pointer-events-none" />
        <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent pointer-events-none" />
        <div className="absolute h-full w-px bg-gradient-to-b from-transparent via-amber-500/20 to-transparent pointer-events-none" />

        {/* 4 Mũi tên chỉ hướng (Bắc - Nam - Đông - Tây) */}
        <ChevronUp
          className={`absolute top-1.5 w-4 h-4 pointer-events-none transition-all duration-150 ${
            activeUp
              ? 'text-amber-300 scale-125 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
              : 'text-amber-500/45'
          }`}
        />
        <ChevronDown
          className={`absolute bottom-1.5 w-4 h-4 pointer-events-none transition-all duration-150 ${
            activeDown
              ? 'text-amber-300 scale-125 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
              : 'text-amber-500/45'
          }`}
        />
        <ChevronLeft
          className={`absolute left-1.5 w-4 h-4 pointer-events-none transition-all duration-150 ${
            activeLeft
              ? 'text-amber-300 scale-125 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
              : 'text-amber-500/45'
          }`}
        />
        <ChevronRight
          className={`absolute right-1.5 w-4 h-4 pointer-events-none transition-all duration-150 ${
            activeRight
              ? 'text-amber-300 scale-125 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]'
              : 'text-amber-500/45'
          }`}
        />

        {/* Núm gạt (Knob) phát sáng vàng hổ phách */}
        <div
          style={{
            width: `${knobSize}px`,
            height: `${knobSize}px`,
            transform: `translate3d(${displayOffsetX}px, ${displayOffsetY}px, 0)`,
            transition: isDragging
              ? 'none'
              : 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          className={`relative rounded-full pointer-events-none flex items-center justify-center bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-2 ${
            isActive
              ? 'border-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.85),inset_0_2px_6px_rgba(255,255,255,0.65)]'
              : 'border-amber-200/80 shadow-[0_4px_14px_rgba(0,0,0,0.6),inset_0_2px_4px_rgba(255,255,255,0.45)]'
          }`}
        >
          {/* Tâm hoa sen / kim hoàn trên mặt núm gạt */}
          <div className="w-4 h-4 rounded-full bg-amber-100/85 border border-amber-700/40 shadow-inner" />
        </div>
      </div>

      {/* Dòng chú thích hướng dẫn phía dưới */}
      <div className="temple-joystick-caption px-2.5 py-0.5 rounded-full bg-stone-950/80 border border-amber-500/30 backdrop-blur-sm shadow text-[11px] font-medium text-amber-200/85 tracking-wide whitespace-nowrap pointer-events-none">
        Kéo chuột / Chạm hoặc WASD
      </div>
    </div>
  );
};

export default VirtualJoystick;
