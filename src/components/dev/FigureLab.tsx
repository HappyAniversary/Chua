import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, createPortal, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, Box, Layers, RotateCw } from 'lucide-react';
import type { FigureManifest, FigureManifestEntry } from '../../../scripts/figures/types';
import type { MonkActionState, RobeColor } from '../../types/game';
import { MonkSkinnedMeshModel, MonkWoodenFishProp } from '../player/MonkAvatar';
import { createFigureInstance, figureAssetUrl, kasayaTrimColor } from '../../utils/figureAssets';
import { FigureLoadBoundary } from '../../utils/figureLoadBoundary';

interface FigureLabProps { onBackToGame: () => void }
type Stats = { vertices: number; triangles: number; bones: number };
type PreviewAction = MonkActionState | 'none';
const EMPTY_STATS: Stats = { vertices: 0, triangles: 0, bones: 0 };
const ACTIONS: { id: PreviewAction; label: string }[] = [
  { id: 'none', label: 'Tư thế gốc' }, { id: 'idle', label: 'Đứng yên' },
  { id: 'walking', label: 'Bước đi' }, { id: 'praying', label: 'Lễ Phật' },
  { id: 'wooden_fish', label: 'Gõ mõ' }, { id: 'bell', label: 'Thỉnh chuông' },
  { id: 'fortune', label: 'Xin xăm' },
];
const ROBE_COLORS: RobeColor[] = ['#d97706', '#991b1b', '#78350f', '#4b5563', '#1e3a8a'];

function LabPlaceholder({ failed = false }: { failed?: boolean }) {
  return <group><mesh><boxGeometry args={[0.35, 0.6, 0.35]} /><meshStandardMaterial color={failed ? '#b45339' : '#78716c'} wireframe /></mesh>
    <Html center position={[0, 0.5, 0]}><span className="rounded bg-stone-900 px-3 py-2 text-xs text-amber-100 whitespace-nowrap">{failed ? 'Không tải được model — bấm Tải lại' : 'Đang tải model…'}</span></Html>
  </group>;
}

function StatueViewer({ modelUrl, wireframe, showSockets, showBounds, onStatsLoaded }: {
  modelUrl: string; wireframe: boolean; showSockets: boolean; showBounds: boolean; onStatsLoaded: (stats: Stats) => void;
}) {
  const { scene } = useGLTF(figureAssetUrl(modelUrl));
  const instance = useMemo(() => createFigureInstance(scene), [scene]);
  const helper = useMemo(() => showBounds ? new THREE.Box3Helper(instance.bounds, 0x38bdf8) : null, [instance, showBounds]);
  useEffect(() => () => instance.dispose(), [instance]);
  useEffect(() => () => {
    helper?.geometry.dispose();
    const material = helper?.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose()); else material?.dispose();
  }, [helper]);
  useEffect(() => { onStatsLoaded(instance.stats); }, [instance, onStatsLoaded]);
  useEffect(() => {
    instance.materials.forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) material.wireframe = wireframe;
    });
  }, [instance, wireframe]);
  return <group position={[0, -0.9, 0]} dispose={null}>
    <primitive object={instance.scene} dispose={null} />
    {helper && <primitive object={helper} dispose={null} />}
    {showSockets && [...instance.sockets].map(([name, socket]) => <React.Fragment key={name}>{createPortal(<axesHelper args={[0.14]} />, socket)}</React.Fragment>)}
  </group>;
}

/** Uses the actual game avatar, action driver, robe regions, sockets and hand props. */
function AvatarViewer({ action, lod, robeColor, wireframe, showSkeleton, showSockets, onStatsLoaded }: {
  action: PreviewAction; lod: 0 | 1; robeColor: RobeColor; wireframe: boolean; showSkeleton: boolean; showSockets: boolean; onStatsLoaded: (stats: Stats) => void;
}) {
  const currentActionRef = useRef<PreviewAction>(action);
  currentActionRef.current = action;
  const phase = useRef(0);
  const mallet = useRef<THREE.Group>(null);
  const tube = useRef<THREE.Group>(null);
  const incense = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { phase.current = clock.getElapsedTime() * 7; }, -20);
  return <group position={[0, -0.9, 0]}>
    <MonkWoodenFishProp visible={action === 'wooden_fish'} />
    <MonkSkinnedMeshModel robeColor={robeColor} trimColor={kasayaTrimColor(robeColor)} walkPhaseRef={phase} currentActionRef={currentActionRef}
      woodenFishStickPropRef={mallet} fortuneTubePropRef={tube} incensePropRef={incense}
      lodOverride={lod} wireframe={wireframe} showSkeleton={showSkeleton} showSockets={showSockets} onStatsLoaded={onStatsLoaded} />
  </group>;
}

export const FigureLab: React.FC<FigureLabProps> = ({ onBackToGame }) => {
  const [manifest, setManifest] = useState<FigureManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [selectedId, setSelectedId] = useState('sample_monk');
  const [lod, setLod] = useState<0 | 1>(0);
  const [wireframe, setWireframe] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [showSockets, setShowSockets] = useState(false);
  const [showBounds, setShowBounds] = useState(false);
  const [action, setAction] = useState<PreviewAction>('none');
  const [robeColor, setRobeColor] = useState<RobeColor>('#d97706');
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setManifestError(false);
    fetch(figureAssetUrl('/models/figures/manifest.json'))
      .then((response) => { if (!response.ok) throw new Error('manifest'); return response.json(); })
      .then((data: FigureManifest) => { if (active) setManifest(data); })
      .catch(() => { if (active) setManifestError(true); });
    return () => { active = false; };
  }, [reload]);
  const entry: FigureManifestEntry | undefined = manifest?.figures[selectedId];
  const isAvatar = selectedId === 'sample_monk';
  const modelUrl = (lod === 1 ? entry?.files.lod1 : entry?.files.lod0) ?? `/models/figures/${selectedId}${lod === 1 ? '_lod1' : ''}.glb`;
  useEffect(() => { setStats(EMPTY_STATS); setAction('none'); }, [selectedId]);
  const resetKey = `${selectedId}:${lod}:${reload}`;
  const retry = () => {
    useGLTF.clear(figureAssetUrl(modelUrl));
    useGLTF.clear([figureAssetUrl('/models/figures/sample_monk.glb'), figureAssetUrl('/models/figures/sample_monk_lod1.glb')]);
    setReload((value) => value + 1);
  };
  return <div className="relative w-screen h-screen bg-stone-950 text-amber-50 select-none overflow-hidden font-sans">
    <header className="absolute top-0 inset-x-0 z-30 p-3 flex items-center justify-between bg-stone-950/90 border-b border-amber-500/30">
      <div className="flex items-center gap-3"><button type="button" onClick={onBackToGame} className="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-200 text-xs flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Về chùa</button>
        <div><h1 className="text-sm font-bold">Xưởng model 3D</h1><p className="text-[11px] text-amber-200/60">{selectedId} · LOD{lod} · {stats.bones} xương</p></div></div>
      <div className="hidden sm:flex items-center gap-2 text-xs font-mono"><Layers className="w-4 h-4" />{stats.triangles.toLocaleString()} tris · {stats.vertices.toLocaleString()} verts</div>
    </header>
    <Canvas camera={{ position: [0, 0.35, 3.8], fov: 45 }}>
      <color attach="background" args={['#292524']} />
      <ambientLight intensity={0.9} /><directionalLight position={[4, 6, 5]} intensity={2.2} /><directionalLight position={[-4, 3, -3]} intensity={0.85} color="#e3edff" />
      <gridHelper args={[6, 12, '#a8a29e', '#44403c']} position={[0, -0.91, 0]} />
      <axesHelper args={[0.35]} position={[0, -0.9, 0]} />
      <FigureLoadBoundary key={reload} resetKey={resetKey} fallback={<LabPlaceholder failed />}>
        <Suspense fallback={<LabPlaceholder />}>
          {isAvatar ? <AvatarViewer action={action} lod={lod} robeColor={robeColor} wireframe={wireframe} showSkeleton={showSkeleton} showSockets={showSockets} onStatsLoaded={setStats} />
            : <StatueViewer modelUrl={modelUrl} wireframe={wireframe} showSockets={showSockets} showBounds={showBounds} onStatsLoaded={setStats} />}
        </Suspense>
      </FigureLoadBoundary>
      <OrbitControls target={[0, 0.05, 0]} minDistance={0.8} maxDistance={8} />
    </Canvas>
    <aside className="absolute top-20 right-3 z-20 w-64 max-w-[calc(100vw-1.5rem)] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl bg-stone-950/90 border border-amber-500/30 p-3 space-y-3">
      <label className="text-xs block">Model<select aria-label="Chọn model" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="block mt-1 w-full bg-stone-900 border border-stone-700 rounded p-2 text-xs">
        {manifest ? Object.values(manifest.figures).map((figure) => <option key={figure.id} value={figure.id}>{figure.name}</option>) : <option value="sample_monk">Nhân vật game</option>}
      </select></label>
      {manifestError && <p className="text-xs text-red-300">Không tải được danh sách model.</p>}
      <div className="flex gap-2">{([0, 1] as const).map((value) => <button key={value} type="button" onClick={() => setLod(value)} className={`flex-1 rounded px-3 py-2 text-xs ${lod === value ? 'bg-amber-500 text-stone-950' : 'bg-stone-800'}`}>LOD{value}</button>)}</div>
      <div className="text-[11px] text-stone-300">{stats.triangles.toLocaleString()} tam giác · {stats.vertices.toLocaleString()} đỉnh · {stats.bones} xương</div>
      <div className="space-y-2 border-t border-stone-700 pt-3">
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={wireframe} onChange={(event) => setWireframe(event.target.checked)} /><Box className="w-4 h-4" />Khung lưới</label>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={showSockets} onChange={(event) => setShowSockets(event.target.checked)} />Điểm neo đạo cụ</label>
        {isAvatar ? <label className="flex gap-2 text-xs"><input type="checkbox" checked={showSkeleton} onChange={(event) => setShowSkeleton(event.target.checked)} />Khung xương</label>
          : <label className="flex gap-2 text-xs"><input type="checkbox" checked={showBounds} onChange={(event) => setShowBounds(event.target.checked)} />Hộp bao</label>}
      </div>
      {isAvatar ? <><div className="border-t border-stone-700 pt-3"><p className="text-xs mb-2">Màu áo</p><div className="flex gap-2">{ROBE_COLORS.map((color) => <button key={color} type="button" aria-label={`Màu áo ${color}`} aria-pressed={robeColor === color} onClick={() => setRobeColor(color)} style={{ backgroundColor: color }} className={`w-8 h-8 rounded-full border-2 ${robeColor === color ? 'border-white' : 'border-transparent'}`} />)}</div></div>
        <div className="border-t border-stone-700 pt-3"><p className="text-xs mb-2">Cử động trong game</p><div className="grid grid-cols-2 gap-1.5">{ACTIONS.map((item) => <button key={item.id} type="button" onClick={() => setAction(item.id)} className={`rounded px-2 py-2 text-xs ${action === item.id ? 'bg-amber-500 text-stone-950' : 'bg-stone-800'}`}>{item.label}</button>)}</div></div></>
        : <p className="text-xs text-stone-400">Tượng trưng bày ở tư thế cố định.</p>}
      <button type="button" onClick={retry} className="flex items-center gap-2 text-xs text-amber-200"><RotateCw className="w-3 h-3" />Tải lại</button>
      <p className="text-[10px] text-stone-400">Kéo để xoay 360°; lăn chuột hoặc chụm hai ngón để thu phóng. Trục xanh dương là hướng trước.</p>
    </aside>
  </div>;
};
export default FigureLab;
