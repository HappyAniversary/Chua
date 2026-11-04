import * as THREE from 'three';

interface TriangleNode {
  bounds: THREE.Box3;
  start: number;
  end: number;
  left?: TriangleNode;
  right?: TriangleNode;
}
const geometryCaches = new WeakMap<THREE.BufferGeometry, GeometryVolumeSweep>();
const LEAF_TRIANGLES = 12;
const EPSILON = 1e-9;

/**
 * Continuous sphere/triangle collision: triangle faces, finite edge capsules and
 * vertex spheres. A triangle BVH is shared by every instance of a geometry.
 * No sampling grid can leave gaps between camera-volume tests.
 */
export class GeometryVolumeSweep {
  private triangles: Float64Array;
  private order: number[];
  private root: TriangleNode;
  private ray = new THREE.Ray();
  private expanded = new THREE.Box3();
  private hitPoint = new THREE.Vector3();
  private triangle = new THREE.Triangle();
  private normal = new THREE.Vector3();
  private closest = new THREE.Vector3();
  private projected = new THREE.Vector3();
  private edge = new THREE.Vector3();
  private relative = new THREE.Vector3();
  triangleTests = 0;

  constructor(geometry: THREE.BufferGeometry) {
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const available = index ? index.count : positions.count;
    const first = Math.min(available, geometry.drawRange.start);
    const last = Math.min(available, first + geometry.drawRange.count);
    const count = Math.floor((last - first) / 3);
    this.triangles = new Float64Array(count * 9);
    this.order = Array.from({ length: count }, (_, i) => i);
    for (let triangle = 0; triangle < count; triangle++) {
      for (let corner = 0; corner < 3; corner++) {
        const source = first + triangle * 3 + corner;
        const vertex = index ? index.getX(source) : source;
        const offset = triangle * 9 + corner * 3;
        this.triangles[offset] = positions.getX(vertex);
        this.triangles[offset + 1] = positions.getY(vertex);
        this.triangles[offset + 2] = positions.getZ(vertex);
      }
    }
    this.root = this.build(0, count);
  }

  private build(start: number, end: number): TriangleNode {
    const bounds = new THREE.Box3();
    const point = new THREE.Vector3();
    for (let i = start; i < end; i++) {
      const offset = this.order[i] * 9;
      for (let corner = 0; corner < 3; corner++) {
        point.fromArray(this.triangles, offset + corner * 3);
        bounds.expandByPoint(point);
      }
    }
    const node: TriangleNode = { bounds, start, end };
    if (end - start <= LEAF_TRIANGLES) return node;
    const size = bounds.getSize(point);
    const axis = size.x > size.y && size.x > size.z ? 0 : size.y > size.z ? 1 : 2;
    const centroid = (triangle: number) => {
      const offset = triangle * 9 + axis;
      return this.triangles[offset] + this.triangles[offset + 3] + this.triangles[offset + 6];
    };
    const sorted = this.order.slice(start, end).sort((a, b) => centroid(a) - centroid(b));
    for (let i = 0; i < sorted.length; i++) this.order[start + i] = sorted[i];
    const middle = (start + end) >>> 1;
    node.left = this.build(start, middle);
    node.right = this.build(middle, end);
    return node;
  }

  /** Local-space direction is normalized; returns distance, or Infinity. */
  sweep(origin: THREE.Vector3, direction: THREE.Vector3, length: number, radius: number): number {
    this.triangleTests = 0;
    this.ray.set(origin, direction);
    return this.visit(this.root, length, radius);
  }

  private visit(node: TriangleNode, best: number, radius: number): number {
    this.expanded.copy(node.bounds).expandByScalar(radius);
    if (!this.expanded.containsPoint(this.ray.origin)) {
      if (!this.ray.intersectBox(this.expanded, this.hitPoint) ||
          this.hitPoint.distanceToSquared(this.ray.origin) > best * best) return best;
    }
    if (node.left && node.right) {
      best = this.visit(node.left, best, radius);
      return this.visit(node.right, best, radius);
    }
    for (let i = node.start; i < node.end; i++) {
      const offset = this.order[i] * 9;
      this.triangle.a.fromArray(this.triangles, offset);
      this.triangle.b.fromArray(this.triangles, offset + 3);
      this.triangle.c.fromArray(this.triangles, offset + 6);
      this.triangleTests++;
      best = Math.min(best, this.sweepTriangle(radius, best));
    }
    return best;
  }

  private sweepTriangle(radius: number, best: number): number {
    const { origin, direction } = this.ray;
    const { a, b, c } = this.triangle;
    this.triangle.closestPointToPoint(origin, this.closest);
    this.relative.subVectors(origin, this.closest);
    // A focus already overlapping a surface must be allowed to leave it. Camera
    // travel normally starts outside, thanks to the clearance in the world sweep.
    if (this.relative.lengthSq() <= radius * radius + EPSILON) {
      return this.relative.dot(direction) < -EPSILON ? 0 : Infinity;
    }
    this.triangle.getNormal(this.normal);
    const normalVelocity = this.normal.dot(direction);
    if (Math.abs(normalVelocity) > EPSILON) {
      const distance = this.relative.subVectors(origin, a).dot(this.normal);
      for (const side of [-1, 1]) {
        const contact = (side * radius - distance) / normalVelocity;
        if (contact < 0 || contact >= best) continue;
        this.projected.copy(origin).addScaledVector(direction, contact)
          .addScaledVector(this.normal, -side * radius);
        if (this.triangle.containsPoint(this.projected)) best = contact;
      }
    }
    best = Math.min(best, this.sweepEdge(a, b, radius), this.sweepEdge(b, c, radius), this.sweepEdge(c, a, radius));
    return best;
  }

  private sweepEdge(a: THREE.Vector3, b: THREE.Vector3, radius: number): number {
    const { origin, direction } = this.ray;
    this.edge.subVectors(b, a);
    this.relative.subVectors(origin, a);
    const edgeLengthSq = this.edge.lengthSq();
    const edgeVelocity = this.edge.dot(direction);
    const edgeOrigin = this.edge.dot(this.relative);
    const velocityOrigin = direction.dot(this.relative);
    const qa = edgeLengthSq - edgeVelocity * edgeVelocity;
    const qb = edgeLengthSq * velocityOrigin - edgeOrigin * edgeVelocity;
    const qc = edgeLengthSq * this.relative.lengthSq() - edgeOrigin * edgeOrigin - radius * radius * edgeLengthSq;
    const discriminant = qb * qb - qa * qc;
    let best = Infinity;
    if (qa > EPSILON && discriminant >= 0) {
      const contact = (-qb - Math.sqrt(discriminant)) / qa;
      const alongEdge = edgeOrigin + contact * edgeVelocity;
      if (contact >= 0 && alongEdge >= 0 && alongEdge <= edgeLengthSq) best = contact;
    }
    // End caps also handle degenerate triangles and motion parallel to an edge.
    return Math.min(best, this.sweepVertex(a, radius), this.sweepVertex(b, radius));
  }

  private sweepVertex(vertex: THREE.Vector3, radius: number): number {
    this.relative.subVectors(this.ray.origin, vertex);
    const b = this.relative.dot(this.ray.direction);
    const discriminant = b * b - this.relative.lengthSq() + radius * radius;
    if (discriminant < 0) return Infinity;
    const contact = -b - Math.sqrt(discriminant);
    return contact >= 0 ? contact : Infinity;
  }
}

export function getGeometryVolumeSweep(geometry: THREE.BufferGeometry): GeometryVolumeSweep {
  let cache = geometryCaches.get(geometry);
  if (!cache) { cache = new GeometryVolumeSweep(geometry); geometryCaches.set(geometry, cache); }
  return cache;
}

/** Upper bound for the inverse transform's largest singular value, including shear. */
export function inverseVolumeScale(matrix: THREE.Matrix4): number {
  const e = matrix.elements;
  const rows = [[e[0], e[4], e[8]], [e[1], e[5], e[9]], [e[2], e[6], e[10]]];
  let bound = 0;
  for (const a of rows) {
    let sum = 0;
    for (const b of rows) sum += Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
    bound = Math.max(bound, sum);
  }
  return Math.sqrt(bound);
}
