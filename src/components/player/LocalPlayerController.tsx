import React, { type MutableRefObject, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CAMERA_DEFAULTS,
  PLAYER_COLLISION_RADIUS,
  PLAYER_MOVEMENT_SPEED,
  PLAYER_ROTATION_LERP,
  findNearestInteractionZone,
  getGroundHeight,
  resolveMovement,
} from '../../constants/templeLayout';
import type {
  CameraControlState,
  ChatBubbleState,
  InteractionZoneConfig,
  InteractionZoneId,
  JoystickVector,
  MonkActionState,
  MonkProfile,
  Vector3Tuple,
} from '../../types/game';
import { MonkAvatar, type MonkTransformState } from './MonkAvatar';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import { displacementIsWalking, motionDelta, resolveMotionInSteps } from '../../utils/playerMotion';

export interface LocalPlayerControllerProps {
  profile: MonkProfile;
  inputVectorRef: MutableRefObject<JoystickVector>;
  cameraControlRef: MutableRefObject<CameraControlState>;
  playerTransformRef: MutableRefObject<MonkTransformState>;
  forcedActionState?: MonkActionState | null;
  chatBubble?: ChatBubbleState | null;
  onZoneChange?: (zone: InteractionZoneConfig | null) => void;
  onPositionSync?: (
    position: Vector3Tuple,
    rotationY: number,
    actionState: MonkActionState
  ) => void;
}

/** Tần số tối đa gửi sync tọa độ lên HUD: 250ms (4Hz) */
const POSITION_SYNC_INTERVAL_MS = 250;

/** Ngưỡng khoảng cách tối thiểu để kích hoạt đồng bộ tọa độ (0.2m) */
const POSITION_SYNC_DISTANCE_THRESHOLD = 0.2;
const POSITION_SYNC_DIST_SQ_THRESHOLD =
  POSITION_SYNC_DISTANCE_THRESHOLD * POSITION_SYNC_DISTANCE_THRESHOLD;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerpShortestAngle(
  current: number,
  target: number,
  factor: number
): number {
  const twoPi = Math.PI * 2;
  let delta = (target - current) % twoPi;
  if (delta > Math.PI) {
    delta -= twoPi;
  } else if (delta < -Math.PI) {
    delta += twoPi;
  }
  return current + delta * factor;
}

const LocalPlayerControllerComponent: React.FC<LocalPlayerControllerProps> = ({
  profile,
  inputVectorRef,
  cameraControlRef,
  playerTransformRef,
  forcedActionState = null,
  chatBubble = null,
  onZoneChange,
  onPositionSync,
}) => {
  const lastZoneIdRef = useRef<InteractionZoneId | null | undefined>(undefined);
  const lastSyncTimeRef = useRef<number>(0);
  const lastSyncedPosRef = useRef<Vector3Tuple | null>(null);
  const lastSyncedStateRef = useRef<MonkActionState | null>(null);

  useFrame((_, delta) => {
    const dt = motionDelta(delta);
    const input = inputVectorRef.current;
    const yaw = cameraControlRef.current.yaw;
    const transform = playerTransformRef.current;

    // Vector hướng nhìn tới và hướng phải của Camera trên mặt phẳng XZ
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const inputMagnitude = Math.hypot(input.x, input.y);
    const isMoving = input.active && inputMagnitude > 0.05;

    if (isMoving) {
      const scale = inputMagnitude > 1 ? 1 / inputMagnitude : 1;
      const joyX = input.x * scale;
      const joyY = input.y * scale;

      const moveX = forwardX * joyY + rightX * joyX;
      const moveZ = forwardZ * joyY + rightZ * joyX;

      // Di chuyển kết hợp hệ thống va chạm và trượt tường thực tế
      const previousX = transform.position.x;
      const previousZ = transform.position.z;
      const nextPos = resolveMotionInSteps(
        previousX, previousZ,
        previousX + moveX * PLAYER_MOVEMENT_SPEED * dt,
        previousZ + moveZ * PLAYER_MOVEMENT_SPEED * dt,
        (x, z, nextX, nextZ) => resolveMovement(x, z, nextX, nextZ, PLAYER_COLLISION_RADIUS),
      );
      const actualDistance = Math.hypot(nextPos.x - previousX, nextPos.z - previousZ);

      transform.position.x = nextPos.x;
      transform.position.z = nextPos.z;
      // Tự động nâng hạ độ cao theo cầu cong / bậc thềm / đảo ngọc
      transform.position.y = getGroundHeight(nextPos.x, nextPos.z);

      if (Math.hypot(moveX, moveZ) > 0.0001) {
        const targetRotationY = Math.atan2(moveX, moveZ);
        const lerpFactor = clamp(PLAYER_ROTATION_LERP * (dt * 60), 0.05, 1);
        transform.rotationY = lerpShortestAngle(
          transform.rotationY,
          targetRotationY,
          lerpFactor
        );
      }

      transform.actionState = displacementIsWalking(actualDistance, dt) ? 'walking' : (forcedActionState ?? 'idle');
    } else {
      // Đảm bảo cao độ luôn chuẩn xác theo địa hình ngay cả khi đứng yên
      transform.position.y = getGroundHeight(
        transform.position.x,
        transform.position.z
      );
      transform.actionState = forcedActionState ?? 'idle';
    }

    // Kiểm tra vùng tương tác gần nhất trong sân chùa
    const nearestZone = findNearestInteractionZone(transform.position);
    const nearestZoneId = nearestZone?.id ?? null;
    if (nearestZoneId !== lastZoneIdRef.current) {
      lastZoneIdRef.current = nearestZoneId;
      onZoneChange?.(nearestZone);
    }

    // TỐI ƯU HIỆU NĂNG REACT:
    // Chỉ kích hoạt onPositionSync khi:
    // 1. Chưa sync lần nào (lần đầu khởi chạy)
    // 2. Hoặc đã qua 250ms VÀ (di chuyển >= 0.2m HOẶC actionState thay đổi).
    // Khi đứng yên (idle), không phát sinh re-render thừa liên tục!
    const now = performance.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;

    if (timeSinceLastSync >= POSITION_SYNC_INTERVAL_MS) {
      let shouldSync = false;

      if (!lastSyncedPosRef.current) {
        shouldSync = true;
      } else {
        const dx = transform.position.x - lastSyncedPosRef.current.x;
        const dy = transform.position.y - lastSyncedPosRef.current.y;
        const dz = transform.position.z - lastSyncedPosRef.current.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const stateChanged = transform.actionState !== lastSyncedStateRef.current;

        if (distSq >= POSITION_SYNC_DIST_SQ_THRESHOLD || stateChanged) {
          shouldSync = true;
        }
      }

      if (shouldSync) {
        lastSyncTimeRef.current = now;
        lastSyncedPosRef.current = {
          x: transform.position.x,
          y: transform.position.y,
          z: transform.position.z,
        };
        lastSyncedStateRef.current = transform.actionState;

        onPositionSync?.(
          {
            x: transform.position.x,
            y: transform.position.y,
            z: transform.position.z,
          },
          transform.rotationY,
          transform.actionState
        );
      }
    }
  }, -30);

  return (
    <>
      <MonkAvatar
        isLocalPlayer
        transformRef={playerTransformRef}
        monkName={profile.monkName || profile.username}
        robeColor={profile.robeColor}
        meritPoints={profile.meritPoints}
        chatBubble={chatBubble}
      />
      <ThirdPersonCamera
        targetTransformRef={playerTransformRef}
        cameraControlRef={cameraControlRef}
        heightOffset={CAMERA_DEFAULTS.heightOffset}
      />
    </>
  );
};

export const LocalPlayerController = React.memo<LocalPlayerControllerProps>(
  LocalPlayerControllerComponent
);
export default LocalPlayerController;
