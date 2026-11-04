import * as THREE from 'three';
import type { MesherOptions, SDFFunction, Vec3 } from './types.ts';

/**
 * Welded marching tetrahedra extraction with bounded Laplacian smoothing.
 * Consistent tetrahedra avoid ambiguous four-face edges at close cloth folds.
 */

export interface MeshResult {
  geometry: THREE.BufferGeometry;
  vertexCount: number;
  triangleCount: number;
  materialsUsed: number[];
}

/**
 * Tính đạo hàm riêng (Gradient / Central Differences) để lấy pháp tuyến bề mặt chuẩn xác
 */
export function evaluateSDFNormal(sdf: SDFFunction, p: Vec3, eps = 0.002): Vec3 {
  const dx = sdf([p[0] + eps, p[1], p[2]]).distance - sdf([p[0] - eps, p[1], p[2]]).distance;
  const dy = sdf([p[0], p[1] + eps, p[2]]).distance - sdf([p[0], p[1] - eps, p[2]]).distance;
  const dz = sdf([p[0], p[1], p[2] + eps]).distance - sdf([p[0], p[1], p[2] - eps]).distance;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
  return [dx / len, dy / len, dz / len];
}

/**
 * Bảng màu tượng trưng cho các Material Slot trong chế độ Vertex Color / Fallback
 */
export const MATERIAL_COLORS: Record<number, [number, number, number]> = {
  0: [0.888, 0.584, 0.376], // Linear RGB warm skin; avoids the former chalk-white sRGB mismatch.
  1: [0.85, 0.47, 0.02], // Áo cà sa vàng nghệ (Saffron robe)
  2: [0.57, 0.25, 0.05], // Vạt áo Kasaya nâu đậm
  3: [0.98, 0.75, 0.14], // Kim loại vàng thếp (Buddha gold)
  4: [0.88, 0.91, 0.95], // Đá cẩm thạch trắng (Marble stone)
  5: [0.055, 0.075, 0.10], // Tóc xanh đen / Nhục kế
  6: [0.82, 0.15, 0.15], // Đạo cụ (chuỗi hạt, trượng, bình)
  7: [0.98, 0.98, 0.98], // Lụa trắng Quan Âm (White silk)
};

/**
 * Historical API name retained for callers; extraction uses six consistently
 * oriented tetrahedra per cube, welded by the original grid-edge identities.
 */
export function extractSurfaceNets(
  sdf: SDFFunction,
  options: MesherOptions
): MeshResult {
  const res = typeof options.resolution === 'number'
    ? [options.resolution, options.resolution, options.resolution]
    : options.resolution;

  const [nx, ny, nz] = res;
  const bounds = options.bounds;
  if (!res.every((value) => Number.isInteger(value) && value >= 2)
    || !bounds.min.every((value, axis) => Number.isFinite(value)
      && Number.isFinite(bounds.max[axis]) && bounds.max[axis] > value)) {
    throw new Error('Figure extraction requires finite bounds and a resolution of at least 2 per axis.');
  }

  const dx = (bounds.max[0] - bounds.min[0]) / (nx - 1);
  const dy = (bounds.max[1] - bounds.min[1]) / (ny - 1);
  const dz = (bounds.max[2] - bounds.min[2]) / (nz - 1);

  // 1. Quét toàn bộ điểm lưới để tính khoảng cách SDF & Material ID
  const totalGridPoints = nx * ny * nz;
  const gridDist = new Float32Array(totalGridPoints);

  const getIndex = (i: number, j: number, k: number) => (k * ny + j) * nx + i;

  for (let k = 0; k < nz; k++) {
    const z = bounds.min[2] + k * dz;
    for (let j = 0; j < ny; j++) {
      const y = bounds.min[1] + j * dy;
      for (let i = 0; i < nx; i++) {
        const x = bounds.min[0] + i * dx;
        const result = sdf([x, y, z]);
        if (!Number.isFinite(result.distance)) {
          throw new Error(`Figure SDF returned a non-finite distance at [${x}, ${y}, ${z}].`);
        }
        const idx = getIndex(i, j, k);
        gridDist[idx] = result.distance;
      }
    }
  }

  // A Freudenthal decomposition uses the same diagonal on shared cube faces.
  // Unlike one dual vertex per cell it cannot join two separate saddle sheets.
  const tetrahedra = [
    [0, 5, 1, 7], [0, 1, 3, 7], [0, 3, 2, 7],
    [0, 2, 6, 7], [0, 6, 4, 7], [0, 4, 5, 7],
  ];
  const cornerOffsets = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
  const cellVertices: number[] = [];
  const indices: number[] = [];
  const intersections = new Map<string, number>();

  const pointForGridIndex = (id: number): Vec3 => {
    const i = id % nx;
    const j = Math.floor(id / nx) % ny;
    const k = Math.floor(id / (nx * ny));
    return [bounds.min[0] + i * dx, bounds.min[1] + j * dy, bounds.min[2] + k * dz];
  };
  const intersection = (a: number, b: number): number => {
    // Always interpolate in the same direction, including shared face diagonals.
    if (a > b) [a, b] = [b, a];
    const da = gridDist[a];
    const db = gridDist[b];
    const key = da === 0 ? `v:${a}` : db === 0 ? `v:${b}` : `${a}:${b}`;
    const cached = intersections.get(key);
    if (cached !== undefined) return cached;
    const t = da === 0 ? 0 : db === 0 ? 1 : da / (da - db);
    const pa = pointForGridIndex(a);
    const pb = pointForGridIndex(b);
    const index = cellVertices.length / 3;
    cellVertices.push(
      pa[0] + (pb[0] - pa[0]) * t,
      pa[1] + (pb[1] - pa[1]) * t,
      pa[2] + (pb[2] - pa[2]) * t,
    );
    intersections.set(key, index);
    return index;
  };
  const emitTriangle = (a: number, b: number, c: number, outward: Vec3) => {
    if (a === b || b === c || c === a) return;
    const ax = cellVertices[a * 3];
    const ay = cellVertices[a * 3 + 1];
    const az = cellVertices[a * 3 + 2];
    const ux = cellVertices[b * 3] - ax;
    const uy = cellVertices[b * 3 + 1] - ay;
    const uz = cellVertices[b * 3 + 2] - az;
    const vx = cellVertices[c * 3] - ax;
    const vy = cellVertices[c * 3 + 1] - ay;
    const vz = cellVertices[c * 3 + 2] - az;
    const normal: Vec3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    if (normal[0] === 0 && normal[1] === 0 && normal[2] === 0) return;
    if (normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] < 0) {
      indices.push(a, c, b);
    } else {
      indices.push(a, b, c);
    }
  };

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const corners = cornerOffsets.map(([x, y, z]) => getIndex(i + x, j + y, k + z));
        const insideCount = corners.reduce((count, id) => count + (gridDist[id] < 0 ? 1 : 0), 0);
        if (insideCount === 0 || insideCount === 8) continue;
        for (const tetrahedron of tetrahedra) {
          const inside: number[] = [];
          const outside: number[] = [];
          for (const corner of tetrahedron) {
            const id = corners[corner];
            (gridDist[id] < 0 ? inside : outside).push(id);
          }
          if (inside.length === 0 || outside.length === 0) continue;
          const outward: Vec3 = [0, 0, 0];
          for (const id of outside) {
            const point = pointForGridIndex(id);
            for (let axis = 0; axis < 3; axis++) outward[axis] += point[axis] / outside.length;
          }
          for (const id of inside) {
            const point = pointForGridIndex(id);
            for (let axis = 0; axis < 3; axis++) outward[axis] -= point[axis] / inside.length;
          }
          if (inside.length === 1) {
            emitTriangle(
              intersection(inside[0], outside[0]), intersection(inside[0], outside[1]),
              intersection(inside[0], outside[2]), outward,
            );
          } else if (inside.length === 3) {
            emitTriangle(
              intersection(outside[0], inside[0]), intersection(outside[0], inside[1]),
              intersection(outside[0], inside[2]), outward,
            );
          } else {
            const a = intersection(inside[0], outside[0]);
            const b = intersection(inside[0], outside[1]);
            const c = intersection(inside[1], outside[0]);
            const d = intersection(inside[1], outside[1]);
            emitTriangle(a, b, d, outward);
            emitTriangle(a, d, c, outward);
          }
        }
      }
    }
  }

  // 4. Làm mịn Laplacian Mesh (Laplacian Smoothing)
  const numVertices = cellVertices.length / 3;
  const positions = new Float32Array(cellVertices);
  const smoothIterations = options.smoothIterations ?? 3;
  const smoothFactor = Math.max(0, Math.min(0.5, options.smoothFactor ?? 0.25));

  if (smoothIterations > 0 && numVertices > 0) {
    // Xây dựng danh sách kề lân cận (adjacency list)
    const neighbors: Set<number>[] = Array.from({ length: numVertices }, () => new Set());
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      neighbors[a].add(b); neighbors[a].add(c);
      neighbors[b].add(a); neighbors[b].add(c);
      neighbors[c].add(a); neighbors[c].add(b);
    }

    const tempPos = new Float32Array(positions.length);

    for (let iter = 0; iter < smoothIterations; iter++) {
      tempPos.set(positions);

      for (let v = 0; v < numVertices; v++) {
        const nbrs = neighbors[v];
        if (nbrs.size === 0) continue;

        let avgX = 0;
        let avgY = 0;
        let avgZ = 0;

        for (const n of nbrs) {
          avgX += tempPos[n * 3];
          avgY += tempPos[n * 3 + 1];
          avgZ += tempPos[n * 3 + 2];
        }

        avgX /= nbrs.size;
        avgY /= nbrs.size;
        avgZ /= nbrs.size;

        const curX = tempPos[v * 3];
        const curY = tempPos[v * 3 + 1];
        const curZ = tempPos[v * 3 + 2];

        // Dịch chuyển về tâm lân cận
        const smoothedX = curX + (avgX - curX) * smoothFactor;
        const smoothedY = curY + (avgY - curY) * smoothFactor;
        const smoothedZ = curZ + (avgZ - curZ) * smoothFactor;

        // Blended/displaced fields are not exact distance functions. Projecting
        // by their raw value can throw vertices far beyond the source surface.
        // A bounded neighbor average keeps every update within the local hull.
        positions[v * 3] = smoothedX;
        positions[v * 3 + 1] = smoothedY;
        positions[v * 3 + 2] = smoothedZ;
      }
    }
  }

  // 5. Resolve material regions on the final surface, after smoothing.
  const colors = new Float32Array(numVertices * 3);
  const regions = new Uint8Array(numVertices);
  const usedMaterialsSet = new Set<number>();

  for (let v = 0; v < numVertices; v++) {
    const px = positions[v * 3];
    const py = positions[v * 3 + 1];
    const pz = positions[v * 3 + 2];

    const matId = sdf([px, py, pz]).materialId ?? 0;
    regions[v] = matId;
    usedMaterialsSet.add(matId);
    const col = MATERIAL_COLORS[matId] ?? [0.8, 0.8, 0.8];
    colors[v * 3] = col[0];
    colors[v * 3 + 1] = col[1];
    colors[v * 3 + 2] = col[2];
  }

  // 6. Đóng gói vào Three.js BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('regionId', new THREE.Uint8BufferAttribute(regions, 1));
  geometry.setIndex(indices);
  // Normals follow the actual smoothed triangles, rather than an offset field.
  geometry.computeVertexNormals();

  // Tạo UV sơ bộ dạng cylindrical/spherical cho texture mapping
  const uvs = new Float32Array(numVertices * 2);
  const bboxHeight = (bounds.max[1] - bounds.min[1]) || 1.0;
  for (let v = 0; v < numVertices; v++) {
    const px = positions[v * 3];
    const py = positions[v * 3 + 1];
    const pz = positions[v * 3 + 2];
    const u = 0.5 + Math.atan2(pz, px) / (2.0 * Math.PI);
    const vCoord = (py - bounds.min[1]) / bboxHeight;
    uvs[v * 2] = u;
    uvs[v * 2 + 1] = vCoord;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

  return {
    geometry,
    vertexCount: numVertices,
    triangleCount: indices.length / 3,
    materialsUsed: Array.from(usedMaterialsSet),
  };
}
