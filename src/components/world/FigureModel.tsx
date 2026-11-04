import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createFigureInstance, figureAssetUrl, figureLodUrl, nextFigureLod } from '../../utils/figureAssets';
import { FigureLoadBoundary } from '../../utils/figureLoadBoundary';
import { useEnvironmentQuality } from './EnvironmentQuality';
import type { GraphicsQuality } from '../../types/game';

export interface FigureModelProps {
  modelUrl: string;
  lodUrl?: string;
  autoLod?: boolean;
  quality?: GraphicsQuality;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
  colorTint?: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

function FigurePlaceholder({ failed = false }: { failed?: boolean }) {
  return <group userData={{ figureLoadState: failed ? 'error' : 'loading' }}>
    <mesh position={[0, 0.5, 0]}>
      <capsuleGeometry args={[0.2, 0.6, 3, 8]} />
      <meshStandardMaterial color={failed ? '#9f4337' : '#c5b99c'} roughness={0.9} wireframe />
    </mesh>
    {failed && <Html center position={[0, 1.15, 0]}><span className="rounded bg-stone-900/90 px-2 py-1 text-xs text-amber-100 whitespace-nowrap">Không tải được model</span></Html>}
  </group>;
}

function LoadedFigure(props: FigureModelProps) {
  const { modelUrl, lodUrl, autoLod = true, castShadow = true, receiveShadow = true, colorTint, metalness, roughness, emissive, emissiveIntensity } = props;
  const { quality } = useEnvironmentQuality();
  const root = useRef<THREE.Group>(null);
  const metadata = useMemo(() => ({ figureModel: modelUrl, figureLod: 0 }), [modelUrl]);
  const activeLod = useRef<0 | 1>(0);
  const worldPosition = useMemo(() => new THREE.Vector3(), []);
  const worldScale = useMemo(() => new THREE.Vector3(), []);
  const urls = useMemo(() => [figureAssetUrl(modelUrl), ...(autoLod ? [figureAssetUrl(lodUrl ?? figureLodUrl(modelUrl))] : [])], [modelUrl, lodUrl, autoLod]);
  const sources = useGLTF(urls);
  const instances = useMemo(() => sources.map(({ scene }, index) => {
    const instance = createFigureInstance(scene);
    // Occlusion uses a stable LOD0 surface. The collision cache intentionally
    // includes hidden meshes, so it must not also collect the alternate LOD.
    if (index > 0) instance.scene.userData.cameraIgnore = true;
    instance.setVisible(index === 0);
    return instance;
  }), [sources]);
  useEffect(() => () => instances.forEach((instance) => instance.dispose()), [instances]);
  useEffect(() => {
    instances.forEach((instance) => instance.meshes.forEach((mesh) => {
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        material.vertexColors = Boolean(mesh.geometry.getAttribute('color'));
        if (colorTint) material.color.set(colorTint);
        if (metalness !== undefined) material.metalness = metalness;
        if (roughness !== undefined) material.roughness = roughness;
        if (emissive) material.emissive.set(emissive);
        if (emissiveIntensity !== undefined) material.emissiveIntensity = emissiveIntensity;
      });
    }));
    activeLod.current = 0;
    instances.forEach((instance, i) => instance.setVisible(i === 0));
  }, [instances, castShadow, receiveShadow, colorTint, metalness, roughness, emissive, emissiveIntensity]);
  useFrame(({ camera }) => {
    if (!root.current || instances.length < 2) return;
    root.current.getWorldPosition(worldPosition);
    root.current.getWorldScale(worldScale);
    const next = nextFigureLod(activeLod.current, camera.position.distanceTo(worldPosition), props.quality ?? quality, Math.max(worldScale.x, worldScale.y, worldScale.z));
    root.current.userData.figureLod = next;
    if (next === activeLod.current) return;
    activeLod.current = next;
    instances.forEach((instance, i) => instance.setVisible(i === next));
  });
  return <group ref={root} dispose={null} userData={metadata}>
    {instances.map((instance, i) => <primitive key={urls[i]} object={instance.scene} dispose={null} />)}
  </group>;
}

/** Supports static and rigged GLBs; geometry stays cached while materials are instance-owned. */
export const FigureModel: React.FC<FigureModelProps> = (props) => <group position={props.position} rotation={props.rotation} scale={props.scale}>
  <FigureLoadBoundary resetKey={props.modelUrl} fallback={<FigurePlaceholder failed />}>
    <Suspense fallback={<FigurePlaceholder />}><LoadedFigure {...props} /></Suspense>
  </FigureLoadBoundary>
</group>;

export default FigureModel;
