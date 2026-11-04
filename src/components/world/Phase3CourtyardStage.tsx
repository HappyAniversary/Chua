import React, { type MutableRefObject, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  CAMERA_DEFAULTS,
  INTERACTION_ZONE_LIST,
} from '../../constants/templeLayout';
import type {
  CameraControlState,
  ChatBubbleState,
  InteractionZoneConfig,
  InteractionZoneId,
  JoystickVector,
  MonkActionState,
  MonkProfile,
  TimeOfDay,
  Vector3Tuple,
} from '../../types/game';
import { LocalPlayerController } from '../player/LocalPlayerController';
import type { MonkTransformState } from '../player/MonkAvatar';

export interface Phase3CourtyardStageProps {
  profile: MonkProfile;
  timeOfDay: TimeOfDay;
  activeZoneId?: InteractionZoneId | null;
  inputVectorRef: MutableRefObject<JoystickVector>;
  cameraControlRef: MutableRefObject<CameraControlState>;
  playerTransformRef: MutableRefObject<MonkTransformState>;
  forcedActionState?: MonkActionState | null;
  chatBubble?: ChatBubbleState | null;
  onZoneChange?: (zone: InteractionZoneConfig | null) => void;
  onPositionSync?: (
    position: Vector3Tuple,
    rotationY: number,
    actionState: MonkActionState
  ) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface LightingPreset {
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientIntensity: number;
  ambientColor: string;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  lanternIntensity: number;
}

const LIGHTING_PRESETS: Record<TimeOfDay, LightingPreset> = {
  day: {
    skyColor: '#87ceeb',
    fogColor: '#cfe8f7',
    fogNear: 28,
    fogFar: 92,
    ambientIntensity: 0.65,
    ambientColor: '#fffbeb',
    sunColor: '#fff7d6',
    sunIntensity: 1.45,
    sunPosition: [18, 28, 16],
    hemiSky: '#bae6fd',
    hemiGround: '#78350f',
    hemiIntensity: 0.55,
    lanternIntensity: 0.4,
  },
  sunset: {
    skyColor: '#7c2d12',
    fogColor: '#9a3412',
    fogNear: 22,
    fogFar: 80,
    ambientIntensity: 0.5,
    ambientColor: '#fed7aa',
    sunColor: '#fb923c',
    sunIntensity: 1.3,
    sunPosition: [-24, 14, 12],
    hemiSky: '#fdba74',
    hemiGround: '#431407',
    hemiIntensity: 0.5,
    lanternIntensity: 1.35,
  },
  night: {
    skyColor: '#0c1222',
    fogColor: '#0f172a',
    fogNear: 18,
    fogFar: 68,
    ambientIntensity: 0.32,
    ambientColor: '#93c5fd',
    sunColor: '#bfdbfe',
    sunIntensity: 0.55,
    sunPosition: [12, 24, -10],
    hemiSky: '#1e3a8a',
    hemiGround: '#1c1917',
    hemiIntensity: 0.35,
    lanternIntensity: 2.1,
  },
};

/**
 * Vòng sáng chỉ dẫn tương tác dưới mặt đất và nhãn tên khu vực 3D
 */
const ZoneBeacon: React.FC<{
  zone: InteractionZoneConfig;
  isActive: boolean;
}> = ({ zone, isActive }) => {
  const pulseRingRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!pulseRingRef.current) return;
    const t = clock.getElapsedTime();
    const scale = isActive
      ? 1.03 + Math.sin(t * 4) * 0.05
      : 1 + Math.sin(t * 2) * 0.025;
    pulseRingRef.current.scale.set(scale, scale, 1);
  });

  return (
    <group position={[zone.position.x, 0.03, zone.position.z]}>
      {/* Đĩa nền mờ trong bán kính tương tác */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[zone.radius * 0.92, 48]} />
        <meshStandardMaterial
          color={zone.highlightColor}
          transparent
          opacity={isActive ? 0.24 : 0.1}
          emissive={zone.highlightColor}
          emissiveIntensity={isActive ? 0.5 : 0.15}
        />
      </mesh>

      {/* Vòng sáng viền ngoài */}
      <mesh ref={pulseRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[zone.radius * 0.86, zone.radius, 48]} />
        <meshBasicMaterial
          color={zone.highlightColor}
          transparent
          opacity={isActive ? 0.95 : 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Nhãn nổi tên khu vực */}
      <Html
        position={[0, 3.6, 0]}
        center
        distanceFactor={16}
        zIndexRange={[10, 0]}
      >
        <div
          className={`pointer-events-none select-none whitespace-nowrap px-3 py-1 rounded-full border text-xs font-semibold transition-all duration-200 shadow-lg ${
            isActive
              ? 'bg-amber-500 text-stone-950 border-amber-200 scale-110'
              : 'bg-stone-950/85 text-amber-100 border-amber-400/40'
          }`}
        >
          <span>{zone.name}</span>
          <span className="ml-1.5 opacity-85 font-mono text-[11px]">
            +{zone.meritReward}✦
          </span>
        </div>
      </Html>
    </group>
  );
};

/**
 * 1. Khu vực Lư Hương Chánh Điện (0, 0, -4) + Chánh Điện phía Bắc
 */
const MainHallAndIncenseAltar: React.FC<{ lanternIntensity: number }> = ({
  lanternIntensity,
}) => {
  const smokeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!smokeRef.current) return;
    const t = clock.getElapsedTime();
    smokeRef.current.position.y = 1.55 + Math.sin(t * 1.8) * 0.08;
    smokeRef.current.rotation.y = t * 0.4;
  });

  return (
    <group position={[0, 0, -4]}>
      {/* Bậc thềm đá dẫn lên Chánh Điện */}
      <mesh position={[0, 0.18, -2.5]} receiveShadow castShadow>
        <boxGeometry args={[14, 0.36, 7.5]} />
        <meshStandardMaterial color="#78716c" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.42, -3.6]} receiveShadow castShadow>
        <boxGeometry args={[12.4, 0.48, 5.5]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.8} />
      </mesh>

      {/* Nền và khung Đại Hùng Bảo Điện phía sau */}
      <mesh position={[0, 2.7, -5.6]} receiveShadow castShadow>
        <boxGeometry args={[11.2, 4.2, 2.2]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.7} />
      </mesh>
      {/* Mái Chánh Điện cong truyền thống */}
      <mesh position={[0, 5.1, -5.4]} castShadow receiveShadow>
        <coneGeometry args={[8.5, 2.2, 4]} />
        <meshStandardMaterial color="#991b1b" roughness={0.6} />
      </mesh>

      {/* Đài sen & Tượng Phật Vàng */}
      <group position={[0, 0.7, -4.1]}>
        {/* Bệ đá */}
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.25, 1.45, 0.7, 24]} />
          <meshStandardMaterial color="#57534e" roughness={0.7} />
        </mesh>
        {/* Đài sen hồng vàng */}
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[1.15, 0.9, 0.35, 16]} />
          <meshStandardMaterial
            color="#f472b6"
            emissive="#be185d"
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Thân tượng Phật ngồi thiền */}
        <mesh position={[0, 1.55, 0]} castShadow>
          <coneGeometry args={[0.85, 1.45, 16]} />
          <meshStandardMaterial
            color="#fbbf24"
            metalness={0.65}
            roughness={0.25}
            emissive="#d97706"
            emissiveIntensity={0.25}
          />
        </mesh>
        {/* Đầu tượng Phật */}
        <mesh position={[0, 2.45, 0]} castShadow>
          <sphereGeometry args={[0.42, 24, 24]} />
          <meshStandardMaterial
            color="#fbbf24"
            metalness={0.65}
            roughness={0.25}
            emissive="#d97706"
            emissiveIntensity={0.25}
          />
        </mesh>
        {/* Nhục髻 (Ushnisha) trên đỉnh đầu */}
        <mesh position={[0, 2.9, 0]} castShadow>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial
            color="#f59e0b"
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
        {/* Hào quang tròn sau lưng tượng Phật */}
        <mesh position={[0, 2.1, -0.35]}>
          <ringGeometry args={[0.95, 1.25, 32]} />
          <meshBasicMaterial
            color="#fde68a"
            side={THREE.DoubleSide}
            transparent
            opacity={0.75}
          />
        </mesh>
      </group>

      {/* Lư Hương Đồng ngay tại tâm vùng tương tác (0, 0, -4) */}
      <group position={[0, 0, 0]}>
        {/* Bệ đá kê lư hương */}
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.75, 0.9, 0.5, 20]} />
          <meshStandardMaterial color="#57534e" roughness={0.85} />
        </mesh>
        {/* Thân lư hương đồng */}
        <mesh position={[0, 0.82, 0]} castShadow>
          <cylinderGeometry args={[0.62, 0.48, 0.72, 24]} />
          <meshStandardMaterial
            color="#b45309"
            metalness={0.6}
            roughness={0.35}
          />
        </mesh>
        {/* Tro nhang */}
        <mesh position={[0, 1.19, 0]}>
          <cylinderGeometry args={[0.54, 0.54, 0.05, 20]} />
          <meshStandardMaterial color="#d6d3d1" roughness={0.95} />
        </mesh>
        {/* Các chân nhang đỏ rực */}
        {[-0.14, 0, 0.14].map((offsetX, idx) => (
          <group key={idx} position={[offsetX, 1.42, 0]}>
            <mesh>
              <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            <mesh position={[0, 0.27, 0]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color="#fb923c" />
            </mesh>
          </group>
        ))}
        {/* Làn khói hương bay lên */}
        <group ref={smokeRef} position={[0, 1.55, 0]}>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial
              color="#f5f5f4"
              transparent
              opacity={0.35}
              roughness={1}
            />
          </mesh>
          <mesh position={[0.06, 0.5, 0.04]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial
              color="#f5f5f4"
              transparent
              opacity={0.22}
              roughness={1}
            />
          </mesh>
        </group>

        <pointLight
          position={[0, 1.9, 0.4]}
          color="#fbbf24"
          intensity={0.9 + lanternIntensity * 0.5}
          distance={9}
        />
      </group>
    </group>
  );
};

/**
 * 2. Khu vực Bàn Mõ Tụng Kinh (-5, 0, -2)
 */
const WoodenFishStation: React.FC = () => {
  return (
    <group position={[-5, 0, -2]}>
      {/* Chiếu cói ngồi tụng kinh */}
      <mesh position={[0, 0.02, 0.9]} receiveShadow>
        <boxGeometry args={[1.9, 0.04, 1.5]} />
        <meshStandardMaterial color="#d97706" roughness={0.9} />
      </mesh>
      {/* Đệm bồ đoàn */}
      <mesh position={[0, 0.1, 1.05]} castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.5, 0.14, 20]} />
        <meshStandardMaterial color="#991b1b" roughness={0.8} />
      </mesh>

      {/* Bàn gỗ sơn son thếp vàng */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.9, 1.0]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.88, 0.1, 1.14]} />
        <meshStandardMaterial
          color="#f59e0b"
          metalness={0.35}
          roughness={0.4}
        />
      </mesh>

      {/* Đệm đặt mõ */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.38, 0.1, 16]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.7} />
      </mesh>
      {/* Chiếc Mõ Đỏ truyền thống */}
      <mesh position={[0, 1.24, 0]} scale={[1.2, 0.95, 1]} castShadow>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial
          color="#dc2626"
          roughness={0.35}
          metalness={0.15}
        />
      </mesh>
      {/* Dùi gõ mõ */}
      <mesh
        position={[0.38, 1.12, 0.12]}
        rotation={[0.2, 0.4, Math.PI / 2.4]}
        castShadow
      >
        <cylinderGeometry args={[0.035, 0.025, 0.48, 10]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
    </group>
  );
};

/**
 * 3. Khu vực Gác Chuông Đại Hồng Chung (7, 0, 4)
 */
const TempleBellPavilion: React.FC<{ lanternIntensity: number }> = ({
  lanternIntensity,
}) => {
  return (
    <group position={[7, 0, 4]}>
      {/* Nền đá Gác Chuông */}
      <mesh position={[0, 0.16, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.8, 0.32, 3.8]} />
        <meshStandardMaterial color="#78716c" roughness={0.85} />
      </mesh>

      {/* 4 cột gỗ lim */}
      {[
        [-1.35, -1.35],
        [1.35, -1.35],
        [-1.35, 1.35],
        [1.35, 1.35],
      ].map(([cx, cz], idx) => (
        <mesh key={idx} position={[cx, 1.85, cz]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.18, 3.4, 16]} />
          <meshStandardMaterial color="#7c2d12" roughness={0.65} />
        </mesh>
      ))}

      {/* Xà ngang treo chuông */}
      <mesh
        position={[0, 3.3, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.12, 0.12, 3.1, 12]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>

      {/* Mái gác chuông */}
      <mesh
        position={[0, 4.15, 0]}
        rotation={[0, Math.PI / 4, 0]}
        castShadow
        receiveShadow
      >
        <coneGeometry args={[3.2, 1.6, 4]} />
        <meshStandardMaterial color="#991b1b" roughness={0.6} />
      </mesh>

      {/* Quả Đại Hồng Chung bằng đồng treo giữa */}
      <group position={[0, 2.15, 0]}>
        {/* Quai chuông */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.18, 0.45, 12]} />
          <meshStandardMaterial
            color="#ca8a04"
            metalness={0.75}
            roughness={0.28}
          />
        </mesh>
        {/* Thân chuông */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.72, 1.35, 24]} />
          <meshStandardMaterial
            color="#eab308"
            metalness={0.7}
            roughness={0.3}
            emissive="#a16207"
            emissiveIntensity={0.18}
          />
        </mesh>
      </group>

      {/* Chày kình gỗ thỉnh chuông */}
      <mesh
        position={[0.95, 1.85, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry args={[0.1, 0.1, 1.1, 12]} />
        <meshStandardMaterial color="#92400e" roughness={0.7} />
      </mesh>

      <pointLight
        position={[0, 2.8, 0]}
        color="#facc15"
        intensity={0.6 + lanternIntensity * 0.4}
        distance={8}
      />
    </group>
  );
};

/**
 * 4. Khu vực Quầy Xin Xăm Đầu Năm (-7, 0, 4)
 */
const FortuneStallStation: React.FC<{ lanternIntensity: number }> = ({
  lanternIntensity,
}) => {
  return (
    <group position={[-7, 0, 4]}>
      {/* Thảm chiếu đỏ trước bàn xin xăm */}
      <mesh position={[0, 0.02, 1.05]} receiveShadow>
        <boxGeometry args={[2.2, 0.04, 1.4]} />
        <meshStandardMaterial color="#991b1b" roughness={0.85} />
      </mesh>

      {/* Bàn gỗ đỏ đặt ống xăm */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.0, 1.2]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.04, 0]} castShadow>
        <boxGeometry args={[2.35, 0.1, 1.35]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.5} />
      </mesh>

      {/* Ống xăm tre và các thẻ xăm đầu đỏ */}
      <group position={[0, 1.32, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.2, 0.18, 0.5, 16]} />
          <meshStandardMaterial color="#d97706" roughness={0.65} />
        </mesh>
        {[-0.07, -0.02, 0.03, 0.08].map((ox, i) => (
          <mesh
            key={i}
            position={[ox, 0.28, (i - 1.5) * 0.03]}
            rotation={[0.08 * (i - 1), 0, (i - 1.5) * 0.08]}
            castShadow
          >
            <boxGeometry args={[0.03, 0.35, 0.015]} />
            <meshStandardMaterial color="#fef08a" />
          </mesh>
        ))}
      </group>

      {/* 2 cột treo đèn lồng đỏ hai bên bàn xăm */}
      {[-1.35, 1.35].map((xPos, idx) => (
        <group key={idx} position={[xPos, 0, -0.3]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 3.0, 10]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
          <mesh position={[0, 2.65, 0.25]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#dc2626"
              emissiveIntensity={0.85}
            />
          </mesh>
        </group>
      ))}

      <pointLight
        position={[0, 2.5, 0.2]}
        color="#f87171"
        intensity={0.7 + lanternIntensity * 0.5}
        distance={8}
      />
    </group>
  );
};

/**
 * 5. Khu vực Cội Bồ Đề Nguyện Ước (0, 0, 9)
 */
const BodhiTreeSanctuary: React.FC<{ lanternIntensity: number }> = ({
  lanternIntensity,
}) => {
  const ribbonsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ribbonsRef.current) return;
    const t = clock.getElapsedTime();
    ribbonsRef.current.rotation.y = Math.sin(t * 0.8) * 0.06;
  });

  const wishRibbonPositions: [number, number, number][] = useMemo(
    () => [
      [-1.5, 2.7, 0.8],
      [1.6, 2.8, 0.7],
      [-0.9, 2.9, -1.4],
      [1.2, 2.6, -1.2],
      [0, 2.75, 1.7],
      [-1.7, 2.65, -0.4],
    ],
    []
  );

  return (
    <group position={[0, 0, 9]}>
      {/* Bồn đá bát giác quanh gốc cây Bồ Đề */}
      <mesh position={[0, 0.28, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.1, 2.35, 0.56, 8]} />
        <meshStandardMaterial color="#78716c" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.56, 0]} receiveShadow>
        <cylinderGeometry args={[1.9, 1.9, 0.08, 16]} />
        <meshStandardMaterial color="#44403c" roughness={0.95} />
      </mesh>

      {/* Thân cây Bồ Đề cổ thụ */}
      <mesh position={[0, 2.0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.95, 3.2, 16]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>

      {/* Tán lá Bồ Đề xanh rợp bóng kết hợp ánh vàng tâm linh */}
      <group position={[0, 4.1, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <sphereGeometry args={[2.6, 20, 20]} />
          <meshStandardMaterial color="#15803d" roughness={0.75} />
        </mesh>
        <mesh position={[-1.4, -0.2, 0.8]} castShadow>
          <sphereGeometry args={[1.7, 16, 16]} />
          <meshStandardMaterial color="#166534" roughness={0.8} />
        </mesh>
        <mesh position={[1.5, -0.1, 0.6]} castShadow>
          <sphereGeometry args={[1.75, 16, 16]} />
          <meshStandardMaterial color="#14532d" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.1, -1.4]} castShadow>
          <sphereGeometry args={[1.8, 16, 16]} />
          <meshStandardMaterial color="#16a34a" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.7, 0]} castShadow>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshStandardMaterial
            color="#ca8a04"
            emissive="#a16207"
            emissiveIntensity={0.15}
            roughness={0.7}
          />
        </mesh>
      </group>

      {/* Các dải lụa đỏ nguyện ước treo dưới tán cây */}
      <group ref={ribbonsRef}>
        {wishRibbonPositions.map(([rx, ry, rz], idx) => (
          <mesh key={idx} position={[rx, ry, rz]} castShadow>
            <boxGeometry args={[0.12, 0.65, 0.03]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#b91c1c"
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
      </group>

      <pointLight
        position={[0, 3.0, 0]}
        color="#34d399"
        intensity={0.6 + lanternIntensity * 0.45}
        distance={10}
      />
    </group>
  );
};

/**
 * Cổng Tam Quan uy nghiêm ở phía Nam (0, 0, 20)
 */
const TamQuanGate: React.FC<{ lanternIntensity: number }> = ({
  lanternIntensity,
}) => {
  const pillarXPositions = [-6.2, -2.4, 2.4, 6.2];

  return (
    <group position={[0, 0, 20]}>
      {/* 4 trụ cổng Tam Quan */}
      {pillarXPositions.map((px, idx) => {
        const isCenterPillar = idx === 1 || idx === 2;
        const height = isCenterPillar ? 5.6 : 4.4;
        return (
          <group key={idx} position={[px, 0, 0]}>
            <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.6, 0.9]} />
              <meshStandardMaterial color="#78716c" roughness={0.85} />
            </mesh>
            <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.26, 0.3, height, 16]} />
              <meshStandardMaterial color="#991b1b" roughness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* Hoành phi cổng chính "CHÙA TỪ TÂM" */}
      <mesh position={[0, 4.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.6, 0.75, 0.65]} />
        <meshStandardMaterial color="#78350f" roughness={0.6} />
      </mesh>
      {/* Mái cổng chính */}
      <mesh position={[0, 6.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.6, 0.55, 1.8]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.55} />
      </mesh>
      <mesh position={[0, 6.65, 0]} castShadow>
        <boxGeometry args={[5.2, 0.45, 1.4]} />
        <meshStandardMaterial color="#d97706" roughness={0.45} />
      </mesh>

      {/* Hai mái cổng phụ hai bên */}
      {[-4.3, 4.3].map((sideX, idx) => (
        <mesh key={idx} position={[sideX, 4.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.9, 0.5, 1.5]} />
          <meshStandardMaterial color="#991b1b" roughness={0.6} />
        </mesh>
      ))}

      {/* Đèn lồng treo tại Cổng Tam Quan */}
      {[-1.7, 1.7].map((lx, idx) => (
        <group key={idx} position={[lx, 4.2, 0]}>
          <mesh>
            <sphereGeometry args={[0.26, 16, 16]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#ea580c"
              emissiveIntensity={0.9}
            />
          </mesh>
          {lanternIntensity > 0.6 && (
            <pointLight
              color="#fb923c"
              intensity={lanternIntensity * 0.7}
              distance={9}
            />
          )}
        </group>
      ))}
    </group>
  );
};

/**
 * Toàn bộ cảnh quan Sân Chùa 3D bên trong Canvas
 */
const CourtyardEnvironment: React.FC<{
  timeOfDay: TimeOfDay;
  activeZoneId: InteractionZoneId | null;
}> = ({ timeOfDay, activeZoneId }) => {
  const preset = LIGHTING_PRESETS[timeOfDay];

  return (
    <>
      <color attach="background" args={[preset.skyColor]} />
      <fog
        attach="fog"
        args={[preset.fogColor, preset.fogNear, preset.fogFar]}
      />

      {/* Hệ thống ánh sáng theo thời gian trong ngày */}
      <ambientLight
        color={preset.ambientColor}
        intensity={preset.ambientIntensity}
      />
      <hemisphereLight
        args={[preset.hemiSky, preset.hemiGround, preset.hemiIntensity]}
      />
      <directionalLight
        castShadow
        color={preset.sunColor}
        intensity={preset.sunIntensity}
        position={preset.sunPosition}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />

      {/* Mặt sân gạch đỏ truyền thống */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 4]}
        receiveShadow
      >
        <planeGeometry args={[64, 64]} />
        <meshStandardMaterial color="#8c3b2b" roughness={0.9} />
      </mesh>

      {/* Lưới gạch sân chùa giúp cảm nhận rõ tốc độ và chiều sâu khi di chuyển góc nhìn thứ 3 */}
      <gridHelper
        args={[52, 52, '#b45309', '#6b2d21']}
        position={[0, 0.01, 4]}
      />

      {/* Đường lát đá thanh tịnh dẫn từ Cổng Tam Quan (z=20) tới Chánh Điện (z=-4) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, 8]}
        receiveShadow
      >
        <planeGeometry args={[3.4, 24]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.82} />
      </mesh>

      {/* Các phiến đá bước chân dọc trục thần đạo */}
      {[-1, 2, 5, 13, 16, 19].map((zPos) => (
        <mesh
          key={zPos}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.022, zPos]}
          receiveShadow
        >
          <planeGeometry args={[2.4, 1.6]} />
          <meshStandardMaterial color="#d6d3d1" roughness={0.75} />
        </mesh>
      ))}

      {/* Hàng trụ đèn đá hai bên sân chùa */}
      {[
        [-4.2, 14],
        [4.2, 14],
        [-4.2, 6],
        [4.2, 6],
      ].map(([lx, lz], idx) => (
        <group key={idx} position={[lx, 0, lz]}>
          <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.18, 0.26, 1.3, 8]} />
            <meshStandardMaterial color="#78716c" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.42, 0]}>
            <boxGeometry args={[0.36, 0.32, 0.36]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#f59e0b"
              emissiveIntensity={preset.lanternIntensity}
            />
          </mesh>
          <mesh position={[0, 1.72, 0]} castShadow>
            <coneGeometry args={[0.42, 0.3, 4]} />
            <meshStandardMaterial color="#57534e" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* 5 Khu vực kiến trúc tâm linh & Vòng sáng tương tác */}
      <MainHallAndIncenseAltar lanternIntensity={preset.lanternIntensity} />
      <WoodenFishStation />
      <TempleBellPavilion lanternIntensity={preset.lanternIntensity} />
      <FortuneStallStation lanternIntensity={preset.lanternIntensity} />
      <BodhiTreeSanctuary lanternIntensity={preset.lanternIntensity} />

      {/* Cổng Tam Quan phía Nam */}
      <TamQuanGate lanternIntensity={preset.lanternIntensity} />

      {/* Vòng sáng & Nhãn của cả 5 khu vực trong INTERACTION_ZONE_LIST */}
      {INTERACTION_ZONE_LIST.map((zone) => (
        <ZoneBeacon
          key={zone.id}
          zone={zone}
          isActive={activeZoneId === zone.id}
        />
      ))}
    </>
  );
};

export const Phase3CourtyardStage: React.FC<Phase3CourtyardStageProps> = ({
  profile,
  timeOfDay,
  activeZoneId = null,
  inputVectorRef,
  cameraControlRef,
  playerTransformRef,
  forcedActionState = null,
  chatBubble = null,
  onZoneChange,
  onPositionSync,
}) => {
  const dragStateRef = useRef<{
    isDragging: boolean;
    pointerId: number | null;
    lastX: number;
    lastY: number;
  }>({
    isDragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Chỉ bắt đầu xoay camera bằng chuột trái hoặc chạm tay trên vùng Canvas
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragStateRef.current = {
      isDragging: true,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      !dragStateRef.current.isDragging ||
      dragStateRef.current.pointerId !== e.pointerId
    ) {
      return;
    }

    const dx = e.clientX - dragStateRef.current.lastX;
    const dy = e.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;

    cameraControlRef.current.yaw -= dx * 0.0065;
    cameraControlRef.current.pitch = clamp(
      cameraControlRef.current.pitch + dy * 0.005,
      0.15,
      1.18
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.pointerId === e.pointerId) {
      dragStateRef.current.isDragging = false;
      dragStateRef.current.pointerId = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    cameraControlRef.current.distance = clamp(
      cameraControlRef.current.distance + e.deltaY * 0.005,
      CAMERA_DEFAULTS.minDistance,
      CAMERA_DEFAULTS.maxDistance
    );
  };

  return (
    <div
      className="relative w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      <Canvas
        shadows
        camera={{ fov: 50, near: 0.1, far: 150, position: [0, 5, 25] }}
        className="w-full h-full"
      >
        <CourtyardEnvironment
          timeOfDay={timeOfDay}
          activeZoneId={activeZoneId}
        />
        <LocalPlayerController
          profile={profile}
          inputVectorRef={inputVectorRef}
          cameraControlRef={cameraControlRef}
          playerTransformRef={playerTransformRef}
          forcedActionState={forcedActionState}
          chatBubble={chatBubble}
          onZoneChange={onZoneChange}
          onPositionSync={onPositionSync}
        />
      </Canvas>
    </div>
  );
};

export default Phase3CourtyardStage;
