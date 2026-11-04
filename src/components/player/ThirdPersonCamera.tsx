import React, { useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CameraControlState, Vector3Tuple } from '../../types/game';
import type { MonkTransformState } from './MonkAvatar';
import { getGroundHeight } from '../../constants/templeLayout';
import { applySafeCameraMotion, cameraGuardRadius, cameraShouldReset } from '../../utils/cameraCollision';
import { motionDelta } from '../../utils/playerMotion';

export interface ThirdPersonCameraProps {
  targetTransformRef?: MutableRefObject<MonkTransformState>;
  targetPosition?: Vector3Tuple;
  cameraControlRef: MutableRefObject<CameraControlState>;
  heightOffset?: number;
}
const DEFAULT_TARGET_POSITION: Vector3Tuple = { x: 0, y: 0, z: 18 };

export const ThirdPersonCamera: React.FC<ThirdPersonCameraProps> = ({
  targetTransformRef, targetPosition, cameraControlRef, heightOffset = 1.6,
}) => {
  const vectors = useMemo(() => ({
    desired: new THREE.Vector3(), lookAt: new THREE.Vector3(),
    currentLookAt: new THREE.Vector3(), safe: new THREE.Vector3(), candidate: new THREE.Vector3(),
  }), []);
  const initializedRef = useRef(false);
  const resetVersionRef = useRef(0);

  useFrame((state, delta) => {
    const dt = motionDelta(delta);
    const pos = targetTransformRef?.current?.position ?? targetPosition ?? DEFAULT_TARGET_POSITION;
    const control = cameraControlRef.current;
    const pitch = THREE.MathUtils.clamp(control.pitch, 0.12, 1.25);
    const distance = Math.max(1.5, control.distance);
    const radius = cameraGuardRadius(state.camera);
    vectors.lookAt.set(pos.x, pos.y + heightOffset, pos.z);
    vectors.desired.set(
      pos.x + distance * Math.sin(control.yaw) * Math.cos(pitch),
      pos.y + heightOffset + distance * Math.sin(pitch),
      pos.z + distance * Math.cos(control.yaw) * Math.cos(pitch),
    );
    const reset = cameraShouldReset(initializedRef.current, resetVersionRef.current, control.resetVersion);
    applySafeCameraMotion({
      position: state.camera.position, lookAt: vectors.currentLookAt,
      desiredPosition: vectors.desired, desiredLookAt: vectors.lookAt,
      // World objects do not retract or trap the player's camera.
      radius, delta: dt, reset, groundHeight: getGroundHeight,
      safe: vectors.safe, candidate: vectors.candidate,
    });
    initializedRef.current = true;
    resetVersionRef.current = control.resetVersion ?? 0;
    state.camera.lookAt(vectors.currentLookAt);
  }, -10);
  return null;
};
