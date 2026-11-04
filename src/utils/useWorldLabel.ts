import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getCameraCollisionWorld } from './cameraCollision';

/** Restrained labels; visibility updates stay outside React and use cached world solids. */
export function useWorldLabel(anchorRef: RefObject<THREE.Object3D>, maxDistance: number) {
  const elementRef = useRef<HTMLDivElement>(null);
  const scene = useThree(state => state.scene);
  const collision = useMemo(() => getCameraCollisionWorld(scene), [scene]);
  const position = useMemo(() => new THREE.Vector3(), []);
  const lastCheck = useRef(-1);
  const inRange = useRef(false);
  useFrame(({ camera, clock }) => {
    const element = elementRef.current;
    const anchor = anchorRef.current;
    if (!element || !anchor || clock.elapsedTime - lastCheck.current < 0.15) return;
    lastCheck.current = clock.elapsedTime;
    anchor.getWorldPosition(position);
    const distance = camera.position.distanceTo(position);
    inRange.current = distance < maxDistance + (inRange.current ? 1.5 : 0);
    const visible = inRange.current && collision.hasLineOfSight(camera.position, position);
    element.style.visibility = visible ? 'visible' : 'hidden';
    element.style.opacity = visible ? '1' : '0';
  }, 0);
  return elementRef;
}
