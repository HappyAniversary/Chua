import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Leave at the outer threshold; return only after moving 12% back inside. */
export function detailIsNear(distance: number, limit: number, wasNear: boolean): boolean {
  return distance <= limit * (wasNear ? 1 : 0.88);
}

/** Mounted once: only tiny decoration fades, leaving architecture and colliders intact.
 * Children own their materials, which must start transparent and depthWrite=false.
 * Keep material flags fixed so crossing a distance threshold never recompiles shaders.
 */
export function StableDetail({ children, distance, radius = 0 }: {
  children: React.ReactNode;
  distance: number;
  radius?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const materials = useRef<THREE.Material[]>([]);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const near = useRef(true);
  const opacity = useRef(1);
  const prepared = useRef(false);

  useLayoutEffect(() => {
    const unique = new Set<THREE.Material>();
    group.current?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => unique.add(material));
      }
    });
    materials.current = [...unique];
  }, [children]);

  useFrame(({ camera }, delta) => {
    if (!group.current) return;
    group.current.getWorldPosition(position);
    group.current.getWorldScale(scale);
    const edgeDistance = Math.max(0, camera.position.distanceTo(position) - radius * Math.max(scale.x, scale.y, scale.z));
    near.current = detailIsNear(edgeDistance, distance, near.current);
    if (!prepared.current) {
      // Render every variant once, even when starting far away, to prepare shaders.
      opacity.current = near.current ? 1 : 0.001;
      prepared.current = true;
      group.current.visible = true;
    } else {
      opacity.current = THREE.MathUtils.damp(opacity.current, near.current ? 1 : 0, 9, Math.min(delta, 0.1));
      group.current.visible = opacity.current > 0.001;
    }
    materials.current.forEach((material) => { material.opacity = opacity.current; });
  });

  return <group ref={group}>{children}</group>;
}
