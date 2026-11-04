import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  NINE_TURN_BRIDGE_SEGMENTS,
  MOON_BRIDGE_PROFILE,
  getMoonBridgeHeight,
  getNineTurnBridgeHeight,
  TEMPLE_LANDMARKS,
} from '../../constants/templeLayout';
import type { TimeOfDay } from '../../types/game';
import {
  getCarvedStoneTexture,
  getLacquerWoodTexture,
  getRoofTileTexture,
  getZenSandTexture,
} from '../../utils/proceduralTextures';

import { BudgetPointLight } from './EnvironmentQuality';
import { PondBasin } from './PondBasin';
import { createSurfaceSlab } from './SurfaceGeometry';
import { bridgeRailTransform, createNineTurnBridgeLayout, createNineTurnDeckGeometry } from './NineTurnBridgeGeometry';
import { FigureModel } from './FigureModel';

export interface TempleOuterComplexProps {
  timeOfDay: TimeOfDay;
}

/**
 * ============================================================================
 * 1. HỒ PHÓNG SINH, CẦU ĐÁ BÁN NGUYỆT & ĐÀN CÁ CHÉP BƠI LƯỢN
 * (z: 31.2 -> 41.8, x: -24 -> 24)
 * ============================================================================
 */
interface KoiFishData {
  id: number;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phase: number;
  color: string;
  size: number;
}

const MoonBridgeAndReleasePond: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { releasePond, moonBridge } = TEMPLE_LANDMARKS;
  const pondWidth = releasePond.maxX - releasePond.minX; // 48m
  const pondDepth = releasePond.maxZ - releasePond.minZ; // 9m
  const pondCenterX = (releasePond.minX + releasePond.maxX) / 2; // 0
  const pondCenterZ = (releasePond.minZ + releasePond.maxZ) / 2; // 36.5

  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(8, 2), []);
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const fishGroupRef = useRef<THREE.Group>(null);

  // Đàn cá chép phóng sinh bơi lội mềm mại dưới mặt nước
  const koiFish = useMemo<KoiFishData[]>(() => {
    const colors = ['#ea580c', '#f97316', '#dc2626', '#fef08a', '#fafaf9', '#f59e0b'];
    return Array.from({ length: 14 }, (_, i) => ({
      id: i,
      centerX: (i % 2 === 0 ? -1 : 1) * (6 + (i % 5) * 3),
      centerZ: pondCenterZ + ((i % 3) - 1) * 2,
      radiusX: 2.2 + (i % 3) * 1.1,
      radiusZ: 1.4 + (i % 2) * 0.8,
      speed: 0.6 + (i % 4) * 0.2,
      phase: (i / 14) * Math.PI * 2,
      color: colors[i % colors.length],
      size: 0.28 + (i % 3) * 0.08,
    }));
  }, [pondCenterZ]);

  const bridgeSegments = useMemo(() => MOON_BRIDGE_PROFILE.slice(1).map((end, id) => {
    const start = MOON_BRIDGE_PROFILE[id];
    return {
      id,
      z: (start.z + end.z) / 2,
      y: (start.y + end.y) / 2,
      // Three's X rotation maps +Z towards -Y.
      angleX: -Math.atan2(end.y - start.y, end.z - start.z),
      length: Math.hypot(end.z - start.z, end.y - start.y),
      geometry: createSurfaceSlab({ minX: moonBridge.minX, maxX: moonBridge.maxX,
        minZ: start.z, maxZ: end.z }, (_, z) => getMoonBridgeHeight(z), 0.22),
    };
  }), [moonBridge]);

  useEffect(() => () => {
    bridgeSegments.forEach(({ geometry }) => geometry.dispose());
  }, [bridgeSegments]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Mặt nước hồ gợn sóng nhẹ
    if (waterMeshRef.current) {
      waterMeshRef.current.position.y = releasePond.waterY + Math.sin(t * 1.5) * 0.012;
    }

    // Đàn cá chép bơi lượn uốn mình
    if (fishGroupRef.current) {
      fishGroupRef.current.children.forEach((fishChild, idx) => {
        const fish = koiFish[idx];
        if (!fish) return;
        const angle = t * fish.speed + fish.phase;
        const x = fish.centerX + Math.cos(angle) * fish.radiusX;
        const z = fish.centerZ + Math.sin(angle) * fish.radiusZ;
        const rotY = -angle + Math.PI / 2;

        fishChild.position.set(x, releasePond.waterY - 0.2 + Math.sin(t * 3 + fish.phase) * 0.02, z);
        fishChild.rotation.set(0, rotY, Math.sin(t * 6 + fish.phase) * 0.18);
      });
    }
  });

  return (
    <group name="moon-bridge-and-release-pond">
      {/* 1. Lòng Hồ Phóng Sinh & Bờ Kè Đá Xanh */}
      <group position={[pondCenterX, 0, pondCenterZ]}>
        {/* Đáy hồ */}
        <mesh position={[0, -0.6, 0]} receiveShadow>
          <boxGeometry args={[pondWidth + 1.2, 0.4, pondDepth + 1.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} />
        </mesh>

        {/* Bờ kè đá xanh xung quanh hồ */}
        {/* Bờ Bắc (hướng về Tam Quan) */}
        <mesh position={[0, 0.15, -pondDepth / 2]} receiveShadow castShadow>
          <boxGeometry args={[pondWidth + 1.6, 0.45, 0.8]} />
          <meshStandardMaterial
            map={carvedStoneTexture}
            color="#64748b"
            roughness={0.78}
          />
        </mesh>
        {/* Bờ Nam (hướng ra Quảng trường) */}
        <mesh position={[0, 0.15, pondDepth / 2]} receiveShadow castShadow>
          <boxGeometry args={[pondWidth + 1.6, 0.45, 0.8]} />
          <meshStandardMaterial
            map={carvedStoneTexture}
            color="#64748b"
            roughness={0.78}
          />
        </mesh>
        {/* Bờ Tây */}
        <mesh position={[-pondWidth / 2, 0.15, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.8, 0.45, pondDepth]} />
          <meshStandardMaterial
            map={carvedStoneTexture}
            color="#64748b"
            roughness={0.78}
          />
        </mesh>
        {/* Bờ Đông */}
        <mesh position={[pondWidth / 2, 0.15, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.8, 0.45, pondDepth]} />
          <meshStandardMaterial
            map={carvedStoneTexture}
            color="#64748b"
            roughness={0.78}
          />
        </mesh>

        {/* Mặt nước hồ xanh biếc */}
        <mesh
          ref={waterMeshRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, releasePond.waterY, 0]}
        >
          <planeGeometry args={[pondWidth, pondDepth]} />
          <meshStandardMaterial
            color={isEveningOrNight ? '#225e64' : '#4b8c88'}
            roughness={0.12}
            metalness={0.25}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            opacity={0.78}
          />
        </mesh>
      </group>

      {/* 2. Đàn Cá Chép Bơi Lượn Dưới Hồ */}
      <group ref={fishGroupRef} userData={{ cameraIgnore: true }}>
        {koiFish.map((fish) => (
          <group key={fish.id}>
            {/* Thân cá chép */}
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[fish.size * 0.38, fish.size, 6]} />
              <meshStandardMaterial
                color={fish.color}
                roughness={0.4}
                metalness={0.1}
              />
            </mesh>
            {/* Đuôi cá */}
            <mesh position={[0, 0, -fish.size * 0.45]}>
              <boxGeometry args={[0.02, fish.size * 0.35, fish.size * 0.3]} />
              <meshStandardMaterial color={fish.color} transparent opacity={0.85} />
            </mesh>
          </group>
        ))}
      </group>

      {/* 3. Cầu Đá Bán Nguyệt Vòm Cong */}
      <group name="moon-bridge-structure">
        {bridgeSegments.map((seg) => (
          <React.Fragment key={seg.id}>
            <mesh geometry={seg.geometry} receiveShadow castShadow>
              <meshStandardMaterial map={carvedStoneTexture} color="#cbd2ce" roughness={0.8} />
            </mesh>
            <group position={[0, seg.y, seg.z]} rotation={[seg.angleX, 0, 0]}>
              {[-1.9, 1.9].map((x) => <group key={x} position={[x, 0, 0]}>
                <mesh position={[0, 0.45, 0]} castShadow>
                  <boxGeometry args={[0.16, 0.68, seg.length]} />
                  <meshStandardMaterial color="#899892" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                  <cylinderGeometry args={[0.09, 0.09, seg.length, 8]} />
                  <meshStandardMaterial color="#64746e" roughness={0.76} />
                </mesh>
              </group>)}
            </group>
          </React.Fragment>
        ))}

        {/* 4 Trụ đá đầu cầu chạm hoa sen (2 đầu Nam, 2 đầu Bắc) */}
        {[
          [-1.9, moonBridge.minZ],
          [1.9, moonBridge.minZ],
          [-1.9, moonBridge.maxZ],
          [1.9, moonBridge.maxZ],
          [-1.9, 36.5],
          [1.9, 36.5],
        ].map(([px, pz], idx) => {
          const py = getMoonBridgeHeight(pz);
          return (
            <group key={idx} position={[px, py, pz]}>
              {/* Thân trụ con tiện đá chạm sen */}
              <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[0.32, 0.8, 0.32]} />
                <meshStandardMaterial color="#64748b" roughness={0.75} />
              </mesh>
              {/* Búp sen đá trên đỉnh trụ */}
              <mesh position={[0, 0.95, 0]} castShadow>
                <sphereGeometry args={[0.18, 12, 12]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.65} />
              </mesh>
            </group>
          );
        })}


      </group>
    </group>
  );
};

/**
 * ============================================================================
 * 2. ĐÔI NGHÊ / SƯ TỬ ĐÁ HỘ PHÁP TIỀN ĐIỆN (z = 28.5, x = -4.5 & 4.5)
 * ============================================================================
 */
const GuardianLions: React.FC = () => {
  const { guardianLions } = TEMPLE_LANDMARKS;

  return (
    <group name="guardian-lions">
      {guardianLions.map((lion, idx) => {
        const isLeft = idx === 0;
        return (
          <group
            key={idx}
            position={[lion.x, 0, lion.z]}
            rotation={[0, isLeft ? 0.12 : -0.12, 0]}
          >
            {/* Bệ đá chạm cánh sen tam cấp */}
            <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.35, 0.32, 1.65]} />
              <meshStandardMaterial color="#475569" roughness={0.82} />
            </mesh>
            <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.15, 0.22, 1.45]} />
              <meshStandardMaterial color="#64748b" roughness={0.78} />
            </mesh>
            <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.95, 0.16, 1.25]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.75} />
            </mesh>

            {/* Thân Nghê / Sư tử đá dũng mãnh */}
            {/* Phần thân sau ngồi vững chãi */}
            <mesh position={[0, 0.95, -0.22]} castShadow>
              <boxGeometry args={[0.62, 0.65, 0.72]} />
              <meshStandardMaterial color="#64748b" roughness={0.72} />
            </mesh>
            {/* Ức ngực vươn cao dũng mãnh */}
            <mesh position={[0, 1.25, 0.15]} castShadow>
              <cylinderGeometry args={[0.34, 0.38, 0.75, 12]} />
              <meshStandardMaterial color="#64748b" roughness={0.7} />
            </mesh>
            {/* Hai chân trước vững như bàn thạch */}
            {[-0.22, 0.22].map((cx, cIdx) => (
              <mesh key={cIdx} position={[cx, 0.9, 0.32]} castShadow>
                <cylinderGeometry args={[0.12, 0.15, 0.65, 8]} />
                <meshStandardMaterial color="#475569" roughness={0.75} />
              </mesh>
            ))}
            {/* Quả cầu ngọc hoặc nghê con dưới chân */}
            <mesh position={[isLeft ? 0.22 : -0.22, 0.74, 0.42]} castShadow>
              <sphereGeometry args={[0.15, 12, 12]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
            </mesh>

            {/* Đầu Nghê bờm xoắn ốc uy nghiêm */}
            <mesh position={[0, 1.72, 0.22]} castShadow>
              <boxGeometry args={[0.54, 0.5, 0.52]} />
              <meshStandardMaterial color="#64748b" roughness={0.7} />
            </mesh>
            {/* Miệng há ngậm ngọc */}
            <mesh position={[0, 1.62, 0.44]} castShadow>
              <boxGeometry args={[0.34, 0.2, 0.22]} />
              <meshStandardMaterial color="#475569" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.62, 0.48]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshStandardMaterial color="#fef08a" roughness={0.3} metalness={0.6} />
            </mesh>
            {/* Bờm xoắn ốc sau gáy */}
            <mesh position={[0, 1.78, -0.05]} castShadow>
              <sphereGeometry args={[0.3, 10, 10]} />
              <meshStandardMaterial color="#475569" roughness={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/**
 * ============================================================================
 * 3. ĐÀI QUAN ÂM NAM HẢI & CẦU GỖ ĐỎ CỬU KHÚC (x: -27, z: 10)
 * ============================================================================
 */
const QuanAmSanctuary: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { quanAmPond } = TEMPLE_LANDMARKS;
  const nineTurnLayout = useMemo(() => createNineTurnBridgeLayout(
    NINE_TURN_BRIDGE_SEGMENTS, quanAmPond, getNineTurnBridgeHeight
  ), [quanAmPond]);
  const nineTurnDeck = useMemo(() => createNineTurnDeckGeometry(nineTurnLayout, getNineTurnBridgeHeight), [nineTurnLayout]);
  const nineTurnRails = useMemo(() => nineTurnLayout.rails.flatMap(edge => [0.43, 0.8].map(offset =>
    bridgeRailTransform(edge, getNineTurnBridgeHeight, offset)
  )), [nineTurnLayout]);
  useEffect(() => () => { nineTurnDeck.dispose(); }, [nineTurnDeck]);
  const haloRef = useRef<THREE.Group>(null);
  const waterRef = useRef<THREE.Mesh>(null);

  const lacquerTexture = useMemo(() => getLacquerWoodTexture(4, 4), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(6, 6), []);

  useFrame(({ clock }, delta) => {
    // Vòng hào quang Quan Âm xoay nhẹ thanh tịnh
    if (haloRef.current) {
      haloRef.current.rotation.z += delta * 0.22;
    }
    // Nước hồ sen dập dềnh
    if (waterRef.current) {
      waterRef.current.position.y =
        quanAmPond.waterY + Math.sin(clock.getElapsedTime() * 1.8) * 0.008;
    }
  });

  return (
    <group name="quan-am-sanctuary">
      {/* 1. Hồ Sen Lớn Tròn (Bán kính 9m) */}
      <group position={[quanAmPond.x, 0, quanAmPond.z]}>
        <PondBasin outerRadius={quanAmPond.radius + 0.5} innerRadius={quanAmPond.radius}
          rimY={0.38} bottomY={-0.3} color="#667773" opening={{ start: 1.29, end: 1.56 }} />

        {/* Mặt nước hồ sen trong biếc */}
        <mesh
          ref={waterRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, quanAmPond.waterY, 0]}
        >
          <circleGeometry args={[quanAmPond.radius - 0.05, 48]} />
          <meshStandardMaterial
            color={isEveningOrNight ? '#285f65' : '#56978b'}
            roughness={0.14}
            metalness={0.2}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            opacity={0.82}
          />
        </mesh>

        {/* 2. Đảo Sen Tròn Giữa Hồ (Bán kính 3.2m, cao độ 0.35m) */}
        <mesh position={[0, quanAmPond.deckY - 0.19, 0]} receiveShadow castShadow>
          <cylinderGeometry
            args={[quanAmPond.islandRadius, quanAmPond.islandRadius + 0.15, 0.38, 32]}
          />
          <meshStandardMaterial map={carvedStoneTexture} color="#cbd5e1" roughness={0.78} />
        </mesh>
        {/* Mặt sân đảo sen lát đá hoa sen bát giác */}
        <mesh position={[0, quanAmPond.deckY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[quanAmPond.islandRadius - 0.08, 32]} />
          <meshStandardMaterial color="#dce1db" roughness={0.76} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
        </mesh>
        {/* Lan can đá chạm hoa sen bao quanh đảo sen */}
        {Array.from({ length: 16 }, (_, idx) => {
          const angle = (idx / 16) * Math.PI * 2;
          // Chừa lối vào từ Cầu Cửu Khúc (hướng khoảng angle 0 / phía Đông)
          if (angle < 0.3 || angle > Math.PI * 2 - 0.3) return null;
          const lx = Math.cos(angle) * (quanAmPond.islandRadius - 0.25);
          const lz = Math.sin(angle) * (quanAmPond.islandRadius - 0.25);
          // The stone landing remains clear across the full incoming bridge width.
          const worldX = quanAmPond.x + lx, worldZ = quanAmPond.z + lz;
          if (NINE_TURN_BRIDGE_SEGMENTS.some(segment => worldX >= segment.minX - 0.13 && worldX <= segment.maxX + 0.13 &&
            worldZ >= segment.minZ - 0.13 && worldZ <= segment.maxZ + 0.13)) return null;
          return (
            <group key={idx} position={[lx, 0.38, lz]} rotation={[0, -angle, 0]}>
              <mesh position={[0, 0.3, 0]} castShadow>
                <boxGeometry args={[0.14, 0.6, 0.14]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.75} />
              </mesh>
              <mesh position={[0, 0.65, 0]} castShadow>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
              </mesh>
            </group>
          );
        })}

        {/* 3. Tượng Bồ Tát Quán Thế Âm Nam Hải Uy Nghiêm */}
        <group position={[0, quanAmPond.deckY, 0]}>
          {/* Bệ đá bát giác đỡ đài sen */}
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.5, 1.7, 0.5, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.8} />
          </mesh>

          {/* Tòa Cửu Phẩm Liên Hoa (Đài sen hồng viền trắng vàng) */}
          <group position={[0, 0.55, 0]}>
            {/* Lớp cánh sen dưới */}
            <mesh position={[0, 0.12, 0]} castShadow>
              <cylinderGeometry args={[1.4, 0.8, 0.26, 18]} />
              <meshStandardMaterial color="#fda4af" roughness={0.5} />
            </mesh>
            {/* Cánh sen hồng đắp nổi 16 cánh */}
            {Array.from({ length: 16 }, (_, pIdx) => {
              const pAngle = (pIdx / 16) * Math.PI * 2;
              return (
                <mesh
                  key={pIdx}
                  position={[Math.cos(pAngle) * 1.3, 0.2, Math.sin(pAngle) * 1.3]}
                  rotation={[0.3, -pAngle + Math.PI / 2, 0]}
                  castShadow
                >
                  <coneGeometry args={[0.18, 0.36, 5]} />
                  <meshStandardMaterial color="#fb7185" roughness={0.45} />
                </mesh>
              );
            })}
            {/* Nhụy sen vàng rực rỡ */}
            <mesh position={[0, 0.26, 0]}>
              <cylinderGeometry args={[1.1, 1.1, 0.08, 20]} />
              <meshStandardMaterial color="#fef08a" roughness={0.4} />
            </mesh>
          </group>

          {/* Thân Tượng Bồ Tát Quán Thế Âm (Áo trắng tinh khôi) */}
          <group position={[0, 0.85, 0]} rotation={[0, Math.PI / 2, 0]}>
            {/* ĐẠI TƯỢNG BỒ TÁT QUÁN THẾ ÂM ĐIÊU KHẮC HỮU CƠ (GLB HIGH-POLY) */}
            <Suspense fallback={null}>
              <FigureModel
                modelUrl="/models/figures/quanam.glb"
                position={[0, 0, 0]}
                scale={1.9}
                castShadow
                receiveShadow
              />
            </Suspense>

            {/* Vòng Hào Quang Thanh Tịnh Xoay Sau Lưng Tượng */}
            <group ref={haloRef} userData={{ cameraIgnore: true }} position={[0, 3.45, -0.35]}>
              <mesh>
                <ringGeometry args={[0.65, 0.95, 32]} />
                <meshStandardMaterial
                  color="#fef08a"
                  emissive="#f59e0b"
                  emissiveIntensity={isEveningOrNight ? 2.4 : 1.2}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.88}
                />
              </mesh>
              <mesh>
                <circleGeometry args={[0.64, 32]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive="#38bdf8"
                  emissiveIntensity={isEveningOrNight ? 1.6 : 0.7}
                  side={THREE.DoubleSide}
                  transparent
                  depthWrite={false}
                  opacity={0.35}
                />
              </mesh>
            </group>

            {/* Ánh sáng lung linh tỏa từ Bồ Tát Quán Thế Âm */}
            <BudgetPointLight
              position={[0, 3.5, 0.5]}
              color="#38bdf8"
              intensity={isEveningOrNight ? 2.8 : 1.2}
              distance={12}
            />
          </group>
        </group>
      </group>

      {/* 4. Cầu Gỗ Đỏ Cửu Khúc (Zigzag Bridge) theo các đoạn NINE_TURN_BRIDGE_SEGMENTS */}
      <group name="nine-turn-bridge">
        {/* One non-overlapping union deck, geometrically cut at the stone island. */}
        <mesh geometry={nineTurnDeck} receiveShadow castShadow>
          <meshStandardMaterial map={lacquerTexture} color="#923c32" roughness={0.72} />
        </mesh>
        {/* Rails follow only the exposed union perimeter. Both landings stay open. */}
        {nineTurnRails.map((rail, index) => <mesh key={`rail-${index}`} position={rail.position} quaternion={rail.quaternion} castShadow>
          <cylinderGeometry args={[0.045, 0.045, rail.length, 8]} />
          <meshStandardMaterial color="#a63e32" roughness={0.6} />
        </mesh>)}
        {nineTurnLayout.posts.map((point, index) => {
          const floorY = getNineTurnBridgeHeight(point.x, point.z);
          return <group key={`post-${index}`} position={[point.x, floorY, point.z]}>
            <mesh position={[0, 0.42, 0]} castShadow>
              <cylinderGeometry args={[0.07, 0.085, 0.84, 8]} />
              <meshStandardMaterial color="#78352d" roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.86, 0]} castShadow>
              <sphereGeometry args={[0.085, 8, 8]} />
              <meshStandardMaterial color="#b69a5d" roughness={0.55} metalness={0.3} />
            </mesh>
          </group>;
        })}
      </group>
    </group>
  );
};

/**
 * ============================================================================
 * 4. BẢO THÁP XÁ LỢI 7 TẦNG (THÁP BÁO ÂN - VƯỜN LỘC UYỂN)
 * (x: 27, z: 10, cao 22m, 7 tầng)
 * ============================================================================
 */
const SevenStoryStupa: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { stupa } = TEMPLE_LANDMARKS;
  const windChimesRef = useRef<THREE.Group>(null);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(6, 6), []);
  const roofTileTexture = useMemo(() => getRoofTileTexture(8, 4), []);

  // Chiều cao và bán kính thu nhỏ dần cho 7 tầng tháp
  const storyData = useMemo(() => {
    return Array.from({ length: stupa.stories }, (_, i) => {
      const progress = i / (stupa.stories - 1); // 0 -> 1
      const radius = stupa.baseRadius * (1 - progress * 0.52); // 4.2 -> 2.0
      const storyHeight = 2.4 - progress * 0.45; // 2.4 -> 1.95
      return {
        level: i + 1,
        radius,
        storyHeight,
      };
    });
  }, [stupa]);

  useFrame(({ clock }) => {
    // Chuông gió đung đưa nhẹ nhàng theo làn gió thanh tịnh
    if (windChimesRef.current) {
      const t = clock.getElapsedTime();
      windChimesRef.current.children.forEach((chime, idx) => {
        chime.rotation.z = Math.sin(t * 2.2 + idx * 0.8) * 0.08;
        chime.rotation.x = Math.cos(t * 1.8 + idx * 0.6) * 0.06;
      });
    }
  });

  // Tính tọa độ Y tích lũy của từng tầng
  let currentY = 1.6; // Đỉnh bệ đá

  return (
    <group name="seven-story-stupa" position={[stupa.x, 0, stupa.z]}>
      {/* 1. Bệ Đá Tam Cấp Bát Giác Nâng Đỡ Bảo Tháp */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5.8, 6.2, 0.8, 8]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#475569" roughness={0.82} />
      </mesh>
      <mesh position={[0, 1.0, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[5.0, 5.4, 0.6, 8]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#64748b" roughness={0.78} />
      </mesh>
      <mesh position={[0, 1.45, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[4.4, 4.8, 0.35, 8]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.75} />
      </mesh>

      {/* Lan can đá quanh bệ tháp tầng 1 */}
      {Array.from({ length: 8 }, (_, idx) => {
        const angle = (idx / 8) * Math.PI * 2;
        const rx = Math.cos(angle) * 4.9;
        const rz = Math.sin(angle) * 4.9;
        return (
          <mesh key={idx} position={[rx, 1.6, rz]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.75, 8]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.65} />
          </mesh>
        );
      })}

      {/* 2. Thân Tháp 7 Tầng Uy Nghiêm */}
      <group>
        {storyData.map((story) => {
          const bottomY = currentY;
          currentY += story.storyHeight;
          const eaveRadius = story.radius * 1.38;

          return (
            <group key={story.level} position={[0, bottomY, 0]}>
              {/* Khối thân tháp bát giác xây gạch cổ */}
              <mesh position={[0, story.storyHeight / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry
                  args={[story.radius * 0.94, story.radius, story.storyHeight, 8]}
                />
                <meshStandardMaterial color="#78716c" roughness={0.82} />
              </mesh>

              {/* 4 Hốc vòm cửa sổ mở ra 4 hướng có Tượng Phật Vàng ngồi bên trong */}
              {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle, nIdx) => {
                const nx = Math.cos(angle) * (story.radius * 0.92);
                const nz = Math.sin(angle) * (story.radius * 0.92);
                return (
                  <group
                    key={nIdx}
                    position={[nx, story.storyHeight * 0.45, nz]}
                    rotation={[0, -angle + Math.PI / 2, 0]}
                  >
                    {/* Hốc vòm tối */}
                    <mesh>
                      <boxGeometry args={[0.5, 0.72, 0.18]} />
                      <meshStandardMaterial color="#1c1917" roughness={0.9} />
                    </mesh>
                    {/* Tượng Phật vàng nhỏ an tọa trong hốc */}
                    <mesh position={[0, -0.08, 0.05]} castShadow>
                      <sphereGeometry args={[0.14, 10, 10]} />
                      <meshStandardMaterial
                        color="#fef08a"
                        emissive="#f59e0b"
                        emissiveIntensity={isEveningOrNight ? 1.6 : 0.8}
                        metalness={0.7}
                      />
                    </mesh>
                  </group>
                );
              })}

              {/* Mái ngói đao cong 8 góc xòe rộng của từng tầng */}
              <group position={[0, story.storyHeight, 0]}>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[story.radius * 0.72, eaveRadius, 0.45, 8]} />
                  <meshStandardMaterial
                    map={roofTileTexture}
                    color="#b91c1c"
                    roughness={0.65}
                  />
                </mesh>
                {/* Diềm mái ngói lưu ly sẫm */}
                <mesh position={[0, -0.2, 0]} castShadow>
                  <cylinderGeometry args={[eaveRadius - 0.05, eaveRadius, 0.08, 8]} />
                  <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>

      {/* 3. Chuông Gió Đồng (Phong Linh) Treo Ở Góc Mái Các Tầng */}
      <group ref={windChimesRef} userData={{ cameraIgnore: true }}>
        {Array.from({ length: 8 }, (_, idx) => {
          const angle = (idx / 8) * Math.PI * 2 + Math.PI / 8;
          const cx = Math.cos(angle) * 3.6;
          const cz = Math.sin(angle) * 3.6;
          return (
            <group key={idx} position={[cx, 8.5, cz]}>
              {/* Dây treo & Chuông đồng nhỏ */}
              <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.006, 0.006, 0.3, 4]} />
                <meshStandardMaterial color="#451a03" />
              </mesh>
              <mesh position={[0, -0.35, 0]} castShadow>
                <coneGeometry args={[0.08, 0.16, 6]} />
                <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.25} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* 4. Đỉnh Tháp Tướng Luân Thếp Vàng & Bảo Châu Hào Quang */}
      <group position={[0, currentY, 0]}>
        {/* Bệ đài hoa sen đỉnh tháp */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[1.1, 1.4, 0.45, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.6} roughness={0.35} />
        </mesh>

        {/* 9 Vòng Tướng Luân thu nhỏ dần vút lên trời */}
        {Array.from({ length: 9 }, (_, rIdx) => {
          const ry = 0.55 + rIdx * 0.38;
          const ringRad = 0.85 * (1 - (rIdx / 9) * 0.65);
          return (
            <mesh key={rIdx} position={[0, ry, 0]} castShadow>
              <torusGeometry args={[ringRad, 0.075, 12, 24]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
            </mesh>
          );
        })}

        {/* Cột trụ Tướng Luân */}
        <mesh position={[0, 2.2, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.14, 3.8, 12]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Quả Bảo Châu (Hồ Lô Ngọc) phát sáng linh thiêng trên đỉnh cao nhất */}
        <mesh position={[0, 4.3, 0]}>
          <sphereGeometry args={[0.32, 16, 16]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#eab308"
            emissiveIntensity={isEveningOrNight ? 2.8 : 1.4}
            metalness={0.9}
            roughness={0.15}
          />
        </mesh>

        {/* Ánh hào quang từ đỉnh Bảo Tháp */}
        <BudgetPointLight
          position={[0, 4.5, 0]}
          color="#fef08a"
          intensity={isEveningOrNight ? 3.5 : 1.5}
          distance={18}
        />
      </group>

      {/* 5. Lối Đi Đá Xoay Quanh Bảo Tháp (Kora Đi Nhiễu Tháp) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[6.4, 8.8, 36]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#cbd5e1" roughness={0.82} />
      </mesh>
    </group>
  );
};

/**
 * ============================================================================
 * 5. LẦU TRỐNG BÁT NHÃ & QUẢ TRỐNG SẤM DA TRÂU (x: -12, z: 3, size 4.6m)
 * Đối xứng hoàn hảo với Lầu Chuông Đại Hồng Chung ở (x: 12, z: 3)
 * ============================================================================
 */
const BatNhaDrumTower: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { drumTower } = TEMPLE_LANDMARKS;
  const lacquerTexture = useMemo(() => getLacquerWoodTexture(4, 8), []);
  const roofTileTexture = useMemo(() => getRoofTileTexture(8, 6), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(4, 4), []);

  const pillarOffsets: [number, number][] = [
    [-1.75, -1.75],
    [1.75, -1.75],
    [-1.75, 1.75],
    [1.75, 1.75],
  ];

  return (
    <group name="bat-nha-drum-tower" position={[drumTower.x, 0, drumTower.z]}>
      {/* 1. Nền Đài Đá Tam Cấp Lầu Trống */}
      <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
        <boxGeometry args={[drumTower.size + 0.8, 0.44, drumTower.size + 0.8]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#475569" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.48, 0]} receiveShadow castShadow>
        <boxGeometry args={[drumTower.size + 0.2, 0.12, drumTower.size + 0.2]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#64748b" roughness={0.78} />
      </mesh>
      {/* Sàn gỗ gác lầu */}
      <mesh position={[0, 0.56, 0]} receiveShadow>
        <boxGeometry args={[drumTower.size - 0.2, 0.06, drumTower.size - 0.2]} />
        <meshStandardMaterial map={lacquerTexture} color="#78350f" roughness={0.7} />
      </mesh>

      {/* Lan can gỗ con tiện bảo vệ lầu trống */}
      {[-1, 1].map((signX) => (
        <mesh
          key={signX}
          position={[signX * (drumTower.size * 0.45), 0.95, 0]}
          castShadow
        >
          <boxGeometry args={[0.08, 0.65, drumTower.size * 0.82]} />
          <meshStandardMaterial color="#991b1b" roughness={0.65} />
        </mesh>
      ))}

      {/* 2. Bốn Cột Gỗ Lim To Khỏe Đỡ 2 Tầng Mái */}
      {pillarOffsets.map(([px, pz], idx) => (
        <group key={idx} position={[px, 0.54, pz]}>
          {/* Chân tảng đá xanh chạm cánh sen */}
          <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.34, 0.42, 0.32, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.85} />
          </mesh>
          {/* Thân cột lim sơn son trầm */}
          <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.24, 0.28, 4.4, 16]} />
            <meshStandardMaterial
              map={lacquerTexture}
              color="#7f1d1d"
              roughness={0.6}
            />
          </mesh>
        </group>
      ))}

      {/* Xà ngang & xà dọc liên kết 4 cột */}
      <mesh position={[0, 4.75, 0]} castShadow>
        <boxGeometry args={[3.8, 0.28, 3.8]} />
        <meshStandardMaterial map={lacquerTexture} color="#991b1b" roughness={0.6} />
      </mesh>

      {/* 3. Tầng Mái Hạ (Mái Ngói Âm Dương Uốn Đao) */}
      <mesh position={[0, 5.15, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <coneGeometry args={[3.6, 1.45, 4]} />
        <meshStandardMaterial
          map={roofTileTexture}
          color="#b91c1c"
          roughness={0.65}
        />
      </mesh>

      {/* Cổ diêm / Cổ lầu nâng tầng mái thượng */}
      <mesh position={[0, 6.0, 0]} castShadow>
        <boxGeometry args={[2.2, 0.65, 2.2]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
      </mesh>

      {/* Tầng Mái Thượng (Mái Chồng Diêm Uốn Đao Vút Lên) */}
      <mesh position={[0, 6.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <coneGeometry args={[2.7, 1.25, 4]} />
        <meshStandardMaterial
          map={roofTileTexture}
          color="#dc2626"
          roughness={0.65}
        />
      </mesh>
      {/* Đỉnh hồ lô đồng thếp vàng trên nóc lầu trống */}
      <mesh position={[0, 7.6, 0]} castShadow>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* 4. Quả Trống Sấm Bát Nhã Da Trâu (Đại Cổ) */}
      <group position={[0, 2.2, 0]}>
        {/* Giá đỡ trống chạm khắc tứ linh bằng gỗ lim */}
        <mesh position={[0, -0.75, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.22, 1.6]} />
          <meshStandardMaterial map={lacquerTexture} color="#450a0a" roughness={0.7} />
        </mesh>
        {[-0.85, 0.85].map((gx, gIdx) => (
          <mesh key={gIdx} position={[gx, -0.2, 0]} castShadow>
            <boxGeometry args={[0.18, 1.1, 1.2]} />
            <meshStandardMaterial map={lacquerTexture} color="#7f1d1d" roughness={0.65} />
          </mesh>
        ))}

        {/* Thân Trống Sấm hình tang trống phình to giữa, gỗ mít già sơn đỏ sẫm */}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.95, 0.95, 1.8, 24]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.55} />
        </mesh>
        {/* Đai đồng viền thân trống */}
        {[-0.55, 0, 0.55].map((offsetZ, bIdx) => (
          <mesh
            key={bIdx}
            position={[offsetZ, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            castShadow
          >
            <torusGeometry args={[0.96, 0.045, 12, 24]} />
            <meshStandardMaterial color="#ca8a04" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Hai mặt trống bịt Da Trâu Già vẽ vòng hoa sen / mặt trời */}
        {[-0.91, 0.91].map((faceX, fIdx) => (
          <group key={fIdx} position={[faceX, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <mesh>
              <circleGeometry args={[0.93, 24]} />
              <meshStandardMaterial color="#fed7aa" roughness={0.85} />
            </mesh>
            {/* Tâm mặt trống đỏ son */}
            <mesh position={[0, 0, 0.005]}>
              <circleGeometry args={[0.26, 16]} />
              <meshStandardMaterial color="#991b1b" roughness={0.7} />
            </mesh>
          </group>
        ))}

        {/* Dùi trống sơn đỏ treo bên hông giá đỡ */}
        <mesh position={[0, -0.2, 0.72]} rotation={[0, 0, Math.PI / 3]} castShadow>
          <cylinderGeometry args={[0.035, 0.045, 0.85, 8]} />
          <meshStandardMaterial color="#dc2626" roughness={0.5} />
        </mesh>
      </group>

      {/* Đèn lồng đỏ treo 4 góc hiên lầu trống */}
      {pillarOffsets.map(([lx, lz], idx) => (
        <group key={idx} position={[lx * 1.3, 4.3, lz * 1.3]}>
          <mesh>
            <sphereGeometry args={[0.24, 12, 12]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#dc2626"
              emissiveIntensity={isEveningOrNight ? 1.8 : 0.6}
            />
          </mesh>
          {isEveningOrNight && (
            <BudgetPointLight color="#f97316" intensity={0.9} distance={6} />
          )}
        </group>
      ))}
    </group>
  );
};

/**
 * ============================================================================
 * 6. HÀNH LANG TẢ VU & HỮU VU (18 VỊ LA HÁN)
 * West: minX: -19.6, maxX: -15, minZ: -19, maxZ: -3
 * East: minX: 15, maxX: 19.6, minZ: -19, maxZ: -3
 * ============================================================================
 */
const SideCorridors: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { sideCorridors } = TEMPLE_LANDMARKS;
  const lacquerTexture = useMemo(() => getLacquerWoodTexture(4, 8), []);
  const roofTileTexture = useMemo(() => getRoofTileTexture(8, 4), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(4, 8), []);

  return (
    <group name="side-corridors">
      {sideCorridors.map((corridor) => {
        const isWest = corridor.side === 'west';
        const width = corridor.maxX - corridor.minX; // 4.6m
        const depth = corridor.maxZ - corridor.minZ; // 16m
        const centerX = (corridor.minX + corridor.maxX) / 2;
        const centerZ = (corridor.minZ + corridor.maxZ) / 2;
        const backWallX = isWest ? corridor.minX + 0.35 : corridor.maxX - 0.35;
        const frontColX = isWest ? corridor.maxX - 0.35 : corridor.minX + 0.35;

        // Tọa độ 9 pho tượng La Hán dọc hành lang (mỗi bên 9 tượng = 18 vị)
        const arhatZPositions = Array.from(
          { length: 9 },
          (_, i) => corridor.minZ + 1.2 + i * 1.7
        );

        return (
          <group key={corridor.side}>
            {/* 1. Nền Tam Cấp Bằng Đá Xanh */}
            <mesh position={[centerX, 0.2, centerZ]} receiveShadow castShadow>
              <boxGeometry args={[width, 0.4, depth]} />
              <meshStandardMaterial
                map={carvedStoneTexture}
                color="#64748b"
                roughness={0.8}
              />
            </mesh>
            {/* Sàn hành lang lát gạch tàu ấm áp */}
            <mesh position={[centerX, 0.42, centerZ]} receiveShadow>
              <boxGeometry args={[width - 0.2, 0.04, depth - 0.2]} />
              <meshStandardMaterial color="#7c2d12" roughness={0.75} />
            </mesh>

            {/* 2. Tường Hậu Phía Ngoài (Trùng với vật cản va chạm) */}
            <mesh position={[backWallX, 1.8, centerZ]} receiveShadow castShadow>
              <boxGeometry args={[0.6, 2.8, depth]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
            </mesh>

            {/* 3. Hàng Cột Gỗ Lim Mặt Trước Đỡ Mái */}
            {Array.from({ length: 9 }, (_, cIdx) => {
              const colZ = corridor.minZ + 0.8 + cIdx * 1.8;
              return (
                <group key={cIdx} position={[frontColX, 0.42, colZ]}>
                  {/* Chân tảng đá */}
                  <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.24, 0.3, 0.24, 12]} />
                    <meshStandardMaterial color="#475569" roughness={0.8} />
                  </mesh>
                  {/* Thân cột lim */}
                  <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.18, 0.2, 2.6, 12]} />
                    <meshStandardMaterial
                      map={lacquerTexture}
                      color="#7f1d1d"
                      roughness={0.6}
                    />
                  </mesh>
                </group>
              );
            })}

            {/* 4. Mái Ngói Dốc Che Phủ Hành Lang */}
            <mesh
              position={[centerX, 3.25, centerZ]}
              rotation={[0, 0, isWest ? -0.22 : 0.22]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[width + 0.8, 0.2, depth + 0.4]} />
              <meshStandardMaterial
                map={roofTileTexture}
                color="#991b1b"
                roughness={0.65}
              />
            </mesh>

            {/* 5. Dãy Bệ Đá & Tượng 9 Vị La Hán Dọc Hành Lang */}
            {arhatZPositions.map((zPos, aIdx) => {
              const statueX = isWest ? centerX - 0.8 : centerX + 0.8;
              const globalArhatIdx = isWest ? aIdx + 1 : aIdx + 10;
              return (
                <group key={aIdx} position={[statueX, 0.42, zPos]}>
                  {/* Bệ đá hoa sen đặt tượng */}
                  <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.9, 0.6, 0.9]} />
                    <meshStandardMaterial color="#64748b" roughness={0.78} />
                  </mesh>
                  <mesh position={[0, 0.65, 0]} castShadow>
                    <cylinderGeometry args={[0.42, 0.38, 0.14, 12]} />
                    <meshStandardMaterial color="#94a3b8" roughness={0.72} />
                  </mesh>

                  {/* Tượng La Hán điêu khắc hữu cơ (GLB) */}
                  <Suspense fallback={null}>
                    <FigureModel
                      modelUrl={`/models/figures/arhats/arhat_${String(globalArhatIdx).padStart(2, '0')}.glb`}
                      position={[0, 0.72, 0]}
                      rotation={[0, isWest ? Math.PI / 2 : -Math.PI / 2, 0]}
                      scale={0.78}
                      castShadow
                      receiveShadow
                    />
                  </Suspense>

                  {/* Bảng tên vị La Hán bằng đồng son */}
                  <mesh position={[isWest ? 0.46 : -0.46, 0.35, 0]} rotation={[0, isWest ? -Math.PI / 2 : Math.PI / 2, 0]}>
                    <boxGeometry args={[0.34, 0.18, 0.02]} />
                    <meshStandardMaterial color="#b45309" metalness={0.6} roughness={0.4} />
                  </mesh>

                  {/* Ánh đèn lung linh soi sáng tượng La Hán vào buổi tối */}
                  {isEveningOrNight && aIdx % 2 === 0 && (
                    <BudgetPointLight
                      position={[0, 1.8, 0]}
                      color="#fde68a"
                      intensity={0.65}
                      distance={4.5}
                    />
                  )}
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

/**
 * ============================================================================
 * 7. VƯỜN THIỀN, BÀN TRÀ, NON BỘ & NHÀ TỔ HẬU VIỆN (z: -24 -> -39.5)
 * ============================================================================
 */
const ZenGardenAndAncestorHall: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { zenGarden, ancestorHall } = TEMPLE_LANDMARKS;

  const zenSandTexture = useMemo(() => getZenSandTexture(8, 8), []);
  const lacquerTexture = useMemo(() => getLacquerWoodTexture(4, 8), []);
  const roofTileTexture = useMemo(() => getRoofTileTexture(12, 6), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(6, 6), []);

  const waterfallSteamRef = useRef<THREE.Group>(null);

  const sandWidth = zenGarden.sandGarden.maxX - zenGarden.sandGarden.minX; // 9m
  const sandDepth = zenGarden.sandGarden.maxZ - zenGarden.sandGarden.minZ; // 12m
  const sandCenterX = (zenGarden.sandGarden.minX + zenGarden.sandGarden.maxX) / 2; // -7.5
  const sandCenterZ = (zenGarden.sandGarden.minZ + zenGarden.sandGarden.maxZ) / 2; // -30

  const hallWidth = ancestorHall.maxX - ancestorHall.minX; // 18m
  const hallDepth = ancestorHall.maxZ - ancestorHall.minZ; // 5.5m
  const hallCenterX = (ancestorHall.minX + ancestorHall.maxX) / 2; // 0
  const hallCenterZ = (ancestorHall.minZ + ancestorHall.maxZ) / 2; // -36.75

  useFrame(({ clock }) => {
    // Sương mờ bốc lên từ thác non bộ
    if (waterfallSteamRef.current) {
      const t = clock.getElapsedTime();
      waterfallSteamRef.current.children.forEach((drop, idx) => {
        drop.position.y = 0.4 + ((t * 0.4 + idx * 0.25) % 1.2);
        drop.scale.setScalar(0.1 + ((t * 0.4 + idx * 0.25) % 1.2) * 0.2);
      });
    }
  });

  return (
    <group name="zen-garden-and-ancestor-hall">
      {/* ===================================================================
          A. VƯỜN CÁT THIỀN KARESANSUI & BÃI ĐÁ THIỀN
         =================================================================== */}
      <group name="karesansui-sand-garden" position={[sandCenterX, 0, sandCenterZ]}>
        {/* Viền đá cuội bao quanh bãi cát thiền */}
        <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
          <boxGeometry args={[sandWidth + 0.6, 0.18, sandDepth + 0.6]} />
          <meshStandardMaterial color="#475569" roughness={0.85} />
        </mesh>

        {/* Mặt cát trắng cào sóng gợn thiền định Karesansui */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.16, 0]}
          receiveShadow
        >
          <planeGeometry args={[sandWidth, sandDepth]} />
          <meshStandardMaterial
            map={zenSandTexture}
            color="#f1f5f9"
            roughness={0.92}
          />
        </mesh>
      </group>

      {/* Bãi Đá Thiền Tĩnh Mặc (Zen Rocks) nằm trên mặt cát */}
      {zenGarden.zenRocks.map((rock, idx) => (
        <group key={idx} position={[rock.x, 0.16, rock.z]}>
          {/* Vòng đá cuội nhỏ xòe quanh chân khối đá */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[rock.radius * 0.8, rock.radius * 1.35, 16]} />
            <meshStandardMaterial color="#334155" roughness={0.9} />
          </mesh>
          {/* Tảng đá thiền rêu phong cổ kính */}
          <mesh position={[0, rock.radius * 0.85, 0]} castShadow receiveShadow>
            <dodecahedronGeometry args={[rock.radius, 1]} />
            <meshStandardMaterial color="#475569" roughness={0.88} />
          </mesh>
          {/* Vết rêu xanh bám trên đỉnh đá */}
          <mesh position={[0, rock.radius * 1.45, 0]}>
            <sphereGeometry args={[rock.radius * 0.35, 8, 8]} />
            <meshStandardMaterial color="#15803d" roughness={0.95} />
          </mesh>
        </group>
      ))}

      {/* ===================================================================
          B. TIỂU CẢNH NON BỘ & THÁC NƯỚC RÓC RÁCH (x: 10, z: -30)
         =================================================================== */}
      <group
        name="rock-waterfall"
        position={[zenGarden.rockWaterfall.x, 0, zenGarden.rockWaterfall.z]}
      >
        <PondBasin outerRadius={zenGarden.rockWaterfall.radius + 0.15}
          innerRadius={zenGarden.rockWaterfall.radius - 0.2} rimY={0.38} bottomY={0.02}
          color="#52645d" segments={32} />
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.28, 0]}
        >
          <circleGeometry args={[zenGarden.rockWaterfall.radius - 0.2, 24]} />
          <meshStandardMaterial
            color="#3b7775"
            roughness={0.22}
            depthWrite={false}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Khối đá non bộ sừng sững nhiều tầng */}
        <group position={[0, 0.3, 0]}>
          {/* Tầng đá chân */}
          <mesh position={[0, 0.75, -0.4]} castShadow receiveShadow>
            <dodecahedronGeometry args={[2.2, 1]} />
            <meshStandardMaterial color="#475569" roughness={0.9} />
          </mesh>
          {/* Tầng đá giữa đắp thác nước */}
          <mesh position={[0.3, 1.85, -0.3]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1.6, 1]} />
            <meshStandardMaterial color="#334155" roughness={0.85} />
          </mesh>
          {/* Đỉnh ngọn non bộ vươn cao */}
          <mesh position={[-0.2, 2.85, -0.2]} castShadow>
            <coneGeometry args={[0.9, 1.8, 7]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>

          {/* Dòng thác nước trắng xóa chảy tràn qua gờ đá */}
          <mesh position={[0.2, 1.45, 0.75]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.55, 1.4]} />
            <meshStandardMaterial
              color="#e0f2fe"
              roughness={0.1}
              transparent
              depthWrite={false}
              opacity={0.9}
            />
          </mesh>

          {/* Cây tùng bonsai nhỏ mọc trên kẽ đá non bộ */}
          <group position={[-0.8, 2.2, 0.3]}>
            <mesh rotation={[0.4, 0.2, -0.5]} castShadow>
              <cylinderGeometry args={[0.04, 0.08, 0.75, 6]} />
              <meshStandardMaterial color="#78350f" roughness={0.9} />
            </mesh>
            <mesh position={[-0.25, 0.45, 0.1]} castShadow>
              <sphereGeometry args={[0.38, 8, 8]} />
              <meshStandardMaterial color="#15803d" roughness={0.85} />
            </mesh>
          </group>

          {/* Sương hơi nước bốc lên từ chân thác */}
          <group ref={waterfallSteamRef} userData={{ cameraIgnore: true }} position={[0.2, 0.2, 0.8]}>
            {Array.from({ length: 6 }, (_, sIdx) => (
              <mesh key={sIdx} position={[(sIdx % 3 - 1) * 0.18, 0, 0]}>
                <sphereGeometry args={[0.15, 6, 6]} />
                <meshStandardMaterial
                  color="#f8fafc"
                  transparent
                  depthWrite={false}
                  opacity={0.35}
                />
              </mesh>
            ))}
          </group>
        </group>
      </group>

      {/* ===================================================================
          C. BÀN TRÀ ĐÁ THIỀN MÔN (x: 0, z: -28)
         =================================================================== */}
      <group
        name="zen-tea-table"
        position={[zenGarden.teaTable.x, 0, zenGarden.teaTable.z]}
      >
        {/* Nền sỏi cuội quanh bàn trà */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
          <circleGeometry args={[2.4, 24]} />
          <meshStandardMaterial color="#64748b" roughness={0.92} />
        </mesh>

        {/* Bàn trà bằng phiến đá tự nhiên phẳng phiu */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <cylinderGeometry
            args={[zenGarden.teaTable.radius, zenGarden.teaTable.radius * 0.9, 0.48, 18]}
          />
          <meshStandardMaterial map={carvedStoneTexture} color="#cbd5e1" roughness={0.65} />
        </mesh>

        {/* Khay trà, ấm gốm Tử Sa và chén trà sen bốc khói */}
        <group position={[0, 0.67, 0]}>
          {/* Khay trà tre */}
          <mesh receiveShadow>
            <boxGeometry args={[0.62, 0.03, 0.45]} />
            <meshStandardMaterial color="#78350f" roughness={0.7} />
          </mesh>
          {/* Ấm trà Tử Sa đất nung */}
          <mesh position={[-0.12, 0.08, 0]} castShadow>
            <sphereGeometry args={[0.075, 10, 10]} />
            <meshStandardMaterial color="#991b1b" roughness={0.5} />
          </mesh>
          {/* 4 Chén trà gốm men ngọc nhỏ nhắn */}
          {[
            [0.12, 0.08],
            [0.12, -0.08],
            [0.22, 0.04],
            [0.22, -0.04],
          ].map(([tx, tz], cIdx) => (
            <mesh key={cIdx} position={[tx, 0.04, tz]} castShadow>
              <cylinderGeometry args={[0.03, 0.02, 0.045, 8]} />
              <meshStandardMaterial color="#a7f3d0" roughness={0.3} />
            </mesh>
          ))}
        </group>

        {/* 4 Đôn đá mộc mạc xung quanh bàn trà */}
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle, sIdx) => {
          const sx = Math.cos(angle) * 1.55;
          const sz = Math.sin(angle) * 1.55;
          return (
            <mesh key={sIdx} position={[sx, 0.22, sz]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.34, 0.44, 12]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.8} />
            </mesh>
          );
        })}
      </group>

      {/* ===================================================================
          D. NHÀ TỔ (TỔ ĐƯỜNG) CỔ KÍNH CUỐI HẬU VIỆN
          (minX: -9, maxX: 9, minZ: -39.5, maxZ: -34)
         =================================================================== */}
      <group name="ancestor-hall" position={[hallCenterX, 0, hallCenterZ]}>
        {/* Nền tam cấp đá xanh Nhà Tổ */}
        <mesh position={[0, 0.35, 0]} receiveShadow castShadow>
          <boxGeometry args={[hallWidth + 1.2, 0.7, hallDepth + 0.8]} />
          <meshStandardMaterial map={carvedStoneTexture} color="#475569" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.72, 0]} receiveShadow>
          <boxGeometry args={[hallWidth + 0.6, 0.06, hallDepth + 0.4]} />
          <meshStandardMaterial color="#64748b" roughness={0.75} />
        </mesh>

        {/* Bậc thềm tam cấp chính giữa Nhà Tổ */}
        <mesh position={[0, 0.22, hallDepth / 2 + 0.55]} receiveShadow>
          <boxGeometry args={[4.2, 0.44, 1.1]} />
          <meshStandardMaterial map={carvedStoneTexture} color="#cbd5e1" roughness={0.8} />
        </mesh>

        {/* Tường hồi & Tường bao Nhà Tổ bằng gạch cổ */}
        <mesh position={[0, 2.5, -hallDepth / 2 + 0.35]} receiveShadow castShadow>
          <boxGeometry args={[hallWidth, 3.5, 0.6]} />
          <meshStandardMaterial color="#78716c" roughness={0.88} />
        </mesh>
        {[-hallWidth / 2 + 0.35, hallWidth / 2 - 0.35].map((wx, wIdx) => (
          <mesh key={wIdx} position={[wx, 2.5, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.6, 3.5, hallDepth]} />
            <meshStandardMaterial color="#78716c" roughness={0.88} />
          </mesh>
        ))}

        {/* Hàng Cột Gỗ Lim Tiền Hiên Nhà Tổ */}
        {[-7, -3.5, 0, 3.5, 7].map((cx, cIdx) => (
          <group key={cIdx} position={[cx, 0.74, hallDepth / 2 - 0.45]}>
            {/* Chân tảng đá */}
            <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.3, 0.38, 0.32, 12]} />
              <meshStandardMaterial color="#475569" roughness={0.8} />
            </mesh>
            {/* Thân cột gỗ lim */}
            <mesh position={[0, 1.85, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.22, 0.26, 3.4, 14]} />
              <meshStandardMaterial
                map={lacquerTexture}
                color="#7f1d1d"
                roughness={0.6}
              />
            </mesh>
          </group>
        ))}

        {/* Hệ Cửa Bức Bàn Gỗ Chạm Tứ Quý Mặt Tiền */}
        <mesh position={[0, 2.2, hallDepth / 2 - 1.2]} castShadow>
          <boxGeometry args={[hallWidth - 2.8, 2.8, 0.12]} />
          <meshStandardMaterial map={lacquerTexture} color="#991b1b" roughness={0.65} />
        </mesh>

        {/* Hoành Phi Sơn Son Thếp Vàng "VẠN ĐỨC TRANG NGHIÊM" */}
        <group position={[0, 3.8, hallDepth / 2 - 0.4]}>
          <mesh castShadow>
            <boxGeometry args={[3.2, 0.75, 0.08]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.045]}>
            <boxGeometry args={[2.9, 0.58, 0.02]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.75} roughness={0.3} />
          </mesh>
        </group>

        {/* Hệ Mái Ngói Mũi Hài Cổ Uốn Đao Cong */}
        <mesh
          position={[0, 4.8, 0]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
          receiveShadow
        >
          <coneGeometry args={[hallWidth * 0.65, 2.2, 4]} />
          <meshStandardMaterial
            map={roofTileTexture}
            color="#991b1b"
            roughness={0.65}
          />
        </mesh>
        {/* Đôi Kìm Nóc & Pháp Luân Trên Bờ Nóc Nhà Tổ */}
        <mesh position={[0, 6.0, 0]} castShadow>
          <boxGeometry args={[hallWidth * 0.5, 0.22, 0.35]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
        </mesh>
        <mesh position={[0, 6.35, 0]} castShadow>
          <torusGeometry args={[0.35, 0.08, 12, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Ánh sáng ấm cúng từ Tổ Đường tỏa ra hiên */}
        <BudgetPointLight
          position={[0, 2.6, hallDepth / 2 - 0.5]}
          color="#fbbf24"
          intensity={isEveningOrNight ? 2.4 : 0.8}
          distance={10}
        />
      </group>
    </group>
  );
};

/**
 * ============================================================================
 * EXPORT CHÍNH: TEMPLE OUTER COMPLEX
 * Quần Thể Kiến Trúc Chùa Mở Rộng Gấp 3.5 Lần
 * ============================================================================
 */
export const TempleOuterComplex: React.FC<TempleOuterComplexProps> = React.memo(
  ({ timeOfDay }) => {
    const isEveningOrNight = timeOfDay === 'sunset' || timeOfDay === 'night';

    return (
      <group name="temple-outer-complex">
        {/* 1. Hồ Phóng Sinh, Cầu Đá Bán Nguyệt vòm cong & Đàn cá chép bơi lượn */}
        <MoonBridgeAndReleasePond isEveningOrNight={isEveningOrNight} />

        {/* 2. Đôi Nghê / Sư Tử Đá Hộ Pháp trước Tam Quan */}
        <GuardianLions />

        {/* 3. Đài Quan Âm Nam Hải áo trắng thanh khiết & Cầu Gỗ Đỏ Cửu Khúc */}
        <QuanAmSanctuary isEveningOrNight={isEveningOrNight} />

        {/* 4. Bảo Tháp Xá Lợi 7 Tầng uy nghiêm & Chuông gió đung đưa */}
        <SevenStoryStupa isEveningOrNight={isEveningOrNight} />

        {/* 5. Lầu Trống Bát Nhã & Quả Trống Sấm da trâu sơn đỏ đối xứng Lầu Chuông */}
        <BatNhaDrumTower isEveningOrNight={isEveningOrNight} />

        {/* 6. Hành Lang Tả Vu & Hữu Vu có tượng 18 vị La Hán */}
        <SideCorridors isEveningOrNight={isEveningOrNight} />

        {/* 7. Vườn Thiền Karesansui, Bàn Trà Đá, Non Bộ & Nhà Tổ Hậu Viện */}
        <ZenGardenAndAncestorHall isEveningOrNight={isEveningOrNight} />
      </group>
    );
  }
);

TempleOuterComplex.displayName = 'TempleOuterComplex';

export default TempleOuterComplex;
