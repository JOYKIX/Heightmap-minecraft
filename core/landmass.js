import { createValueNoise2D, fbm2D } from './noise.js';

const BORDER_PRESETS = {
  small: 0.08,
  standard: 0.15,
  large: 0.25,
  huge: 0.35
};

export function resolveOceanBorder(border) {
  if (typeof border === 'number') return Math.max(0.02, Math.min(0.45, border));
  return BORDER_PRESETS[border] ?? 0.15;
}

export function generateLandPotential(config) {
  const { width, height, seed } = config;
  const warpXNoise = createValueNoise2D(`${seed}:land:warp:x`, 64);
  const warpYNoise = createValueNoise2D(`${seed}:land:warp:y`, 64);
  const macroNoise = createValueNoise2D(`${seed}:land:macro`, 128);
  const coastNoise = createValueNoise2D(`${seed}:land:coast`, 192);
  const asymNoise = createValueNoise2D(`${seed}:land:asym`, 72);

  const arr = new Float32Array(width * height);
  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxDist = Math.hypot(cx, cy);
  const eps = 1e-6;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;

      const wx = (fbm2D(warpXNoise, nx, ny, 2, 2.0, 0.5, 1.4) - 0.5) * 0.2;
      const wy = (fbm2D(warpYNoise, nx, ny, 2, 2.0, 0.5, 1.4) - 0.5) * 0.2;
      const sx = nx + wx;
      const sy = ny + wy;

      const dx = x - cx + wx * width;
      const dy = y - cy + wy * height;
      const radial = Math.hypot(dx, dy) / (maxDist + eps);
      const theta = Math.atan2(dy + eps, dx + eps);

      const macro = fbm2D(macroNoise, sx, sy, 5, 2.03, 0.53, 2.8);
      const coastal = fbm2D(coastNoise, sx, sy, 4, 2.2, 0.58, 5.2);
      const asym = fbm2D(asymNoise, sx + 0.27, sy - 0.19, 3, 2.0, 0.54, 1.6);

      const directional = Math.sin(theta * 1.7 + asym * 4.5) * 0.09 + Math.cos(theta * 0.8 - asym * 3.2) * 0.06;
      const deformedRadial = radial * (1 + directional);
      const basin = Math.max(0, deformedRadial - 0.42);

      arr[i] =
        macro * 0.62 +
        coastal * 0.26 +
        asym * 0.12 -
        basin * basin * 1.35 -
        radial * 0.08;
    }
  }

  return arr;
}

export function applyOceanBorderMask(landPotential, config) {
  const { width, height } = config;
  const border = resolveOceanBorder(config.oceanBorder);
  const borderX = Math.max(1, Math.floor(width * border));
  const borderY = Math.max(1, Math.floor(height * border));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dx = Math.min(x, width - 1 - x);
      const dy = Math.min(y, height - 1 - y);
      const fx = Math.min(1, dx / borderX);
      const fy = Math.min(1, dy / borderY);
      const edgeFactor = Math.min(fx, fy);
      const pushToOcean = 1 - edgeFactor;
      if (pushToOcean <= 0) continue;
      landPotential[i] -= 2.4 * pushToOcean * pushToOcean;
    }
  }
}

export function createLandMaskByCoverage(landPotential, config) {
  const total = landPotential.length;
  const targetLand = Math.max(0.01, Math.min(0.95, config.landCoverage));
  const sorted = Array.from(landPotential).sort((a, b) => b - a);
  const cutoffIdx = Math.floor(total * targetLand);
  const threshold = sorted[Math.min(cutoffIdx, sorted.length - 1)] ?? 0;

  const mask = new Uint8Array(total);
  let landCount = 0;
  for (let i = 0; i < total; i++) {
    const isLand = landPotential[i] >= threshold ? 1 : 0;
    mask[i] = isLand;
    landCount += isLand;
  }

  return {
    mask,
    threshold,
    targetLand,
    realLand: landCount / total
  };
}

export function cleanupLandMask(mask, width, height, passes = 3) {
  const out = new Uint8Array(mask);
  const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

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

  return removeMicroIslands(out, width, height);
}

function removeMicroIslands(mask, width, height) {
  const visited = new Uint8Array(mask.length);
  const labels = new Int32Array(mask.length);
  const components = [];
  const queue = new Int32Array(mask.length);

  let currentLabel = 1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;

    let size = 0;
    while (head < tail) {
      const idx = queue[head++];
      labels[idx] = currentLabel;
      size++;
      const x = idx % width;
      const y = (idx / width) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const ni = yy * width + xx;
          if (!mask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          queue[tail++] = ni;
        }
      }
    }

    components.push({ label: currentLabel, size });
    currentLabel++;
  }

  if (components.length <= 1) return mask;

  components.sort((a, b) => b.size - a.size);
  const keepMain = components[0].label;
  const keepSecondary = components.filter((c, idx) => idx > 0 && c.size > width * height * 0.001).map((c) => c.label);
  const keep = new Set([keepMain, ...keepSecondary]);

  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && keep.has(labels[i])) out[i] = 1;
  }

  return out;
}

export function enforceOceanEdges(mask, width, height) {
  for (let x = 0; x < width; x++) {
    mask[x] = 0;
    mask[(height - 1) * width + x] = 0;
  }
  for (let y = 0; y < height; y++) {
    mask[y * width] = 0;
    mask[y * width + width - 1] = 0;
  }
  return mask;
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

export function generateGeographySkeleton(config, landMask, distanceToCoast) {
  const { width, height, seed } = config;
  const mainRidgeLine = new Float32Array(width * height);
  const mountainCore = new Float32Array(width * height);
  const lowlandBasins = new Float32Array(width * height);
  const coastalPlains = new Float32Array(width * height);
  const riverBasins = new Float32Array(width * height);
  const plateauZones = new Float32Array(width * height);

  const ridgeNoise = createValueNoise2D(`${seed}:geo:ridge`, 96);
  const basinNoise = createValueNoise2D(`${seed}:geo:basin`, 84);
  const plateauNoise = createValueNoise2D(`${seed}:geo:plateau`, 76);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const nx = x / width;
      const ny = y / height;
      const inland = Math.min(1, distanceToCoast[i] / 46);
      const ridge = Math.max(0, 1 - Math.abs(fbm2D(ridgeNoise, nx, ny, 4, 2.0, 0.52, 1.8) - 0.5) * 3.4);
      const basin = fbm2D(basinNoise, nx, ny, 3, 2.0, 0.55, 1.2);
      const plateau = Math.max(0, fbm2D(plateauNoise, nx * 0.9, ny * 1.1, 3, 2.0, 0.5, 1.5) - 0.52) * 2.1;

      mainRidgeLine[i] = ridge * inland;
      mountainCore[i] = Math.max(0, ridge * inland * inland);
      lowlandBasins[i] = Math.max(0, (1 - basin) * (1 - inland * 0.7));
      coastalPlains[i] = Math.max(0, (1 - inland) * (0.75 + basin * 0.25));
      riverBasins[i] = Math.max(0, lowlandBasins[i] * 0.6 + (1 - ridge) * 0.4);
      plateauZones[i] = plateau * inland;
    }
  }

  return { mainRidgeLine, mountainCore, lowlandBasins, coastalPlains, riverBasins, plateauZones };
}
