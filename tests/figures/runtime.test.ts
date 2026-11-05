import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createFigureInstance, figureAssetUrl, figureLodUrl, nextFigureLod } from '../../src/utils/figureAssets';
import { createFigureAnimator, MONK_MALLET_ANGLE, MONK_MALLET_GRIP, MONK_MALLET_HEAD_Y, MONK_FORTUNE_ANGLE, MONK_FORTUNE_GRIP } from '../../src/utils/figureAnimation';

function fixture() {
  const source = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3], 3));
  geometry.setAttribute('_regionid', new THREE.Float32BufferAttribute([0, 1, 2], 1));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  material.map = new THREE.Texture();
  const mesh = new THREE.SkinnedMesh(geometry, material);
  const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 0.92;
  const spine = new THREE.Bone(); spine.name = 'Spine'; spine.position.y = 0.16;
  const chest = new THREE.Bone(); chest.name = 'Chest'; chest.position.y = 0.17;
  const head = new THREE.Bone(); head.name = 'Head'; head.position.y = 0.29;
  hips.add(spine); spine.add(chest); chest.add(head);
  const socket = new THREE.Object3D(); socket.name = 'head_socket'; socket.position.y = 0.28; head.add(socket);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 3), new THREE.MeshStandardMaterial({ color: '#231b15' }));
  eye.name = 'face_detail'; head.add(eye);
  mesh.add(hips); source.add(mesh); source.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([hips, spine, chest, head]));
  return { source, geometry, material, hips, mesh };
}

test('avatar clones isolate skeleton, materials and region colors in either creation order', () => {
  const source = fixture();
  const first = createFigureInstance(source.source, true);
  const second = createFigureInstance(source.source, true);
  assert.notEqual(first.meshes[0].geometry, second.meshes[0].geometry);
  assert.notEqual(first.meshes[0].material, second.meshes[0].material);
  assert.notEqual(first.bones.get('Hips'), second.bones.get('Hips'));
  first.recolorRobe('#991b1b', '#78350f');
  const before = Array.from(first.meshes[0].geometry.getAttribute('color').array);
  second.recolorRobe('#1e3a8a', '#1e293b');
  assert.deepEqual(Array.from(first.meshes[0].geometry.getAttribute('color').array), before);
  assert.deepEqual(Array.from(source.geometry.getAttribute('color').array), new Array(9).fill(Math.fround(0.3)));
  const colors = first.meshes[0].geometry.getAttribute('color');
  assert.equal(colors.getX(0), Math.fround(0.3), 'skin stays original even though every original RGB was identical');
  assert.equal(colors.getX(1), Math.fround(new THREE.Color('#991b1b').r));
  assert.equal(colors.getX(2), Math.fround(new THREE.Color('#78350f').r));
  assert.equal(source.geometry.userData.originalColors, undefined, 'cached geometry never receives an ownership flag');
  first.dispose(); second.dispose();
});

test('hiding the canonical body LOD leaves socket props visible through its bone hierarchy', () => {
  const source = fixture();
  const instance = createFigureInstance(source.source, true);
  const socket = instance.sockets.get('head_socket')!;
  const prop = new THREE.Mesh(new THREE.SphereGeometry(0.01), new THREE.MeshBasicMaterial());
  socket.add(prop);
  instance.setVisible(false);
  const body = instance.meshes[0] as THREE.SkinnedMesh;
  assert.equal((body.material as THREE.Material).visible, false, 'alternate body must not draw');
  assert.equal(instance.scene.getObjectByName('face_detail')!.visible, false, 'alternate face must not draw');
  for (let ancestor: THREE.Object3D | null = prop; ancestor; ancestor = ancestor.parent) {
    assert.equal(ancestor.visible, true, `${ancestor.name}: socket prop hidden by parent`);
  }
  instance.setVisible(true);
  assert.equal((body.material as THREE.Material).visible, true);
  assert.equal(instance.scene.getObjectByName('face_detail')!.visible, true);
  instance.dispose();
  prop.geometry.dispose();
  (prop.material as THREE.Material).dispose();
});

test('tailored robe recoloring preserves authored shading and never compounds it', () => {
  const source = fixture();
  const base = new THREE.Color('#d97706');
  const colors = source.geometry.getAttribute('color');
  colors.setXYZ(1, base.r * 0.7, base.g * 0.7, base.b * 0.7);
  source.mesh.userData.figureRecolor = { robe: '#d97706' };
  const instance = createFigureInstance(source.source, true);
  const target = new THREE.Color('#1e3a8a');
  instance.recolorRobe('#1e3a8a');
  const tinted = instance.meshes[0].geometry.getAttribute('color');
  const first = Array.from(tinted.array);
  for (const [slot, value] of [target.r, target.g, target.b].entries()) {
    assert.ok(Math.abs(tinted.getComponent(1, slot) - value * 0.7) < 1e-6);
  }
  instance.recolorRobe('#991b1b');
  instance.recolorRobe('#1e3a8a');
  assert.deepEqual(Array.from(tinted.array), first);
  assert.equal(colors.getX(1), Math.fround(base.r * 0.7));
  instance.dispose();
});

test('resource cleanup disposes only instance-owned data, without cloning on every recolor', () => {
  const source = fixture();
  let sourceGeometryDisposals = 0; let textureDisposals = 0; let ownedGeometryDisposals = 0; let ownedMaterialDisposals = 0;
  source.geometry.addEventListener('dispose', () => sourceGeometryDisposals++);
  source.material.map!.addEventListener('dispose', () => textureDisposals++);
  const instance = createFigureInstance(source.source, true);
  const originalMaterial = instance.meshes[0].material;
  instance.meshes[0].geometry.addEventListener('dispose', () => ownedGeometryDisposals++);
  instance.materials.forEach((material) => material.addEventListener('dispose', () => ownedMaterialDisposals++));
  for (let i = 0; i < 20; i++) instance.recolorRobe(i % 2 ? '#991b1b' : '#4b5563');
  assert.equal(instance.meshes[0].material, originalMaterial);
  const face = source.source.getObjectByName('face_detail') as THREE.Mesh;
  assert.equal(instance.stats.triangles, 1 + face.geometry.index!.count / 3);
  assert.ok(instance.stats.triangles > 1, 'stats aggregate the skinned body and face mesh');
  instance.dispose();
  assert.equal(sourceGeometryDisposals, 0); assert.equal(textureDisposals, 0);
  assert.equal(ownedGeometryDisposals, 1); assert.equal(ownedMaterialDisposals, 2);
});

test('two LOD skeletons keep identical phases and bind pose resets every transform', () => {
  const source = fixture();
  source.hips.rotation.z = 0.05;
  const a = createFigureInstance(source.source, true); const b = createFigureInstance(source.source, true);
  const driveA = createFigureAnimator(a.scene); const driveB = createFigureAnimator(b.scene);
  for (const action of ['idle', 'walking', 'praying', 'wooden_fish', 'bell', 'fortune'] as const) {
    for (let frame = 0; frame < 30; frame++) {
      driveA(action, frame / 60, 1 / 60, frame / 8); driveB(action, frame / 60, 1 / 60, frame / 8);
    }
    for (const [name, bone] of a.bones) {
      assert.deepEqual(bone.position.toArray(), b.bones.get(name)!.position.toArray());
      assert.deepEqual(bone.quaternion.toArray(), b.bones.get(name)!.quaternion.toArray());
    }
  }
  driveA('none', 0, 1 / 60);
  assert.equal(a.bones.get('Hips')!.position.y, 0.92);
  assert.ok(Math.abs(a.bones.get('Hips')!.rotation.z - 0.05) < 1e-12);
  assert.equal(source.hips.position.y, 0.92);
  a.dispose(); b.dispose();
});

test('LOD uses a hysteresis band and one versioned cache URL', () => {
  assert.equal(nextFigureLod(0, 12.5, 'balanced'), 0);
  assert.equal(nextFigureLod(0, 13.1, 'balanced'), 1);
  assert.equal(nextFigureLod(1, 12.5, 'balanced'), 1);
  assert.equal(nextFigureLod(1, 10.9, 'balanced'), 0);
  assert.equal(nextFigureLod(0, 10, 'low'), 1);
  assert.equal(nextFigureLod(0, 10, 'high'), 0);
  assert.equal(nextFigureLod(0, 22, 'balanced', 2), 0);
  assert.equal(figureAssetUrl('/models/figures/buddha.glb?v=old'), '/models/figures/buddha.glb?v=sculpture-v3');
  assert.equal(figureLodUrl('/models/figures/quanam.glb'), '/models/figures/quanam_lod1.glb');
  assert.equal(figureLodUrl('/models/figures/quanam_lod1.glb'), '/models/figures/quanam_lod1.glb');
});

test('production avatar reaches joined prayer palms and the beater contacts the drum in both LODs', async () => {
  for (const suffix of ['', '_lod1']) {
    const bytes = await readFile(`public/models/figures/sample_monk${suffix}.glb`);
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const instance = createFigureInstance(scene, true);
    const animate = createFigureAnimator(instance.scene);
    const chest = instance.bones.get('Chest')!;
    const left = instance.bones.get('Hand_L')!, right = instance.bones.get('Hand_R')!;
    const upperRight = instance.bones.get('UpperArm_R')!, lowerRight = instance.bones.get('LowerArm_R')!;
    const position = (object: THREE.Object3D) => object.getWorldPosition(new THREE.Vector3());
    const originalUpperLength = position(upperRight).distanceTo(position(lowerRight));
    const originalLowerLength = position(lowerRight).distanceTo(position(right));
    for (let frame = 0; frame < 180; frame++) animate('praying', frame / 60, 1 / 60);
    instance.scene.updateWorldMatrix(true, true);
    const leftPalm = chest.worldToLocal(left.localToWorld(new THREE.Vector3(-0.032, -0.088, 0.047)));
    const rightPalm = chest.worldToLocal(right.localToWorld(new THREE.Vector3(0.032, -0.088, 0.047)));
    assert.ok(leftPalm.distanceTo(rightPalm) < 0.065, `${suffix}: prayer hands remain apart (${leftPalm.distanceTo(rightPalm)})`);
    assert.ok(Math.abs(leftPalm.z - rightPalm.z) < 0.012, `${suffix}: prayer palms have different depths`);
    assert.ok(Math.abs(leftPalm.x) < 0.035 && Math.abs(rightPalm.x) < 0.035, `${suffix}: palms miss the centreline`);
    assert.ok(Math.abs(position(upperRight).distanceTo(position(lowerRight)) - originalUpperLength) < 1e-6);
    assert.ok(Math.abs(position(lowerRight).distanceTo(position(right)) - originalLowerLength) < 1e-6);
    const socket = instance.sockets.get('hand_r_socket')!;
    const tipOffset = new THREE.Vector3(0, MONK_MALLET_HEAD_Y, 0)
      .applyEuler(new THREE.Euler(MONK_MALLET_ANGLE, 0, 0)).add(new THREE.Vector3(...MONK_MALLET_GRIP));
    let closestGap = Infinity, highest = -Infinity;
    for (let frame = 0; frame < 300; frame++) {
      animate('wooden_fish', frame / 120, 1 / 120);
      instance.scene.updateWorldMatrix(true, true);
      if (frame < 100) continue;
      const tip = instance.scene.worldToLocal(socket.localToWorld(tipOffset.clone()));
      const radial = (tip.x / (0.16 * 1.15)) ** 2 + ((tip.z - 0.54) / 0.16) ** 2;
      if (radial < 1) {
        const surfaceY = 0.78 + 0.16 * 0.88 * Math.sqrt(1 - radial);
        closestGap = Math.min(closestGap, Math.abs(tip.y - 0.032 - surfaceY));
      }
      highest = Math.max(highest, tip.y);
    }
    assert.ok(closestGap < 0.025, `${suffix}: beater never contacts drum (${closestGap}m)`);
    assert.ok(highest > 1.04, `${suffix}: beater has no visible lift`);
    instance.dispose();
  }
});

test('production fortune palms support both cylinder sides at its centre throughout the shake in both LODs', async () => {
  for (const suffix of ['', '_lod1']) {
    const bytes = await readFile(`public/models/figures/sample_monk${suffix}.glb`);
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const instance = createFigureInstance(scene, true);
    const animate = createFigureAnimator(instance.scene);
    const tube = new THREE.Object3D();
    tube.position.fromArray(MONK_FORTUNE_GRIP);
    tube.rotation.y = MONK_FORTUNE_ANGLE;
    instance.sockets.get('hand_r_socket')!.add(tube);
    let lowest = Infinity, highest = -Infinity;
    for (let frame = 0; frame < 300; frame++) {
      animate('fortune', frame / 60, 1 / 60);
      instance.scene.updateWorldMatrix(true, true);
      if (frame < 120) continue;
      for (const side of [-1, 1]) {
        const hand = instance.bones.get(side < 0 ? 'Hand_L' : 'Hand_R')!;
        const palm = tube.worldToLocal(hand.localToWorld(new THREE.Vector3(side * 0.032, -0.088, 0.047)));
        const radialDistance = Math.hypot(palm.x, palm.z);
        assert.ok(Math.abs(radialDistance - 0.072) < 0.014, `${suffix}: palm floats away from tube side (${radialDistance}m)`);
        assert.ok(Math.abs(palm.y) < 0.02, `${suffix}: palm is below the tube centre (${palm.y}m)`);
        assert.ok(side * palm.x > 0.05, `${suffix}: hands do not support opposite tube sides`);
      }
      const centre = instance.scene.worldToLocal(tube.getWorldPosition(new THREE.Vector3()));
      lowest = Math.min(lowest, centre.y); highest = Math.max(highest, centre.y);
    }
    assert.ok(highest - lowest > 0.015, `${suffix}: tube does not shake with the supported hands`);
    instance.dispose();
  }
});
