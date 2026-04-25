const EPS = 1e-6;
const n4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const n8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

const BIOME_DEFS = [
  { id: 'plains', name: 'Plaines', minY: 70, maxY: 95, preferredY: 82, roughness: 0.16, flatness: 0.7, riverChance: 0.4, mountainForce: 0.1, erosion: 0.25, temp: 0.55, moist: 0.55, color: [126, 173, 108] },
  { id: 'hills', name: 'Collines', minY: 95, maxY: 120, preferredY: 106, roughness: 0.36, flatness: 0.4, riverChance: 0.25, mountainForce: 0.35, erosion: 0.32, temp: 0.52, moist: 0.5, color: [110, 147, 95] },
  { id: 'mountains', name: 'Montagnes', minY: 150, maxY: 240, preferredY: 190, roughness: 0.72, flatness: 0.1, riverChance: 0.12, mountainForce: 1.0, erosion: 0.55, temp: 0.35, moist: 0.42, color: [140, 140, 146] },
  { id: 'high_plateau', name: 'Hauts plateaux', minY: 120, maxY: 150, preferredY: 136, roughness: 0.22, flatness: 0.6, riverChance: 0.18, mountainForce: 0.5, erosion: 0.3, temp: 0.5, moist: 0.38, color: [177, 160, 112] },
  { id: 'canyon', name: 'Canyon', minY: 70, maxY: 150, preferredY: 108, roughness: 0.54, flatness: 0.25, riverChance: 0.16, mountainForce: 0.45, erosion: 0.62, temp: 0.7, moist: 0.2, color: [179, 117, 74] },
  { id: 'swamp', name: 'Marais', minY: 62, maxY: 72, preferredY: 67, roughness: 0.08, flatness: 0.9, riverChance: 0.55, mountainForce: 0.03, erosion: 0.22, temp: 0.6, moist: 0.85, color: [89, 120, 95] },
  { id: 'forest', name: 'Forêt', minY: 80, maxY: 118, preferredY: 95, roughness: 0.28, flatness: 0.5, riverChance: 0.3, mountainForce: 0.22, erosion: 0.34, temp: 0.52, moist: 0.75, color: [65, 121, 76] },
  { id: 'jungle', name: 'Jungle', minY: 82, maxY: 132, preferredY: 102, roughness: 0.32, flatness: 0.45, riverChance: 0.35, mountainForce: 0.28, erosion: 0.28, temp: 0.82, moist: 0.9, color: [56, 132, 66] },
  { id: 'desert', name: 'Désert', minY: 70, maxY: 115, preferredY: 89, roughness: 0.18, flatness: 0.55, riverChance: 0.06, mountainForce: 0.2, erosion: 0.2, temp: 0.9, moist: 0.1, color: [213, 188, 122] },
  { id: 'tundra', name: 'Toundra', minY: 82, maxY: 150, preferredY: 116, roughness: 0.3, flatness: 0.4, riverChance: 0.14, mountainForce: 0.34, erosion: 0.4, temp: 0.14, moist: 0.45, color: [168, 181, 188] },
  { id: 'coast', name: 'Côte', minY: 64, maxY: 82, preferredY: 72, roughness: 0.08, flatness: 0.85, riverChance: 0.12, mountainForce: 0.04, erosion: 0.2, temp: 0.58, moist: 0.62, color: [207, 191, 152] },
  { id: 'ocean', name: 'Océan', minY: 20, maxY: 63, preferredY: 46, roughness: 0.12, flatness: 0.78, riverChance: 0, mountainForce: 0, erosion: 0.1, temp: 0.48, moist: 0.96, color: [55, 113, 185] }
];

const PRESETS = {
  balanced: { label: 'Île réaliste', landCoverage: 40, oceanBorder: 'standard', mountainIntensity: 1.0, erosionStrength: 0.35, riverCount: 10 },
  small_island: { label: 'Petite île', landCoverage: 25, oceanBorder: 'large', mountainIntensity: 0.75, erosionStrength: 0.3, riverCount: 4 },
  continent: { label: 'Grande île / continent', landCoverage: 65, oceanBorder: 'small', mountainIntensity: 1.15, erosionStrength: 0.4, riverCount: 16 },
  pokemon: { label: 'Grande île Pokémon', landCoverage: 55, oceanBorder: 'standard', mountainIntensity: 1.1, erosionStrength: 0.32, riverCount: 12 }
};

const OCEAN_BORDER = { small: 0.08, standard: 0.15, large: 0.25, immense: 0.35 };

const state = { ui: {}, terrain: null, running: false };

const byId = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1), 0, 1); return t * t * (3 - 2 * t); };
const idx = (x, y, w) => y * w + x;

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const rand = (ix, iy) => {
    let n = ix * 374761393 + iy * 668265263 + seed * 982451653;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = rand(xi, yi);
  const b = rand(xi + 1, yi);
  const c = rand(xi, yi + 1);
  const d = rand(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, seed, octaves, lacunarity = 2, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 1931) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / Math.max(norm, EPS);
}

function ridge(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.7;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = fbm(x * freq, y * freq, seed + i * 131, 2);
    sum += (1 - Math.abs(2 * n - 1)) * amp;
    norm += amp;
    amp *= 0.55;
    freq *= 1.9;
  }
  return sum / Math.max(norm, EPS);
}

function qThreshold(values, landRatio) {
  const copy = Array.from(values);
  copy.sort((a, b) => a - b);
  const at = clamp(Math.floor((1 - landRatio) * (copy.length - 1)), 0, copy.length - 1);
  return copy[at];
}

function setProgress(v, text) {
  state.ui.progressFill.style.width = `${Math.round(clamp(v, 0, 1) * 100)}%`;
  state.ui.statusText.textContent = text;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function readConfig() {
  return {
    size: Number(state.ui.size.value),
    seed: state.ui.seed.value.trim() || 'seed',
    minY: Number(state.ui.minY.value),
    maxY: Number(state.ui.maxY.value),
    seaLevel: Number(state.ui.seaLevel.value),
    landCoverage: Number(state.ui.landCoverage.value),
    oceanBorder: state.ui.oceanBorder.value,
    mountainIntensity: Number(state.ui.mountainIntensity.value),
    erosionStrength: Number(state.ui.erosionStrength.value),
    riverCount: Number(state.ui.riverCount.value),
    renderMode: state.ui.renderMode.value
  };
}

function applyPreset(id) {
  const p = PRESETS[id];
  if (!p) return;
  state.ui.landCoverage.value = String(p.landCoverage);
  state.ui.oceanBorder.value = p.oceanBorder;
  state.ui.mountainIntensity.value = String(p.mountainIntensity);
  state.ui.erosionStrength.value = String(p.erosionStrength);
  state.ui.riverCount.value = String(p.riverCount);
}

function fillPresetSelect() {
  state.ui.presetSelect.innerHTML = '';
  Object.entries(PRESETS).forEach(([id, p]) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = p.label;
    state.ui.presetSelect.appendChild(o);
  });
  state.ui.presetSelect.value = 'balanced';
}

function applyOceanBorderMask(landPotential, width, height, borderPercent) {
  const margin = Math.max(1, Math.floor(Math.min(width, height) * borderPercent));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const distEdge = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (distEdge <= margin) {
        const t = distEdge / Math.max(margin, 1);
        const fade = smoothstep(0, 1, t);
        landPotential[i] -= (1 - fade) * 1.1 + 0.08;
      }
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        landPotential[i] = -999;
      }
    }
  }
}

function buildLandPotential(width, height, seed) {
  const count = width * height;
  const potential = new Float32Array(count);
  const temperature = new Float32Array(count);
  const moisture = new Float32Array(count);
  const macro = new Float32Array(count);
  const meso = new Float32Array(count);
  const micro = new Float32Array(count);

  const centers = [
    [0.52, 0.48, 1],
    [0.22, 0.6, 0.55],
    [0.74, 0.35, 0.45]
  ];

  for (let y = 0; y < height; y++) {
    const ny = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / Math.max(1, width - 1);
      const i = idx(x, y, width);

      const warpX = (fbm(nx * 2.4, ny * 2.4, seed + 10, 3) - 0.5) * 0.18;
      const warpY = (fbm(nx * 2.4 + 8.2, ny * 2.4 + 9.1, seed + 11, 3) - 0.5) * 0.18;
      const wx = nx + warpX;
      const wy = ny + warpY;

      let radial = 0;
      for (const [cx, cy, strength] of centers) {
        const dx = wx - cx;
        const dy = wy - cy;
        const d = Math.sqrt(dx * dx + dy * dy + EPS);
        radial = Math.max(radial, (1 - smoothstep(0.15, 0.92, d)) * strength);
      }

      const coastNoise = fbm(wx * 4.2, wy * 4.2, seed + 21, 4, 2.2, 0.52) - 0.5;
      const asymmetry = fbm(wx * 1.1 + 3.7, wy * 1.3 + 1.2, seed + 22, 3, 2.1, 0.55) - 0.5;

      macro[i] = fbm(wx * 1.4, wy * 1.4, seed + 30, 5, 2, 0.52);
      meso[i] = fbm(wx * 4.6, wy * 4.6, seed + 31, 4, 2.05, 0.53);
      micro[i] = fbm(wx * 12.2, wy * 12.2, seed + 32, 2, 2.2, 0.56);

      potential[i] = radial * 0.72 + macro[i] * 0.42 + meso[i] * 0.22 + coastNoise * 0.2 + asymmetry * 0.3;

      temperature[i] = clamp(1 - ny * 0.85 + (fbm(nx * 2.2, ny * 2.2, seed + 50, 3) - 0.5) * 0.35, 0, 1);
      moisture[i] = clamp(0.55 + (fbm(nx * 2.5 + 4.4, ny * 2.5 + 2.7, seed + 51, 4) - 0.5) * 0.85 - (temperature[i] - 0.5) * 0.2, 0, 1);
    }
  }

  return { potential, temperature, moisture, macro, meso, micro };
}

function computeDistance(maskSource, width, height) {
  const count = width * height;
  const dist = new Int32Array(count).fill(-1);
  const q = new Int32Array(count);
  let head = 0;
  let tail = 0;

  for (let i = 0; i < count; i++) {
    if (maskSource[i]) {
      dist[i] = 0;
      q[tail++] = i;
    }
  }

  while (head < tail) {
    const current = q[head++];
    const y = Math.floor(current / width);
    const x = current - y * width;
    const nd = dist[current] + 1;
    for (const [ox, oy] of n4) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (dist[ni] !== -1) continue;
      dist[ni] = nd;
      q[tail++] = ni;
    }
  }

  let maxDist = 1;
  for (let i = 0; i < count; i++) if (dist[i] > maxDist) maxDist = dist[i];
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) out[i] = clamp(dist[i] / maxDist, 0, 1);
  return out;
}

function cleanupLandMask(landMask, width, height) {
  const count = width * height;

  for (let pass = 0; pass < 2; pass++) {
    const copy = new Uint8Array(landMask);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y, width);
        let neigh = 0;
        for (const [ox, oy] of n8) neigh += copy[idx(x + ox, y + oy, width)];
        if (copy[i] === 1 && neigh <= 2) landMask[i] = 0;
        if (copy[i] === 0 && neigh >= 7) landMask[i] = 1;
      }
    }
  }

  const labels = new Int32Array(count).fill(-1);
  const sizes = [];
  let label = 0;
  const queue = new Int32Array(count);

  for (let i = 0; i < count; i++) {
    if (landMask[i] === 0 || labels[i] !== -1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    labels[i] = label;
    let size = 0;
    while (head < tail) {
      const c = queue[head++];
      size++;
      const y = Math.floor(c / width);
      const x = c - y * width;
      for (const [ox, oy] of n4) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = idx(nx, ny, width);
        if (landMask[ni] === 0 || labels[ni] !== -1) continue;
        labels[ni] = label;
        queue[tail++] = ni;
      }
    }
    sizes[label] = size;
    label++;
  }

  const mainLabel = sizes.length ? sizes.indexOf(Math.max(...sizes)) : -1;
  for (let i = 0; i < count; i++) {
    if (landMask[i] === 1 && labels[i] !== mainLabel && (sizes[labels[i]] || 0) < Math.max(64, count * 0.0025)) {
      landMask[i] = 0;
    }
  }
}

function validateIslandDoesNotTouchEdges(landMask, width, height) {
  let touched = false;
  for (let x = 0; x < width; x++) {
    if (landMask[idx(x, 0, width)] === 1) { landMask[idx(x, 0, width)] = 0; touched = true; }
    if (landMask[idx(x, height - 1, width)] === 1) { landMask[idx(x, height - 1, width)] = 0; touched = true; }
  }
  for (let y = 0; y < height; y++) {
    if (landMask[idx(0, y, width)] === 1) { landMask[idx(0, y, width)] = 0; touched = true; }
    if (landMask[idx(width - 1, y, width)] === 1) { landMask[idx(width - 1, y, width)] = 0; touched = true; }
  }
  return touched;
}

function generateLandMask(potential, width, height, targetLandRatio) {
  let threshold = qThreshold(potential, targetLandRatio);
  const landMask = new Uint8Array(potential.length);
  let bestMask = null;
  let bestDiff = 999;

  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < potential.length; i++) landMask[i] = potential[i] > threshold ? 1 : 0;
    cleanupLandMask(landMask, width, height);
    validateIslandDoesNotTouchEdges(landMask, width, height);
    let land = 0;
    for (let i = 0; i < landMask.length; i++) land += landMask[i];
    const ratio = land / landMask.length;
    const diff = Math.abs(ratio - targetLandRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMask = new Uint8Array(landMask);
    }
    const direction = ratio < targetLandRatio ? -1 : 1;
    threshold += direction * (0.03 / (pass + 1));
  }

  return bestMask || landMask;
}

function assignBiomes(landMask, coastalDistLand, macro, temperature, moisture, width, height) {
  const biomeIndex = new Uint16Array(landMask.length);
  const oceanIdx = BIOME_DEFS.findIndex((b) => b.id === 'ocean');
  const coastIdx = BIOME_DEFS.findIndex((b) => b.id === 'coast');

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (landMask[i] === 0) {
        biomeIndex[i] = oceanIdx;
        continue;
      }
      if (coastalDistLand[i] < 0.05) {
        biomeIndex[i] = coastIdx;
        continue;
      }
      let best = 0;
      let bestScore = -999;
      for (let b = 0; b < BIOME_DEFS.length; b++) {
        const biome = BIOME_DEFS[b];
        if (biome.id === 'ocean' || biome.id === 'coast') continue;
        const climate = 1 - Math.abs(temperature[i] - biome.temp) - Math.abs(moisture[i] - biome.moist);
        const altitudeAffinity = 1 - Math.abs(macro[i] - (biome.preferredY / 255));
        const score = climate * 0.7 + altitudeAffinity * 0.3;
        if (score > bestScore) {
          bestScore = score;
          best = b;
        }
      }
      biomeIndex[i] = best;
    }
  }
  return biomeIndex;
}

function generateHeights(ctx) {
  const { config, width, height, landMask, distToLandFromWater, distToWaterFromLand, macro, meso, micro, biomeIndex, seed } = ctx;
  const heights = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (landMask[i] === 0) {
        const d = distToLandFromWater[i];
        const coastalShelf = lerp(63, 58, smoothstep(0, 0.07, d));
        const midOcean = lerp(58, 35, smoothstep(0.07, 0.25, d));
        const abyss = lerp(35, 20, smoothstep(0.25, 0.8, d));
        let h = coastalShelf;
        if (d > 0.07) h = midOcean;
        if (d > 0.25) h = abyss;
        const oceanNoise = (fbm(x / width * 8, y / height * 8, seed + 81, 3) - 0.5) * 4;
        heights[i] = clamp(h + oceanNoise, config.minY, config.seaLevel - 1);
        continue;
      }

      const biome = BIOME_DEFS[biomeIndex[i]] || BIOME_DEFS[0];
      const coast = distToWaterFromLand[i];
      const coastBlend = smoothstep(0, 0.08, coast);

      const macroForm = lerp(biome.minY, biome.maxY, clamp(macro[i] * 0.85 + meso[i] * 0.15, 0, 1));
      const mesoRelief = (meso[i] - 0.5) * (10 + biome.roughness * 36);
      const microRelief = (micro[i] - 0.5) * (2 + biome.roughness * 12);
      const ridgeMask = ridge(x / width * 6.2, y / height * 6.2, seed + 82, 4);
      const mountainBoost = smoothstep(0.56, 0.9, ridgeMask) * biome.mountainForce * config.mountainIntensity * 80;

      let h = macroForm + mesoRelief + microRelief + mountainBoost;
      if (biome.id === 'swamp') h = lerp(h, 67, 0.6);
      if (biome.id === 'canyon') {
        const cut = smoothstep(0.45, 0.8, ridge(x / width * 11.5, y / height * 11.5, seed + 83, 3));
        h -= cut * 35;
      }

      const beachBand = lerp(64, 69, smoothstep(0.01, 0.11, coast));
      h = lerp(beachBand, h, coastBlend);
      heights[i] = clamp(h, config.seaLevel - 2, config.maxY);
    }
  }

  return heights;
}

function carveRivers(heights, landMask, width, height, seaLevel, riverCount, seed) {
  if (riverCount <= 0) return;
  const rng = mulberry32(seed ^ 0x59fa13);
  const candidates = [];

  for (let i = 0; i < heights.length; i++) {
    if (landMask[i] === 1 && heights[i] > 130) candidates.push(i);
  }
  if (!candidates.length) return;

  for (let r = 0; r < riverCount; r++) {
    let current = candidates[Math.floor(rng() * candidates.length)];
    const visited = new Set();

    for (let step = 0; step < 320; step++) {
      if (visited.has(current)) break;
      visited.add(current);

      const y = Math.floor(current / width);
      const x = current - y * width;
      heights[current] = Math.max(seaLevel - 1, heights[current] - 3.2);

      for (const [ox, oy] of n8) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
        const ni = idx(nx, ny, width);
        if (landMask[ni] === 1) heights[ni] = Math.max(seaLevel - 1, heights[ni] - 1.1);
      }

      if (landMask[current] === 0 || heights[current] <= seaLevel) break;

      let next = current;
      let best = heights[current];
      for (const [ox, oy] of n8) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
        const ni = idx(nx, ny, width);
        const meander = (rng() - 0.5) * 0.8;
        const candidate = heights[ni] + meander;
        if (candidate < best) {
          best = candidate;
          next = ni;
        }
      }
      if (next === current) break;
      current = next;
    }
  }
}

function cleanupHeights(heights, landMask, width, height, minY, maxY) {
  for (let i = 0; i < heights.length; i++) {
    if (!Number.isFinite(heights[i])) heights[i] = landMask[i] === 1 ? 72 : 50;
  }

  const copy = new Float32Array(heights);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      let sum = 0;
      let c = 0;
      for (const [ox, oy] of n8) {
        sum += copy[idx(x + ox, y + oy, width)];
        c++;
      }
      const avg = sum / c;
      const diff = Math.abs(copy[i] - avg);
      if (diff > 24) heights[i] = lerp(copy[i], avg, 0.65);
      else if (diff > 12) heights[i] = lerp(copy[i], avg, 0.25);
    }
  }

  for (let i = 0; i < heights.length; i++) heights[i] = clamp(heights[i], minY, maxY);
}

function quantizeHeights(heightsFloat, minY, maxY) {
  const out = new Uint16Array(heightsFloat.length);
  for (let i = 0; i < heightsFloat.length; i++) {
    out[i] = clamp(Math.round(heightsFloat[i]), minY, maxY);
  }
  return out;
}

function minecraftYToGray(y, minY, maxY) {
  return clamp(Math.round(((y - minY) / Math.max(1, (maxY - minY))) * 255), 0, 255);
}

function validateWorldPainterHeightmap({ terrainY, landMask, width, height, minY, maxY, seaLevel }) {
  let min = 9999;
  let max = -9999;
  let edgeLand = false;

  for (let i = 0; i < terrainY.length; i++) {
    min = Math.min(min, terrainY[i]);
    max = Math.max(max, terrainY[i]);
  }

  for (let x = 0; x < width; x++) {
    if (landMask[idx(x, 0, width)] === 1 || landMask[idx(x, height - 1, width)] === 1) edgeLand = true;
  }
  for (let y = 0; y < height; y++) {
    if (landMask[idx(0, y, width)] === 1 || landMask[idx(width - 1, y, width)] === 1) edgeLand = true;
  }

  return {
    isGrayscale: true,
    validDimensions: width > 0 && height > 0,
    seaLevelValid: seaLevel >= minY && seaLevel <= maxY,
    edgeLand,
    min,
    max,
    nonEmpty: terrainY.length > 0
  };
}

function landRatio(mask) {
  let land = 0;
  for (let i = 0; i < mask.length; i++) land += mask[i];
  return land / Math.max(mask.length, 1);
}

function buildPreviewImageData(terrain, mode) {
  const img = new ImageData(terrain.width, terrain.height);
  for (let i = 0; i < terrain.terrainY.length; i++) {
    const base = i * 4;
    let r;
    let g;
    let b;
    if (mode === 'biome') {
      const color = BIOME_DEFS[terrain.biomeIndex[i]]?.color || [120, 120, 120];
      [r, g, b] = color;
    } else {
      const gray = minecraftYToGray(terrain.terrainY[i], terrain.config.minY, terrain.config.maxY);
      r = g = b = gray;
    }
    img.data[base] = r;
    img.data[base + 1] = g;
    img.data[base + 2] = b;
    img.data[base + 3] = 255;
  }
  return img;
}

function render() {
  const terrain = state.terrain;
  const canvas = state.ui.canvas;
  if (!terrain) {
    state.ui.emptyState.style.display = 'grid';
    return;
  }
  state.ui.emptyState.style.display = 'none';
  canvas.width = terrain.width;
  canvas.height = terrain.height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(buildPreviewImageData(terrain, state.ui.renderMode.value), 0, 0);
  state.ui.topbarMeta.textContent = `Seed: ${terrain.config.seed} • ${terrain.width}x${terrain.height} • ${terrain.generatedMs} ms`;
}

function renderStats() {
  if (!state.terrain) return;
  const t = state.terrain;
  const graySea = minecraftYToGray(t.config.seaLevel, t.config.minY, t.config.maxY);
  state.ui.stats.innerHTML = `
    <li>Terre cible: ${(t.targetLandRatio * 100).toFixed(1)}%</li>
    <li>Terre réelle: ${(t.realLandRatio * 100).toFixed(1)}%</li>
    <li>Bord océan validé: ${t.validation.edgeLand ? 'Non' : 'Oui'}</li>
    <li>Terre touche bord: ${t.validation.edgeLand ? 'Oui (corrigé)' : 'Non'}</li>
    <li>Altitude min / max: ${t.validation.min} / ${t.validation.max}</li>
    <li>Sea level: Y${t.config.seaLevel}</li>
    <li>Gray sea level: ${graySea}</li>
    <li>Type export: grayscale heightmap</li>
    <li>Temps génération: ${t.generatedMs} ms</li>`;

  const counts = new Map();
  for (let i = 0; i < t.biomeIndex.length; i++) {
    if (t.landMask[i] === 0) continue;
    const id = BIOME_DEFS[t.biomeIndex[i]]?.id;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const land = Math.max(1, Math.round(t.realLandRatio * t.width * t.height));
  state.ui.biomeStats.innerHTML = BIOME_DEFS
    .filter((b) => b.id !== 'ocean')
    .map((b) => `<li>${b.name}: ${(((counts.get(b.id) || 0) / land) * 100).toFixed(1)}%</li>`)
    .join('');
}

function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportHeightmapPNG() {
  if (!state.terrain) return;
  const t = state.terrain;
  const canvas = document.createElement('canvas');
  canvas.width = t.width;
  canvas.height = t.height;
  const ctx = canvas.getContext('2d');
  const img = buildPreviewImageData(t, 'heightmap');
  ctx.putImageData(img, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const file = `heightmap_worldpainter_${t.config.seed}_${t.width}x${t.height}.png`;
    downloadBlob(file, blob);
  }, 'image/png');
}

async function generate() {
  if (state.running) return;
  state.running = true;
  const started = performance.now();
  const config = readConfig();

  const width = config.size;
  const height = config.size;
  const seed = hashString(config.seed);
  const targetLandRatio = clamp(config.landCoverage / 100, 0.05, 0.9);

  setProgress(0.05, '1/11 Potentiel de terre...');
  const layers = buildLandPotential(width, height, seed);

  await nextFrame();
  setProgress(0.14, '2/11 Masque terre/mer...');
  applyOceanBorderMask(layers.potential, width, height, OCEAN_BORDER[config.oceanBorder] || 0.15);
  let landMask = generateLandMask(layers.potential, width, height, targetLandRatio);

  await nextFrame();
  setProgress(0.25, '3/11 Validation bord océanique...');
  const touched = validateIslandDoesNotTouchEdges(landMask, width, height);
  if (touched) console.warn('Erreur corrigée : l\'île touchait le bord.');
  cleanupLandMask(landMask, width, height);
  validateIslandDoesNotTouchEdges(landMask, width, height);

  await nextFrame();
  setProgress(0.34, '4/11 Distances côte/terre...');
  const waterSource = new Uint8Array(landMask.length);
  const landSource = new Uint8Array(landMask.length);
  for (let i = 0; i < landMask.length; i++) {
    waterSource[i] = landMask[i] === 0 ? 1 : 0;
    landSource[i] = landMask[i] === 1 ? 1 : 0;
  }
  const distToWaterFromLand = computeDistance(waterSource, width, height);
  const distToLandFromWater = computeDistance(landSource, width, height);

  await nextFrame();
  setProgress(0.45, '5/11 Biomes...');
  const biomeIndex = assignBiomes(landMask, distToWaterFromLand, layers.macro, layers.temperature, layers.moisture, width, height);

  await nextFrame();
  setProgress(0.57, '6/11 Altitudes Minecraft Y...');
  const heights = generateHeights({ config, width, height, landMask, distToLandFromWater, distToWaterFromLand, macro: layers.macro, meso: layers.meso, micro: layers.micro, biomeIndex, seed });

  await nextFrame();
  setProgress(0.67, '7/11 Rivières / vallées...');
  carveRivers(heights, landMask, width, height, config.seaLevel, config.riverCount, seed);

  await nextFrame();
  setProgress(0.75, '8/11 Nettoyage artefacts...');
  cleanupHeights(heights, landMask, width, height, config.minY, config.maxY);

  await nextFrame();
  setProgress(0.84, '9/11 Quantification Y entier...');
  const terrainY = quantizeHeights(heights, config.minY, config.maxY);

  await nextFrame();
  setProgress(0.92, '10/11 Conversion Y → grayscale...');
  const realLandRatio = landRatio(landMask);
  const validation = validateWorldPainterHeightmap({ terrainY, landMask, width, height, minY: config.minY, maxY: config.maxY, seaLevel: config.seaLevel });

  state.terrain = {
    config,
    width,
    height,
    landMask,
    biomeIndex,
    terrainY,
    targetLandRatio,
    realLandRatio,
    validation,
    generatedMs: Math.round(performance.now() - started)
  };

  await nextFrame();
  setProgress(1, '11/11 Preview + export prêts ✅');
  render();
  renderStats();
  state.running = false;
}

function cacheUI() {
  const ids = ['status-text', 'topbar-meta', 'size', 'seed', 'randomSeed', 'applyPreset', 'presetSelect', 'minY', 'maxY', 'seaLevel', 'landCoverage', 'oceanBorder', 'mountainIntensity', 'erosionStrength', 'riverCount', 'generate', 'resetAll', 'exportHeightPng', 'progressFill', 'renderMode', 'canvas', 'emptyState', 'stats', 'biomeStats'];
  ids.forEach((id) => {
    const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    state.ui[key] = byId(id);
  });
}

function bindUI() {
  state.ui.randomSeed.addEventListener('click', () => {
    state.ui.seed.value = `seed-${Math.random().toString(36).slice(2, 10)}`;
  });
  state.ui.applyPreset.addEventListener('click', () => applyPreset(state.ui.presetSelect.value));
  state.ui.resetAll.addEventListener('click', () => applyPreset('balanced'));
  state.ui.generate.addEventListener('click', generate);
  state.ui.exportHeightPng.addEventListener('click', exportHeightmapPNG);
  state.ui.renderMode.addEventListener('change', render);
}

function init() {
  cacheUI();
  fillPresetSelect();
  applyPreset('balanced');
  bindUI();
  state.ui.statusText.textContent = 'Prêt. Cliquez sur « Générer la Heightmap ». La génération n\'est jamais automatique.';
}

window.addEventListener('DOMContentLoaded', init);
