const DEFAULT_LAYER_CONFIG = {
  deep_ocean: { name: 'Océan profond', min: 20, max: 40, variation: 0.35, quant: 2, priority: 10 },
  ocean: { name: 'Océan', min: 40, max: 56, variation: 0.3, quant: 1, priority: 9 },
  shallow_water: { name: 'Eau peu profonde', min: 56, max: 63, variation: 0.2, quant: 1, priority: 8 },
  beach: { name: 'Plage', min: 64, max: 69, variation: 0.18, quant: 1, priority: 7 },
  plains: { name: 'Plaine', min: 70, max: 90, variation: 0.3, quant: 1, priority: 6 },
  forest: { name: 'Forêt', min: 75, max: 110, variation: 0.35, quant: 1, priority: 6 },
  savanna: { name: 'Savane', min: 70, max: 100, variation: 0.3, quant: 1, priority: 6 },
  desert: { name: 'Désert', min: 70, max: 105, variation: 0.28, quant: 1, priority: 6 },
  swamp: { name: 'Marais', min: 62, max: 72, variation: 0.2, quant: 1, priority: 7 },
  mesa: { name: 'Mesa / Canyon', min: 85, max: 150, variation: 0.3, quant: 2, priority: 7 },
  hills: { name: 'Collines', min: 95, max: 130, variation: 0.35, quant: 1, priority: 5 },
  mountain: { name: 'Montagnes', min: 140, max: 220, variation: 0.38, quant: 2, priority: 4 },
  snow: { name: 'Neige / Pics', min: 200, max: 255, variation: 0.42, quant: 2, priority: 3 }
};

const PRESETS = {
  worldpainter_standard: {
    label: 'WorldPainter Standard',
    seaLevel: 64,
    minY: 0,
    maxY: 255,
    waterSensitivity: 0.5,
    blueThreshold: 0.2,
    darkEdgeThreshold: 0.26,
    mountainSensitivity: 0.55,
    contourStrength: 0.5,
    quantStep: 1,
    autoCorrection: true,
    canyonTerracing: false,
    layers: DEFAULT_LAYER_CONFIG
  },
  minecraft_121_full_height: {
    label: 'Minecraft 1.21 Full Height',
    seaLevel: 64,
    minY: -64,
    maxY: 320,
    waterSensitivity: 0.52,
    blueThreshold: 0.2,
    darkEdgeThreshold: 0.28,
    mountainSensitivity: 0.58,
    contourStrength: 0.55,
    quantStep: 1,
    autoCorrection: true,
    canyonTerracing: false,
    layers: DEFAULT_LAYER_CONFIG
  },
  cobblemon_balanced: {
    label: 'Cobblemon Island Balanced',
    seaLevel: 64,
    minY: 0,
    maxY: 255,
    waterSensitivity: 0.48,
    blueThreshold: 0.22,
    darkEdgeThreshold: 0.24,
    mountainSensitivity: 0.52,
    contourStrength: 0.48,
    quantStep: 1,
    autoCorrection: true,
    canyonTerracing: false,
    layers: {
      ...DEFAULT_LAYER_CONFIG,
      plains: { ...DEFAULT_LAYER_CONFIG.plains, min: 72, max: 92 },
      mountain: { ...DEFAULT_LAYER_CONFIG.mountain, min: 138, max: 208 },
      beach: { ...DEFAULT_LAYER_CONFIG.beach, min: 64, max: 68 }
    }
  },
  high_contrast: {
    label: 'High Contrast Terrain',
    seaLevel: 64,
    minY: 0,
    maxY: 255,
    waterSensitivity: 0.5,
    blueThreshold: 0.2,
    darkEdgeThreshold: 0.26,
    mountainSensitivity: 0.62,
    contourStrength: 0.75,
    quantStep: 2,
    autoCorrection: true,
    canyonTerracing: true,
    layers: DEFAULT_LAYER_CONFIG
  },
  soft_terrain: {
    label: 'Soft Terrain',
    seaLevel: 64,
    minY: 0,
    maxY: 255,
    waterSensitivity: 0.52,
    blueThreshold: 0.2,
    darkEdgeThreshold: 0.3,
    mountainSensitivity: 0.45,
    contourStrength: 0.3,
    quantStep: 1,
    autoCorrection: true,
    canyonTerracing: false,
    layers: {
      ...DEFAULT_LAYER_CONFIG,
      hills: { ...DEFAULT_LAYER_CONFIG.hills, min: 90, max: 122 },
      mountain: { ...DEFAULT_LAYER_CONFIG.mountain, min: 130, max: 188 },
      snow: { ...DEFAULT_LAYER_CONFIG.snow, min: 180, max: 230 }
    }
  }
};

const TERRAIN_IDS = {
  deep_ocean: 0,
  ocean: 1,
  shallow_water: 2,
  beach: 3,
  plains: 4,
  forest: 5,
  savanna: 6,
  desert: 7,
  swamp: 8,
  mesa: 9,
  hills: 10,
  mountain: 11,
  snow: 12
};

const TERRAIN_BY_ID = Object.fromEntries(Object.entries(TERRAIN_IDS).map(([k, v]) => [v, k]));

const TERRAIN_PREVIEW_COLORS = {
  deep_ocean: [18, 60, 130], ocean: [30, 90, 180], shallow_water: [85, 148, 212], beach: [216, 202, 138],
  plains: [120, 178, 100], forest: [50, 132, 64], savanna: [168, 175, 92], desert: [226, 208, 120],
  swamp: [82, 112, 76], mesa: [195, 106, 62], hills: [134, 145, 96], mountain: [128, 128, 128], snow: [245, 245, 245]
};

const state = { file: null, source: null, analysis: null, result: null, preview: null, info: null, layerConfig: structuredClone(DEFAULT_LAYER_CONFIG) };

const els = {
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('dropZone'),
  status: document.getElementById('statusText'),
  process: document.getElementById('btnProcess'),
  exportPng: document.getElementById('btnExport8'),
  exportJson: document.getElementById('btnExportJson'),
  previewMode: document.getElementById('previewMode'),
  canvas: document.getElementById('previewCanvas'),
  stats: document.getElementById('statsPanel'),
  preset: document.getElementById('presetSelect'),
  seaLevel: document.getElementById('seaLevelInput'),
  minY: document.getElementById('minYInput'),
  maxY: document.getElementById('maxYInput'),
  waterSensitivity: document.getElementById('waterSensitivity'),
  blueThreshold: document.getElementById('blueThreshold'),
  darkEdgeThreshold: document.getElementById('darkEdgeThreshold'),
  mountainSensitivity: document.getElementById('mountainSensitivity'),
  contourStrength: document.getElementById('contourStrength'),
  quantEnabled: document.getElementById('quantEnabled'),
  quantStep: document.getElementById('quantStep'),
  preservePlains: document.getElementById('preservePlains'),
  preserveMountains: document.getElementById('preserveMountains'),
  canyonTerracing: document.getElementById('canyonTerracing'),
  autoCorrection: document.getElementById('autoCorrection'),
  advancedMode: document.getElementById('advancedMode'),
  layerControls: document.getElementById('layerControls')
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

function setStatus(text) { els.status.textContent = text; }

async function loadImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, rgba };
}

function rgbToHsv(r, g, b) {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn); const d = max - min;
  let h = 0;
  if (d) h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, max === 0 ? 0 : d / max, max];
}

function boxBlur(src, w, h, radius = 1) {
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0; let count = 0;
      for (let oy = -radius; oy <= radius; oy++) {
        const ny = clamp(y + oy, 0, h - 1);
        for (let ox = -radius; ox <= radius; ox++) {
          const nx = clamp(x + ox, 0, w - 1);
          sum += src[ny * w + nx];
          count++;
        }
      }
      dst[y * w + x] = sum / count;
    }
  }
  return dst;
}

function floodFillOcean(waterCandidate, w, h) {
  const oceanMask = new Uint8Array(w * h);
  const q = new Uint32Array(w * h);
  let head = 0; let tail = 0;

  function push(i) {
    if (oceanMask[i] || !waterCandidate[i]) return;
    oceanMask[i] = 1;
    q[tail++] = i;
  }

  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + (w - 1)); }

  while (head < tail) {
    const i = q[head++];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x + 1 < w) push(i + 1);
    if (y > 0) push(i - w);
    if (y + 1 < h) push(i + w);
  }

  return oceanMask;
}

function distanceToMask(mask, w, h, invert = false) {
  const max = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < dist.length; i++) dist[i] = (invert ? !mask[i] : mask[i]) ? 0 : max;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) d = Math.min(d, dist[i - w] + 1);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - w - 1] + 1.4142);
      if (x + 1 < w && y > 0) d = Math.min(d, dist[i - w + 1] + 1.4142);
      dist[i] = d;
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = dist[i];
      if (x + 1 < w) d = Math.min(d, dist[i + 1] + 1);
      if (y + 1 < h) d = Math.min(d, dist[i + w] + 1);
      if (x + 1 < w && y + 1 < h) d = Math.min(d, dist[i + w + 1] + 1.4142);
      if (x > 0 && y + 1 < h) d = Math.min(d, dist[i + w - 1] + 1.4142);
      dist[i] = d;
    }
  }
  return dist;
}

function detectMasks(image, settings) {
  const { width: w, height: h, rgba } = image;
  const px = w * h;
  const hue = new Float32Array(px); const sat = new Float32Array(px); const val = new Float32Array(px); const luma = new Float32Array(px);
  const waterCandidate = new Uint8Array(px); const darkEdgeSignal = new Float32Array(px);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      const r = rgba[o]; const g = rgba[o + 1]; const b = rgba[o + 2];
      const [hh, ss, vv] = rgbToHsv(r, g, b);
      hue[i] = hh; sat[i] = ss; val[i] = vv;
      luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const blueHue = (hh >= 170 && hh <= 260) ? 1 : 0;
      const cyanHue = (hh >= 150 && hh <= 190) ? 0.7 : 0;
      const blueStrength = clamp((b - Math.max(r, g) * 0.76) / 255, 0, 1);
      const dark = clamp((settings.darkEdgeThreshold - vv) * 3.2, 0, 1);
      const edgeFactor = 1 - clamp(Math.min(x, y, w - 1 - x, h - 1 - y) / (Math.min(w, h) * 0.12), 0, 1);
      darkEdgeSignal[i] = dark * edgeFactor;

      const waterScore = blueStrength * 0.54 + ss * 0.16 + blueHue * 0.2 + cyanHue * 0.08 + darkEdgeSignal[i] * 0.3;
      waterCandidate[i] = waterScore >= settings.waterSensitivity && blueStrength >= settings.blueThreshold ? 1 : 0;
    }
  }

  const oceanMask = floodFillOcean(waterCandidate, w, h);
  const waterMask = new Uint8Array(px);
  const lakeMask = new Uint8Array(px);
  const landMask = new Uint8Array(px);

  for (let i = 0; i < px; i++) {
    if (oceanMask[i]) {
      waterMask[i] = 1;
    } else if (waterCandidate[i] && luma[i] < 0.62) {
      waterMask[i] = 1;
      lakeMask[i] = 1;
    }
    landMask[i] = waterMask[i] ? 0 : 1;
  }

  const distanceToWater = distanceToMask(waterMask, w, h, false);
  const distanceToLand = distanceToMask(landMask, w, h, false);
  const coastlineMask = new Uint8Array(px);
  for (let i = 0; i < px; i++) {
    coastlineMask[i] = distanceToWater[i] <= 1.5 && distanceToLand[i] <= 1.5 ? 1 : 0;
  }

  return { hue, sat, val, luma, waterMask, landMask, lakeMask, oceanMask, coastlineMask, distanceToWater, distanceToLand };
}

function classifyTerrain(masks, image, settings) {
  const { width: w, height: h } = image;
  const px = w * h;
  const terrainClass = new Uint8Array(px);

  const smoothLuma = boxBlur(masks.luma, w, h, 2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hval = masks.hue[i]; const s = masks.sat[i]; const v = masks.val[i];
      const nearCoast = masks.distanceToWater[i] <= 2.2;

      if (masks.waterMask[i]) {
        if (masks.distanceToLand[i] > 25) terrainClass[i] = TERRAIN_IDS.deep_ocean;
        else if (masks.distanceToLand[i] > 8) terrainClass[i] = TERRAIN_IDS.ocean;
        else terrainClass[i] = TERRAIN_IDS.shallow_water;
        continue;
      }

      const gx = smoothLuma[y * w + clamp(x + 1, 0, w - 1)] - smoothLuma[y * w + clamp(x - 1, 0, w - 1)];
      const gy = smoothLuma[clamp(y + 1, 0, h - 1) * w + x] - smoothLuma[clamp(y - 1, 0, h - 1) * w + x];
      const texture = Math.min(1, Math.hypot(gx, gy) * 3.5);

      const whiteLike = v > 0.72 && s < 0.28;
      const grayRock = s < 0.22 && v > 0.28 && v < 0.82;
      const mountainScore = (texture * 0.55 + (whiteLike ? 0.4 : 0) + (grayRock ? 0.2 : 0)) * settings.mountainSensitivity;

      if (nearCoast && (hval > 30 && hval < 55) && s < 0.45 && v > 0.45) terrainClass[i] = TERRAIN_IDS.beach;
      else if (whiteLike && (mountainScore > 0.42 || v > 0.84)) terrainClass[i] = TERRAIN_IDS.snow;
      else if (mountainScore > 0.52) terrainClass[i] = TERRAIN_IDS.mountain;
      else if (hval >= 16 && hval <= 35 && s > 0.35) terrainClass[i] = TERRAIN_IDS.mesa;
      else if ((hval > 38 && hval < 62) && s > 0.25) terrainClass[i] = v > 0.62 ? TERRAIN_IDS.desert : TERRAIN_IDS.savanna;
      else if ((hval > 78 && hval < 155) && s > 0.3) terrainClass[i] = v < 0.45 && nearCoast ? TERRAIN_IDS.swamp : TERRAIN_IDS.forest;
      else if (texture > 0.25) terrainClass[i] = TERRAIN_IDS.hills;
      else terrainClass[i] = TERRAIN_IDS.plains;
    }
  }

  return terrainClass;
}

function rangeMap(v, min, max, variation) {
  const t = clamp((v - (0.5 - variation * 0.5)) / Math.max(0.001, variation), 0, 1);
  return lerp(min, max, t);
}

function buildHeightmap(image, masks, terrainClass, settings, layerConfig) {
  const { width: w, height: h } = image;
  const px = w * h;
  const rawY = new Float32Array(px);

  const smoothLuma = boxBlur(masks.luma, w, h, 1);

  for (let i = 0; i < px; i++) {
    const key = TERRAIN_BY_ID[terrainClass[i]];
    const layer = layerConfig[key];
    const local = smoothLuma[i];

    if (masks.waterMask[i]) {
      const d = masks.distanceToLand[i];
      const oceanDepth = clamp(d / 30, 0, 1);
      if (terrainClass[i] === TERRAIN_IDS.deep_ocean) rawY[i] = lerp(layer.min, layer.max, 1 - oceanDepth * 0.7);
      else if (terrainClass[i] === TERRAIN_IDS.ocean) rawY[i] = lerp(layer.min, layer.max, 0.55 + local * 0.25);
      else rawY[i] = lerp(layer.min, layer.max, clamp(0.75 + local * 0.2, 0, 1));
      rawY[i] = Math.min(rawY[i], settings.seaLevel - (terrainClass[i] === TERRAIN_IDS.shallow_water ? 1 : 2));
      continue;
    }

    const y = rangeMap(local, layer.min, layer.max, layer.variation + 0.08);

    if (terrainClass[i] === TERRAIN_IDS.beach && masks.distanceToWater[i] <= 2.2) {
      rawY[i] = clamp(y, settings.seaLevel, settings.seaLevel + 6);
    } else if (terrainClass[i] === TERRAIN_IDS.swamp) {
      rawY[i] = clamp(y, settings.seaLevel - 2, settings.seaLevel + 8);
    } else {
      rawY[i] = y;
    }
  }

  if (settings.autoCorrection) {
    const smoothed = boxBlur(rawY, w, h, 1);
    for (let i = 0; i < px; i++) {
      if (masks.waterMask[i]) continue;
      const k = TERRAIN_BY_ID[terrainClass[i]];
      const preserve = (k === 'plains' && settings.preservePlains) || ((k === 'mountain' || k === 'snow') && settings.preserveMountains);
      rawY[i] = preserve ? rawY[i] * 0.75 + smoothed[i] * 0.25 : rawY[i] * 0.55 + smoothed[i] * 0.45;
    }
  }

  return rawY;
}

function applyMinecraftLayering(rawY, terrainClass, masks, settings, layerConfig) {
  const out = new Float32Array(rawY.length);
  const step = settings.quantEnabled ? settings.quantStep : 1;

  for (let i = 0; i < rawY.length; i++) {
    const key = TERRAIN_BY_ID[terrainClass[i]];
    const layer = layerConfig[key];
    let y = rawY[i];

    if (step > 1) y = Math.round(y / step) * step;
    if (settings.canyonTerracing && key === 'mesa') y = Math.round(y / Math.max(step, 4)) * Math.max(step, 4);

    if (!masks.waterMask[i]) {
      const contourDelta = ((y % step) / Math.max(1, step)) * settings.contourStrength;
      y += contourDelta;
    }

    if (layer.quant > 1 && settings.quantEnabled) y = Math.round(y / layer.quant) * layer.quant;

    out[i] = clamp(y, settings.minY, settings.maxY);
  }

  return out;
}

function toGrayscale(heightY, minY, maxY) {
  const out = new Uint8ClampedArray(heightY.length * 4);
  const range = Math.max(1, maxY - minY);
  for (let i = 0; i < heightY.length; i++) {
    const normalized = clamp((heightY[i] - minY) / range, 0, 1);
    const gray = Math.round(normalized * 255);
    const o = i * 4;
    out[o] = gray; out[o + 1] = gray; out[o + 2] = gray; out[o + 3] = 255;
  }
  return out;
}

function buildHillshade(heightY, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = heightY[y * w + clamp(x + 1, 0, w - 1)] - heightY[y * w + clamp(x - 1, 0, w - 1)];
      const dy = heightY[clamp(y + 1, 0, h - 1) * w + x] - heightY[clamp(y - 1, 0, h - 1) * w + x];
      const shade = clamp(145 - dx * 2.3 - dy * 1.8, 18, 255);
      const o = i * 4;
      out[o] = out[o + 1] = out[o + 2] = shade;
      out[o + 3] = 255;
    }
  }
  return out;
}

function classPreview(terrainClass) {
  const out = new Uint8ClampedArray(terrainClass.length * 4);
  for (let i = 0; i < terrainClass.length; i++) {
    const k = TERRAIN_BY_ID[terrainClass[i]];
    const [r, g, b] = TERRAIN_PREVIEW_COLORS[k] || [255, 0, 255];
    const o = i * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
  }
  return out;
}

function waterLandPreview(waterMask) {
  const out = new Uint8ClampedArray(waterMask.length * 4);
  for (let i = 0; i < waterMask.length; i++) {
    const o = i * 4;
    if (waterMask[i]) { out[o] = 42; out[o + 1] = 112; out[o + 2] = 205; }
    else { out[o] = 83; out[o + 1] = 166; out[o + 2] = 74; }
    out[o + 3] = 255;
  }
  return out;
}

function layersPreview(yInt, minY, maxY) {
  const out = new Uint8ClampedArray(yInt.length * 4);
  const range = Math.max(1, maxY - minY);
  for (let i = 0; i < yInt.length; i++) {
    const gray = Math.round(((yInt[i] - minY) / range) * 255);
    const contour = (Math.round(yInt[i]) % 8 === 0) ? 45 : 0;
    const v = clamp(gray + contour, 0, 255);
    const o = i * 4;
    out[o] = out[o + 1] = out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
}

function buildStats(masks, terrainClass, yInt, settings, w, h) {
  const classes = {};
  let water = 0; let min = Infinity; let max = -Infinity;
  for (let i = 0; i < yInt.length; i++) {
    if (masks.waterMask[i]) water++;
    min = Math.min(min, yInt[i]);
    max = Math.max(max, yInt[i]);
    const key = TERRAIN_BY_ID[terrainClass[i]];
    classes[key] = (classes[key] || 0) + 1;
  }

  return {
    width: w,
    height: h,
    waterPercent: (water / yInt.length) * 100,
    landPercent: 100 - (water / yInt.length) * 100,
    classesPercent: Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, (v / yInt.length) * 100])),
    minY: Math.round(min),
    maxY: Math.round(max),
    seaLevel: settings.seaLevel,
    quantStep: settings.quantEnabled ? settings.quantStep : 1,
    exportFormat: 'PNG grayscale R=G=B A=255',
    worldPainterCompatible: true
  };
}

function renderStats() {
  if (!state.info) {
    els.stats.innerHTML = '<p>Aucune conversion.</p>';
    return;
  }

  const s = state.info;
  const classes = Object.entries(s.classesPercent).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li>${k}: ${v.toFixed(2)}%</li>`).join('');

  els.stats.innerHTML = `
    <ul>
      <li><b>Résolution:</b> ${s.width} × ${s.height}</li>
      <li><b>% eau:</b> ${s.waterPercent.toFixed(2)}%</li>
      <li><b>% terre:</b> ${s.landPercent.toFixed(2)}%</li>
      <li><b>Altitude min:</b> ${s.minY}</li>
      <li><b>Altitude max:</b> ${s.maxY}</li>
      <li><b>Sea level:</b> ${s.seaLevel}</li>
      <li><b>Quantification step:</b> ${s.quantStep}</li>
      <li><b>Export:</b> ${s.exportFormat}</li>
      <li><b>Compatibilité WorldPainter:</b> ${s.worldPainterCompatible ? 'Oui' : 'Non'}</li>
      <li><b>Réglages WP:</b> Lowest=${els.minY.value} / Water=${s.seaLevel} / Highest=${els.maxY.value} / Build limit=-64..320</li>
    </ul>
    <p><b>Classes détectées</b></p>
    <ul>${classes}</ul>
  `;
}

function renderPreview() {
  if (!state.source || !state.preview) return;
  const w = state.source.width; const h = state.source.height;
  els.canvas.width = w; els.canvas.height = h;
  const ctx = els.canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  const mode = els.previewMode.value;
  imageData.data.set(mode === 'original' ? state.source.rgba : (state.preview[mode] || state.preview.heightmap));
  ctx.putImageData(imageData, 0, 0);
}

function readSettingsFromUI() {
  return {
    seaLevel: Number(els.seaLevel.value),
    minY: Number(els.minY.value),
    maxY: Number(els.maxY.value),
    waterSensitivity: Number(els.waterSensitivity.value),
    blueThreshold: Number(els.blueThreshold.value),
    darkEdgeThreshold: Number(els.darkEdgeThreshold.value),
    mountainSensitivity: Number(els.mountainSensitivity.value),
    contourStrength: Number(els.contourStrength.value),
    quantEnabled: els.quantEnabled.checked,
    quantStep: Number(els.quantStep.value),
    preservePlains: els.preservePlains.checked,
    preserveMountains: els.preserveMountains.checked,
    canyonTerracing: els.canyonTerracing.checked,
    autoCorrection: els.autoCorrection.checked
  };
}

function runPipeline() {
  if (!state.source) throw new Error('Importez une image avant la conversion.');

  const settings = readSettingsFromUI();
  const masks = detectMasks(state.source, settings);
  const terrainClass = classifyTerrain(masks, state.source, settings);
  const rawY = buildHeightmap(state.source, masks, terrainClass, settings, state.layerConfig);
  const layeredY = applyMinecraftLayering(rawY, terrainClass, masks, settings, state.layerConfig);
  const finalPng = toGrayscale(layeredY, settings.minY, settings.maxY);

  state.analysis = { masks, terrainClass, rawY };
  state.result = { yInt: layeredY, rgba: finalPng, settings };
  state.preview = {
    watermask: waterLandPreview(masks.waterMask),
    classes: classPreview(terrainClass),
    heightmap: finalPng,
    layers: layersPreview(layeredY, settings.minY, settings.maxY),
    hillshade: buildHillshade(layeredY, state.source.width, state.source.height)
  };
  state.info = buildStats(masks, terrainClass, layeredY, settings, state.source.width, state.source.height);
  renderStats();
  renderPreview();
}

function downloadRgbaPng(rgba, w, h, name) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const imageData = ctx.createImageData(w, h);
  imageData.data.set(rgba);
  ctx.putImageData(imageData, 0, 0);
  c.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function exportPng() {
  if (!state.result || !state.source) throw new Error('Aucune conversion disponible.');
  const name = `converted_worldpainter_heightmap_${state.source.width}x${state.source.height}.png`;
  downloadRgbaPng(state.result.rgba, state.source.width, state.source.height, name);
}

function exportJson() {
  if (!state.result || !state.info) throw new Error('Aucune conversion disponible.');
  const payload = {
    metadata: state.info,
    worldPainter: {
      lowestValue: state.result.settings.minY,
      waterLevel: state.result.settings.seaLevel,
      highestValue: state.result.settings.maxY,
      buildLimit: '-64 / 320'
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted_heightmap_worldpainter_report.json';
  a.click();
  URL.revokeObjectURL(url);
}

function applyPreset(key) {
  const preset = PRESETS[key] || PRESETS.worldpainter_standard;
  els.seaLevel.value = preset.seaLevel;
  els.minY.value = preset.minY;
  els.maxY.value = preset.maxY;
  els.waterSensitivity.value = preset.waterSensitivity;
  els.blueThreshold.value = preset.blueThreshold;
  els.darkEdgeThreshold.value = preset.darkEdgeThreshold;
  els.mountainSensitivity.value = preset.mountainSensitivity;
  els.contourStrength.value = preset.contourStrength;
  els.quantStep.value = preset.quantStep;
  els.quantEnabled.checked = true;
  els.autoCorrection.checked = preset.autoCorrection;
  els.canyonTerracing.checked = preset.canyonTerracing;
  state.layerConfig = structuredClone(preset.layers);
  renderLayerControls();
}

function renderLayerControls() {
  if (!els.layerControls) return;
  els.layerControls.innerHTML = '';
  Object.entries(state.layerConfig).forEach(([key, cfg]) => {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.innerHTML = `
      <h4>${cfg.name}</h4>
      <label>Min Y <input data-layer="${key}" data-field="min" type="number" value="${cfg.min}"></label>
      <label>Max Y <input data-layer="${key}" data-field="max" type="number" value="${cfg.max}"></label>
      <label>Variation <input data-layer="${key}" data-field="variation" type="number" min="0" max="1" step="0.01" value="${cfg.variation}"></label>
      <label>Quantification <input data-layer="${key}" data-field="quant" type="number" min="1" max="16" step="1" value="${cfg.quant}"></label>
      <label>Priorité <input data-layer="${key}" data-field="priority" type="number" min="1" max="20" step="1" value="${cfg.priority}"></label>
    `;
    els.layerControls.appendChild(row);
  });
}

function bindEvents() {
  els.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('Import en cours...');
    state.file = file;
    state.source = await loadImage(file);
    state.preview = null;
    state.result = null;
    state.analysis = null;
    state.info = null;
    renderStats();
    setStatus(`Image importée: ${file.name}`);
  });

  els.dropZone.addEventListener('dragover', (e) => { e.preventDefault(); els.dropZone.classList.add('drag'); });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag'));
  els.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const dt = new DataTransfer();
    dt.items.add(file);
    els.fileInput.files = dt.files;
    els.fileInput.dispatchEvent(new Event('change'));
  });

  els.process.addEventListener('click', () => {
    try {
      setStatus('Conversion déterministe image → heightmap...');
      runPipeline();
      setStatus('Conversion terminée : structure source conservée.');
    } catch (err) {
      setStatus('Erreur de conversion');
      alert(err.message);
    }
  });

  els.previewMode.addEventListener('change', renderPreview);
  els.exportPng.addEventListener('click', () => { try { exportPng(); setStatus('Export PNG OK'); } catch (err) { alert(err.message); } });
  els.exportJson.addEventListener('click', () => { try { exportJson(); setStatus('Export JSON OK'); } catch (err) { alert(err.message); } });

  els.preset.addEventListener('change', () => applyPreset(els.preset.value));
  els.advancedMode.addEventListener('change', () => {
    document.getElementById('advancedPanel').style.display = els.advancedMode.checked ? 'block' : 'none';
  });

  els.layerControls.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const key = target.dataset.layer;
    const field = target.dataset.field;
    if (!key || !field || !state.layerConfig[key]) return;
    state.layerConfig[key][field] = Number(target.value);
  });
}

function initPresetSelect() {
  Object.entries(PRESETS).forEach(([key, preset]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = preset.label;
    els.preset.appendChild(opt);
  });
  els.preset.value = 'worldpainter_standard';
  applyPreset('worldpainter_standard');
}

bindEvents();
initPresetSelect();
renderStats();
