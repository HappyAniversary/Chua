import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { InteractionZoneConfig } from '../../types/game';
import { BudgetPointLight, useEnvironmentQuality } from './EnvironmentQuality';
import { useWorldLabel } from '../../utils/useWorldLabel';
import { getGroundHeight } from '../../constants/templeLayout';

export interface InteractionZoneRingProps {
  zone: InteractionZoneConfig;
  isActive: boolean;
}

export const InteractionZoneRing: React.FC<InteractionZoneRingProps> = ({
  zone,
  isActive,
}) => {
  const labelAnchorRef = useRef<THREE.Group>(null);
  const { detailDistance } = useEnvironmentQuality();
  const labelRef = useWorldLabel(labelAnchorRef, isActive ? 16 : Math.min(12, detailDistance));
  const rotatingGroupRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const auraPillarRef = useRef<THREE.Mesh>(null);

  const baseRadius = Math.max(1.2, zone.radius * 0.72);

  // Các góc cánh hoa sen xung quanh vòng sáng để tạo hiệu ứng xoay rõ rệt
  const petalAngles = useMemo(
    () => Array.from({ length: 8 }, (_, idx) => (idx * Math.PI * 2) / 8),
    []
  );

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    if (rotatingGroupRef.current) {
      const rotSpeed = isActive ? 0.85 : 0.35;
      rotatingGroupRef.current.rotation.z += delta * rotSpeed;
      const pulseScale = isActive
        ? 1.12 + Math.sin(t * 3.2) * 0.05
        : 1.0 + Math.sin(t * 1.8) * 0.02;
      rotatingGroupRef.current.scale.set(pulseScale, pulseScale, 1);
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= delta * (isActive ? 0.6 : 0.22);
    }

    if (auraPillarRef.current && isActive) {
      const pillarPulse = 0.96 + Math.sin(t * 2.8) * 0.06;
      auraPillarRef.current.scale.set(pillarPulse, 1, pillarPulse);
    }
  });

  return (
    <group position={[zone.position.x, getGroundHeight(zone.position.x, zone.position.z) + 0.035, zone.position.z]} userData={{ cameraIgnore: true }}>
      {/* Nhóm vòng sáng tròn dưới mặt đất xoay nhẹ trong useFrame */}
      <group ref={rotatingGroupRef} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Đĩa nền phát sáng dịu dưới mặt đất */}
        <mesh>
          <circleGeometry args={[baseRadius * 0.96, 48]} />
          <meshBasicMaterial
            color={zone.highlightColor}
            transparent
            opacity={isActive ? 0.18 : 0.025}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Vòng sáng chính (ringGeometry) */}
        <mesh>
          <ringGeometry args={[baseRadius * 0.84, baseRadius, 48]} />
          <meshBasicMaterial
            color={zone.highlightColor}
            transparent
            opacity={isActive ? 0.74 : 0.18}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Vòng sáng hoa văn bát giác bên trong xoay ngược chiều */}
        <mesh ref={innerRingRef}>
          <ringGeometry args={[baseRadius * 0.56, baseRadius * 0.64, 8]} />
          <meshBasicMaterial
            color={isActive ? '#fef08a' : zone.highlightColor}
            transparent
            opacity={isActive ? 0.65 : 0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Các cung sáng xoay quanh chu vi vòng để thấy rõ chuyển động xoay */}
        {petalAngles.map((angle, index) => (
          <mesh key={index} rotation={[0, 0, angle]}>
            <ringGeometry
              args={[
                baseRadius * 1.03,
                baseRadius * 1.12,
                12,
                1,
                0,
                Math.PI / 7,
              ]}
            />
            <meshBasicMaterial
              color={isActive ? '#fde047' : zone.highlightColor}
              transparent
              opacity={isActive ? 0.7 : 0.12}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* Vòng tỏa rộng ngoài cùng khi người chơi bước vào vùng tương tác */}
        {isActive && (
          <mesh>
            <ringGeometry args={[baseRadius * 1.18, baseRadius * 1.32, 48]} />
            <meshBasicMaterial
              color="#fde047"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>

      {/* Cột sáng hào quang mỏng hướng lên trời khi đang trong vùng tương tác */}
      {isActive && (
        <group>
          <mesh ref={auraPillarRef} position={[0, 1.35, 0]}>
            <cylinderGeometry
              args={[baseRadius * 0.92, baseRadius * 1.05, 2.7, 36, 1, true]}
            />
            <meshBasicMaterial
              color={zone.highlightColor}
              transparent
              opacity={0.07}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry
              args={[baseRadius * 0.55, baseRadius * 0.75, 1.8, 24, 1, true]}
            />
            <meshBasicMaterial
              color="#fef08a"
              transparent
              opacity={0.05}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>

          <BudgetPointLight
            position={[0, 0.8, 0]}
            color={zone.highlightColor}
            intensity={1.4}
            distance={4.5}
          />
        </group>
      )}

      {/* Nhãn thông tin khu vực tương tác lơ lửng phía trên */}
      <group ref={labelAnchorRef} position={[0, 2.6, 0]}>
      <Html
        style={{ pointerEvents: 'none' }}
        center
        zIndexRange={[5, 0]}
      >
        <div
          ref={labelRef}
          style={{ visibility: 'hidden' }}
          className={`pointer-events-none select-none flex flex-col items-center text-center transition-all duration-300 ${
            isActive ? 'scale-105' : 'opacity-90'
          }`}
        >
          <div
            className={`w-[160px] px-2.5 py-1.5 rounded-lg backdrop-blur-md border shadow-lg transition-all duration-300 ${
              isActive
                ? 'bg-amber-950/90 border-amber-300/90 shadow-amber-500/30'
                : 'bg-stone-950/75 border-amber-500/40 shadow-black/40'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  backgroundColor: zone.highlightColor,
                  boxShadow: `0 0 8px ${zone.highlightColor}`,
                }}
              />
              <p className="text-[11px] font-bold text-amber-100">
                {zone.name}
              </p>
            </div>

            <p className="text-[10px] text-amber-200/80 mb-1.5">
              {zone.subtitle}
            </p>

            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-[10px] font-semibold text-amber-300">
              +{zone.meritReward} Công Đức
            </div>

            {isActive && (
              <div className="mt-1.5 pt-1 border-t border-amber-400/30">
                <p className="text-[10px] font-medium text-yellow-200 animate-pulse">
                  ✨ Bấm nút tương tác bên dưới
                </p>
              </div>
            )}
          </div>
        </div>
      </Html>
      </group>
    </group>
  );
};
