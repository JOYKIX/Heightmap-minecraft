const MINECRAFT_DEFAULTS = {
  minY: -64,
  maxY: 320,
  seaLevel: 64
};

const TERRAIN_CLASSES = {
  deep_ocean: 0,
  ocean: 1,
  shallow_water: 2,
  beach: 3,
  plains: 4,
  forest: 5,
  jungle: 6,
  swamp: 7,
  savanna: 8,
  desert: 9,
  mesa: 10,
  canyon: 11,
  hills: 12,
  mountains: 13,
  snow: 14,
  peaks: 15
};

const CLASS_BY_ID = Object.fromEntries(Object.entries(TERRAIN_CLASSES).map(([k, v]) => [v, k]));

const CLASS_COLORS = {
  deep_ocean: [10, 45, 110],
  ocean: [30, 80, 170],
  shallow_water: [96, 162, 222],
  beach: [224, 213, 153],
  plains: [116, 182, 96],
  forest: [54, 135, 66],
  jungle: [32, 106, 51],
  swamp: [78, 105, 74],
  savanna: [162, 172, 82],
  desert: [230, 212, 126],
  mesa: [204, 115, 70],
  canyon: [170, 90, 56],
  hills: [138, 146, 102],
  mountains: [125, 125, 130],
  snow: [232, 236, 242],
  peaks: [252, 252, 255]
};

const DEFAULT_LAYER_CONFIG = {
  deep_ocean: { name: 'Océan profond', min: -64, max: 20 },
  ocean: { name: 'Océan', min: 20, max: 50 },
  shallow_water: { name: 'Hauts-fonds', min: 50, max: 63 },
  beach: { name: 'Plages', min: 64, max: 70 },
  plains: { name: 'Plaine', min: 70, max: 105 },
  forest: { name: 'Forêt', min: 85, max: 120 },
  jungle: { name: 'Jungle', min: 88, max: 132 },
  swamp: { name: 'Marais', min: 62, max: 75 },
  savanna: { name: 'Savane', min: 75, max: 115 },
  desert: { name: 'Désert', min: 75, max: 120 },
  mesa: { name: 'Mesa', min: 120, max: 190 },
  canyon: { name: 'Canyon', min: 120, max: 190 },
  hills: { name: 'Collines', min: 105, max: 135 },
  mountains: { name: 'Montagnes', min: 170, max: 250 },
  snow: { name: 'Neige / Alpes', min: 220, max: 290 },
  peaks: { name: 'Pics', min: 290, max: 320 }
};

const PRESETS = {
  minecraft_vanilla: {
    label: 'Minecraft Vanilla',
    minY: -64,
    maxY: 320,
    seaLevel: 64,
    waterSensitivity: 0.48,
    reliefGain: 1,
    biomeStrength: 0.8,
    layers: DEFAULT_LAYER_CONFIG
  },
  cobblemon_world: {
    label: 'Cobblemon World',
    minY: -64,
    maxY: 320,
    seaLevel: 64,
    waterSensitivity: 0.5,
    reliefGain: 0.9,
    biomeStrength: 0.75,
    layers: {
      ...DEFAULT_LAYER_CONFIG,
      plains: { ...DEFAULT_LAYER_CONFIG.plains, min: 72, max: 100 },
      forest: { ...DEFAULT_LAYER_CONFIG.forest, min: 82, max: 115 },
      mountains: { ...DEFAULT_LAYER_CONFIG.mountains, min: 165, max: 240 }
    }
  },
  fantasy_island: {
    label: 'Fantasy Island',
    minY: -64,
    maxY: 320,
    seaLevel: 64,
    waterSensitivity: 0.45,
    reliefGain: 1.15,
    biomeStrength: 0.9,
    layers: {
      ...DEFAULT_LAYER_CONFIG,
      deep_ocean: { ...DEFAULT_LAYER_CONFIG.deep_ocean, min: -64, max: 8 },
      beach: { ...DEFAULT_LAYER_CONFIG.beach, min: 64, max: 74 },
      peaks: { ...DEFAULT_LAYER_CONFIG.peaks, min: 280, max: 320 }
    }
  },
  mountain_world: {
    label: 'Mountain World',
    minY: -64,
    maxY: 320,
    seaLevel: 64,
    waterSensitivity: 0.53,
    reliefGain: 1.25,
    biomeStrength: 0.7,
    layers: {
      ...DEFAULT_LAYER_CONFIG,
      hills: { ...DEFAULT_LAYER_CONFIG.hills, min: 120, max: 165 },
      mountains: { ...DEFAULT_LAYER_CONFIG.mountains, min: 190, max: 275 },
      snow: { ...DEFAULT_LAYER_CONFIG.snow, min: 235, max: 300 }
    }
  },
  large_rpg_world: {
    label: 'Large RPG World',
    minY: -64,
    maxY: 320,
    seaLevel: 64,
    waterSensitivity: 0.47,
    reliefGain: 1.05,
    biomeStrength: 0.95,
    layers: {
      ...DEFAULT_LAYER_CONFIG,
      canyon: { ...DEFAULT_LAYER_CONFIG.canyon, min: 110, max: 210 },
      mesa: { ...DEFAULT_LAYER_CONFIG.mesa, min: 110, max: 200 },
      jungle: { ...DEFAULT_LAYER_CONFIG.jungle, min: 92, max: 145 }
    }
  }
};

const state = { file: null, source: null, analysis: null, result: null, preview: null, info: null, layerConfig: structuredClone(DEFAULT_LAYER_CONFIG) };

const els = {
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('dropZone'),
  status: document.getElementById('statusText'),
  process: document.getElementById('btnProcess'),
  exportPng: document.getElementById('btnExport16'),
  exportJson: document.getElementById('btnExportJson'),
  previewMode: document.getElementById('previewMode'),
  canvas: document.getElementById('previewCanvas'),
  stats: document.getElementById('statsPanel'),
  preset: document.getElementById('presetSelect'),
  seaLevel: document.getElementById('seaLevelInput'),
  minY: document.getElementById('minYInput'),
  maxY: document.getElementById('maxYInput'),
  waterSensitivity: document.getElementById('waterSensitivity'),
  reliefGain: document.getElementById('reliefGain'),
  biomeStrength: document.getElementById('biomeStrength'),
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
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d) h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, max === 0 ? 0 : d / max, max];
}

function boxBlur(src, w, h, radius = 1) {
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
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

function analyzeImage(image, settings) {
  const { width: w, height: h, rgba } = image;
  const px = w * h;
  const hue = new Float32Array(px);
  const sat = new Float32Array(px);
  const val = new Float32Array(px);
  const luma = new Float32Array(px);
  const relief = new Float32Array(px);
  const waterMask = new Uint8Array(px);
  const terrainClassMap = new Uint8Array(px);

  for (let i = 0; i < px; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const [hh, ss, vv] = rgbToHsv(r, g, b);
    hue[i] = hh;
    sat[i] = ss;
    val[i] = vv;
    luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    const blueScore = clamp((b - Math.max(r, g) * 0.72) / 255, 0, 1);
    const cyanLike = hh >= 160 && hh <= 230 ? 0.15 : 0;
    waterMask[i] = (blueScore + cyanLike + (1 - vv) * 0.1 + ss * 0.07) > settings.waterSensitivity ? 1 : 0;
  }

  const smooth = boxBlur(luma, w, h, 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = smooth[y * w + clamp(x + 1, 0, w - 1)] - smooth[y * w + clamp(x - 1, 0, w - 1)];
      const gy = smooth[clamp(y + 1, 0, h - 1) * w + x] - smooth[clamp(y - 1, 0, h - 1) * w + x];
      relief[i] = clamp(Math.hypot(gx, gy) * 4.5 * settings.reliefGain, 0, 1);
    }
  }

  const distanceToWater = distanceToMask(waterMask, w, h, false);
  const landMask = new Uint8Array(px);
  for (let i = 0; i < px; i++) landMask[i] = waterMask[i] ? 0 : 1;
  const distanceToLand = distanceToMask(landMask, w, h, false);

  for (let i = 0; i < px; i++) {
    if (waterMask[i]) {
      if (distanceToLand[i] > 24) terrainClassMap[i] = TERRAIN_CLASSES.deep_ocean;
      else if (distanceToLand[i] > 9) terrainClassMap[i] = TERRAIN_CLASSES.ocean;
      else terrainClassMap[i] = TERRAIN_CLASSES.shallow_water;
      continue;
    }

    const hVal = hue[i];
    const sVal = sat[i];
    const vVal = val[i];
    const rVal = relief[i];
    const nearWater = distanceToWater[i] <= 2.5;

    if (nearWater && hVal > 30 && hVal < 58 && sVal < 0.48 && vVal > 0.45) terrainClassMap[i] = TERRAIN_CLASSES.beach;
    else if (vVal > 0.86 && sVal < 0.2 && rVal > 0.35) terrainClassMap[i] = rVal > 0.58 ? TERRAIN_CLASSES.peaks : TERRAIN_CLASSES.snow;
    else if (rVal > 0.68) terrainClassMap[i] = TERRAIN_CLASSES.mountains;
    else if (hVal >= 12 && hVal <= 35 && sVal > 0.4) terrainClassMap[i] = rVal > 0.45 ? TERRAIN_CLASSES.canyon : TERRAIN_CLASSES.mesa;
    else if (hVal >= 36 && hVal <= 60 && sVal > 0.24) terrainClassMap[i] = vVal > 0.7 ? TERRAIN_CLASSES.desert : TERRAIN_CLASSES.savanna;
    else if (hVal >= 80 && hVal <= 160 && sVal > 0.5 && vVal < 0.45) terrainClassMap[i] = TERRAIN_CLASSES.jungle;
    else if (nearWater && hVal >= 80 && hVal <= 165 && vVal < 0.5) terrainClassMap[i] = TERRAIN_CLASSES.swamp;
    else if (hVal >= 75 && hVal <= 160 && sVal > 0.25) terrainClassMap[i] = TERRAIN_CLASSES.forest;
    else if (rVal > 0.28) terrainClassMap[i] = TERRAIN_CLASSES.hills;
    else terrainClassMap[i] = TERRAIN_CLASSES.plains;
  }

  return { hue, sat, val, luma, relief, waterMask, distanceToWater, distanceToLand, terrainClassMap };
}

function quantizeMinecraftHeight(yValue, minY, maxY) {
  return clamp(Math.round(yValue), minY, maxY);
}

function buildMinecraftHeightmap(image, analysis, settings, layerConfig) {
  const px = image.width * image.height;
  const floatHeight = new Float32Array(px);
  const minecraftY = new Int16Array(px);

  for (let i = 0; i < px; i++) {
    const classKey = CLASS_BY_ID[analysis.terrainClassMap[i]];
    const layer = layerConfig[classKey] || layerConfig.plains;
    const lumaDriven = analysis.luma[i] * 0.7 + analysis.relief[i] * 0.3;
    const nearWaterBoost = analysis.distanceToWater[i] < 2 ? -0.06 : 0.03;
    const biomeBias = ((analysis.sat[i] - 0.4) * 0.15 + (analysis.val[i] - 0.5) * 0.08) * settings.biomeStrength;
    const t = clamp(lumaDriven + nearWaterBoost + biomeBias, 0, 1);

    let y = lerp(layer.min, layer.max, t);
    if (classKey === 'beach') y = clamp(y, settings.seaLevel, settings.seaLevel + 8);
    if (classKey === 'shallow_water') y = clamp(y, settings.seaLevel - 14, settings.seaLevel - 1);
    if (classKey === 'deep_ocean') y = Math.min(y, settings.seaLevel - 15);

    floatHeight[i] = y;
    minecraftY[i] = quantizeMinecraftHeight(y, settings.minY, settings.maxY);
  }

  return { floatHeight, minecraftY };
}

function convertYToGray16(y, minY, maxY) {
  const range = Math.max(1, maxY - minY);
  return Math.round(((y - minY) / range) * 65535);
}

function buildGray16Heightmap(minecraftY, minY, maxY) {
  const gray16 = new Uint16Array(minecraftY.length);
  for (let i = 0; i < minecraftY.length; i++) gray16[i] = convertYToGray16(minecraftY[i], minY, maxY);
  return gray16;
}

function gray16ToPreview(gray16) {
  const out = new Uint8ClampedArray(gray16.length * 4);
  for (let i = 0; i < gray16.length; i++) {
    const g = gray16[i] >> 8;
    const o = i * 4;
    out[o] = g;
    out[o + 1] = g;
    out[o + 2] = g;
    out[o + 3] = 255;
  }
  return out;
}

function altitudeColor(y, minY, maxY) {
  const t = clamp((y - minY) / Math.max(1, maxY - minY), 0, 1);
  if (t < 0.33) return [Math.round(lerp(20, 70, t / 0.33)), Math.round(lerp(56, 160, t / 0.33)), Math.round(lerp(150, 95, t / 0.33))];
  if (t < 0.66) return [Math.round(lerp(70, 175, (t - 0.33) / 0.33)), Math.round(lerp(160, 130, (t - 0.33) / 0.33)), Math.round(lerp(95, 75, (t - 0.33) / 0.33))];
  return [Math.round(lerp(175, 250, (t - 0.66) / 0.34)), Math.round(lerp(130, 250, (t - 0.66) / 0.34)), Math.round(lerp(75, 250, (t - 0.66) / 0.34))];
}

function buildAltitudePreview(minecraftY, minY, maxY) {
  const out = new Uint8ClampedArray(minecraftY.length * 4);
  for (let i = 0; i < minecraftY.length; i++) {
    const [r, g, b] = altitudeColor(minecraftY[i], minY, maxY);
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}


function buildWaterLandPreview(waterMask) {
  const out = new Uint8ClampedArray(waterMask.length * 4);
  for (let i = 0; i < waterMask.length; i++) {
    const o = i * 4;
    if (waterMask[i]) {
      out[o] = 40;
      out[o + 1] = 102;
      out[o + 2] = 208;
    } else {
      out[o] = 92;
      out[o + 1] = 158;
      out[o + 2] = 86;
    }
    out[o + 3] = 255;
  }
  return out;
}

function buildLayerPreview(terrainClassMap) {
  const out = new Uint8ClampedArray(terrainClassMap.length * 4);
  for (let i = 0; i < terrainClassMap.length; i++) {
    const key = CLASS_BY_ID[terrainClassMap[i]];
    const [r, g, b] = CLASS_COLORS[key];
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}

function buildContourPreview(minecraftY, minY, maxY) {
  const out = new Uint8ClampedArray(minecraftY.length * 4);
  const range = Math.max(1, maxY - minY);
  for (let i = 0; i < minecraftY.length; i++) {
    const gray = Math.round(((minecraftY[i] - minY) / range) * 255);
    const contour = minecraftY[i] % 8 === 0 ? 42 : 0;
    const v = clamp(gray + contour, 0, 255);
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
}

function buildStats(analysis, minecraftY, gray16, settings, w, h) {
  const classCounts = {};
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < minecraftY.length; i++) {
    min = Math.min(min, minecraftY[i]);
    max = Math.max(max, minecraftY[i]);
    const key = CLASS_BY_ID[analysis.terrainClassMap[i]];
    classCounts[key] = (classCounts[key] || 0) + 1;
  }
  const pixels = minecraftY.length;

  let waterPixels = 0;
  let grayMin = 65535;
  let grayMax = 0;
  for (let i = 0; i < pixels; i++) {
    waterPixels += analysis.waterMask[i];
    grayMin = Math.min(grayMin, gray16[i]);
    grayMax = Math.max(grayMax, gray16[i]);
  }

  return {
    width: w,
    height: h,
    waterPercent: (waterPixels / pixels) * 100,
    minY: min,
    maxY: max,
    seaLevel: settings.seaLevel,
    grayscaleMin: grayMin,
    grayscaleMax: grayMax,
    exportFormat: 'PNG 16-bit grayscale (1 channel, no alpha)',
    terrainClassMap: Object.fromEntries(Object.entries(classCounts).map(([k, v]) => [k, (v / pixels) * 100]))
  };
}

function renderStats() {
  if (!state.info) {
    els.stats.innerHTML = '<p>Aucune conversion.</p>';
    return;
  }
  const s = state.info;
  const classes = Object.entries(s.terrainClassMap)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<li>${k}: ${v.toFixed(2)}%</li>`)
    .join('');

  els.stats.innerHTML = `
    <ul>
      <li><b>Résolution:</b> ${s.width} × ${s.height}</li>
      <li><b>Water:</b> ${s.waterPercent.toFixed(2)}%</li>
      <li><b>Altitude min/max:</b> ${s.minY} / ${s.maxY}</li>
      <li><b>Sea level:</b> ${s.seaLevel}</li>
      <li><b>Gray16 min/max:</b> ${s.grayscaleMin} / ${s.grayscaleMax}</li>
      <li><b>Export:</b> ${s.exportFormat}</li>
      <li><b>Mapping:</b> 1 pixel = 1 bloc Minecraft</li>
    </ul>
    <p><b>terrainClassMap</b></p>
    <ul>${classes}</ul>
  `;
}

function renderPreview() {
  if (!state.source || !state.preview) return;
  const ctx = els.canvas.getContext('2d');
  const w = state.source.width;
  const h = state.source.height;
  els.canvas.width = w;
  els.canvas.height = h;
  const imageData = ctx.createImageData(w, h);
  const mode = els.previewMode.value;
  imageData.data.set(mode === 'original' ? state.source.rgba : (state.preview[mode] || state.preview.grayscale));
  ctx.putImageData(imageData, 0, 0);
}

function readSettingsFromUI() {
  const minY = Number(els.minY.value);
  const maxY = Number(els.maxY.value);
  return {
    seaLevel: Number(els.seaLevel.value),
    minY: Math.min(minY, maxY),
    maxY: Math.max(minY, maxY),
    waterSensitivity: Number(els.waterSensitivity.value),
    reliefGain: Number(els.reliefGain.value),
    biomeStrength: Number(els.biomeStrength.value)
  };
}

function runPipeline() {
  if (!state.source) throw new Error('Importez une image avant la conversion.');

  const settings = readSettingsFromUI();
  const analysis = analyzeImage(state.source, settings);
  const { floatHeight, minecraftY } = buildMinecraftHeightmap(state.source, analysis, settings, state.layerConfig);
  const gray16 = buildGray16Heightmap(minecraftY, settings.minY, settings.maxY);

  state.analysis = { ...analysis, floatHeight };
  state.result = { minecraftY, gray16, settings };
  state.preview = {
    watermask: buildWaterLandPreview(analysis.waterMask),
    classes: buildLayerPreview(analysis.terrainClassMap),
    altitude: buildAltitudePreview(minecraftY, settings.minY, settings.maxY),
    grayscale: gray16ToPreview(gray16),
    layers: buildContourPreview(minecraftY, settings.minY, settings.maxY),
    preview16: gray16ToPreview(gray16)
  };
  state.info = buildStats(analysis, minecraftY, gray16, settings, state.source.width, state.source.height);
  renderStats();
  renderPreview();
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(8 + data.length + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  dv.setUint32(8 + data.length, crc32(crcInput));
  return chunk;
}

async function deflateData(data) {
  if (!('CompressionStream' in window)) throw new Error('CompressionStream indisponible dans ce navigateur.');
  const cs = new CompressionStream('deflate');
  const stream = new Blob([data]).stream().pipeThrough(cs);
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

async function encodeGray16Png(width, height, gray16) {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 16;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width * 2;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const val = gray16[y * width + x];
      const p = rowStart + 1 + x * 2;
      raw[p] = (val >> 8) & 255;
      raw[p + 1] = val & 255;
    }
  }

  const compressed = await deflateData(raw);
  const chunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array(0))
  ];

  const total = signature.length + chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  out.set(signature, offset);
  offset += signature.length;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function exportPng16() {
  if (!state.result || !state.source) throw new Error('Aucune conversion disponible.');
  const bytes = await encodeGray16Png(state.source.width, state.source.height, state.result.gray16);
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `heightmap_16bit_${state.source.width}x${state.source.height}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  if (!state.result || !state.info) throw new Error('Aucune conversion disponible.');
  const payload = {
    metadata: state.info,
    worldPainter: {
      format: '16-bit grayscale PNG',
      lowestValue: state.result.settings.minY,
      waterLevel: state.result.settings.seaLevel,
      highestValue: state.result.settings.maxY,
      buildLimit: '-64..320',
      pixelToBlock: '1:1'
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'heightmap_layer_converter_report.json';
  a.click();
  URL.revokeObjectURL(url);
}

function layerGrayPreview(minY, maxY, y) {
  const gray16 = convertYToGray16(y, minY, maxY);
  const g8 = gray16 >> 8;
  return `rgb(${g8}, ${g8}, ${g8})`;
}

function renderLayerControls() {
  els.layerControls.innerHTML = '';
  const minY = Number(els.minY.value);
  const maxY = Number(els.maxY.value);

  Object.entries(state.layerConfig).forEach(([key, cfg]) => {
    const row = document.createElement('div');
    row.className = 'layer-row';
    const centerY = Math.round((cfg.min + cfg.max) / 2);
    row.innerHTML = `
      <h4>${cfg.name} <small>(${key})</small></h4>
      <label>Altitude min <input data-layer="${key}" data-field="min" type="number" value="${cfg.min}"></label>
      <label>Altitude max <input data-layer="${key}" data-field="max" type="number" value="${cfg.max}"></label>
      <div class="layer-preview-line">
        <span>Gray16: ${convertYToGray16(centerY, minY, maxY)}</span>
        <span class="swatch" style="background:${layerGrayPreview(minY, maxY, centerY)}"></span>
      </div>
    `;
    els.layerControls.appendChild(row);
  });
}

function applyPreset(key) {
  const preset = PRESETS[key] || PRESETS.minecraft_vanilla;
  els.seaLevel.value = preset.seaLevel;
  els.minY.value = preset.minY;
  els.maxY.value = preset.maxY;
  els.waterSensitivity.value = preset.waterSensitivity;
  els.reliefGain.value = preset.reliefGain;
  els.biomeStrength.value = preset.biomeStrength;
  state.layerConfig = structuredClone(preset.layers);
  renderLayerControls();
}

function bindEvents() {
  els.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('Import image...');
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
  els.dropZone.addEventListener('drop', (e) => {
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
      setStatus('Pipeline: import RGB → classes terrain → Y Minecraft → gray16...');
      runPipeline();
      setStatus('Conversion 16-bit terminée.');
    } catch (err) {
      setStatus('Erreur conversion');
      alert(err.message);
    }
  });

  els.previewMode.addEventListener('change', renderPreview);
  els.exportPng.addEventListener('click', async () => {
    try {
      await exportPng16();
      setStatus('Export PNG 16-bit OK');
    } catch (err) {
      alert(err.message);
    }
  });
  els.exportJson.addEventListener('click', () => {
    try {
      exportJson();
      setStatus('Export JSON OK');
    } catch (err) {
      alert(err.message);
    }
  });

  els.preset.addEventListener('change', () => applyPreset(els.preset.value));

  els.layerControls.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const key = target.dataset.layer;
    const field = target.dataset.field;
    if (!key || !field || !state.layerConfig[key]) return;
    state.layerConfig[key][field] = Number(target.value);
    renderLayerControls();
  });
}

function initPresetSelect() {
  Object.entries(PRESETS).forEach(([key, preset]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = preset.label;
    els.preset.appendChild(opt);
  });
  els.preset.value = 'minecraft_vanilla';
  applyPreset('minecraft_vanilla');
}

bindEvents();
initPresetSelect();
renderStats();
