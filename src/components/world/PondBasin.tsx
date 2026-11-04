import React, { useMemo } from 'react';
import * as THREE from 'three';

/** Closed stone cross-section: outer wall, horizontal rim and inward facing wall.
 * No opaque cap crosses the water. All heights are local world Y. */
export const PondBasin: React.FC<{
  outerRadius: number;
  innerRadius: number;
  rimY: number;
  bottomY: number;
  color?: string;
  segments?: number;
  opening?: { start: number; end: number };
}> = ({ outerRadius, innerRadius, rimY, bottomY, color = '#64716f', segments = 48, opening }) => {
  const points = useMemo(() => [
    new THREE.Vector2(outerRadius + 0.15, bottomY),
    new THREE.Vector2(outerRadius, rimY),
    new THREE.Vector2(innerRadius, rimY),
    new THREE.Vector2(innerRadius, bottomY),
  ], [outerRadius, innerRadius, rimY, bottomY]);
  const capShape = useMemo(() => {
    const shape = new THREE.Shape(points);
    shape.closePath();
    return shape;
  }, [points]);
  return <group>
    <mesh receiveShadow castShadow>
      <latheGeometry args={[points, segments, opening?.end ?? 0, opening ? Math.PI * 2 - (opening.end - opening.start) : Math.PI * 2]} />
      <meshStandardMaterial color={color} roughness={0.84} />
    </mesh>
    {opening && [opening.start, opening.end].map(angle => <mesh key={angle} rotation={[0, angle - Math.PI / 2, 0]} receiveShadow castShadow>
      <shapeGeometry args={[capShape]} />
      <meshStandardMaterial color={color} roughness={0.84} side={THREE.DoubleSide} />
    </mesh>)}
    <mesh position={[0, bottomY - 0.06, 0]} receiveShadow>
      <cylinderGeometry args={[innerRadius, innerRadius, 0.12, segments]} />
      <meshStandardMaterial color="#263f3c" roughness={0.96} />
    </mesh>
  </group>;
};
