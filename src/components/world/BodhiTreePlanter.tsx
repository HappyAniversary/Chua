import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export function createBodhiPlanterParts(radius: number) {
  const outerRim = radius - 0.15;
  const innerRim = radius - 0.5;
  // Stone is an annulus, not a filled cap occupying the soil surface.
  const rimProfile = [
    new THREE.Vector2(outerRim, -0.05),
    new THREE.Vector2(outerRim, 0.05),
    new THREE.Vector2(innerRim, 0.05),
    new THREE.Vector2(innerRim, -0.05),
    new THREE.Vector2(outerRim, -0.05),
  ];
  return [
    { name: 'base', geometry: new THREE.CylinderGeometry(radius - 0.25, radius, 0.56, 8), y: 0.28, color: '#64748b', roughness: 0.82, castShadow: true },
    { name: 'rim', geometry: new THREE.LatheGeometry(rimProfile, 8), y: 0.58, color: '#94a3b8', roughness: 0.75, castShadow: false },
    { name: 'soil', geometry: new THREE.CylinderGeometry(innerRim, innerRim, 0.06, 8), y: 0.57, color: '#334155', roughness: 0.95, castShadow: false },
  ];
}

export function BodhiTreePlanter({ radius }: { radius: number }) {
  const parts = useMemo(() => createBodhiPlanterParts(radius), [radius]);
  useEffect(() => () => parts.forEach(part => part.geometry.dispose()), [parts]);
  return <group name="bodhi-tree-planter">
    {parts.map(part => <mesh key={part.name} name={`bodhi-planter-${part.name}`} geometry={part.geometry}
      position={[0, part.y, 0]} receiveShadow castShadow={part.castShadow}>
      <meshStandardMaterial color={part.color} roughness={part.roughness} />
    </mesh>)}
  </group>;
}
