import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applySafeCameraMotion, CameraCollisionWorld } from '../../src/utils/cameraCollision';

test('camera follows through opaque objects when no collision world is supplied', () => {
  const scene = new THREE.Scene();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 0.3), new THREE.MeshBasicMaterial());
  wall.position.set(0, 4, 3);
  scene.add(wall);
  const collision = new CameraCollisionWorld(scene);
  const position = new THREE.Vector3(0, 3.6, -4);
  const lookAt = new THREE.Vector3(0, 1.6, -10);
  const desiredLookAt = new THREE.Vector3(0, 1.6, 0);
  const desiredPosition = new THREE.Vector3(0, 3.6, 6);
  const safe = new THREE.Vector3(), candidate = new THREE.Vector3();
  try {
    assert.ok(collision.sweep(desiredLookAt, desiredPosition, 0.24) < 1,
      'the opaque wall genuinely obstructs the requested camera boom');
    for (let frame = 0; frame < 180; frame++) {
      applySafeCameraMotion({ position, lookAt, desiredPosition, desiredLookAt,
        radius: 0.24, delta: 1 / 60, reset: false, groundHeight: () => 0, safe, candidate });
    }
    assert.ok(position.distanceTo(desiredPosition) < 0.01,
      'the camera must cross the wall and retain the requested orbit distance');
    assert.ok(lookAt.distanceTo(desiredLookAt) < 0.01);
  } finally {
    wall.geometry.dispose();
    (wall.material as THREE.Material).dispose();
  }
});

test('unobstructed camera reset updates both position and focus immediately', () => {
  const position = new THREE.Vector3(0, 3, 50), lookAt = new THREE.Vector3(0, 1.6, 46);
  const desiredLookAt = new THREE.Vector3(25, 1.6, -15);
  const desiredPosition = new THREE.Vector3(25, 4.8, -7);
  applySafeCameraMotion({ position, lookAt, desiredPosition, desiredLookAt,
    radius: 0.24, delta: 1 / 60, reset: true, groundHeight: () => 0,
    safe: new THREE.Vector3(), candidate: new THREE.Vector3() });
  assert.deepEqual(position.toArray(), desiredPosition.toArray());
  assert.deepEqual(lookAt.toArray(), desiredLookAt.toArray());
});
