import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { FigureInstance } from './figureAssets';

const environments = new WeakMap<THREE.WebGLRenderer, { target: THREE.WebGLRenderTarget; users: number }>();

/** One local reflection probe per renderer, shared by all figure instances. */
export function useFigureLighting(instances: readonly FigureInstance[]) {
  const renderer = useThree((state) => state.gl);
  useEffect(() => {
    let environment = environments.get(renderer);
    if (!environment) {
      const room = new RoomEnvironment();
      const generator = new THREE.PMREMGenerator(renderer);
      environment = { target: generator.fromScene(room, 0.04), users: 0 };
      room.dispose();
      generator.dispose();
      environments.set(renderer, environment);
    }
    environment.users++;
    const texture = environment.target.texture;
    const assigned: Array<{ material: THREE.MeshStandardMaterial; previous: THREE.Texture | null }> = [];
    for (const instance of instances) for (const material of instance.materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      assigned.push({ material, previous: material.envMap });
      material.envMap = texture;
      material.envMapIntensity = material.metalness > 0.2 ? 0.75 : 0.28;
      material.needsUpdate = true;
    }
    return () => {
      for (const { material, previous } of assigned) if (material.envMap === texture) {
        material.envMap = previous;
        material.needsUpdate = true;
      }
      if (--environment.users === 0) {
        environment.target.dispose();
        environments.delete(renderer);
      }
    };
  }, [renderer, instances]);
}
