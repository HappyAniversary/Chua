import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnvironmentQuality } from './EnvironmentQuality';
import { StableDetail } from './StableDetail';
import {
  getLacquerWoodTexture,
  getRoofTileTexture,
} from '../../utils/proceduralTextures';

export type PagodaRoofRidgeType = 'pagoda' | 'gate' | 'stupa';

export interface CurvedPagodaRoofHighPolyProps {
  position?: [number, number, number];
  width: number;
  depth: number;
  height: number;
  tiers?: number;
  tileColor?: string;
  trimColor?: string;
  ridgeType?: PagodaRoofRidgeType;
}

/**
 * Sinh cấu trúc BufferGeometry mặt mái cong Parabolic / Catenary Á Đông
 * Mép mái võng tự nhiên ở giữa và 4 góc đao vểnh cao ra ngoài (mái đao cong võng).
 * 4 mặt mái (Nam, Bắc, Đông, Tây) khớp nhau tuyệt đối tại các cạnh sống bờ đao.
 */
export function createCurvedPagodaRoofGeometry(
  width: number,
  depth: number,
  height: number,
  segmentsU = 16,
  segmentsV = 10
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const wTop = width * 0.44;
  const dTop = depth * 0.08;
  const cornerFlare = 0.12;
  const cornerLift = height * 0.24;
  const eaveSag = -height * 0.08;
  const slopeSag = -height * 0.14;

  let baseIndex = 0;

  // 1. MẶT NAM (South: nhìn từ +Z về -Z)
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const xNorm = (u - 0.5) * 2; // -1 -> +1
    const flare = Math.pow(Math.abs(xNorm), 2.2);

    const xBot = xNorm * (width / 2) * (1 + cornerFlare * flare);
    const zBot = (depth / 2) * (1 + cornerFlare * flare);
    const yBot = flare * cornerLift + (1 - flare) * eaveSag;

    const xTop = (u - 0.5) * wTop;
    const zTop = dTop / 2;
    const yTop = height + (flare * 0.05 - 0.025) * height;

    for (let j = 0; j <= segmentsV; j++) {
      const v = j / segmentsV; // 0 (eave) -> 1 (ridge)
      const t = v;
      const x = xBot * (1 - t) + xTop * t;
      const z = zBot * (1 - t) + zTop * t;
      const y =
        yBot * (1 - t) +
        yTop * t +
        Math.sin(Math.PI * t) * slopeSag * (1 - 0.45 * flare);

      positions.push(x, y, z);
      // One atlas spans 2.8m (eight 35cm tiles), with repeat=1.
      uvs.push(u * (width / 2.8), v * (Math.hypot(depth * 0.46, height) / 2.8));
    }
  }

  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const v00 = baseIndex + i * (segmentsV + 1) + j;
      const v10 = baseIndex + (i + 1) * (segmentsV + 1) + j;
      const v01 = baseIndex + i * (segmentsV + 1) + (j + 1);
      const v11 = baseIndex + (i + 1) * (segmentsV + 1) + (j + 1);

      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }
  baseIndex += (segmentsU + 1) * (segmentsV + 1);

  // 2. MẶT BẮC (North: nhìn từ -Z về +Z)
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const xNorm = (0.5 - u) * 2; // +1 -> -1 (để normal hướng ra ngoài -Z)
    const flare = Math.pow(Math.abs(xNorm), 2.2);

    const xBot = xNorm * (width / 2) * (1 + cornerFlare * flare);
    const zBot = -(depth / 2) * (1 + cornerFlare * flare);
    const yBot = flare * cornerLift + (1 - flare) * eaveSag;

    const xTop = (0.5 - u) * wTop;
    const zTop = -dTop / 2;
    const yTop = height + (flare * 0.05 - 0.025) * height;

    for (let j = 0; j <= segmentsV; j++) {
      const v = j / segmentsV;
      const t = v;
      const x = xBot * (1 - t) + xTop * t;
      const z = zBot * (1 - t) + zTop * t;
      const y =
        yBot * (1 - t) +
        yTop * t +
        Math.sin(Math.PI * t) * slopeSag * (1 - 0.45 * flare);

      positions.push(x, y, z);
      // One atlas spans 2.8m (eight 35cm tiles), with repeat=1.
      uvs.push(u * (width / 2.8), v * (Math.hypot(depth * 0.46, height) / 2.8));
    }
  }

  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const v00 = baseIndex + i * (segmentsV + 1) + j;
      const v10 = baseIndex + (i + 1) * (segmentsV + 1) + j;
      const v01 = baseIndex + i * (segmentsV + 1) + (j + 1);
      const v11 = baseIndex + (i + 1) * (segmentsV + 1) + (j + 1);

      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }
  baseIndex += (segmentsU + 1) * (segmentsV + 1);

  // 3. MẶT ĐÔNG (East: nhìn từ +X về -X)
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const zNorm = (0.5 - u) * 2; // +1 (+Z) -> -1 (-Z)
    const flare = Math.pow(Math.abs(zNorm), 2.2);

    const zBot = zNorm * (depth / 2) * (1 + cornerFlare * flare);
    const xBot = (width / 2) * (1 + cornerFlare * flare);
    const yBot = flare * cornerLift + (1 - flare) * eaveSag;

    const zTop = zNorm * (dTop / 2);
    const xTop = wTop / 2;
    const yTop = height + (flare * 0.05 - 0.025) * height;

    for (let j = 0; j <= segmentsV; j++) {
      const v = j / segmentsV;
      const t = v;
      const x = xBot * (1 - t) + xTop * t;
      const z = zBot * (1 - t) + zTop * t;
      const y =
        yBot * (1 - t) +
        yTop * t +
        Math.sin(Math.PI * t) * slopeSag * (1 - 0.45 * flare);

      positions.push(x, y, z);
      uvs.push(u * (depth / 2.8), v * (Math.hypot(width * 0.28, height) / 2.8));
    }
  }

  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const v00 = baseIndex + i * (segmentsV + 1) + j;
      const v10 = baseIndex + (i + 1) * (segmentsV + 1) + j;
      const v01 = baseIndex + i * (segmentsV + 1) + (j + 1);
      const v11 = baseIndex + (i + 1) * (segmentsV + 1) + (j + 1);

      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }
  baseIndex += (segmentsU + 1) * (segmentsV + 1);

  // 4. MẶT TÂY (West: nhìn từ -X về +X)
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const zNorm = (u - 0.5) * 2; // -1 (-Z) -> +1 (+Z)
    const flare = Math.pow(Math.abs(zNorm), 2.2);

    const zBot = zNorm * (depth / 2) * (1 + cornerFlare * flare);
    const xBot = -(width / 2) * (1 + cornerFlare * flare);
    const yBot = flare * cornerLift + (1 - flare) * eaveSag;

    const zTop = zNorm * (dTop / 2);
    const xTop = -wTop / 2;
    const yTop = height + (flare * 0.05 - 0.025) * height;

    for (let j = 0; j <= segmentsV; j++) {
      const v = j / segmentsV;
      const t = v;
      const x = xBot * (1 - t) + xTop * t;
      const z = zBot * (1 - t) + zTop * t;
      const y =
        yBot * (1 - t) +
        yTop * t +
        Math.sin(Math.PI * t) * slopeSag * (1 - 0.45 * flare);

      positions.push(x, y, z);
      uvs.push(u * (depth / 2.8), v * (Math.hypot(width * 0.28, height) / 2.8));
    }
  }

  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const v00 = baseIndex + i * (segmentsV + 1) + j;
      const v10 = baseIndex + (i + 1) * (segmentsV + 1) + j;
      const v01 = baseIndex + i * (segmentsV + 1) + (j + 1);
      const v11 = baseIndex + (i + 1) * (segmentsV + 1) + (j + 1);

      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

/**
 * Tạo đường cong CatmullRom 3D cho Đầu Đao uốn lượn vểnh lên cao tại 4 góc mái chùa
 */
export function createCornerEaveCurve(
  sx: number,
  sz: number,
  width: number,
  depth: number,
  height: number
): THREE.CatmullRomCurve3 {
  const cornerFlare = 0.12;
  const cornerLift = height * 0.24;

  const xCorner = sx * (width / 2) * (1 + cornerFlare);
  const zCorner = sz * (depth / 2) * (1 + cornerFlare);
  const yCorner = cornerLift;

  // Hướng chéo góc ra ngoài
  const dirX = sx * 0.7071;
  const dirZ = sz * 0.7071;

  const points = [
    // Điểm 0: Nằm trên đường sống mái bờ đao trước khi tới góc
    new THREE.Vector3(
      xCorner - dirX * 0.65,
      yCorner + height * 0.12,
      zCorner - dirZ * 0.65
    ),
    // Điểm 1: Mũi góc mép ngói
    new THREE.Vector3(xCorner, yCorner, zCorner),
    // Điểm 2: Vươn ra ngoài và hơi ngóc lên
    new THREE.Vector3(
      xCorner + dirX * 0.42,
      yCorner + height * 0.1,
      zCorner + dirZ * 0.42
    ),
    // Điểm 3: Uốn cong vểnh lên cao
    new THREE.Vector3(
      xCorner + dirX * 0.72,
      yCorner + height * 0.38,
      zCorner + dirZ * 0.72
    ),
    // Điểm 4: Đầu đao vút lên cao uyển chuyển hướng thiên
    new THREE.Vector3(
      xCorner + dirX * 0.82,
      yCorner + height * 0.72,
      zCorner + dirZ * 0.82
    ),
    // Điểm 5: Chóp đao cuộn nhẹ vào trong như ngọn lửa / mây rồng
    new THREE.Vector3(
      xCorner + dirX * 0.68,
      yCorner + height * 0.95,
      zCorner + dirZ * 0.68
    ),
  ];

  return new THREE.CatmullRomCurve3(points);
}

/**
 * Tạo đường cong sống mái bờ đao (hip ridge) từ nóc xuống 4 góc mái
 */
export function createHipRidgeCurve(
  sx: number,
  sz: number,
  width: number,
  depth: number,
  height: number
): THREE.CatmullRomCurve3 {
  const wTop = width * 0.44;
  const dTop = depth * 0.08;
  const cornerFlare = 0.12;
  const cornerLift = height * 0.24;

  const xTop = sx * (wTop / 2);
  const zTop = sz * (dTop / 2);
  const yTop = height;

  const xCorner = sx * (width / 2) * (1 + cornerFlare);
  const zCorner = sz * (depth / 2) * (1 + cornerFlare);
  const yCorner = cornerLift;

  const points: THREE.Vector3[] = [];
  const steps = 6;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps; // 0 at ridge -> 1 at corner
    const x = xTop * (1 - t) + xCorner * t;
    const z = zTop * (1 - t) + zCorner * t;
    // Độ cong võng tự nhiên theo sườn mái
    const y =
      yTop * (1 - t) +
      yCorner * t -
      Math.sin(Math.PI * t) * (height * 0.12);
    points.push(new THREE.Vector3(x, y, z));
  }

  return new THREE.CatmullRomCurve3(points);
}

export function setRoofInstanceTransforms(
  mesh: THREE.InstancedMesh,
  transforms: ReadonlyArray<{ pos: [number, number, number]; rot: [number, number, number] }>,
  childOffset: [number, number, number] = [0, 0, 0]
): void {
  const parent = new THREE.Object3D();
  const local = new THREE.Matrix4().makeTranslation(...childOffset);
  const matrix = new THREE.Matrix4();
  transforms.forEach(({ pos, rot }, index) => {
    parent.position.set(...pos);
    parent.rotation.set(...rot);
    parent.updateMatrix();
    mesh.setMatrixAt(index, matrix.multiplyMatrices(parent.matrix, local));
  });
  mesh.instanceMatrix.needsUpdate = true;
  // Cached bounds become stale whenever matrices change (Three r169).
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}

/**
 * Diềm ngói giọt nước (Diềm ngói 滴水) viền quanh mép mái chùa
 */
export function createDripTileTransforms(width: number, depth: number, height: number) {
  const items: Array<{
    pos: [number, number, number];
    rot: [number, number, number];
  }> = [];
  const cornerFlare = 0.12;
  const cornerLift = height * 0.24;
  const eaveSag = -height * 0.08;

  // Mặt Nam (+Z) & Mặt Bắc (-Z)
  const countX = 18;
  for (let i = 0; i <= countX; i++) {
    const u = i / countX;
    const xNorm = (u - 0.5) * 2;
    const flare = Math.pow(Math.abs(xNorm), 2.2);
    const x = xNorm * (width / 2) * (1 + cornerFlare * flare);
    const y = flare * cornerLift + (1 - flare) * eaveSag - 0.05;
    const zS = (depth / 2) * (1 + cornerFlare * flare) + 0.02;
    const zN = -((depth / 2) * (1 + cornerFlare * flare) + 0.02);

    // Nghiêng theo phương dốc mái
    items.push({
      pos: [x, y, zS],
      rot: [0.35, 0, xNorm * 0.18],
    });
    items.push({
      pos: [x, y, zN],
      rot: [-0.35, Math.PI, -xNorm * 0.18],
    });
  }

  // Mặt Đông (+X) & Mặt Tây (-X)
  const countZ = 12;
  for (let i = 1; i < countZ; i++) {
    const u = i / countZ;
    const zNorm = (u - 0.5) * 2;
    const flare = Math.pow(Math.abs(zNorm), 2.2);
    const z = zNorm * (depth / 2) * (1 + cornerFlare * flare);
    const y = flare * cornerLift + (1 - flare) * eaveSag - 0.05;
    const xE = (width / 2) * (1 + cornerFlare * flare) + 0.02;
    const xW = -((width / 2) * (1 + cornerFlare * flare) + 0.02);

    items.push({
      pos: [xE, y, z],
      rot: [zNorm * 0.18, -Math.PI / 2, 0.35],
    });
    items.push({
      pos: [xW, y, z],
      rot: [-zNorm * 0.18, Math.PI / 2, 0.35],
    });
  }

  return items;
}

const DrippingWaterTiles: React.FC<{
  width: number;
  depth: number;
  height: number;
  tileColor: string;
  trimColor: string;
}> = ({ width, depth, height, tileColor, trimColor }) => {
  const dripTiles = useMemo(() => createDripTileTransforms(width, depth, height), [width, depth, height]);
  const tileRef = useRef<THREE.InstancedMesh>(null);
  const goldRef = useRef<THREE.InstancedMesh>(null);
  const { detailDistance } = useEnvironmentQuality();
  useLayoutEffect(() => {
    if (tileRef.current) setRoofInstanceTransforms(tileRef.current, dripTiles);
    if (goldRef.current) setRoofInstanceTransforms(goldRef.current, dripTiles, [0, -0.07, 0]);
  }, [dripTiles]);

  return (
    <group name="dripping-tiles">
      <instancedMesh ref={tileRef} args={[undefined, undefined, dripTiles.length]} castShadow receiveShadow>
        <coneGeometry args={[0.075, 0.15, 4]} />
        <meshStandardMaterial color={tileColor} roughness={0.68} metalness={0.08} />
      </instancedMesh>
      <StableDetail distance={detailDistance * 0.45} radius={Math.hypot(width, depth) * 0.56}>
        <instancedMesh ref={goldRef} args={[undefined, undefined, dripTiles.length]}>
          <sphereGeometry args={[0.028, 8, 8]} />
          <meshStandardMaterial color={trimColor} metalness={0.7} roughness={0.3} transparent depthWrite={false} />
        </instancedMesh>
      </StableDetail>
    </group>
  );
};

/**
 * Đấu củng / Kẻ bẩy (Dou-gong) đỡ dưới hiên mái chùa Á Đông
 */
export function createBracketTransforms(width: number, depth: number) {
  const list: Array<{ pos: [number, number, number]; rotY: number }> = [];
  const countX = 8;
  const spacingX = (width * 0.8) / countX;
  for (let i = 0; i <= countX; i++) {
    const x = -width * 0.4 + i * spacingX;
    list.push({ pos: [x, -0.06, depth * 0.4], rotY: 0 });
    list.push({ pos: [x, -0.06, -depth * 0.4], rotY: Math.PI });
  }

  const countZ = 5;
  const spacingZ = (depth * 0.8) / countZ;
  for (let i = 1; i < countZ; i++) {
    const z = -depth * 0.4 + i * spacingZ;
    list.push({ pos: [width * 0.4, -0.06, z], rotY: -Math.PI / 2 });
    list.push({ pos: [-width * 0.4, -0.06, z], rotY: Math.PI / 2 });
  }
  return list.map(({ pos, rotY }) => ({ pos, rot: [0, rotY, 0] as [number, number, number] }));
}

const EaveBrackets: React.FC<{
  width: number;
  depth: number;
  woodTexture: THREE.CanvasTexture;
}> = ({ width, depth, woodTexture }) => {
  const brackets = useMemo(() => createBracketTransforms(width, depth), [width, depth]);
  const woodRef = useRef<THREE.InstancedMesh>(null);
  const goldRef = useRef<THREE.InstancedMesh>(null);
  const { detailDistance } = useEnvironmentQuality();
  useLayoutEffect(() => {
    if (woodRef.current) setRoofInstanceTransforms(woodRef.current, brackets, [0, 0, 0.22]);
    if (goldRef.current) setRoofInstanceTransforms(goldRef.current, brackets, [0, 0.08, 0.38]);
  }, [brackets]);

  return (
    <group name="eave-dougong-brackets">
      <instancedMesh ref={woodRef} args={[undefined, undefined, brackets.length]} castShadow receiveShadow>
        <boxGeometry args={[0.18, 0.16, 0.48]} />
        <meshStandardMaterial map={woodTexture} color="#7f1d1d" roughness={0.55} metalness={0.08} />
      </instancedMesh>
      <StableDetail distance={detailDistance} radius={Math.hypot(width, depth) * 0.4}>
        <instancedMesh ref={goldRef} args={[undefined, undefined, brackets.length]}>
          <boxGeometry args={[0.32, 0.08, 0.18]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.65} roughness={0.32} transparent depthWrite={false} />
        </instancedMesh>
      </StableDetail>
    </group>
  );
};

/**
 * Đỉnh nóc & Họa tiết trang trí bờ nóc theo ridgeType
 */
export const PagodaRoofRidgeFinials: React.FC<{
  wTop: number;
  height: number;
  ridgeType: PagodaRoofRidgeType;
  trimColor: string;
}> = ({ wTop, height, ridgeType, trimColor }) => {
  const rotGroupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (rotGroupRef.current) {
      rotGroupRef.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <group position={[0, height + 0.24, 0]}>
      {ridgeType === 'pagoda' && (
        <group name="ridge-pagoda-crest">
          {/* Bệ sen vàng đỡ đỉnh nóc */}
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.55, 0.22, 16]} />
            <meshStandardMaterial
              color={trimColor}
              metalness={0.7}
              roughness={0.24}
            />
          </mesh>

          {/* Vòng Hào Quang Pháp Luân / Lưỡng Long chầu nguyệt */}
          <group ref={rotGroupRef} position={[0, 0.65, 0]}>
            <mesh castShadow>
              <torusGeometry args={[0.52, 0.07, 14, 32]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#f59e0b"
                emissiveIntensity={0.35}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            {/* Trục tâm Pháp Luân */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.16, 16]} />
              <meshStandardMaterial
                color="#fef08a"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            {/* 8 Nan Hoa Bát Chánh Đạo */}
            {Array.from({ length: 8 }, (_, idx) => (
              <mesh key={idx} rotation={[0, 0, (idx * Math.PI) / 4]}>
                <cylinderGeometry args={[0.032, 0.032, 0.98, 8]} />
                <meshStandardMaterial
                  color="#fde047"
                  metalness={0.75}
                  roughness={0.22}
                />
              </mesh>
            ))}
          </group>

          {/* Ngọn Bảo Châu phát sáng trên đỉnh bánh xe Pháp Luân */}
          <mesh position={[0, 1.34, 0]} castShadow>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fde047"
              emissiveIntensity={1.2}
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          {/* Hai rồng ngậm bờ nóc (Kìm nóc) hai đầu bờ nóc */}
          {[-wTop * 0.48, wTop * 0.48].map((kx, i) => (
            <group
              key={i}
              position={[kx, 0.12, 0]}
              rotation={[0, kx > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
            >
              <mesh castShadow>
                <coneGeometry args={[0.18, 0.6, 6]} />
                <meshStandardMaterial
                  color={trimColor}
                  metalness={0.72}
                  roughness={0.25}
                />
              </mesh>
              <mesh position={[0, 0.35, 0.08]} castShadow>
                <sphereGeometry args={[0.12, 12, 12]} />
                <meshStandardMaterial
                  color="#fde047"
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {ridgeType === 'gate' && (
        <group name="ridge-gate-crest">
          {/* Hồ Lô Cam Lộ vàng giữa nóc Cổng Tam Quan */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshStandardMaterial
              color={trimColor}
              metalness={0.75}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0, 0.62, 0]} castShadow>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color="#fde047"
              metalness={0.78}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0.92, 0]} castShadow>
            <coneGeometry args={[0.08, 0.36, 10]} />
            <meshStandardMaterial
              color="#fef08a"
              emissive="#f59e0b"
              emissiveIntensity={0.4}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
          {/* Kìm nóc chạm khắc hai đầu */}
          {[-wTop * 0.48, wTop * 0.48].map((kx, i) => (
            <mesh
              key={i}
              position={[kx, 0.16, 0]}
              rotation={[0, 0, kx > 0 ? -0.4 : 0.4]}
              castShadow
            >
              <coneGeometry args={[0.16, 0.54, 5]} />
              <meshStandardMaterial
                color={trimColor}
                metalness={0.7}
                roughness={0.26}
              />
            </mesh>
          ))}
        </group>
      )}

      {ridgeType === 'stupa' && (
        <group name="ridge-stupa-spire">
          {/* Bảo Tháp thu nhỏ 5 tầng trên nóc */}
          <mesh position={[0, 0.12, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.55, 0.24, 16]} />
            <meshStandardMaterial
              color={trimColor}
              metalness={0.72}
              roughness={0.22}
            />
          </mesh>
          <mesh position={[0, 0.36, 0]} castShadow>
            <sphereGeometry args={[0.35, 16, 14]} />
            <meshStandardMaterial
              color="#fbbf24"
              metalness={0.75}
              roughness={0.2}
            />
          </mesh>
          {/* Các tầng tương luân thu nhỏ */}
          {[
            { y: 0.68, r: 0.28 },
            { y: 0.86, r: 0.23 },
            { y: 1.02, r: 0.18 },
            { y: 1.16, r: 0.14 },
            { y: 1.28, r: 0.1 },
          ].map((ring, idx) => (
            <mesh key={idx} position={[0, ring.y, 0]} castShadow>
              <cylinderGeometry args={[ring.r, ring.r * 1.15, 0.08, 14]} />
              <meshStandardMaterial
                color="#fde047"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          ))}
          {/* Ngọc Như Ý trên chóp Tháp */}
          <mesh position={[0, 1.48, 0]} castShadow>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fbbf24"
              emissiveIntensity={1.4}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

/**
 * Một tầng mái đao cong High-Poly hoàn chỉnh
 */
export const CurvedPagodaRoofTier: React.FC<{
  position?: [number, number, number];
  width: number;
  depth: number;
  height: number;
  tileColor?: string;
  trimColor?: string;
  ridgeType?: PagodaRoofRidgeType;
  isTopTier?: boolean;
}> = ({
  position = [0, 0, 0],
  width,
  depth,
  height,
  tileColor = '#7c2d12',
  trimColor = '#f59e0b',
  ridgeType = 'pagoda',
  isTopTier = true,
}) => {
  const roofTexture = useMemo(() => getRoofTileTexture(1, 1), []);
  const woodTexture = useMemo(() => getLacquerWoodTexture(2, 6), []);

  // Geometry mặt mái cong Parabolic
  const roofGeometry = useMemo(
    () => createCurvedPagodaRoofGeometry(width, depth, height, 16, 10),
    [width, depth, height]
  );

  const corners: Array<[number, number]> = useMemo(
    () => [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ],
    []
  );

  // Đường cong cho 4 đầu đao góc
  const cornerEaveTubes = useMemo(() => {
    return corners.map(([sx, sz]) => {
      const curve = createCornerEaveCurve(sx, sz, width, depth, height);
      const tubeGeom = new THREE.TubeGeometry(curve, 24, 0.082, 8, false);
      const goldSpineGeom = new THREE.TubeGeometry(curve, 24, 0.038, 8, false);
      const tipPos = curve.getPoint(1);
      return { tubeGeom, goldSpineGeom, tipPos };
    });
  }, [corners, width, depth, height]);

  // Đường cong sống mái bờ đao (hip ridge)
  const hipRidgeTubes = useMemo(() => {
    return corners.map(([sx, sz]) => {
      const curve = createHipRidgeCurve(sx, sz, width, depth, height);
      return new THREE.TubeGeometry(curve, 18, 0.076, 8, false);
    });
  }, [corners, width, depth, height]);

  useEffect(() => () => {
    roofGeometry.dispose();
    hipRidgeTubes.forEach((geometry) => geometry.dispose());
    cornerEaveTubes.forEach(({ tubeGeom, goldSpineGeom }) => {
      tubeGeom.dispose();
      goldSpineGeom.dispose();
    });
  }, [roofGeometry, hipRidgeTubes, cornerEaveTubes]);

  const wTop = width * 0.44;

  return (
    <group position={position}>
      {/* 1. MẶT MÁI NGÓI CONG PARABOLIC HIGH-POLY */}
      <mesh geometry={roofGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          map={roofTexture}
          color={tileColor}
          roughness={0.7}
          metalness={0.06}
        />
      </mesh>

      {/* 2. SỐNG MÁI BỜ NÓC TRÊN ĐỈNH TẦNG */}
      <group position={[0, height + 0.08, 0]}>
        {/* Dầm nóc gỗ lim đỏ chạm trổ */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[wTop * 1.04, 0.26, 0.34]} />
          <meshStandardMaterial
            map={woodTexture}
            color="#7f1d1d"
            roughness={0.42}
            metalness={0.15}
          />
        </mesh>
        {/* Hàng ngói bò nóc hình trụ bán nguyệt */}
        <mesh
          position={[0, 0.16, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.16, 0.16, wTop * 1.03, 14]} />
          <meshStandardMaterial
            map={roofTexture}
            color={tileColor}
            roughness={0.55}
            metalness={0.18}
          />
        </mesh>
        {/* Đường gân vàng trang trí đỉnh bờ nóc */}
        <mesh position={[0, 0.31, 0]}>
          <boxGeometry args={[wTop * 1.02, 0.05, 0.14]} />
          <meshStandardMaterial
            color={trimColor}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      </group>

      {/* 3. BỐN ĐƯỜNG SỐNG MÁI BỜ ĐAO NỐI TỪ ĐỈNH XUỐNG 4 GÓC */}
      {hipRidgeTubes.map((geom, idx) => (
        <mesh key={`hip-${idx}`} geometry={geom} castShadow receiveShadow>
          <meshStandardMaterial
            color={tileColor}
            roughness={0.55}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* 4. BỐN ĐẦU ĐAO VỂNH CAO UỐN LƯỢN TẠI 4 GÓC MÁI */}
      {cornerEaveTubes.map((eave, idx) => (
        <group key={`corner-eave-${idx}`}>
          {/* Thân đao gốm ngói uốn cong 3D */}
          <mesh geometry={eave.tubeGeom} castShadow receiveShadow>
            <meshStandardMaterial
              color={tileColor}
              roughness={0.5}
              metalness={0.22}
            />
          </mesh>
          {/* Sống lưng mạ vàng dọc theo đầu đao */}
          <mesh
            geometry={eave.goldSpineGeom}
            position={[0, 0.04, 0]}
            castShadow
          >
            <meshStandardMaterial
              color={trimColor}
              metalness={0.78}
              roughness={0.2}
            />
          </mesh>
          {/* Ngọn lửa mạ vàng hoặc ngọc rồng tỏa sáng tại đỉnh đao */}
          <group position={eave.tipPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.13, 12, 12]} />
              <meshStandardMaterial
                color="#fde047"
                emissive="#f59e0b"
                emissiveIntensity={0.4}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0, 0.12, 0]} castShadow>
              <coneGeometry args={[0.07, 0.22, 6]} />
              <meshStandardMaterial
                color="#fef08a"
                emissive="#f59e0b"
                emissiveIntensity={0.5}
                metalness={0.85}
                roughness={0.18}
              />
            </mesh>
          </group>
        </group>
      ))}

      {/* 5. DIỀM NGÓI GIỌT NƯỚC VIỀN QUANH BỐN MÉP MÁI */}
      <DrippingWaterTiles
        width={width}
        depth={depth}
        height={height}
        tileColor={tileColor}
        trimColor={trimColor}
      />

      {/* 6. ĐẤU CỦNG KẺ BẨY ĐỠ DƯỚI BỤNG HIÊN */}
      <EaveBrackets width={width} depth={depth} woodTexture={woodTexture} />

      {/* 7. HỌA TIẾT TRANG TRÍ ĐỈNH NÓC (Chỉ hiển thị ở tầng thượng) */}
      {isTopTier && (
        <PagodaRoofRidgeFinials
          wTop={wTop}
          height={height}
          ridgeType={ridgeType}
          trimColor={trimColor}
        />
      )}
    </group>
  );
};

/**
 * Component chính: Mái Chùa Cong Võng High-Poly hỗ trợ 1, 2 hoặc 3 tầng mái đao
 * Tự động xếp chồng diêm và tạo cổ diêm gỗ lim thếp vàng ở giữa các tầng.
 */
export const CurvedPagodaRoofHighPoly: React.FC<
  CurvedPagodaRoofHighPolyProps
> = React.memo(
  ({
    position = [0, 0, 0] as [number, number, number],
    width,
    depth,
    height,
    tiers = 1,
    tileColor = '#7c2d12',
    trimColor = '#f59e0b',
    ridgeType = 'pagoda',
  }) => {
    const woodTexture = useMemo(() => getLacquerWoodTexture(2, 6), []);

    // 1 TẦNG MÁI ĐAO ĐƠN
    if (tiers <= 1) {
      return (
        <group position={position}>
          <CurvedPagodaRoofTier
            width={width}
            depth={depth}
            height={height}
            tileColor={tileColor}
            trimColor={trimColor}
            ridgeType={ridgeType}
            isTopTier
          />
        </group>
      );
    }

    // 2 TẦNG MÁI CHỒNG DIÊM
    if (tiers === 2) {
      const tier1Height = height * 0.48;
      const atticHeight = height * 0.22;
      const tier2Height = height * 0.44;

      const tier2Width = width * 0.74;
      const tier2Depth = depth * 0.74;

      return (
        <group position={position}>
          {/* Tầng 1 (Mái Hạ) */}
          <CurvedPagodaRoofTier
            position={[0, 0, 0]}
            width={width}
            depth={depth}
            height={tier1Height}
            tileColor={tileColor}
            trimColor={trimColor}
            ridgeType={ridgeType}
            isTopTier={false}
          />

          {/* Cổ diêm giữa tầng 1 và tầng 2 */}
          <group position={[0, tier1Height + atticHeight * 0.5, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry
                args={[width * 0.62, atticHeight, depth * 0.62]}
              />
              <meshStandardMaterial
                map={woodTexture}
                color="#7f1d1d"
                roughness={0.4}
                metalness={0.15}
              />
            </mesh>
            {/* Chấn song cửa sổ / hoa văn mạ vàng cổ diêm */}
            {[-depth * 0.315, depth * 0.315].map((zPos, zi) => (
              <mesh key={zi} position={[0, 0, zPos]}>
                <boxGeometry
                  args={[width * 0.58, atticHeight * 0.6, 0.04]}
                />
                <meshStandardMaterial
                  color={trimColor}
                  metalness={0.65}
                  roughness={0.3}
                />
              </mesh>
            ))}
          </group>

          {/* Tầng 2 (Mái Thượng) */}
          <CurvedPagodaRoofTier
            position={[0, tier1Height + atticHeight, 0]}
            width={tier2Width}
            depth={tier2Depth}
            height={tier2Height}
            tileColor={tileColor}
            trimColor={trimColor}
            ridgeType={ridgeType}
            isTopTier
          />
        </group>
      );
    }

    // 3 TẦNG MÁI ĐAO TAM TRÙNG THIỀM UY NGHIÊM (Đại Hùng Bảo Điện)
    const tier1Height = height * 0.34;
    const attic1Height = height * 0.16;
    const tier2Height = height * 0.3;
    const attic2Height = height * 0.15;
    const tier3Height = height * 0.28;

    const tier2Width = width * 0.81;
    const tier2Depth = depth * 0.81;

    const tier3Width = width * 0.62;
    const tier3Depth = depth * 0.62;

    const yAttic1 = tier1Height + attic1Height * 0.5;
    const yTier2 = tier1Height + attic1Height;
    const yAttic2 = yTier2 + tier2Height + attic2Height * 0.5;
    const yTier3 = yTier2 + tier2Height + attic2Height;

    return (
      <group position={position}>
        {/* TẦNG 1: MÁI HẠ */}
        <CurvedPagodaRoofTier
          position={[0, 0, 0]}
          width={width}
          depth={depth}
          height={tier1Height}
          tileColor={tileColor}
          trimColor={trimColor}
          ridgeType={ridgeType}
          isTopTier={false}
        />

        {/* CỔ DIÊM 1 */}
        <group position={[0, yAttic1, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[width * 0.7, attic1Height, depth * 0.7]} />
            <meshStandardMaterial
              map={woodTexture}
              color="#7f1d1d"
              roughness={0.4}
              metalness={0.15}
            />
          </mesh>
          {[-depth * 0.355, depth * 0.355].map((zPos, zi) => (
            <mesh key={zi} position={[0, 0, zPos]}>
              <boxGeometry
                args={[width * 0.66, attic1Height * 0.62, 0.04]}
              />
              <meshStandardMaterial
                color={trimColor}
                metalness={0.65}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>

        {/* TẦNG 2: MÁI TRUNG */}
        <CurvedPagodaRoofTier
          position={[0, yTier2, 0]}
          width={tier2Width}
          depth={tier2Depth}
          height={tier2Height}
          tileColor={tileColor}
          trimColor={trimColor}
          ridgeType={ridgeType}
          isTopTier={false}
        />

        {/* CỔ DIÊM 2 */}
        <group position={[0, yAttic2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry
              args={[tier2Width * 0.68, attic2Height, tier2Depth * 0.68]}
            />
            <meshStandardMaterial
              map={woodTexture}
              color="#7f1d1d"
              roughness={0.4}
              metalness={0.15}
            />
          </mesh>
          {[-tier2Depth * 0.345, tier2Depth * 0.345].map((zPos, zi) => (
            <mesh key={zi} position={[0, 0, zPos]}>
              <boxGeometry
                args={[tier2Width * 0.64, attic2Height * 0.62, 0.04]}
              />
              <meshStandardMaterial
                color={trimColor}
                metalness={0.65}
                roughness={0.3}
              />
            </mesh>
          ))}
        </group>

        {/* TẦNG 3: MÁI THƯỢNG */}
        <CurvedPagodaRoofTier
          position={[0, yTier3, 0]}
          width={tier3Width}
          depth={tier3Depth}
          height={tier3Height}
          tileColor={tileColor}
          trimColor={trimColor}
          ridgeType={ridgeType}
          isTopTier
        />
      </group>
    );
  }
);

CurvedPagodaRoofHighPoly.displayName = 'CurvedPagodaRoofHighPoly';
