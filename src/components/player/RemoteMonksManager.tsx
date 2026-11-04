import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGroundHeight, resolveMovement } from '../../constants/templeLayout';
import type { MonkPresence } from '../../types/game';
import { MonkAvatar, type MonkTransformState } from './MonkAvatar';
import { displacementIsWalking, motionDelta, resolveMotionInSteps } from '../../utils/playerMotion';

export interface RemoteMonksManagerProps {
  remoteMonks: MonkPresence[];
  localUid: string;
}

interface InterpolatedRemoteMonkProps {
  monk: MonkPresence;
}

function lerpShortestAngle(
  current: number,
  target: number,
  factor: number
): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

const InterpolatedRemoteMonkComponent: React.FC<InterpolatedRemoteMonkProps> = ({
  monk,
}) => {
  const initialGroundY = getGroundHeight(monk.position.x, monk.position.z);
  const initialY =
    typeof monk.position.y === 'number'
      ? Math.max(monk.position.y, initialGroundY)
      : initialGroundY;

  const transformRef = useRef<MonkTransformState>({
    position: {
      x: monk.position.x,
      y: initialY,
      z: monk.position.z,
    },
    rotationY: monk.rotationY,
    actionState: monk.actionState,
  });

  const targetRef = useRef<MonkTransformState>({
    position: {
      x: monk.position.x,
      y: initialY,
      z: monk.position.z,
    },
    rotationY: monk.rotationY,
    actionState: monk.actionState,
  });

  useEffect(() => {
    const groundY = getGroundHeight(monk.position.x, monk.position.z);
    const targetY =
      typeof monk.position.y === 'number'
        ? Math.max(monk.position.y, groundY)
        : groundY;

    targetRef.current = {
      position: {
        x: monk.position.x,
        y: targetY,
        z: monk.position.z,
      },
      rotationY: monk.rotationY,
      actionState: monk.actionState,
    };
  }, [
    monk.position.x,
    monk.position.y,
    monk.position.z,
    monk.rotationY,
    monk.actionState,
  ]);

  useFrame((_, delta) => {
    const dt = motionDelta(delta);
    const current = transformRef.current;
    const target = targetRef.current;

    const previousX = current.position.x;
    const previousZ = current.position.z;
    const dx = target.position.x - current.position.x;
    const dy = target.position.y - current.position.y;
    const dz = target.position.z - current.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    // Nếu khoảng cách dịch chuyển quá xa (mới xuất hiện / dịch chuyển tức thời), gán trực tiếp
    if (distSq > 100) {
      current.position.x = target.position.x;
      current.position.y = getGroundHeight(target.position.x, target.position.z);
      current.position.z = target.position.z;
      current.rotationY = target.rotationY;
    } else {
      const posLerpFactor = 1 - Math.exp(-10 * dt);
      const rotLerpFactor = 1 - Math.exp(-12 * dt);

      const next = resolveMotionInSteps(
        current.position.x, current.position.z,
        THREE.MathUtils.lerp(current.position.x, target.position.x, posLerpFactor),
        THREE.MathUtils.lerp(current.position.z, target.position.z, posLerpFactor),
        resolveMovement,
      );
      current.position.x = next.x;
      current.position.z = next.z;

      // Cập nhật cao độ mặt đất tương ứng tọa độ hiện tại (cầu cong, bậc thềm, cầu cửu khúc)
      const currentGroundY = getGroundHeight(
        current.position.x,
        current.position.z
      );
      // This world has grounded monks: use the surface at the interpolated XZ,
      // never lerp feet under an ascending bridge (or float above its low end).
      current.position.y = currentGroundY;

      current.rotationY = lerpShortestAngle(
        current.rotationY,
        target.rotationY,
        rotLerpFactor
      );
    }

    const moved = Math.hypot(current.position.x - previousX, current.position.z - previousZ);
    current.actionState = target.actionState === 'walking' && !displacementIsWalking(moved, dt)
      ? 'idle' : target.actionState;
  }, -30);

  return (
    <MonkAvatar
      transformRef={transformRef}
      monkName={monk.monkName}
      robeColor={monk.robeColor}
      meritPoints={monk.meritPoints}
      position={monk.position}
      rotationY={monk.rotationY}
      actionState={monk.actionState}
      chatBubble={monk.chatBubble ?? null}
      isLocalPlayer={false}
    />
  );
};

const InterpolatedRemoteMonk = React.memo<InterpolatedRemoteMonkProps>(
  InterpolatedRemoteMonkComponent
);

const RemoteMonksManagerComponent: React.FC<RemoteMonksManagerProps> = ({
  remoteMonks,
  localUid,
}) => {
  const visibleMonks = useMemo(
    () => remoteMonks.filter((monk) => monk && monk.uid !== localUid),
    [remoteMonks, localUid]
  );

  return (
    <group name="remote-monks-manager">
      {visibleMonks.map((monk) => (
        <InterpolatedRemoteMonk key={monk.uid} monk={monk} />
      ))}
    </group>
  );
};

export const RemoteMonksManager = React.memo<RemoteMonksManagerProps>(
  RemoteMonksManagerComponent
);
export default RemoteMonksManager;
