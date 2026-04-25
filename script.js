/* ==============================
   1. CONSTANTES
================================ */
const MAP_SIZES = [512, 1024, 2048, 4096];
const LAND_COVERAGE = {
  'very-low': 0.2,
  low: 0.3,
  medium: 0.45,
  high: 0.6,
  'very-high': 0.75
};
const OCEAN_BORDER = {
  near: 0.05,
  standard: 0.12,
  wide: 0.2,
  'very-wide': 0.28,
  immense: 0.35
};
const RELIEF = {
  'very-flat': 0.3,
  playable: 0.6,
  varied: 0.9,
  mountainous: 1.25,
  extreme: 1.8
};
const RIVERS = { none: 0, few: 2, medium: 5, many: 9 };
const QUALITY = {
  fast: { octaves: 3, erosionIters: 1, hydraulicIters: 1, thermalIters: 1, riverPasses: 1, microRelief: 0.35 },
  balanced: { octaves: 5, erosionIters: 2, hydraulicIters: 2, thermalIters: 2, riverPasses: 2, microRelief: 0.55 },
  high: { octaves: 6, erosionIters: 3, hydraulicIters: 3, thermalIters: 3, riverPasses: 3, microRelief: 0.75 },
  extreme: { octaves: 7, erosionIters: 5, hydraulicIters: 5, thermalIters: 4, riverPasses: 4, microRelief: 1 }
};

const WORLD_PRESETS = {
  continents: { label: 'Continents', landCoverage: 'high', reliefStyle: 'varied', riversLevel: 'medium', coastStyle: 'mixed' },
  archipelago: { label: 'Archipel', landCoverage: 'medium', reliefStyle: 'playable', riversLevel: 'few', coastStyle: 'soft' },
  highlands: { label: 'Highlands', landCoverage: 'high', reliefStyle: 'mountainous', riversLevel: 'medium', coastStyle: 'rocky' },
  superflat: { label: 'Superflat', landCoverage: 'very-high', reliefStyle: 'very-flat', riversLevel: 'none', coastStyle: 'soft' }
};

const BIOME_PRESETS = {
  balanced: { label: 'Balanced', weights: { ocean: 1, beach: 1, plains: 1, forest: 1, desert: 1, taiga: 1, mountains: 1, river: 1, wetlands: 1, plateau: 1 } },
  temperate: { label: 'Tempéré', weights: { ocean: 1, beach: 1, plains: 1.2, forest: 1.3, desert: 0.5, taiga: 0.9, mountains: 0.8, river: 1, wetlands: 1.1, plateau: 1 } },
  wild: { label: 'Sauvage', weights: { ocean: 1, beach: 1, plains: 0.8, forest: 1.1, desert: 0.9, taiga: 1, mountains: 1.6, river: 1, wetlands: 0.9, plateau: 1.2 } }
};

const BIOME_COLORS = {
  ocean: [24, 72, 160],
  beach: [218, 205, 151],
  plains: [120, 180, 80],
  forest: [44, 120, 52],
  desert: [219, 194, 113],
  taiga: [90, 126, 118],
  mountains: [120, 120, 120],
  plateau: [157, 145, 112],
  wetlands: [84, 146, 118],
  river: [52, 117, 204]
};

/* ==============================
   2. ÉTAT GLOBAL
================================ */
const state = {
  settings: {
    mapSize: 1024,
    worldType: 'continents',
    landCoverage: 'medium',
    oceanBorder: 'standard',
    reliefStyle: 'playable',
    oceanDepth: 'medium',
    coastStyle: 'mixed',
    riversLevel: 'few',
    qualityMode: 'balanced',
    biomePreset: 'balanced',
    seed: 'minecraft-surface',
    minY: 20,
    maxY: 260,
    mountainScale: 1.1,
    riverDepth: 0.2,
    cleanupStrength: 0.5,
    biomeTransitionWidth: 0.25,
    previewMode: 'grayscale',
    zoom: 1,
    showGrid: false
  },
  terrain: null,
  ui: {},
  running: false,
  lastError: null
};

/* ==============================
   3. UTILITAIRES
================================ */
function byId(id) { return document.getElementById(id); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}
function idx(x, y, size) { return y * size + x; }
function withErrorBoundary(fn, context = 'operation') {
  try {
    return fn();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}

/* ==============================
   4. RANDOM / NOISE
================================ */
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise2D(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const r = (ix, iy) => {
    const n = Math.sin((ix * 127.1 + iy * 311.7 + seed * 0.0001) * 12.9898) * 43758.5453;
    return n - Math.floor(n);
  };
  const a = r(xi, yi), b = r(xi + 1, yi), c = r(xi, yi + 1), d = r(xi + 1, yi + 1);
  const ux = xf * xf * (3 - 2 * xf);
  const uy = yf * yf * (3 - 2 * yf);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function fbm(x, y, seed, octaves) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, y * freq, seed + i * 131) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / (norm || 1);
}

/* ==============================
   5. PRESETS
================================ */
function applyWorldPreset(name) {
  const preset = WORLD_PRESETS[name];
  if (!preset) return;
  state.settings.worldType = name;
  state.settings.landCoverage = preset.landCoverage;
  state.settings.reliefStyle = preset.reliefStyle;
  state.settings.riversLevel = preset.riversLevel;
  state.settings.coastStyle = preset.coastStyle;
  syncControlsFromState();
  updateSummary();
}

function getBiomeWeights() {
  return BIOME_PRESETS[state.settings.biomePreset]?.weights || BIOME_PRESETS.balanced.weights;
}

/* ==============================
   6. BIOMES
================================ */
function classifyBiome(heightNorm, moisture, temperature, slope, basin, isRiver) {
  if (isRiver) return 'river';
  if (heightNorm < 0.47) return 'ocean';
  if (heightNorm < 0.5) return 'beach';
  if (basin > 0.65 && moisture > 0.62 && slope < 0.06) return 'wetlands';
  if (heightNorm > 0.84 && slope < 0.08) return 'plateau';
  if (heightNorm > 0.82 || slope > 0.18) return 'mountains';
  if (temperature > 0.68 && moisture < 0.42) return 'desert';
  if (temperature < 0.34) return 'taiga';
  return moisture > 0.56 ? 'forest' : 'plains';
}

/* ==============================
   7. GÉNÉRATION TERRAIN
================================ */
function generateTerrain() {
  if (state.running) return;
  state.running = true;
  state.lastError = null;

  return withErrorBoundary(() => {
    readSettingsFromControls();
    validateSettings(state.settings);

    const size = state.settings.mapSize;
    const seedBase = hashString(state.settings.seed || 'seed');
    const quality = QUALITY[state.settings.qualityMode] || QUALITY.balanced;
    const relief = RELIEF[state.settings.reliefStyle] * state.settings.mountainScale;

    setStep('Initialisation du moteur géologique...', 0.03);
    const height = new Float32Array(size * size);
    const riverMask = new Uint8Array(size * size);
    const biomeMap = new Uint8Array(size * size);
    const flowTo = new Int32Array(size * size).fill(-1);

    const maps = {
      worldStructureMap: new Float32Array(size * size),
      landMask: new Float32Array(size * size),
      tectonicMap: new Float32Array(size * size),
      terrainDirectionMap: new Float32Array(size * size),
      flowDirectionMap: new Float32Array(size * size),
      basinMap: new Float32Array(size * size),
      mountainMap: new Float32Array(size * size),
      erosionMap: new Float32Array(size * size),
      riverFlowMap: new Float32Array(size * size),
      coastDistanceMap: new Float32Array(size * size),
      moistureMap: new Float32Array(size * size),
      temperatureMap: new Float32Array(size * size),
      biomeInfluenceMap: new Float32Array(size * size),
      slopeMap: new Float32Array(size * size),
      cliffMap: new Float32Array(size * size),
      coastalErosionMap: new Float32Array(size * size)
    };

    setStep('Macro structure: plaques / bassins / dorsales...', 0.16);
    const tectonicRegions = generateMacroStructure(maps, size, seedBase, quality, relief);

    setStep('Relief dirigé & distribution altimétrique...', 0.3);
    buildBaseHeight(height, maps, size, seedBase, quality, relief);
    applyHeightDistributionCurve(height);

    setStep('Drainage / bassins versants / rivières...', 0.48);
    generateDrainageNetwork(height, maps, riverMask, flowTo, size, quality, seedBase);

    setStep('Érosion hydraulique + thermique...', 0.68);
    applyAdvancedErosion(height, maps, flowTo, size, quality);

    setStep('Côtes naturelles & micro-relief...', 0.78);
    computeCoastDistanceMap(height, maps, size);
    applyCoastalErosion(height, maps, size, seedBase);
    addMicroRelief(height, maps, size, seedBase, quality);

    setStep('Climat + biomes cohérents...', 0.88);
    computeClimateMaps(height, maps, size, seedBase);
    computeSlopeAndCliffs(height, maps, size);
    const biomeStats = paintBiomes(height, riverMask, biomeMap, maps, size, seedBase);

    setStep('Nettoyage jouabilité...', 0.95);
    cleanupTerrain(height, maps, size);

    state.terrain = {
      size,
      height,
      riverMask,
      biomeMap,
      biomeStats,
      maps,
      tectonicRegions,
      minHeight: state.settings.minY,
      maxHeight: state.settings.maxY
    };

    setStep('Rendu...', 1);
    renderPreview();
    renderStats();
    drawHistogram();
    state.running = false;
  }, 'terrain generation');
}

function generateMacroStructure(maps, size, seed, quality, relief) {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const regionCount = Math.max(6, Math.floor(8 + quality.erosionIters * 2 + (size >= 2048 ? 3 : 0)));
  const tectonicRegions = [];
  const types = ['collision', 'separation', 'compression', 'fracture'];

  for (let i = 0; i < regionCount; i++) {
    tectonicRegions.push({
      x: rand(),
      y: rand(),
      strength: 0.4 + rand() * 0.85,
      radius: 0.18 + rand() * 0.34,
      type: types[Math.floor(rand() * types.length)],
      angle: rand() * Math.PI * 2,
      age: rand()
    });
  }

  const targetLand = LAND_COVERAGE[state.settings.landCoverage] || 0.45;
  const oceanBorder = OCEAN_BORDER[state.settings.oceanBorder] || 0.12;

  for (let y = 0; y < size; y++) {
    const ny = y / size;
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const i = idx(x, y, size);

      const continentNoise = fbm(nx * 1.2, ny * 1.2, seed + 11, 4);
      const continentWarp = fbm(nx * 2.6, ny * 2.6, seed + 77, 3);
      const radial = Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5));
      const edgeFalloff = smoothstep(0.5 - oceanBorder, 0.54, radial);
      const land = clamp((continentNoise * 0.68 + continentWarp * 0.32 - (1 - targetLand)) * 2.3 + 0.5 - edgeFalloff * 0.95, 0, 1);
      maps.landMask[i] = land;

      let tectonic = 0;
      let mountain = 0;
      let basin = 0;
      let dirX = 0;
      let dirY = 0;

      for (const region of tectonicRegions) {
        const dx = nx - region.x;
        const dy = ny - region.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / region.radius);
        if (!influence) continue;

        let local = 0;
        if (region.type === 'collision') {
          local = influence * region.strength;
          mountain += Math.pow(influence, 1.6) * region.strength;
        } else if (region.type === 'separation') {
          local = -influence * region.strength * 0.8;
          basin += Math.pow(influence, 1.2) * region.strength;
        } else if (region.type === 'compression') {
          local = influence * region.strength * 0.55;
          mountain += Math.pow(influence, 1.1) * region.strength * 0.45;
          basin += Math.pow(1 - influence, 2) * 0.2;
        } else {
          const fault = Math.sin((dx * Math.cos(region.angle) + dy * Math.sin(region.angle)) * 38);
          local = fault * influence * region.strength * 0.35;
          basin += Math.abs(fault) * influence * 0.25;
        }

        tectonic += local;
        dirX += Math.cos(region.angle) * local;
        dirY += Math.sin(region.angle) * local;
      }

      const structureNoise = fbm(nx * 3.2, ny * 3.2, seed + 991, 3);
      const structure = clamp(0.45 + tectonic * 0.45 + (structureNoise - 0.5) * 0.26, 0, 1);

      maps.tectonicMap[i] = clamp(tectonic * 0.5 + 0.5, 0, 1);
      maps.mountainMap[i] = clamp(mountain * relief * 0.7, 0, 1);
      maps.basinMap[i] = clamp(basin * 0.78 + (1 - maps.landMask[i]) * 0.15, 0, 1);
      maps.worldStructureMap[i] = structure;
      maps.terrainDirectionMap[i] = Math.atan2(dirY || 0.001, dirX || 0.001);
    }
  }
  return tectonicRegions;
}

function buildBaseHeight(height, maps, size, seed, quality, relief) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      const nx = x / size;
      const ny = y / size;

      const dir = maps.terrainDirectionMap[i];
      const ax = Math.cos(dir), ay = Math.sin(dir);
      const anisotropic = fbm((nx + ax * 0.05) * 6.8, (ny + ay * 0.05) * 3.2, seed + 411, quality.octaves);
      const base = fbm(nx * 2.2, ny * 2.2, seed + 17, 4);

      const mountains = maps.mountainMap[i] * 0.52;
      const basins = maps.basinMap[i] * 0.42;
      const tectonic = (maps.tectonicMap[i] - 0.5) * 0.36;
      const structure = (maps.worldStructureMap[i] - 0.5) * 0.48;
      const coastControl = maps.landMask[i];

      let h = 0.38 + base * 0.32 + anisotropic * 0.22 + mountains + tectonic + structure - basins;
      h = lerp(h * 0.45, h, coastControl);
      h *= relief;
      h = lerp(h, 0.36, clamp(1 - coastControl, 0, 1));
      height[i] = clamp(h, 0, 1);
    }
  }
}

function applyHeightDistributionCurve(height) {
  for (let i = 0; i < height.length; i++) {
    const h = height[i];
    const plains = Math.pow(h, 1.55);
    const peaks = Math.pow(h, 3.2);
    const curve = lerp(plains, peaks, smoothstep(0.68, 1, h));
    height[i] = clamp(curve, 0, 1);
  }
}

function generateDrainageNetwork(height, maps, riverMask, flowTo, size, quality, seed) {
  const total = size * size;
  const order = Array.from({ length: total }, (_, i) => i);
  order.sort((a, b) => height[b] - height[a]);

  const accum = maps.riverFlowMap;
  for (let i = 0; i < total; i++) accum[i] = 1;

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = idx(x, y, size);
      let best = i;
      let bestH = height[i];
      let bestDir = maps.terrainDirectionMap[i];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const ni = idx(x + ox, y + oy, size);
          const directionalBias = Math.cos(Math.atan2(oy, ox) - maps.terrainDirectionMap[i]) * -0.003;
          const h = height[ni] + directionalBias;
          if (h < bestH) {
            bestH = h;
            best = ni;
            bestDir = Math.atan2(oy, ox);
          }
        }
      }
      flowTo[i] = best === i ? -1 : best;
      maps.flowDirectionMap[i] = bestDir;
    }
  }

  for (const i of order) {
    const downstream = flowTo[i];
    if (downstream >= 0) accum[downstream] += accum[i];
  }

  const density = RIVERS[state.settings.riversLevel] ?? 2;
  if (!density) return;

  const normFactor = 1 / Math.max(1, total / 7200);
  const thresholdBase = clamp(220 / density, 34, 280) / quality.riverPasses;

  for (let p = 0; p < quality.riverPasses; p++) {
    const threshold = thresholdBase * (1 + p * 0.28);
    for (let i = 0; i < total; i++) {
      const flow = accum[i] * normFactor;
      if (flow < threshold || height[i] < 0.5) continue;

      riverMask[i] = 1;
      maps.riverFlowMap[i] = clamp(flow / (threshold * 2.2), 0, 1);

      const erosionDepth = (0.0018 + state.settings.riverDepth * 0.0052) * (1 + maps.riverFlowMap[i]);
      height[i] = clamp(height[i] - erosionDepth, 0, 1);

      const x = i % size;
      const y = (i / size) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = idx(nx, ny, size);
          const valley = 0.0025 * (1 - (Math.abs(ox) + Math.abs(oy)) * 0.3);
          height[ni] = clamp(height[ni] - valley * (0.4 + maps.riverFlowMap[i]), 0, 1);
        }
      }
    }
  }
}

function applyAdvancedErosion(height, maps, flowTo, size, quality) {
  const total = size * size;
  const scratch = new Float32Array(total);
  const sediment = new Float32Array(total);
  const cleanup = clamp(state.settings.cleanupStrength, 0, 1);

  for (let it = 0; it < quality.hydraulicIters; it++) {
    scratch.set(height);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = idx(x, y, size);
        const d = flowTo[i];
        if (d < 0) continue;
        const dh = height[i] - height[d];
        if (dh <= 0) continue;

        const flow = maps.riverFlowMap[i] + maps.basinMap[i] * 0.2;
        const erode = clamp(dh * (0.017 + flow * 0.022) * (0.6 + cleanup * 0.8), 0, 0.012);
        scratch[i] = clamp(scratch[i] - erode, 0, 1);
        sediment[d] += erode * 0.76;
        maps.erosionMap[i] = clamp(maps.erosionMap[i] + erode * 18, 0, 1);
      }
    }

    for (let i = 0; i < total; i++) {
      const deposit = sediment[i] * (0.45 + maps.basinMap[i] * 0.45);
      height[i] = clamp(scratch[i] + deposit, 0, 1);
      sediment[i] *= 0.24;
    }
  }

  for (let it = 0; it < quality.thermalIters; it++) {
    scratch.set(height);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = idx(x, y, size);
        let maxDrop = 0;
        let target = i;

        const h = height[i];
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const ni = idx(x + ox, y + oy, size);
            const drop = h - height[ni];
            if (drop > maxDrop) {
              maxDrop = drop;
              target = ni;
            }
          }
        }

        const talus = 0.028 + maps.cliffMap[i] * 0.03;
        if (maxDrop > talus && target !== i) {
          const move = (maxDrop - talus) * 0.26;
          scratch[i] -= move;
          scratch[target] += move;
          maps.erosionMap[i] = clamp(maps.erosionMap[i] + move * 14, 0, 1);
        }
      }
    }
    for (let i = 0; i < total; i++) {
      height[i] = clamp(scratch[i], 0, 1);
    }
  }

  for (let i = 0; i < total; i++) {
    const preserveCliff = smoothstep(0.62, 0.95, maps.mountainMap[i]);
    height[i] = lerp(height[i], clamp(height[i] + preserveCliff * 0.015, 0, 1), preserveCliff * 0.35);
  }
}

function computeCoastDistanceMap(height, maps, size) {
  const dist = maps.coastDistanceMap;
  const max = size * size;
  const coastThreshold = 0.5;

  for (let i = 0; i < dist.length; i++) dist[i] = max;

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = idx(x, y, size);
      const water = height[i] < coastThreshold;
      const n = height[idx(x + 1, y, size)] < coastThreshold;
      const s = height[idx(x - 1, y, size)] < coastThreshold;
      const e = height[idx(x, y + 1, size)] < coastThreshold;
      const w = height[idx(x, y - 1, size)] < coastThreshold;
      if ((water && (!n || !s || !e || !w)) || (!water && (n || s || e || w))) dist[i] = 0;
    }
  }

  for (let y = 1; y < size; y++) {
    for (let x = 1; x < size; x++) {
      const i = idx(x, y, size);
      dist[i] = Math.min(dist[i], dist[idx(x - 1, y, size)] + 1, dist[idx(x, y - 1, size)] + 1);
    }
  }
  for (let y = size - 2; y >= 0; y--) {
    for (let x = size - 2; x >= 0; x--) {
      const i = idx(x, y, size);
      dist[i] = Math.min(dist[i], dist[idx(x + 1, y, size)] + 1, dist[idx(x, y + 1, size)] + 1);
    }
  }

  const norm = Math.max(size * 0.24, 1);
  for (let i = 0; i < dist.length; i++) dist[i] = clamp(dist[i] / norm, 0, 1);
}

function applyCoastalErosion(height, maps, size, seed) {
  const styleMap = { soft: 0.35, mixed: 0.6, rocky: 0.9, cliff: 1.2 };
  const style = styleMap[state.settings.coastStyle] ?? 0.6;

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = idx(x, y, size);
      const coast = 1 - maps.coastDistanceMap[i];
      if (coast < 0.08) continue;

      const noise = fbm((x / size) * 12, (y / size) * 12, seed + 730, 3);
      const rugged = Math.abs(noise - 0.5) * 2;
      const cliffFactor = smoothstep(0.65, 1, rugged) * style;

      maps.coastalErosionMap[i] = clamp(coast * cliffFactor, 0, 1);
      const coastDrop = coast * 0.028 * (0.35 + cliffFactor);
      height[i] = clamp(height[i] - coastDrop * (height[i] > 0.5 ? 1 : 0.42), 0, 1);

      if (height[i] > 0.51 && cliffFactor > 0.75) {
        maps.cliffMap[i] = clamp(maps.cliffMap[i] + cliffFactor * 0.4, 0, 1);
      }
    }
  }
}

function addMicroRelief(height, maps, size, seed, quality) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      if (height[i] < 0.5) continue;

      const biomeProxy = clamp((maps.basinMap[i] * 0.5 + maps.mountainMap[i] * 0.9), 0, 1);
      const ridgeNoise = fbm((x / size) * 19.5, (y / size) * 19.5, seed + 551, 2);
      const rippleNoise = fbm((x / size) * 32, (y / size) * 32, seed + 552, 2);
      const ravine = Math.pow(Math.abs(ridgeNoise - 0.5) * 2, 2.6);

      let delta = (ridgeNoise - 0.5) * 0.018 + (rippleNoise - 0.5) * 0.011;
      delta += (ravine - 0.4) * 0.014 * maps.mountainMap[i];
      delta *= quality.microRelief * (0.35 + biomeProxy * 0.9);

      height[i] = clamp(height[i] + delta, 0, 1);
    }
  }
}

function computeClimateMaps(height, maps, size, seed) {
  for (let y = 0; y < size; y++) {
    const latitude = Math.abs((y / (size - 1)) * 2 - 1);
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      const nx = x / size;
      const ny = y / size;
      const altitude = height[i];

      const maritime = 1 - maps.coastDistanceMap[i];
      const rainShadow = clamp(maps.mountainMap[i] * (1 - maritime), 0, 1);
      const moistureNoise = fbm(nx * 3.2, ny * 3.2, seed + 2718, 4);
      const temperatureNoise = fbm(nx * 2.1, ny * 2.1, seed + 313, 3);

      const moisture = clamp(0.32 + moistureNoise * 0.42 + maritime * 0.28 + maps.basinMap[i] * 0.25 - rainShadow * 0.3, 0, 1);
      const temperature = clamp(0.88 - latitude * 0.72 - altitude * 0.38 + temperatureNoise * 0.21, 0, 1);

      maps.moistureMap[i] = moisture;
      maps.temperatureMap[i] = temperature;
      maps.biomeInfluenceMap[i] = clamp((moisture * 0.55 + (1 - temperature) * 0.25 + maps.basinMap[i] * 0.2), 0, 1);
    }
  }
}

function computeSlopeAndCliffs(height, maps, size) {
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = idx(x, y, size);
      const dx = (height[idx(x + 1, y, size)] - height[idx(x - 1, y, size)]) * 0.5;
      const dy = (height[idx(x, y + 1, size)] - height[idx(x, y - 1, size)]) * 0.5;
      const slope = Math.sqrt(dx * dx + dy * dy);
      maps.slopeMap[i] = slope;
      maps.cliffMap[i] = Math.max(maps.cliffMap[i], smoothstep(0.08, 0.2, slope));
    }
  }
}

function paintBiomes(height, riverMask, biomeMap, maps, size, seed) {
  const labels = Object.keys(BIOME_COLORS);
  const counts = Object.fromEntries(labels.map((b) => [b, 0]));
  const weights = getBiomeWeights();
  const transitionWidth = clamp(state.settings.biomeTransitionWidth, 0.05, 0.7);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      const moisture = maps.moistureMap[i];
      const temperature = maps.temperatureMap[i];
      const slope = maps.slopeMap[i];
      const basin = maps.basinMap[i];

      const transitionNoise = (valueNoise2D(x * 0.05, y * 0.05, seed + 57) - 0.5) * transitionWidth;
      let biome = classifyBiome(clamp(height[i] + transitionNoise, 0, 1), moisture, temperature, slope, basin, riverMask[i] === 1);

      const reject = weights[biome] < 1 && valueNoise2D(x * 0.027, y * 0.027, seed + 93) > weights[biome];
      if (reject) biome = maps.biomeInfluenceMap[i] > 0.5 ? 'forest' : 'plains';

      const bIndex = labels.indexOf(biome);
      biomeMap[i] = bIndex < 0 ? labels.indexOf('plains') : bIndex;
      counts[biome] += 1;
    }
  }
  return counts;
}

/* ==============================
   8. CLEANUP
================================ */
function cleanupTerrain(height, maps, size) {
  const edgeStrength = OCEAN_BORDER[state.settings.oceanBorder] * (1.1 + state.settings.cleanupStrength * 0.7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      const nx = x / size;
      const ny = y / size;
      const d = Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5));
      const edge = smoothstep(0.43, 0.56, d);
      const playablePlain = smoothstep(0.42, 0.7, maps.worldStructureMap[i]) * (1 - maps.mountainMap[i]);

      height[i] = clamp(height[i] - edge * edgeStrength, 0, 1);
      if (height[i] > 0.53 && playablePlain > 0.64 && maps.slopeMap[i] < 0.06) {
        height[i] = lerp(height[i], 0.62, 0.08);
      }
    }
  }
}

/* ==============================
   9. RENDER PREVIEW
================================ */
function renderPreview(forceMode) {
  const terrain = state.terrain;
  if (!terrain) return;

  const canvas = state.ui.canvas;
  const ctx = state.ui.ctx;
  const size = terrain.size;
  const mode = forceMode || state.settings.previewMode;
  const labels = Object.keys(BIOME_COLORS);

  canvas.width = size;
  canvas.height = size;
  const image = ctx.createImageData(size, size);

  for (let i = 0; i < terrain.height.length; i++) {
    const h = terrain.height[i];
    const maps = terrain.maps;
    let r = 0, g = 0, b = 0;

    if (mode === 'biome-map') {
      const color = BIOME_COLORS[labels[terrain.biomeMap[i]]] || [0, 0, 0];
      [r, g, b] = color;
    } else if (mode === 'hillshade') {
      const x = i % size;
      const y = (i / size) | 0;
      const dx = terrain.height[idx(clamp(x + 1, 0, size - 1), y, size)] - terrain.height[idx(clamp(x - 1, 0, size - 1), y, size)];
      const dy = terrain.height[idx(x, clamp(y + 1, 0, size - 1), size)] - terrain.height[idx(x, clamp(y - 1, 0, size - 1), size)];
      const shade = clamp(0.5 + (0.8 - dx * 2.5 - dy * 2), 0, 1);
      r = g = b = Math.round(shade * 255);
    } else if (mode === 'altitude-heatmap') {
      r = Math.round(clamp((h - 0.35) * 2.5, 0, 1) * 255);
      g = Math.round(clamp((1 - Math.abs(h - 0.5) * 2), 0, 1) * 255);
      b = Math.round(clamp((0.6 - h) * 2, 0, 1) * 255);
    } else if (mode === 'rivers-preview') {
      if (terrain.riverMask[i]) [r, g, b] = [42, 126, 220];
      else r = g = b = Math.round(h * 255);
    } else if (mode === 'slope-preview') {
      const s = clamp((maps.slopeMap[i] || 0) * 5.2, 0, 1);
      r = Math.round(s * 255);
      g = Math.round((1 - Math.abs(s - 0.45)) * 220);
      b = Math.round((1 - s) * 180);
    } else if (mode === 'erosion-preview') {
      const e = maps.erosionMap[i] || 0;
      r = Math.round(e * 255);
      g = Math.round(clamp(h * 0.8, 0, 1) * 180);
      b = Math.round((1 - e) * 180);
    } else if (mode === 'tectonic-preview') {
      const t = maps.tectonicMap[i] || 0;
      r = Math.round(t * 255);
      g = Math.round((1 - Math.abs(t - 0.5) * 2) * 220);
      b = Math.round((1 - t) * 255);
    } else if (mode === 'coast-distance-preview') {
      const c = maps.coastDistanceMap[i] || 0;
      r = Math.round((1 - c) * 30);
      g = Math.round((1 - c) * 190 + c * 80);
      b = Math.round(c * 255);
    } else if (mode === 'contour-preview') {
      const contour = Math.abs(((h * 32) % 1) - 0.5) < 0.04 ? 1 : 0;
      const v = Math.round(h * 190);
      r = v + contour * 65;
      g = v + contour * 45;
      b = v + contour * 18;
    } else {
      r = g = b = Math.round(h * 255);
    }

    const p = i * 4;
    image.data[p] = clamp(Math.round(r), 0, 255);
    image.data[p + 1] = clamp(Math.round(g), 0, 255);
    image.data[p + 2] = clamp(Math.round(b), 0, 255);
    image.data[p + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);

  if (state.settings.showGrid) drawGrid();
  byId('viewport').style.transform = `scale(${state.settings.zoom})`;
}

function drawGrid() {
  const { ctx, canvas } = state.ui;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.17)';
  ctx.lineWidth = Math.max(1, canvas.width / 1024);
  const step = Math.max(16, Math.floor(canvas.width / 16));
  for (let x = 0; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

/* ==============================
   10. EXPORT
================================ */
function exportPng() {
  if (!state.terrain) return showMessage('Aucune terrain à exporter.', true);
  withErrorBoundary(() => {
    const out = document.createElement('canvas');
    out.width = state.terrain.size;
    out.height = state.terrain.size;
    const octx = out.getContext('2d');
    const old = state.ui;
    state.ui = { canvas: out, ctx: octx };
    renderPreview('grayscale');
    state.ui = old;

    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `heightmap-${(state.settings.seed || 'map').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}.png`;
    a.click();
    showMessage('PNG exporté.');
  }, 'png export');
}

function exportJson() {
  withErrorBoundary(() => {
    const payload = {
      generatedAt: new Date().toISOString(),
      settings: state.settings,
      stats: gatherStats(),
      biomeStats: state.terrain?.biomeStats || null
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heightmap-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showMessage('JSON exporté.');
  }, 'json export');
}

/* ==============================
   11. UI
================================ */
function cacheUi() {
  state.ui = {
    canvas: byId('canvas'),
    ctx: byId('canvas').getContext('2d', { willReadFrequently: true }),
    progress: byId('progress'),
    pipelineStep: byId('pipeline-step'),
    summary: byId('config-summary'),
    stats: byId('stats'),
    biomeResults: byId('biome-results'),
    wp: byId('wp-compatibility'),
    histogram: byId('histogram')
  };
}

function buildPresetSelectors() {
  const world = byId('world-type');
  const biome = byId('biome-preset');
  world.innerHTML = '';
  biome.innerHTML = '';
  Object.entries(WORLD_PRESETS).forEach(([key, p]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = p.label;
    world.appendChild(opt);
  });
  Object.entries(BIOME_PRESETS).forEach(([key, p]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = p.label;
    biome.appendChild(opt);
  });
}

function readSettingsFromControls() {
  const g = (id) => byId(id);
  state.settings.mapSize = Number(g('map-size').value);
  state.settings.worldType = g('world-type').value;
  state.settings.landCoverage = g('land-coverage').value;
  state.settings.oceanBorder = g('ocean-border').value;
  state.settings.reliefStyle = g('relief-style').value;
  state.settings.oceanDepth = g('ocean-depth').value;
  state.settings.coastStyle = g('coast-style').value;
  state.settings.riversLevel = g('rivers-level').value;
  state.settings.qualityMode = g('quality-mode').value;
  state.settings.biomePreset = g('biome-preset').value;
  state.settings.seed = g('seed').value.trim();
  state.settings.minY = Number(g('min-y').value);
  state.settings.maxY = Number(g('max-y').value);
  state.settings.mountainScale = Number(g('mountain-scale').value);
  state.settings.riverDepth = Number(g('river-depth').value);
  state.settings.cleanupStrength = Number(g('cleanup-strength').value);
  state.settings.biomeTransitionWidth = Number(g('biome-transition-width').value);
  state.settings.previewMode = g('preview-mode').value;
  state.settings.zoom = Number(g('zoom').value);
  state.settings.showGrid = g('show-grid').checked;
}

function syncControlsFromState() {
  const map = {
    'map-size': state.settings.mapSize,
    'world-type': state.settings.worldType,
    'land-coverage': state.settings.landCoverage,
    'ocean-border': state.settings.oceanBorder,
    'relief-style': state.settings.reliefStyle,
    'ocean-depth': state.settings.oceanDepth,
    'coast-style': state.settings.coastStyle,
    'rivers-level': state.settings.riversLevel,
    'quality-mode': state.settings.qualityMode,
    'biome-preset': state.settings.biomePreset,
    'seed': state.settings.seed,
    'min-y': state.settings.minY,
    'max-y': state.settings.maxY,
    'mountain-scale': state.settings.mountainScale,
    'river-depth': state.settings.riverDepth,
    'cleanup-strength': state.settings.cleanupStrength,
    'biome-transition-width': state.settings.biomeTransitionWidth,
    'preview-mode': state.settings.previewMode,
    'zoom': state.settings.zoom
  };
  Object.entries(map).forEach(([id, value]) => {
    const el = byId(id);
    if (el) el.value = String(value);
  });
  byId('show-grid').checked = state.settings.showGrid;
}

function bindUi() {
  byId('generate').addEventListener('click', generateTerrain);
  byId('quick-preview').addEventListener('click', () => {
    if (state.terrain) renderPreview();
    else showMessage('Générez d’abord une heightmap.', true);
  });

  byId('download-png').addEventListener('click', exportPng);
  byId('download-json').addEventListener('click', exportJson);

  byId('world-type').addEventListener('change', (e) => applyWorldPreset(e.target.value));
  byId('biome-preset').addEventListener('change', () => { readSettingsFromControls(); updateSummary(); });

  byId('new-seed').addEventListener('click', randomizeSeed);
  byId('random-seed').addEventListener('click', randomizeSeed);

  byId('preview-mode').addEventListener('change', () => { readSettingsFromControls(); if (state.terrain) renderPreview(); });
  byId('zoom').addEventListener('input', () => { readSettingsFromControls(); if (state.terrain) renderPreview(); });
  byId('show-grid').addEventListener('change', () => { readSettingsFromControls(); if (state.terrain) renderPreview(); });

  ['map-size', 'land-coverage', 'ocean-border', 'relief-style', 'ocean-depth', 'coast-style', 'rivers-level', 'quality-mode', 'seed', 'min-y', 'max-y', 'mountain-scale', 'river-depth', 'cleanup-strength', 'biome-transition-width']
    .forEach((id) => byId(id).addEventListener('change', () => {
      readSettingsFromControls();
      updateSummary();
    }));

  byId('biome-rebalance')?.addEventListener('click', () => {
    showMessage('Preset biomes rééquilibré (mode simplifié).');
  });

  byId('biome-random')?.addEventListener('click', () => {
    const presets = Object.keys(BIOME_PRESETS);
    state.settings.biomePreset = presets[Math.floor(Math.random() * presets.length)];
    syncControlsFromState();
    updateSummary();
    showMessage(`Preset biome: ${state.settings.biomePreset}`);
  });
}

function randomizeSeed() {
  state.settings.seed = Math.random().toString(36).slice(2, 14);
  byId('seed').value = state.settings.seed;
  updateSummary();
}

function setStep(text, progress) {
  if (state.ui.pipelineStep) state.ui.pipelineStep.textContent = text;
  if (state.ui.progress) state.ui.progress.style.width = `${Math.round(progress * 100)}%`;
}
function showMessage(message, isError = false) {
  setStep(message, isError ? 0 : 1);
  byId('pipeline-step').style.color = isError ? '#ff8a8a' : '';
}

function updateSummary() {
  const list = state.ui.summary;
  list.innerHTML = '';
  const items = [
    ['Taille', `${state.settings.mapSize}x${state.settings.mapSize}`],
    ['Monde', state.settings.worldType],
    ['Relief', state.settings.reliefStyle],
    ['Rivières', state.settings.riversLevel],
    ['Qualité', state.settings.qualityMode],
    ['Seed', state.settings.seed || '(vide)']
  ];
  for (const [k, v] of items) {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    list.appendChild(li);
  }
}

function gatherStats() {
  if (!state.terrain) return null;
  const arr = state.terrain.height;
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
  }
  return { min, max, avg: sum / arr.length };
}

function renderStats() {
  const stats = gatherStats();
  if (!stats) return;

  state.ui.stats.innerHTML = '';
  const out = {
    'Altitude min (norm.)': stats.min.toFixed(3),
    'Altitude max (norm.)': stats.max.toFixed(3),
    'Altitude moyenne': stats.avg.toFixed(3),
    'Rivières (pixels)': state.terrain.riverMask.reduce((acc, v) => acc + v, 0),
    'Min Y export': state.settings.minY,
    'Max Y export': state.settings.maxY
  };
  Object.entries(out).forEach(([k, v]) => {
    const li = document.createElement('li');
    li.textContent = `${k}: ${v}`;
    state.ui.stats.appendChild(li);
  });

  state.ui.biomeResults.innerHTML = '';
  const total = state.terrain.size * state.terrain.size;
  Object.entries(state.terrain.biomeStats).forEach(([biome, count]) => {
    const li = document.createElement('li');
    li.textContent = `${biome}: ${((count / total) * 100).toFixed(1)}%`;
    state.ui.biomeResults.appendChild(li);
  });

  state.ui.wp.innerHTML = '';
  const wpChecks = [
    ['Plage Y valide', state.settings.minY < state.settings.maxY],
    ['Amplitude raisonnable', state.settings.maxY - state.settings.minY <= 320],
    ['Niveau mer plausible', stats.avg > 0.35 && stats.avg < 0.7],
    ['Plaines jouables', (state.terrain.biomeStats.plains || 0) / total > 0.15]
  ];
  wpChecks.forEach(([k, ok]) => {
    const li = document.createElement('li');
    li.textContent = `${ok ? '✅' : '⚠️'} ${k}`;
    state.ui.wp.appendChild(li);
  });
}

function drawHistogram() {
  if (!state.terrain) return;
  const canvas = state.ui.histogram;
  const ctx = canvas.getContext('2d');
  const bins = 32;
  const hist = new Array(bins).fill(0);
  for (const h of state.terrain.height) hist[Math.min(bins - 1, Math.floor(h * bins))]++;
  const maxBin = Math.max(...hist);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1d2230';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width / bins;
  for (let i = 0; i < bins; i++) {
    const bh = (hist[i] / maxBin) * (canvas.height - 12);
    ctx.fillStyle = '#7fb3ff';
    ctx.fillRect(i * w, canvas.height - bh, w - 1, bh);
  }
}

/* ==============================
   12. INIT
================================ */
function validateSettings(s) {
  if (!MAP_SIZES.includes(s.mapSize)) throw new Error(`Map size invalide: ${s.mapSize}`);
  if (!s.seed) throw new Error('Seed vide.');
  if (s.minY >= s.maxY) throw new Error('Min Y doit être inférieur à Max Y.');
}

function handleError(error, context) {
  console.error(`[error:${context}]`, error);
  state.running = false;
  state.lastError = String(error?.message || error || 'Erreur inconnue');
  showMessage(`Erreur: ${state.lastError}`, true);
}

function init() {
  cacheUi();
  buildPresetSelectors();
  syncControlsFromState();
  bindUi();
  updateSummary();
  showMessage('Prêt. Modifiez puis cliquez sur Générer.');
}

document.addEventListener('DOMContentLoaded', init);
