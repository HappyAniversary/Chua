import * as THREE from 'three';

function cappedTube(curve: THREE.Curve<THREE.Vector3>, segments: number, radius: number) {
  const radial = 6;
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const indices = Array.from(geometry.index!.array);
  const end = segments * (radial + 1);
  for (let i = 1; i < radial - 1; i++) {
    indices.push(0, i + 1, i, end, end + i, end + i + 1);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Intentional small meshes keep the expression legible in both body LODs. */
export function addMonkFaceDetails(mesh: THREE.SkinnedMesh): void {
  const head = mesh.skeleton.bones.find((bone) => bone.name === 'Head');
  if (!head) throw new Error('Monk face requires Head bone.');
  const dark = new THREE.MeshStandardMaterial({ name: 'FacialInk', color: '#46372b', roughness: 0.92 });
  const smile = new THREE.MeshStandardMaterial({ name: 'Mouth', color: '#986b52', roughness: 0.9 });
  const detailGroup = new THREE.Group();
  detailGroup.name = 'monk_face_details';
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), dark);
    eye.name = side < 0 ? 'eye_l' : 'eye_r';
    eye.position.set(side * 0.050, 0.123, 0.149);
    eye.scale.set(0.011, 0.013, 0.007);
    detailGroup.add(eye);
    const brow = new THREE.QuadraticBezierCurve3(new THREE.Vector3(side * 0.030, 0.151, 0.146), new THREE.Vector3(side * 0.050, 0.158, 0.147), new THREE.Vector3(side * 0.070, 0.150, 0.139));
    const browMesh = new THREE.Mesh(cappedTube(brow, 8, 0.0022), dark);
    browMesh.name = `eyebrow_${side < 0 ? 'l' : 'r'}`;
    detailGroup.add(browMesh);
  }
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.025, 0.053, 0.164), new THREE.Vector3(0, 0.044, 0.172), new THREE.Vector3(0.025, 0.053, 0.164));
  const mouth = new THREE.Mesh(cappedTube(curve, 12, 0.0025), smile);
  mouth.name = 'gentle_smile';
  detailGroup.add(mouth);
  head.add(detailGroup);
}

/** Shallow eyelids and smile are explicit surfaces, so the expression survives LOD sampling. */
export function addStatueFaceDetails(root: THREE.Object3D, center: [number, number, number], tilt = 0, whiteStone = false, smile = 0.35, scale: [number, number, number] = [1, 1, 1]) {
  const group = new THREE.Group();
  group.name = 'statue_face_details';
  group.position.fromArray(center);
  group.rotation.z = tilt;
  group.scale.fromArray(scale);
  const material = new THREE.MeshStandardMaterial({ name: 'SculptedFeatures', color: whiteStone ? '#827970' : '#8b6726', roughness: 0.83, metalness: whiteStone ? 0 : 0.18 });
  for (const side of [-1, 1]) {
    const lid = new THREE.QuadraticBezierCurve3(new THREE.Vector3(side * 0.078, 0.029, 0.112), new THREE.Vector3(side * 0.052, 0.017, 0.136), new THREE.Vector3(side * 0.027, 0.028, 0.129));
    const mesh = new THREE.Mesh(cappedTube(lid, 10, 0.003), material);
    mesh.name = side < 0 ? 'closed_eyelid_l' : 'closed_eyelid_r';
    group.add(mesh);
  }
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.030, -0.068 + smile * 0.006, 0.136), new THREE.Vector3(0, -0.080, 0.147), new THREE.Vector3(0.030, -0.068 + smile * 0.006, 0.136));
  const mouth = new THREE.Mesh(cappedTube(curve, 12, 0.0028), material);
  mouth.name = 'sculpted_smile';
  group.add(mouth);
  root.add(group);
}
