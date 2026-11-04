import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applySafeCameraMotion, CameraCollisionWorld, cameraGuardRadius, cameraShouldReset } from '../../src/utils/cameraCollision';
import { advanceWalkPhase, displacementIsWalking, motionDelta, resolveMotionInSteps } from '../../src/utils/playerMotion';

function box(scene: THREE.Scene | THREE.Group, size: [number, number, number], position: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  mesh.position.set(...position);
  scene.add(mesh);
  return mesh;
}
const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

test('camera boom retracts before walls, roofs, columns, tree trunks and ground', () => {
  const scene = new THREE.Scene();
  box(scene, [10, 8, 0.2], [0, 4, 4]);
  box(scene, [10, 0.2, 10], [0, 6, 0]);
  box(scene, [10, 0.2, 10], [0, -0.1, 0]);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4), new THREE.MeshBasicMaterial());
  column.position.set(2, 2, 0);
  scene.add(column);
  const tree = column.clone(); tree.position.x = -2; scene.add(tree);
  const world = new CameraCollisionWorld(scene);
  const anchor = point(0, 2, 0);
  const safe = new THREE.Vector3();
  assert.ok(world.safePosition(anchor, point(0, 2, 8), 0.25, safe).z < 3.9);
  assert.ok(world.safePosition(anchor, point(0, 9, 0), 0.25, safe).y < 5.9);
  assert.ok(world.safePosition(anchor, point(0, -2, 0), 0.25, safe).y > 0);
  assert.ok(world.safePosition(anchor, point(4, 2, 0), 0.25, safe).x < 1.7);
  assert.ok(world.safePosition(anchor, point(-4, 2, 0), 0.25, safe).x > -1.7);
});

test('camera volume catches a wall missed by the centre line', () => {
  const scene = new THREE.Scene();
  box(scene, [0.1, 4, 0.2], [0.24, 2, 3]);
  const world = new CameraCollisionWorld(scene);
  assert.equal(world.sweep(point(0, 2, 0), point(0, 2, 6), 0), 1);
  assert.ok(world.sweep(point(0, 2, 0), point(0, 2, 6), 0.24) < 0.5);
});

test('actual sloping roof triangles leave empty roof bounds traversable', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-4, 3, -4, 4, 7, -4, 4, 7, 4, -4, 3, -4, 4, 7, 4, -4, 3, 4], 3));
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const world = new CameraCollisionWorld(scene);
  assert.equal(world.sweep(point(2, 4, -3), point(2, 4, 3), 0.24), 1);
  assert.ok(world.sweep(point(0, 2, 0), point(0, 8, 0), 0.24) < 1);
});

test('embedded anchor can leave a closed box without getting trapped', () => {
  const scene = new THREE.Scene(); box(scene, [2, 2, 2], [0, 2, 0]);
  assert.equal(new CameraCollisionWorld(scene).sweep(point(0, 2, 0), point(0, 2, 5), 0.24), 1);
});

test('damped orbit corner crossing is stopped even with two clear orbit endpoints', () => {
  const scene = new THREE.Scene(); box(scene, [0.6, 5, 0.6], [2, 2, 2]);
  const world = new CameraCollisionWorld(scene);
  const anchor = point(0, 2, 0), previous = point(4, 2, 0), next = point(0, 2, 4);
  assert.equal(world.sweep(anchor, previous, 0.24), 1);
  assert.equal(world.sweep(anchor, next, 0.24), 1);
  assert.ok(world.sweep(previous, next, 0.24) < 1);
  const damped = previous.clone().lerp(next, 0.5);
  assert.ok(world.sweep(anchor, damped, 0.24) < 1);
});

test('safePosition supports an aliased desired/output vector', () => {
  const world = new CameraCollisionWorld(new THREE.Scene());
  const desired = point(2, 3, 6);
  world.safePosition(point(0, 2, 0), desired, 0.24, desired);
  assert.deepEqual(desired.toArray(), [2, 3, 6]);
});

test('structural additions/removals rebuild cache; avatar and transparent FX are excluded', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group(); root.userData.cameraStatic = true; scene.add(root);
  const avatar = new THREE.Group(); avatar.userData.cameraIgnore = true; root.add(avatar);
  box(avatar, [4, 4, 1], [0, 2, 2]);
  const transparent = box(root, [4, 4, 1], [0, 2, 3]);
  (transparent.material as THREE.Material).transparent = true;
  // An untagged sky mesh is outside static roots.
  box(scene, [4, 4, 1], [0, 2, 4]);
  const world = new CameraCollisionWorld(scene);
  const start = point(0, 2, 0), end = point(0, 2, 6);
  assert.equal(world.sweep(start, end, 0.24), 1);
  const wall = box(root, [4, 4, 1], [0, 2, 4]);
  assert.ok(world.sweep(start, end, 0.24) < 1);
  root.remove(wall);
  assert.equal(world.sweep(start, end, 0.24), 1);
});

test('near-plane radius grows for wide viewport and reset version is explicit', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1);
  const normal = cameraGuardRadius(camera);
  camera.aspect = 5;
  assert.ok(cameraGuardRadius(camera) > normal);
  assert.equal(cameraShouldReset(false, 0, 0), true);
  assert.equal(cameraShouldReset(true, 2, 2), false);
  assert.equal(cameraShouldReset(true, 2, 3), true);
});

test('100 ms stall uses the same dt; blocked motion never walks or advances phase', () => {
  assert.equal(motionDelta(2), 0.1);
  assert.equal(motionDelta(-1), 0);
  assert.equal(motionDelta(Number.NaN), 0);
  const blocked = resolveMotionInSteps(0, 0, 0.3, 0, (x, z) => ({ x, z }));
  const distance = Math.hypot(blocked.x, blocked.z);
  assert.equal(displacementIsWalking(distance, 0.1), false);
  assert.equal(advanceWalkPhase(1, distance), 1);
  assert.equal(advanceWalkPhase(0, 0.2) + advanceWalkPhase(0, 0.3), advanceWalkPhase(0, 0.5));
});

test('movement substeps prevent endpoint tunnelling through a narrow barrier', () => {
  let calls = 0;
  const result = resolveMotionInSteps(0, 0, 1, 0, (x, z, nextX, nextZ) => {
    calls++;
    return nextX >= 0.4 && nextX <= 0.6 ? { x, z } : { x: nextX, z: nextZ };
  });
  assert.ok(calls >= 8);
  assert.ok(result.x < 0.4);
});


test('teleport/reset snaps position and lookAt together at a collision-checked destination', () => {
  const scene = new THREE.Scene();
  box(scene, [10, 8, 0.2], [20, 4, 4]);
  const position = point(-20, 4, -20), lookAt = point(-20, 2, -20);
  applySafeCameraMotion({
    position, lookAt, desiredPosition: point(20, 3, 8), desiredLookAt: point(20, 2, 0),
    collision: new CameraCollisionWorld(scene), radius: 0.24, delta: 0.016, reset: true,
    groundHeight: () => 0, safe: new THREE.Vector3(), candidate: new THREE.Vector3(),
  });
  assert.equal(position.x, 20);
  assert.ok(position.z < 3.9);
  assert.deepEqual(lookAt.toArray(), [20, 2, 0]);
});

test('actual damped travel never crosses a corner obstacle', () => {
  const scene = new THREE.Scene(); box(scene, [0.6, 5, 0.6], [2, 2, 2]);
  const world = new CameraCollisionWorld(scene);
  const previous = point(4, 2, 0), position = previous.clone();
  applySafeCameraMotion({
    position, lookAt: point(0, 2, 0), desiredPosition: point(0, 2, 4), desiredLookAt: point(0, 2, 0),
    collision: world, radius: 0.24, delta: 0.1, reset: false, groundHeight: () => 0,
    safe: new THREE.Vector3(), candidate: new THREE.Vector3(),
  });
  assert.equal(world.sweep(previous, position, 0.24), 1);
});

test('spatial and triangle BVH broad phases avoid testing thousands of distant solids', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  const material = new THREE.MeshBasicMaterial();
  for (let i = 0; i < 3000; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(30 + (i % 60) * 2, 2, 30 + Math.floor(i / 60) * 2);
    scene.add(mesh);
  }
  box(scene, [4, 4, 0.2], [0, 2, 3]);
  const world = new CameraCollisionWorld(scene);
  world.refresh();
  assert.ok(world.sweep(point(0, 2, 0), point(0, 2, 6), 0.24) < 1);
  assert.ok(world.lastTriangleTests > 0);
  assert.ok(world.lastTriangleTests <= 12, `unexpected triangle tests: ${world.lastTriangleTests}`);
});


test('continuous volume catches a thin post between the former nine-ray sample offsets', () => {
  const scene = new THREE.Scene();
  box(scene, [0.05, 2, 0.05], [0.08, 2, 2]);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1);
  const world = new CameraCollisionWorld(scene);
  assert.equal(world.sweep(point(0, 2, 0), point(0, 2, 4), 0), 1);
  assert.ok(world.sweep(point(0, 2, 0), point(0, 2, 4), cameraGuardRadius(camera)) < 0.5);
});

test('continuous volume catches a small diagonal triangle edge and leaves a nearby gap clear', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BufferGeometry();
  // A 3cm triangle between every previous offset ray. Edge/vertex contact,
  // rather than a face-normal crossing, must still stop the camera volume.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0.12, 2.12, 2, 0.15, 2.12, 2, 0.12, 2.15, 2,
  ], 3));
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const world = new CameraCollisionWorld(scene);
  assert.equal(world.sweep(point(0, 2, 0), point(0, 2, 4), 0), 1);
  assert.ok(world.sweep(point(0, 2, 0), point(0, 2, 4), 0.24) < 0.5);
  assert.equal(world.sweep(point(-0.2, 2, 0), point(-0.2, 2, 4), 0.24), 1);
});

test('continuous volume protects diagonal travel and nonuniformly scaled solids', () => {
  const scene = new THREE.Scene();
  const mesh = box(scene, [0.04, 2, 0.04], [2.08, 2, 2]);
  mesh.scale.set(0.5, 1.7, 2);
  const world = new CameraCollisionWorld(scene);
  assert.ok(world.sweep(point(0, 2, 0), point(4, 2, 4), 0.24) < 0.55);
});


test('label line of sight blocks walls in the final one percent of the path', () => {
  for (const distance of [12, 18]) {
    const scene = new THREE.Scene();
    const wall = box(scene, [4, 4, 0.02], [0, 2, distance - 0.06]);
    const world = new CameraCollisionWorld(scene);
    const from = point(0, 2, 0), label = point(0, 2, distance);
    // Regression: the former proportional tolerance incorrectly accepted this.
    assert.ok(world.sweep(from, label, 0) > 0.99);
    assert.equal(world.hasLineOfSight(from, label), false);
    scene.remove(wall);
    assert.equal(world.hasLineOfSight(from, label), true);
  }
});

test('ignored avatars and outside labels retain static proxies, while nested architecture invalidates them', () => {
  const scene = new THREE.Scene();
  const architecture = new THREE.Group();
  architecture.userData.cameraStatic = true;
  scene.add(architecture);
  box(architecture, [4, 4, 0.2], [0, 2, 3]);
  const world = new CameraCollisionWorld(scene);
  world.refresh();
  const original = world.solids[0];
  const avatar = new THREE.Group(); avatar.userData.cameraIgnore = true;
  scene.add(avatar);
  box(avatar, [1, 2, 1], [0, 1, 0]);
  world.refresh();
  assert.equal(world.solids[0], original);
  scene.remove(avatar); world.refresh();
  assert.equal(world.solids[0], original);
  const wrapper = new THREE.Group(); scene.add(wrapper);
  const label = new THREE.Group(); wrapper.add(label);
  world.refresh(); assert.equal(world.solids[0], original);
  const newRoot = new THREE.Group(); newRoot.userData.cameraStatic = true;
  wrapper.add(newRoot); box(newRoot, [1, 4, 1], [2, 2, 2]);
  world.refresh(); assert.equal(world.solids.length, 2);
  assert.notEqual(world.solids[0], original);
  wrapper.remove(newRoot); world.refresh(); assert.equal(world.solids.length, 1);
  box(architecture, [1, 4, 1], [-2, 2, 2]);
  world.refresh(); assert.equal(world.solids.length, 2);
});
