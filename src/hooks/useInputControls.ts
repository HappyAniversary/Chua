import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { JoystickVector } from '../types/game';

export interface UseInputControlsReturn {
  joystickVector: JoystickVector;
  inputVectorRef: MutableRefObject<JoystickVector>;
  setJoystickInput: (x: number, y: number, active: boolean) => void;
  resetInput: () => void;
}

const IDLE_VECTOR: JoystickVector = {
  x: 0,
  y: 0,
  active: false,
  source: 'none',
};

const MOVEMENT_KEY_CODES = new Set<string>([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

/**
 * Chuẩn hóa mã phím từ KeyboardEvent (hỗ trợ cả event.code lẫn event.key)
 */
function resolveMovementCode(event: KeyboardEvent): string | null {
  if (MOVEMENT_KEY_CODES.has(event.code)) {
    return event.code;
  }
  switch (event.key) {
    case 'w':
    case 'W':
      return 'KeyW';
    case 's':
    case 'S':
      return 'KeyS';
    case 'a':
    case 'A':
      return 'KeyA';
    case 'd':
    case 'D':
      return 'KeyD';
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
      return event.key;
    default:
      return null;
  }
}

/**
 * Kiểm tra xem người dùng có đang gõ chữ trong ô nhập liệu hay không
 * để tránh nhân vật tự di chuyển khi nhập Pháp danh hoặc chat.
 */
function isEditableElementActive(eventTarget?: EventTarget | null): boolean {
  if (typeof document === 'undefined') return false;

  const checkElement = (el: Element | null | undefined): boolean => {
    if (!el) return false;
    const tagName = el.tagName?.toUpperCase();
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return true;
    }
    if ((el as HTMLElement).isContentEditable) {
      return true;
    }
    return false;
  };

  return (
    checkElement(document.activeElement) ||
    checkElement(eventTarget instanceof Element ? eventTarget : null)
  );
}

/**
 * Hook hợp nhất tín hiệu điều khiển từ Bàn phím (WASD / Phím mũi tên)
 * và Cần gạt ảo (Virtual Joystick trên màn hình PC & Mobile).
 */
export function useInputControls(enabled: boolean = true): UseInputControlsReturn {
  const [joystickVector, setJoystickVector] = useState<JoystickVector>(IDLE_VECTOR);
  const inputVectorRef = useRef<JoystickVector>({ ...IDLE_VECTOR });

  const pressedKeysRef = useRef<Set<string>>(new Set());
  const pointerJoystickRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  const applyVector = useCallback((next: JoystickVector) => {
    inputVectorRef.current = next;
    setJoystickVector((prev) => {
      if (
        prev.active === next.active &&
        prev.source === next.source &&
        Math.abs(prev.x - next.x) < 0.001 &&
        Math.abs(prev.y - next.y) < 0.001
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const computeKeyboardVector = useCallback((): JoystickVector => {
    const keys = pressedKeysRef.current;
    let rawX = 0;
    let rawY = 0;

    if (keys.has('KeyW') || keys.has('ArrowUp')) rawY += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) rawY -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) rawX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) rawX += 1;

    if (rawX === 0 && rawY === 0) {
      return IDLE_VECTOR;
    }

    // Chuẩn hóa vector chéo (W+D, W+A, S+D, S+A) để độ dài không vượt quá 1
    const length = Math.hypot(rawX, rawY);
    return {
      x: rawX / length,
      y: rawY / length,
      active: true,
      source: 'keyboard',
    };
  }, []);

  const syncCombinedInput = useCallback(() => {
    if (!enabledRef.current) {
      applyVector(IDLE_VECTOR);
      return;
    }

    // Ưu tiên 1: Nếu người chơi đang kéo Virtual Joystick trên màn hình
    const pointerState = pointerJoystickRef.current;
    if (pointerState.active) {
      const length = Math.hypot(pointerState.x, pointerState.y);
      const scale = length > 1 ? 1 / length : 1;
      const clampedX = pointerState.x * scale;
      const clampedY = pointerState.y * scale;
      const isMoving = length > 0.02;

      applyVector({
        x: isMoving ? clampedX : 0,
        y: isMoving ? clampedY : 0,
        active: isMoving,
        source: 'joystick',
      });
      return;
    }

    // Ưu tiên 2: Nếu không kéo Joystick, kiểm tra phím WASD / Arrow
    const keyboardVec = computeKeyboardVector();
    applyVector(keyboardVec);
  }, [applyVector, computeKeyboardVector]);

  const setJoystickInput = useCallback(
    (x: number, y: number, active: boolean) => {
      if (!enabledRef.current) {
        pointerJoystickRef.current = { x: 0, y: 0, active: false };
        applyVector(IDLE_VECTOR);
        return;
      }

      if (!active) {
        pointerJoystickRef.current = { x: 0, y: 0, active: false };
      } else {
        const len = Math.hypot(x, y);
        const factor = len > 1 ? 1 / len : 1;
        pointerJoystickRef.current = {
          x: x * factor,
          y: y * factor,
          active: true,
        };
      }

      syncCombinedInput();
    },
    [applyVector, syncCombinedInput]
  );

  const resetInput = useCallback(() => {
    pressedKeysRef.current.clear();
    pointerJoystickRef.current = { x: 0, y: 0, active: false };
    applyVector(IDLE_VECTOR);
  }, [applyVector]);

  // Reset ngay khi enabled chuyển sang false
  useEffect(() => {
    if (!enabled) {
      resetInput();
    }
  }, [enabled, resetInput]);

  // Lắng nghe sự kiện bàn phím trên window
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableElementActive(event.target)) {
        if (pressedKeysRef.current.size > 0) {
          pressedKeysRef.current.clear();
          syncCombinedInput();
        }
        return;
      }

      const code = resolveMovementCode(event);
      if (!code) return;

      if (code.startsWith('Arrow')) {
        event.preventDefault();
      }

      if (!pressedKeysRef.current.has(code)) {
        pressedKeysRef.current.add(code);
        syncCombinedInput();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const code = resolveMovementCode(event);
      if (!code) return;

      if (pressedKeysRef.current.has(code)) {
        pressedKeysRef.current.delete(code);
        syncCombinedInput();
      }
    };

    const handleWindowBlur = () => {
      resetInput();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resetInput();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, resetInput, syncCombinedInput]);

  return {
    joystickVector,
    inputVectorRef,
    setJoystickInput,
    resetInput,
  };
}
