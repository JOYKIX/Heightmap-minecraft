const EPS = 1e-6;

const PRESETS = {
  balanced_world: {
    label: 'Monde équilibré',
    globals: { seaLevel: 0.48, reliefIntensity: 1.1, waterAmount: 0.5, erosionStrength: 0.45, smoothing: 0.3, mountainIntensity: 1.1, valleyIntensity: 0.8 },
    biomes: { plains: 24, hills: 12, mountains: 16, forest: 16, swamp: 8, canyon: 6, desert: 8, taiga: 10, coast_islands: 10 }
  },
  tropical_island: {
    label: 'Île tropicale',
    globals: { seaLevel: 0.54, reliefIntensity: 0.95, waterAmount: 0.65, erosionStrength: 0.4, smoothing: 0.4, mountainIntensity: 0.9, valleyIntensity: 0.7 },
    biomes: { plains: 14, hills: 8, mountains: 8, forest: 25, swamp: 14, canyon: 3, desert: 2, taiga: 0, coast_islands: 26 }
  },
  giant_mountains: {
    label: 'Grandes montagnes',
    globals: { seaLevel: 0.43, reliefIntensity: 1.8, waterAmount: 0.35, erosionStrength: 0.55, smoothing: 0.24, mountainIntensity: 1.7, valleyIntensity: 1.3 },
    biomes: { plains: 10, hills: 16, mountains: 34, forest: 12, swamp: 2, canyon: 6, desert: 4, taiga: 16, coast_islands: 0 }
  },
  desert_canyon: {
    label: 'Canyon désertique',
    globals: { seaLevel: 0.39, reliefIntensity: 1.35, waterAmount: 0.2, erosionStrength: 0.58, smoothing: 0.22, mountainIntensity: 1.4, valleyIntensity: 1.1 },
    biomes: { plains: 6, hills: 10, mountains: 12, forest: 2, swamp: 0, canyon: 34, desert: 30, taiga: 0, coast_islands: 6 }
  },
  archipelago: {
    label: 'Archipel',
    globals: { seaLevel: 0.57, reliefIntensity: 1, waterAmount: 0.75, erosionStrength: 0.35, smoothing: 0.4, mountainIntensity: 0.85, valleyIntensity: 0.75 },
    biomes: { plains: 10, hills: 10, mountains: 8, forest: 16, swamp: 8, canyon: 3, desert: 12, taiga: 5, coast_islands: 28 }
  },
  marsh_plains: {
    label: 'Marais / plaines',
    globals: { seaLevel: 0.5, reliefIntensity: 0.75, waterAmount: 0.7, erosionStrength: 0.3, smoothing: 0.52, mountainIntensity: 0.5, valleyIntensity: 0.5 },
    biomes: { plains: 36, hills: 10, mountains: 2, forest: 16, swamp: 24, canyon: 0, desert: 4, taiga: 4, coast_islands: 4 }
  },
  cold_world: {
    label: 'Monde froid',
    globals: { seaLevel: 0.46, reliefIntensity: 1.2, waterAmount: 0.45, erosionStrength: 0.5, smoothing: 0.26, mountainIntensity: 1.25, valleyIntensity: 0.95 },
    biomes: { plains: 10, hills: 16, mountains: 20, forest: 6, swamp: 4, canyon: 6, desert: 2, taiga: 30, coast_islands: 6 }
  },
  realistic_rp: {
    label: 'Map RP réaliste',
    globals: { seaLevel: 0.49, reliefIntensity: 1.03, waterAmount: 0.47, erosionStrength: 0.5, smoothing: 0.34, mountainIntensity: 1, valleyIntensity: 0.78 },
    biomes: { plains: 30, hills: 15, mountains: 14, forest: 20, swamp: 7, canyon: 4, desert: 4, taiga: 6, coast_islands: 10 }
  },
  minecraft_like: {
    label: 'Map Minecraft-like',
    globals: { seaLevel: 0.47, reliefIntensity: 1.25, waterAmount: 0.45, erosionStrength: 0.32, smoothing: 0.18, mountainIntensity: 1.2, valleyIntensity: 0.9 },
    biomes: { plains: 22, hills: 14, mountains: 18, forest: 16, swamp: 8, canyon: 7, desert: 10, taiga: 10, coast_islands: 5 }
  }
};

const BIOME_PROFILES = [
  { id: 'plains', name: 'Plaines', color: [118, 169, 95], params: { altMin: 0.38, altMax: 0.64, reliefAmp: 0.3, noiseFreq: 1.3, roughness: 0.2, humidity: 0.55, temperature: 0.62, waterRate: 0.16, cliffRate: 0.05, transition: 0.85, strata: 0 } },
  { id: 'hills', name: 'Collines', color: [105, 148, 86], params: { altMin: 0.44, altMax: 0.72, reliefAmp: 0.55, noiseFreq: 1.8, roughness: 0.35, humidity: 0.5, temperature: 0.56, waterRate: 0.12, cliffRate: 0.15, transition: 0.74, strata: 0 } },
  { id: 'mountains', name: 'Montagnes', color: [130, 130, 136], params: { altMin: 0.58, altMax: 1.0, reliefAmp: 1.2, noiseFreq: 2.5, roughness: 0.78, humidity: 0.38, temperature: 0.34, waterRate: 0.08, cliffRate: 0.55, transition: 0.5, strata: 0 } },
  { id: 'canyon', name: 'Canyon', color: [176, 112, 71], params: { altMin: 0.4, altMax: 0.78, reliefAmp: 0.8, noiseFreq: 2.2, roughness: 0.64, humidity: 0.18, temperature: 0.72, waterRate: 0.05, cliffRate: 0.7, transition: 0.35, strata: 1 } },
  { id: 'swamp', name: 'Marais', color: [89, 124, 94], params: { altMin: 0.32, altMax: 0.52, reliefAmp: 0.16, noiseFreq: 1.2, roughness: 0.12, humidity: 0.88, temperature: 0.64, waterRate: 0.55, cliffRate: 0.02, transition: 0.9, strata: 0 } },
  { id: 'desert', name: 'Désert', color: [212, 184, 120], params: { altMin: 0.38, altMax: 0.66, reliefAmp: 0.42, noiseFreq: 1.9, roughness: 0.22, humidity: 0.08, temperature: 0.92, waterRate: 0.04, cliffRate: 0.12, transition: 0.72, strata: 0 } },
  { id: 'forest', name: 'Forêt', color: [63, 120, 73], params: { altMin: 0.4, altMax: 0.7, reliefAmp: 0.5, noiseFreq: 1.7, roughness: 0.34, humidity: 0.7, temperature: 0.55, waterRate: 0.2, cliffRate: 0.15, transition: 0.8, strata: 0 } },
  { id: 'taiga', name: 'Taïga / neige', color: [151, 176, 179], params: { altMin: 0.48, altMax: 0.86, reliefAmp: 0.66, noiseFreq: 2.1, roughness: 0.48, humidity: 0.5, temperature: 0.2, waterRate: 0.12, cliffRate: 0.28, transition: 0.68, strata: 0 } },
  { id: 'coast_islands', name: 'Îles / littoral', color: [203, 188, 146], params: { altMin: 0.34, altMax: 0.58, reliefAmp: 0.35, noiseFreq: 1.5, roughness: 0.2, humidity: 0.62, temperature: 0.6, waterRate: 0.35, cliffRate: 0.08, transition: 0.86, strata: 0 } }
];

const MATERIAL_COLORS = {
  waterDeep: [28, 66, 130], waterShallow: [58, 117, 187], beach: [213, 191, 145], mud: [92, 86, 67], grass: [101, 155, 90], dirt: [118, 94, 70], rock: [122, 121, 125], snow: [238, 241, 247], canyonRock1: [154, 94, 58], canyonRock2: [176, 122, 80], canyonRock3: [201, 151, 105]
};

const state = { ui: {}, terrain: null, running: false };

const byId = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / ((b - a) || 1), 0, 1); return t * t * (3 - 2 * t); };
const idx = (x, y, w) => y * w + x;
const n8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const n4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const rand = (ix, iy) => {
    let n = ix * 374761393 + iy * 668265263 + seed * 982451653;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = rand(xi, yi), b = rand(xi + 1, yi), c = rand(xi, yi + 1), d = rand(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, seed, octaves, lacunarity = 2, gain = 0.5) {
  let a = 0.5; let f = 1; let sum = 0; let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * f, y * f, seed + i * 1013) * a;
    norm += a;
    a *= gain;
    f *= lacunarity;
  }
  return sum / (norm || 1);
}

function ridge(x, y, seed, octaves) {
  let sum = 0; let a = 0.7; let f = 1; let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = fbm(x * f, y * f, seed + i * 157, 2);
    sum += (1 - Math.abs(2 * n - 1)) * a;
    norm += a;
    a *= 0.56;
    f *= 1.95;
  }
  return sum / (norm || 1);
}

function qThreshold(values, landRatio) {
  const copy = new Float32Array(values);
  copy.sort();
  const at = clamp(Math.floor((1 - landRatio) * (copy.length - 1)), 0, copy.length - 1);
  return copy[at];
}

function setProgress(value, text) {
  state.ui.progressFill.style.width = `${Math.round(clamp(value, 0, 1) * 100)}%`;
  state.ui.statusText.textContent = text;
}

function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function buildBiomeControls() {
  state.ui.biomeControls.innerHTML = '';
  BIOME_PROFILES.forEach((b) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'biomeCard';
    wrapper.innerHTML = `
      <div class="biomeHead">
        <input id="biome_on_${b.id}" type="checkbox" checked />
        <strong>${b.name}</strong>
        <input id="biome_pct_${b.id}" type="number" min="0" max="100" value="10" />
      </div>
      <details>
        <summary>Paramètres avancés</summary>
        <div class="biomeAdvanced">
          <label>Amplitude <input id="biome_amp_${b.id}" type="range" min="0.05" max="1.5" step="0.01" value="${b.params.reliefAmp}" /></label>
          <label>Fréquence <input id="biome_freq_${b.id}" type="range" min="0.6" max="3.5" step="0.01" value="${b.params.noiseFreq}" /></label>
          <label>Rugosité <input id="biome_rug_${b.id}" type="range" min="0" max="1" step="0.01" value="${b.params.roughness}" /></label>
          <label>Falaises <input id="biome_cliff_${b.id}" type="range" min="0" max="1" step="0.01" value="${b.params.cliffRate}" /></label>
        </div>
      </details>`;
    state.ui.biomeControls.appendChild(wrapper);
  });
}

function fillPresetSelect() {
  state.ui.presetSelect.innerHTML = '';
  Object.entries(PRESETS).forEach(([id, p]) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = p.label;
    state.ui.presetSelect.appendChild(o);
  });
  state.ui.presetSelect.value = 'balanced_world';
}

function applyPreset(id) {
  const preset = PRESETS[id];
  if (!preset) return;
  Object.entries(preset.globals).forEach(([k, v]) => {
    if (state.ui[k]) state.ui[k].value = String(v);
  });
  BIOME_PROFILES.forEach((b) => {
    const pct = preset.biomes[b.id] ?? 0;
    byId(`biome_pct_${b.id}`).value = String(pct);
    byId(`biome_on_${b.id}`).checked = pct > 0;
  });
}

function readBiomeSettings() {
  const active = [];
  let total = 0;
  BIOME_PROFILES.forEach((base) => {
    const enabled = byId(`biome_on_${base.id}`).checked;
    const weight = clamp(Number(byId(`biome_pct_${base.id}`).value) || 0, 0, 100);
    if (!enabled || weight <= 0) return;
    const cfg = {
      ...base,
      targetPercent: weight,
      params: {
        ...base.params,
        reliefAmp: Number(byId(`biome_amp_${base.id}`).value),
        noiseFreq: Number(byId(`biome_freq_${base.id}`).value),
        roughness: Number(byId(`biome_rug_${base.id}`).value),
        cliffRate: Number(byId(`biome_cliff_${base.id}`).value)
      }
    };
    total += weight;
    active.push(cfg);
  });
  if (!active.length) {
    const b = BIOME_PROFILES[0];
    return [{ ...b, targetPercent: 100, targetRatio: 1 }];
  }
  return active.map((b) => ({ ...b, targetRatio: b.targetPercent / total }));
}

function readConfig() {
  return {
    size: Number(state.ui.size.value),
    seed: state.ui.seed.value.trim() || 'seed',
    seaLevel: Number(state.ui.seaLevel.value),
    reliefIntensity: Number(state.ui.reliefIntensity.value),
    waterAmount: Number(state.ui.waterAmount.value),
    erosionStrength: Number(state.ui.erosionStrength.value),
    smoothing: Number(state.ui.smoothing.value),
    reliefContrast: Number(state.ui.reliefContrast.value),
    continentalScale: Number(state.ui.continentalScale.value),
    regionalScale: Number(state.ui.regionalScale.value),
    localScale: Number(state.ui.localScale.value),
    detailScale: Number(state.ui.detailScale.value),
    mountainIntensity: Number(state.ui.mountainIntensity.value),
    valleyIntensity: Number(state.ui.valleyIntensity.value),
    snowLine: Number(state.ui.snowLine.value),
    beachWidth: Number(state.ui.beachWidth.value),
    rockSlope: Number(state.ui.rockSlope.value),
    canyonStrata: Number(state.ui.canyonStrata.value),
    renderMode: state.ui.renderMode.value,
    enableShading: state.ui.enableShading.checked,
    biomeSettings: readBiomeSettings()
  };
}

async function generate() {
  if (state.running) return;
  state.running = true;
  const start = performance.now();
  setProgress(0.01, 'Lecture configuration...');
  const config = readConfig();
  const width = config.size;
  const height = config.size;
  const count = width * height;
  const seed = hashString(config.seed);

  const continental = new Float32Array(count);
  const regional = new Float32Array(count);
  const local = new Float32Array(count);
  const detail = new Float32Array(count);
  const temperature = new Float32Array(count);
  const moisture = new Float32Array(count);
  const landMask = new Uint8Array(count);
  const coastDist = new Float32Array(count);
  const biomeIndex = new Uint16Array(count);
  const heightNorm = new Float32Array(count);
  const material = new Uint8Array(count);

  setProgress(0.08, 'Relief: couches continentales/régionales/locales...');
  for (let y = 0; y < height; y++) {
    const ny = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const nx = x / (width - 1);
      const i = idx(x, y, width);
      const warp = (fbm(nx * 1.8, ny * 1.8, seed + 11, 3) - 0.5) * 0.12;
      const wx = nx + warp;
      const wy = ny - warp;
      continental[i] = fbm(wx * config.continentalScale, wy * config.continentalScale, seed + 101, 5, 2, 0.52);
      regional[i] = fbm(wx * config.regionalScale, wy * config.regionalScale, seed + 203, 4, 2.03, 0.55);
      local[i] = ridge(wx * config.localScale, wy * config.localScale, seed + 307, 4);
      detail[i] = fbm(wx * config.detailScale, wy * config.detailScale, seed + 401, 3, 2.4, 0.5);
      temperature[i] = clamp(1 - ny * 0.9 + (fbm(nx * 2.2, ny * 2.2, seed + 499, 3) - 0.5) * 0.35, 0, 1);
      moisture[i] = clamp(0.5 + (fbm(nx * 2.4, ny * 2.4, seed + 599, 4) - 0.5) * 0.8 - (temperature[i] - 0.5) * 0.2, 0, 1);
    }
  }

  await nextFrame();
  setProgress(0.18, 'Répartition terre/eau...');
  const landPotential = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    landPotential[i] = continental[i] * 0.65 + regional[i] * 0.25 + local[i] * 0.1 - config.waterAmount * 0.3;
  }
  const threshold = qThreshold(landPotential, clamp(1 - config.waterAmount * 0.72, 0.18, 0.86));
  for (let i = 0; i < count; i++) landMask[i] = landPotential[i] > threshold ? 1 : 0;
  cleanLandMask(landMask, width, height);
  computeCoastDistance(landMask, coastDist, width, height);

  await nextFrame();
  setProgress(0.31, 'Biomes (climat + quotas + blending)...');
  assignBiomes(config, { width, height, landMask, coastDist, temperature, moisture, regional, biomeIndex, seed });

  await nextFrame();
  setProgress(0.48, 'Construction du relief multi-couches...');
  const biomeByCode = config.biomeSettings;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const sea = config.seaLevel;
      if (landMask[i] === 0) {
        const deep = 1 - smoothstep(0, 0.25, coastDist[i]);
        heightNorm[i] = clamp(sea - 0.05 - deep * (0.25 + config.waterAmount * 0.2), 0, 1);
        continue;
      }
      const b = biomeByCode[biomeIndex[i]] || biomeByCode[0];
      const p = b.params;
      const base = lerp(p.altMin, p.altMax, continental[i] * 0.65 + regional[i] * 0.35);
      const regionalRelief = (regional[i] - 0.5) * p.reliefAmp * 0.8;
      const localRelief = (local[i] - 0.5) * p.reliefAmp * (0.4 + p.roughness);
      const detailRelief = (detail[i] - 0.5) * 0.12 * (0.5 + p.roughness);
      const mtnMask = smoothstep(0.52, 0.88, local[i]) * config.mountainIntensity;
      const valleys = (1 - smoothstep(0.2, 0.8, moisture[i])) * config.valleyIntensity * 0.11;
      let h = base + regionalRelief + localRelief + detailRelief + mtnMask * p.cliffRate * 0.22 - valleys;

      if (b.id === 'canyon') {
        const cut = smoothstep(0.35, 0.75, ridge(x / width * p.noiseFreq * 2.2, y / height * p.noiseFreq * 2.2, seed + 813, 3));
        h -= cut * 0.28;
      }
      if (b.id === 'swamp') {
        h = lerp(h, sea + 0.01, 0.55);
      }

      const shoreBlend = smoothstep(0, config.beachWidth + p.transition * 0.04, coastDist[i]);
      h = lerp(sea + 0.005, h, shoreBlend);
      heightNorm[i] = clamp((h - sea) * config.reliefIntensity + sea, 0, 1);
    }
  }

  await nextFrame();
  setProgress(0.63, 'Érosion thermique/hydraulique...');
  thermalErosion(heightNorm, width, height, Math.round(1 + config.erosionStrength * 4), 0.018 + config.erosionStrength * 0.03);
  hydraulicErosion(heightNorm, landMask, width, height, Math.round(config.erosionStrength * 7000), seed + 977);
  selectiveSmooth(heightNorm, width, height, config.smoothing);

  await nextFrame();
  setProgress(0.74, 'Post-process et correction bords...');
  normalizeRelief(heightNorm, config.seaLevel, config.reliefContrast);
  fixBiomeEdges(heightNorm, biomeIndex, width, height);

  await nextFrame();
  setProgress(0.82, 'Couches matériaux...');
  assignMaterials({ width, height, seaLevel: config.seaLevel, heightNorm, landMask, moisture, temperature, biomeIndex, biomeSettings: config.biomeSettings, rockSlope: config.rockSlope, snowLine: config.snowLine, canyonStrata: config.canyonStrata, material });

  const terrainY = quantizeHeight(heightNorm, 0, 255);
  setProgress(0.9, 'Rendu de la carte...');

  state.terrain = {
    config,
    width,
    height,
    landMask,
    coastDist,
    biomeIndex,
    heightNorm,
    terrainY,
    material,
    generatedMs: Math.round(performance.now() - start)
  };

  render();
  renderStats();
  setProgress(1, 'Génération terminée ✅');
  state.running = false;
}

function cleanLandMask(mask, w, h) {
  const temp = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      let sum = 0;
      for (const [ox, oy] of n8) sum += temp[idx(x + ox, y + oy, w)];
      if (temp[i] === 1 && sum <= 1) mask[i] = 0;
      if (temp[i] === 0 && sum >= 7) mask[i] = 1;
    }
  }
}

function computeCoastDistance(landMask, out, w, h) {
  const q = new Int32Array(w * h);
  const dist = new Int32Array(w * h).fill(-1);
  let head = 0; let tail = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y, w);
      const me = landMask[i];
      let boundary = false;
      for (const [ox, oy] of n4) {
        const nx = x + ox; const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (landMask[idx(nx, ny, w)] !== me) { boundary = true; break; }
      }
      if (boundary) { dist[i] = 0; q[tail++] = i; }
    }
  }
  while (head < tail) {
    const c = q[head++];
    const cy = Math.floor(c / w); const cx = c - cy * w;
    const next = dist[c] + 1;
    for (const [ox, oy] of n4) {
      const nx = cx + ox; const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (dist[ni] === -1) { dist[ni] = next; q[tail++] = ni; }
    }
  }
  let maxD = 1;
  for (let i = 0; i < dist.length; i++) if (dist[i] > maxD) maxD = dist[i];
  for (let i = 0; i < dist.length; i++) out[i] = clamp(dist[i] / maxD, 0, 1);
}

function assignBiomes(config, ctx) {
  const { width, height, landMask, coastDist, temperature, moisture, regional, biomeIndex, seed } = ctx;
  const biomes = config.biomeSettings;
  const counts = new Array(biomes.length).fill(0);
  const target = biomes.map((b) => b.targetRatio);
  const candidates = [];

  for (let i = 0; i < landMask.length; i++) {
    if (landMask[i] === 0) continue;
    const scores = biomes.map((b, bIdx) => {
      const p = b.params;
      const climate = 1 - Math.abs(temperature[i] - p.temperature) * 1.2 - Math.abs(moisture[i] - p.humidity);
      const coastAffinity = 1 - Math.abs(coastDist[i] - (1 - p.waterRate));
      const reliefAffinity = 1 - Math.abs(regional[i] - (0.35 + p.reliefAmp * 0.35));
      return { bIdx, score: climate * 0.5 + coastAffinity * 0.2 + reliefAffinity * 0.3 };
    }).sort((a, b) => b.score - a.score);
    candidates.push({ i, scores });
  }

  candidates.sort((a, b) => b.scores[0].score - a.scores[0].score);

  const totalLand = candidates.length;
  for (const c of candidates) {
    let pick = c.scores[0].bIdx;
    let best = -Infinity;
    for (const option of c.scores.slice(0, 4)) {
      const ratioNow = counts[option.bIdx] / Math.max(1, totalLand);
      const quotaPressure = Math.max(0, ratioNow - target[option.bIdx]) * 3.2;
      const score = option.score - quotaPressure;
      if (score > best) { best = score; pick = option.bIdx; }
    }
    biomeIndex[c.i] = pick;
    counts[pick]++;
  }

  const rng = mulberry32(seed ^ 0x7af2);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idx(x, y, width);
        if (landMask[i] === 0) continue;
        const map = new Map();
        for (const [ox, oy] of n8) {
          const b = biomeIndex[idx(x + ox, y + oy, width)];
          map.set(b, (map.get(b) || 0) + 1);
        }
        let top = biomeIndex[i];
        let max = 0;
        map.forEach((v, k) => { if (v > max) { max = v; top = k; } });
        if (max >= 5 && rng() > 0.2) biomeIndex[i] = top;
      }
    }
  }
}

function thermalErosion(h, w, he, passes, talus) {
  for (let p = 0; p < passes; p++) {
    const copy = new Float32Array(h);
    for (let y = 1; y < he - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = idx(x, y, w);
        const center = copy[i];
        for (const [ox, oy] of n4) {
          const ni = idx(x + ox, y + oy, w);
          const diff = center - copy[ni];
          if (diff > talus) {
            const moved = (diff - talus) * 0.22;
            h[i] -= moved;
            h[ni] += moved;
          }
        }
      }
    }
  }
}

function hydraulicErosion(h, landMask, w, he, droplets, seed) {
  const rng = mulberry32(seed);
  for (let d = 0; d < droplets; d++) {
    let x = Math.floor(rng() * (w - 2)) + 1;
    let y = Math.floor(rng() * (he - 2)) + 1;
    let sediment = 0;
    for (let step = 0; step < 24; step++) {
      const i = idx(x, y, w);
      if (landMask[i] === 0) break;
      let best = i;
      let bestH = h[i];
      for (const [ox, oy] of n8) {
        const ni = idx(x + ox, y + oy, w);
        if (h[ni] < bestH) { bestH = h[ni]; best = ni; }
      }
      if (best === i) break;
      const delta = h[i] - h[best];
      const erode = Math.min(0.015, delta * 0.15);
      h[i] -= erode;
      sediment += erode;
      if (delta < 0.01 && sediment > 0) {
        h[i] += sediment * 0.65;
        sediment *= 0.35;
      }
      y = Math.floor(best / w);
      x = best - y * w;
    }
  }
}

function selectiveSmooth(h, w, he, strength) {
  if (strength <= 0) return;
  const copy = new Float32Array(h);
  for (let y = 1; y < he - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      let sum = 0; let c = 0; let steep = 0;
      for (const [ox, oy] of n8) {
        const ni = idx(x + ox, y + oy, w);
        const diff = Math.abs(copy[i] - copy[ni]);
        steep = Math.max(steep, diff);
        sum += copy[ni];
        c++;
      }
      const slopeFactor = smoothstep(0.015, 0.07, steep);
      const blend = strength * (0.08 + slopeFactor * 0.22);
      h[i] = lerp(copy[i], sum / c, blend);
    }
  }
}

function normalizeRelief(h, sea, contrast) {
  let min = 9; let max = -9;
  for (let i = 0; i < h.length; i++) { min = Math.min(min, h[i]); max = Math.max(max, h[i]); }
  const inv = 1 / ((max - min) || 1);
  for (let i = 0; i < h.length; i++) {
    const n = (h[i] - min) * inv;
    const c = Math.pow(n, 1 / contrast);
    h[i] = clamp(lerp(sea - 0.25, 1, c), 0, 1);
  }
}

function fixBiomeEdges(h, biomeIndex, w, he) {
  const copy = new Float32Array(h);
  for (let y = 1; y < he - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      let different = 0;
      let sum = copy[i];
      let c = 1;
      for (const [ox, oy] of n8) {
        const ni = idx(x + ox, y + oy, w);
        if (biomeIndex[ni] !== biomeIndex[i]) different++;
        sum += copy[ni];
        c++;
      }
      if (different >= 4) h[i] = lerp(copy[i], sum / c, 0.22);
    }
  }
}

function slopeAt(h, w, he, x, y) {
  const xm = clamp(x - 1, 0, w - 1); const xp = clamp(x + 1, 0, w - 1);
  const ym = clamp(y - 1, 0, he - 1); const yp = clamp(y + 1, 0, he - 1);
  const dzdx = (h[idx(xp, y, w)] - h[idx(xm, y, w)]) * 0.5;
  const dzdy = (h[idx(x, yp, w)] - h[idx(x, ym, w)]) * 0.5;
  return Math.sqrt(dzdx * dzdx + dzdy * dzdy);
}

function assignMaterials({ width, height, seaLevel, heightNorm, landMask, moisture, temperature, biomeIndex, biomeSettings, rockSlope, snowLine, canyonStrata, material }) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = idx(x, y, width);
      const h = heightNorm[i];
      const slope = slopeAt(heightNorm, width, height, x, y);
      const biome = biomeSettings[biomeIndex[i]] || biomeSettings[0];
      const bId = biome?.id || 'plains';

      let mat = 4;
      if (landMask[i] === 0 || h <= seaLevel) {
        mat = h < seaLevel - 0.07 ? 0 : 1;
      } else if (h <= seaLevel + 0.025) {
        mat = 2;
      } else if (bId === 'swamp' && moisture[i] > 0.7 && h < seaLevel + 0.08) {
        mat = 3;
      } else if (bId === 'canyon') {
        const band = Math.floor((h * canyonStrata) % 3);
        mat = 7 + band;
      } else if (h > snowLine || (bId === 'taiga' && temperature[i] < 0.36 && h > seaLevel + 0.14)) {
        mat = 6;
      } else if (slope > rockSlope || (bId === 'mountains' && slope > rockSlope * 0.65)) {
        mat = 5;
      } else if (bId === 'desert') {
        mat = 2;
      } else if (h > seaLevel + 0.18) {
        mat = 4;
      }
      material[i] = mat;
    }
  }
}

function quantizeHeight(h, min, max) {
  const out = new Uint16Array(h.length);
  for (let i = 0; i < h.length; i++) out[i] = clamp(Math.round(lerp(min, max, h[i])), min, max);
  return out;
}

function hillshade(h, w, he, x, y) {
  const xm = clamp(x - 1, 0, w - 1); const xp = clamp(x + 1, 0, w - 1);
  const ym = clamp(y - 1, 0, he - 1); const yp = clamp(y + 1, 0, he - 1);
  const dzdx = (h[idx(xp, y, w)] - h[idx(xm, y, w)]) * 0.5;
  const dzdy = (h[idx(x, yp, w)] - h[idx(x, ym, w)]) * 0.5;
  const shade = 0.65 + (-dzdx * 1.1 - dzdy * 0.9);
  return clamp(shade, 0.2, 1.35);
}

function colorForMaterial(code) {
  return [
    MATERIAL_COLORS.waterDeep,
    MATERIAL_COLORS.waterShallow,
    MATERIAL_COLORS.beach,
    MATERIAL_COLORS.mud,
    MATERIAL_COLORS.grass,
    MATERIAL_COLORS.rock,
    MATERIAL_COLORS.snow,
    MATERIAL_COLORS.canyonRock1,
    MATERIAL_COLORS.canyonRock2,
    MATERIAL_COLORS.canyonRock3
  ][code] || [255, 0, 255];
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
  const img = ctx.createImageData(terrain.width, terrain.height);
  const mode = state.ui.renderMode.value;

  for (let i = 0; i < terrain.heightNorm.length; i++) {
    const base = i * 4;
    let r = 0; let g = 0; let b = 0;
    if (mode === 'heightmap') {
      const v = Math.round(terrain.heightNorm[i] * 255);
      r = g = b = v;
    } else if (mode === 'biome') {
      const biome = terrain.config.biomeSettings[terrain.biomeIndex[i]];
      const c = biome?.color || [90, 90, 90];
      [r, g, b] = c;
    } else if (mode === 'slope') {
      const x = i % terrain.width;
      const y = Math.floor(i / terrain.width);
      const s = slopeAt(terrain.heightNorm, terrain.width, terrain.height, x, y);
      const v = Math.round(clamp(s * 780, 0, 255));
      r = 50 + v; g = v; b = 255 - v;
    } else {
      [r, g, b] = colorForMaterial(terrain.material[i]);
      if (terrain.landMask[i] === 1) {
        const biome = terrain.config.biomeSettings[terrain.biomeIndex[i]];
        if (biome) {
          r = Math.round(r * 0.7 + biome.color[0] * 0.3);
          g = Math.round(g * 0.7 + biome.color[1] * 0.3);
          b = Math.round(b * 0.7 + biome.color[2] * 0.3);
        }
      }
    }

    if (state.ui.enableShading.checked) {
      const x = i % terrain.width;
      const y = Math.floor(i / terrain.width);
      const shade = hillshade(terrain.heightNorm, terrain.width, terrain.height, x, y);
      r = clamp(Math.round(r * shade), 0, 255);
      g = clamp(Math.round(g * shade), 0, 255);
      b = clamp(Math.round(b * shade), 0, 255);
    }

    img.data[base] = r;
    img.data[base + 1] = g;
    img.data[base + 2] = b;
    img.data[base + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  state.ui.topbarMeta.textContent = `Seed: ${terrain.config.seed} • ${terrain.width}x${terrain.height} • ${terrain.generatedMs} ms`;
}

function renderStats() {
  if (!state.terrain) return;
  const t = state.terrain;
  let land = 0; let min = 999; let max = -1;
  for (let i = 0; i < t.heightNorm.length; i++) {
    if (t.landMask[i] === 1) land++;
    min = Math.min(min, t.terrainY[i]);
    max = Math.max(max, t.terrainY[i]);
  }
  const total = t.width * t.height;
  const landRatio = (land / total) * 100;
  state.ui.stats.innerHTML = `
    <li>Temps génération: ${t.generatedMs} ms</li>
    <li>Terre: ${landRatio.toFixed(2)}%</li>
    <li>Eau: ${(100 - landRatio).toFixed(2)}%</li>
    <li>Altitude min/max: ${min} / ${max}</li>
    <li>Niveau de la mer (norm.): ${t.config.seaLevel.toFixed(2)}</li>
    <li>Biomes actifs: ${t.config.biomeSettings.length}</li>`;

  const counts = new Map();
  for (let i = 0; i < t.biomeIndex.length; i++) {
    if (t.landMask[i] === 0) continue;
    const b = t.config.biomeSettings[t.biomeIndex[i]];
    counts.set(b.id, (counts.get(b.id) || 0) + 1);
  }
  const landTotal = Math.max(1, land);
  const lines = [];
  t.config.biomeSettings.forEach((b) => {
    const real = ((counts.get(b.id) || 0) / landTotal) * 100;
    lines.push(`<li>${b.name}: cible ${(b.targetRatio * 100).toFixed(1)}% / réel ${real.toFixed(1)}%</li>`);
  });
  state.ui.biomeStats.innerHTML = lines.join('');
}

function exportImage() {
  if (!state.terrain) return;
  const canvas = state.ui.canvas;
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(`terrain_${state.terrain.config.seed}_${state.terrain.width}.png`, blob);
  }, 'image/png');
}

function exportHeightmap() {
  if (!state.terrain) return;
  const payload = {
    seed: state.terrain.config.seed,
    size: state.terrain.width,
    seaLevel: state.terrain.config.seaLevel,
    heights: Array.from(state.terrain.terrainY)
  };
  downloadBlob(`heightmap_${state.terrain.config.seed}_${state.terrain.width}.json`, new Blob([JSON.stringify(payload)], { type: 'application/json' }));
}

function cacheUI() {
  const ids = ['status-text', 'topbar-meta', 'size', 'seed', 'randomSeed', 'applyPreset', 'presetSelect', 'seaLevel', 'reliefIntensity', 'waterAmount', 'erosionStrength', 'smoothing', 'reliefContrast', 'continentalScale', 'regionalScale', 'localScale', 'detailScale', 'mountainIntensity', 'valleyIntensity', 'snowLine', 'beachWidth', 'rockSlope', 'canyonStrata', 'generate', 'resetAll', 'exportImage', 'exportHeight', 'progressFill', 'biomeControls', 'renderMode', 'enableShading', 'canvas', 'emptyState', 'stats', 'biomeStats'];
  ids.forEach((id) => {
    const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    state.ui[key] = byId(id);
  });
}

function bindUI() {
  state.ui.randomSeed.addEventListener('click', () => {
    state.ui.seed.value = `seed-${Math.random().toString(36).slice(2, 10)}`;
  });
  state.ui.generate.addEventListener('click', () => generate());
  state.ui.applyPreset.addEventListener('click', () => applyPreset(state.ui.presetSelect.value));
  state.ui.resetAll.addEventListener('click', () => applyPreset('balanced_world'));
  state.ui.renderMode.addEventListener('change', render);
  state.ui.enableShading.addEventListener('change', render);
  state.ui.exportImage.addEventListener('click', exportImage);
  state.ui.exportHeight.addEventListener('click', exportHeightmap);
}

function init() {
  cacheUI();
  fillPresetSelect();
  buildBiomeControls();
  applyPreset('balanced_world');
  bindUI();
  setProgress(0, 'Prêt.');
}

window.addEventListener('DOMContentLoaded', init);
