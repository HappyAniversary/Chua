import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  COURTYARD_LOTUS_PONDS,
  GROUND_EXTENT,
  TEMPLE_LANDMARKS,
} from '../../constants/templeLayout';
import type {
  IncenseWish,
  InteractionZoneId,
  TimeOfDay,
} from '../../types/game';
import {
  getCarvedStoneTexture,
  getLacquerWoodTexture,
  getRoofTileTexture,
  getTerracottaTileTexture,
  getSurfaceDetailMaps,
} from '../../utils/proceduralTextures';
import { BudgetPointLight, useEnvironmentQuality } from './EnvironmentQuality';
import { PondBasin } from './PondBasin';
import { BodhiTreePlanter } from './BodhiTreePlanter';
import { createGroundWithPondHoles } from './SurfaceGeometry';
import { TempleOuterComplex } from './TempleOuterComplex';

export interface TempleCourtyardProps {
  timeOfDay: TimeOfDay;
  activeZoneId?: InteractionZoneId | null;
  bellStrikePulse?: number;
  woodenFishPulse?: number;
  recentWishes?: IncenseWish[];
}

/**
 * ============================================================================
 * 1. HÀNG TRỤ ĐÈN ĐÁ DỌC LỐI ĐI VỚI INSTANCED MESH
 * Giảm hàng trăm Draw Calls xuống chỉ còn 6 Draw Calls duy nhất!
 * ============================================================================
 */
interface LanternInstanceData {
  x: number;
  z: number;
  rotY: number;
  hasLight: boolean;
}

const InstancedStoneLanterns: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const baseMeshRef = useRef<THREE.InstancedMesh>(null);
  const shaftMeshRef = useRef<THREE.InstancedMesh>(null);
  const collarMeshRef = useRef<THREE.InstancedMesh>(null);
  const lightBoxMeshRef = useRef<THREE.InstancedMesh>(null);
  const roofMeshRef = useRef<THREE.InstancedMesh>(null);
  const finialMeshRef = useRef<THREE.InstancedMesh>(null);

  const lanterns = useMemo<LanternInstanceData[]>(() => {
    return [
      // Dọc Đường Thần Đạo (6 cặp = 12 đèn)
      { x: -2.8, z: 22, rotY: 0, hasLight: true },
      { x: 2.8, z: 22, rotY: 0, hasLight: true },
      { x: -2.8, z: 17, rotY: 0, hasLight: false },
      { x: 2.8, z: 17, rotY: 0, hasLight: false },
      { x: -2.8, z: 12, rotY: 0, hasLight: true },
      { x: 2.8, z: 12, rotY: 0, hasLight: true },
      { x: -2.8, z: 7, rotY: 0, hasLight: false },
      { x: 2.8, z: 7, rotY: 0, hasLight: false },
      { x: -2.8, z: 2, rotY: 0, hasLight: true },
      { x: 2.8, z: 2, rotY: 0, hasLight: true },
      { x: -2.8, z: -3, rotY: 0, hasLight: false },
      { x: 2.8, z: -3, rotY: 0, hasLight: false },

      // Ngoại vi Quảng trường & Đầu Cầu Bán Nguyệt (6 đèn)
      { x: -12, z: 45.5, rotY: Math.PI / 4, hasLight: true },
      { x: 12, z: 45.5, rotY: -Math.PI / 4, hasLight: true },
      { x: -6, z: 44, rotY: 0, hasLight: false },
      { x: 6, z: 44, rotY: 0, hasLight: false },
      { x: -3.2, z: 43.5, rotY: 0, hasLight: true },
      { x: 3.2, z: 43.5, rotY: 0, hasLight: true },

      // Trước Lầu Chuông & Lầu Trống (4 đèn)
      { x: 9.5, z: 6, rotY: Math.PI / 4, hasLight: true },
      { x: 14.5, z: 6, rotY: -Math.PI / 4, hasLight: false },
      { x: -9.5, z: 6, rotY: -Math.PI / 4, hasLight: true },
      { x: -14.5, z: 6, rotY: Math.PI / 4, hasLight: false },

      // Quanh Bảo Tháp & Hồ Sen (4 đèn)
      { x: 21, z: 10, rotY: Math.PI / 2, hasLight: true },
      { x: 33, z: 10, rotY: -Math.PI / 2, hasLight: true },
      { x: -17, z: 10, rotY: -Math.PI / 2, hasLight: true },
      { x: -17, z: 16, rotY: 0, hasLight: false },
    ];
  }, []);

  const count = lanterns.length;

  useEffect(() => {
    const dummy = new THREE.Object3D();

    lanterns.forEach((l, i) => {
      // 1. Chân đế đá
      dummy.position.set(l.x, 0.16, l.z);
      dummy.rotation.set(0, l.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      baseMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // 2. Thân trụ đèn
      dummy.position.set(l.x, 0.85, l.z);
      dummy.updateMatrix();
      shaftMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // 3. Bệ đỡ lồng đèn
      dummy.position.set(l.x, 1.45, l.z);
      dummy.updateMatrix();
      collarMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // 4. Lồng đèn phát sáng
      dummy.position.set(l.x, 1.72, l.z);
      dummy.updateMatrix();
      lightBoxMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // 5. Mái đèn đá 4 góc
      dummy.position.set(l.x, 2.06, l.z);
      dummy.rotation.set(0, l.rotY + Math.PI / 4, 0);
      dummy.updateMatrix();
      roofMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // 6. Búp sen đỉnh đèn
      dummy.position.set(l.x, 2.28, l.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      finialMeshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (baseMeshRef.current) {
      baseMeshRef.current.instanceMatrix.needsUpdate = true;
      baseMeshRef.current.computeBoundingBox();
      baseMeshRef.current.computeBoundingSphere();
    }
    if (shaftMeshRef.current) {
      shaftMeshRef.current.instanceMatrix.needsUpdate = true;
      shaftMeshRef.current.computeBoundingBox();
      shaftMeshRef.current.computeBoundingSphere();
    }
    if (collarMeshRef.current) {
      collarMeshRef.current.instanceMatrix.needsUpdate = true;
      collarMeshRef.current.computeBoundingBox();
      collarMeshRef.current.computeBoundingSphere();
    }
    if (lightBoxMeshRef.current) {
      lightBoxMeshRef.current.instanceMatrix.needsUpdate = true;
      lightBoxMeshRef.current.computeBoundingBox();
      lightBoxMeshRef.current.computeBoundingSphere();
    }
    if (roofMeshRef.current) {
      roofMeshRef.current.instanceMatrix.needsUpdate = true;
      roofMeshRef.current.computeBoundingBox();
      roofMeshRef.current.computeBoundingSphere();
    }
    if (finialMeshRef.current) {
      finialMeshRef.current.instanceMatrix.needsUpdate = true;
      finialMeshRef.current.computeBoundingBox();
      finialMeshRef.current.computeBoundingSphere();
    }
  }, [lanterns]);

  const emissiveColor = isEveningOrNight ? '#f59e0b' : '#d97706';
  const emissiveIntensity = isEveningOrNight ? 1.85 : 0.35;

  return (
    <group name="instanced-stone-lanterns">
      {/* 1. Chân đế đá */}
      <instancedMesh
        ref={baseMeshRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.64, 0.32, 0.64]} />
        <meshStandardMaterial color="#57534e" roughness={0.88} />
      </instancedMesh>

      {/* 2. Thân trụ đá */}
      <instancedMesh
        ref={shaftMeshRef}
        args={[undefined, undefined, count]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.17, 0.23, 1.1, 8]} />
        <meshStandardMaterial color="#78716c" roughness={0.85} />
      </instancedMesh>

      {/* 3. Bệ đỡ lồng đèn */}
      <instancedMesh
        ref={collarMeshRef}
        args={[undefined, undefined, count]}
        castShadow
      >
        <cylinderGeometry args={[0.32, 0.22, 0.14, 8]} />
        <meshStandardMaterial color="#57534e" roughness={0.82} />
      </instancedMesh>

      {/* 4. Lồng đèn phát sáng */}
      <instancedMesh
        ref={lightBoxMeshRef}
        args={[undefined, undefined, count]}
      >
        <boxGeometry args={[0.36, 0.38, 0.36]} />
        <meshStandardMaterial
          color={isEveningOrNight ? '#fef08a' : '#fde68a'}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.35}
        />
      </instancedMesh>

      {/* 5. Mái đèn đá 4 góc */}
      <instancedMesh
        ref={roofMeshRef}
        args={[undefined, undefined, count]}
        castShadow
      >
        <coneGeometry args={[0.48, 0.34, 4]} />
        <meshStandardMaterial color="#44403c" roughness={0.8} />
      </instancedMesh>

      {/* 6. Búp sen đỉnh đèn */}
      <instancedMesh
        ref={finialMeshRef}
        args={[undefined, undefined, count]}
      >
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshStandardMaterial color="#57534e" roughness={0.75} />
      </instancedMesh>

      {/* Điểm sáng ấm áp từ các trụ đèn chính vào chiều tà và ban đêm */}
      {isEveningOrNight &&
        lanterns
          .filter((l) => l.hasLight)
          .map((l, idx) => (
            <BudgetPointLight
              key={idx}
              position={[l.x, 1.75, l.z]}
              color="#fbbf24"
              intensity={1.15}
              distance={7.5}
            />
          ))}
    </group>
  );
};

/**
 * ============================================================================
 * 2. RỪNG TRÚC HẬU VIỆN & TẢ HỮU VỚI INSTANCED MESH
 * Phủ khắp TEMPLE_LANDMARKS.bambooGroves và dọc tường bao với chỉ 2 Draw Calls!
 * ============================================================================
 */
interface BambooInstanceData {
  x: number;
  z: number;
  height: number;
  rotX: number;
  rotZ: number;
}

const InstancedBambooForest: React.FC = () => {
  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const foliageMeshRef = useRef<THREE.InstancedMesh>(null);

  const bamboos = useMemo<BambooInstanceData[]>(() => {
    const list: BambooInstanceData[] = [];
    const { bambooGroves } = TEMPLE_LANDMARKS;

    // Rừng trúc 2 góc hậu viện (-45..-36, -39..-22) và (36..45, -39..-22)
    bambooGroves.forEach((grove, gIdx) => {
      const stepX = 1.4;
      const stepZ = 1.6;
      for (let x = grove.minX + 0.8; x <= grove.maxX - 0.8; x += stepX) {
        for (let z = grove.minZ + 0.8; z <= grove.maxZ - 0.8; z += stepZ) {
          const jitterX = Math.sin(x * 12.3 + z * 7.7) * 0.45;
          const jitterZ = Math.cos(x * 9.1 + z * 14.2) * 0.45;
          const h = 4.8 + Math.abs(Math.sin(x * 5 + z * 3)) * 1.8;
          const tiltX = Math.sin(x * 3 + gIdx) * 0.05;
          const tiltZ = Math.cos(z * 3 + gIdx) * 0.05;
          list.push({
            x: x + jitterX,
            z: z + jitterZ,
            height: h,
            rotX: tiltX,
            rotZ: tiltZ,
          });
        }
      }
    });

    // Hàng trúc dọc tường bao tả hữu (x = -44.5 và x = 44.5)
    [-44.5, 44.5].forEach((wx, wIdx) => {
      for (let z = -20; z <= 22; z += 1.8) {
        const h = 4.5 + Math.abs(Math.sin(z * 4.2)) * 1.5;
        list.push({
          x: wx + Math.sin(z * 7) * 0.3,
          z: z + Math.cos(z * 5) * 0.25,
          height: h,
          rotX: Math.sin(z) * 0.04,
          rotZ: wIdx === 0 ? 0.04 : -0.04,
        });
      }
    });

    return list;
  }, []);

  const count = bamboos.length;

  useEffect(() => {
    const dummy = new THREE.Object3D();

    bamboos.forEach((b, i) => {
      // 1. Thân cây trúc
      dummy.position.set(b.x, b.height / 2, b.z);
      dummy.rotation.set(b.rotX, 0, b.rotZ);
      dummy.scale.set(1, b.height / 5.5, 1);
      dummy.updateMatrix();
      trunkMeshRef.current?.setMatrixAt(i, dummy.matrix);

      // 2. Tán lá trúc trên cao
      dummy.position.set(b.x + b.rotZ * 0.4, b.height - 0.3, b.z - b.rotX * 0.4);
      dummy.rotation.set(0, (i * 0.3) % (Math.PI * 2), 0);
      dummy.scale.set(1.1, 0.7, 1.1);
      dummy.updateMatrix();
      foliageMeshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    if (trunkMeshRef.current) {
      trunkMeshRef.current.instanceMatrix.needsUpdate = true;
      trunkMeshRef.current.computeBoundingBox();
      trunkMeshRef.current.computeBoundingSphere();
    }
    if (foliageMeshRef.current) {
      foliageMeshRef.current.instanceMatrix.needsUpdate = true;
      foliageMeshRef.current.computeBoundingBox();
      foliageMeshRef.current.computeBoundingSphere();
    }
  }, [bamboos]);

  return (
    <group name="instanced-bamboo-forest">
      {/* Thân cây trúc xanh */}
      <instancedMesh
        ref={trunkMeshRef}
        args={[undefined, undefined, count]}
        castShadow
      >
        <cylinderGeometry args={[0.065, 0.085, 5.5, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.65} />
      </instancedMesh>

      {/* Tán lá trúc sum suê */}
      <instancedMesh
        ref={foliageMeshRef}
        args={[undefined, undefined, count]}
        castShadow
      >
        <sphereGeometry args={[0.85, 8, 8]} />
        <meshStandardMaterial color="#22c55e" roughness={0.75} />
      </instancedMesh>
    </group>
  );
};

/**
 * ============================================================================
 * 3. HỆ THỐNG LÁ SEN & HOA SEN VỚI INSTANCED MESH
 * Phủ trên các hồ còn tồn tại: Hồ Sen Sân Chùa, Hồ Quan Âm & Hồ Phóng Sinh.
 * ============================================================================
 */
interface LotusInstanceData {
  x: number;
  y: number;
  z: number;
  radius: number;
  rotY: number;
  hasFlower: boolean;
}

const InstancedLotusSystem: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const leafMeshRef = useRef<THREE.InstancedMesh>(null);
  const flowerMeshRef = useRef<THREE.InstancedMesh>(null);

  const { lotusPads, flowerCount } = useMemo(() => {
    const list: LotusInstanceData[] = [];

    // 1. Sen sân chùa theo đúng các hồ còn tồn tại trong layout.
    COURTYARD_LOTUS_PONDS.forEach(({ x: cx, z: cz, innerRadius }) => {
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dist = Math.min(0.6 + ((i * 1.7) % 2.5), innerRadius - 0.03 - (0.42 + (i % 3) * 0.12) - 0.12);
        list.push({
          x: cx + Math.cos(angle) * dist,
          y: 0.445,
          z: cz + Math.sin(angle) * dist,
          radius: 0.42 + (i % 3) * 0.12,
          rotY: angle + 0.3,
          hasFlower: i % 2 === 0,
        });
      }
    });

    // 2. Hồ Sen Quan Âm (x = -27, z = 10, r = 9m, đảo r = 3.2m)
    for (let i = 0; i < 48; i++) {
      const angle = (i / 48) * Math.PI * 2;
      const dist = Math.min(4.2 + ((i * 2.3) % 4.2), 8.9 - (0.48 + (i % 4) * 0.14) - 0.12);
      const x = -27 + Math.cos(angle) * dist;
      const z = 10 + Math.sin(angle) * dist;
      if (x > -25 && x < -17 && z > 7 && z < 13) continue;
      list.push({
        x,
        y: TEMPLE_LANDMARKS.quanAmPond.waterY + 0.065,
        z,
        radius: 0.48 + (i % 4) * 0.14,
        rotY: angle * 1.5,
        hasFlower: i % 3 === 0,
      });
    }

    // 3. Hồ Phóng Sinh (x: -22..22, z: 33..40, trừ cầu x: -2.4..2.4)
    for (let i = 0; i < 64; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const lx = side * (4.5 + (i % 16) * 1.15);
      const lz = 33.5 + ((i * 1.9) % 6.0);
      list.push({
        x: lx,
        y: TEMPLE_LANDMARKS.releasePond.waterY + 0.065,
        z: lz,
        radius: 0.45 + (i % 3) * 0.15,
        rotY: i * 0.7,
        hasFlower: i % 4 === 0,
      });
    }

    const flowers = list.filter((p) => p.hasFlower);
    return { lotusPads: list, flowerCount: flowers.length };
  }, []);

  const totalLeaves = lotusPads.length;

  useEffect(() => {
    const dummy = new THREE.Object3D();

    // 1. Cập nhật lá sen
    lotusPads.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0.04 * Math.sin(i), p.rotY, 0.04 * Math.cos(i));
      dummy.scale.set(p.radius, 1, p.radius);
      dummy.updateMatrix();
      leafMeshRef.current?.setMatrixAt(i, dummy.matrix);
    });

    // 2. Cập nhật hoa sen nở
    let fIdx = 0;
    lotusPads.forEach((p) => {
      if (!p.hasFlower) return;
      dummy.position.set(p.x, p.y + 0.14, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      flowerMeshRef.current?.setMatrixAt(fIdx, dummy.matrix);
      fIdx++;
    });

    if (leafMeshRef.current) {
      leafMeshRef.current.instanceMatrix.needsUpdate = true;
      leafMeshRef.current.computeBoundingBox();
      leafMeshRef.current.computeBoundingSphere();
    }
    if (flowerMeshRef.current) {
      flowerMeshRef.current.instanceMatrix.needsUpdate = true;
      flowerMeshRef.current.computeBoundingBox();
      flowerMeshRef.current.computeBoundingSphere();
    }
  }, [lotusPads]);

  return (
    <group name="instanced-lotus-system">
      {/* Hàng trăm lá sen xanh mướt dập dềnh */}
      <instancedMesh
        ref={leafMeshRef}
        args={[undefined, undefined, totalLeaves]}
        receiveShadow
      >
        <cylinderGeometry args={[1, 0.96, 0.024, 18]} />
        <meshStandardMaterial color="#166534" roughness={0.7} />
      </instancedMesh>

      {/* Hoa sen hồng tỏa sắc ngát hương */}
      <instancedMesh
        ref={flowerMeshRef}
        args={[undefined, undefined, flowerCount]}
        castShadow
      >
        <coneGeometry args={[0.2, 0.28, 8]} />
        <meshStandardMaterial
          color="#f472b6"
          emissive="#db2777"
          emissiveIntensity={isEveningOrNight ? 0.38 : 0.12}
          roughness={0.42}
        />
      </instancedMesh>
    </group>
  );
};

/**
 * ============================================================================
 * 4. TÙNG LA HÁN / THÔNG CỔ THỤ NGOẠI VI (TEMPLE_LANDMARKS.ancientPines)
 * ============================================================================
 */
const AncientPines: React.FC = () => {
  const { ancientPines } = TEMPLE_LANDMARKS;

  return (
    <group name="ancient-pines">
      {ancientPines.map((pine, idx) => (
        <group key={idx} position={[pine.x, 0, pine.z]}>
          {/* Bồn đá bọc gốc tùng */}
          <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[1.35, 1.55, 0.3, 10]} />
            <meshStandardMaterial color="#57534e" roughness={0.85} />
          </mesh>

          {/* Thân cây tùng gân guốc, uốn lượn cổ thụ */}
          <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.38, 0.65, 3.4, 10]} />
            <meshStandardMaterial color="#451a03" roughness={0.92} />
          </mesh>
          <mesh position={[0.2, 3.8, 0.15]} rotation={[0.15, 0, -0.22]} castShadow>
            <cylinderGeometry args={[0.24, 0.38, 2.2, 8]} />
            <meshStandardMaterial color="#451a03" roughness={0.92} />
          </mesh>

          {/* Các tán thông xanh ngắt xòe rộng thành từng mâm xôi */}
          {[
            [0, 3.4, 0, 1.8, 0.7],
            [-0.6, 4.4, 0.4, 1.5, 0.6],
            [0.7, 4.8, -0.3, 1.4, 0.55],
            [0, 5.6, 0.1, 1.2, 0.5],
          ].map(([tx, ty, tz, rad, th], tIdx) => (
            <mesh key={tIdx} position={[tx, ty, tz]} castShadow>
              <cylinderGeometry args={[rad * 0.4, rad, th, 8]} />
              <meshStandardMaterial color="#14532d" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

/**
 * ============================================================================
 * 5. MẶT SÂN TỔNG THỂ (GROUND_EXTENT 220m x 220m), ĐƯỜNG THẦN ĐẠO & BÁI ĐƯỜNG
 * ============================================================================
 */
const CourtyardGroundAndPath: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { quality } = useEnvironmentQuality();
  const surfaceDetails = useMemo(() => getSurfaceDetailMaps('terracotta', 24, 24), []);
  const terracottaTexture = useMemo(() => getTerracottaTileTexture(24, 24), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(4, 28), []);
  const { sacredPath, centralCourtyard, outerPlaza } = TEMPLE_LANDMARKS;

  const courtyardPondHoles = useMemo(() => COURTYARD_LOTUS_PONDS.map(({ x, z, innerRadius }) => ({ x, z, radius: innerRadius })), []);
  const groundGeometry = useMemo(() => createGroundWithPondHoles({
    minX: GROUND_EXTENT.centerX - GROUND_EXTENT.width / 2,
    maxX: GROUND_EXTENT.centerX + GROUND_EXTENT.width / 2,
    minZ: GROUND_EXTENT.centerZ - GROUND_EXTENT.depth / 2,
    maxZ: GROUND_EXTENT.centerZ + GROUND_EXTENT.depth / 2,
  }, [...courtyardPondHoles,
    { ...TEMPLE_LANDMARKS.quanAmPond },
    { ...TEMPLE_LANDMARKS.zenGarden.rockWaterfall, radius: TEMPLE_LANDMARKS.zenGarden.rockWaterfall.radius - 0.2 },
  ], [TEMPLE_LANDMARKS.releasePond]), [courtyardPondHoles]);
  const courtGeometry = useMemo(() => createGroundWithPondHoles(centralCourtyard, courtyardPondHoles), [courtyardPondHoles, centralCourtyard]);

  useEffect(() => () => {
    groundGeometry.dispose();
    courtGeometry.dispose();
  }, [groundGeometry, courtGeometry]);

  const pathDepth = sacredPath.fromZ - sacredPath.toZ; // 28.5m
  const pathCenterZ = (sacredPath.fromZ + sacredPath.toZ) / 2; // 8.75m

  const courtWidth = centralCourtyard.maxX - centralCourtyard.minX; // 32m
  const courtDepth = centralCourtyard.maxZ - centralCourtyard.minZ; // 28m
  const courtCenterZ = (centralCourtyard.minZ + centralCourtyard.maxZ) / 2; // 8m

  return (
    <group name="courtyard-ground-and-path">
      {/* 1. Nền Đất Cỏ / Đá Tự Nhiên Toàn Bản Đồ (GROUND_EXTENT: 220m x 220m) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        geometry={groundGeometry}
        receiveShadow
      >
        <meshStandardMaterial color="#626854" roughness={0.96} />
      </mesh>

      {/* 2. Mặt Sân Gạch Tàu Bát Tràng Trung Tâm (32m x 28m) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        geometry={courtGeometry}
        receiveShadow
      >
        <meshStandardMaterial
          map={terracottaTexture}
          color="#bb8e76"
          normalMap={quality !== 'low' ? surfaceDetails.normalMap : null}
          normalScale={new THREE.Vector2(0.24, 0.24)}
          roughnessMap={quality !== 'low' ? surfaceDetails.roughnessMap : null}
          roughness={1}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Viền đá bao bọc quanh sân gạch Bát Tràng */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, courtCenterZ]}
        receiveShadow
      >
        <ringGeometry args={[16.2, 17.0, 4]} />
        <meshStandardMaterial color="#475569" roughness={0.85} />
      </mesh>

      {/* 3. Quảng Trường Ngoại Vi Nơi Chú Tiểu Xuất Hiện (30m x 7m) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[outerPlaza.x, 0, outerPlaza.z]}
        receiveShadow
      >
        <planeGeometry args={[outerPlaza.width, outerPlaza.depth]} />
        <meshStandardMaterial
          map={carvedStoneTexture}
          color="#a8b4ac"
          roughness={0.82}
          polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>

      {/* 4. Trục Thần Đạo Đá Xanh Chạm Khắc Từ Cổng Tam Quan Đến Chánh Điện */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[sacredPath.x, 0, pathCenterZ]}
        receiveShadow
      >
        <planeGeometry args={[sacredPath.width, pathDepth]} />
        <meshStandardMaterial
          map={carvedStoneTexture}
          color="#cbd3c9"
          roughness={0.8}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Gờ đá hai bên mép Thần Đạo */}
      {[-sacredPath.width / 2 - 0.08, sacredPath.width / 2 + 0.08].map(
        (xEdge, idx) => (
          <mesh
            key={idx}
            position={[xEdge, 0.035, pathCenterZ]}
            receiveShadow
            castShadow
          >
            <boxGeometry args={[0.18, 0.07, pathDepth]} />
            <meshStandardMaterial color="#64748b" roughness={0.8} />
          </mesh>
        )
      )}

      {/* Các phiến đá chạm sen chữ nhật lớn dọc trục Thần Đạo */}
      {[21, 16, 11, 6, 1, -4].map((pz) => (
        <mesh
          key={pz}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, pz]}
          receiveShadow
        >
          <planeGeometry args={[2.8, 1.8]} />
          <meshStandardMaterial color="#d7ddd2" roughness={0.76} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      ))}

      {/* Branches end at the sacred path: no coplanar intersection. */}
      {[{ z: 3, halfWidth: 14, depth: 2.2 }, { z: 14, halfWidth: 12, depth: 2 }].flatMap(({ z, halfWidth, depth }) =>
        [-1, 1].map(side => <mesh key={`${z}-${side}`} rotation={[-Math.PI / 2, 0, 0]}
          position={[side * (halfWidth + sacredPath.width / 2) / 2, 0, z]} receiveShadow>
          <planeGeometry args={[halfWidth - sacredPath.width / 2, depth]} />
          <meshStandardMaterial color="#75827b" roughness={0.86} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>)
      )}

      {/* Hàng Trụ Đèn Đá Dọc Lối Đi (InstancedMesh) */}
      <InstancedStoneLanterns isEveningOrNight={isEveningOrNight} />
    </group>
  );
};

/**
 * ============================================================================
 * 6. ĐẠI CỔNG TAM QUAN 3 TẦNG MÁI CONG (z = 24, x = 0, width = 18m)
 * Dùng Cột Gỗ Lim getLacquerWoodTexture() & Ngói getRoofTileTexture()
 * ============================================================================
 */
const TamQuanGate: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const lanternsGroupRef = useRef<THREE.Group>(null);
  const lacquerTexture = useMemo(() => getLacquerWoodTexture(4, 8), []);
  const roofTileTexture = useMemo(() => getRoofTileTexture(8, 6), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(4, 4), []);

  useFrame(({ clock }) => {
    if (!lanternsGroupRef.current) return;
    const t = clock.getElapsedTime();
    lanternsGroupRef.current.rotation.z = Math.sin(t * 1.6) * 0.045;
    lanternsGroupRef.current.rotation.x = Math.cos(t * 1.2) * 0.03;
  });

  const { tamQuanGate } = TEMPLE_LANDMARKS;

  return (
    <group position={[tamQuanGate.x, 0, tamQuanGate.z]} name="tam-quan-gate">
      {/* Bậc thềm đá trước và sau Cổng Tam Quan */}
      <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
        <boxGeometry args={[tamQuanGate.width + 1.2, 0.24, tamQuanGate.depth + 0.6]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#475569" roughness={0.82} />
      </mesh>

      {/* 4 Trụ Cổng Lớn Chia 3 Lối Vào (Trung Quan - Tả Quan - Hữu Quan) */}
      {tamQuanGate.pillarXs.map((px, idx) => {
        const isCenterPillar = idx === 1 || idx === 2;
        const pillarHeight = isCenterPillar ? 6.4 : 5.0;
        return (
          <group key={idx} position={[px, 0, 0]}>
            {/* Chân tảng đá chạm cánh sen */}
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.2, 0.7, 1.2]} />
              <meshStandardMaterial map={carvedStoneTexture} color="#64748b" roughness={0.82} />
            </mesh>
            <mesh position={[0, 0.78, 0]} castShadow>
              <cylinderGeometry args={[0.52, 0.6, 0.24, 16]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.78} />
            </mesh>

            {/* Thân Cột Gỗ Lim Sơn Son Trầm Uy Nghiêm */}
            <mesh
              position={[0, 0.8 + pillarHeight / 2, 0]}
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[tamQuanGate.pillarRadius * 0.9, tamQuanGate.pillarRadius, pillarHeight, 20]}
              />
              <meshStandardMaterial
                map={lacquerTexture}
                color="#7f1d1d"
                roughness={0.55}
              />
            </mesh>

            {/* Đấu củng chạm thếp vàng trên đỉnh cột */}
            <mesh position={[0, 0.78 + pillarHeight, 0]} castShadow>
              <boxGeometry args={[1.0, 0.32, 1.0]} />
              <meshStandardMaterial
                color="#f59e0b"
                metalness={0.65}
                roughness={0.35}
              />
            </mesh>

            {/* Bảng câu đối đỏ sơn son thếp vàng dọc thân cột */}
            {[-0.52, 0.52].map((offZ, sIdx) => (
              <mesh key={sIdx} position={[0, 3.2, offZ]} castShadow>
                <boxGeometry args={[0.32, 3.4, 0.04]} />
                <meshStandardMaterial color="#991b1b" roughness={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Xà Ngang & Bảng Hoành Phi Cổng Chính "CHÙA THANH TỊNH" */}
      <group position={[0, 5.8, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[6.8, 1.0, 0.9]} />
          <meshStandardMaterial map={lacquerTexture} color="#450a0a" roughness={0.6} />
        </mesh>
        {/* Khung viền thếp vàng */}
        {[-0.47, 0.47].map((fz, fIdx) => (
          <mesh key={fIdx} position={[0, 0, fz]}>
            <boxGeometry args={[5.2, 0.72, 0.05]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}

        {/* Bảng tên "CHÙA THANH TỊNH" sắc nét bằng Html */}
        <Html
          position={[0, 0.02, 0.52]}
          center
          distanceFactor={14}
          zIndexRange={[10, 0]}
        >
          <div className="pointer-events-none select-none px-4 py-1.5 rounded-md border-2 border-amber-300 bg-red-950/95 shadow-2xl whitespace-nowrap">
            <span className="text-amber-300 font-bold tracking-[0.25em] text-xs sm:text-base drop-shadow">
              CHÙA THANH TỊNH
            </span>
          </div>
        </Html>
      </group>

      {/* Mái Ngói Cong Truyền Thống 3 Tầng Của Trung Quan */}
      <group position={[0, 6.8, 0]}>
        {/* Tầng 1: Mái Hạ */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[7.8, 0.45, 2.6]} />
          <meshStandardMaterial
            map={roofTileTexture}
            color="#991b1b"
            roughness={0.6}
          />
        </mesh>
        {/* Cổ lầu tầng 1 */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[5.8, 0.55, 1.6]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.65} />
        </mesh>

        {/* Tầng 2: Mái Trung */}
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[6.6, 0.42, 2.2]} />
          <meshStandardMaterial
            map={roofTileTexture}
            color="#b91c1c"
            roughness={0.58}
          />
        </mesh>
        {/* Cổ lầu tầng 2 */}
        <mesh position={[0, 1.6, 0]} castShadow>
          <boxGeometry args={[4.8, 0.5, 1.3]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.65} />
        </mesh>

        {/* Tầng 3: Mái Thượng Uốn Cong Đầu Đao */}
        <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.6, 0.4, 1.8]} />
          <meshStandardMaterial
            map={roofTileTexture}
            color="#dc2626"
            roughness={0.55}
          />
        </mesh>

        {/* Đầu đao cong vút 4 góc tầng thượng */}
        {[-2.9, 2.9].map((dx, i) => (
          <mesh
            key={i}
            position={[dx, 2.35, 0]}
            rotation={[0, 0, dx > 0 ? 0.52 : -0.52]}
            castShadow
          >
            <coneGeometry args={[0.32, 0.85, 4]} />
            <meshStandardMaterial color="#ef4444" roughness={0.5} />
          </mesh>
        ))}

        {/* Bánh xe Pháp Luân Vàng Trên Đỉnh Mái Tam Quan */}
        <mesh position={[0, 2.7, 0]} castShadow>
          <torusGeometry args={[0.35, 0.08, 12, 24]} />
          <meshStandardMaterial
            color="#fbbf24"
            metalness={0.8}
            roughness={0.2}
            emissive="#d97706"
            emissiveIntensity={0.35}
          />
        </mesh>
      </group>

      {/* Hai Mái Cổng Phụ Hai Bên (Tả Quan & Hữu Quan) */}
      {[-5.25, 5.25].map((sideX, idx) => (
        <group key={idx} position={[sideX, 5.3, 0]}>
          <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.8, 0.5, 0.65]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.65} />
          </mesh>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5.2, 0.4, 2.0]} />
            <meshStandardMaterial
              map={roofTileTexture}
              color="#991b1b"
              roughness={0.6}
            />
          </mesh>
          {/* Đầu đao cổng phụ */}
          <mesh
            position={[sideX < 0 ? -2.7 : 2.7, 0.26, 0]}
            rotation={[0, 0, sideX < 0 ? -0.48 : 0.48]}
            castShadow
          >
            <coneGeometry args={[0.3, 0.8, 4]} />
            <meshStandardMaterial color="#b91c1c" roughness={0.52} />
          </mesh>
        </group>
      ))}

      {/* Đèn Lồng Đỏ Treo Dưới Mái Tam Quan Đung Đưa */}
      <group ref={lanternsGroupRef} userData={{ cameraIgnore: true }} position={[0, 5.2, 0]}>
        {[-5.25, -2.1, 2.1, 5.25].map((lx, idx) => (
          <group key={idx} position={[lx, -0.4, 0]}>
            <mesh scale={[1, 1.15, 1]}>
              <sphereGeometry args={[0.28, 16, 16]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#dc2626"
                emissiveIntensity={isEveningOrNight ? 1.6 : 0.7}
                roughness={0.35}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Ánh Sáng Ấm Áp Dưới Cổng Tam Quan */}
      <BudgetPointLight
        position={[0, 4.8, 0]}
        color="#fb923c"
        intensity={isEveningOrNight ? 2.2 : 0.8}
        distance={14}
      />
    </group>
  );
};

/**
 * ============================================================================
 * 7. HỒ SEN TỊNH TÂM SÂN CHÙA THEO LAYOUT
 * ============================================================================
 */
const CourtyardLotusPondBasin: React.FC<{
  position: [number, number, number];
  outerRadius: number;
  innerRadius: number;
  isEveningOrNight: boolean;
}> = ({ position, outerRadius, innerRadius, isEveningOrNight }) => {
  return (
    <group position={position}>
      <PondBasin outerRadius={outerRadius} innerRadius={innerRadius} rimY={0.5} bottomY={0.08} color="#64756c" />

      {/* Mặt nước xanh biếc phản chiếu */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.38, 0]} receiveShadow>
        <circleGeometry args={[innerRadius - 0.03, 32]} />
        <meshStandardMaterial
          color={isEveningOrNight ? '#235e56' : '#5d9681'}
          metalness={0.45}
          roughness={0.16}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          opacity={0.88}
        />
      </mesh>

      {/* Đèn hoa đăng nổi giữa hồ ban đêm */}
      <group position={[0.4, 0.42, 0.2]}>
        <mesh>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshStandardMaterial
            color="#fef08a"
            emissive="#f59e0b"
            emissiveIntensity={isEveningOrNight ? 1.8 : 0.5}
          />
        </mesh>
        {isEveningOrNight && (
          <BudgetPointLight color="#fde047" intensity={0.9} distance={7} />
        )}
      </group>
    </group>
  );
};

/**
 * ============================================================================
 * 8. CỘI BỒ ĐỀ CỔ THỤ (x: 0, z: 10, planterRadius: 2.6)
 * ============================================================================
 */
const BodhiTreeSanctuary: React.FC<{
  isEveningOrNight: boolean;
  recentWishes?: IncenseWish[];
  isActive: boolean;
}> = ({ isEveningOrNight, recentWishes = [], isActive }) => {
  const ribbonsRef = useRef<THREE.Group>(null);
  const firefliesRef = useRef<THREE.Group>(null);
  const { bodhiTree } = TEMPLE_LANDMARKS;

  const ribbonCoords: [number, number, number][] = useMemo(
    () => [
      [-1.7, 2.75, 0.9],
      [1.75, 2.8, 0.85],
      [-1.1, 2.9, -1.5],
      [1.3, 2.68, -1.35],
      [0, 2.85, 1.85],
      [-1.85, 2.7, -0.45],
      [1.8, 2.72, -0.3],
      [0.55, 2.95, 1.5],
      [-0.65, 2.8, 1.55],
      [0, 2.75, -1.85],
    ],
    []
  );

  const fireflySeeds = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        radius: 1.6 + (i % 4) * 0.55,
        baseY: 1.8 + (i % 5) * 0.65,
        speed: 0.6 + (i % 3) * 0.25,
      })),
    []
  );

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ribbonsRef.current) {
      ribbonsRef.current.rotation.y = Math.sin(t * 0.9) * 0.06;
      ribbonsRef.current.children.forEach((child, idx) => {
        child.rotation.z = Math.sin(t * 1.8 + idx) * 0.12;
      });
    }
    if (firefliesRef.current) {
      firefliesRef.current.children.forEach((orb, idx) => {
        const seed = fireflySeeds[idx];
        if (!seed) return;
        const a = seed.angle + t * seed.speed * 0.4;
        orb.position.set(
          Math.cos(a) * seed.radius,
          seed.baseY + Math.sin(t * 1.5 + idx) * 0.28,
          Math.sin(a) * seed.radius
        );
      });
    }
  });

  const latestWish = recentWishes[0];

  return (
    <group position={[bodhiTree.x, 0, bodhiTree.z]} name="bodhi-tree-sanctuary">
      {/* Bồn đá bát giác chạm khắc quanh gốc Bồ Đề */}
      <BodhiTreePlanter radius={bodhiTree.planterRadius} />

      {/* Rễ và gốc cây Bồ Đề cổ thụ vững chãi */}
      {[0, 1, 2, 3, 4].map((rIdx) => {
        const angle = (rIdx / 5) * Math.PI * 2;
        return (
          <mesh
            key={rIdx}
            position={[Math.cos(angle) * 0.7, 0.9, Math.sin(angle) * 0.7]}
            rotation={[Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35]}
            castShadow
          >
            <cylinderGeometry args={[0.18, 0.35, 1.1, 10]} />
            <meshStandardMaterial color="#5c4033" roughness={0.9} />
          </mesh>
        );
      })}

      {/* Thân cây cổ thụ chính */}
      <mesh position={[0, 2.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 1.05, 3.4, 16]} />
        <meshStandardMaterial color="#5c4033" roughness={0.88} />
      </mesh>

      {/* Cành cây vươn rộng */}
      {[
        [-0.9, 3.3, 0.4, 0.45],
        [0.95, 3.35, -0.3, -0.45],
        [0.2, 3.4, 0.9, 0.4],
      ].map(([bx, by, bz, rotZ], idx) => (
        <mesh
          key={idx}
          position={[bx, by, bz]}
          rotation={[0.2, 0, rotZ]}
          castShadow
        >
          <cylinderGeometry args={[0.18, 0.3, 1.6, 10]} />
          <meshStandardMaterial color="#5c4033" roughness={0.88} />
        </mesh>
      ))}

      {/* Tán lá Bồ Đề xanh vàng nhiều tầng */}
      <group position={[0, 4.35, 0]}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <sphereGeometry args={[2.8, 20, 20]} />
          <meshStandardMaterial color="#15803d" roughness={0.76} />
        </mesh>
        <mesh position={[-1.6, -0.25, 0.9]} castShadow>
          <sphereGeometry args={[1.85, 16, 16]} />
          <meshStandardMaterial color="#166534" roughness={0.8} />
        </mesh>
        <mesh position={[1.65, -0.2, 0.75]} castShadow>
          <sphereGeometry args={[1.9, 16, 16]} />
          <meshStandardMaterial color="#14532d" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.05, -1.6]} castShadow>
          <sphereGeometry args={[1.95, 16, 16]} />
          <meshStandardMaterial color="#16a34a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.85, 0]} castShadow>
          <sphereGeometry args={[1.65, 16, 16]} />
          <meshStandardMaterial
            color="#ca8a04"
            emissive="#a16207"
            emissiveIntensity={0.2}
            roughness={0.68}
          />
        </mesh>
      </group>

      {/* Dải lụa / Thẻ ước nguyện đỏ treo đung đưa dưới tán cây */}
      <group ref={ribbonsRef} userData={{ cameraIgnore: true }}>
        {ribbonCoords.map(([rx, ry, rz], idx) => (
          <group key={idx} position={[rx, ry, rz]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.35, 6]} />
              <meshStandardMaterial color="#fbbf24" />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[0.14, 0.68, 0.03]} />
              <meshStandardMaterial
                color="#ef4444"
                emissive="#b91c1c"
                emissiveIntensity={0.48}
              />
            </mesh>
            <mesh position={[0, -0.22, 0.02]}>
              <boxGeometry args={[0.09, 0.14, 0.01]} />
              <meshStandardMaterial color="#fde047" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Các hạt đom đóm / hoa nắng tâm linh bay quanh gốc Bồ Đề */}
      <group ref={firefliesRef} userData={{ cameraIgnore: true }}>
        {fireflySeeds.map((_, idx) => (
          <mesh key={idx}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshBasicMaterial
              color={isEveningOrNight ? '#fde047' : '#fef08a'}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>

      {/* Hiển thị thẻ ước nguyện gần nhất dưới tán cây */}
      {latestWish && isActive && (
        <Html position={[0, 2.2, 1.9]} center distanceFactor={14} zIndexRange={[10, 0]}>
          <div className="pointer-events-none select-none max-w-[220px] px-3 py-1.5 rounded-xl bg-red-950/90 border border-amber-400/60 text-amber-100 text-[11px] shadow-xl text-center">
            <span className="text-amber-300 font-semibold block truncate">
              🪷 {latestWish.monkName}
            </span>
            <span className="italic line-clamp-2 opacity-90">
              “{latestWish.wishText}”
            </span>
          </div>
        </Html>
      )}

      <BudgetPointLight
        position={[0, 3.1, 0]}
        color={isEveningOrNight ? '#fbbf24' : '#34d399'}
        intensity={isEveningOrNight ? 1.45 : 0.75}
        distance={12}
      />
    </group>
  );
};

/**
 * ============================================================================
 * 9. LẦU CHUÔNG ĐẠI HỒNG CHUNG (x: 12, z: 3, size: 4.6m)
 * ============================================================================
 */
const TempleBellPavilion: React.FC<{
  isEveningOrNight: boolean;
  bellStrikePulse?: number;
}> = ({ isEveningOrNight, bellStrikePulse = 0 }) => {
  const bellSwingRef = useRef<THREE.Group>(null);
  const strikerRef = useRef<THREE.Mesh>(null);
  const waveRing1Ref = useRef<THREE.Mesh>(null);
  const waveRing2Ref = useRef<THREE.Mesh>(null);
  const strikeStartRef = useRef<number>(-999);
  const prevPulseRef = useRef<number>(bellStrikePulse);

  const { bellTower } = TEMPLE_LANDMARKS;
  const lacquerTexture = useMemo(() => getLacquerWoodTexture(4, 8), []);
  const roofTileTexture = useMemo(() => getRoofTileTexture(8, 6), []);
  const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(4, 4), []);

  useEffect(() => {
    if (bellStrikePulse !== prevPulseRef.current && bellStrikePulse > 0) {
      prevPulseRef.current = bellStrikePulse;
      strikeStartRef.current = performance.now() / 1000;
    }
  }, [bellStrikePulse]);

  useFrame(({ clock }) => {
    const nowSec = performance.now() / 1000;
    const elapsed = nowSec - strikeStartRef.current;
    const isRinging = elapsed >= 0 && elapsed < 3.2;

    if (bellSwingRef.current) {
      if (isRinging) {
        const decay = Math.exp(-elapsed * 1.4);
        bellSwingRef.current.rotation.z = Math.sin(elapsed * 9.5) * 0.16 * decay;
      } else {
        bellSwingRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.8) * 0.01;
      }
    }

    if (strikerRef.current) {
      if (isRinging && elapsed < 0.8) {
        strikerRef.current.position.x = 1.05 - Math.sin(elapsed * Math.PI * 2.5) * 0.28;
      } else {
        strikerRef.current.position.x = 1.05;
      }
    }

    if (waveRing1Ref.current) {
      const mat = waveRing1Ref.current.material as THREE.MeshBasicMaterial;
      if (isRinging) {
        const progress = (elapsed % 1.6) / 1.6;
        const scale = 1 + progress * 4.8;
        waveRing1Ref.current.scale.set(scale, scale, 1);
        mat.opacity = Math.max(0, (1 - progress) * 0.85);
        waveRing1Ref.current.visible = true;
      } else {
        waveRing1Ref.current.visible = false;
      }
    }

    if (waveRing2Ref.current) {
      const mat = waveRing2Ref.current.material as THREE.MeshBasicMaterial;
      if (isRinging && elapsed > 0.35) {
        const progress = ((elapsed - 0.35) % 1.6) / 1.6;
        const scale = 1 + progress * 4.8;
        waveRing2Ref.current.scale.set(scale, scale, 1);
        mat.opacity = Math.max(0, (1 - progress) * 0.7);
        waveRing2Ref.current.visible = true;
      } else {
        waveRing2Ref.current.visible = false;
      }
    }
  });

  return (
    <group position={[bellTower.x, 0, bellTower.z]} name="temple-bell-pavilion">
      {/* Nền đá Gác Chuông 2 bậc */}
      <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
        <boxGeometry args={[bellTower.size + 0.8, 0.44, bellTower.size + 0.8]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#475569" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.48, 0]} receiveShadow castShadow>
        <boxGeometry args={[bellTower.size + 0.2, 0.12, bellTower.size + 0.2]} />
        <meshStandardMaterial map={carvedStoneTexture} color="#64748b" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.56, 0]} receiveShadow>
        <boxGeometry args={[bellTower.size - 0.2, 0.06, bellTower.size - 0.2]} />
        <meshStandardMaterial map={lacquerTexture} color="#78350f" roughness={0.7} />
      </mesh>

      {/* 4 cột gỗ lim */}
      {[
        [-1.75, -1.75],
        [1.75, -1.75],
        [-1.75, 1.75],
        [1.75, 1.75],
      ].map(([cx, cz], idx) => (
        <group key={idx} position={[cx, 0.54, cz]}>
          <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.34, 0.42, 0.32, 16]} />
            <meshStandardMaterial color="#475569" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.24, 0.28, 4.4, 16]} />
            <meshStandardMaterial map={lacquerTexture} color="#7f1d1d" roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Xà ngang treo chuông */}
      <mesh position={[0, 5.0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 3.8, 12]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Mái gác chuông chồng diêm cong 2 tầng */}
      <mesh
        position={[0, 5.35, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[3.6, 1.45, 4]} />
        <meshStandardMaterial map={roofTileTexture} color="#991b1b" roughness={0.65} />
      </mesh>
      <mesh position={[0, 6.2, 0]} castShadow>
        <boxGeometry args={[2.2, 0.65, 2.2]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
      </mesh>
      <mesh
        position={[0, 6.95, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[2.7, 1.25, 4]} />
        <meshStandardMaterial map={roofTileTexture} color="#dc2626" roughness={0.65} />
      </mesh>

      {/* Quả Đại Hồng Chung bằng đồng treo ở tâm */}
      <group ref={bellSwingRef} userData={{ cameraIgnore: true }} position={[0, 4.9, 0]}>
        <mesh position={[0, -0.4, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.2, 0.55, 12]} />
          <meshStandardMaterial color="#ca8a04" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, -1.25, 0]} castShadow>
          <cylinderGeometry args={[0.52, 0.85, 1.55, 24]} />
          <meshStandardMaterial
            color="#eab308"
            metalness={0.75}
            roughness={0.25}
            emissive="#a16207"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[0, -2.0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.82, 0.07, 12, 24]} />
          <meshStandardMaterial color="#facc15" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>

      {/* Chày gỗ thỉnh chuông */}
      <mesh
        ref={strikerRef} userData={{ cameraIgnore: true }}
        position={[1.05, 3.4, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.1, 0.1, 1.15, 12]} />
        <meshStandardMaterial color="#92400e" roughness={0.68} />
      </mesh>

      {/* Vòng sóng âm vàng lan tỏa khi thỉnh chuông */}
      <mesh
        ref={waveRing1Ref}
        position={[0, 3.4, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.8, 1.0, 36]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        ref={waveRing2Ref}
        position={[0, 2.2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.85, 1.05, 36]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      <BudgetPointLight
        position={[0, 4.0, 0]}
        color="#facc15"
        intensity={isEveningOrNight ? 1.6 : 0.75}
        distance={10}
      />
    </group>
  );
};

/**
 * ============================================================================
 * 10. BÀN MÕ TỤNG KINH (x: -6, z: -1, width: 2, depth: 1.2)
 * ============================================================================
 */
const WoodenFishStation: React.FC<{
  woodenFishPulse?: number;
}> = ({ woodenFishPulse = 0 }) => {
  const woodenFishMeshRef = useRef<THREE.Group>(null);
  const auraRingRef = useRef<THREE.Mesh>(null);
  const pulseStartRef = useRef<number>(-999);
  const prevPulseRef = useRef<number>(woodenFishPulse);

  const { woodenFishStation } = TEMPLE_LANDMARKS;

  useEffect(() => {
    if (woodenFishPulse !== prevPulseRef.current && woodenFishPulse > 0) {
      prevPulseRef.current = woodenFishPulse;
      pulseStartRef.current = performance.now() / 1000;
    }
  }, [woodenFishPulse]);

  useFrame(() => {
    const nowSec = performance.now() / 1000;
    const elapsed = nowSec - pulseStartRef.current;
    const isPulsing = elapsed >= 0 && elapsed < 0.75;

    if (woodenFishMeshRef.current) {
      if (isPulsing) {
        const bounce = Math.sin((elapsed / 0.75) * Math.PI * 2) * Math.exp(-elapsed * 3.5);
        const s = 1 + Math.max(0, bounce) * 0.24;
        woodenFishMeshRef.current.scale.set(s * 1.2, s * 0.95, s);
        woodenFishMeshRef.current.position.y = 1.25 + Math.max(0, bounce) * 0.1;
      } else {
        woodenFishMeshRef.current.scale.set(1.2, 0.95, 1);
        woodenFishMeshRef.current.position.y = 1.25;
      }
    }

    if (auraRingRef.current) {
      const mat = auraRingRef.current.material as THREE.MeshBasicMaterial;
      if (isPulsing) {
        const progress = elapsed / 0.75;
        const scale = 1 + progress * 3.2;
        auraRingRef.current.scale.set(scale, scale, 1);
        mat.opacity = Math.max(0, (1 - progress) * 0.9);
        auraRingRef.current.visible = true;
      } else {
        auraRingRef.current.visible = false;
      }
    }
  });

  return (
    <group position={[woodenFishStation.x, 0, woodenFishStation.z]} name="wooden-fish-station">
      {/* Chiếu cói thiền định */}
      <mesh position={[0, 0.02, 0.95]} receiveShadow>
        <boxGeometry args={[2.0, 0.04, 1.6]} />
        <meshStandardMaterial color="#d97706" roughness={0.88} />
      </mesh>
      {/* Bồ đoàn ngồi tụng kinh */}
      <mesh position={[0, 0.11, 1.1]} castShadow receiveShadow>
        <cylinderGeometry args={[0.46, 0.52, 0.16, 20]} />
        <meshStandardMaterial color="#991b1b" roughness={0.78} />
      </mesh>

      {/* Bàn sơn son thếp vàng */}
      <mesh position={[0, 0.46, 0]} castShadow receiveShadow>
        <boxGeometry args={[woodenFishStation.width - 0.2, 0.9, woodenFishStation.depth - 0.15]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.94, 0]} castShadow receiveShadow>
        <boxGeometry args={[woodenFishStation.width, 0.1, woodenFishStation.depth]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.38} roughness={0.38} />
      </mesh>

      {/* Cuốn Kinh Phật mở sẵn bên trái bàn */}
      <group position={[-0.48, 1.02, 0.05]} rotation={[0, 0.12, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.52, 0.05, 0.38]} />
          <meshStandardMaterial color="#fef3c7" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.03, 0.02, 0.38]} />
          <meshStandardMaterial color="#b45309" />
        </mesh>
      </group>

      {/* Đệm gấm đặt mõ bên phải bàn */}
      <mesh position={[0.25, 1.03, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.1, 16]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.7} />
      </mesh>

      {/* Chiếc Mõ Gỗ Đỏ */}
      <group ref={woodenFishMeshRef} userData={{ cameraIgnore: true }} position={[0.25, 1.25, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial
            color="#dc2626"
            roughness={0.32}
            metalness={0.15}
            emissive="#991b1b"
            emissiveIntensity={0.2}
          />
        </mesh>
        <mesh position={[0, -0.02, 0.22]}>
          <boxGeometry args={[0.32, 0.05, 0.08]} />
          <meshStandardMaterial color="#450a0a" />
        </mesh>
      </group>

      {/* Dùi gõ mõ */}
      <mesh
        position={[0.65, 1.12, 0.14]}
        rotation={[0.2, 0.4, Math.PI / 2.4]}
        castShadow
      >
        <cylinderGeometry args={[0.035, 0.025, 0.48, 10]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Vòng sáng tâm linh lan tỏa khi gõ mõ */}
      <mesh
        ref={auraRingRef}
        position={[0.25, 1.22, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <ringGeometry args={[0.32, 0.45, 32]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

/**
 * ============================================================================
 * 11. QUẦY XIN XĂM ĐẦU NĂM (x: -9, z: 14, width: 3.4, depth: 2.2)
 * ============================================================================
 */
const FortuneStallStation: React.FC<{ isEveningOrNight: boolean }> = ({
  isEveningOrNight,
}) => {
  const { fortuneStall } = TEMPLE_LANDMARKS;

  return (
    <group position={[fortuneStall.x, 0, fortuneStall.z]} name="fortune-stall-station">
      {/* Chiếu đỏ trước quầy xin xăm */}
      <mesh position={[0, 0.02, 1.3]} receiveShadow>
        <boxGeometry args={[fortuneStall.width * 0.85, 0.04, 1.5]} />
        <meshStandardMaterial color="#991b1b" roughness={0.85} />
      </mesh>

      {/* 4 cột tre/gỗ dựng gian hàng */}
      {[
        [-fortuneStall.width * 0.42, -fortuneStall.depth * 0.4],
        [fortuneStall.width * 0.42, -fortuneStall.depth * 0.4],
        [-fortuneStall.width * 0.42, fortuneStall.depth * 0.4],
        [fortuneStall.width * 0.42, fortuneStall.depth * 0.4],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, 1.45, pz]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.09, 2.9, 12]} />
          <meshStandardMaterial color="#78350f" roughness={0.75} />
        </mesh>
      ))}

      {/* Mái che gian hàng xin xăm */}
      <mesh position={[0, 3.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[fortuneStall.width + 0.4, 0.28, fortuneStall.depth + 0.3]} />
        <meshStandardMaterial color="#991b1b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 3.3, 0]} castShadow>
        <boxGeometry args={[fortuneStall.width - 0.6, 0.25, fortuneStall.depth - 0.5]} />
        <meshStandardMaterial color="#b45309" roughness={0.55} />
      </mesh>

      {/* Bàn gỗ trải khăn đỏ */}
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <boxGeometry args={[fortuneStall.width - 0.8, 0.96, fortuneStall.depth - 0.9]} />
        <meshStandardMaterial color="#78350f" roughness={0.65} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[fortuneStall.width - 0.6, 0.12, fortuneStall.depth - 0.7]} />
        <meshStandardMaterial color="#dc2626" roughness={0.5} />
      </mesh>

      {/* Ống xăm tre đựng thẻ xăm ở giữa bàn */}
      <group position={[0, 1.32, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.18, 0.52, 16]} />
          <meshStandardMaterial color="#d97706" roughness={0.62} />
        </mesh>
        {[-0.08, -0.03, 0.02, 0.07, 0.04, -0.05].map((ox, i) => (
          <mesh
            key={i}
            position={[ox, 0.28, ((i % 3) - 1) * 0.04]}
            rotation={[0.08 * (i - 2), 0, (i - 2.5) * 0.07]}
            castShadow
          >
            <boxGeometry args={[0.03, 0.36, 0.015]} />
            <meshStandardMaterial color="#fef08a" />
          </mesh>
        ))}
      </group>

      {/* Khay đựng giấy giải quẻ xăm hồng phát lộc */}
      <mesh position={[-0.75, 1.09, 0.1]} castShadow>
        <boxGeometry args={[0.48, 0.06, 0.36]} />
        <meshStandardMaterial color="#f472b6" roughness={0.7} />
      </mesh>

      {/* 2 Đèn lồng đỏ treo hai bên hiên quầy xăm */}
      {[-fortuneStall.width * 0.4, fortuneStall.width * 0.4].map((lx, idx) => (
        <group key={idx} position={[lx, 2.55, 0.9]}>
          <mesh>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#dc2626"
              emissiveIntensity={isEveningOrNight ? 1.4 : 0.7}
            />
          </mesh>
        </group>
      ))}

      <BudgetPointLight
        position={[0, 2.4, 0.4]}
        color="#f87171"
        intensity={isEveningOrNight ? 1.25 : 0.6}
        distance={8}
      />
    </group>
  );
};

/**
 * ============================================================================
 * 12. TƯỜNG BAO QUANH CHÙA (TEMPLE_LANDMARKS.perimeterWalls)
 * frontZ: 24, gateGapHalfWidth: 9, sideX: 46, backZ: -40, height: 2.6m
 * ============================================================================
 */
const PerimeterWalls: React.FC = () => {
  const { perimeterWalls } = TEMPLE_LANDMARKS;
  const { frontZ, gateGapHalfWidth, sideX, backZ, thickness, height } = perimeterWalls;

  const frontWallLength = sideX - gateGapHalfWidth; // 46 - 9 = 37m
  const frontWallCenterX = (gateGapHalfWidth + sideX) / 2; // 27.5m

  const sideWallLength = frontZ - backZ; // 24 - (-40) = 64m
  const sideWallCenterZ = (frontZ + backZ) / 2; // -8m

  const backWallLength = sideX * 2; // 92m

  return (
    <group name="perimeter-walls">
      {/* 1. Tường Mặt Tiền (Front Wall) - Đoạn Tả & Đoạn Hữu */}
      {[-frontWallCenterX, frontWallCenterX].map((fx, idx) => (
        <group key={idx} position={[fx, 0, frontZ]}>
          <mesh position={[0, height / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[frontWallLength, height, thickness]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
          </mesh>
          {/* Mái ngói đỏ trên đỉnh tường */}
          <mesh position={[0, height + 0.14, 0]} castShadow>
            <boxGeometry args={[frontWallLength + 0.3, 0.28, thickness + 0.3]} />
            <meshStandardMaterial color="#991b1b" roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* 2. Tường Bao Tả Hữu (Side Walls tại x = -46 và x = 46) */}
      {[-sideX, sideX].map((sx, idx) => (
        <group key={idx} position={[sx, 0, sideWallCenterZ]}>
          <mesh position={[0, height / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[thickness, height, sideWallLength]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
          </mesh>
          <mesh position={[0, height + 0.14, 0]} castShadow>
            <boxGeometry args={[thickness + 0.3, 0.28, sideWallLength + 0.3]} />
            <meshStandardMaterial color="#991b1b" roughness={0.65} />
          </mesh>
        </group>
      ))}

      {/* 3. Tường Hậu Phía Sau (Back Wall tại z = -40) */}
      <group position={[0, 0, backZ]}>
        <mesh position={[0, height / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[backWallLength, height, thickness]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
        </mesh>
        <mesh position={[0, height + 0.14, 0]} castShadow>
          <boxGeometry args={[backWallLength + 0.3, 0.28, thickness + 0.3]} />
          <meshStandardMaterial color="#991b1b" roughness={0.65} />
        </mesh>
      </group>
    </group>
  );
};

/**
 * ============================================================================
 * EXPORT CHÍNH: TEMPLE COURTYARD (SÂN CHÙA THANH TỊNH)
 * Tích hợp Quần Thể Mở Rộng TempleOuterComplex & InstancedMesh Đỉnh Cao
 * ============================================================================
 */
export const TempleCourtyard: React.FC<TempleCourtyardProps> = React.memo(
  ({
    timeOfDay,
    activeZoneId = null,
    bellStrikePulse = 0,
    woodenFishPulse = 0,
    recentWishes = [],
  }) => {
    const isEveningOrNight = timeOfDay === 'sunset' || timeOfDay === 'night';

    return (
      <group name="temple-courtyard-world" userData={{ cameraStatic: true }}>
        {/* 1. Mặt Sân Tổng Thể 220m x 220m, Đường Thần Đạo Đá Xanh & Trụ Đèn Đá InstancedMesh */}
        <CourtyardGroundAndPath isEveningOrNight={isEveningOrNight} />

        {/* 2. Cổng Tam Quan 3 Tầng Mái Cong (x: 0, z: 24, width: 18m) */}
        <TamQuanGate isEveningOrNight={isEveningOrNight} />

        {/* 3. Hồ Sen Sân Chùa Còn Lại Theo Layout */}
        {COURTYARD_LOTUS_PONDS.map(({ id, x, z, outerRadius, innerRadius }) => (
          <CourtyardLotusPondBasin
            key={id}
            position={[x, 0, z]}
            outerRadius={outerRadius}
            innerRadius={innerRadius}
            isEveningOrNight={isEveningOrNight}
          />
        ))}

        {/* 4. Hệ Thống Lá Sen & Hoa Sen InstancedMesh Khắp Các Hồ Nước */}
        <InstancedLotusSystem isEveningOrNight={isEveningOrNight} />

        {/* 5. Cội Bồ Đề Cổ Thụ & Thẻ Ước Nguyện (x: 0, z: 10) */}
        <BodhiTreeSanctuary
          isEveningOrNight={isEveningOrNight}
          recentWishes={recentWishes}
          isActive={activeZoneId === 'bodhi_tree'}
        />

        {/* 6. Lầu Chuông Đại Hồng Chung (x: 12, z: 3, size: 4.6m) */}
        <TempleBellPavilion
          isEveningOrNight={isEveningOrNight}
          bellStrikePulse={bellStrikePulse}
        />

        {/* 7. Bàn Mõ Tụng Kinh (x: -6, z: -1) */}
        <WoodenFishStation woodenFishPulse={woodenFishPulse} />

        {/* 8. Quầy Xin Xăm Đầu Năm (x: -9, z: 14) */}
        <FortuneStallStation isEveningOrNight={isEveningOrNight} />

        {/* 9. Tường Bao Quanh Chùa (Rộng 92m x Dài 64m) */}
        <PerimeterWalls />

        {/* 10. Rừng Trúc Hậu Viện & Dọc Tường Bao (InstancedMesh) */}
        <InstancedBambooForest />

        {/* 11. Tùng La Hán Cổ Thụ Ngoại Vi */}
        <AncientPines />

        {/* 12. Quần Thể Kiến Trúc Mở Rộng: Cầu Bán Nguyệt, Đài Quan Âm, Cầu Cửu Khúc, Bảo Tháp 7 Tầng, Lầu Trống, Hành Lang Tả/Hữu Vu, Vườn Thiền & Nhà Tổ */}
        <TempleOuterComplex timeOfDay={timeOfDay} />
      </group>
    );
  }
);

TempleCourtyard.displayName = 'TempleCourtyard';

export default TempleCourtyard;
