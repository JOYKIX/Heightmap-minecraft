import { createValueNoise2D, fbm2D } from './noise.js';

const BORDER_PRESETS = {
  small: 0.08,
  standard: 0.15,
  large: 0.25,
  huge: 0.35
};

export function resolveOceanBorder(border) {
  if (typeof border === 'number') return border;
  return BORDER_PRESETS[border] ?? 0.15;
}

export function generateLandPotential(config) {
  const { width, height, seed } = config;
  const n1 = createValueNoise2D(`${seed}:land:macro`, 128);
  const n2 = createValueNoise2D(`${seed}:land:detail`, 256);
  const arr = new Float32Array(width * height);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxDist = Math.hypot(cx, cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;
      const radial = Math.hypot(x - cx, y - cy) / maxDist;
      const macro = fbm2D(n1, nx, ny, 5, 2.05, 0.52, 3.0);
      const detail = fbm2D(n2, nx, ny, 3, 2.0, 0.6, 8.0);
      arr[i] = macro * 0.75 + detail * 0.25 - radial * 0.35;
    }
  }
  return arr;
}

export function applyOceanBorder(landPotential, config) {
  const { width, height } = config;
  const border = resolveOceanBorder(config.oceanBorder);
  const borderX = Math.floor(width * border);
  const borderY = Math.floor(height * border);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      const fx = Math.min(1, dx / Math.max(1, borderX));
      const fy = Math.min(1, dy / Math.max(1, borderY));
      const falloff = Math.min(fx, fy);
      landPotential[i] -= (1 - falloff) * 2.0;
    }
  }
}

export function createLandMaskByCoverage(landPotential, config) {
  const total = landPotential.length;
  const sorted = Array.from(landPotential).sort((a, b) => b - a);
  const cutoffIdx = Math.floor(total * config.landCoverage);
  const threshold = sorted[Math.min(cutoffIdx, sorted.length - 1)] ?? 0;
  const mask = new Uint8Array(total);
  for (let i = 0; i < total; i++) mask[i] = landPotential[i] >= threshold ? 1 : 0;
  return { mask, threshold };
}

export function cleanupLandMask(mask, width, height, passes = 2) {
  const out = new Uint8Array(mask);
  const neighbors = [
    -width - 1, -width, -width + 1,
    -1, 1,
    width - 1, width, width + 1
  ];
  for (let p = 0; p < passes; p++) {
    const src = new Uint8Array(out);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        let count = 0;
        for (const n of neighbors) count += src[i + n];
        if (src[i] === 1 && count <= 2) out[i] = 0;
        else if (src[i] === 0 && count >= 6) out[i] = 1;
      }
    }
  }
  return out;
}

export function validateNoLandTouchesEdges(mask, width, height) {
  for (let x = 0; x < width; x++) {
    if (mask[x] || mask[(height - 1) * width + x]) return false;
  }
  for (let y = 0; y < height; y++) {
    if (mask[y * width] || mask[y * width + width - 1]) return false;
  }
  return true;
}
