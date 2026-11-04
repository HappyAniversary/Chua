import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { GraphicsQuality } from '../../types/game';

export interface CanvasRenderSnapshot {
  capturedAt: string;
  quality: GraphicsQuality;
  frameIntervalMs: { p50: number; p95: number; p99: number; samples: number; over16_7Percent: number; over33_3Percent: number };
  /** Renderer counters belong to the latest completed render, not a GPU timer. */
  render: { frame: number; calls: number; triangles: number; lines: number; points: number };
  resources: { geometries: number; textures: number; programs: number };
  lights: { visible: number; point: number; budget: number };
  dpr: number;
  viewport: { width: number; height: number };
  userAgent: string;
  antialias: boolean | null;
  gpuTimeMs: number | null;
  gpuTiming: 'available' | 'pending' | 'disjoint' | 'N/A';
  gpuCapability: 'EXT_disjoint_timer_query_webgl2' | null;
}

declare global {
  interface Window { __templeRenderStats?: CanvasRenderSnapshot }
}

function percentile(sorted: number[], fraction: number) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : 0;
}

function ActiveCanvasRenderDiagnostics({ quality, lightBudget }: { quality: GraphicsQuality; lightBudget: number }) {
  const { gl, scene, size } = useThree();
  const overlay = useRef<HTMLPreElement | null>(null);
  const samples = useRef<number[]>([]);
  const lastFrame = useRef(0);
  const lastReport = useRef(0);
  const gpu = useRef({ supported: false, latest: null as number | null, disjoint: false, poll: () => {} });

  useEffect(() => {
    const context = gl.getContext();
    if (!('createQuery' in context)) { gpu.current.supported = false; return; }
    const extension = context.getExtension('EXT_disjoint_timer_query_webgl2') as {
      TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number;
    } | null;
    gpu.current.supported = extension !== null;
    if (!extension) return;
    const pending: WebGLQuery[] = [];
    const originalRender = gl.render;
    let insideRender = false;
    let stopped = false;
    const clearQueries = () => {
      for (const query of pending) context.deleteQuery(query);
      pending.length = 0;
      gpu.current.latest = null;
    };
    gpu.current.poll = () => {
      if (stopped || context.isContextLost()) return;
      gpu.current.disjoint = Boolean(context.getParameter(extension.GPU_DISJOINT_EXT));
      if (gpu.current.disjoint) { clearQueries(); return; }
      while (pending.length && context.getQueryParameter(pending[0], context.QUERY_RESULT_AVAILABLE)) {
        const query = pending.shift()!;
        const nanoseconds = Number(context.getQueryParameter(query, context.QUERY_RESULT));
        context.deleteQuery(query);
        if (Number.isFinite(nanoseconds) && nanoseconds >= 0) gpu.current.latest = nanoseconds / 1e6;
      }
    };
    const instrumentedRender: typeof gl.render = function (this: typeof gl, ...args) {
      // Measure the main Canvas scene, including its shadow pass. Nested or other
      // scene renders, existing external queries, and a slow GPU do not stack queries.
      let query: WebGLQuery | null = null;
      if (!stopped && gpu.current.supported && !insideRender && args[0] === scene && pending.length < 4 &&
          !context.isContextLost() && !gpu.current.disjoint &&
          context.getQuery(extension.TIME_ELAPSED_EXT, context.CURRENT_QUERY) === null) {
        query = context.createQuery();
        if (query) context.beginQuery(extension.TIME_ELAPSED_EXT, query);
      }
      const wasInside = insideRender;
      insideRender = true;
      try {
        return originalRender.apply(this, args);
      } finally {
        insideRender = wasInside;
        if (query) {
          context.endQuery(extension.TIME_ELAPSED_EXT);
          pending.push(query);
        }
      }
    };
    gl.render = instrumentedRender;
    const onContextLost = () => { clearQueries(); gpu.current.disjoint = true; };
    const onContextRestored = () => {
      gpu.current.supported = context.getExtension('EXT_disjoint_timer_query_webgl2') !== null;
      gpu.current.disjoint = false;
    };
    gl.domElement.addEventListener('webglcontextlost', onContextLost);
    gl.domElement.addEventListener('webglcontextrestored', onContextRestored);
    return () => {
      stopped = true;
      if (gl.render === instrumentedRender) gl.render = originalRender;
      gl.domElement.removeEventListener('webglcontextlost', onContextLost);
      gl.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      clearQueries();
      gpu.current.poll = () => {};
    };
  }, [gl, scene]);

  useEffect(() => {
    const element = document.createElement('pre');
    element.dataset.renderStats = 'canvas';
    element.setAttribute('aria-label', 'Canvas render diagnostics');
    element.style.cssText = 'position:absolute;top:8px;left:8px;z-index:20;pointer-events:none;margin:0;padding:8px 10px;background:rgba(9,15,29,.84);color:#d9f4e8;font:11px/1.5 monospace;border-radius:6px;white-space:pre-wrap;max-width:calc(100% - 16px)';
    element.textContent = 'Canvas: collecting frame intervals…\nGPU timing: N/A';
    gl.domElement.parentElement?.appendChild(element);
    overlay.current = element;
    const reset = () => {
      samples.current.length = 0;
      lastFrame.current = 0;
      lastReport.current = 0;
    };
    document.addEventListener('visibilitychange', reset);
    return () => {
      document.removeEventListener('visibilitychange', reset);
      element.remove();
      overlay.current = null;
      delete window.__templeRenderStats;
    };
  }, [gl]);

  useFrame(() => {
    if (document.hidden) return;
    gpu.current.poll();
    const now = performance.now();
    if (lastFrame.current) {
      samples.current.push(now - lastFrame.current);
      if (samples.current.length > 1200) samples.current.shift();
    }
    lastFrame.current = now;
    if (!lastReport.current) { lastReport.current = now; return; }
    if (now - lastReport.current < 1000 || samples.current.length < 2) return;
    lastReport.current = now;
    const sorted = samples.current.slice().sort((a, b) => a - b);
    samples.current.length = 0;
    let visibleLights = 0;
    let pointLights = 0;
    scene.traverseVisible((object) => {
      if ('isLight' in object) visibleLights += 1;
      if ('isPointLight' in object) pointLights += 1;
    });
    const snapshot: CanvasRenderSnapshot = {
      capturedAt: new Date().toISOString(),
      quality,
      frameIntervalMs: {
        p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99), samples: sorted.length,
        over16_7Percent: sorted.filter((value) => value > 16.7).length / sorted.length * 100,
        over33_3Percent: sorted.filter((value) => value > 33.3).length / sorted.length * 100,
      },
      render: { ...gl.info.render },
      resources: { ...gl.info.memory, programs: gl.info.programs?.length ?? 0 },
      lights: { visible: visibleLights, point: pointLights, budget: lightBudget },
      dpr: gl.getPixelRatio(),
      viewport: { width: size.width, height: size.height },
      userAgent: navigator.userAgent,
      antialias: gl.getContext().getContextAttributes()?.antialias ?? null,
      gpuTimeMs: gpu.current.latest,
      gpuTiming: !gpu.current.supported ? 'N/A' : gpu.current.disjoint ? 'disjoint' : gpu.current.latest === null ? 'pending' : 'available',
      gpuCapability: gpu.current.supported ? 'EXT_disjoint_timer_query_webgl2' : null,
    };
    window.__templeRenderStats = snapshot;
    if (overlay.current) {
      const interval = snapshot.frameIntervalMs;
      overlay.current.textContent = [
        `Canvas intervals ms (${interval.samples}): p50 ${interval.p50.toFixed(1)} | p95 ${interval.p95.toFixed(1)} | p99 ${interval.p99.toFixed(1)}`,
        `>16.7ms ${interval.over16_7Percent.toFixed(0)}% | >33.3ms ${interval.over33_3Percent.toFixed(0)}%`,
        `Last render: ${snapshot.render.calls} calls | ${snapshot.render.triangles.toLocaleString()} triangles`,
        `Resources: ${snapshot.resources.geometries} geometries | ${snapshot.resources.textures} textures | ${snapshot.resources.programs} programs`,
        `${quality} | DPR ${snapshot.dpr.toFixed(2)} | point lights ${pointLights}/${lightBudget} | GPU: ${snapshot.gpuTimeMs === null ? snapshot.gpuTiming : `${snapshot.gpuTimeMs.toFixed(2)} ms`}`,
      ].join('\n');
    }
    // This callback runs before Fiber renders. Reading the previous completed
    // renderer.info frame keeps the default render loop and its ordering intact.
  }, -100);
  return null;
}

/** Opt-in only: no DOM, scene traversal, global snapshot, or sampler when off. */
export function CanvasRenderDiagnostics(props: { quality: GraphicsQuality; lightBudget: number }) {
  const enabled = useMemo(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('renderStats') === '1', []);
  return enabled ? <ActiveCanvasRenderDiagnostics {...props} /> : null;
}
