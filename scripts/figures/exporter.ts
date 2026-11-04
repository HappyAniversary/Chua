import * as fs from 'node:fs';
import * as path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { FigureManifest, FigureManifestEntry } from './types.ts';

/**
 * Polyfill FileReader cho môi trường Node.js để Three.js GLTFExporter chạy mượt mà
 */
class NodeFileReaderPolyfill {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onloadend) this.onloadend();
    });
  }
}

if (typeof (globalThis as Record<string, unknown>).FileReader === 'undefined') {
  (globalThis as Record<string, unknown>).FileReader = NodeFileReaderPolyfill;
}

/**
 * Xuất đối tượng Three.js (Scene, Mesh, SkinnedMesh) ra định dạng nhị phân .GLB
 */
export async function exportObjectToGLB(
  object: THREE.Object3D,
  outputPath: string
): Promise<{ buffer: Buffer; byteSize: number }> {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Đảm bảo đối tượng nằm trong một Scene để GLTFExporter bảo toàn trọn vẹn hierarchy
  let exportTarget: THREE.Object3D = object;
  if (!(object instanceof THREE.Scene)) {
    const scene = new THREE.Scene();
    scene.name = 'FigureScene';
    scene.add(object);
    exportTarget = scene;
  }

  const exporter = new GLTFExporter();
  exportTarget.updateMatrixWorld(true);

  return new Promise((resolve, reject) => {
    exporter.parse(
      exportTarget,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const buffer = Buffer.from(result);
          fs.writeFileSync(outputPath, buffer);
          resolve({ buffer, byteSize: buffer.byteLength });
        } else {
          // Trường hợp trả về JSON (fallback)
          const jsonStr = JSON.stringify(result, null, 2);
          const buffer = Buffer.from(jsonStr, 'utf-8');
          fs.writeFileSync(outputPath, buffer);
          resolve({ buffer, byteSize: buffer.byteLength });
        }
      },
      (error) => {
        reject(error);
      },
      {
        binary: true,
        onlyVisible: true,
        animations: [],
        includeCustomExtensions: true,
      }
    );
  });
}

/**
 * Cập nhật file manifest.json trong public/models/figures/manifest.json
 */
export function updateManifest(
  manifestPath: string,
  entry: FigureManifestEntry
): FigureManifest {
  let manifest: FigureManifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    figures: {},
  };

  if (fs.existsSync(manifestPath)) {
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw) as FigureManifest;
    } catch {
      // Bỏ qua lỗi cú pháp và khởi tạo mới
    }
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.version = '2.0.0';
  manifest.figures[entry.id] = entry;

  const dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return manifest;
}
