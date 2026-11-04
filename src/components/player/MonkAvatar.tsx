import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createFigureInstance, figureAssetUrl, nextFigureLod, kasayaTrimColor } from '../../utils/figureAssets';
import { createFigureAnimator, MONK_MALLET_ANGLE, MONK_MALLET_GRIP, MONK_MALLET_HEAD_Y, MONK_FORTUNE_ANGLE, MONK_FORTUNE_GRIP } from '../../utils/figureAnimation';
import { FigureLoadBoundary } from '../../utils/figureLoadBoundary';
import { useEnvironmentQuality } from '../world/EnvironmentQuality';
import { advanceWalkPhase, displacementIsWalking, motionDelta } from '../../utils/playerMotion';
import { useWorldLabel } from '../../utils/useWorldLabel';
import { getGroundHeight, resolveMovement } from '../../constants/templeLayout';
import type {
  ChatBubbleState,
  MonkActionState,
  RobeColor,
  Vector3Tuple,
} from '../../types/game';

export interface MonkTransformState {
  position: Vector3Tuple;
  rotationY: number;
  actionState: MonkActionState;
}

export interface MonkAvatarProps {
  monkName: string;
  robeColor: RobeColor;
  meritPoints?: number;
  position?: Vector3Tuple;
  rotationY?: number;
  actionState?: MonkActionState;
  transformRef?: MutableRefObject<MonkTransformState>;
  chatBubble?: ChatBubbleState | null;
  isLocalPlayer?: boolean;
}

const DEFAULT_POSITION: Vector3Tuple = { x: 0, y: 0, z: 18 };

/**
 * Fallback hiển thị an toàn khi GLTF đang tải
 */
const MonkAvatarFallback: React.FC<{ robeColor: RobeColor; failed?: boolean }> = ({ robeColor, failed }) => {
  return (
    <group position={[0, 0, 0]}>
      {failed && <Html center position={[0, 2, 0]}><span className="rounded bg-stone-900/90 px-2 py-1 text-xs text-amber-100 whitespace-nowrap">Không tải được nhân vật</span></Html>}
      {/* Khối thân tượng trưng */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.25, 16]} />
        <meshStandardMaterial color={robeColor} roughness={0.7} transparent opacity={0.65} />
      </mesh>
      {/* Khối đầu tượng trưng */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#f5cba7" roughness={0.7} transparent opacity={0.65} />
      </mesh>
    </group>
  );
};

/**
 * Avatar LODs share one action driver contract and attach props to canonical sockets.
 */
export interface MonkSkinnedMeshModelProps {
  lodOverride?: 0 | 1;
  wireframe?: boolean;
  showSkeleton?: boolean;
  showSockets?: boolean;
  onStatsLoaded?: (stats: { vertices: number; triangles: number; bones: number }) => void;
  robeColor: RobeColor;
  trimColor: string;
  walkPhaseRef: MutableRefObject<number>;
  currentActionRef: MutableRefObject<MonkActionState | 'none'>;
  woodenFishStickPropRef: MutableRefObject<THREE.Group | null>;
  fortuneTubePropRef: MutableRefObject<THREE.Group | null>;
  incensePropRef: MutableRefObject<THREE.Group | null>;
}

export const MonkSkinnedMeshModel: React.FC<MonkSkinnedMeshModelProps> = ({
  lodOverride, wireframe = false, showSkeleton = false, showSockets = false, onStatsLoaded,
  robeColor,
  trimColor,
  walkPhaseRef,
  currentActionRef,
  woodenFishStickPropRef,
  fortuneTubePropRef,
  incensePropRef,
}) => {
  const sources = useGLTF([figureAssetUrl('/models/figures/sample_monk.glb'), figureAssetUrl('/models/figures/sample_monk_lod1.glb')]);
  const instances = useMemo(() => sources.map(({ scene }) => createFigureInstance(scene, true)), [sources]);
  const drivers = useMemo(() => instances.map(({ scene }) => createFigureAnimator(scene)), [instances]);
  const canonical = instances[0];
  const clonedScene = canonical.scene;
  const socketsMap = canonical.sockets;
  const root = useRef<THREE.Group>(null);
  const metadata = useMemo(() => ({ figureModel: 'sample_monk', figureLod: 0 }), []);
  const activeLod = useRef<0 | 1>(0);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const { quality } = useEnvironmentQuality();
  const worldScene = useThree((state) => state.scene);
  const skeletonHelper = useMemo(() => showSkeleton ? new THREE.SkeletonHelper(clonedScene) : null, [showSkeleton, clonedScene]);
  useEffect(() => () => instances.forEach((instance) => instance.dispose()), [instances]);
  useEffect(() => () => {
    skeletonHelper?.geometry.dispose();
    const material = skeletonHelper?.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  }, [skeletonHelper]);
  useEffect(() => {
    instances.forEach((instance) => {
      instance.recolorRobe(robeColor, trimColor);
      instance.meshes.forEach((mesh) => {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial) {
            material.vertexColors = Boolean(mesh.geometry.getAttribute('color'));
            material.wireframe = wireframe;
          }
        });
      });
    });
  }, [instances, robeColor, trimColor, wireframe]);
  useEffect(() => {
    const lod = lodOverride ?? 0;
    activeLod.current = lod;
    instances.forEach((instance, index) => instance.setVisible(index === lod));
    onStatsLoaded?.(instances[lod].stats);
  }, [instances, lodOverride, onStatsLoaded]);

  useFrame(({ clock, camera }, delta) => {
    const t = clock.getElapsedTime();
    const action = currentActionRef.current;
    // Both LODs keep the same phase, so switching never restarts an animation.
    drivers.forEach((drive) => drive(action, t, delta, walkPhaseRef.current));
    if (root.current) {
      root.current.getWorldPosition(worldPosition);
      const next = lodOverride ?? nextFigureLod(activeLod.current, camera.position.distanceTo(worldPosition), quality);
      if (next !== activeLod.current) {
        activeLod.current = next;
        instances.forEach((instance, index) => instance.setVisible(index === next));
      }
      root.current.userData.figureLod = next;
    }
    if (woodenFishStickPropRef.current) woodenFishStickPropRef.current.visible = action === 'wooden_fish';
    if (fortuneTubePropRef.current) fortuneTubePropRef.current.visible = action === 'fortune';
    if (incensePropRef.current) incensePropRef.current.visible = action === 'praying';
  }, -15);

  const handRSocket = socketsMap.get('hand_r_socket');
  const chestSocket = socketsMap.get('chest_socket');
  const headSocket = socketsMap.get('head_socket');

  return (
    <group ref={root} dispose={null} userData={metadata}>
      {instances.map((instance, index) => <primitive key={index} object={instance.scene} dispose={null} />)}
      {skeletonHelper && createPortal(<primitive object={skeletonHelper} dispose={null} />, worldScene)}
      {showSockets && [...socketsMap].map(([name, socket]) => <React.Fragment key={name}>{createPortal(<group><axesHelper args={[0.1]} /><mesh><sphereGeometry args={[0.014, 8, 6]} /><meshBasicMaterial color="#38bdf8" /></mesh></group>, socket)}</React.Fragment>)}

      {/* Gắn dùi gõ mõ vào hand_r_socket */}
      {handRSocket && (
        <React.Fragment key="portal-mallet">
          {createPortal(
            <group
              ref={woodenFishStickPropRef as unknown as React.Ref<THREE.Group>}
              position={MONK_MALLET_GRIP}
              rotation={[MONK_MALLET_ANGLE, 0, 0]}
              visible={currentActionRef.current === 'wooden_fish'}
            >
              <mesh position={[0, 0.06, 0]} castShadow>
                <cylinderGeometry args={[0.012, 0.015, 0.24, 12]} />
                <meshStandardMaterial color="#78350f" roughness={0.7} />
              </mesh>
              <mesh position={[0, MONK_MALLET_HEAD_Y, 0]} castShadow>
                <sphereGeometry args={[0.032, 14, 14]} />
                <meshStandardMaterial color="#991b1b" roughness={0.5} />
              </mesh>
            </group>,
            handRSocket
          )}
        </React.Fragment>
      )}

      {/* Gắn ống xăm vào hand_r_socket */}
      {handRSocket && (
        <React.Fragment key="portal-fortune">
          {createPortal(
            <group
              ref={fortuneTubePropRef as unknown as React.Ref<THREE.Group>}
              position={MONK_FORTUNE_GRIP}
              rotation={[0, MONK_FORTUNE_ANGLE, 0]}
              visible={currentActionRef.current === 'fortune'}
            >
              {/* Thân ống tre vàng óng */}
              <mesh castShadow>
                <cylinderGeometry args={[0.072, 0.068, 0.24, 20]} />
                <meshStandardMaterial color="#ca8a04" roughness={0.55} />
              </mesh>
              {/* Đai ống tre đỏ */}
              <mesh position={[0, 0.07, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.03, 20]} />
                <meshStandardMaterial color="#b91c1c" roughness={0.5} />
              </mesh>
              {/* Các thẻ xăm nhô lên trong ống */}
              {[
                [-0.025, 0.14, 0.01, 0.08],
                [0, 0.16, -0.015, -0.05],
                [0.025, 0.145, 0.01, -0.1],
                [-0.01, 0.15, 0.025, 0.04],
              ].map(([sx, sy, sz, rotZ], idx) => (
                <group key={idx} position={[sx, sy, sz]} rotation={[0, 0, rotZ]}>
                  <mesh>
                    <boxGeometry args={[0.016, 0.12, 0.006]} />
                    <meshStandardMaterial color="#fde047" roughness={0.7} />
                  </mesh>
                  <mesh position={[0, 0.05, 0]}>
                    <boxGeometry args={[0.017, 0.028, 0.007]} />
                    <meshStandardMaterial color="#dc2626" roughness={0.6} />
                  </mesh>
                </group>
              ))}
            </group>,
            handRSocket
          )}
        </React.Fragment>
      )}

      {/* Gắn 3 nén hương đỏ phát sáng vào chest_socket khi lễ Phật */}
      {chestSocket && (
        <React.Fragment key="portal-incense">
          {createPortal(
            <group
              ref={incensePropRef as unknown as React.Ref<THREE.Group>}
              position={[0, -0.182, 0.12]}
              visible={currentActionRef.current === 'praying'}
            >
              {[-0.012, 0, 0.012].map((offsetX, idx) => (
                <group
                  key={idx}
                  position={[offsetX, 0, 0]}
                  rotation={[0, 0, (idx - 1) * -0.025]}
                >
                  <mesh position={[0, 0.16, 0]} castShadow>
                    <cylinderGeometry args={[0.007, 0.007, 0.32, 10]} />
                    <meshStandardMaterial color="#dc2626" roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 0.33, 0]}>
                    <sphereGeometry args={[0.016, 12, 12]} />
                    <meshBasicMaterial color="#fb923c" />
                  </mesh>
                  <mesh position={[0, 0.345, 0]}>
                    <sphereGeometry args={[0.009, 10, 10]} />
                    <meshBasicMaterial color="#fef08a" />
                  </mesh>
                </group>
              ))}
            </group>,
            chestSocket
          )}
        </React.Fragment>
      )}

      {/* 6 chấm giới hương Ba-la-đề-mộc-xoa trên đỉnh đầu */}
      {headSocket && (
        <React.Fragment key="portal-precepts">
          {createPortal(
            <group>
              {[
                [-0.042, -0.024, 0.07],
                [0, -0.017, 0.07],
                [0.042, -0.024, 0.07],
                [-0.042, -0.007, 0.015],
                [0, 0, 0.015],
                [0.042, -0.007, 0.015],
              ].map(([dx, dy, dz], idx) => (
                <mesh key={idx} position={[dx, dy, dz]}>
                  <sphereGeometry args={[0.006, 8, 6]} />
                  <meshStandardMaterial color="#ca8a04" roughness={0.7} />
                </mesh>
              ))}
            </group>,
            headSocket
          )}
        </React.Fragment>
      )}
    </group>
  );
};

export const MonkWoodenFishProp = React.forwardRef<THREE.Group, { visible: boolean }>(({ visible }, ref) => (
      <group
        ref={ref}
        position={[0, 0, 0.54]}
        visible={visible}
      >
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow><cylinderGeometry args={[0.18, 0.22, 0.6, 12]} /><meshStandardMaterial color="#78350f" roughness={0.75} /></mesh>
        <group position={[0, 0.6, 0]}>
        {/* Đệm lót mõ bằng vải gấm vàng */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.25, 0.1, 20]} />
          <meshStandardMaterial color="#d97706" roughness={0.8} />
        </mesh>
        {/* Thân mõ gỗ sơn đỏ bóng */}
        <mesh position={[0, 0.18, 0]} scale={[1.15, 0.88, 1]} castShadow>
          <sphereGeometry args={[0.16, 20, 16]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.35} metalness={0.1} />
        </mesh>
        {/* Khe khắc miệng mõ */}
        <mesh position={[0, 0.17, 0.13]}>
          <boxGeometry args={[0.22, 0.03, 0.08]} />
          <meshStandardMaterial color="#450a0a" roughness={0.9} />
        </mesh>
        </group>
      </group>
));

const MonkAvatarComponent: React.FC<MonkAvatarProps> = ({
  monkName,
  robeColor,
  meritPoints = 0,
  position = DEFAULT_POSITION,
  rotationY = 0,
  actionState = 'idle',
  transformRef,
  chatBubble = null,
  isLocalPlayer = false,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const labelAnchorRef = useRef<THREE.Group>(null);
  const labelRef = useWorldLabel(labelAnchorRef, isLocalPlayer ? 14 : 18);
  const previousPositionRef = useRef<THREE.Vector3 | null>(null);
  const walkPhaseRef = useRef(0);
  const currentActionRef = useRef<MonkActionState>(actionState);

  // Refs cho các đạo cụ 3D theo trạng thái hành động
  const incensePropRef = useRef<THREE.Group>(null!);
  const woodenFishFloorPropRef = useRef<THREE.Group>(null!);
  const woodenFishStickPropRef = useRef<THREE.Group>(null!);
  const fortuneTubePropRef = useRef<THREE.Group>(null!);
  const localHaloRef = useRef<THREE.Mesh>(null);

  const trimColor = useMemo(() => kasayaTrimColor(robeColor), [robeColor]);

  useFrame((state, delta) => {
    const root = groupRef.current;
    if (!root) return;

    const t = state.clock.getElapsedTime();
    delta = motionDelta(delta);

    // 1. Đọc vị trí, góc xoay và trạng thái hành động từ transformRef (60fps zero-re-render) hoặc từ props
    const activeTransform = transformRef?.current;
    const targetPos = activeTransform ? activeTransform.position : position;
    const targetRotY = activeTransform ? activeTransform.rotationY : rotationY;
    let currentAction: MonkActionState = activeTransform
      ? activeTransform.actionState
      : actionState;

    if (activeTransform) {
      root.position.set(targetPos.x, targetPos.y, targetPos.z);
      root.rotation.y = targetRotY;
    } else {
      // Nội suy mượt cho các người chơi khác (remote players)
      const lerpFactor = 1 - Math.exp(-12 * delta);
      const next = resolveMovement(
        root.position.x,
        root.position.z,
        THREE.MathUtils.lerp(root.position.x, targetPos.x, lerpFactor),
        THREE.MathUtils.lerp(root.position.z, targetPos.z, lerpFactor)
      );
      root.position.x = next.x;
      root.position.z = next.z;
      root.position.y = getGroundHeight(next.x, next.z);

      // Nội suy góc xoay ngắn nhất
      let diff = targetRotY - root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      root.rotation.y += diff * lerpFactor;
    }

    if (!previousPositionRef.current) previousPositionRef.current = root.position.clone();
    const travelled = Math.hypot(
      root.position.x - previousPositionRef.current.x,
      root.position.z - previousPositionRef.current.z
    );
    if (currentAction === 'walking') {
      if (travelled < 2 && displacementIsWalking(travelled, delta)) {
        walkPhaseRef.current = advanceWalkPhase(walkPhaseRef.current, travelled);
      } else {
        currentAction = 'idle';
      }
    }
    previousPositionRef.current.copy(root.position);
    currentActionRef.current = currentAction;

    // 2. Bật/tắt đạo cụ Mõ Gỗ trên sàn
    if (woodenFishFloorPropRef.current) {
      woodenFishFloorPropRef.current.visible = currentAction === 'wooden_fish';
    }

    // 3. Hiệu ứng nhịp thở cho vòng hào quang dưới chân người chơi chính
    if (localHaloRef.current) {
      const pulse = 1 + Math.sin(t * 2.5) * 0.05;
      localHaloRef.current.scale.set(pulse, pulse, 1);
    }
  }, -20);

  const showChatBubble = Boolean(chatBubble && chatBubble.expiresAt > Date.now());

  return (
    <group
      ref={groupRef}
      userData={{ cameraIgnore: true }}
      position={[position.x, position.y, position.z]}
      rotation={[0, rotationY, 0]}
    >
      {/* Vòng sáng tròn dịu nhẹ dưới chân cho người chơi chính (isLocalPlayer === true) */}
      {isLocalPlayer && (
        <group position={[0, 0.02, 0]}>
          <mesh ref={localHaloRef} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.48, 0.62, 36]} />
            <meshBasicMaterial
              color="#fbbf24"
              transparent
              opacity={0.75}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <circleGeometry args={[0.48, 32]} />
            <meshBasicMaterial color="#fef3c7" transparent opacity={0.22} />
          </mesh>
        </group>
      )}

      {/* Bóng đổ êm dưới chân */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>

      {/* Đạo cụ Mõ Gỗ Đỏ đặt phía trước mặt khi gõ mõ (wooden_fish) */}
      <MonkWoodenFishProp ref={woodenFishFloorPropRef} visible={actionState === 'wooden_fish'} />

      {/* Mô hình nhân vật 3D điêu khắc hữu cơ có xương (High-Poly Sculpted) bọc trong Suspense */}
      <FigureLoadBoundary resetKey="character-v2" fallback={<MonkAvatarFallback robeColor="#991b1b" failed />}><Suspense fallback={<MonkAvatarFallback robeColor={robeColor} />}>
        <MonkSkinnedMeshModel
          robeColor={robeColor}
          trimColor={trimColor}
          walkPhaseRef={walkPhaseRef}
          currentActionRef={currentActionRef}
          woodenFishStickPropRef={woodenFishStickPropRef}
          fortuneTubePropRef={fortuneTubePropRef}
          incensePropRef={incensePropRef}
        />
      </Suspense></FigureLoadBoundary>

      {/* Bảng Tên & Bong Bóng Chat 3D trên đầu */}
      <group ref={labelAnchorRef} position={[0, 2.35, 0]}>
        <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={labelRef}
            style={{ visibility: 'hidden' }}
            className="pointer-events-none select-none flex flex-col items-center gap-1.5 whitespace-nowrap transition-opacity duration-150"
          >
            {/* Bong bóng thoại nếu còn hiệu lực */}
            {showChatBubble && chatBubble && (
              <div className="relative max-w-[210px] whitespace-normal break-words rounded-2xl border border-amber-300/70 bg-amber-50/95 px-3 py-1.5 text-center text-[11px] font-medium text-amber-950 shadow-lg backdrop-blur-sm">
                <span>{chatBubble.text}</span>
                <div className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-amber-300/70 bg-amber-50/95" />
              </div>
            )}

            {/* Bảng tên Pháp danh & Công đức */}
            <div className="flex items-center max-w-[150px] gap-1 rounded-full border border-amber-400/40 bg-stone-950/80 px-2 py-1 text-[11px] text-amber-50 shadow-md backdrop-blur-md">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/50 shadow-sm"
                style={{ backgroundColor: robeColor }}
              />
              <span className="truncate font-semibold text-amber-100">
                {monkName}
              </span>
              {isLocalPlayer && (
                <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/40">
                  Bạn
                </span>
              )}
              <span className="ml-0.5 flex items-center gap-0.5 rounded-full bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                ✨ {meritPoints}
              </span>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
};

// Pre-load mô hình GLTF sẵn sàng tức thì trong bộ nhớ đệm
useGLTF.preload([figureAssetUrl('/models/figures/sample_monk.glb'), figureAssetUrl('/models/figures/sample_monk_lod1.glb')]);

export const MonkAvatar = React.memo<MonkAvatarProps>(MonkAvatarComponent);
export default MonkAvatar;
