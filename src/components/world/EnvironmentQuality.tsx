import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useFrame, useThree, type ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import type { GraphicsQuality } from '../../types/game';
import { CanvasRenderDiagnostics } from './CanvasRenderDiagnostics';

export interface EnvironmentQuality {
  quality: GraphicsQuality;
  dpr: [number, number];
  shadowMapSize: number;
  pointLightBudget: number;
  anisotropy: number;
  particleScale: number;
  /** Maximum distance in world metres for small architectural details. */
  detailDistance: number;
}

export const ENVIRONMENT_QUALITY: Record<GraphicsQuality, EnvironmentQuality> = {
  low: { quality: 'low', dpr: [1, 1], shadowMapSize: 0, pointLightBudget: 2, anisotropy: 2, particleScale: 0.4, detailDistance: 18 },
  balanced: { quality: 'balanced', dpr: [1, 1.5], shadowMapSize: 1024, pointLightBudget: 4, anisotropy: 4, particleScale: 0.7, detailDistance: 28 },
  high: { quality: 'high', dpr: [1, 2], shadowMapSize: 2048, pointLightBudget: 6, anisotropy: 8, particleScale: 1, detailDistance: 40 },
};

type LightAnchor = {
  light: THREE.PointLight;
  priority: number;
  enabled: boolean;
  worldPosition: THREE.Vector3;
  score: number;
};

type QualityContextValue = {
  settings: EnvironmentQuality;
  anchors: Set<LightAnchor>;
};
const QualityContext = createContext<QualityContextValue | null>(null);

/** Legacy standalone scenes can use the same components without a provider. */
export function useEnvironmentQuality(): EnvironmentQuality {
  return useContext(QualityContext)?.settings ?? ENVIRONMENT_QUALITY.balanced;
}

export type BudgetPointLightProps = ThreeElements['pointLight'] & { priority?: number };

/**
 * Desired light in its original parent coordinate system. Hidden anchors are never
 * collected by WebGLRenderer; only the fixed visible pool below enters shaders.
 */
const RegisteredPointLight = forwardRef<THREE.PointLight, BudgetPointLightProps>(
  ({ priority = 1, visible = true, ...props }, forwardedRef) => {
    const context = useContext(QualityContext)!;
    const lightRef = useRef<THREE.PointLight>(null!);
    const anchor = useMemo<LightAnchor>(() => ({
      light: null!, priority, enabled: visible, worldPosition: new THREE.Vector3(), score: 0,
    }), []);
    anchor.priority = Math.max(0.01, priority);
    anchor.enabled = visible;
    useImperativeHandle(forwardedRef, () => lightRef.current);
    useLayoutEffect(() => {
      anchor.light = lightRef.current;
      context.anchors.add(anchor);
      return () => { context.anchors.delete(anchor); };
    }, [context.anchors, anchor]);
    return <pointLight {...props} ref={lightRef} visible={false} castShadow={false} />;
  }
);
RegisteredPointLight.displayName = 'RegisteredPointLight';

export const BudgetPointLight = forwardRef<THREE.PointLight, BudgetPointLightProps>(
  (props, ref) => {
    const context = useContext(QualityContext);
    if (context) return <RegisteredPointLight {...props} ref={ref} />;
    const { priority: _priority, ...lightProps } = props;
    return <pointLight {...lightProps} ref={ref} />;
  }
);
BudgetPointLight.displayName = 'BudgetPointLight';

type LightSlot = { light: THREE.PointLight | null; source: LightAnchor | null; next: LightAnchor | null };
type LightFocusRef = React.RefObject<{ position: { x: number; y: number; z: number } }>;

function PointLightPool({ anchors, count, focusPositionRef }: { anchors: Set<LightAnchor>; count: number; focusPositionRef?: LightFocusRef }) {
  const slots = useMemo<LightSlot[]>(() => Array.from({ length: count }, () => ({ light: null, source: null, next: null })), [count]);
  const timer = useRef(0.2);
  const cameraPosition = useMemo(() => new THREE.Vector3(), []);
  const candidates = useMemo<LightAnchor[]>(() => [], []);
  const selected = useMemo(() => new Set<LightAnchor>(), []);
  const claimed = useMemo(() => new Set<LightAnchor>(), []);

  // Runs after normal movement/camera callbacks, without taking over rendering.
  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.1);
    timer.current += dt;
    if (timer.current >= 0.2) {
      timer.current = 0;
      const focus = focusPositionRef?.current?.position;
      if (focus) cameraPosition.set(focus.x, focus.y, focus.z);
      else camera.getWorldPosition(cameraPosition);
      candidates.length = 0;
      for (const anchor of anchors) {
        if (!anchor.enabled || anchor.light.intensity <= 0) continue;
        let parent = anchor.light.parent;
        let isVisible = true;
        while (parent) {
          if (!parent.visible) { isVisible = false; break; }
          parent = parent.parent;
        }
        if (!isVisible) continue;
        anchor.light.getWorldPosition(anchor.worldPosition);
        const distanceSq = cameraPosition.distanceToSquared(anchor.worldPosition);
        const range = anchor.light.distance || 18;
        // Distant decorative lanterns keep their emissive material, not a slot.
        if (distanceSq > (range + 18) ** 2) continue;
        const retained = slots.some((slot) => slot.next === anchor);
        anchor.score = anchor.priority * (retained ? 1.25 : 1) / (1 + distanceSq / 36);
        candidates.push(anchor);
      }
      candidates.sort((a, b) => b.score - a.score);
      selected.clear();
      claimed.clear();
      for (let index = 0; index < Math.min(count, candidates.length); index += 1) selected.add(candidates[index]);
      // Keep a selected light in the same slot. A 25% ranking preference adds
      // hysteresis when walking around a boundary between two lanterns.
      for (const slot of slots) {
        if (slot.source && selected.has(slot.source)) {
          slot.next = slot.source;
          claimed.add(slot.source);
        } else {
          slot.next = null;
        }
      }
      for (const anchor of selected) {
        if (claimed.has(anchor)) continue;
        const slot = slots.find((candidate) => candidate.next === null);
        if (slot) { slot.next = anchor; claimed.add(anchor); }
      }
    }
    const blend = 1 - Math.exp(-dt * 7);
    for (const slot of slots) {
      const light = slot.light;
      if (!light) continue;
      if (slot.source !== slot.next) {
        light.intensity = THREE.MathUtils.lerp(light.intensity, 0, blend);
        if (light.intensity < 0.012) {
          light.intensity = 0;
          slot.source = slot.next;
          if (slot.source) light.color.copy(slot.source.light.color);
        }
      } else {
        const target = slot.source && anchors.has(slot.source) && slot.source.enabled ? slot.source.light.intensity : 0;
        light.intensity = THREE.MathUtils.lerp(light.intensity, target, blend);
      }
      if (slot.source) {
        // Parent transforms can animate; selected anchors follow without React state.
        if (anchors.has(slot.source)) slot.source.light.getWorldPosition(light.position);
        light.color.lerp(slot.source.light.color, blend);
        light.distance = slot.source.light.distance;
        light.decay = slot.source.light.decay;
      }
    }
  });

  return <>{slots.map((slot, index) => (
    <pointLight
      key={index}
      ref={(light) => { slot.light = light; }}
      name={`environment-light-slot-${index}`}
      intensity={0}
      castShadow={false}
    />
  ))}</>;
}

/** Applies sampler policy on scene/quality changes, never traverses per frame. */
function TextureQualityPolicy({ anisotropy }: { anisotropy: number }) {
  const { scene, gl } = useThree();
  useLayoutEffect(() => {
    const maximum = Math.max(1, Math.min(anisotropy, gl.capabilities.getMaxAnisotropy()));
    const observed = new Set<THREE.Object3D>();
    const pending = new Set<THREE.Object3D>();
    let scheduledFrame: number | null = null;
    let disposed = false;
    const applyTextures = (object: THREE.Object3D) => {
      const material = (object as THREE.Mesh).material;
      if (!material) return;
      for (const item of Array.isArray(material) ? material : [material]) {
        for (const value of Object.values(item)) {
          if (value instanceof THREE.Texture && value.anisotropy !== maximum) {
            value.anisotropy = maximum;
            value.needsUpdate = true;
          }
        }
      }
    };
    const scan = (root: THREE.Object3D) => {
      root.traverse((object) => {
        applyTextures(object);
        if (observed.has(object)) return;
        observed.add(object);
        object.addEventListener('childadded', onAdded);
        object.addEventListener('childremoved', onRemoved);
      });
    };
    const onAdded = (event: THREE.Object3DEventMap['childadded']) => {
      pending.add(event.child);
      if (scheduledFrame !== null) return;
      // Fiber attaches materials during the same commit. Scan after attachment.
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = null;
        if (disposed) return;
        for (const root of pending) scan(root);
        pending.clear();
      });
    };
    const onRemoved = (event: THREE.Object3DEventMap['childremoved']) => {
      event.child.traverse((object) => {
        observed.delete(object);
        object.removeEventListener('childadded', onAdded);
        object.removeEventListener('childremoved', onRemoved);
      });
      pending.delete(event.child);
    };
    scan(scene);
    return () => {
      disposed = true;
      if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
      for (const object of observed) {
        object.removeEventListener('childadded', onAdded);
        object.removeEventListener('childremoved', onRemoved);
      }
    };
  }, [scene, gl, anisotropy]);
  return null;
}

/**
 * Prepares material variants even in hidden/culled detail groups. Three r169's
 * compile() traverses all meshes, while collecting only visible lights, so this
 * does not reveal distant decoration or accidentally compile anchor lights.
 */
export function EnvironmentShaderWarmup({ topologyKey }: { topologyKey: string }) {
  const { gl, scene, camera } = useThree();
  const { quality } = useEnvironmentQuality();
  const scheduler = useMemo(() => {
    let disposed = false;
    let running = false;
    let scheduledFrame: number | null = null;
    let requested = '';
    let completed = '';

    const schedule = () => {
      if (disposed || running || scheduledFrame !== null || requested === completed) return;
      // Wait for child layout effects, the texture policy and the first renderer
      // setup. A second frame also accommodates Canvas shadow configuration.
      scheduledFrame = requestAnimationFrame(() => {
        scheduledFrame = requestAnimationFrame(() => {
          scheduledFrame = null;
          if (disposed || gl.getContext().isContextLost()) return;
          const compiling = requested;
          running = true;
          // Promise.resolve also catches a synchronous failure from compileAsync.
          void Promise.resolve()
            .then(() => {
              if (!disposed) return gl.compileAsync(scene, camera);
            })
            .catch((error: unknown) => {
              if (!disposed) console.warn('Environment shader preparation failed', error);
            })
            .finally(() => {
              running = false;
              completed = compiling;
              // Rapid quality/time changes are coalesced; never overlap jobs.
              if (!disposed) schedule();
            });
        });
      });
    };
    return {
      activate() { disposed = false; },
      request(key: string) { requested = key; schedule(); },
      restore() { completed = ''; schedule(); },
      dispose() {
        disposed = true;
        if (scheduledFrame !== null) cancelAnimationFrame(scheduledFrame);
        scheduledFrame = null;
      },
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    scheduler.activate();
    gl.domElement.addEventListener('webglcontextrestored', scheduler.restore);
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', scheduler.restore);
      scheduler.dispose();
    };
  }, [gl, scheduler]);
  useEffect(() => {
    scheduler.request(`${quality}:${topologyKey}`);
  }, [scheduler, quality, topologyKey]);
  return null;
}

export function EnvironmentQualityProvider({ quality, children, focusPositionRef }: PropsWithChildren<{ quality: GraphicsQuality; focusPositionRef?: LightFocusRef }>) {
  const anchors = useMemo(() => new Set<LightAnchor>(), []);
  const settings = ENVIRONMENT_QUALITY[quality];
  const value = useMemo(() => ({ settings, anchors }), [settings, anchors]);
  return <QualityContext.Provider value={value}>
    {children}
    <PointLightPool anchors={anchors} count={settings.pointLightBudget} focusPositionRef={focusPositionRef} />
    <TextureQualityPolicy anisotropy={settings.anisotropy} />
    <CanvasRenderDiagnostics quality={quality} lightBudget={settings.pointLightBudget} />
  </QualityContext.Provider>;
}
