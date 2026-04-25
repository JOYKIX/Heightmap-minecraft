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
  const arr = new Float32Array(width * height);

  // Structure-first: direction field + ridge corridors + basin lobes + coastal bite
  const dirNoise = createValueNoise2D(`${seed}:world:direction`, 56);
  const warpXNoise = createValueNoise2D(`${seed}:land:warp:x`, 64);
  const warpYNoise = createValueNoise2D(`${seed}:land:warp:y`, 64);
  const continentNoise = createValueNoise2D(`${seed}:land:continent`, 120);
  const shelfNoise = createValueNoise2D(`${seed}:land:shelf`, 164);
  const bayNoise = createValueNoise2D(`${seed}:land:bay`, 88);
  const archipelagoNoise = createValueNoise2D(`${seed}:land:archipelago`, 42);

  const cx = width * 0.49;
  const cy = height * 0.53;
  const maxDist = Math.hypot(cx, cy);

  const mainDir = fbm2D(dirNoise, 0.27, 0.63, 2, 2.0, 0.5, 0.7) * Math.PI * 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;

      const wx = (fbm2D(warpXNoise, nx, ny, 3, 2.0, 0.5, 1.3) - 0.5) * 0.24;
      const wy = (fbm2D(warpYNoise, nx, ny, 3, 2.0, 0.5, 1.3) - 0.5) * 0.24;
      const sx = nx + wx;
      const sy = ny + wy;

      const dx = (x - cx) / width;
      const dy = (y - cy) / height;
      const radial = Math.hypot(dx, dy) / Math.hypot(0.5, 0.5);

      const axisDist = Math.abs(Math.sin((Math.atan2(dy, dx) - mainDir) * 1.2));
      const structuralBackbone = Math.max(0, 1 - axisDist * 1.25) * Math.max(0, 1 - radial * 1.15);

      const continent = fbm2D(continentNoise, sx, sy, 5, 2.03, 0.52, 2.3);
      const shelf = fbm2D(shelfNoise, sx * 1.1 + 0.13, sy * 0.9 - 0.19, 4, 2.1, 0.56, 4.8);
      const bayCut = Math.max(0, fbm2D(bayNoise, sx * 0.85 - 0.27, sy * 1.15 + 0.1, 3, 2.0, 0.5, 1.4) - 0.56);
      const archipelago = Math.max(0, fbm2D(archipelagoNoise, nx * 1.8 + 0.2, ny * 1.7 - 0.3, 2, 2.0, 0.54, 1.1) - 0.65);

      const irregularFalloff = Math.pow(Math.max(0, radial - 0.35), 1.7) * (1.1 + shelf * 0.45 + bayCut * 0.8);
      const peninsulaBoost = Math.max(0, structuralBackbone - radial * 0.2) * 0.42;

      arr[i] =
        continent * 0.54 +
        shelf * 0.24 +
        structuralBackbone * 0.21 +
        peninsulaBoost +
        archipelago * 0.28 -
        irregularFalloff * 1.45 -
        bayCut * (0.5 + radial * 0.6);
    }
  }

  return arr;
}

export function applyOceanBorderMask(landPotential, config) {
  const { width, height } = config;
  const border = resolveOceanBorder(config.oceanBorder);
  const borderX = Math.max(2, Math.floor(width * border));
  const borderY = Math.max(2, Math.floor(height * border));

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
      landPotential[i] -= (2.65 + pushToOcean * 0.9) * pushToOcean * pushToOcean;
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
  const keepSecondary = components.filter((c, idx) => idx > 0 && c.size > width * height * 0.0006).map((c) => c.label);
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
  const total = width * height;

  const worldStructureMap = new Float32Array(total);
  const terrainDirectionField = new Float32Array(total);
  const mainRidgeLine = new Float32Array(total);
  const mountainCore = new Float32Array(total);
  const lowlandBasins = new Float32Array(total);
  const coastalPlains = new Float32Array(total);
  const riverBasins = new Float32Array(total);
  const plateauZones = new Float32Array(total);

  const structureNoise = createValueNoise2D(`${seed}:geo:structure`, 92);
  const dirNoise = createValueNoise2D(`${seed}:geo:direction`, 66);
  const ridgeNoise = createValueNoise2D(`${seed}:geo:ridge`, 74);
  const basinNoise = createValueNoise2D(`${seed}:geo:basin`, 84);
  const plateauNoise = createValueNoise2D(`${seed}:geo:plateau`, 88);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const nx = x / width;
      const ny = y / height;
      const inland = Math.min(1, distanceToCoast[i] / 54);
      const dir = fbm2D(dirNoise, nx, ny, 3, 2.0, 0.52, 1.1) * Math.PI * 2;
      terrainDirectionField[i] = dir;

      const structure = fbm2D(structureNoise, nx, ny, 4, 2.0, 0.52, 1.4);
      const directionalRidge = Math.max(0, 1 - Math.abs(Math.sin((nx * Math.cos(dir) + ny * Math.sin(dir)) * Math.PI * 8 + dir)));
      const ridge = Math.max(0, 1 - Math.abs(fbm2D(ridgeNoise, nx, ny, 4, 2.0, 0.52, 1.6) - 0.5) * 3.4);
      const basin = fbm2D(basinNoise, nx * 1.05, ny * 0.95, 3, 2.0, 0.55, 1.2);
      const plateau = Math.max(0, fbm2D(plateauNoise, nx * 0.9, ny * 1.1, 3, 2.0, 0.5, 1.35) - 0.56) * 2.3;

      worldStructureMap[i] = clamp01(structure * 0.45 + ridge * 0.28 + directionalRidge * 0.27);
      mainRidgeLine[i] = clamp01((ridge * 0.65 + directionalRidge * 0.35) * inland);
      mountainCore[i] = clamp01(mainRidgeLine[i] * inland * (0.7 + worldStructureMap[i] * 0.5));
      lowlandBasins[i] = clamp01((1 - basin) * (1 - inland * 0.75) * (0.7 + (1 - ridge) * 0.3));
      coastalPlains[i] = clamp01((1 - inland) * (0.75 + basin * 0.25));
      riverBasins[i] = clamp01(lowlandBasins[i] * 0.54 + (1 - mainRidgeLine[i]) * 0.32 + (1 - worldStructureMap[i]) * 0.14);
      plateauZones[i] = clamp01(plateau * inland * (0.65 + worldStructureMap[i] * 0.25));
    }
  }

  return {
    worldStructureMap,
    terrainDirectionField,
    mainRidgeLine,
    mountainCore,
    lowlandBasins,
    coastalPlains,
    riverBasins,
    plateauZones
  };
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
