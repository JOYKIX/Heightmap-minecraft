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
  fast: { octaves: 3, erosionIters: 1 },
  balanced: { octaves: 5, erosionIters: 2 },
  high: { octaves: 6, erosionIters: 3 },
  extreme: { octaves: 7, erosionIters: 4 }
};

const WORLD_PRESETS = {
  continents: { label: 'Continents', landCoverage: 'high', reliefStyle: 'varied', riversLevel: 'medium', coastStyle: 'mixed' },
  archipelago: { label: 'Archipel', landCoverage: 'medium', reliefStyle: 'playable', riversLevel: 'few', coastStyle: 'soft' },
  highlands: { label: 'Highlands', landCoverage: 'high', reliefStyle: 'mountainous', riversLevel: 'medium', coastStyle: 'rocky' },
  superflat: { label: 'Superflat', landCoverage: 'very-high', reliefStyle: 'very-flat', riversLevel: 'none', coastStyle: 'soft' }
};

const BIOME_PRESETS = {
  balanced: { label: 'Balanced', weights: { ocean: 1, beach: 1, plains: 1, forest: 1, desert: 1, taiga: 1, mountains: 1, river: 1 } },
  temperate: { label: 'Tempéré', weights: { ocean: 1, beach: 1, plains: 1.2, forest: 1.3, desert: 0.5, taiga: 0.9, mountains: 0.8, river: 1 } },
  wild: { label: 'Sauvage', weights: { ocean: 1, beach: 1, plains: 0.8, forest: 1.1, desert: 0.9, taiga: 1, mountains: 1.6, river: 1 } }
};

const BIOME_COLORS = {
  ocean: [24, 72, 160],
  beach: [218, 205, 151],
  plains: [120, 180, 80],
  forest: [44, 120, 52],
  desert: [219, 194, 113],
  taiga: [90, 126, 118],
  mountains: [120, 120, 120],
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
function classifyBiome(heightNorm, moisture, temperature, isRiver) {
  if (isRiver) return 'river';
  if (heightNorm < 0.45) return 'ocean';
  if (heightNorm < 0.48) return 'beach';
  if (heightNorm > 0.82) return 'mountains';
  if (temperature > 0.65 && moisture < 0.4) return 'desert';
  if (temperature < 0.35) return 'taiga';
  return moisture > 0.55 ? 'forest' : 'plains';
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

    setStep('Initialisation...', 0.02);
    const size = state.settings.mapSize;
    const seedBase = hashString(state.settings.seed || 'seed');
    const octaves = QUALITY[state.settings.qualityMode]?.octaves ?? 5;
    const rand = mulberry32(seedBase ^ 0x9e3779b9);

    const height = new Float32Array(size * size);
    const riverMask = new Uint8Array(size * size);
    const biomeMap = new Uint8Array(size * size);

    setStep('Base terrain...', 0.2);
    const landCoverage = LAND_COVERAGE[state.settings.landCoverage];
    const border = OCEAN_BORDER[state.settings.oceanBorder];
    const relief = RELIEF[state.settings.reliefStyle] * state.settings.mountainScale;

    for (let y = 0; y < size; y++) {
      const ny = y / size;
      for (let x = 0; x < size; x++) {
        const nx = x / size;
        const i = idx(x, y, size);
        const n = fbm(nx * 4.8, ny * 4.8, seedBase, octaves);
        const m = fbm(nx * 1.8, ny * 1.8, seedBase + 719, 3);
        const radial = Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5));
        const coastMask = smoothstep(0.5 - border, 0.5, radial);
        let v = n * 0.72 + m * 0.28;
        v = (v - (1 - landCoverage)) * 1.25;
        v = v * (1 - coastMask) - coastMask * 0.25;
        height[i] = clamp(0.5 + v * relief, 0, 1);
      }
    }

    setStep('Montagnes...', 0.36);
    addMountains(height, size, seedBase, relief);

    setStep('Rivières...', 0.5);
    generateRivers(height, riverMask, size, seedBase, rand);

    setStep('Érosion...', 0.66);
    erodeHeightmap(height, size);

    setStep('Biomes...', 0.8);
    const biomeStats = paintBiomes(height, riverMask, biomeMap, size, seedBase);

    setStep('Nettoyage...', 0.9);
    cleanupTerrain(height, size);

    state.terrain = {
      size,
      height,
      riverMask,
      biomeMap,
      biomeStats,
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

function addMountains(height, size, seed, relief) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      if (height[i] < 0.5) continue;
      const r = Math.abs(fbm((x / size) * 8, (y / size) * 8, seed + 4444, 4) * 2 - 1);
      const m = Math.pow(r, 2.2) * 0.18 * relief;
      height[i] = clamp(height[i] + m, 0, 1);
    }
  }
}

function generateRivers(height, riverMask, size, seed, rand) {
  const density = RIVERS[state.settings.riversLevel] ?? 2;
  if (!density) return;
  const starts = Math.max(1, Math.floor((size / 256) * density));

  for (let r = 0; r < starts; r++) {
    let x = Math.floor(rand() * size);
    let y = Math.floor(rand() * size);
    for (let tries = 0; tries < 120; tries++) {
      if (height[idx(x, y, size)] > 0.68) break;
      x = Math.floor(rand() * size);
      y = Math.floor(rand() * size);
    }

    for (let step = 0; step < size * 1.5; step++) {
      const i = idx(x, y, size);
      if (height[i] < 0.48) break;
      riverMask[i] = 1;
      height[i] = clamp(height[i] - (0.003 + state.settings.riverDepth * 0.01), 0, 1);

      let bestX = x, bestY = y, bestH = height[i];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (ox === 0 && oy === 0) continue;
          const nx = x + ox, ny = y + oy;
          if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) continue;
          const ni = idx(nx, ny, size);
          const directionalBias = valueNoise2D(nx * 0.03, ny * 0.03, seed + 911) * 0.005;
          const h = height[ni] + directionalBias;
          if (h < bestH) {
            bestH = h;
            bestX = nx;
            bestY = ny;
          }
        }
      }
      if (bestX === x && bestY === y) break;
      x = bestX;
      y = bestY;
    }
  }
}

function erodeHeightmap(height, size) {
  const iters = QUALITY[state.settings.qualityMode]?.erosionIters ?? 2;
  const alpha = clamp(state.settings.cleanupStrength * 0.25, 0.05, 0.25);
  const scratch = new Float32Array(height.length);

  for (let it = 0; it < iters; it++) {
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = idx(x, y, size);
        const avg = (
          height[i] +
          height[idx(x - 1, y, size)] + height[idx(x + 1, y, size)] +
          height[idx(x, y - 1, size)] + height[idx(x, y + 1, size)]
        ) / 5;
        scratch[i] = lerp(height[i], avg, alpha);
      }
    }
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        height[idx(x, y, size)] = scratch[idx(x, y, size)] || height[idx(x, y, size)];
      }
    }
  }
}

function paintBiomes(height, riverMask, biomeMap, size, seed) {
  const labels = Object.keys(BIOME_COLORS);
  const counts = Object.fromEntries(labels.map((b) => [b, 0]));
  const weights = getBiomeWeights();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      const moisture = fbm((x / size) * 3.1, (y / size) * 3.1, seed + 2718, 4);
      const tempBase = 1 - Math.abs((y / size) * 2 - 1);
      const temperature = clamp(tempBase * 0.65 + fbm((x / size) * 2.5, (y / size) * 2.5, seed + 313, 3) * 0.35, 0, 1);

      let biome = classifyBiome(height[i], moisture, temperature, riverMask[i] === 1);
      if (weights[biome] < 0.8 && valueNoise2D(x * 0.02, y * 0.02, seed + 57) > weights[biome]) {
        biome = 'plains';
      }
      const bIndex = labels.indexOf(biome);
      biomeMap[i] = bIndex;
      counts[biome] += 1;
    }
  }
  return counts;
}

/* ==============================
   8. CLEANUP
================================ */
function cleanupTerrain(height, size) {
  const edgeStrength = OCEAN_BORDER[state.settings.oceanBorder] * 1.3;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = idx(x, y, size);
      const nx = x / size;
      const ny = y / size;
      const d = Math.max(Math.abs(nx - 0.5), Math.abs(ny - 0.5));
      const edge = smoothstep(0.45, 0.5, d);
      height[i] = clamp(height[i] - edge * edgeStrength, 0, 1);
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
    } else {
      r = g = b = Math.round(h * 255);
    }

    const p = i * 4;
    image.data[p] = r;
    image.data[p + 1] = g;
    image.data[p + 2] = b;
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
    ['Niveau mer plausible', stats.avg > 0.35 && stats.avg < 0.7]
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
