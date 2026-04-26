const SEA_LEVEL = 64;
const MIN_Y = 0;
const MAX_Y = 255;

const state = {
  file: null,
  source: null,
  analysis: null,
  result: null,
  preview: null,
  info: null
};

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
  minecraftBoost: document.getElementById('minecraftBoost')
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function setStatus(text) {
  els.status.textContent = text;
}

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
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }

  h = (h * 60 + 360) % 360;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return [h, s, v];
}

function boxBlur(src, w, h, radius = 2) {
  const dst = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let oy = -radius; oy <= radius; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const nx = clamp(x + ox, 0, w - 1);
          const ny = clamp(y + oy, 0, h - 1);
          sum += src[ny * w + nx];
          count++;
        }
      }
      dst[y * w + x] = sum / count;
    }
  }
  return dst;
}

function edgeDistanceNorm(x, y, w, h) {
  const d = Math.min(x, y, w - 1 - x, h - 1 - y);
  return d / Math.max(1, Math.min(w, h) * 0.5);
}

function computeLocalContrast(luma, w, h, x, y) {
  const i = y * w + x;
  const c = luma[i];
  const xl = clamp(x - 1, 0, w - 1);
  const xr = clamp(x + 1, 0, w - 1);
  const yt = clamp(y - 1, 0, h - 1);
  const yb = clamp(y + 1, 0, h - 1);
  const n = luma[yt * w + x];
  const s = luma[yb * w + x];
  const e = luma[y * w + xr];
  const wv = luma[y * w + xl];
  const mean = (n + s + e + wv) * 0.25;
  return Math.abs(c - mean);
}

function smoothMask(mask, w, h, passes = 2) {
  let out = new Float32Array(mask);
  for (let p = 0; p < passes; p++) out = boxBlur(out, w, h, 1);
  return out;
}

function analyzeTerrainIntent(image) {
  const { width: w, height: h, rgba } = image;
  const px = w * h;

  const hue = new Float32Array(px);
  const sat = new Float32Array(px);
  const val = new Float32Array(px);
  const luma = new Float32Array(px);
  const blueAffinity = new Float32Array(px);
  const greenAffinity = new Float32Array(px);
  const warmAffinity = new Float32Array(px);
  const rockyAffinity = new Float32Array(px);

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
    blueAffinity[i] = clamp((b - Math.max(r, g) * 0.75) / 255 + ss * 0.5, 0, 1);
    greenAffinity[i] = clamp((g - r * 0.7 - b * 0.55) / 255 + ss * 0.45, 0, 1);
    warmAffinity[i] = clamp(((r + g * 0.55) - b) / 255, 0, 1);
    rockyAffinity[i] = clamp((Math.max(r, g, b) - Math.min(r, g, b)) < 40 ? 0.7 : 0.25, 0, 1);
  }

  const smoothLuma = boxBlur(luma, w, h, 2);

  const oceanProbability = new Float32Array(px);
  const landProbability = new Float32Array(px);
  const mountainProbability = new Float32Array(px);
  const lowlandProbability = new Float32Array(px);
  const desertProbability = new Float32Array(px);
  const forestProbability = new Float32Array(px);
  const snowProbability = new Float32Array(px);
  const swampProbability = new Float32Array(px);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const contrast = computeLocalContrast(smoothLuma, w, h, x, y);
      const edgeBias = 1 - clamp(edgeDistanceNorm(x, y, w, h), 0, 1);

      const isBlue = blueAffinity[i];
      const isDarkWet = clamp((0.45 - val[i]) * 1.8, 0, 1) * sat[i];
      const ocean = clamp(isBlue * 0.65 + edgeBias * 0.25 + isDarkWet * 0.2, 0, 1);
      oceanProbability[i] = ocean;
      landProbability[i] = clamp(1 - ocean * 0.9, 0, 1);

      const whiteLike = clamp((val[i] - 0.72) * 1.8, 0, 1) * clamp(1 - sat[i] * 1.2, 0, 1);
      const rocky = rockyAffinity[i] * clamp(contrast * 6, 0, 1);
      mountainProbability[i] = clamp(rocky * 0.5 + whiteLike * 0.45 + contrast * 1.2, 0, 1) * landProbability[i];

      const flatSignal = clamp(1 - contrast * 6, 0, 1);
      lowlandProbability[i] = flatSignal * landProbability[i];
      desertProbability[i] = clamp(warmAffinity[i] * 0.8 + (1 - sat[i]) * 0.2, 0, 1) * landProbability[i];
      forestProbability[i] = clamp(greenAffinity[i] * 0.95 + sat[i] * 0.15, 0, 1) * landProbability[i];
      snowProbability[i] = clamp(whiteLike * 0.85 + mountainProbability[i] * 0.25, 0, 1) * landProbability[i];
      swampProbability[i] = clamp(forestProbability[i] * 0.45 + isDarkWet * 0.45 + ocean * 0.2, 0, 1) * landProbability[i];
    }
  }

  const oceanSmooth = smoothMask(oceanProbability, w, h, 3);
  const waterMask = new Uint8Array(px);
  const landMask = new Uint8Array(px);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edgeBias = 1 - clamp(edgeDistanceNorm(x, y, w, h), 0, 1);
      const o = clamp(oceanSmooth[i] + edgeBias * 0.12, 0, 1);
      waterMask[i] = o > 0.5 ? 1 : 0;
      landMask[i] = waterMask[i] ? 0 : 1;
    }
  }

  return {
    waterMask,
    landMask,
    oceanProbability,
    landProbability,
    mountainProbability,
    lowlandProbability,
    desertProbability,
    forestProbability,
    snowProbability,
    swampProbability
  };
}

function computeBiomeMap(intent) {
  const px = intent.landMask.length;
  const biomeMap = new Uint8Array(px); // 0 ocean,1 plains,2 forest,3 desert,4 mesa,5 swamp,6 mountain,7 snowy

  for (let i = 0; i < px; i++) {
    if (intent.waterMask[i]) {
      biomeMap[i] = 0;
      continue;
    }

    const candidates = [
      { id: 1, v: intent.lowlandProbability[i] },
      { id: 2, v: intent.forestProbability[i] },
      { id: 3, v: intent.desertProbability[i] },
      { id: 4, v: intent.desertProbability[i] * 0.75 + intent.mountainProbability[i] * 0.35 },
      { id: 5, v: intent.swampProbability[i] },
      { id: 6, v: intent.mountainProbability[i] },
      { id: 7, v: intent.snowProbability[i] }
    ];

    let best = candidates[0];
    for (let k = 1; k < candidates.length; k++) {
      if (candidates[k].v > best.v) best = candidates[k];
    }
    biomeMap[i] = best.id;
  }

  return biomeMap;
}

function reconstructMinecraftHeight(image, intent, biomeMap) {
  const { width: w, height: h } = image;
  const px = w * h;
  const floatHeight = new Float32Array(px);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edgeBias = 1 - clamp(edgeDistanceNorm(x, y, w, h), 0, 1);

      if (intent.waterMask[i]) {
        const depth = intent.oceanProbability[i];
        let oceanY = 63 - depth * 43;
        if (edgeBias < 0.2) oceanY -= 5;
        floatHeight[i] = clamp(oceanY, 20, 63);
        continue;
      }

      const biome = biomeMap[i];
      const mountain = intent.mountainProbability[i];
      const low = intent.lowlandProbability[i];

      let yBase = 78;
      if (biome === 1) yBase = 70 + low * 20;
      else if (biome === 2) yBase = 75 + low * 10 + mountain * 35;
      else if (biome === 3) yBase = 70 + intent.desertProbability[i] * 35;
      else if (biome === 4) yBase = 80 + intent.desertProbability[i] * 20 + mountain * 55;
      else if (biome === 5) yBase = 62 + intent.swampProbability[i] * 10;
      else if (biome === 6) yBase = 140 + mountain * 90;
      else if (biome === 7) yBase = 170 + mountain * 85;

      const coastDistance = localDistanceFromWater(intent.waterMask, w, h, x, y, 8);
      if (coastDistance <= 2) yBase = clamp(64 + coastDistance * 2.2, 64, 69);
      else if (coastDistance <= 6) yBase = clamp(yBase, 70, 80);

      floatHeight[i] = clamp(yBase, 62, 255);
    }
  }

  const macroSmooth = boxBlur(floatHeight, w, h, 2);
  for (let i = 0; i < px; i++) {
    if (intent.waterMask[i]) continue;
    floatHeight[i] = macroSmooth[i] * 0.78 + floatHeight[i] * 0.22;
  }

  return floatHeight;
}

function localDistanceFromWater(waterMask, w, h, x, y, maxR) {
  for (let r = 1; r <= maxR; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (waterMask[ny * w + nx]) return r;
      }
    }
  }
  return maxR + 1;
}

function minecraftLayerPass(heightMap, waterMask, boost = false) {
  const out = new Uint16Array(heightMap.length);
  const step = boost ? 2 : 1;
  for (let i = 0; i < heightMap.length; i++) {
    if (waterMask[i]) {
      out[i] = Math.round(clamp(heightMap[i], 20, 63));
      continue;
    }
    const rounded = Math.round(heightMap[i]);
    const layered = Math.round(rounded / step) * step;
    out[i] = clamp(layered, 62, 255);
  }

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      if (waterMask[i]) continue;
      const a = out[i - 1];
      const b = out[i + 1];
      if (Math.abs(a - b) >= 18) out[i] = Math.round((a + b) * 0.5);
    }
  }

  return out;
}

function quantizeToMinecraftLayers(heightMap, waterMask, boost = false) {
  return minecraftLayerPass(heightMap, waterMask, boost);
}

function toGrayscale(heightY) {
  const out = new Uint8ClampedArray(heightY.length * 4);
  for (let i = 0; i < heightY.length; i++) {
    const y = clamp(Math.round(heightY[i]), MIN_Y, MAX_Y);
    const o = i * 4;
    out[o] = y;
    out[o + 1] = y;
    out[o + 2] = y;
    out[o + 3] = 255;
  }
  return out;
}

function buildHillshade(heightY, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const xl = clamp(x - 1, 0, w - 1);
      const xr = clamp(x + 1, 0, w - 1);
      const yt = clamp(y - 1, 0, h - 1);
      const yb = clamp(y + 1, 0, h - 1);
      const dx = heightY[y * w + xr] - heightY[y * w + xl];
      const dy = heightY[yb * w + x] - heightY[yt * w + x];
      const shade = clamp(140 + (dx * -2 + dy * -1.5), 20, 255);
      const o = i * 4;
      out[o] = out[o + 1] = out[o + 2] = shade;
      out[o + 3] = 255;
    }
  }
  return out;
}

function biomePreview(biomeMap) {
  const palette = {
    0: [30, 90, 180],
    1: [110, 170, 90],
    2: [38, 125, 52],
    3: [220, 206, 125],
    4: [205, 122, 70],
    5: [80, 110, 70],
    6: [122, 122, 122],
    7: [242, 242, 242]
  };
  const out = new Uint8ClampedArray(biomeMap.length * 4);
  for (let i = 0; i < biomeMap.length; i++) {
    const [r, g, b] = palette[biomeMap[i]] || [255, 0, 255];
    const o = i * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}

function waterLandPreview(waterMask) {
  const out = new Uint8ClampedArray(waterMask.length * 4);
  for (let i = 0; i < waterMask.length; i++) {
    const o = i * 4;
    if (waterMask[i]) {
      out[o] = 40; out[o + 1] = 110; out[o + 2] = 200;
    } else {
      out[o] = 85; out[o + 1] = 170; out[o + 2] = 75;
    }
    out[o + 3] = 255;
  }
  return out;
}

function buildStats(intent, yInt, w, h) {
  let water = 0;
  let mountain = 0;
  let min = Infinity;
  let max = -Infinity;
  let underSea = 0;

  for (let i = 0; i < yInt.length; i++) {
    const y = yInt[i];
    if (intent.waterMask[i]) water++;
    if (y >= 140) mountain++;
    if (y < min) min = y;
    if (y > max) max = y;
    if (y < SEA_LEVEL) underSea++;
  }

  return {
    width: w,
    height: h,
    waterPercent: (water / yInt.length) * 100,
    landPercent: 100 - (water / yInt.length) * 100,
    minY: min,
    maxY: max,
    seaLevel: SEA_LEVEL,
    pixelsUnderSea: underSea,
    mountainPercent: (mountain / yInt.length) * 100,
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
  els.stats.innerHTML = `
    <ul>
      <li><b>Résolution:</b> ${s.width} × ${s.height}</li>
      <li><b>% eau:</b> ${s.waterPercent.toFixed(2)}%</li>
      <li><b>% terre:</b> ${s.landPercent.toFixed(2)}%</li>
      <li><b>Altitude min:</b> ${s.minY}</li>
      <li><b>Altitude max:</b> ${s.maxY}</li>
      <li><b>Sea level:</b> ${s.seaLevel}</li>
      <li><b>Pixels sous l'eau:</b> ${s.pixelsUnderSea}</li>
      <li><b>Pixels montagne:</b> ${s.mountainPercent.toFixed(2)}%</li>
      <li><b>Export:</b> ${s.exportFormat}</li>
      <li><b>Compatibilité WorldPainter:</b> ${s.worldPainterCompatible ? 'Oui' : 'Non'}</li>
      <li><b>Réglages WP:</b> Lowest=0 / Water=64 / Highest=255 / Build limit=-64..320</li>
    </ul>
  `;
}

function renderPreview() {
  if (!state.source || !state.preview) return;
  const w = state.source.width;
  const h = state.source.height;
  els.canvas.width = w;
  els.canvas.height = h;
  const ctx = els.canvas.getContext('2d');
  const imageData = ctx.createImageData(w, h);

  const mode = els.previewMode.value;
  if (mode === 'original') {
    imageData.data.set(state.source.rgba);
  } else {
    imageData.data.set(state.preview[mode] || state.preview.heightmap);
  }

  ctx.putImageData(imageData, 0, 0);
}

function runAutoPipeline() {
  if (!state.source) throw new Error('Importez une image avant la conversion.');

  const intent = analyzeTerrainIntent(state.source);
  const biomeMap = computeBiomeMap(intent);
  const floatHeight = reconstructMinecraftHeight(state.source, intent, biomeMap);
  const yInt = quantizeToMinecraftLayers(floatHeight, intent.waterMask, els.minecraftBoost.checked);
  const heightmapPng = toGrayscale(yInt);

  state.analysis = { ...intent, biomeMap };
  state.result = { yInt, rgba: heightmapPng };
  state.preview = {
    watermask: waterLandPreview(intent.waterMask),
    biome: biomePreview(biomeMap),
    heightmap: heightmapPng,
    layers: heightmapPng,
    hillshade: buildHillshade(yInt, state.source.width, state.source.height)
  };

  state.info = buildStats(intent, yInt, state.source.width, state.source.height);
  renderStats();
  renderPreview();
}

function downloadRgbaPng(rgba, w, h, name) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
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
  const name = `converted_heightmap_worldpainter_${state.source.width}x${state.source.height}.png`;
  downloadRgbaPng(state.result.rgba, state.source.width, state.source.height, name);
}

function exportJson() {
  if (!state.result || !state.info) throw new Error('Aucune conversion disponible.');
  const payload = {
    metadata: state.info,
    worldPainter: {
      lowestValue: 0,
      waterLevel: 64,
      highestValue: 255,
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
    renderPreview();
    setStatus(`Image importée: ${file.name}`);
  });

  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag');
  });

  els.dropZone.addEventListener('dragleave', () => {
    els.dropZone.classList.remove('drag');
  });

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
      setStatus('Conversion automatique en vraie heightmap Minecraft...');
      runAutoPipeline();
      setStatus('Conversion terminée (WorldPainter Safe).');
    } catch (err) {
      setStatus('Erreur de conversion');
      alert(err.message);
    }
  });

  els.previewMode.addEventListener('change', renderPreview);

  els.exportPng.addEventListener('click', () => {
    try {
      exportPng();
      setStatus('Export PNG grayscale OK');
    } catch (err) {
      setStatus('Erreur export PNG');
      alert(err.message);
    }
  });

  els.exportJson.addEventListener('click', () => {
    try {
      exportJson();
      setStatus('Export JSON OK');
    } catch (err) {
      setStatus('Erreur export JSON');
      alert(err.message);
    }
  });
}

bindEvents();
renderStats();
