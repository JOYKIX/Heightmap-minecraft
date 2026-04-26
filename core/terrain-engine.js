import { createRng } from './random.js';
import { quantizeToMinecraftY, toGray16Array } from './heightmap-export.js';
import { fbm2D } from './noise.js';
import { clamp } from '../js/utils.js';

const RELIEF_PRESETS = {
  soft: { macro: 36, meso: 10, mountain: 46, erosion: 2, riverDepth: 5 },
  normal: { macro: 54, meso: 14, mountain: 78, erosion: 3, riverDepth: 7 },
  mountainous: { macro: 74, meso: 18, mountain: 114, erosion: 4, riverDepth: 9 },
  extreme: { macro: 98, meso: 24, mountain: 156, erosion: 5, riverDepth: 12 }
};

const ISLAND_SIZE = {
  small: { radius: 0.3, coastNoise: 0.16, satellites: [0, 1], edgeMargin: 0.2 },
  medium: { radius: 0.38, coastNoise: 0.18, satellites: [1, 2], edgeMargin: 0.15 },
  large: { radius: 0.46, coastNoise: 0.2, satellites: [2, 3], edgeMargin: 0.12 },
  immense: { radius: 0.54, coastNoise: 0.22, satellites: [2, 4], edgeMargin: 0.1 }
};

const STYLE = {
  balanced: { warp: 0.12, ridgeBoost: 1, archipelago: 0.3, coastalDrama: 0.4, mountainShift: 0.1 },
  archipelago: { warp: 0.16, ridgeBoost: 0.7, archipelago: 1, coastalDrama: 0.35, mountainShift: 0.2 },
  mountainous: { warp: 0.1, ridgeBoost: 1.35, archipelago: 0.2, coastalDrama: 0.5, mountainShift: 0.35 },
  dramatic_coast: { warp: 0.2, ridgeBoost: 1.05, archipelago: 0.45, coastalDrama: 1, mountainShift: 0.25 }
};

const steps = [
  '1. Squelette d\'île',
  '2. Application island size',
  '3. Forme organique (warp + fbm)',
  '4. Génération des côtes',
  '5. Distance to coast',
  '6. Océan + fonds marins',
  '7. Altitude de base',
  '8. Macro relief',
  '9. Chaînes montagneuses',
  '10. Collines et plateaux',
  '11. Vallées',
  '12. Rivières',
  '13. Érosion',
  '14. Nettoyage artefacts',
  '15. Quantification Y Minecraft',
  '16. Conversion gray16'
];

function ridgedNoise(x, y, seed, octaves = 4) {
  let sum = 0;
  let frequency = 1;
  let amplitude = 0.6;
  for (let i = 0; i < octaves; i++) {
    const n = fbm2D(x * frequency, y * frequency, 1, 2, 0.5, seed + 61 * i);
    const ridge = 1 - Math.abs(n * 2 - 1);
    sum += ridge * ridge * amplitude;
    frequency *= 2;
    amplitude *= 0.5;
  }
  return clamp(sum, 0, 1);
}

function signedDistanceFromMask(mask, width, height) {
  const out = new Float32Array(width * height);
  const maxR = Math.hypot(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const current = mask[i];
      let best = maxR;
      for (let oy = -14; oy <= 14; oy++) {
        const ny = y + oy;
        if (ny < 0 || ny >= height) continue;
        for (let ox = -14; ox <= 14; ox++) {
          const nx = x + ox;
          if (nx < 0 || nx >= width) continue;
          const ni = ny * width + nx;
          if (mask[ni] === current) continue;
          const d = Math.hypot(ox, oy);
          if (d < best) best = d;
        }
      }
      out[i] = current ? best : -best;
    }
  }
  return out;
}

function thermalErosion(height, width, iterations = 3, talus = 1.25) {
  const out = new Float32Array(height);
  for (let k = 0; k < iterations; k++) {
    out.set(height);
    for (let y = 1; y < width - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const current = height[i];
        const n = [i - 1, i + 1, i - width, i + width];
        for (const ni of n) {
          const diff = current - height[ni];
          if (diff > talus) {
            const moved = (diff - talus) * 0.25;
            out[i] -= moved;
            out[ni] += moved;
          }
        }
      }
    }
    height.set(out);
  }
  return height;
}

function hydraulicPass(height, width, seaLevel) {
  const out = new Float32Array(height);
  out.set(height);
  for (let y = 1; y < width - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (height[i] < seaLevel + 2) continue;
      const here = height[i];
      const neighbors = [i - 1, i + 1, i - width, i + width];
      let low = here;
      for (const ni of neighbors) low = Math.min(low, height[ni]);
      const slope = here - low;
      if (slope > 3) out[i] -= slope * 0.08;
      if (slope < 0.7) out[i] += 0.2;
    }
  }
  return out;
}

function carveRivers(height, width, mask, seaLevel, rng, relief) {
  const riverMask = new Uint8Array(height.length);
  let riverCount = 0;
  const attempts = Math.max(10, Math.round(width / 64));
  for (let a = 0; a < attempts; a++) {
    let sx = 0;
    let sy = 0;
    let source = -1;
    for (let t = 0; t < 1200; t++) {
      sx = Math.floor(rng() * width);
      sy = Math.floor(rng() * width);
      const i = sy * width + sx;
      if (mask[i] && height[i] > seaLevel + 35) {
        source = i;
        break;
      }
    }
    if (source < 0) continue;

    let i = source;
    const seen = new Set([i]);
    let length = 0;
    while (length < width * 2) {
      const y = Math.floor(i / width);
      const x = i - y * width;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= width - 2) break;
      if (!mask[i] || height[i] <= seaLevel + 1) break;
      riverMask[i] = 1;
      const neighbors = [i - 1, i + 1, i - width, i + width, i - width - 1, i - width + 1, i + width - 1, i + width + 1];
      let next = i;
      let best = height[i];
      for (const ni of neighbors) {
        if (height[ni] < best) {
          best = height[ni];
          next = ni;
        }
      }
      if (next === i || seen.has(next)) break;
      seen.add(next);
      i = next;
      length++;
    }

    if (length > width / 12) {
      riverCount++;
    }
  }

  for (let y = 1; y < width - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!riverMask[i]) continue;
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          const ni = (y + oy) * width + (x + ox);
          const d = Math.hypot(ox, oy);
          if (d > 2.4) continue;
          const carving = relief.riverDepth * (1 - d / 2.4);
          height[ni] = Math.max(seaLevel - 2, height[ni] - carving);
        }
      }
    }
  }

  return { height, riverCount };
}

function noLandOnEdges(mask, width) {
  for (let x = 0; x < width; x++) {
    if (mask[x] || mask[(width - 1) * width + x]) return false;
  }
  for (let y = 0; y < width; y++) {
    if (mask[y * width] || mask[y * width + width - 1]) return false;
  }
  return true;
}

export function generateProceduralIsland(config) {
  const t0 = performance.now();
  const size = ISLAND_SIZE[config.islandSize] || ISLAND_SIZE.medium;
  const style = STYLE[config.style] || STYLE.balanced;
  const relief = RELIEF_PRESETS[config.relief] || RELIEF_PRESETS.normal;

  const width = Number(config.resolution);
  const height = width;
  const seedRng = createRng(config.seed || 'island');
  const seed = Math.floor(seedRng() * 1e9);
  const rand = createRng(`${config.seed}-pipe`);

  const centerX = 0.5 + (rand() - 0.5) * style.mountainShift;
  const centerY = 0.5 + (rand() - 0.5) * style.mountainShift;

  const potential = new Float32Array(width * height);
  const landMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;

      const warpX = fbm2D(nx * 1.2, ny * 1.2, 4, 2, 0.5, seed + 9) - 0.5;
      const warpY = fbm2D(nx * 1.2, ny * 1.2, 4, 2, 0.5, seed + 10) - 0.5;
      const wx = nx + warpX * style.warp;
      const wy = ny + warpY * style.warp;

      const dx = wx - centerX;
      const dy = wy - centerY;
      const radial = Math.hypot(dx, dy) / size.radius;
      const silhouette = fbm2D(wx * 2.4, wy * 2.4, 5, 2, 0.52, seed + 18) - 0.5;
      const coastBreakup = fbm2D(wx * 7.5, wy * 7.5, 3, 2, 0.45, seed + 22) - 0.5;

      const p = 1 - radial + silhouette * size.coastNoise + coastBreakup * 0.035;
      potential[i] = p;
      const borderDist = Math.min(nx, ny, 1 - nx, 1 - ny);
      landMask[i] = p > 0 && borderDist > size.edgeMargin ? 1 : 0;
    }
  }

  const satellites = size.satellites[0] + Math.floor(rand() * (size.satellites[1] - size.satellites[0] + 1));
  for (let s = 0; s < satellites; s++) {
    if (rand() > style.archipelago) continue;
    const ix = 0.15 + rand() * 0.7;
    const iy = 0.15 + rand() * 0.7;
    const radius = (0.035 + rand() * 0.055) * (style.archipelago + 0.5);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const nx = x / width;
        const ny = y / width;
        const d = Math.hypot(nx - ix, ny - iy) / radius;
        const n = fbm2D(nx * 4, ny * 4, 3, 2, 0.5, seed + 300 + s) - 0.5;
        if (1 - d + n * 0.18 > 0.18 && Math.min(nx, ny, 1 - nx, 1 - ny) > size.edgeMargin) landMask[i] = 1;
      }
    }
  }

  const distanceToCoast = signedDistanceFromMask(landMask, width, height);
  const terrain = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / width;
      const coastDist = distanceToCoast[i];

      if (!landMask[i]) {
        const deep = clamp(-coastDist / 16, 0, 1);
        const shelf = clamp((-coastDist - 3) / 10, 0, 1);
        terrain[i] = config.seaLevel - 8 - deep * 72 + shelf * 10;
        continue;
      }

      const inland = clamp(coastDist / 24, 0, 1);
      const macro = fbm2D(nx * 1.7, ny * 1.7, 4, 2, 0.52, seed + 40) - 0.5;
      const meso = fbm2D(nx * 5.2, ny * 5.2, 4, 2, 0.5, seed + 41) - 0.5;
      const ridges = ridgedNoise(nx * 3.2 + 2, ny * 3.2 + 2, seed + 42, 4);
      const mountainMask = clamp((fbm2D(nx * 1.1, ny * 1.1, 3, 2, 0.5, seed + 43) - 0.43) * 2.4, 0, 1);
      const valleyMask = clamp((0.52 - fbm2D(nx * 2.6, ny * 2.6, 3, 2, 0.5, seed + 44)) * 1.8, 0, 1);

      let h = config.seaLevel + 2;
      h += inland * 8;
      h += macro * relief.macro;
      h += meso * relief.meso;
      h += ridges * mountainMask * relief.mountain * style.ridgeBoost;
      h -= valleyMask * 10;

      if (coastDist < 5) {
        const beachToCliff = clamp(style.coastalDrama * (fbm2D(nx * 8, ny * 8, 2, 2, 0.5, seed + 45) - 0.3), 0, 1);
        h = clamp(h, config.seaLevel - 1, config.seaLevel + 7 + beachToCliff * 18);
      }

      terrain[i] = h;
    }
  }

  const riverResult = carveRivers(terrain, width, landMask, config.seaLevel, rand, relief);
  let eroded = riverResult.height;
  eroded = thermalErosion(eroded, width, relief.erosion, 1.1 + relief.erosion * 0.1);
  eroded = hydraulicPass(eroded, width, config.seaLevel);

  for (let i = 0; i < eroded.length; i++) {
    if (!Number.isFinite(eroded[i])) eroded[i] = config.seaLevel - 10;
    eroded[i] = clamp(eroded[i], config.minY, config.maxY);
  }

  const yMap = quantizeToMinecraftY(eroded, config.minY, config.maxY);
  const gray16 = toGray16Array(yMap, config.minY, config.maxY);

  let minY = Infinity;
  let maxY = -Infinity;
  let land = 0;
  let edgeLand = 0;
  for (let i = 0; i < yMap.length; i++) {
    minY = Math.min(minY, yMap[i]);
    maxY = Math.max(maxY, yMap[i]);
    if (yMap[i] > config.seaLevel) land++;
  }
  for (let x = 0; x < width; x++) {
    edgeLand += yMap[x] > config.seaLevel ? 1 : 0;
    edgeLand += yMap[(height - 1) * width + x] > config.seaLevel ? 1 : 0;
  }

  const validations = {
    noLandOnEdges: noLandOnEdges(landMask, width),
    waterAroundIsland: edgeLand === 0,
    finiteValues: true,
    minecraftRangeOk: minY >= config.minY && maxY <= config.maxY,
    seaLevel: config.seaLevel,
    export16BitReady: gray16 instanceof Uint16Array,
    nonFlat: maxY - minY > 35
  };

  return {
    width,
    height,
    yMap,
    gray16,
    settings: { minY: config.minY, maxY: config.maxY, seaLevel: config.seaLevel },
    stats: {
      mapSize: width,
      islandSize: config.islandSize,
      relief: config.relief,
      style: config.style,
      minY,
      maxY,
      seaLevel: config.seaLevel,
      landPct: ((land / yMap.length) * 100).toFixed(2),
      oceanPct: (100 - (land / yMap.length) * 100).toFixed(2),
      rivers: riverResult.riverCount,
      generationMs: Math.round(performance.now() - t0),
      worldPainter: 'Compatible 16-bit grayscale, 1px = 1 bloc',
      validations,
      pipeline: steps
    }
  };
}
