/* ==============================
   1. CONSTANTES
================================ */
const EPSILON = 1e-6;
const PRESET_WORLD_TYPES = {
  realistic_island: { label: 'Île réaliste', landCoverage: 40, oceanBorder: 'large', relief: 'balanced', oceanDepth: 'medium', coastType: 'mixed', rivers: 'medium', mountainIntensity: 0.85 },
  archipelago: { label: 'Archipel', landCoverage: 30, oceanBorder: 'standard', relief: 'soft', oceanDepth: 'medium', coastType: 'soft', rivers: 'few', mountainIntensity: 0.65 },
  rpg_island: { label: 'Grande île RPG', landCoverage: 65, oceanBorder: 'low', relief: 'balanced', oceanDepth: 'medium', coastType: 'mixed', rivers: 'medium', mountainIntensity: 0.9 },
  pokemon_region: { label: 'Région Pokémon', landCoverage: 55, oceanBorder: 'standard', relief: 'balanced', oceanDepth: 'medium', coastType: 'mixed', rivers: 'few', mountainIntensity: 0.75 },
  coastal_continent: { label: 'Continent côtier', landCoverage: 75, oceanBorder: 'low', relief: 'mountain', oceanDepth: 'medium', coastType: 'rocky', rivers: 'many', mountainIntensity: 1.05 },
  mountain_world: { label: 'Monde montagneux', landCoverage: 55, oceanBorder: 'standard', relief: 'extreme', oceanDepth: 'deep', coastType: 'cliff', rivers: 'few', mountainIntensity: 1.35 },
  dramatic_fantasy: { label: 'Fantasy dramatique', landCoverage: 50, oceanBorder: 'standard', relief: 'extreme', oceanDepth: 'deep', coastType: 'cliff', rivers: 'medium', mountainIntensity: 1.5 }
};

const RELIEF_FACTOR = { flat: 0.4, soft: 0.7, balanced: 1.0, mountain: 1.25, extreme: 1.6 };
const OCEAN_BORDER_FACTOR = { low: 0.08, standard: 0.15, large: 0.22, immense: 0.30 };
const OCEAN_DEPTH_FACTOR = { shallow: 0.7, medium: 1.0, deep: 1.3 };
const RIVER_AMOUNT = { none: 0, few: 6, medium: 14, many: 24 };
const QUALITY = {
  fast: { octaves: 3, erosionPasses: 1, sourcesFactor: 0.6 },
  balanced: { octaves: 4, erosionPasses: 2, sourcesFactor: 1 },
  high: { octaves: 5, erosionPasses: 3, sourcesFactor: 1.4 },
  extreme: { octaves: 6, erosionPasses: 4, sourcesFactor: 1.8 }
};

const BIOME_DEFS = [
  { id: 'plains', name: 'Plaines', targetPercent: 18, minAltitude: 68, maxAltitude: 95, preferredAltitude: 80, roughness: 0.25, flatness: 0.9, mountainInfluence: 0.1, riverAffinity: 0.7, coastAffinity: 0.45, erosionStrength: 0.6, color: [133, 190, 92] },
  { id: 'hills', name: 'Collines', targetPercent: 12, minAltitude: 85, maxAltitude: 120, preferredAltitude: 102, roughness: 0.45, flatness: 0.45, mountainInfluence: 0.35, riverAffinity: 0.45, coastAffinity: 0.25, erosionStrength: 0.55, color: [114, 166, 86] },
  { id: 'mountains', name: 'Montagnes', targetPercent: 10, minAltitude: 130, maxAltitude: 240, preferredAltitude: 182, roughness: 0.85, flatness: 0.12, mountainInfluence: 1, riverAffinity: 0.35, coastAffinity: 0.08, erosionStrength: 0.25, color: [130, 130, 130] },
  { id: 'plateau', name: 'Hauts plateaux', targetPercent: 8, minAltitude: 110, maxAltitude: 160, preferredAltitude: 136, roughness: 0.35, flatness: 0.75, mountainInfluence: 0.5, riverAffinity: 0.35, coastAffinity: 0.15, erosionStrength: 0.4, color: [163, 145, 111] },
  { id: 'canyon', name: 'Canyon', targetPercent: 7, minAltitude: 70, maxAltitude: 150, preferredAltitude: 112, roughness: 0.7, flatness: 0.2, mountainInfluence: 0.55, riverAffinity: 0.2, coastAffinity: 0.12, erosionStrength: 0.18, color: [173, 118, 80] },
  { id: 'swamp', name: 'Marais', targetPercent: 6, minAltitude: 62, maxAltitude: 72, preferredAltitude: 67, roughness: 0.18, flatness: 0.96, mountainInfluence: 0, riverAffinity: 0.95, coastAffinity: 0.55, erosionStrength: 0.7, color: [88, 138, 98] },
  { id: 'forest', name: 'Forêt tempérée', targetPercent: 10, minAltitude: 70, maxAltitude: 110, preferredAltitude: 88, roughness: 0.4, flatness: 0.65, mountainInfluence: 0.2, riverAffinity: 0.55, coastAffinity: 0.35, erosionStrength: 0.55, color: [69, 126, 69] },
  { id: 'jungle', name: 'Jungle', targetPercent: 7, minAltitude: 70, maxAltitude: 120, preferredAltitude: 90, roughness: 0.46, flatness: 0.55, mountainInfluence: 0.2, riverAffinity: 0.9, coastAffinity: 0.55, erosionStrength: 0.62, color: [55, 146, 78] },
  { id: 'desert', name: 'Désert', targetPercent: 8, minAltitude: 65, maxAltitude: 105, preferredAltitude: 82, roughness: 0.3, flatness: 0.7, mountainInfluence: 0.15, riverAffinity: 0.08, coastAffinity: 0.25, erosionStrength: 0.45, color: [218, 190, 114] },
  { id: 'tundra', name: 'Toundra', targetPercent: 7, minAltitude: 90, maxAltitude: 170, preferredAltitude: 128, roughness: 0.4, flatness: 0.65, mountainInfluence: 0.42, riverAffinity: 0.4, coastAffinity: 0.2, erosionStrength: 0.4, color: [172, 183, 194] }
];

const COAST_BIOME_ID = 'coast';
const OCEAN_BIOME_ID = 'ocean';
const BIOME_COLORS = { coast: [222, 204, 156], ocean: [42, 78, 152] };

/* ==============================
   2. ÉTAT GLOBAL
================================ */
const state = {
  settings: null,
  terrain: null,
  running: false,
  lastValidation: null,
  ui: {}
};

/* ==============================
   3. UTILITAIRES
================================ */
const byId = (id) => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / ((edge1 - edge0) || 1), 0, 1);
  return t * t * (3 - 2 * t);
};
const idx = (x, y, width) => y * width + x;
const neighbors8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

function setProgress(ratio, label) {
  state.ui.progressFill.style.width = `${Math.round(clamp(ratio, 0, 1) * 100)}%`;
  state.ui.statusText.textContent = label;
}

function fastQuantileThreshold(values, targetRatio) {
  const copy = new Float32Array(values);
  copy.sort();
  const index = clamp(Math.floor((1 - targetRatio) * (copy.length - 1)), 0, copy.length - 1);
  return copy[index];
}

function downloadBlob(filename, blob) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ==============================
   4. RANDOM / NOISE
================================ */
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

function valueNoise2D(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const rand = (ix, iy) => {
    const n = Math.sin((ix * 127.1 + iy * 311.7 + seed * 0.0002) * 12.9898) * 43758.5453;
    return n - Math.floor(n);
  };
  const a = rand(xi, yi);
  const b = rand(xi + 1, yi);
  const c = rand(xi, yi + 1);
  const d = rand(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, seed, octaves = 4) {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * valueNoise2D(x * frequency, y * frequency, seed + i * 167);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / (norm || 1);
}

function ridgeNoise(x, y, seed, octaves = 4) {
  let total = 0;
  let amplitude = 0.65;
  let frequency = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = fbm(x * frequency, y * frequency, seed + i * 53, 2);
    total += (1 - Math.abs(2 * n - 1)) * amplitude;
    norm += amplitude;
    amplitude *= 0.58;
    frequency *= 1.9;
  }
  return total / (norm || 1);
}

/* ==============================
   5. CONFIG / PRESETS
================================ */
function initWorldPresets() {
  const select = state.ui.worldType;
  select.innerHTML = '';
  Object.entries(PRESET_WORLD_TYPES).forEach(([id, preset]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = preset.label;
    select.appendChild(option);
  });
  select.value = 'realistic_island';
}

function applyWorldPreset(typeId) {
  const preset = PRESET_WORLD_TYPES[typeId];
  if (!preset) return;
  state.ui.landCoverage.value = String(preset.landCoverage);
  state.ui.relief.value = preset.relief;
  state.ui.oceanBorder.value = preset.oceanBorder;
  state.ui.oceanDepth.value = preset.oceanDepth;
  state.ui.coastType.value = preset.coastType;
  state.ui.rivers.value = preset.rivers;
  state.ui.mountainIntensity.value = String(preset.mountainIntensity);
  state.ui.landCoverageValue.textContent = `${preset.landCoverage}%`;
}

function readConfig() {
  const minY = Number(state.ui.minY.value);
  const maxY = Number(state.ui.maxY.value);
  return {
    size: Number(state.ui.size.value),
    worldType: state.ui.worldType.value,
    landCoverage: clamp(Number(state.ui.landCoverage.value), 20, 80),
    oceanBorder: state.ui.oceanBorder.value,
    relief: state.ui.relief.value,
    oceanDepth: state.ui.oceanDepth.value,
    coastType: state.ui.coastType.value,
    rivers: state.ui.rivers.value,
    seed: state.ui.seed.value.trim() || 'seed',
    quality: state.ui.quality.value,
    seaLevel: clamp(Number(state.ui.seaLevel.value), 0, 255),
    minY: Math.min(minY, maxY - 1),
    maxY: Math.max(maxY, minY + 1),
    erosionStrength: Number(state.ui.erosionStrength.value),
    mountainIntensity: Number(state.ui.mountainIntensity.value),
    riverDepth: Number(state.ui.riverDepth.value),
    coastComplexity: Number(state.ui.coastComplexity.value),
    cleanupStrength: Number(state.ui.cleanupStrength.value),
    biomeTransition: Number(state.ui.biomeTransition.value),
    previewMode: state.ui.previewMode.value,
    biomeSettings: getBiomeSettingsNormalized(),
    buildLimitMin: -64,
    buildLimitMax: 320
  };
}

/* ==============================
   6. BIOMES
================================ */
function buildBiomeControls() {
  state.ui.biomeControls.innerHTML = '';
  BIOME_DEFS.forEach((biome) => {
    const row = document.createElement('div');
    row.className = 'biomeRow';
    row.innerHTML = `
      <input id="biome_on_${biome.id}" type="checkbox" checked />
      <label for="biome_pct_${biome.id}">${biome.name}</label>
      <input id="biome_pct_${biome.id}" type="number" min="0" max="100" step="1" value="${biome.targetPercent}" />`;
    state.ui.biomeControls.appendChild(row);
  });
}

function getBiomeSettingsNormalized() {
  const active = [];
  let sum = 0;
  BIOME_DEFS.forEach((biome) => {
    const enabled = byId(`biome_on_${biome.id}`).checked;
    const target = clamp(Number(byId(`biome_pct_${biome.id}`).value) || 0, 0, 100);
    if (enabled && target > 0) {
      sum += target;
      active.push({ ...biome, targetPercent: target });
    }
  });
  if (!active.length) {
    const fallback = BIOME_DEFS[0];
    return [{ ...fallback, targetPercent: 100 }];
  }
  return active.map((biome) => ({ ...biome, normalizedTarget: biome.targetPercent / sum }));
}

function selectBiomeForCell(context, biomes, rng) {
  const { altitude, moisture, temperature, coastDistance, mountainMask, riverPotential } = context;
  let bestBiome = biomes[0].id;
  let bestScore = -Infinity;

  for (const biome of biomes) {
    let score = 0;
    const altitudeDelta = Math.abs(altitude - biome.preferredAltitude) / Math.max(1, (biome.maxAltitude - biome.minAltitude));
    score += 1.2 - altitudeDelta;
    score += moisture * biome.riverAffinity * 0.7;
    score += (1 - temperature) * (biome.id === 'tundra' ? 1 : 0.1);
    score += temperature * (biome.id === 'desert' || biome.id === 'jungle' ? 0.8 : 0.2);
    score += coastDistance < 0.12 ? biome.coastAffinity : 0;
    score += mountainMask * biome.mountainInfluence;
    score += riverPotential * biome.riverAffinity * 0.5;
    score += (rng() - 0.5) * 0.22;
    score += biome.normalizedTarget * 1.5;
    if (altitude < biome.minAltitude || altitude > biome.maxAltitude) score -= 1.4;

    if (score > bestScore) {
      bestScore = score;
      bestBiome = biome.id;
    }
  }
  return bestBiome;
}

/* ==============================
   7. GÉNÉRATION TERRAIN
================================ */
function generateHeightmap() {
  if (state.running) return;
  state.running = true;

  const startedAt = performance.now();
  setProgress(0.02, 'Lecture de la configuration...');
  const config = readConfig();
  state.settings = config;

  const width = config.size;
  const height = config.size;
  const count = width * height;
  const seedNum = hashString(config.seed);
  const quality = QUALITY[config.quality] || QUALITY.balanced;

  setProgress(0.08, '1/14 - Land potential + domain warp...');
  const landPotential = new Float32Array(count);
  const landMask = new Uint8Array(count);
  const distanceToCoast = new Float32Array(count);
  const biomeMap = new Uint8Array(count);
  const riverMask = new Uint8Array(count);
  const floatHeight = new Float32Array(count);

  const oceanBorder = OCEAN_BORDER_FACTOR[config.oceanBorder] || OCEAN_BORDER_FACTOR.standard;
  const reliefFactor = RELIEF_FACTOR[config.relief] || RELIEF_FACTOR.balanced;
  const oceanDepthFactor = OCEAN_DEPTH_FACTOR[config.oceanDepth] || OCEAN_DEPTH_FACTOR.medium;

  for (let y = 0; y < height; y++) {
    const ny = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / (width - 1);
      const i = idx(x, y, width);

      const warpX = fbm(nx * 2.4, ny * 2.4, seedNum + 22, 3);
      const warpY = fbm(nx * 2.4, ny * 2.4, seedNum + 47, 3);
      const wx = nx + (warpX - 0.5) * 0.12;
      const wy = ny + (warpY - 0.5) * 0.12;

      const low = fbm(wx * 1.1, wy * 1.1, seedNum + 11, 3);
      const med = fbm(wx * 2.3, wy * 2.3, seedNum + 31, 4);
      const asym = fbm(wx * 0.85 + 13.3, wy * 0.85 + 9.6, seedNum + 101, 2);

      const dx = nx - 0.5;
      const dy = ny - 0.5;
      const angleNoise = fbm(nx * 1.8, ny * 1.8, seedNum + 808, 2);
      const rotated = Math.atan2(dy + EPSILON, dx + EPSILON) + (angleNoise - 0.5) * 0.9;
      const anisotropic = Math.cos(rotated * 1.6) * 0.08;
      const radial = Math.sqrt(dx * dx + dy * dy);
      const edge = smoothstep(0.42 - oceanBorder * 0.7, 0.62 - oceanBorder * 0.15, radial);

      landPotential[i] = (low * 0.56 + med * 0.28 + asym * 0.16 + anisotropic) - edge * (0.95 + config.coastComplexity * 0.35);
    }
  }

  setProgress(0.15, '2/14 - Seuil adaptatif de terre...');
  const threshold = fastQuantileThreshold(landPotential, config.landCoverage / 100);
  for (let i = 0; i < count; i++) {
    landMask[i] = landPotential[i] >= threshold ? 1 : 0;
  }

  if (config.worldType !== 'coastal_continent') {
    forceOceanBorder(landMask, width, height, oceanBorder);
  }
  cleanupLandMask(landMask, width, height, config.worldType);

  setProgress(0.24, '3/14 - Distance à la côte...');
  computeDistanceToCoast(landMask, distanceToCoast, width, height);

  setProgress(0.31, '4/14 - Biome map...');
  const biomeResult = generateBiomeMap({ config, landMask, distanceToCoast, biomeMap, width, height, seedNum });

  setProgress(0.42, '5-8/14 - Altitude float + relief + montagnes...');
  generateFloatAltitude({ config, width, height, seedNum, quality, reliefFactor, oceanDepthFactor, landMask, distanceToCoast, biomeMap, floatHeight });

  setProgress(0.56, '9/14 - Rivières / vallées...');
  carveRivers({ config, width, height, quality, seedNum, landMask, floatHeight, riverMask });

  setProgress(0.68, '10/14 - Érosion légère...');
  applyErosion(floatHeight, width, height, quality.erosionPasses, config.erosionStrength);

  setProgress(0.76, '11/14 - Cleanup...');
  cleanupHeightmap(floatHeight, landMask, width, height, config);

  setProgress(0.84, '12/14 - Quantification Y Minecraft...');
  const terrainY = quantizeTerrain(floatHeight, config.minY, config.maxY);

  setProgress(0.90, '13/14 - Conversion grayscale...');
  const grayscale = toGrayscaleArray(terrainY, config.minY, config.maxY);

  setProgress(0.96, '14/14 - Preview + validation...');
  state.terrain = {
    width,
    height,
    landMask,
    distanceToCoast,
    biomeMap,
    biomeResult,
    floatHeight,
    terrainY,
    grayscale,
    riverMask,
    seedNum,
    generatedMs: Math.round(performance.now() - startedAt)
  };

  state.lastValidation = validateTerrain(state.terrain, config);
  renderPreview();
  renderStats();

  setProgress(1, state.lastValidation.ok ? 'Génération terminée ✅' : 'Génération terminée avec avertissement');
  state.running = false;
}

function forceOceanBorder(landMask, width, height, borderFactor) {
  const margin = Math.max(2, Math.floor(Math.min(width, height) * borderFactor * 0.9));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < margin || y < margin || x >= width - margin || y >= height - margin) {
        landMask[idx(x, y, width)] = 0;
      }
    }
  }
}

function cleanupLandMask(landMask, width, height, worldType) {
  const minIslandPixels = Math.max(100, Math.floor(width * height * 0.00018));
  const visited = new Uint8Array(width * height);
  const components = [];

  for (let i = 0; i < landMask.length; i++) {
    if (landMask[i] === 0 || visited[i]) continue;
    const stack = [i];
    visited[i] = 1;
    const pixels = [];
    while (stack.length) {
      const current = stack.pop();
      pixels.push(current);
      const y = Math.floor(current / width);
      const x = current - y * width;
      for (const [ox, oy] of neighbors8) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = idx(nx, ny, width);
        if (!visited[ni] && landMask[ni] === 1) {
          visited[ni] = 1;
          stack.push(ni);
        }
      }
    }
    components.push(pixels);
  }

  components.sort((a, b) => b.length - a.length);
  components.forEach((component, index) => {
    const keep = worldType === 'archipelago' ? component.length >= minIslandPixels : index === 0 || component.length >= minIslandPixels;
    if (!keep) component.forEach((cell) => { landMask[cell] = 0; });
  });

  for (let i = 0; i < landMask.length; i++) {
    const y = Math.floor(i / width);
    const x = i - y * width;
    let aroundLand = 0;
    for (const [ox, oy] of neighbors8) {
      const nx = x + ox;
      const ny = y + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (landMask[idx(nx, ny, width)] === 1) aroundLand++;
    }
    if (landMask[i] === 0 && aroundLand >= 7) landMask[i] = 1;
    if (landMask[i] === 1 && aroundLand <= 1) landMask[i] = 0;
  }
}

function computeDistanceToCoast(landMask, outDistance, width, height) {
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const distance = new Int32Array(width * height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const selfLand = landMask[i] === 1;
      let boundary = false;
      for (const [ox, oy] of neighbors8) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if ((landMask[idx(nx, ny, width)] === 1) !== selfLand) {
          boundary = true;
          break;
        }
      }
      if (boundary) {
        distance[i] = 0;
        queue[tail++] = i;
      }
    }
  }

  while (head < tail) {
    const current = queue[head++];
    const cy = Math.floor(current / width);
    const cx = current - cy * width;
    const base = distance[current] + 1;

    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = idx(nx, ny, width);
      if (distance[ni] === -1) {
        distance[ni] = base;
        queue[tail++] = ni;
      }
    }
  }

  let maxDist = 1;
  for (let i = 0; i < distance.length; i++) {
    if (distance[i] > maxDist) maxDist = distance[i];
  }
  const inv = 1 / maxDist;
  for (let i = 0; i < distance.length; i++) {
    outDistance[i] = clamp(distance[i] * inv, 0, 1);
  }
}

function generateBiomeMap({ config, landMask, distanceToCoast, biomeMap, width, height, seedNum }) {
  const rng = mulberry32(seedNum ^ 0xa533d);
  const biomes = config.biomeSettings;
  const biomeIdToIndex = new Map();
  biomes.forEach((biome, i) => biomeIdToIndex.set(biome.id, i));

  const regionCount = Math.max(16, Math.floor(width / 64));
  const regionSeeds = [];
  for (let i = 0; i < regionCount; i++) {
    regionSeeds.push({ x: rng(), y: rng(), weight: rng() });
  }

  const counts = new Map();
  biomes.forEach((b) => counts.set(b.id, 0));
  counts.set(COAST_BIOME_ID, 0);
  counts.set(OCEAN_BIOME_ID, 0);

  for (let y = 0; y < height; y++) {
    const ny = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      if (landMask[i] === 0) {
        biomeMap[i] = 250;
        counts.set(OCEAN_BIOME_ID, counts.get(OCEAN_BIOME_ID) + 1);
        continue;
      }

      const nx = x / (width - 1);
      const moisture = fbm(nx * 2.4, ny * 2.4, seedNum + 700, 4);
      const temperature = clamp(1 - ny * 0.65 + fbm(nx * 1.5, ny * 1.5, seedNum + 701, 2) * 0.45, 0, 1);
      const coast = distanceToCoast[i];

      if (coast < 0.02) {
        biomeMap[i] = 251;
        counts.set(COAST_BIOME_ID, counts.get(COAST_BIOME_ID) + 1);
        continue;
      }

      let nearestDist = 999;
      let secondDist = 999;
      for (const region of regionSeeds) {
        const dx = nx - region.x;
        const dy = ny - region.y;
        const d = Math.sqrt(dx * dx + dy * dy) * (0.85 + region.weight * 0.3);
        if (d < nearestDist) {
          secondDist = nearestDist;
          nearestDist = d;
        } else if (d < secondDist) {
          secondDist = d;
        }
      }

      const mountainMask = ridgeNoise(nx * 1.7, ny * 1.7, seedNum + 812, 3);
      const pseudoAltitude = 70 + mountainMask * 105 + (coast * 30);
      const transition = clamp((secondDist - nearestDist) / Math.max(config.biomeTransition, EPSILON), 0, 1);
      const biomeId = selectBiomeForCell({
        altitude: pseudoAltitude,
        moisture,
        temperature,
        coastDistance: coast,
        mountainMask,
        riverPotential: moisture * (1 - coast),
        transition
      }, biomes, rng);

      const index = biomeIdToIndex.get(biomeId) ?? 0;
      biomeMap[i] = index;
      counts.set(biomeId, counts.get(biomeId) + 1);
    }
  }

  return {
    counts,
    biomeIndexToId: biomes.map((b) => b.id)
  };
}

function generateFloatAltitude({ config, width, height, seedNum, quality, reliefFactor, oceanDepthFactor, landMask, distanceToCoast, biomeMap, floatHeight }) {
  const baseSea = config.seaLevel;
  const biomeByIndex = config.biomeSettings;
  const coastBehavior = {
    soft: { beachWidth: 0.085, cliffChance: 0.06, slopeBoost: 0.5 },
    mixed: { beachWidth: 0.06, cliffChance: 0.13, slopeBoost: 0.8 },
    rocky: { beachWidth: 0.04, cliffChance: 0.22, slopeBoost: 1.08 },
    cliff: { beachWidth: 0.025, cliffChance: 0.34, slopeBoost: 1.35 }
  }[config.coastType];

  for (let y = 0; y < height; y++) {
    const ny = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const nx = x / (width - 1);
      const coastDist = distanceToCoast[i];
      const macro = fbm(nx * 1.2, ny * 1.2, seedNum + 302, quality.octaves);
      const meso = fbm(nx * 3.2, ny * 3.2, seedNum + 349, Math.max(2, quality.octaves - 1));
      const micro = fbm(nx * 8.1, ny * 8.1, seedNum + 410, 2) - 0.5;
      const ridge = ridgeNoise(nx * 1.8, ny * 1.8, seedNum + 420, 4);
      const mountainMask = smoothstep(0.42, 0.85, ridge) * config.mountainIntensity;
      const basinMap = 1 - smoothstep(0.25, 0.8, fbm(nx * 1.1, ny * 1.1, seedNum + 489, 3));

      if (landMask[i] === 0) {
        const oceanProfile = smoothstep(0, 1, coastDist);
        const deep = lerp(baseSea - 6, baseSea - 40 * oceanDepthFactor, oceanProfile);
        const abyss = ridge > 0.8 ? 8 : 0;
        floatHeight[i] = deep - abyss + micro * 2;
        continue;
      }

      const biomeCode = biomeMap[i];
      const biome = biomeCode >= 250 ? null : biomeByIndex[biomeCode] || biomeByIndex[0];
      const biomePref = biome ? biome.preferredAltitude : (baseSea + 15);
      const biomeRange = biome ? (biome.maxAltitude - biome.minAltitude) : 30;

      const inland = smoothstep(coastBehavior.beachWidth, 0.75, coastDist);
      const plainsBase = lerp(baseSea + 4, biomePref, inland);
      const macroRelief = (macro - 0.5) * 26 * reliefFactor;
      const mesoRelief = (meso - 0.5) * biomeRange * (biome ? biome.roughness : 0.35);
      const mountainRelief = mountainMask * (35 + ridge * 55 * reliefFactor);
      const basinCut = basinMap * (8 + (biome ? biome.erosionStrength : 0.4) * 8);

      let altitude = plainsBase + macroRelief + mesoRelief + mountainRelief - basinCut + micro * 4;

      if (coastDist < coastBehavior.beachWidth) {
        const t = clamp(coastDist / coastBehavior.beachWidth, 0, 1);
        const shore = lerp(baseSea + 1, baseSea + 5, t);
        altitude = lerp(shore, altitude, t);
      }

      const cliffNoise = fbm(nx * 6.2, ny * 6.2, seedNum + 531, 2);
      if (coastDist < 0.1 && cliffNoise > 1 - coastBehavior.cliffChance) {
        altitude += (cliffNoise - (1 - coastBehavior.cliffChance)) * 52 * coastBehavior.slopeBoost;
      }

      floatHeight[i] = clamp(altitude, config.minY, config.maxY);
    }
  }
}

/* ==============================
   8. RIVIÈRES
================================ */
function carveRivers({ config, width, height, quality, seedNum, landMask, floatHeight, riverMask }) {
  const riverCount = Math.floor(RIVER_AMOUNT[config.rivers] * quality.sourcesFactor);
  if (riverCount <= 0) return;

  const rng = mulberry32(seedNum ^ 0x95de42);
  const candidates = [];

  for (let i = 0; i < floatHeight.length; i++) {
    if (landMask[i] === 1 && floatHeight[i] > config.seaLevel + 30) candidates.push(i);
  }
  if (!candidates.length) return;

  const riverWidth = config.rivers === 'many' ? 3 : config.rivers === 'medium' ? 2 : 1;
  const valleyWidth = riverWidth + 2;

  for (let r = 0; r < riverCount; r++) {
    const source = candidates[Math.floor(rng() * candidates.length)];
    let current = source;
    let steps = 0;
    const visited = new Set([current]);

    while (steps < width * 1.4) {
      const cy = Math.floor(current / width);
      const cx = current - cy * width;
      const currentH = floatHeight[current];
      if (currentH <= config.seaLevel + 1 || landMask[current] === 0) break;

      let best = -1;
      let bestH = currentH;
      for (const [ox, oy] of neighbors8) {
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = idx(nx, ny, width);
        const h = floatHeight[ni] + (rng() - 0.5) * 0.5;
        if (h < bestH) {
          bestH = h;
          best = ni;
        }
      }
      if (best === -1 || visited.has(best)) break;

      for (let oy = -valleyWidth; oy <= valleyWidth; oy++) {
        for (let ox = -valleyWidth; ox <= valleyWidth; ox++) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = idx(nx, ny, width);
          const d = Math.sqrt(ox * ox + oy * oy);
          if (d <= riverWidth) {
            riverMask[ni] = 1;
            floatHeight[ni] = Math.min(floatHeight[ni], currentH - config.riverDepth * (1 - d / (riverWidth + EPSILON)));
          } else if (d <= valleyWidth) {
            floatHeight[ni] -= Math.max(0, (config.riverDepth * 0.45) * (1 - (d - riverWidth) / (valleyWidth - riverWidth + EPSILON)));
          }
        }
      }

      visited.add(best);
      current = best;
      steps++;
    }
  }
}

/* ==============================
   9. ÉROSION / CLEANUP
================================ */
function applyErosion(floatHeight, width, height, passes, strength) {
  if (strength <= 0 || passes <= 0) return;
  const temp = new Float32Array(floatHeight.length);

  for (let p = 0; p < passes; p++) {
    temp.set(floatHeight);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y, width);
        const h = temp[i];
        let sum = 0;
        let c = 0;
        let maxSlope = 0;

        for (const [ox, oy] of neighbors8) {
          const ni = idx(x + ox, y + oy, width);
          const nh = temp[ni];
          sum += nh;
          c++;
          maxSlope = Math.max(maxSlope, Math.abs(h - nh));
        }

        const avg = sum / c;
        const slopeFactor = smoothstep(2, 18, maxSlope);
        const mix = strength * (0.18 + slopeFactor * 0.32);
        floatHeight[i] = lerp(h, avg, mix);
      }
    }
  }
}

function cleanupHeightmap(floatHeight, landMask, width, height, config) {
  for (let i = 0; i < floatHeight.length; i++) {
    if (!Number.isFinite(floatHeight[i])) floatHeight[i] = config.seaLevel;
    floatHeight[i] = clamp(floatHeight[i], config.minY, config.maxY);
  }

  const strength = config.cleanupStrength;
  if (strength <= 0) return;

  const temp = new Float32Array(floatHeight);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y, width);
      const h = temp[i];
      let neighbors = 0;
      let sum = 0;
      let veryDiff = 0;
      for (const [ox, oy] of neighbors8) {
        const ni = idx(x + ox, y + oy, width);
        const nh = temp[ni];
        neighbors++;
        sum += nh;
        if (Math.abs(h - nh) > 25) veryDiff++;
      }
      if (veryDiff >= 6) {
        floatHeight[i] = lerp(h, sum / neighbors, 0.45 * strength);
      }
      if (landMask[i] === 1 && floatHeight[i] < config.seaLevel - 3) {
        floatHeight[i] = config.seaLevel - 2;
      }
    }
  }
}

/* ==============================
   10. CONVERSION WORLDPainter
================================ */
function minecraftYToGray(y, minY, maxY) {
  const gray = Math.round(((y - minY) / Math.max(1, (maxY - minY))) * 255);
  return clamp(gray, 0, 255);
}

function grayToMinecraftY(gray, minY, maxY) {
  const y = minY + (clamp(gray, 0, 255) / 255) * (maxY - minY);
  return Math.round(y);
}

function toGrayscaleArray(terrainY, minY, maxY) {
  const out = new Uint8ClampedArray(terrainY.length);
  for (let i = 0; i < terrainY.length; i++) {
    out[i] = minecraftYToGray(terrainY[i], minY, maxY);
  }
  return out;
}

/* ==============================
   11. RENDER PREVIEW
================================ */
function renderPreview() {
  const canvas = state.ui.canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const previewMode = state.ui.previewMode.value;
  const terrain = state.terrain;

  if (!terrain) {
    state.ui.emptyState.style.display = 'grid';
    return;
  }

  state.ui.emptyState.style.display = 'none';
  canvas.width = terrain.width;
  canvas.height = terrain.height;
  const image = ctx.createImageData(terrain.width, terrain.height);
  const data = image.data;

  for (let i = 0; i < terrain.grayscale.length; i++) {
    const base = i * 4;
    const gray = terrain.grayscale[i];

    if (previewMode === 'grayscale') {
      data[base] = gray;
      data[base + 1] = gray;
      data[base + 2] = gray;
    } else if (previewMode === 'biome') {
      const code = terrain.biomeMap[i];
      let color;
      if (code === 250) color = BIOME_COLORS.ocean;
      else if (code === 251) color = BIOME_COLORS.coast;
      else color = state.settings.biomeSettings[code]?.color || [180, 180, 180];
      data[base] = color[0];
      data[base + 1] = color[1];
      data[base + 2] = color[2];
    } else if (previewMode === 'hillshade') {
      const x = i % terrain.width;
      const y = Math.floor(i / terrain.width);
      const shade = computeHillshade(terrain.terrainY, terrain.width, terrain.height, x, y);
      data[base] = shade;
      data[base + 1] = shade;
      data[base + 2] = shade;
    } else if (previewMode === 'heat') {
      const h = terrain.terrainY[i];
      const t = (h - state.settings.minY) / Math.max(1, (state.settings.maxY - state.settings.minY));
      data[base] = Math.round(255 * smoothstep(0.25, 1, t));
      data[base + 1] = Math.round(255 * (1 - Math.abs(t - 0.5) * 1.8));
      data[base + 2] = Math.round(255 * smoothstep(0, 0.65, 1 - t));
    } else if (previewMode === 'slope') {
      const x = i % terrain.width;
      const y = Math.floor(i / terrain.width);
      const slope = computeSlope(terrain.terrainY, terrain.width, terrain.height, x, y);
      const v = Math.round(clamp(slope * 8, 0, 255));
      data[base] = v;
      data[base + 1] = v;
      data[base + 2] = v;
    } else if (previewMode === 'rivers') {
      if (terrain.riverMask[i] === 1) {
        data[base] = 50;
        data[base + 1] = 125;
        data[base + 2] = 225;
      } else {
        data[base] = gray;
        data[base + 1] = gray;
        data[base + 2] = gray;
      }
    }
    data[base + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
}

function computeHillshade(terrainY, width, height, x, y) {
  const xm = clamp(x - 1, 0, width - 1);
  const xp = clamp(x + 1, 0, width - 1);
  const ym = clamp(y - 1, 0, height - 1);
  const yp = clamp(y + 1, 0, height - 1);
  const dzdx = (terrainY[idx(xp, y, width)] - terrainY[idx(xm, y, width)]) * 0.5;
  const dzdy = (terrainY[idx(x, yp, width)] - terrainY[idx(x, ym, width)]) * 0.5;
  const slope = Math.sqrt(dzdx * dzdx + dzdy * dzdy);
  const shade = 210 - slope * 10 + (-dzdx * 2 - dzdy * 1.5);
  return clamp(Math.round(shade), 25, 255);
}

function computeSlope(terrainY, width, height, x, y) {
  const c = terrainY[idx(x, y, width)];
  let maxD = 0;
  for (const [ox, oy] of neighbors8) {
    const nx = clamp(x + ox, 0, width - 1);
    const ny = clamp(y + oy, 0, height - 1);
    maxD = Math.max(maxD, Math.abs(c - terrainY[idx(nx, ny, width)]));
  }
  return maxD;
}

/* ==============================
   12. EXPORT
================================ */
function exportPNG() {
  if (!state.terrain || !state.settings) return;
  const { width, height, grayscale } = state.terrain;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);

  for (let i = 0; i < grayscale.length; i++) {
    const base = i * 4;
    const g = grayscale[i];
    image.data[base] = g;
    image.data[base + 1] = g;
    image.data[base + 2] = g;
    image.data[base + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const name = `heightmap_${state.settings.seed}_${width}x${height}_worldpainter.png`;
    downloadBlob(name, blob);
  }, 'image/png');
}

function exportJSON() {
  if (!state.settings) return;
  const payload = {
    seed: state.settings.seed,
    size: state.settings.size,
    landCoverage: state.settings.landCoverage,
    oceanBorder: state.settings.oceanBorder,
    seaLevel: state.settings.seaLevel,
    minY: state.settings.minY,
    maxY: state.settings.maxY,
    biomeSettings: state.settings.biomeSettings.map((b) => ({ id: b.id, targetPercent: b.targetPercent, enabled: true })),
    worldPainter: {
      exportMinY: state.settings.minY,
      exportMaxY: state.settings.maxY,
      waterLevel: 64,
      buildLimitMin: state.settings.buildLimitMin,
      buildLimitMax: state.settings.buildLimitMax,
      graySeaLevel: minecraftYToGray(64, state.settings.minY, state.settings.maxY)
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(`heightmap_${state.settings.seed}_${state.settings.size}x${state.settings.size}_preset.json`, blob);
}

/* ==============================
   13. UI
================================ */
function cacheUI() {
  state.ui = {
    statusText: byId('status-text'),
    topbarMeta: byId('topbar-meta'),
    size: byId('size'),
    worldType: byId('worldType'),
    landCoverage: byId('landCoverage'),
    landCoverageValue: byId('landCoverageValue'),
    oceanBorder: byId('oceanBorder'),
    relief: byId('relief'),
    oceanDepth: byId('oceanDepth'),
    coastType: byId('coastType'),
    rivers: byId('rivers'),
    quality: byId('quality'),
    seed: byId('seed'),
    randomSeed: byId('randomSeed'),
    generate: byId('generate'),
    exportPng: byId('exportPng'),
    exportJson: byId('exportJson'),
    resetPreset: byId('resetPreset'),
    progressFill: byId('progressFill'),
    seaLevel: byId('seaLevel'),
    minY: byId('minY'),
    maxY: byId('maxY'),
    erosionStrength: byId('erosionStrength'),
    mountainIntensity: byId('mountainIntensity'),
    riverDepth: byId('riverDepth'),
    coastComplexity: byId('coastComplexity'),
    cleanupStrength: byId('cleanupStrength'),
    biomeTransition: byId('biomeTransition'),
    biomeControls: byId('biomeControls'),
    previewMode: byId('previewMode'),
    canvas: byId('canvas'),
    emptyState: byId('emptyState'),
    stats: byId('stats'),
    worldPainterStats: byId('worldPainterStats'),
    biomeStats: byId('biomeStats')
  };
}

function bindUI() {
  state.ui.landCoverage.addEventListener('input', () => {
    state.ui.landCoverageValue.textContent = `${state.ui.landCoverage.value}%`;
  });

  state.ui.worldType.addEventListener('change', () => applyWorldPreset(state.ui.worldType.value));

  state.ui.randomSeed.addEventListener('click', () => {
    state.ui.seed.value = `seed-${Math.random().toString(36).slice(2, 10)}`;
  });

  state.ui.generate.addEventListener('click', () => {
    if (state.running) return;
    state.ui.generate.disabled = true;
    setTimeout(() => {
      generateHeightmap();
      state.ui.generate.disabled = false;
    }, 10);
  });

  state.ui.previewMode.addEventListener('change', renderPreview);
  state.ui.exportPng.addEventListener('click', exportPNG);
  state.ui.exportJson.addEventListener('click', exportJSON);
  state.ui.resetPreset.addEventListener('click', () => applyWorldPreset(state.ui.worldType.value));

  [state.ui.seaLevel, state.ui.minY, state.ui.maxY].forEach((input) => {
    input.addEventListener('input', renderWorldPainterHints);
  });
}

function renderStats() {
  if (!state.terrain || !state.settings) return;
  const terrain = state.terrain;
  const config = state.settings;
  const count = terrain.width * terrain.height;

  let landPixels = 0;
  let minH = 99999;
  let maxH = -99999;
  for (let i = 0; i < count; i++) {
    if (terrain.landMask[i] === 1) landPixels++;
    minH = Math.min(minH, terrain.terrainY[i]);
    maxH = Math.max(maxH, terrain.terrainY[i]);
  }

  const landRatio = (landPixels / count) * 100;
  const oceanRatio = 100 - landRatio;

  state.ui.stats.innerHTML = `
    <li>Terre cible : ${config.landCoverage}%</li>
    <li>Terre réelle : ${landRatio.toFixed(2)}%</li>
    <li>Océan réel : ${oceanRatio.toFixed(2)}%</li>
    <li>Altitude min : Y${minH}</li>
    <li>Altitude max : Y${maxH}</li>
    <li>Sea level : Y${config.seaLevel}</li>
    <li>Temps de génération : ${terrain.generatedMs} ms</li>
    <li>Validation : ${state.lastValidation.ok ? 'OK' : 'warning'}</li>`;

  const wpGraySea = minecraftYToGray(64, config.minY, config.maxY);
  state.ui.worldPainterStats.innerHTML = `
    <li>Sea Level : Y64</li>
    <li>Gray sea level : ${wpGraySea}</li>
    <li>Min Y export : ${config.minY}</li>
    <li>Max Y export : ${config.maxY}</li>
    <li>Lowest Value = ${config.minY}</li>
    <li>Water Level = 64</li>
    <li>Highest Value = ${config.maxY}</li>
    <li>Build Limits = -64 / 320</li>
    <li>Compatibilité WorldPainter : ${state.lastValidation.canExport ? 'compatible' : 'à vérifier'}</li>`;

  const biomeCounts = new Map();
  for (let i = 0; i < terrain.biomeMap.length; i++) {
    const code = terrain.biomeMap[i];
    let id = OCEAN_BIOME_ID;
    if (code === 251) id = COAST_BIOME_ID;
    else if (code < 250) id = config.biomeSettings[code]?.id || 'plains';
    biomeCounts.set(id, (biomeCounts.get(id) || 0) + 1);
  }

  const lines = [];
  config.biomeSettings.forEach((biome) => {
    const real = ((biomeCounts.get(biome.id) || 0) / count) * 100;
    lines.push(`<li>${biome.name}: cible ${biome.targetPercent.toFixed(1)}% / réel ${real.toFixed(2)}%</li>`);
  });
  lines.push(`<li>Côte: réel ${(((biomeCounts.get(COAST_BIOME_ID) || 0) / count) * 100).toFixed(2)}%</li>`);
  lines.push(`<li>Océan: réel ${(((biomeCounts.get(OCEAN_BIOME_ID) || 0) / count) * 100).toFixed(2)}%</li>`);
  state.ui.biomeStats.innerHTML = lines.join('');

  state.ui.topbarMeta.textContent = `Sea Level Y64 • Gray ${wpGraySea} • Export ${config.minY}-${config.maxY}`;
}

function renderWorldPainterHints() {
  const minY = Number(state.ui.minY.value);
  const maxY = Number(state.ui.maxY.value);
  state.ui.topbarMeta.textContent = `Sea Level Y64 • Gray ${minecraftYToGray(64, minY, maxY)} • Export ${minY}-${maxY}`;
}

/* ==============================
   14. INIT
================================ */
function init() {
  cacheUI();
  initWorldPresets();
  buildBiomeControls();
  applyWorldPreset('realistic_island');
  bindUI();
  renderWorldPainterHints();
  setProgress(0, 'Prêt. Génération manuelle uniquement.');
}

window.addEventListener('DOMContentLoaded', init);

function quantizeTerrain(floatHeight, minY, maxY) {
  const out = new Uint16Array(floatHeight.length);
  for (let i = 0; i < floatHeight.length; i++) {
    out[i] = clamp(Math.round(floatHeight[i]), minY, maxY);
  }
  return out;
}

function validateTerrain(terrain, config) {
  const result = {
    ok: true,
    canExport: true,
    issues: []
  };

  if (!terrain || !terrain.terrainY?.length) {
    result.ok = false;
    result.canExport = false;
    result.issues.push('Terrain vide');
    return result;
  }

  let hasSeaLevel = false;
  let minH = Number.POSITIVE_INFINITY;
  let maxH = Number.NEGATIVE_INFINITY;
  let invalidCount = 0;

  for (let i = 0; i < terrain.floatHeight.length; i++) {
    const f = terrain.floatHeight[i];
    if (!Number.isFinite(f)) invalidCount++;
  }

  for (let i = 0; i < terrain.terrainY.length; i++) {
    const y = terrain.terrainY[i];
    if (y === config.seaLevel) hasSeaLevel = true;
    if (y < minH) minH = y;
    if (y > maxH) maxH = y;
  }

  if (invalidCount > 0) result.issues.push(`Valeurs invalides: ${invalidCount}`);
  if (!hasSeaLevel) result.issues.push('Sea level absent');
  if (minH < config.minY || maxH > config.maxY) result.issues.push('Min/max hors bornes');
  if (!terrain.grayscale || terrain.grayscale.length !== terrain.terrainY.length) result.issues.push('Grayscale invalide');

  if (result.issues.length) {
    result.ok = false;
  }
  return result;
}
