import * as THREE from 'three';
import { getGeometryVolumeSweep, inverseVolumeScale } from './cameraVolumeSweep';

/** Cached opaque geometry; sweeps test real roofs, never landmark-sized boxes. */
export interface CameraSolid {
  mesh: THREE.Mesh;
  bounds: THREE.Box3;
  source: THREE.Mesh;
  inverse: THREE.Matrix4;
  localRadiusScale: number;
}
const CELL_SIZE = 8;
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const caches = new WeakMap<THREE.Scene, CameraCollisionWorld>();

export class CameraCollisionWorld {
  readonly solids: CameraSolid[] = [];
  private cells = new Map<string, CameraSolid[]>();
  private observed = new Set<THREE.Object3D>();
  private hasStaticRoots = false;
  private dirty = true;
  private raycaster = new THREE.Raycaster();
  private start = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private localEnd = new THREE.Vector3();
  private localDirection = new THREE.Vector3();
  private volumeRay = new THREE.Ray();
  private expandedBounds = new THREE.Box3();
  private broadHit = new THREE.Vector3();
  /** CPU diagnostic for the most recent sweep, excluding cheap spatial bounds tests. */
  lastTriangleTests = 0;
  private queryBounds = new THREE.Box3();
  private hits: THREE.Intersection[] = [];
  private candidates = new Set<CameraSolid>();
  private markDirty = (event: { child: THREE.Object3D; target?: THREE.Object3D; type?: string }) => {
    if (event.child.userData.cameraIgnore) return;
    let insideStatic = !this.hasStaticRoots;
    for (let parent = event.target; parent; parent = parent.parent ?? undefined) {
      if (parent.userData.cameraIgnore) return;
      insideStatic ||= parent.userData.cameraStatic === true;
    }
    // New or removed architecture roots can be nested under an ordinary wrapper.
    let containsStatic = false;
    const findStatic = (object: THREE.Object3D) => {
      if (object.userData.cameraIgnore) return;
      containsStatic ||= object.userData.cameraStatic === true;
      if (!containsStatic) object.children.forEach(findStatic);
    };
    if (!insideStatic) findStatic(event.child);
    if (insideStatic || containsStatic) this.dirty = true;
    // Track outside wrappers without rebuilding the static proxy collection.
    if (event.type === 'childadded') this.observeTree(event.child);
    else this.unobserveTree(event.child);
  };

  private observeTree(object: THREE.Object3D): void {
    if (object.userData.cameraIgnore || this.observed.has(object)) return;
    this.observed.add(object);
    object.addEventListener('childadded', this.markDirty);
    object.addEventListener('childremoved', this.markDirty);
    object.children.forEach(child => this.observeTree(child));
  }

  private unobserveTree(object: THREE.Object3D): void {
    this.observed.delete(object);
    object.removeEventListener('childadded', this.markDirty);
    object.removeEventListener('childremoved', this.markDirty);
    object.children.forEach(child => this.unobserveTree(child));
  }

  constructor(private scene: THREE.Scene) {}

  refresh(): void {
    if (!this.dirty) return;
    this.dirty = false;
    for (const object of this.observed) {
      object.removeEventListener('childadded', this.markDirty);
      object.removeEventListener('childremoved', this.markDirty);
    }
    this.observed.clear();
    this.solids.length = 0;
    this.cells.clear();
    this.scene.updateMatrixWorld(true);
    const add = (source: THREE.Mesh, matrix: THREE.Matrix4) => {
      const geometry = source.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      const bounds = geometry.boundingBox.clone().applyMatrix4(matrix);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorld.copy(matrix);
      const inverse = matrix.clone().invert();
      const solid = { mesh, bounds, source, inverse, localRadiusScale: inverseVolumeScale(inverse) };
      this.solids.push(solid);
      this.eachCell(bounds, key => {
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(solid); else this.cells.set(key, [solid]);
      });
    };
    this.hasStaticRoots = false;
    const findStaticRoot = (object: THREE.Object3D) => {
      if (object.userData.cameraIgnore || this.hasStaticRoots) return;
      this.hasStaticRoots ||= object.userData.cameraStatic === true;
      object.children.forEach(findStaticRoot);
    };
    findStaticRoot(this.scene);
    this.observeTree(this.scene);
    const visit = (object: THREE.Object3D, isStatic = !this.hasStaticRoots) => {
      if (object.userData.cameraIgnore) return;
      isStatic ||= object.userData.cameraStatic === true;
      if (isStatic && object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (materials.every(m => !m.transparent && m.opacity >= 0.99 && m.depthWrite)) {
          if (object instanceof THREE.InstancedMesh) {
            const instance = new THREE.Matrix4();
            const world = new THREE.Matrix4();
            for (let i = 0; i < object.count; i++) {
              object.getMatrixAt(i, instance);
              world.multiplyMatrices(object.matrixWorld, instance);
              add(object, world);
            }
          } else add(object, object.matrixWorld);
        }
      }
      for (const child of object.children) visit(child, isStatic);
    };
    visit(this.scene);
  }

  private eachCell(bounds: THREE.Box3, fn: (key: string) => void): void {
    // XZ grid avoids replicating large ground meshes through vertical cells.
    for (let x = Math.floor(bounds.min.x / CELL_SIZE); x <= Math.floor(bounds.max.x / CELL_SIZE); x++) {
      for (let z = Math.floor(bounds.min.z / CELL_SIZE); z <= Math.floor(bounds.max.z / CELL_SIZE); z++) fn(`${x}:${z}`);
    }
  }

  /** Continuous swept sphere guards the entire near plane, including between former rays. */
  sweep(from: THREE.Vector3, to: THREE.Vector3, radius: number): number {
    this.refresh();
    this.lastTriangleTests = 0;
    const length = from.distanceTo(to);
    if (length < 1e-6) return 1;
    this.queryBounds.setFromPoints([from, to]).expandByScalar(radius + 0.03);
    this.candidates.clear();
    this.eachCell(this.queryBounds, key => {
      for (const solid of this.cells.get(key) ?? []) {
        if (solid.bounds.intersectsBox(this.queryBounds) && !isInsidePrimitive(solid, from)) this.candidates.add(solid);
      }
    });
    this.direction.subVectors(to, from).normalize();
    let allowed = length;
    if (radius <= 0) {
      // Labels need a line-of-sight query rather than camera volume clearance.
      this.raycaster.set(from, this.direction);
      this.raycaster.near = 0;
      this.raycaster.far = length;
      for (const solid of this.candidates) {
        if (!this.raycaster.ray.intersectsBox(solid.bounds)) continue;
        this.hits.length = 0;
        solid.mesh.raycast(this.raycaster, this.hits);
        for (const hit of this.hits) allowed = Math.min(allowed, Math.max(0, hit.distance - 0.035));
      }
    } else {
      this.volumeRay.set(from, this.direction);
      for (const solid of this.candidates) {
        this.expandedBounds.copy(solid.bounds).expandByScalar(radius);
        if (!this.expandedBounds.containsPoint(from) &&
            (!this.volumeRay.intersectBox(this.expandedBounds, this.broadHit) ||
             this.broadHit.distanceToSquared(from) > allowed * allowed)) continue;
        this.start.copy(from).applyMatrix4(solid.inverse);
        this.localEnd.copy(to).applyMatrix4(solid.inverse);
        this.localDirection.subVectors(this.localEnd, this.start);
        const localLength = this.localDirection.length();
        if (localLength < 1e-9) continue;
        this.localDirection.multiplyScalar(1 / localLength);
        const geometry = getGeometryVolumeSweep(solid.mesh.geometry);
        const limit = allowed / length * localLength;
        const contact = geometry.sweep(this.start, this.localDirection, limit,
          radius * solid.localRadiusScale);
        this.lastTriangleTests += geometry.triangleTests;
        // Geometry sweep returns its limit when clear; only real earlier contacts
        // need an extra clearance. This prevents shrinking the boom every frame.
        if (contact < limit - 1e-8) allowed = Math.min(allowed, Math.max(0, contact / localLength * length - 0.035));
      }
    }
    return Math.max(0, Math.min(1, allowed / length));
  }

  /** Occlusion uses only numerical tolerance; a wall near the label still blocks it. */
  hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    return this.sweep(from, to, 0) >= 1 - 1e-7;
  }

  safePosition(anchor: THREE.Vector3, desired: THREE.Vector3, radius: number, out: THREE.Vector3): THREE.Vector3 {
    const fraction = this.sweep(anchor, desired, radius);
    return out.copy(desired).sub(anchor).multiplyScalar(fraction).add(anchor);
  }
}

const localPoint = new THREE.Vector3();
function isInsidePrimitive(solid: CameraSolid, point: THREE.Vector3): boolean {
  const mesh = solid.mesh;
  const type = mesh.geometry.type;
  if (type !== 'BoxGeometry' && type !== 'CylinderGeometry' && type !== 'SphereGeometry') return false;
  localPoint.copy(point).applyMatrix4(solid.inverse);
  const box = mesh.geometry.boundingBox!;
  if (!box.containsPoint(localPoint)) return false;
  // For non-boxes use the actual sphere/cylinder cross-section, not its empty corners.
  if (type === 'SphereGeometry') {
    const radius = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
    return localPoint.lengthSq() < radius * radius;
  }
  if (type === 'CylinderGeometry') {
    const parameters = (mesh.geometry as THREE.CylinderGeometry).parameters;
    const t = (localPoint.y + parameters.height / 2) / parameters.height;
    const r = THREE.MathUtils.lerp(parameters.radiusBottom, parameters.radiusTop, t);
    return localPoint.x ** 2 + localPoint.z ** 2 < r * r;
  }
  return true;
}

export function getCameraCollisionWorld(scene: THREE.Scene): CameraCollisionWorld {
  let cache = caches.get(scene);
  if (!cache) { cache = new CameraCollisionWorld(scene); caches.set(scene, cache); }
  return cache;
}

/** Covers the full near-plane rectangle at every aspect ratio, with a safety margin. */
export function cameraGuardRadius(camera: THREE.Camera): number {
  if (!(camera instanceof THREE.PerspectiveCamera)) return 0.24;
  const halfHeight = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return Math.max(0.24, Math.hypot(halfHeight, halfHeight * camera.aspect) + 0.06);
}

export function cameraShouldReset(initialized: boolean, previousVersion: number, nextVersion = 0): boolean {
  return !initialized || previousVersion !== nextVersion;
}

export interface SafeCameraMotion {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  desiredPosition: THREE.Vector3;
  desiredLookAt: THREE.Vector3;
  /** Omit to let the camera pass through world geometry while following. */
  collision?: CameraCollisionWorld;
  radius: number;
  delta: number;
  reset: boolean;
  groundHeight: (x: number, z: number) => number;
  /** Scratch vectors owned by the camera, reused on every frame. */
  safe: THREE.Vector3;
  candidate: THREE.Vector3;
}

/** Renderer-independent motion, including explicit reset of BOTH camera and focus. */
export function applySafeCameraMotion(motion: SafeCameraMotion): void {
  const { position, lookAt, desiredPosition, desiredLookAt, collision, radius, delta,
    reset, groundHeight, safe, candidate } = motion;
  const keepAboveGround = (point: THREE.Vector3) => {
    point.y = Math.max(point.y, groundHeight(point.x, point.z) + radius + 0.06);
  };
  safe.copy(desiredPosition);
  keepAboveGround(safe);
  collision?.safePosition(desiredLookAt, safe, radius, safe);
  if (reset) {
    position.copy(safe);
    lookAt.copy(desiredLookAt);
    return;
  }
  candidate.copy(position).lerp(safe, 1 - Math.exp(-10 * delta));
  keepAboveGround(candidate);
  if (!collision) {
    position.copy(candidate);
    lookAt.lerp(desiredLookAt, 1 - Math.exp(-12 * delta));
    return;
  }
  // Retraction is immediate; reopening distance is damped. Always validate the
  // resulting travel segment as well, since a safe boom can cut an orbit corner.
  collision.safePosition(desiredLookAt, candidate, radius, candidate);
  const travel = collision.sweep(position, candidate, radius);
  if (travel < 1 - 1e-6 && collision.sweep(desiredLookAt, position, radius) < 1 - 1e-6) {
    // A moving focus can leave the old camera on the wrong side of a corner.
    // Two competing sweeps would then pin it there forever. Rebase to the
    // current focus's already checked boom, without rendering inside the solid.
    // Keep the damped candidate so reopening the camera remains gradual.
    position.copy(candidate);
    lookAt.copy(desiredLookAt);
    return;
  }
  position.lerp(candidate, travel);
  lookAt.lerp(desiredLookAt, 1 - Math.exp(-12 * delta));
}
