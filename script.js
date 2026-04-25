const $ = (id) => document.getElementById(id);

const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const SURFACE_MIN_Y = 20;
const SURFACE_MAX_Y = 260;

const ui = {
  width: $('width'), height: $('height'), seed: $('seed'), preset: $('preset'), safeMode: $('safe-mode'),
  seaLevel: $('sea-level'), islandSize: $('island-size'), landmassScale: $('landmass-scale'), landmassDensity: $('landmass-density'),
  coastlineComplexity: $('coastline-complexity'), coastFragmentation: $('coast-fragmentation'), islandAsymmetry: $('island-asymmetry'),
  archipelagoAmount: $('archipelago-amount'), coastErosion: $('coast-erosion'),
  mountainIntensity: $('mountain-intensity'), ridgeSharpness: $('ridge-sharpness'), alpineEffect: $('alpine-effect'), massifSize: $('massif-size'),
  peakAmount: $('peak-amount'), valleyStrength: $('valley-strength'), riverDensity: $('river-density'), erosionStrength: $('erosion-strength'),
  terrainSharpness: $('terrain-sharpness'), plateauAmount: $('plateau-amount'), cliffAmount: $('cliff-amount'), terrainVariation: $('terrain-variation'),
  abyssFrequency: $('abyss-frequency'), shelfWidth: $('shelf-width'), layerContrast: $('layer-contrast'),
  previewMode: $('preview-mode'), zoom: $('zoom'), showGrid: $('show-grid'), qualityMode: $('quality-mode'),
  generate: $('generate'), downloadPng: $('download-png'), downloadPgm16: $('download-pgm16'), downloadJson: $('download-json'),
  canvas: $('canvas'), histogram: $('histogram'), progress: $('progress'), pipelineStep: $('pipeline-step'), stats: $('stats'), viewport: $('viewport')
};

const PRESETS = {
  'Minecraft Realistic': { coastlineComplexity: 0.68, mountainIntensity: 0.72, riverDensity: 0.45, terrainSharpness: 1.25, erosionStrength: 0.48, layerContrast: 1.2 },
  'Archipel Dense': { archipelagoAmount: 0.74, landmassDensity: 0.47, coastFragmentation: 0.66, mountainIntensity: 0.54, riverDensity: 0.34, shelfWidth: 0.7 },
  'Alpine Chains': { mountainIntensity: 0.9, ridgeSharpness: 2.4, alpineEffect: 0.84, massifSize: 0.95, peakAmount: 0.72, layerContrast: 1.36 },
  'WorldPainter Safe': { safeMode: true, seaLevel: 64, coastErosion: 0.52, terrainSharpness: 1.36, cliffAmount: 0.32, abyssFrequency: 0.14 }
};

const ctx = ui.canvas.getContext('2d', { willReadFrequently: true });
const histCtx = ui.histogram.getContext('2d');
const worker = new Worker('terrain-worker.js');
let pendingJob = null;

const state = {
  preview: null,
  full: null,
  config: null,
  targetWidth: 1024,
  targetHeight: 1024
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function setProgress(step, pct) {
  ui.pipelineStep.textContent = step;
  ui.progress.style.width = `${Math.round(pct * 100)}%`;
}

function minecraftYToGray(y, bitDepth = 8) {
  const t = clamp((y - MC_MIN_Y) / Math.max(1, MC_MAX_Y - MC_MIN_Y), 0, 1);
  return Math.round(t * (bitDepth === 16 ? 65535 : 255));
}

function collectConfig(scale = 1) {
  const targetWidth = Number(ui.width.value);
  const targetHeight = Number(ui.height.value);
  const width = Math.max(256, Math.floor(targetWidth * scale));
  const height = Math.max(256, Math.floor(targetHeight * scale));
  const cfg = {
    width,
    height,
    targetWidth,
    targetHeight,
    seed: ui.seed.value.trim() || 'minecraft-surface',
    safeMode: ui.safeMode.checked,
    seaLevel: Number(ui.seaLevel.value),
    islandSize: Number(ui.islandSize.value),
    landmassScale: Number(ui.landmassScale.value),
    landmassDensity: Number(ui.landmassDensity.value),
    coastlineComplexity: Number(ui.coastlineComplexity.value),
    coastFragmentation: Number(ui.coastFragmentation.value),
    islandAsymmetry: Number(ui.islandAsymmetry.value),
    archipelagoAmount: Number(ui.archipelagoAmount.value),
    coastErosion: Number(ui.coastErosion.value),
    mountainIntensity: Number(ui.mountainIntensity.value),
    ridgeSharpness: Number(ui.ridgeSharpness.value),
    alpineEffect: Number(ui.alpineEffect.value),
    massifSize: Number(ui.massifSize.value),
    peakAmount: Number(ui.peakAmount.value),
    valleyStrength: Number(ui.valleyStrength.value),
    riverDensity: Number(ui.riverDensity.value),
    erosionStrength: Number(ui.erosionStrength.value),
    terrainSharpness: Number(ui.terrainSharpness.value),
    plateauAmount: Number(ui.plateauAmount.value),
    cliffAmount: Number(ui.cliffAmount.value),
    terrainVariation: Number(ui.terrainVariation.value),
    abyssFrequency: Number(ui.abyssFrequency.value),
    shelfWidth: Number(ui.shelfWidth.value),
    layerContrast: Number(ui.layerContrast.value),
    quality: ui.qualityMode.value
  };
  if (cfg.safeMode) cfg.seaLevel = 64;
  return cfg;
}

function previewScaleFor(w, h) {
  const maxDim = Math.max(w, h);
  if (maxDim >= 4096) return 0.25;
  if (maxDim >= 2048) return 0.5;
  if (maxDim >= 1536) return 0.67;
  return 1;
}

function launchGeneration(phase, scale = 1) {
  const cfg = collectConfig(scale);
  state.config = cfg;
  if ((phase === 'preview' && cfg.targetWidth >= 2048) || cfg.targetWidth >= 4096) {
    setProgress('Garde-fou: preview basse résolution activée', 0.01);
  }
  pendingJob = phase;
  worker.postMessage({ type: 'generate', phase, cfg });
}

worker.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'progress') {
    setProgress(`${pendingJob === 'full' ? 'Export HD' : 'Preview'} · ${data.step}`, data.progress);
    return;
  }

  if (data.type === 'done') {
    const payload = {
      width: data.width,
      height: data.height,
      heights: new Uint16Array(data.heights),
      slope: new Float32Array(data.slope),
      image: new Uint8ClampedArray(data.image),
      config: data.config
    };

    if (data.phase === 'preview') {
      state.preview = payload;
      ui.canvas.width = payload.width;
      ui.canvas.height = payload.height;
      renderPreview();
      renderStats(payload);
      renderHistogram(payload);
      setProgress(`Preview prête (${payload.width}x${payload.height})`, 1);
    } else {
      state.full = payload;
      setProgress(`Export HD prêt (${payload.width}x${payload.height})`, 1);
    }
    pendingJob = null;
  }
};

function renderPreview() {
  const src = state.preview;
  if (!src) return;
  const image = new ImageData(src.image, src.width, src.height);
  const mode = ui.previewMode.value;

  if (mode === 'grayscale') {
    ctx.putImageData(image, 0, 0);
  } else {
    const out = new Uint8ClampedArray(src.image.length);
    for (let i = 0; i < src.heights.length; i += 1) {
      const h = src.heights[i];
      const s = clamp(Math.round(src.slope[i] * 10), 0, 255);
      const o = i * 4;
      if (mode === 'hillshade') {
        const shade = clamp(185 + (h - src.config.seaLevel) * 0.75 - src.slope[i] * 1.8, 8, 245);
        out[o] = shade; out[o + 1] = shade; out[o + 2] = shade;
      } else if (mode === 'slope-preview') {
        out[o] = s; out[o + 1] = 80; out[o + 2] = 255 - s;
      } else if (mode === 'contour-preview') {
        const g = minecraftYToGray(h, 8);
        const contour = h % 8 === 0 || h % 16 === 0;
        out[o] = contour ? 255 : g;
        out[o + 1] = contour ? 245 : g;
        out[o + 2] = contour ? 140 : g;
      } else {
        const t = clamp((h - SURFACE_MIN_Y) / (SURFACE_MAX_Y - SURFACE_MIN_Y), 0, 1);
        out[o] = clamp(Math.round(255 * (1.5 * t)), 0, 255);
        out[o + 1] = clamp(Math.round(255 * (1.4 - Math.abs(t - 0.5) * 2)), 0, 255);
        out[o + 2] = clamp(Math.round(255 * (1.2 - 1.6 * t)), 0, 255);
      }
      out[o + 3] = 255;
    }
    ctx.putImageData(new ImageData(out, src.width, src.height), 0, 0);
  }

  if (ui.showGrid.checked) drawGridOverlay(src.width, src.height);
}

function drawGridOverlay(w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
  ctx.restore();
}

function renderStats(src) {
  const heights = src.heights;
  let minY = 999;
  let maxY = -999;
  let sum = 0;
  let land = 0;
  for (let i = 0; i < heights.length; i += 1) {
    const v = heights[i];
    minY = Math.min(minY, v);
    maxY = Math.max(maxY, v);
    sum += v;
    if (v >= src.config.seaLevel) land += 1;
  }

  const rows = [
    `Résolution preview: ${src.width}x${src.height} (cible ${src.config.targetWidth}x${src.config.targetHeight})`,
    `Qualité: ${src.config.quality}`,
    `Seed: ${src.config.seed}`,
    `Sea level: Y${src.config.seaLevel}`,
    `Altitude min/max: Y${minY} -> Y${maxY}`,
    `Moyenne: Y${(sum / heights.length).toFixed(1)}`,
    `Sea gray 8-bit: ${minecraftYToGray(src.config.seaLevel, 8)}`,
    `Sea gray 16-bit: ${minecraftYToGray(src.config.seaLevel, 16)}`,
    `Terres: ${((land / heights.length) * 100).toFixed(1)}% | Océan: ${(100 - ((land / heights.length) * 100)).toFixed(1)}%`
  ];

  ui.stats.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.stats.appendChild(li);
  });
}

function renderHistogram(src) {
  const bins = new Uint32Array(261);
  for (let i = 0; i < src.heights.length; i += 1) bins[src.heights[i]] += 1;
  let maxBin = 1;
  for (let i = SURFACE_MIN_Y; i <= SURFACE_MAX_Y; i += 1) maxBin = Math.max(maxBin, bins[i]);

  histCtx.clearRect(0, 0, ui.histogram.width, ui.histogram.height);
  histCtx.fillStyle = '#0b1324';
  histCtx.fillRect(0, 0, ui.histogram.width, ui.histogram.height);

  for (let i = SURFACE_MIN_Y; i <= SURFACE_MAX_Y; i += 1) {
    const x = ((i - SURFACE_MIN_Y) / (SURFACE_MAX_Y - SURFACE_MIN_Y)) * ui.histogram.width;
    const h = (bins[i] / maxBin) * (ui.histogram.height - 16);
    histCtx.fillStyle = i < src.config.seaLevel ? '#3c78d8' : '#7fd38f';
    histCtx.fillRect(x, ui.histogram.height - h, Math.max(1, ui.histogram.width / 256), h);
  }
}

function filenameBase(cfg) {
  return `heightmap_surface_${cfg.seed}_${cfg.targetWidth}x${cfg.targetHeight}`;
}

function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function awaitFullResolution() {
  return new Promise((resolve) => {
    const cfg = collectConfig(1);
    if (state.full && state.full.width === cfg.targetWidth && state.full.height === cfg.targetHeight && state.full.config.seed === cfg.seed && state.full.config.quality === cfg.quality) {
      resolve(state.full);
      return;
    }

    const onDone = (event) => {
      if (event.data.type === 'done' && event.data.phase === 'full') {
        worker.removeEventListener('message', onDone);
        resolve(state.full);
      }
    };
    worker.addEventListener('message', onDone);
    launchGeneration('full', 1);
  });
}

async function exportPng() {
  if (!state.preview) return;
  const full = await awaitFullResolution();
  const image = new Uint8ClampedArray(full.width * full.height * 4);
  for (let i = 0; i < full.heights.length; i += 1) {
    const g = minecraftYToGray(full.heights[i], 8);
    const o = i * 4;
    image[o] = g; image[o + 1] = g; image[o + 2] = g; image[o + 3] = 255;
  }
  const offscreen = document.createElement('canvas');
  offscreen.width = full.width;
  offscreen.height = full.height;
  offscreen.getContext('2d').putImageData(new ImageData(image, full.width, full.height), 0, 0);
  const a = document.createElement('a');
  a.download = `${filenameBase(full.config)}.png`;
  a.href = offscreen.toDataURL('image/png');
  a.click();
  renderPreview();
}

async function exportPgm16() {
  if (!state.preview) return;
  const full = await awaitFullResolution();
  const header = `P5\n${full.width} ${full.height}\n65535\n`;
  const body = new Uint8Array(full.width * full.height * 2);
  let offset = 0;
  for (let i = 0; i < full.heights.length; i += 1) {
    const gray16 = minecraftYToGray(full.heights[i], 16);
    body[offset++] = (gray16 >> 8) & 0xff;
    body[offset++] = gray16 & 0xff;
  }
  downloadBlob(`${filenameBase(full.config)}.pgm`, new Blob([header, body], { type: 'application/octet-stream' }));
}

async function exportPresetJson() {
  if (!state.preview) return;
  const full = await awaitFullResolution();
  let minY = 999;
  let maxY = -999;
  for (let i = 0; i < full.heights.length; i += 1) {
    minY = Math.min(minY, full.heights[i]);
    maxY = Math.max(maxY, full.heights[i]);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    preset: ui.preset.value,
    config: full.config,
    minecraftVersion: '1.21+',
    mode: 'preview-first then full-on-export',
    mapping: {
      minY,
      maxY,
      minecraftMinY: MC_MIN_Y,
      minecraftMaxY: MC_MAX_Y,
      seaLevel: full.config.seaLevel,
      seaGray8: minecraftYToGray(full.config.seaLevel, 8),
      seaGray16: minecraftYToGray(full.config.seaLevel, 16)
    }
  };
  downloadBlob(`${filenameBase(full.config)}_preset.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

function bindRangeValue(id) {
  const input = $(id);
  const badge = $(`${id}-val`);
  const refresh = () => { badge.textContent = input.value; };
  input.addEventListener('input', refresh);
  refresh();
}

[
  'sea-level', 'abyss-frequency', 'shelf-width', 'layer-contrast', 'island-size', 'landmass-scale', 'landmass-density', 'coastline-complexity', 'coast-fragmentation',
  'island-asymmetry', 'archipelago-amount', 'coast-erosion', 'mountain-intensity', 'ridge-sharpness', 'alpine-effect', 'massif-size', 'peak-amount',
  'valley-strength', 'river-density', 'erosion-strength', 'terrain-sharpness', 'plateau-amount', 'cliff-amount', 'terrain-variation'
].forEach(bindRangeValue);

Object.keys(PRESETS).forEach((name) => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  ui.preset.appendChild(opt);
});
ui.preset.value = 'Minecraft Realistic';

ui.preset.addEventListener('change', () => {
  const preset = PRESETS[ui.preset.value];
  Object.entries(preset).forEach(([k, v]) => {
    if (k === 'safeMode') {
      ui.safeMode.checked = Boolean(v);
      return;
    }
    const id = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const el = $(id);
    if (el) {
      el.value = String(v);
      el.dispatchEvent(new Event('input'));
    }
  });
});

ui.generate.addEventListener('click', () => {
  state.full = null;
  state.targetWidth = Number(ui.width.value);
  state.targetHeight = Number(ui.height.value);
  const scale = previewScaleFor(state.targetWidth, state.targetHeight);
  launchGeneration('preview', scale);
});
ui.previewMode.addEventListener('change', renderPreview);
ui.showGrid.addEventListener('change', renderPreview);
ui.zoom.addEventListener('input', () => { ui.canvas.style.transform = `scale(${ui.zoom.value})`; });
ui.downloadPng.addEventListener('click', exportPng);
ui.downloadPgm16.addEventListener('click', exportPgm16);
ui.downloadJson.addEventListener('click', exportPresetJson);

(function enablePan() {
  let drag = false; let sx = 0; let sy = 0;
  ui.viewport.addEventListener('mousedown', (e) => {
    drag = true;
    sx = e.clientX + ui.viewport.scrollLeft;
    sy = e.clientY + ui.viewport.scrollTop;
  });
  window.addEventListener('mouseup', () => { drag = false; });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    ui.viewport.scrollLeft = sx - e.clientX;
    ui.viewport.scrollTop = sy - e.clientY;
  });
})();

ui.qualityMode.value = 'balanced';
ui.generate.click();
