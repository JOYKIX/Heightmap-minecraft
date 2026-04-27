import { quantizeToMinecraftY, toGray16Array } from './heightmap-export.js';
import { fbm2D } from './noise.js';
import { clamp, lerp } from '../js/utils.js';

const ISLAND_SIZE = {
  small: { radius: 0.58, threshold: 0.62, border: 0.18, archipelagoBoost: 0.9 },
  medium: { radius: 0.72, threshold: 0.54, border: 0.13, archipelagoBoost: 1 },
  large: { radius: 0.86, threshold: 0.47, border: 0.09, archipelagoBoost: 1.08 },
  huge: { radius: 0.96, threshold: 0.41, border: 0.05, archipelagoBoost: 1.15 },
  immense: { radius: 0.96, threshold: 0.41, border: 0.05, archipelagoBoost: 1.15 }
};

const RELIEF = {
  soft: { macroAmp: 12, hillAmp: 8, mountainAmp: 56, valleyAmp: 8, erosionPasses: 2, riverDepth: 2 },
  normal: { macroAmp: 18, hillAmp: 12, mountainAmp: 88, valleyAmp: 12, erosionPasses: 3, riverDepth: 3 },
  mountainous: { macroAmp: 24, hillAmp: 16, mountainAmp: 132, valleyAmp: 18, erosionPasses: 5, riverDepth: 5 },
  extreme: { macroAmp: 32, hillAmp: 20, mountainAmp: 176, valleyAmp: 24, erosionPasses: 7, riverDepth: 6 }
};

const STYLE = {
  balanced: { warp: 0.24, coastBreak: 0.35, mountainBias: 0.55, archipelago: 0.25, drama: 0.45 },
  archipelago: { warp: 0.3, coastBreak: 0.45, mountainBias: 0.5, archipelago: 1, drama: 0.35 },
  mountainous: { warp: 0.2, coastBreak: 0.3, mountainBias: 0.66, archipelago: 0.15, drama: 0.5 },
  dramatic: { warp: 0.32, coastBreak: 0.56, mountainBias: 0.62, archipelago: 0.35, drama: 1 },
  dramatic_coast: { warp: 0.32, coastBreak: 0.56, mountainBias: 0.62, archipelago: 0.35, drama: 1 }
};

const PIPELINE = [
  '1. Initialiser la seed',
  '2. Créer les coordonnées normalisées',
  '3. Générer un masque d’île organique',
  '4. Appliquer la taille de l’île',
  '5. Garantir l’eau sur les bords',
  '6. Créer les îles secondaires si style archipel',
  '7. Nettoyer le masque terre/mer',
  '8. Calculer distanceToCoast',
  '9. Générer l’océan et les fonds marins',
  '10. Générer l’altitude terrestre de base',
  '11. Générer le macro relief',
  '12. Générer les collines',
  '13. Générer les montagnes',
  '14. Générer les plateaux',
  '15. Générer les vallées',
  '16. Générer les rivières',
  '17. Appliquer érosion légère',
  '18. Nettoyer les artefacts',
  '19. Quantifier en Y Minecraft entier',
  '20. Convertir en 16-bit grayscale',
  '21. Afficher preview',
  '22. Exporter PNG'
];

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0, edge1, x) {
  if (edge1 === edge0) return 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createSeededRandom(seed) {
  return mulberry32(hashString(seed));
}

function ridged(v) {
  return 1 - Math.abs(v * 2 - 1);
}

function ridgedFbm(nx, ny, seed, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let ampSum = 0;
  for (let i = 0; i < octaves; i++) {
    const n = fbm2D(nx * freq, ny * freq, 1, 2, 0.5, seed + 97 * i);
    sum += ridged(n) * amp;
    ampSum += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return ampSum > 0 ? sum / ampSum : 0;
}

function createIslandBlobs(seed, styleCfg) {
  const rand = createSeededRandom(`blob-${seed}`);
  const blobCount = 4 + Math.floor(rand() * 3);
  const blobs = [];
  for (let i = 0; i < blobCount; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = (0.05 + rand() * 0.28) * (i === 0 ? 0.2 : 1);
    const cx = Math.cos(angle) * dist;
    const cy = Math.sin(angle) * dist;
    const sx = 0.48 + rand() * 0.32 + styleCfg.drama * 0.1;
    const sy = 0.42 + rand() * 0.28 + styleCfg.coastBreak * 0.08;
    blobs.push({ cx, cy, sx, sy, weight: i === 0 ? 1.35 : 0.72 + rand() * 0.3 });
  }
  return blobs;
}

function generateLandPotential(width, height, config, seed) {
  const land = new Float32Array(width * height);
  const sizeCfg = ISLAND_SIZE[config.islandSize] || ISLAND_SIZE.medium;
  const styleCfg = STYLE[config.style] || STYLE.balanced;
  const blobs = createIslandBlobs(seed, styleCfg);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = (x / (width - 1)) * 2 - 1;
      const ny = (y / (height - 1)) * 2 - 1;

      const warpX = (fbm2D(nx * 1.5, ny * 1.5, 4, 2, 0.5, seed + 10) - 0.5) * (styleCfg.warp + 0.08);
      const warpY = (fbm2D(nx * 1.5 + 42.7, ny * 1.5 - 18.3, 4, 2, 0.5, seed + 11) - 0.5) * (styleCfg.warp + 0.08);
      const wx = nx + warpX;
      const wy = ny + warpY;

      const continentalNoise = (fbm2D(nx * 0.8 - 1.7, ny * 0.8 + 2.3, 4, 2, 0.5, seed + 16) - 0.5) * 0.38;
      let blobShape = 0;
      for (const blob of blobs) {
        const dx = (wx - blob.cx) / blob.sx;
        const dy = (wy - blob.cy) / blob.sy;
        const d = Math.hypot(dx, dy);
        const influence = (1 - smoothstep(0.52, 1.1, d)) * blob.weight;
        if (influence > blobShape) blobShape = influence;
      }

      const dist = Math.hypot(wx * (1 + styleCfg.drama * 0.12), wy * (1 - styleCfg.drama * 0.06));
      const radial = 1 - smoothstep(sizeCfg.radius * 0.54, sizeCfg.radius * 1.02, dist);
      const coast = (fbm2D(nx * 4 + 9.1, ny * 4 - 3.4, 4, 2, 0.5, seed + 20) - 0.5) * 0.95;
      const macro = (fbm2D(nx * 1.2 - 7, ny * 1.2 + 2, 3, 2, 0.5, seed + 30) - 0.5) * 0.5;
      const asym = (fbm2D(nx * 0.8 + 80, ny * 0.8 - 35, 3, 2, 0.5, seed + 40) - 0.5) * 0.62;
      const shelf = (fbm2D(wx * 2.4 - 9, wy * 2.4 + 4, 3, 2, 0.5, seed + 41) - 0.5) * 0.35;

      land[i] = radial * 0.92
        + blobShape * 0.78
        + continentalNoise * 0.26
        + coast * (0.22 + styleCfg.coastBreak * 0.15)
        + macro * 0.38
        + asym * 0.34
        + shelf * 0.18;
    }
  }

  return land;
}

function applyEdgeWaterFalloff(land, width, height, config) {
  const border = (ISLAND_SIZE[config.islandSize] || ISLAND_SIZE.medium).border;
  const borderPx = Math.max(2, border * Math.min(width, height));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const edgeDist = Math.min(x, y, width - 1 - x, height - 1 - y);
      const t = clamp(edgeDist / borderPx, 0, 1);
      land[i] *= smoothstep(0, 1, t);
    }
  }
}

function createLandMask(landPotential, width, height, config) {
  const out = new Uint8Array(width * height);
  let threshold = (ISLAND_SIZE[config.islandSize] || ISLAND_SIZE.medium).threshold;

  const writeMask = (t) => {
    let landCount = 0;
    for (let i = 0; i < out.length; i++) {
      out[i] = landPotential[i] > t ? 1 : 0;
      landCount += out[i];
    }
    return landCount;
  };

  let landCount = writeMask(threshold);
  const minLandPixels = Math.max(64, Math.round(out.length * 0.06));
  while (landCount < minLandPixels && threshold > -0.35) {
    threshold -= 0.03;
    landCount = writeMask(threshold);
  }

  return out;
}

function cleanupLandMask(mask, width, height, config) {
  clearLandOnEdges(mask, width, height);

  const visited = new Uint8Array(mask.length);
  const labels = [];
  const dirs = [-1, 1, -width, width];

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    const cells = [];
    while (stack.length) {
      const cur = stack.pop();
      cells.push(cur);
      const y = Math.floor(cur / width);
      const x = cur - y * width;
      for (const d of dirs) {
        const ni = cur + d;
        if (ni < 0 || ni >= mask.length || visited[ni] || !mask[ni]) continue;
        const ny = Math.floor(ni / width);
        const nx = ni - ny * width;
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
        visited[ni] = 1;
        stack.push(ni);
      }
    }
    labels.push(cells);
  }

  if (!labels.length) return;

  labels.sort((a, b) => b.length - a.length);
  const styleCfg = STYLE[config.style] || STYLE.balanced;
  const minIslandArea = Math.round(width * height * 0.00028);
  const keepCount = config.style === 'archipelago' ? Math.min(labels.length, Math.max(2, Math.round(3 * styleCfg.archipelago))) : 1;

  mask.fill(0);
  for (let k = 0; k < keepCount; k++) {
    const comp = labels[k];
    if (!comp || comp.length < minIslandArea) continue;
    for (const i of comp) mask[i] = 1;
  }

  const fill = new Uint8Array(mask.length);
  const queue = [];
  for (let x = 0; x < width; x++) {
    const top = x;
    const bottom = (height - 1) * width + x;
    if (!mask[top]) {
      fill[top] = 1;
      queue.push(top);
    }
    if (!mask[bottom] && !fill[bottom]) {
      fill[bottom] = 1;
      queue.push(bottom);
    }
  }
  for (let y = 0; y < height; y++) {
    const left = y * width;
    const right = y * width + width - 1;
    if (!mask[left] && !fill[left]) {
      fill[left] = 1;
      queue.push(left);
    }
    if (!mask[right] && !fill[right]) {
      fill[right] = 1;
      queue.push(right);
    }
  }
  while (queue.length) {
    const cur = queue.pop();
    const y = Math.floor(cur / width);
    const x = cur - y * width;
    for (const d of dirs) {
      const ni = cur + d;
      if (ni < 0 || ni >= mask.length || fill[ni] || mask[ni]) continue;
      const ny = Math.floor(ni / width);
      const nx = ni - ny * width;
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue;
      fill[ni] = 1;
      queue.push(ni);
    }
  }
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] && !fill[i]) mask[i] = 1;
  }
}

function clearLandOnEdges(mask, width, height) {
  for (let x = 0; x < width; x++) {
    mask[x] = 0;
    mask[(height - 1) * width + x] = 0;
  }
  for (let y = 0; y < height; y++) {
    mask[y * width] = 0;
    mask[y * width + width - 1] = 0;
  }
}

function addArchipelagoIslets(mask, width, height, config, seed, rng) {
  if (config.style !== 'archipelago') return;
  const sizeCfg = ISLAND_SIZE[config.islandSize] || ISLAND_SIZE.medium;
  const count = Math.max(3, Math.round(4 + rng() * 5 * sizeCfg.archipelagoBoost));
  for (let k = 0; k < count; k++) {
    const cx = 0.15 + rng() * 0.7;
    const cy = 0.15 + rng() * 0.7;
    const radius = 0.015 + rng() * 0.05;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (mask[i]) continue;
        const nx = x / (width - 1);
        const ny = y / (height - 1);
        const edgeDist = Math.min(nx, ny, 1 - nx, 1 - ny);
        if (edgeDist < sizeCfg.border) continue;
        const d = Math.hypot(nx - cx, ny - cy) / radius;
        const n = fbm2D(nx * 5.5, ny * 5.5, 2, 2, 0.5, seed + 220 + k) - 0.5;
        if (1 - d + n * 0.2 > 0.56) mask[i] = 1;
      }
    }
  }
}

function distanceTransform(binaryMask, width, height, target) {
  const out = new Float32Array(width * height);
  const inf = 1e9;
  const diag = Math.SQRT2;
  for (let i = 0; i < out.length; i++) out[i] = binaryMask[i] === target ? 0 : inf;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let best = out[i];
      if (x > 0) best = Math.min(best, out[i - 1] + 1);
      if (y > 0) best = Math.min(best, out[i - width] + 1);
      if (x > 0 && y > 0) best = Math.min(best, out[i - width - 1] + diag);
      if (x < width - 1 && y > 0) best = Math.min(best, out[i - width + 1] + diag);
      out[i] = best;
    }
  }

  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let best = out[i];
      if (x < width - 1) best = Math.min(best, out[i + 1] + 1);
      if (y < height - 1) best = Math.min(best, out[i + width] + 1);
      if (x < width - 1 && y < height - 1) best = Math.min(best, out[i + width + 1] + diag);
      if (x > 0 && y < height - 1) best = Math.min(best, out[i + width - 1] + diag);
      out[i] = best;
    }
  }

  return out;
}

function computeDistanceFields(landMask, width, height) {
  const distanceToWater = distanceTransform(landMask, width, height, 0);
  const distanceToLand = distanceTransform(landMask, width, height, 1);
  return { distanceToWater, distanceToLand };
}

function generateOceanHeights(heightMap, landMask, distanceToLand, width, height, config, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (landMask[i]) continue;
      const d = clamp(distanceToLand[i] / Math.max(80, width * 0.14), 0, 1);
      let oceanY = lerp(62, 5, d);
      if (d > 0.65) oceanY = lerp(oceanY, config.minY + 10, (d - 0.65) / 0.35);
      const n = (fbm2D(x / width * 6.5, y / height * 6.5, 3, 2, 0.5, seed + 410) - 0.5) * 8;
      heightMap[i] = Math.min(config.seaLevel - 1, oceanY + n);
    }
  }
}

function generateLandBaseHeight(heightMap, landMask, distanceToWater, width, height, config, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const dWater = distanceToWater[i];
      const coastRise = smoothstep(2, Math.max(16, width * 0.06), dWater);
      const beachNoise = fbm2D(x / width * 8.5, y / height * 8.5, 2, 2, 0.5, seed + 500) - 0.5;
      const beachWidth = 4 + (beachNoise + 0.5) * 7;
      if (dWater <= beachWidth) {
        const beachT = clamp(dWater / Math.max(1, beachWidth), 0, 1);
        heightMap[i] = lerp(64, 70, beachT);
      } else {
        let base = 72;
        base += coastRise * 18;
        base += (fbm2D(x / width * 2.2, y / height * 2.2, 4, 2, 0.5, seed + 510) - 0.5) * 16;
        heightMap[i] = base;
      }
    }
  }
}

function generateMountainMask(landMask, distanceToWater, width, height, config, seed) {
  const styleCfg = STYLE[config.style] || STYLE.balanced;
  const reliefBias = { soft: 0.68, normal: 0.58, mountainous: 0.48, extreme: 0.4 }[config.relief] ?? 0.58;
  const mask = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const macro = fbm2D(x / width * 1.1, y / height * 1.1, 4, 2, 0.5, seed + 610);
      const ridgedIntent = ridgedFbm(x / width * 1.4 + 3, y / height * 1.4 - 5, seed + 611, 3);
      const inland = smoothstep(10, Math.max(36, width * 0.08), distanceToWater[i]);
      const intent = macro * 0.6 + ridgedIntent * 0.4;
      const candidate = smoothstep(Math.max(0.2, reliefBias - styleCfg.mountainBias * 0.2), 0.92, intent) * inland;
      mask[i] = clamp(candidate, 0, 1);
    }
  }
  return mask;
}

function applyMacroRelief(heightMap, landMask, width, height, reliefCfg, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const macro = fbm2D(x / width * 1.15, y / height * 1.15, 4, 2, 0.5, seed + 700) - 0.5;
      heightMap[i] += macro * reliefCfg.macroAmp;
    }
  }
}

function applyHills(heightMap, landMask, distanceToWater, width, height, reliefCfg, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const inland = smoothstep(4, Math.max(24, width * 0.06), distanceToWater[i]);
      const hill = (fbm2D(x / width * 5.2, y / height * 5.2, 4, 2, 0.5, seed + 800) - 0.5) * 2;
      heightMap[i] += hill * reliefCfg.hillAmp * inland;
    }
  }
}

function applyMountains(heightMap, landMask, mountainMask, distanceToWater, width, height, reliefCfg, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const inland = smoothstep(8, Math.max(32, width * 0.09), distanceToWater[i]);
      const ridge = ridgedFbm(x / width * 3.2, y / height * 3.2, seed + 900, 5);
      const m = Math.max(mountainMask[i], inland * 0.22);
      heightMap[i] += ridge * ridge * m * reliefCfg.mountainAmp;
    }
  }
}

function applyPlateaus(heightMap, landMask, mountainMask, width, height, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const plateau = smoothstep(0.62, 0.82, fbm2D(x / width * 1.7 + 8, y / height * 1.7 - 4, 3, 2, 0.5, seed + 1000));
      if (plateau <= 0) continue;
      const quant = Math.round(heightMap[i] / 4) * 4;
      heightMap[i] = lerp(heightMap[i], quant, plateau * (0.25 + mountainMask[i] * 0.35));
    }
  }
}

function applyValleys(heightMap, landMask, width, height, reliefCfg, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const directional = ridgedFbm(x / width * 1.8 + y / height * 0.75, y / height * 2.1 - x / width * 0.65, seed + 1100, 4);
      const valleyMask = smoothstep(0.66, 0.9, directional);
      heightMap[i] -= valleyMask * reliefCfg.valleyAmp;
    }
  }
}

function traceRivers(heightMap, landMask, width, height, seaLevel, reliefCfg, rng) {
  const riverMask = new Uint8Array(width * height);
  const attempts = Math.max(4, Math.round(width / 160));
  let riverCount = 0;

  for (let r = 0; r < attempts; r++) {
    let source = -1;
    for (let t = 0; t < 1200; t++) {
      const x = 2 + Math.floor(rng() * (width - 4));
      const y = 2 + Math.floor(rng() * (height - 4));
      const i = y * width + x;
      if (landMask[i] && heightMap[i] > seaLevel + 18) {
        source = i;
        break;
      }
    }
    if (source < 0) continue;

    const path = [];
    let cur = source;
    const seen = new Set([cur]);
    for (let step = 0; step < width * 2; step++) {
      const y = Math.floor(cur / width);
      const x = cur - y * width;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) break;
      path.push(cur);
      if (!landMask[cur] || heightMap[cur] <= seaLevel + 1) break;

      const lateral = (rng() - 0.5) * 0.2;
      const candidates = [
        cur - 1, cur + 1, cur - width, cur + width,
        cur - width - 1, cur - width + 1, cur + width - 1, cur + width + 1
      ];
      let next = cur;
      let best = heightMap[cur] + 0.2;
      for (const ni of candidates) {
        if (ni < 0 || ni >= heightMap.length) continue;
        const score = heightMap[ni] + lateral;
        if (score < best) {
          best = score;
          next = ni;
        }
      }
      if (next === cur || seen.has(next) || heightMap[next] > heightMap[cur] + 0.05) break;
      seen.add(next);
      cur = next;
    }

    if (path.length < width * 0.02) continue;
    riverCount++;

    for (const p of path) {
      const py = Math.floor(p / width);
      const px = p - py * width;
      const rw = 1 + Math.round(rng() * 3);
      for (let oy = -rw; oy <= rw; oy++) {
        for (let ox = -rw; ox <= rw; ox++) {
          const nx = px + ox;
          const ny = py + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          const d = Math.hypot(ox, oy) / Math.max(1, rw);
          if (d > 1.2) continue;
          const depth = reliefCfg.riverDepth * (1 - d / 1.2);
          heightMap[ni] = Math.max(seaLevel - 2, heightMap[ni] - depth);
          riverMask[ni] = 1;
        }
      }
    }
  }

  return { riverMask, riverCount };
}

function applyErosion(heightMap, landMask, width, height, passes) {
  const copy = new Float32Array(heightMap.length);
  for (let p = 0; p < passes; p++) {
    copy.set(heightMap);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!landMask[i]) continue;
        const n = [i - 1, i + 1, i - width, i + width];
        let maxDrop = 0;
        let target = -1;
        for (const ni of n) {
          const drop = copy[i] - copy[ni];
          if (drop > maxDrop) {
            maxDrop = drop;
            target = ni;
          }
        }
        if (target >= 0 && maxDrop > 2.4) {
          const move = (maxDrop - 2.4) * 0.16;
          heightMap[i] -= move;
          if (landMask[target]) heightMap[target] += move * 0.65;
        }
      }
    }
  }
}

function reinforceRelief(heightMap, landMask, distanceToWater, width, height, reliefCfg, seed) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      const inland = smoothstep(10, Math.max(34, width * 0.1), distanceToWater[i]);
      const ridge = ridgedFbm(x / width * 2.6 + 11, y / height * 2.6 - 9, seed + 1230, 4);
      heightMap[i] += ridge * inland * reliefCfg.mountainAmp * 0.22;
    }
  }
}

function cleanupHeights(heightMap, landMask, distanceToWater, width, height, config) {
  for (let i = 0; i < heightMap.length; i++) {
    if (!Number.isFinite(heightMap[i])) heightMap[i] = config.seaLevel;
    heightMap[i] = clamp(heightMap[i], config.minY, config.maxY);

    if (landMask[i]) {
      const inlandLift = smoothstep(4, Math.max(20, width * 0.08), distanceToWater[i]) * 42;
      heightMap[i] = Math.max(config.seaLevel, heightMap[i], config.seaLevel + inlandLift * 0.5);
    } else {
      heightMap[i] = Math.min(config.seaLevel - 1, heightMap[i]);
    }
  }

  const smooth = new Float32Array(heightMap);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const steep = Math.max(
        Math.abs(heightMap[i] - heightMap[i - 1]),
        Math.abs(heightMap[i] - heightMap[i + 1]),
        Math.abs(heightMap[i] - heightMap[i - width]),
        Math.abs(heightMap[i] - heightMap[i + width])
      );
      if (steep > 40) {
        smooth[i] = (heightMap[i] * 3 + heightMap[i - 1] + heightMap[i + 1] + heightMap[i - width] + heightMap[i + width]) / 7;
      }
    }
  }
  heightMap.set(smooth);
}

function quantizeHeights(heightMap, minY, maxY) {
  return quantizeToMinecraftY(heightMap, minY, maxY);
}

function validateNoLandTouchesEdges(mask, width, height) {
  for (let x = 0; x < width; x++) {
    if (mask[x] || mask[(height - 1) * width + x]) return false;
  }
  for (let y = 0; y < height; y++) {
    if (mask[y * width] || mask[y * width + width - 1]) return false;
  }
  return true;
}

function statsForMap(yMap, gray16, landMask, width, height, config, riverCount, generationMs) {
  let minY = Infinity;
  let maxY = -Infinity;
  let land = 0;
  let finiteValues = true;

  for (let i = 0; i < yMap.length; i++) {
    minY = Math.min(minY, yMap[i]);
    maxY = Math.max(maxY, yMap[i]);
    if (landMask[i]) land++;
    if (!Number.isFinite(yMap[i])) finiteValues = false;
  }

  const validations = {
    noLandOnEdges: validateNoLandTouchesEdges(landMask, width, height),
    waterAroundIsland: validateNoLandTouchesEdges(landMask, width, height),
    finiteValues,
    minecraftRangeOk: minY >= config.minY && maxY <= config.maxY,
    seaLevel: config.seaLevel,
    export16BitReady: gray16 instanceof Uint16Array,
    nonFlat: maxY - minY > 35
  };

  return {
    mapSize: width,
    islandSize: config.islandSize,
    relief: config.relief,
    style: config.style,
    minY,
    maxY,
    seaLevel: config.seaLevel,
    landPct: ((land / yMap.length) * 100).toFixed(2),
    oceanPct: (100 - (land / yMap.length) * 100).toFixed(2),
    rivers: riverCount,
    generationMs,
    worldPainter: 'Compatible 16-bit grayscale, 1px = 1 bloc',
    validations,
    pipeline: PIPELINE
  };
}

export function generateProceduralIsland(config) {
  const t0 = performance.now();
  const width = Number(config.resolution);
  const height = width;
  const seed = hashString(String(config.seed || 'island'));
  const rng = createSeededRandom(String(config.seed || 'island'));

  const landPotential = generateLandPotential(width, height, config, seed);
  applyEdgeWaterFalloff(landPotential, width, height, config);

  let landMask = createLandMask(landPotential, width, height, config);
  addArchipelagoIslets(landMask, width, height, config, seed, rng);
  cleanupLandMask(landMask, width, height, config);
  clearLandOnEdges(landMask, width, height);

  const { distanceToWater, distanceToLand } = computeDistanceFields(landMask, width, height);

  const heightMap = new Float32Array(width * height);
  generateOceanHeights(heightMap, landMask, distanceToLand, width, height, config, seed);
  generateLandBaseHeight(heightMap, landMask, distanceToWater, width, height, config, seed);

  const reliefCfg = RELIEF[config.relief] || RELIEF.normal;
  applyMacroRelief(heightMap, landMask, width, height, reliefCfg, seed);
  applyHills(heightMap, landMask, distanceToWater, width, height, reliefCfg, seed);
  const mountainMask = generateMountainMask(landMask, distanceToWater, width, height, config, seed);
  applyMountains(heightMap, landMask, mountainMask, distanceToWater, width, height, reliefCfg, seed);
  applyPlateaus(heightMap, landMask, mountainMask, width, height, seed);
  applyValleys(heightMap, landMask, width, height, reliefCfg, seed);

  const riverResult = traceRivers(heightMap, landMask, width, height, config.seaLevel, reliefCfg, rng);
  applyErosion(heightMap, landMask, width, height, reliefCfg.erosionPasses);
  reinforceRelief(heightMap, landMask, distanceToWater, width, height, reliefCfg, seed);
  cleanupHeights(heightMap, landMask, distanceToWater, width, height, config);

  const yMap = quantizeHeights(heightMap, config.minY, config.maxY);
  const gray16 = toGray16Array(yMap, config.minY, config.maxY);

  return {
    width,
    height,
    yMap,
    gray16,
    settings: { minY: config.minY, maxY: config.maxY, seaLevel: config.seaLevel },
    stats: statsForMap(yMap, gray16, landMask, width, height, config, riverResult.riverCount, Math.round(performance.now() - t0))
  };
}
