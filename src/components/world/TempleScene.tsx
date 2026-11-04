import React, { type MutableRefObject, memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type { DirectionalLight } from 'three';
import {
  CAMERA_DEFAULTS,
  INTERACTION_ZONE_LIST,
} from '../../constants/templeLayout';
import type {
  CameraControlState,
  ChatBubbleState,
  GraphicsQuality,
  IncenseWish,
  InteractionZoneConfig,
  JoystickVector,
  MonkActionState,
  MonkPresence,
  MonkProfile,
  TimeOfDay,
  Vector3Tuple,
} from '../../types/game';
import { LocalPlayerController } from '../player/LocalPlayerController';
import type { MonkTransformState } from '../player/MonkAvatar';
import { RemoteMonksManager } from '../player/RemoteMonksManager';
import { InteractionZoneRing } from './InteractionZoneRing';
import { MainSanctuary } from './MainSanctuary';
import { TempleCourtyard } from './TempleCourtyard';
import { ENVIRONMENT_QUALITY, EnvironmentQualityProvider, EnvironmentShaderWarmup, useEnvironmentQuality } from './EnvironmentQuality';

export interface TempleSceneProps {
  profile: MonkProfile;
  timeOfDay: TimeOfDay;
  graphicsQuality?: GraphicsQuality;
  inputVectorRef: MutableRefObject<JoystickVector>;
  cameraControlRef: MutableRefObject<CameraControlState>;
  playerTransformRef: MutableRefObject<MonkTransformState>;
  forcedActionState?: MonkActionState | null;
  chatBubble?: ChatBubbleState | null;
  activeZone: InteractionZoneConfig | null;
  remoteMonks: MonkPresence[];
  recentWishes?: IncenseWish[];
  bellStrikePulse?: number;
  woodenFishPulse?: number;
  onZoneChange: (zone: InteractionZoneConfig | null) => void;
  onPositionSync: (
    position: Vector3Tuple,
    rotationY: number,
    actionState: MonkActionState
  ) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface AtmosphereConfig {
  skyColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  sunColor: string;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  celestialColor: string;
  celestialEmissive: string;
  celestialPosition: [number, number, number];
  celestialScale: number;
}

const ATMOSPHERE_PRESETS: Record<TimeOfDay, AtmosphereConfig> = {
  day: {
    skyColor: '#b2d0df',
    fogColor: '#c3d7df',
    fogNear: 55,
    fogFar: 220,
    ambientColor: '#f4f0e4',
    ambientIntensity: 0.62,
    sunColor: '#fff7d6',
    sunIntensity: 1.4,
    sunPosition: [32, 48, 28],
    hemiSky: '#d0e2e9',
    hemiGround: '#8b806e',
    hemiIntensity: 0.55,
    celestialColor: '#fef08a',
    celestialEmissive: '#f59e0b',
    celestialPosition: [40, 56, -42],
    celestialScale: 3.6,
  },
  sunset: {
    skyColor: '#9f8c89',
    fogColor: '#b29a90',
    fogNear: 45,
    fogFar: 190,
    ambientColor: '#efdbcb',
    ambientIntensity: 0.55,
    sunColor: '#f7bd83',
    sunIntensity: 1.15,
    sunPosition: [-42, 24, 16],
    hemiSky: '#dcc0b1',
    hemiGround: '#5c4944',
    hemiIntensity: 0.5,
    celestialColor: '#fb923c',
    celestialEmissive: '#ea580c',
    celestialPosition: [-52, 26, -38],
    celestialScale: 4.2,
  },
  night: {
    skyColor: '#101a2b',
    fogColor: '#152238',
    fogNear: 35,
    fogFar: 160,
    ambientColor: '#afc5de',
    ambientIntensity: 0.52,
    sunColor: '#bfdbfe',
    sunIntensity: 0.78,
    sunPosition: [22, 42, -22],
    hemiSky: '#405777',
    hemiGround: '#282b30',
    hemiIntensity: 0.5,
    celestialColor: '#fef9c3',
    celestialEmissive: '#fde047',
    celestialPosition: [34, 52, -40],
    celestialScale: 3.2,
  },
};

/** Fixed seed and fixed maximum buffer keep the same sky between comparisons. */
function TempleStars({ timeOfDay, particleScale }: { timeOfDay: TimeOfDay; particleScale: number }) {
  const positions = useMemo(() => {
    let seed = 6201;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const result = new Float32Array(2000 * 3);
    for (let index = 0; index < 2000; index += 1) {
      const azimuth = random() * Math.PI * 2;
      const height = 0.08 + random() * 0.92;
      const radius = 145 + random() * 25;
      const ring = Math.sqrt(1 - height * height) * radius;
      result.set([Math.cos(azimuth) * ring, height * radius, Math.sin(azimuth) * ring], index * 3);
    }
    return result;
  }, []);
  const count = Math.round((timeOfDay === 'night' ? 2000 : 500) * particleScale);
  return <points visible={timeOfDay !== 'day'} frustumCulled={false}>
    <bufferGeometry drawRange={{ start: 0, count }}>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
    </bufferGeometry>
    <pointsMaterial color="#dbe6f4" size={0.22} transparent opacity={timeOfDay === 'night' ? 0.72 : 0.2} depthWrite={false} fog={false} />
  </points>;
}

/**
 * Hệ thống ánh sáng môi trường, sương mù và bầu trời (Mặt trời / Mặt trăng / Sao đêm)
 */
const TempleAtmosphere: React.FC<{
  timeOfDay: TimeOfDay;
}> = ({ timeOfDay }) => {
  const { quality, shadowMapSize, particleScale } = useEnvironmentQuality();
  const preset = useMemo(() => ATMOSPHERE_PRESETS[timeOfDay], [timeOfDay]);
  const isLowQuality = quality === 'low';
  const sunRef = useRef<DirectionalLight>(null!);
  useLayoutEffect(() => {
    const shadow = sunRef.current.shadow;
    // r169 allocates the shadow target once; changing mapSize alone does not
    // resize an existing target when the user changes the quality preset.
    if (shadow.map && (!shadowMapSize || shadow.map.width !== shadowMapSize)) {
      shadow.map.dispose();
      shadow.map = null;
      shadow.mapPass?.dispose();
      shadow.mapPass = null;
      shadow.needsUpdate = true;
    }
  }, [shadowMapSize]);

  return (
    <>
      <color attach="background" args={[preset.skyColor]} />
      <fog
        attach="fog"
        args={[preset.fogColor, preset.fogNear, preset.fogFar]}
      />

      <ambientLight
        color={preset.ambientColor}
        intensity={preset.ambientIntensity}
      />
      <hemisphereLight
        args={[preset.hemiSky, preset.hemiGround, preset.hemiIntensity]}
      />
      <directionalLight
        ref={sunRef}
        castShadow={!isLowQuality}
        color={preset.sunColor}
        intensity={preset.sunIntensity}
        position={preset.sunPosition}
        shadow-mapSize-width={shadowMapSize || 1024}
        shadow-mapSize-height={shadowMapSize || 1024}
        shadow-bias={-0.00015}
        shadow-normalBias={0.025}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-camera-left={-54}
        shadow-camera-right={54}
        shadow-camera-top={54}
        shadow-camera-bottom={-54}
      />

      {/* Mặt Trời (Ban ngày / Hoàng hôn) hoặc Mặt Trăng (Ban đêm) */}
      <group position={preset.celestialPosition}>
        <mesh>
          <sphereGeometry args={[preset.celestialScale, 24, 24]} />
          <meshStandardMaterial
            color={preset.celestialColor}
            emissive={preset.celestialEmissive}
            emissiveIntensity={timeOfDay === 'night' ? 1.4 : 1.1}
          />
        </mesh>
        {/* Quầng hào quang quanh Mặt Trăng / Mặt Trời */}
        <mesh>
          <sphereGeometry args={[preset.celestialScale * 1.45, 20, 20]} />
          <meshBasicMaterial
            color={preset.celestialColor}
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Bầu trời sao lấp lánh khi về chiều tà và đêm trăng */}
      <TempleStars timeOfDay={timeOfDay} particleScale={particleScale} />
    </>
  );
};

export const TempleScene: React.FC<TempleSceneProps> = memo(({
  profile,
  timeOfDay,
  graphicsQuality = 'balanced',
  inputVectorRef,
  cameraControlRef,
  playerTransformRef,
  forcedActionState = null,
  chatBubble = null,
  activeZone,
  remoteMonks,
  recentWishes = [],
  bellStrikePulse = 0,
  woodenFishPulse = 0,
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

  const dprRange = ENVIRONMENT_QUALITY[graphicsQuality].dpr;

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
        shadows={graphicsQuality !== 'low'}
        dpr={dprRange}
        camera={{ fov: 50, near: 0.1, far: 280, position: [0, 6, 48] }}
        className="w-full h-full"
      >
        <EnvironmentQualityProvider quality={graphicsQuality} focusPositionRef={playerTransformRef}>
          <EnvironmentShaderWarmup topologyKey={timeOfDay} />
          {/* Ánh sáng môi trường, sương mù, bầu trời/trăng sao theo timeOfDay */}
          <TempleAtmosphere
            timeOfDay={timeOfDay}
          />

          {/* Đại Hùng Bảo Điện & Lư Hương Chánh Điện */}
          <MainSanctuary
            timeOfDay={timeOfDay}
            recentWishes={recentWishes}
            incenseCount={Math.max(3, recentWishes.length)}
          />

          {/* Kiến trúc Sân Chùa, Cổng Tam Quan, Hồ Sen, Cội Bồ Đề, Gác Chuông, Bàn Mõ, Quầy Xăm, Quần thể mở rộng */}
          <TempleCourtyard
            timeOfDay={timeOfDay}
            activeZoneId={activeZone?.id ?? null}
            bellStrikePulse={bellStrikePulse}
            woodenFishPulse={woodenFishPulse}
            recentWishes={recentWishes}
          />

          {/* Vòng sáng chỉ dẫn 8 khu vực tương tác trong sân chùa */}
          {INTERACTION_ZONE_LIST.map((zone) => (
            <InteractionZoneRing
              key={zone.id}
              zone={zone}
              isActive={activeZone?.id === zone.id}
            />
          ))}

          {/* Quản lý hiển thị các Chú Tiểu khác đang hành hương (Multiplayer) */}
          <RemoteMonksManager
            remoteMonks={remoteMonks}
            localUid={profile.uid}
          />

          {/* Điều khiển Chú Tiểu của người chơi hiện tại và Camera góc nhìn thứ 3 */}
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
        </EnvironmentQualityProvider>
      </Canvas>
    </div>
  );
});

TempleScene.displayName = 'TempleScene';

export default TempleScene;
