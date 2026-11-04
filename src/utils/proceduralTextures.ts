import * as THREE from 'three';

/**
 * Bộ tạo Texture PBR Procedural (Canvas2D-based) ngay trong bộ nhớ (Zero-network-asset).
 * Hỗ trợ tạo texture độ phân giải cao cho:
 * 1. Gạch Tàu Bát Tràng (Sân chùa)
 * 2. Đá Xanh Chạm Khắc (Đường Thần Đạo & thềm tam cấp)
 * 3. Gỗ Lim Sơn Son Cổ Truyền (Cột, xà, hoành phi)
 * 4. Ngói Lưu Ly Âm Dương (Mái đao cong)
 * 5. Cát Vườn Thiền Karesansui (Hậu viện)
 *
 * Áp dụng singleton cache để tránh tạo lại Texture khi re-render.
 */

// Process-lifetime, shared cache: materials never dispose these maps on unmount.
// Renderer quality policy owns capability-clamped anisotropy, applied on scene changes.
const textureCache = new Map<string, THREE.CanvasTexture>();

export interface SurfaceDetailMaps {
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}
const surfaceDetailCache = new Map<string, SurfaceDetailMaps>();

/** Subtle, seamless tangent-space relief. Four broad tile waves match the
 * terracotta atlas; stone uses only one/two-cycle waves, avoiding pixel noise.
 * Shared maps are cache-owned. Quality policy sets capability-aware anisotropy.
 */
export function getSurfaceDetailMaps(
  kind: 'terracotta' | 'stone', repeatX = 1, repeatY = 1
): SurfaceDetailMaps {
  const key = `${kind}_${repeatX}_${repeatY}`;
  const cached = surfaceDetailCache.get(key);
  if (cached) return cached;
  const size = 128;
  const normals = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    let du: number, dv: number, value: number;
    if (kind === 'terracotta') {
      const drift = Math.cos(tau * (u + v)) * 0.002 * tau;
      du = -Math.sin(tau * 4 * u) * 0.004 * 4 * tau + drift;
      dv = -Math.sin(tau * 4 * v) * 0.004 * 4 * tau + drift;
      value = 0.86 + 0.025 * Math.cos(tau * u) * Math.cos(tau * v)
        + 0.0125 * (Math.cos(tau * 4 * u) + Math.cos(tau * 4 * v));
    } else {
      const broad = Math.cos(tau * (2 * u + v)) * 0.003 * tau;
      const cross = Math.sin(tau * (u - 2 * v)) * 0.0015 * tau;
      du = 2 * broad - cross;
      dv = broad + 2 * cross;
      value = 0.82 + 0.035 * Math.sin(tau * u) * Math.cos(tau * v);
    }
    const length = Math.hypot(du, dv, 1);
    const offset = (y * size + x) * 4;
    normals.set([
      Math.round((-du / length * 0.5 + 0.5) * 255),
      Math.round((-dv / length * 0.5 + 0.5) * 255),
      Math.round((1 / length * 0.5 + 0.5) * 255), 255,
    ], offset);
    const channel = Math.round(value * 255);
    roughness.set([channel, channel, channel, 255], offset);
  }
  const createMap = (data: Uint8Array) => {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.flipY = true; // Match CanvasTexture color maps.
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
    return texture;
  };
  const result = { normalMap: createMap(normals), roughnessMap: createMap(roughness) };
  surfaceDetailCache.set(key, result);
  return result;
}

/** Local seeded generator: a cache miss produces identical pixels on every reload.
 * Seed by texture family, not repeat, so two map densities share the same artwork.
 */
export function createTextureRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function setupTexture(
  texture: THREE.CanvasTexture,
  repeatX = 1,
  repeatY = 1,
  anisotropy = 1
): THREE.CanvasTexture {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * 1. Texture Gạch Tàu Bát Tràng (Sân Chùa)
 * Gạch vuông đỏ đất nung truyền thống đan xen, có mạch vữa xám và vết rêu phong tự nhiên.
 */
export function getTerracottaTileTexture(repeatX = 12, repeatY = 12): THREE.CanvasTexture {
  const cacheKey = `terracotta_${repeatX}_${repeatY}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const random = createTextureRandom(1103);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Nền mạch vữa xám đen cổ kính
  ctx.fillStyle = '#766660';
  ctx.fillRect(0, 0, size, size);

  const gridSize = 4;
  const tileSize = size / gridSize;
  const mortarWidth = 6;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const x = col * tileSize + mortarWidth / 2;
      const y = row * tileSize + mortarWidth / 2;
      const w = tileSize - mortarWidth;
      const h = tileSize - mortarWidth;

      // Độ biến thiên màu gạch nung thủ công
      const seed = Math.sin(row * 17 + col * 31);
      const redBase = 158 + Math.floor(seed * 9);
      const greenBase = 79 + Math.floor(seed * 6);
      const blueBase = 61 + Math.floor(seed * 5);

      const grad = ctx.createRadialGradient(
        x + w * 0.45,
        y + h * 0.45,
        w * 0.1,
        x + w / 2,
        y + h / 2,
        w * 0.75
      );
      grad.addColorStop(0, `rgb(${redBase + 4}, ${greenBase + 3}, ${blueBase + 2})`);
      grad.addColorStop(0.7, `rgb(${redBase}, ${greenBase}, ${blueBase})`);
      grad.addColorStop(1, `rgb(${redBase - 5}, ${greenBase - 3}, ${blueBase - 2})`);

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Vân gạch đất nung & hạt khoáng li ti
      ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
      for (let i = 0; i < 40; i++) {
        const nx = x + random() * w;
        const ny = y + random() * h;
        const ns = random() * 2.5;
        ctx.fillRect(nx, ny, ns, ns);
      }

      // Vết phong sương nhẹ ở góc gạch
      if ((row + col) % 3 === 0) {
        ctx.fillStyle = 'rgba(40, 55, 30, 0.1)';
        ctx.beginPath();
        ctx.arc(x + w * 0.2, y + h * 0.8, w * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  setupTexture(texture, repeatX, repeatY);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 2. Texture Đá Xanh Thanh Hóa Chạm Khắc (Đường Thần Đạo & Tam Cấp)
 * Đá xanh tự nhiên có vân rạn, hoa văn chạm sen chìm và bề mặt nhám cổ.
 */
export function getCarvedStoneTexture(repeatX = 4, repeatY = 16): THREE.CanvasTexture {
  const cacheKey = `carved_stone_${repeatX}_${repeatY}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const random = createTextureRandom(2207);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Nền đá xanh xám
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, size, size);

  // Lớp vân đá tự nhiên gợn sóng
  for (let i = 0; i < 30; i++) {
    const y = (i / 30) * size;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(71, 85, 105, 0.16)' : 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 3 + random() * 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.3,
      y + (random() - 0.5) * 40,
      size * 0.7,
      y + (random() - 0.5) * 40,
      size,
      y + (random() - 0.5) * 20
    );
    ctx.stroke();
  }

  // Viền gờ đá chạm hoa văn hình học cổ
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, size - 12, size - 12);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, size - 28, size - 28);

  // Đốm chấm hạt thạch anh sáng tối trên đá
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let i = 0; i < 200; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  setupTexture(texture, repeatX, repeatY);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 3. Texture Gỗ Lim Sơn Son Thếp Vàng Cổ Truyền (Cột cái, xà ngang)
 * Vân gỗ sớ dọc màu nâu đỏ thẫm ấm áp với ánh bóng nhạt.
 */
export function getLacquerWoodTexture(repeatX = 2, repeatY = 8): THREE.CanvasTexture {
  const cacheKey = `lacquer_wood_${repeatX}_${repeatY}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const random = createTextureRandom(3313);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Nền đỏ son trầm thẫm (màu gỗ lim ngâm / sơn ta)
  // Neutral tint: material.color supplies lacquer red without multiplying it twice.
  ctx.fillStyle = '#c9bcb3';
  ctx.fillRect(0, 0, size, size);

  // Các đường sớ gỗ chạy dọc thân cột
  for (let col = 0; col < size; col += 4) {
    const darkness = Math.sin(col * 0.08) * 0.035 + (random() - 0.5) * 0.02;
    ctx.fillStyle = darkness > 0 ? `rgba(78, 61, 48, ${darkness + 0.025})` : `rgba(239, 218, 198, ${Math.abs(darkness) * 0.8})`;
    ctx.fillRect(col, 0, 3 + random() * 2, size);
  }

  // Vệt vân uốn lượn tự nhiên
  ctx.strokeStyle = 'rgba(78, 61, 48, 0.06)';
  ctx.lineWidth = 8;
  for (let i = 0; i < 5; i++) {
    const x = 50 + i * 90;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 25, size * 0.4, x - 25, size * 0.7, x + 10, size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  setupTexture(texture, repeatX, repeatY);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 4. Texture Ngói Âm Dương Cổ (Mái Chùa & Mái Cổng Tam Quan)
 * Hàng rãnh ngói ống tròn lượn sóng nổi khối, mép giọt nước và viền đỏ cam sẫm.
 */
export function getRoofTileTexture(repeatX = 8, repeatY = 6): THREE.CanvasTexture {
  const cacheKey = `roof_tile_${repeatX}_${repeatY}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Nền ngói màu nâu đỏ đất nung
  // Low-contrast warm neutral atlas, tinted by each roof material.
  ctx.fillStyle = '#c8bbb0';
  ctx.fillRect(0, 0, size, size);

  const numTilesX = 8;
  const tileWidth = size / numTilesX;

  // Hàng ngói ống âm dương dọc theo chiều dốc mái
  for (let i = 0; i < numTilesX; i++) {
    const x = i * tileWidth;

    // Gradient tạo hình trụ bán nguyệt cho viên ngói ống lồi
    const grad = ctx.createLinearGradient(x, 0, x + tileWidth, 0);
    grad.addColorStop(0, '#bdb0a5'); // Rãnh lõm tối
    grad.addColorStop(0.2, '#cbbdb1');
    grad.addColorStop(0.5, '#d4c6ba'); // Đỉnh ngói lồi bắt sáng
    grad.addColorStop(0.8, '#cbbdb1');
    grad.addColorStop(1, '#bdb0a5'); // Rãnh lõm tối

    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, tileWidth, size);

    // Đường gờ xếp lớp giữa các tầng ngói ngang
    const numTiers = 8;
    const tierHeight = size / numTiers;
    for (let t = 0; t < numTiers; t++) {
      const y = t * tierHeight;
      ctx.fillStyle = 'rgba(74, 57, 45, 0.12)';
      ctx.fillRect(x, y, tileWidth, 3);
      ctx.fillStyle = 'rgba(255, 236, 218, 0.06)';
      ctx.fillRect(x, y + 3, tileWidth, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  setupTexture(texture, repeatX, repeatY);
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * 5. Texture Vườn Cát Thiền (Karesansui Sand)
 * Các đường gợn sóng cào cát thiền định màu trắng xám nhẹ.
 */
export function getZenSandTexture(repeatX = 6, repeatY = 6): THREE.CanvasTexture {
  const cacheKey = `zen_sand_${repeatX}_${repeatY}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const random = createTextureRandom(5527);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Nền cát trắng ngà
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, size, size);

  // Đường cào gợn sóng cát thiền định
  const waveHeight = 24;
  for (let y = 0; y < size; y += waveHeight) {
    const grad = ctx.createLinearGradient(0, y, 0, y + waveHeight);
    grad.addColorStop(0, '#d6dce3');
    grad.addColorStop(0.5, '#e6eaf0');
    grad.addColorStop(1, '#cbd3dc');

    ctx.fillStyle = grad;
    ctx.fillRect(0, y, size, waveHeight);
  }

  // Hạt cát mịn
  ctx.fillStyle = 'rgba(100, 116, 139, 0.1)';
  for (let i = 0; i < 300; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  setupTexture(texture, repeatX, repeatY);
  textureCache.set(cacheKey, texture);
  return texture;
}
