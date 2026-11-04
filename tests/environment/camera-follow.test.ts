import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applySafeCameraMotion, CameraCollisionWorld } from '../../src/utils/cameraCollision';

const cases: {
  name: string;
  size: [number, number, number];
  center: [number, number, number];
  route: [number, number][];
  segmentFrames?: number[];
}[] = [
  { name: 'walk past a narrow pillar', size: [0.6, 10, 0.6], center: [0, 5, 3], route: [[0, 0], [0.7, 0], [0.7, 7], [0, 7]] },
  { name: 'walk slowly past a pillar and keep walking away', size: [0.6, 4, 0.6], center: [0, 2, 3],
    route: [[0, 0], [0.7, 0], [0.7, 7], [0, 7], [0, 14]], segmentFrames: [60, 360, 60, 360] },
  { name: 'walk under a roof and leave its far edge', size: [8, 0.2, 6], center: [0, 3, 0], route: [[0, 8], [0, -18]] },
  { name: 'walk around the end of a wall', size: [6, 5, 0.2], center: [0, 2.5, 0], route: [[-4.5, 3], [-4.5, -3], [0, -3], [0, -20]] },
];

for (const scenario of cases) {
  test(`camera resumes following after ${scenario.name}`, () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scenario.size), new THREE.MeshBasicMaterial());
    mesh.position.set(...scenario.center);
    scene.add(mesh);
    scene.updateMatrixWorld(true);
    const solidBounds = new THREE.Box3().setFromObject(mesh);
    const collision = new CameraCollisionWorld(scene);
    const desiredLookAt = new THREE.Vector3(scenario.route[0][0], 1.6, scenario.route[0][1]);
    const lookAt = desiredLookAt.clone();
    const offset = new THREE.Vector3(0, 2, 6);
    const position = desiredLookAt.clone().add(offset);
    const desiredPosition = position.clone();
    const safe = new THREE.Vector3(), candidate = new THREE.Vector3();
    const step = () => {
      desiredPosition.copy(desiredLookAt).add(offset);
      applySafeCameraMotion({ position, lookAt, desiredPosition, desiredLookAt, collision,
        radius: 0.24, delta: 1 / 60, reset: false, groundHeight: () => 0, safe, candidate });
      assert.ok(solidBounds.distanceToPoint(position) >= 0.24 - 1e-6,
        `rendered camera sphere overlaps the obstacle at ${position.toArray()}`);
    };
    try {
      for (const [segment, [x, z]] of scenario.route.slice(1).entries()) {
        const start = desiredLookAt.clone(), end = new THREE.Vector3(x, 1.6, z);
        // Continuous player movement; no teleport/reset rescue. Include the
        // slow-pillar route that used to remain trapped even after 600 idle frames.
        const frames = scenario.segmentFrames?.[segment] ?? Math.ceil(start.distanceTo(end) / (3 / 60));
        for (let i = 1; i <= frames; i++) {
          desiredLookAt.lerpVectors(start, end, i / frames);
          step();
        }
      }
      assert.equal(collision.sweep(desiredLookAt, desiredPosition, 0.24), 1,
        'the requested final camera boom is clear, so the camera must reopen');
      for (let i = 0; i < 180; i++) step();
      assert.ok(position.distanceTo(desiredPosition) < 0.05,
        `camera stayed caught at ${position.toArray()} while player reached ${desiredLookAt.toArray()}; follow error ${position.distanceTo(desiredPosition).toFixed(2)}m`);
    } finally {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  });
}
