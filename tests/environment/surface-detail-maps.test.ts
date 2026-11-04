import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { getSurfaceDetailMaps } from '../../src/utils/proceduralTextures';

test('surface data maps keep deterministic gentle normals, roughness and sampler policy', () => {
  for (const kind of ['terracotta', 'stone'] as const) {
    const maps = getSurfaceDetailMaps(kind, 3, 7);
    const otherRepeat = getSurfaceDetailMaps(kind, 1, 1);
    assert.equal(maps, getSurfaceDetailMaps(kind, 3, 7));
    for (const key of ['normalMap', 'roughnessMap'] as const) {
      const map = maps[key];
      assert.equal(map.image.width, 128);
      assert.equal(map.image.height, 128);
      assert.equal(map.image.data.length, 128 * 128 * 4);
      assert.ok(map.image.data instanceof Uint8Array);
      assert.equal(map.colorSpace, THREE.NoColorSpace);
      assert.equal(map.type, THREE.UnsignedByteType);
      assert.equal(map.format, THREE.RGBAFormat);
      assert.equal(map.wrapS, THREE.RepeatWrapping);
      assert.equal(map.wrapT, THREE.RepeatWrapping);
      assert.equal(map.minFilter, THREE.LinearMipmapLinearFilter);
      assert.equal(map.magFilter, THREE.LinearFilter);
      assert.equal(map.generateMipmaps, true);
      assert.equal(map.flipY, true);
      assert.equal(map.anisotropy, 1);
      assert.deepEqual(map.repeat.toArray(), [3, 7]);
      assert.deepEqual(map.image.data, otherRepeat[key].image.data, 'repeat changes sampler density, not artwork');
    }
    const normal = maps.normalMap.image.data;
    const roughness = maps.roughnessMap.image.data;
    let minimum = 1, maximum = 0;
    for (let i = 0; i < normal.length; i += 4) {
      const nx = normal[i] / 255 * 2 - 1;
      const ny = normal[i + 1] / 255 * 2 - 1;
      const nz = normal[i + 2] / 255 * 2 - 1;
      assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1) < 0.008, 'encoded tangent normal stays normalized');
      assert.ok(nz > 0.97, 'relief must remain gentle');
      assert.equal(normal[i + 3], 255);
      const value = roughness[i + 1] / 255;
      assert.ok(value >= 0.75 && value <= 0.95);
      minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
      assert.equal(roughness[i], roughness[i + 1]);
      assert.equal(roughness[i], roughness[i + 2]);
      assert.equal(roughness[i + 3], 255);
      // Including the wrap seam, adjacent normal texels cannot introduce sharp noise.
      const next = i % (128 * 4) === 127 * 4 ? i - 127 * 4 : i + 4;
      assert.ok(Math.abs(normal[i] - normal[next]) <= 4);
      assert.ok(Math.abs(normal[i + 1] - normal[next + 1]) <= 4);
    }
    assert.ok(maximum - minimum > 0.02 && maximum - minimum < 0.12);
  }
});
