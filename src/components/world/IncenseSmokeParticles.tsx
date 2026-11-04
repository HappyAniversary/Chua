import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnvironmentQuality } from './EnvironmentQuality';

interface IncenseSmokeParticlesProps {
  origin: [number, number, number];
  particleCount?: number;
}

/** A single soft particle draw instead of one lit sphere/material per wisp. */
export function IncenseSmokeParticles({ origin, particleCount = 24 }: IncenseSmokeParticlesProps) {
  const { particleScale } = useEnvironmentQuality();
  const count = Math.max(4, Math.round(particleCount * particleScale));
  const resources = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(particleCount * 3), 3));
    geometry.setAttribute('particleOpacity', new THREE.Float32BufferAttribute(new Float32Array(particleCount), 1));
    geometry.setAttribute('particleSize', new THREE.Float32BufferAttribute(new Float32Array(particleCount), 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 2.5);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        smokeColor: { value: new THREE.Color('#ddd9cc') },
        pointScale: { value: 400 },
      },
      vertexShader: `
        uniform float pointScale;
        attribute float particleOpacity;
        attribute float particleSize;
        varying float vOpacity;
        #include <common>
        #include <fog_pars_vertex>
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vOpacity = particleOpacity;
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = clamp(particleSize * pointScale / max(0.1, -mvPosition.z), 1.0, 96.0);
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        uniform vec3 smokeColor;
        varying float vOpacity;
        #include <common>
        #include <fog_pars_fragment>
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.08, 0.5, radius)) * vOpacity;
          if (alpha < 0.003) discard;
          gl_FragColor = vec4(smokeColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });
    return { geometry, material };
  }, [particleCount]);

  useEffect(() => () => {
    resources.geometry.dispose();
    resources.material.dispose();
  }, [resources]);

  useFrame(({ clock, camera, gl, size }) => {
    const t = clock.getElapsedTime();
    const positions = resources.geometry.getAttribute('position') as THREE.BufferAttribute;
    const opacities = resources.geometry.getAttribute('particleOpacity') as THREE.BufferAttribute;
    const sizes = resources.geometry.getAttribute('particleSize') as THREE.BufferAttribute;
    const visibleCount = Math.min(particleCount, count);
    for (let i = 0; i < visibleCount; i++) {
      const phase = i / visibleCount;
      const progress = (t * (0.25 + (i % 4) * 0.04) + phase) % 1;
      const sway = (0.06 + (i % 3) * 0.035) * (0.4 + progress * 1.4);
      positions.setXYZ(i,
        ((i % 5) - 2) * 0.035 + Math.sin(t * 1.2 + phase * 12.6) * sway,
        progress * 2.35,
        ((Math.floor(i / 5) % 5) - 2) * 0.025 + Math.cos(t + phase * 9.4) * sway);
      opacities.setX(i, Math.min(1, progress * 5) * (1 - progress) * 0.28);
      sizes.setX(i, (0.14 + (i % 4) * 0.025) * (1 + progress * 2.4));
    }
    resources.geometry.setDrawRange(0, visibleCount);
    positions.needsUpdate = opacities.needsUpdate = sizes.needsUpdate = true;
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 50;
    resources.material.uniforms.pointScale.value = size.height * gl.getPixelRatio() / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  });

  return <points name="incense-smoke" position={origin} geometry={resources.geometry} material={resources.material} dispose={null} />;
}
