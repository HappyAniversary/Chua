import React, { Suspense, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SANCTUARY_FRONT_STEPS } from '../../constants/templeLayout';
import type { IncenseWish, TimeOfDay } from '../../types/game';
import {
  getCarvedStoneTexture,
  getLacquerWoodTexture,
  getTerracottaTileTexture,
  getSurfaceDetailMaps,
} from '../../utils/proceduralTextures';
import { CurvedPagodaRoofHighPoly } from './PagodaRoofPrimitives';
import { BudgetPointLight, useEnvironmentQuality } from './EnvironmentQuality';
import { IncenseSmokeParticles } from './IncenseSmokeParticles';
import { FigureModel } from './FigureModel';

export interface MainSanctuaryProps {
  timeOfDay: TimeOfDay;
  recentWishes?: IncenseWish[];
  incenseCount?: number;
}

/**
 * Bình hoa sen hồng đặt trên bàn thờ Chánh Điện
 */
const LotusAltarVase: React.FC<{ position: [number, number, number] }> = ({
  position,
}) => {
  const petalAngles = useMemo(
    () => Array.from({ length: 6 }, (_, idx) => (idx * Math.PI * 2) / 6),
    []
  );

  return (
    <group position={position}>
      {/* Đế bình gốm sứ */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.16, 16]} />
        <meshStandardMaterial
          color="#fef3c7"
          roughness={0.3}
          metalness={0.15}
        />
      </mesh>
      {/* Bụng bình */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#fde68a" roughness={0.25} metalness={0.2} />
      </mesh>
      {/* Cổ bình */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.09, 0.24, 16]} />
        <meshStandardMaterial
          color="#f59e0b"
          roughness={0.28}
          metalness={0.45}
        />
      </mesh>

      {/* Cành sen xanh */}
      {[
        [-0.06, 0.72, 0.02, 0.15],
        [0, 0.8, -0.02, 0],
        [0.07, 0.7, 0.03, -0.16],
      ].map(([x, y, z, tilt], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, tilt]}>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.015, 0.018, 0.32, 8]} />
            <meshStandardMaterial color="#15803d" roughness={0.7} />
          </mesh>
          {/* Đài hoa sen hồng */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <coneGeometry args={[0.09, 0.16, 8]} />
            <meshStandardMaterial
              color="#f472b6"
              emissive="#db2777"
              emissiveIntensity={0.18}
              roughness={0.4}
            />
          </mesh>
          {petalAngles.map((a, pIdx) => (
            <mesh
              key={pIdx}
              position={[Math.cos(a) * 0.055, 0.03, Math.sin(a) * 0.055]}
              rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}
            >
              <coneGeometry args={[0.04, 0.12, 6]} />
              <meshStandardMaterial
                color="#f9a8d4"
                emissive="#ec4899"
                emissiveIntensity={0.12}
                roughness={0.45}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

export const MainSanctuary = React.memo<MainSanctuaryProps>(
  ({ timeOfDay, recentWishes = [], incenseCount = 9 }) => {
    const { quality } = useEnvironmentQuality();
    const floorDetails = useMemo(() => getSurfaceDetailMaps('terracotta', 12, 10), []);
    const stoneDetails = useMemo(() => getSurfaceDetailMaps('stone', 4, 6), []);
    const useSurfaceDetail = quality !== 'low';
    const haloGroupRef = useRef<THREE.Group>(null);
    const candleLeftRef = useRef<THREE.Mesh>(null);
    const candleRightRef = useRef<THREE.Mesh>(null);

    const isNightOrSunset = timeOfDay === 'night' || timeOfDay === 'sunset';

    // Singleton Textures từ bộ tạo Texture Procedural PBR
    const terracottaTileTexture = useMemo(
      () => getTerracottaTileTexture(12, 10),
      []
    );
    const carvedStoneTexture = useMemo(() => getCarvedStoneTexture(4, 6), []);
    const lacquerWoodTexture = useMemo(() => getLacquerWoodTexture(2, 6), []);

    // Tổng số nén nhang hiển thị trong lư hương
    const totalIncenseSticks = useMemo(() => {
      const wishBonus = Math.min(6, recentWishes.length);
      return Math.max(3, Math.min(18, incenseCount + wishBonus));
    }, [incenseCount, recentWishes.length]);

    // Vị trí & góc nghiêng cho từng nén nhang trong đỉnh đồng
    const incenseSticks = useMemo(() => {
      return Array.from({ length: totalIncenseSticks }, (_, idx) => {
        const ring = idx === 0 ? 0 : idx < 7 ? 1 : 2;
        const angle =
          ring === 0
            ? 0
            : ring === 1
            ? ((idx - 1) / 6) * Math.PI * 2
            : ((idx - 7) / Math.max(1, totalIncenseSticks - 7)) * Math.PI * 2;
        const radius = ring === 0 ? 0 : ring === 1 ? 0.13 : 0.24;
        const tilt = ring === 0 ? 0 : ring === 1 ? 0.11 : 0.18;

        return {
          id: idx,
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
          rotX: Math.sin(angle) * tilt,
          rotZ: -Math.cos(angle) * tilt,
        };
      });
    }, [totalIncenseSticks]);

    // Các tia sáng quanh Vòng Hào Quang Phật (24 tia sáng đan xen lớn nhỏ)
    const haloRays = useMemo(() => {
      return Array.from({ length: 24 }, (_, idx) => {
        const angle = (idx * Math.PI * 2) / 24;
        const isMajor = idx % 2 === 0;
        return {
          id: idx,
          angle,
          x: Math.cos(angle) * 1.48,
          y: Math.sin(angle) * 1.48,
          length: isMajor ? 0.72 : 0.44,
          radius: isMajor ? 0.065 : 0.04,
        };
      });
    }, []);

    useFrame(({ clock }, delta) => {
      const t = clock.getElapsedTime();

      // Xoay nhẹ Vòng Hào Quang Phật phía sau lưng uy nghiêm
      if (haloGroupRef.current) {
        haloGroupRef.current.rotation.z += delta * 0.18;
      }

      // Ngọn lửa đèn cầy lung linh sống động
      const flickerLeft =
        0.92 + Math.sin(t * 9.5) * 0.12 + Math.cos(t * 15) * 0.05;
      const flickerRight =
        0.92 + Math.cos(t * 8.7 + 1.2) * 0.12 + Math.sin(t * 14) * 0.05;

      if (candleLeftRef.current) {
        candleLeftRef.current.scale.set(
          flickerLeft,
          0.9 + Math.sin(t * 11) * 0.14,
          flickerLeft
        );
      }
      if (candleRightRef.current) {
        candleRightRef.current.scale.set(
          flickerRight,
          0.9 + Math.cos(t * 10.5) * 0.14,
          flickerRight
        );
      }
    });

    // Tọa độ các cột gỗ lim đỏ lớn viền vàng của Chánh Điện
    const frontPillarsX = [-5.8, -3.1, 3.1, 5.8];
    const sidePillarsZ = [-7.2, -9.8, -12.4];

    return (
      <group name="main-sanctuary" userData={{ cameraStatic: true }}>
        {/* =====================================================================
            1. NỀN ĐÁ & BẬC THỀM TAM CẤP + ĐÔI LAN CAN RỒNG ĐÁ (z: -5.2 -> -14.8)
           ===================================================================== */}
        <group name="sanctuary-foundation">
          {/* Nền đá xanh Thanh Hóa chạm khắc của Đại Hùng Bảo Điện */}
          <mesh position={[0, 0.55, -10.4]} receiveShadow castShadow>
            <boxGeometry args={[14.4, 1.1, 8.8]} />
            <meshStandardMaterial
              map={carvedStoneTexture}
              color="#52616b"
              roughness={0.78}
              metalness={0.08}
            />
          </mesh>

          {/* Đường viền đá chạm hoa văn quanh chân nền */}
          <mesh position={[0, 1.08, -10.4]} receiveShadow>
            <boxGeometry args={[14.6, 0.12, 9.0]} />
            <meshStandardMaterial
              map={carvedStoneTexture}
              color="#64748b"
              roughness={0.7}
              metalness={0.12}
            />
          </mesh>

          {/* Sàn gạch Tàu Bát Tràng cổ truyền bên trong lòng Chánh Điện */}
          <mesh position={[0, 1.12, -10.4]} receiveShadow>
            <boxGeometry args={[13.6, 0.06, 8.0]} />
            <meshStandardMaterial
              map={terracottaTileTexture}
              normalMap={useSurfaceDetail ? floorDetails.normalMap : null}
              normalScale={new THREE.Vector2(0.3, 0.3)}
              roughnessMap={useSurfaceDetail ? floorDetails.roughnessMap : null}
              roughness={0.9}
              metalness={0.08}
            />
          </mesh>

          {/* Chiếu cói / Thảm đỏ lễ bái chính giữa điện */}
          <mesh position={[0, 1.16, -8.3]} receiveShadow>
            <boxGeometry args={[3.6, 0.03, 3.2]} />
            <meshStandardMaterial color="#991b1b" roughness={0.75} />
          </mesh>

          {/* Bậc thềm Tam Cấp bằng đá xanh dẫn lên Chánh Điện (z từ -5.1 đến -6.0) */}
          {SANCTUARY_FRONT_STEPS.map((item) => (
            <mesh
              key={item.step}
              position={[0, item.y, item.z]}
              receiveShadow
              castShadow
            >
              <boxGeometry args={[item.width, 0.36, item.depth]} />
              <meshStandardMaterial
                map={carvedStoneTexture}
                color="#64748b"
                normalMap={useSurfaceDetail ? stoneDetails.normalMap : null}
                normalScale={new THREE.Vector2(0.25, 0.25)}
                roughnessMap={useSurfaceDetail ? stoneDetails.roughnessMap : null}
                roughness={0.95}
                metalness={0.1}
              />
            </mesh>
          ))}

          {/* Đôi lan can rồng đá hai bên bậc thềm Tam Cấp */}
          {[-2.85, 2.85].map((xPos, idx) => (
            <group key={idx} position={[xPos, 0, -5.45]}>
              {/* Thân lan can đá dốc theo bậc thềm */}
              <mesh
                position={[0, 0.72, -0.1]}
                rotation={[0.52, 0, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.38, 0.46, 1.85]} />
                <meshStandardMaterial
                  map={carvedStoneTexture}
                  color="#94a3b8"
                  roughness={0.68}
                />
              </mesh>
              {/* Sống lưng rồng uốn lượn bằng đá */}
              <mesh
                position={[0, 0.98, -0.1]}
                rotation={[0.52, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[0.11, 0.14, 1.75, 10]} />
                <meshStandardMaterial
                  color="#cbd5e1"
                  roughness={0.55}
                  metalness={0.15}
                />
              </mesh>
              {/* Trụ đá đầu rồng phía dưới bậc thềm */}
              <mesh position={[0, 0.55, 0.68]} castShadow>
                <boxGeometry args={[0.46, 1.1, 0.46]} />
                <meshStandardMaterial
                  map={carvedStoneTexture}
                  color="#64748b"
                  roughness={0.72}
                />
              </mesh>
              <mesh position={[0, 1.22, 0.68]} castShadow>
                <sphereGeometry args={[0.24, 14, 14]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  metalness={0.55}
                  roughness={0.32}
                />
              </mesh>
            </group>
          ))}
        </group>

        {/* =====================================================================
            2. KIẾN TRÚC CHÁNH ĐIỆN: CỘT GỖ LIM ĐỎ SON, HOÀNH PHI, MÁI ĐAO 3 TẦNG
           ===================================================================== */}
        <group name="sanctuary-architecture">
          {/* Tường hậu điện ấm cúng (phía Bắc z = -14.2) */}
          <mesh position={[0, 3.65, -14.2]} receiveShadow castShadow>
            <boxGeometry args={[13.2, 5.1, 0.45]} />
            <meshStandardMaterial
              color="#fef3c7"
              roughness={0.75}
              metalness={0.05}
            />
          </mesh>

          {/* Bức vách gỗ chạm khắc vàng son sau lưng Phật */}
          <mesh position={[0, 3.7, -13.9]} receiveShadow castShadow>
            <boxGeometry args={[6.8, 4.8, 0.18]} />
            <meshStandardMaterial
              map={lacquerWoodTexture}
              color="#7c2d12"
              roughness={0.48}
              metalness={0.16}
            />
          </mesh>
          <mesh position={[0, 3.7, -13.78]}>
            <boxGeometry args={[6.2, 4.3, 0.06]} />
            <meshStandardMaterial
              color="#b45309"
              metalness={0.45}
              roughness={0.35}
            />
          </mesh>

          {/* Tường hồi hai bên Đông - Tây của Chánh Điện */}
          {[-6.5, 6.5].map((xWall, idx) => (
            <group key={idx} position={[xWall, 3.65, -10.8]}>
              <mesh receiveShadow castShadow>
                <boxGeometry args={[0.42, 5.1, 7.2]} />
                <meshStandardMaterial color="#fde68a" roughness={0.78} />
              </mesh>
              {/* Khung cửa sổ chữ Thọ tròn hai bên tường hồi */}
              <mesh
                position={[xWall > 0 ? -0.24 : 0.24, 0.2, 0]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <ringGeometry args={[0.68, 0.88, 24]} />
                <meshStandardMaterial
                  color="#7c2d12"
                  side={THREE.DoubleSide}
                  roughness={0.5}
                />
              </mesh>
            </group>
          ))}

          {/* Hàng cột gỗ lim đỏ son sơn thếp vàng mặt tiền */}
          {frontPillarsX.map((xPos, idx) => (
            <group key={`front-pillar-${idx}`} position={[xPos, 1.1, -6.6]}>
              {/* Chân tảng đá xanh chạm cánh sen */}
              <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
                <cylinderGeometry args={[0.36, 0.44, 0.36, 16]} />
                <meshStandardMaterial
                  map={carvedStoneTexture}
                  color="#475569"
                  roughness={0.7}
                />
              </mesh>
              {/* Thân cột gỗ lim đỏ son cổ truyền */}
              <mesh position={[0, 2.65, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.27, 0.3, 4.9, 20]} />
                <meshStandardMaterial
                  map={lacquerWoodTexture}
                  color="#7f1d1d"
                  roughness={0.36}
                  metalness={0.15}
                />
              </mesh>
              {/* Vòng đai vàng trang trí chân cột & đầu cột */}
              <mesh position={[0, 0.55, 0]}>
                <cylinderGeometry args={[0.31, 0.31, 0.16, 20]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  metalness={0.7}
                  roughness={0.25}
                />
              </mesh>
              <mesh position={[0, 4.75, 0]}>
                <cylinderGeometry args={[0.3, 0.3, 0.2, 20]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  metalness={0.7}
                  roughness={0.25}
                />
              </mesh>
              {/* Bảng câu đối sơn son thếp vàng treo trước cột giữa */}
              {Math.abs(xPos) < 4.5 && (
                <mesh position={[0, 2.7, 0.31]} castShadow>
                  <boxGeometry args={[0.34, 3.1, 0.05]} />
                  <meshStandardMaterial
                    color="#991b1b"
                    emissive="#450a0a"
                    emissiveIntensity={0.2}
                    roughness={0.35}
                  />
                </mesh>
              )}
            </group>
          ))}

          {/* Hàng cột gỗ lim bên hông và nội điện */}
          {sidePillarsZ.map((zPos, idx) =>
            [-5.8, 5.8].map((xPos, sideIdx) => (
              <group
                key={`side-pillar-${idx}-${sideIdx}`}
                position={[xPos, 1.1, zPos]}
              >
                <mesh position={[0, 0.16, 0]} receiveShadow>
                  <cylinderGeometry args={[0.32, 0.38, 0.32, 14]} />
                  <meshStandardMaterial
                    map={carvedStoneTexture}
                    color="#475569"
                    roughness={0.7}
                  />
                </mesh>
                <mesh position={[0, 2.65, 0]} castShadow receiveShadow>
                  <cylinderGeometry args={[0.25, 0.28, 4.9, 16]} />
                  <meshStandardMaterial
                    map={lacquerWoodTexture}
                    color="#7f1d1d"
                    roughness={0.4}
                    metalness={0.12}
                  />
                </mesh>
              </group>
            ))
          )}

          {/* Xà ngang & Bức Hoành Phi "ĐẠI HÙNG BẢO ĐIỆN" giữa mặt tiền */}
          <mesh position={[0, 5.85, -6.6]} castShadow>
            <boxGeometry args={[13.4, 0.45, 0.48]} />
            <meshStandardMaterial
              map={lacquerWoodTexture}
              color="#7f1d1d"
              roughness={0.42}
            />
          </mesh>
          <group position={[0, 5.45, -6.3]}>
            {/* Khung vàng Hoành Phi */}
            <mesh castShadow>
              <boxGeometry args={[4.4, 0.96, 0.14]} />
              <meshStandardMaterial
                color="#f59e0b"
                metalness={0.68}
                roughness={0.25}
              />
            </mesh>
            {/* Nền sơn đỏ thẫm trong Hoành Phi */}
            <mesh position={[0, 0, 0.05]}>
              <boxGeometry args={[4.1, 0.72, 0.08]} />
              <meshStandardMaterial color="#7f1d1d" roughness={0.35} />
            </mesh>
            {/* 4 chữ vàng chạm nổi tượng trưng "ĐẠI HÙNG BẢO ĐIỆN" */}
            {[-1.35, -0.45, 0.45, 1.35].map((cx, i) => (
              <mesh key={i} position={[cx, 0, 0.11]}>
                <boxGeometry args={[0.48, 0.42, 0.05]} />
                <meshStandardMaterial
                  color="#fde047"
                  emissive="#f59e0b"
                  emissiveIntensity={0.25}
                  metalness={0.75}
                  roughness={0.2}
                />
              </mesh>
            ))}
          </group>

          {/* Đèn lồng đỏ treo dưới hiên Chánh Điện */}
          {[-4.45, 4.45].map((lx, idx) => (
            <group key={`lantern-${idx}`} position={[lx, 5.1, -6.3]}>
              <mesh position={[0, 0.35, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
                <meshStandardMaterial color="#451a03" />
              </mesh>
              <mesh castShadow>
                <sphereGeometry args={[0.32, 16, 14]} />
                <meshStandardMaterial
                  color="#dc2626"
                  emissive="#ef4444"
                  emissiveIntensity={isNightOrSunset ? 0.85 : 0.3}
                  roughness={0.4}
                />
              </mesh>
              <mesh position={[0, -0.34, 0]}>
                <cylinderGeometry args={[0.12, 0.04, 0.25, 10]} />
                <meshStandardMaterial
                  color="#f59e0b"
                  metalness={0.65}
                  roughness={0.3}
                />
              </mesh>
            </group>
          ))}

          {/* =====================================================================
              MÁI ĐAO CONG 3 TẦNG UY NGHIÊM (CurvedPagodaRoofHighPoly tiers=3)
             ===================================================================== */}
          <CurvedPagodaRoofHighPoly
            position={[0, 5.9, -10.4]}
            width={16.8}
            depth={11.4}
            height={4.9}
            tiers={3}
            tileColor="#7c2d12"
            trimColor="#f59e0b"
            ridgeType="pagoda"
          />
        </group>

        {/* =====================================================================
            3. TƯỢNG PHẬT THÍCH CA VÀNG TẠI (0, 2.6, -10.5) & TÒA SEN CỬU PHẨM
           ===================================================================== */}
        {/* Bệ thờ đá cẩm thạch & gỗ chạm nâng đỡ Đài Sen từ mặt sàn (y=1.12 -> y=2.6) */}
        <group position={[0, 1.12, -10.5]}>
          <mesh position={[0, 0.42, 0]} receiveShadow castShadow>
            <boxGeometry args={[4.6, 0.84, 3.4]} />
            <meshStandardMaterial
              map={lacquerWoodTexture}
              color="#451a03"
              roughness={0.45}
              metalness={0.18}
            />
          </mesh>
          <mesh position={[0, 0.86, 0]} receiveShadow castShadow>
            <boxGeometry args={[4.85, 0.12, 3.65]} />
            <meshStandardMaterial
              color="#f59e0b"
              metalness={0.65}
              roughness={0.25}
            />
          </mesh>
          {/* Bệ bát giác chạm phù điêu sóng nước liên hoa */}
          <mesh position={[0, 1.18, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[1.72, 1.95, 0.56, 8]} />
            <meshStandardMaterial
              map={lacquerWoodTexture}
              color="#78350f"
              roughness={0.42}
              metalness={0.25}
            />
          </mesh>
        </group>

        {/* TƯỢNG PHẬT THÍCH CA MÂU NI VÀNG TẠI (0, 2.6, -10.5) */}
        <group position={[0, 2.6, -10.5]}>
          {/* ĐẠI TƯỢNG PHẬT THÍCH CA MÂU NI ĐIÊU KHẮC HỮU CƠ (GLB HIGH-POLY) */}
          <Suspense fallback={null}>
            <FigureModel
              modelUrl="/models/figures/buddha.glb"
              position={[0, 0, 0]}
              scale={1.48}
              castShadow
              receiveShadow
            />
          </Suspense>

          {/* VÒNG HÀO QUANG PHẬT NHIỀU TIA SÁNG XOAY NHẸ TRONG USEFRAME */}
          <group ref={haloGroupRef} userData={{ cameraIgnore: true }} position={[0, 2.38, -0.28]}>
            {/* Vòng hào quang chính viền ngoài */}
            <mesh>
              <torusGeometry args={[1.72, 0.075, 16, 64]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#f59e0b"
                emissiveIntensity={0.9}
                metalness={0.72}
                roughness={0.2}
              />
            </mesh>

            {/* Vòng hào quang phụ ôm sát đầu Đức Phật */}
            <mesh>
              <torusGeometry args={[1.1, 0.048, 14, 48]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#fbbf24"
                emissiveIntensity={0.98}
                metalness={0.68}
                roughness={0.2}
              />
            </mesh>

            {/* Đĩa sáng hào quang mờ phía sau */}
            <mesh>
              <circleGeometry args={[1.68, 48]} />
              <meshBasicMaterial
                color="#fef08a"
                transparent
                opacity={isNightOrSunset ? 0.24 : 0.15}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>

            {/* 24 Tia sáng trí tuệ gắn quanh vòng hào quang xoay chuyển uy nghiêm */}
            {haloRays.map((ray) => (
              <mesh
                key={`halo-ray-${ray.id}`}
                position={[ray.x, ray.y, 0]}
                rotation={[0, 0, ray.angle - Math.PI / 2]}
              >
                <coneGeometry args={[ray.radius, ray.length, 6]} />
                <meshStandardMaterial
                  color="#fef08a"
                  emissive="#f59e0b"
                  emissiveIntensity={0.92}
                  metalness={0.68}
                  roughness={0.22}
                />
              </mesh>
            ))}
          </group>

          {/* Ánh sáng vàng ấm phát ra từ Vòng Hào Quang Phật */}
          <BudgetPointLight
            position={[0, 2.3, -0.2]}
            priority={1.5}
            color="#fbbf24"
            intensity={isNightOrSunset ? 3.4 : 2.2}
            distance={13}
            decay={1.6}
          />
        </group>

        {/* =====================================================================
            4. BÀN THỜ HOA SEN & ĐÔI ĐÈN CẦY LUNG LINH HAI BÊN BÀN THỜ
           ===================================================================== */}
        <group name="lotus-altar-table" position={[0, 1.12, -8.35]}>
          {/* Bàn thờ gỗ lim chạm trổ viền vàng */}
          <mesh position={[0, 0.56, 0]} castShadow receiveShadow>
            <boxGeometry args={[3.8, 1.12, 1.15]} />
            <meshStandardMaterial
              map={lacquerWoodTexture}
              color="#7f1d1d"
              roughness={0.4}
              metalness={0.15}
            />
          </mesh>
          {/* Mặt bàn thờ nhô rộng hai đầu */}
          <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
            <boxGeometry args={[4.15, 0.12, 1.3]} />
            <meshStandardMaterial
              map={lacquerWoodTexture}
              color="#451a03"
              roughness={0.38}
              metalness={0.2}
            />
          </mesh>
          {/* Yếm bàn thờ thếp vàng */}
          <mesh position={[0, 0.78, 0.59]}>
            <boxGeometry args={[3.4, 0.42, 0.04]} />
            <meshStandardMaterial
              color="#f59e0b"
              metalness={0.65}
              roughness={0.28}
            />
          </mesh>

          {/* Mâm bồng ngũ quả ở giữa bàn thờ */}
          <group position={[0, 1.21, 0]}>
            <mesh position={[0, 0.08, 0]} castShadow>
              <cylinderGeometry args={[0.36, 0.16, 0.16, 18]} />
              <meshStandardMaterial
                color="#d97706"
                metalness={0.6}
                roughness={0.3}
              />
            </mesh>
            {[
              [0, 0.24, 0, '#f59e0b'],
              [-0.14, 0.2, 0.08, '#dc2626'],
              [0.14, 0.2, 0.08, '#16a34a'],
              [0, 0.2, -0.14, '#eab308'],
            ].map(([fx, fy, fz, fColor], i) => (
              <mesh
                key={i}
                position={[fx as number, fy as number, fz as number]}
                castShadow
              >
                <sphereGeometry args={[0.1, 12, 12]} />
                <meshStandardMaterial
                  color={fColor as string}
                  roughness={0.4}
                />
              </mesh>
            ))}
          </group>

          {/* Hai bình hoa sen hồng hai bên bàn thờ */}
          <LotusAltarVase position={[-1.45, 1.21, 0]} />
          <LotusAltarVase position={[1.45, 1.21, 0]} />

          {/* Đôi chân đèn cầy đồng & ngọn nến lung linh hai bên bàn thờ */}
          {[-0.88, 0.88].map((candleX, idx) => (
            <group key={`candle-${idx}`} position={[candleX, 1.21, 0.15]}>
              {/* Chân đèn đồng */}
              <mesh position={[0, 0.16, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.16, 0.32, 14]} />
                <meshStandardMaterial
                  color="#b45309"
                  metalness={0.72}
                  roughness={0.28}
                />
              </mesh>
              {/* Đĩa nến */}
              <mesh position={[0, 0.33, 0]}>
                <cylinderGeometry args={[0.14, 0.09, 0.05, 14]} />
                <meshStandardMaterial
                  color="#d97706"
                  metalness={0.7}
                  roughness={0.25}
                />
              </mesh>
              {/* Thân nến đỏ */}
              <mesh position={[0, 0.52, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.05, 0.34, 12]} />
                <meshStandardMaterial color="#dc2626" roughness={0.5} />
              </mesh>
              {/* Ngọn lửa nến lung linh */}
              <mesh
                ref={idx === 0 ? candleLeftRef : candleRightRef}
                userData={{ cameraIgnore: true }}
                position={[0, 0.75, 0]}
              >
                <coneGeometry args={[0.042, 0.14, 10]} />
                <meshStandardMaterial
                  color="#fef08a"
                  emissive="#f59e0b"
                  emissiveIntensity={2.2}
                />
              </mesh>
              <BudgetPointLight
                position={[0, 0.8, 0]}
                color="#fb923c"
                intensity={isNightOrSunset ? 0.95 : 0.45}
                distance={3.5}
              />
            </group>
          ))}
        </group>

        {/* =====================================================================
            5. LƯ HƯƠNG ĐỒNG ĐẠI ĐIỆN TẠI (0, 0, -4) + NHANG ĐỎ + HẠT KHÓI HƯƠNG
           ===================================================================== */}
        <group name="main-incense-burner" position={[0, 0, -4]}>
          {/* Bệ đá tròn bát giác đặt dưới Lư Hương */}
          <mesh position={[0, 0.12, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[0.95, 1.12, 0.24, 8]} />
            <meshStandardMaterial
              map={carvedStoneTexture}
              color="#64748b"
              roughness={0.75}
              metalness={0.1}
            />
          </mesh>

          {/* 3 Chân đỉnh đồng chạm khắc cổ kính */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((legAngle, idx) => (
            <group
              key={`burner-leg-${idx}`}
              position={[
                Math.cos(legAngle) * 0.48,
                0.46,
                Math.sin(legAngle) * 0.48,
              ]}
              rotation={[0, -legAngle, 0]}
            >
              <mesh rotation={[0, 0, -0.16]} castShadow receiveShadow>
                <cylinderGeometry args={[0.11, 0.08, 0.56, 12]} />
                <meshStandardMaterial
                  color="#78350f"
                  metalness={0.68}
                  roughness={0.34}
                />
              </mesh>
              {/* Đầu lân chạm nổi trên chân đỉnh */}
              <mesh position={[0.04, 0.16, 0]} castShadow>
                <sphereGeometry args={[0.13, 12, 12]} />
                <meshStandardMaterial
                  color="#b45309"
                  metalness={0.72}
                  roughness={0.28}
                />
              </mesh>
            </group>
          ))}

          {/* Bụng đỉnh đồng cổ kính */}
          <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.66, 0.52, 0.62, 24]} />
            <meshStandardMaterial
              color="#78350f"
              metalness={0.68}
              roughness={0.32}
            />
          </mesh>

          {/* Vòng đai đồng chạm hoa văn lưỡng long chầu nguyệt */}
          <mesh position={[0, 0.94, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.62, 0.055, 12, 28]} />
            <meshStandardMaterial
              color="#d97706"
              metalness={0.75}
              roughness={0.25}
            />
          </mesh>

          {/* Vành miệng đỉnh đồng */}
          <mesh position={[0, 1.24, 0]} castShadow>
            <cylinderGeometry args={[0.72, 0.66, 0.1, 24]} />
            <meshStandardMaterial
              color="#b45309"
              metalness={0.72}
              roughness={0.26}
            />
          </mesh>

          {/* Hai quai đỉnh đồng uốn cong hai bên */}
          {[-0.72, 0.72].map((earX, idx) => (
            <mesh
              key={`handle-${idx}`}
              position={[earX, 1.12, 0]}
              rotation={[0, 0, earX > 0 ? -0.35 : 0.35]}
              castShadow
            >
              <torusGeometry args={[0.18, 0.045, 10, 20, Math.PI * 1.3]} />
              <meshStandardMaterial
                color="#d97706"
                metalness={0.72}
                roughness={0.28}
              />
            </mesh>
          ))}

          {/* Lớp tro hương mịn màu vàng xám bên trong đỉnh đồng */}
          <mesh position={[0, 1.25, 0]} receiveShadow>
            <cylinderGeometry args={[0.6, 0.58, 0.06, 20]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.92} />
          </mesh>

          {/* Các chân nhang đỏ đang cháy kèm đốm lửa đỏ hồng đầu nhang */}
          <group position={[0, 1.28, 0]}>
            {incenseSticks.map((stick) => (
              <group
                key={stick.id}
                position={[stick.x, 0, stick.z]}
                rotation={[stick.rotX, 0, stick.rotZ]}
              >
                {/* Chân nhang đỏ */}
                <mesh position={[0, 0.12, 0]}>
                  <cylinderGeometry args={[0.009, 0.009, 0.24, 6]} />
                  <meshStandardMaterial color="#dc2626" roughness={0.6} />
                </mesh>
                {/* Phần thân hương trầm phía trên */}
                <mesh position={[0, 0.34, 0]}>
                  <cylinderGeometry args={[0.011, 0.01, 0.24, 6]} />
                  <meshStandardMaterial color="#a8a29e" roughness={0.85} />
                </mesh>
                {/* Đốm lửa cháy đỏ cam ở đầu nén nhang */}
                <mesh position={[0, 0.47, 0]}>
                  <sphereGeometry args={[0.018, 8, 8]} />
                  <meshStandardMaterial
                    color="#fef08a"
                    emissive="#ef4444"
                    emissiveIntensity={2.8}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* Ánh sáng ấm áp tỏa ra từ các nén nhang trong Lư Hương */}
          <BudgetPointLight
            position={[0, 1.75, 0]}
            color="#fb923c"
            intensity={isNightOrSunset ? 1.35 : 0.75}
            distance={4.2}
          />

          {/* Hiệu ứng Hạt Khói Hương bay lượn lờ lên cao và tan dần */}
          <IncenseSmokeParticles origin={[0, 1.72, 0]} particleCount={24} />
        </group>
      </group>
    );
  }
);

MainSanctuary.displayName = 'MainSanctuary';
