import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBodhiPlanterParts } from '../../src/components/world/BodhiTreePlanter';
import { TEMPLE_LANDMARKS } from '../../src/constants/templeLayout';

test('Bodhi planter has one opaque top surface at each visible point around the trunk', () => {
  const parts = createBodhiPlanterParts(TEMPLE_LANDMARKS.bodhiTree.planterRadius);
  const material = new THREE.MeshBasicMaterial();
  const meshes = parts.map(part => {
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.name = part.name;
    mesh.position.y = part.y;
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  const ray = new THREE.Raycaster();
  let tested = 0;
  try {
    for (let a = 0; a < 32; a++) {
      // Stay inside the octagonal rim's apothem (2.45 * cos(PI/8)).
      for (const radius of [1.2, 1.6, 1.95, 2.05, 2.2]) {
        const angle = (a + 0.37) / 32 * Math.PI * 2;
        ray.set(new THREE.Vector3(Math.cos(angle) * radius, 2, Math.sin(angle) * radius), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObjects(meshes).filter(hit => hit.face && hit.face.normal.y > 0.99);
        assert.ok(hits.length > 0, 'the planter must remain closed around the trunk');
        const closest = hits[0];
        const duplicates = hits.filter(hit => hit.object !== closest.object && Math.abs(hit.point.y - closest.point.y) < 1e-6);
        assert.equal(duplicates.length, 0,
          `opaque top faces overlap at y=${closest.point.y.toFixed(6)}: ${closest.object.name}/${duplicates.map(hit => hit.object.name).join(',')}`);
        tested++;
      }
    }
    assert.equal(tested, 160);
  } finally {
    parts.forEach(part => part.geometry.dispose());
    material.dispose();
  }
});
