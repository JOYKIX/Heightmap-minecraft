const $ = (id) => document.getElementById(id);

const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const DEFAULT_SIMPLE = {
  mapSize: '1024',
  worldType: 'ile-pokemon',
  reliefStyle: 'balanced',
  waterAmount: 'medium',
  coastStyle: 'mixed',
  riversLevel: 'few',
  quality: 'balanced'
};

const ui = {
  mapSize: $('map-size'),
  worldType: $('world-type'),
  reliefStyle: $('relief-style'),
  waterAmount: $('water-amount'),
  coastStyle: $('coast-style'),
  riversLevel: $('rivers-level'),
  qualityMode: $('quality-mode'),
  seed: $('seed'),
  randomSeed: $('random-seed'),
  newSeed: $('new-seed'),
  generate: $('generate'),
  quickPreview: $('quick-preview'),
  quickPreviewBadge: $('quick-preview-badge'),
  impactNote: $('impact-note'),

  seaLevel: $('sea-level'),
  minY: $('min-y'),
  maxY: $('max-y'),
  erosionStrength: $('erosion-strength'),
  mountainScale: $('mountain-scale'),
  riverDepth: $('river-depth'),
  coastlineComplexity: $('coastline-complexity'),
  quantization: $('quantization'),
  cleanupStrength: $('cleanup-strength'),

  previewMode: $('preview-mode'),
  zoom: $('zoom'),
  showGrid: $('show-grid'),
  downloadPng: $('download-png'),
  downloadJson: $('download-json'),
  canvas: $('canvas'),
  histogram: $('histogram'),
  progress: $('progress'),
  pipelineStep: $('pipeline-step'),
  stats: $('stats'),
  configSummary: $('config-summary'),
  viewport: $('viewport')
};

const WORLD_PRESETS = {
  'ile-pokemon': {
    label: 'Région Pokémon',
    description: 'Grande île lisible, zones plates exploitables, plages propres.',
    advanced: { islandSize: 0.97, archipelagoAmount: 0.16, coastFragmentation: 0.28, landmassScale: 0.88, landmassDensity: 0.62, terrainVariation: 0.56, mountainIntensity: 0.58, ridgeSharpness: 1.35, alpineEffect: 0.42, peakAmount: 0.31, valleyStrength: 0.44, riverDensity: 0.38, coastErosion: 0.36, cliffAmount: 0.24, terrainSharpness: 1.1, layerContrast: 1.18, abyssFrequency: 0.12, shelfWidth: 0.58 }
  },
  'ile-realiste': {
    label: 'Île réaliste',
    description: 'Côtes irrégulières, relief naturel, vallées crédibles.',
    advanced: { islandSize: 1, archipelagoAmount: 0.22, coastFragmentation: 0.41, landmassScale: 0.94, landmassDensity: 0.57, terrainVariation: 0.62, mountainIntensity: 0.68, ridgeSharpness: 1.58, alpineEffect: 0.52, peakAmount: 0.38, valleyStrength: 0.58, riverDensity: 0.45, coastErosion: 0.47, cliffAmount: 0.35, terrainSharpness: 1.22, layerContrast: 1.22, abyssFrequency: 0.17, shelfWidth: 0.55 }
  },
  'archipel': {
    label: 'Archipel',
    description: 'Plusieurs îles, eau dominante, relief léger à moyen.',
    advanced: { islandSize: 1.08, archipelagoAmount: 0.78, coastFragmentation: 0.65, landmassScale: 1.05, landmassDensity: 0.42, terrainVariation: 0.52, mountainIntensity: 0.49, ridgeSharpness: 1.22, alpineEffect: 0.35, peakAmount: 0.23, valleyStrength: 0.36, riverDensity: 0.27, coastErosion: 0.52, cliffAmount: 0.22, terrainSharpness: 1.0, layerContrast: 1.11, abyssFrequency: 0.22, shelfWidth: 0.7 }
  },
  'continent': {
    label: 'Continent',
    description: 'Grande masse terrestre, chaînes de montagnes, longues rivières.',
    advanced: { islandSize: 1.2, archipelagoAmount: 0.12, coastFragmentation: 0.38, landmassScale: 0.72, landmassDensity: 0.71, terrainVariation: 0.65, mountainIntensity: 0.73, ridgeSharpness: 1.82, alpineEffect: 0.54, peakAmount: 0.44, valleyStrength: 0.62, riverDensity: 0.56, coastErosion: 0.41, cliffAmount: 0.3, terrainSharpness: 1.25, layerContrast: 1.2, abyssFrequency: 0.1, shelfWidth: 0.5 }
  },
  'survie-equilibree': {
    label: 'Survie équilibrée',
    description: 'Plaines nombreuses, collines modérées, terrain jouable.',
    advanced: { islandSize: 1.04, archipelagoAmount: 0.2, coastFragmentation: 0.33, landmassScale: 0.9, landmassDensity: 0.63, terrainVariation: 0.54, mountainIntensity: 0.52, ridgeSharpness: 1.33, alpineEffect: 0.39, peakAmount: 0.28, valleyStrength: 0.45, riverDensity: 0.41, coastErosion: 0.42, cliffAmount: 0.21, terrainSharpness: 1.06, layerContrast: 1.15, abyssFrequency: 0.12, shelfWidth: 0.6 }
  },
  'fantasy-dramatique': {
    label: 'Fantasy dramatique',
    description: 'Falaises, montagnes marquées, relief spectaculaire.',
    advanced: { islandSize: 0.92, archipelagoAmount: 0.46, coastFragmentation: 0.57, landmassScale: 0.96, landmassDensity: 0.54, terrainVariation: 0.78, mountainIntensity: 0.92, ridgeSharpness: 2.2, alpineEffect: 0.82, peakAmount: 0.68, valleyStrength: 0.72, riverDensity: 0.34, coastErosion: 0.5, cliffAmount: 0.63, terrainSharpness: 1.52, layerContrast: 1.32, abyssFrequency: 0.2, shelfWidth: 0.48 }
  },
  'monde-montagneux': {
    label: 'Monde montagneux',
    description: 'Montagnes plus présentes avec vallées creusées.',
    advanced: { islandSize: 1.05, archipelagoAmount: 0.2, coastFragmentation: 0.35, landmassScale: 0.88, landmassDensity: 0.6, terrainVariation: 0.71, mountainIntensity: 0.84, ridgeSharpness: 2.0, alpineEffect: 0.72, peakAmount: 0.58, valleyStrength: 0.64, riverDensity: 0.4, coastErosion: 0.4, cliffAmount: 0.5, terrainSharpness: 1.42, layerContrast: 1.28, abyssFrequency: 0.14, shelfWidth: 0.52 }
  }
};

const RELIEF_PROFILE = {
  flat: { mountainIntensity: 0.62, ridgeSharpness: 0.8, terrainVariation: 0.55, valleyStrength: 0.7 },
  soft: { mountainIntensity: 0.8, ridgeSharpness: 0.92, terrainVariation: 0.8, valleyStrength: 0.88 },
  balanced: { mountainIntensity: 1, ridgeSharpness: 1, terrainVariation: 1, valleyStrength: 1 },
  mountainous: { mountainIntensity: 1.2, ridgeSharpness: 1.2, terrainVariation: 1.2, valleyStrength: 1.08 },
  extreme: { mountainIntensity: 1.42, ridgeSharpness: 1.4, terrainVariation: 1.35, valleyStrength: 1.2 }
};

const WATER_PROFILE = {
  low: { seaLevelDelta: -3, abyssFrequencyMul: 0.75, shelfWidthMul: 0.85, landmassDensityMul: 1.08 },
  medium: { seaLevelDelta: 0, abyssFrequencyMul: 1, shelfWidthMul: 1, landmassDensityMul: 1 },
  high: { seaLevelDelta: 3, abyssFrequencyMul: 1.25, shelfWidthMul: 1.2, landmassDensityMul: 0.9 }
};

const COAST_PROFILE = {
  soft: { coastFragmentationMul: 0.72, cliffAmountMul: 0.55, coastErosionMul: 1.2, coastlineComplexityMul: 0.82 },
  mixed: { coastFragmentationMul: 1, cliffAmountMul: 1, coastErosionMul: 1, coastlineComplexityMul: 1 },
  rocky: { coastFragmentationMul: 1.14, cliffAmountMul: 1.45, coastErosionMul: 0.86, coastlineComplexityMul: 1.2 }
};

const RIVER_PROFILE = {
  none: { riverDensity: 0.02, riverDepth: 0.45 },
  few: { riverDensity: 0.35, riverDepth: 0.9 },
  many: { riverDensity: 0.62, riverDepth: 1.28 }
};

const QUALITY_LABEL = { fast: 'Rapide', balanced: 'Équilibrée', high: 'Haute qualité' };

const ctx = ui.canvas.getContext('2d', { willReadFrequently: true });
const histCtx = ui.histogram.getContext('2d');
const worker = new Worker('terrain-worker.js');
let pendingJob = null;

const state = { preview: null, full: null, config: null };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function setProgress(step, pct) {
  ui.pipelineStep.textContent = step;
  ui.progress.style.width = `${Math.round(pct * 100)}%`;
}

function setManualGuidance(message = 'Modifiez vos paramètres puis cliquez sur Générer') {
  ui.pipelineStep.textContent = message;
  ui.progress.style.width = '0%';
}

function minecraftYToGray(y, bitDepth = 8) {
  const t = clamp((y - MC_MIN_Y) / Math.max(1, MC_MAX_Y - MC_MIN_Y), 0, 1);
  return Math.round(t * (bitDepth === 16 ? 65535 : 255));
}

function randomSeed() {
  const token = Math.random().toString(36).slice(2, 8);
  ui.seed.value = `map-${Date.now().toString(36)}-${token}`;
}

function fillWorldTypeOptions() {
  const simpleWorldOrder = ['ile-realiste', 'archipel', 'continent', 'ile-pokemon', 'monde-montagneux', 'survie-equilibree'];
  simpleWorldOrder.forEach((value) => {
    const preset = WORLD_PRESETS[value];
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = preset.label;
    ui.worldType.appendChild(opt);
  });
  ui.worldType.value = DEFAULT_SIMPLE.worldType;
}

function deriveConfigFromSimple() {
  const preset = WORLD_PRESETS[ui.worldType.value];
  const relief = RELIEF_PROFILE[ui.reliefStyle.value];
  const water = WATER_PROFILE[ui.waterAmount.value];
  const coast = COAST_PROFILE[ui.coastStyle.value];
  const rivers = RIVER_PROFILE[ui.riversLevel.value];

  const base = { ...preset.advanced };
  base.mountainIntensity = clamp(base.mountainIntensity * relief.mountainIntensity, 0.2, 1);
  base.ridgeSharpness = clamp(base.ridgeSharpness * relief.ridgeSharpness, 0.5, 3);
  base.terrainVariation = clamp(base.terrainVariation * relief.terrainVariation, 0, 1);
  base.valleyStrength = clamp(base.valleyStrength * relief.valleyStrength, 0, 1);

  base.seaLevel = clamp(64 + water.seaLevelDelta, 63, 90);
  base.abyssFrequency = clamp(base.abyssFrequency * water.abyssFrequencyMul, 0, 1);
  base.shelfWidth = clamp(base.shelfWidth * water.shelfWidthMul, 0, 1);
  base.landmassDensity = clamp(base.landmassDensity * water.landmassDensityMul, 0, 1);

  base.coastFragmentation = clamp(base.coastFragmentation * coast.coastFragmentationMul, 0, 1);
  base.cliffAmount = clamp(base.cliffAmount * coast.cliffAmountMul, 0, 1);
  base.coastErosion = clamp(base.coastErosion * coast.coastErosionMul, 0, 1);
  base.coastlineComplexity = clamp(base.coastlineComplexity * coast.coastlineComplexityMul, 0, 1);

  base.riverDensity = rivers.riverDensity;
  base.riverDepth = rivers.riverDepth;

  return base;
}

function syncAdvancedInputs(fromDerived) {
  ui.seaLevel.value = Math.round(fromDerived.seaLevel);
  ui.erosionStrength.value = fromDerived.erosionStrength;
  ui.mountainScale.value = fromDerived.massifSize;
  ui.riverDepth.value = fromDerived.riverDepth;
  ui.coastlineComplexity.value = fromDerived.coastlineComplexity;
  ui.quantization.value = fromDerived.plateauAmount;

  bindAdvancedValue('sea-level', `Y${ui.seaLevel.value}`);
  bindAdvancedValue('erosion-strength');
  bindAdvancedValue('mountain-scale');
  bindAdvancedValue('river-depth');
  bindAdvancedValue('coastline-complexity');
  bindAdvancedValue('quantization');
  bindAdvancedValue('cleanup-strength');
}

function bindAdvancedValue(id, forcedText = null) {
  const input = $(id);
  const badge = $(`${id}-val`);
  if (!badge || !input) return;
  badge.textContent = forcedText || input.value;
}

function collectSettings(scale = 1) {
  const targetSize = Number(ui.mapSize.value);
  const dim = Math.max(256, Math.floor(targetSize * scale));
  const derived = deriveConfigFromSimple();

  const cfg = {
    width: dim,
    height: dim,
    targetWidth: targetSize,
    targetHeight: targetSize,
    seed: ui.seed.value.trim() || 'minecraft-surface',
    quality: ui.qualityMode.value,
    safeMode: true,

    seaLevel: Number(ui.seaLevel.value) || derived.seaLevel,
    minY: clamp(Number(ui.minY.value) || 20, -64, 250),
    maxY: clamp(Number(ui.maxY.value) || 260, 80, 320),
    erosionStrength: Number(ui.erosionStrength.value) || derived.erosionStrength,
    massifSize: Number(ui.mountainScale.value) || derived.massifSize,
    riverDepth: Number(ui.riverDepth.value) || derived.riverDepth,
    coastlineComplexity: Number(ui.coastlineComplexity.value) || derived.coastlineComplexity,
    plateauAmount: Number(ui.quantization.value) || derived.plateauAmount,
    cleanupStrength: Number(ui.cleanupStrength.value) || 0.5,

    islandSize: derived.islandSize,
    landmassScale: derived.landmassScale,
    landmassDensity: derived.landmassDensity,
    coastFragmentation: derived.coastFragmentation,
    islandAsymmetry: 0.52,
    archipelagoAmount: derived.archipelagoAmount,
    coastErosion: derived.coastErosion,
    mountainIntensity: derived.mountainIntensity,
    ridgeSharpness: derived.ridgeSharpness,
    alpineEffect: derived.alpineEffect,
    peakAmount: derived.peakAmount,
    valleyStrength: derived.valleyStrength,
    riverDensity: derived.riverDensity,
    terrainSharpness: derived.terrainSharpness,
    cliffAmount: derived.cliffAmount,
    terrainVariation: derived.terrainVariation,
    abyssFrequency: derived.abyssFrequency,
    shelfWidth: derived.shelfWidth,
    layerContrast: derived.layerContrast
  };

  if (cfg.maxY <= cfg.minY) cfg.maxY = Math.min(320, cfg.minY + 40);
  return cfg;
}

function previewScaleFor(size) {
  if (size >= 4096) return 0.18;
  if (size >= 2048) return 0.33;
  if (size >= 1536) return 0.5;
  return 0.75;
}

function launchGeneration(phase, scale = 1) {
  const cfg = collectSettings(scale);
  state.config = cfg;
  pendingJob = phase;
  worker.postMessage({ type: 'generate', phase, cfg });
}

worker.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'progress') {
    const mode = pendingJob === 'full' ? 'Génération finale' : 'Preview rapide';
    setProgress(`${mode} · ${data.step}`, data.progress);
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
      renderSummary(payload.config);
      setProgress(`Preview rapide prête (${payload.width}x${payload.height})`, 1);
    } else {
      state.full = payload;
      state.preview = payload;
      ui.canvas.width = payload.width;
      ui.canvas.height = payload.height;
      renderPreview();
      renderStats(payload);
      renderHistogram(payload);
      renderSummary(payload.config);
      setProgress(`Génération finale prête (${payload.width}x${payload.height})`, 1);
    }
    pendingJob = null;
  }
};

function renderPreview() {
  const src = state.preview;
  if (!src) return;
  const mode = ui.previewMode.value;
  const image = new ImageData(src.image, src.width, src.height);

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
        const t = clamp((h - src.config.minY) / Math.max(1, src.config.maxY - src.config.minY), 0, 1);
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
    `Qualité: ${QUALITY_LABEL[src.config.quality] || src.config.quality}`,
    `Seed: ${src.config.seed}`,
    `Sea level: Y${src.config.seaLevel}`,
    `Altitude min/max: Y${minY} -> Y${maxY}`,
    `Moyenne: Y${(sum / heights.length).toFixed(1)}`,
    `Terres: ${((land / heights.length) * 100).toFixed(1)}% | Océan: ${(100 - ((land / heights.length) * 100)).toFixed(1)}%`
  ];

  ui.stats.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.stats.appendChild(li);
  });
}

function renderSummary(cfg) {
  const world = WORLD_PRESETS[ui.worldType.value];
  const rows = [
    `Type : ${world.label}`,
    `Taille : ${cfg.targetWidth}x${cfg.targetHeight}`,
    `Relief : ${ui.reliefStyle.options[ui.reliefStyle.selectedIndex].text}`,
    `Eau : ${ui.waterAmount.options[ui.waterAmount.selectedIndex].text}`,
    `Côtes : ${ui.coastStyle.options[ui.coastStyle.selectedIndex].text}`,
    `Rivières : ${ui.riversLevel.options[ui.riversLevel.selectedIndex].text}`,
    `Qualité : ${QUALITY_LABEL[cfg.quality] || cfg.quality}`,
    `Sea level : Y${cfg.seaLevel}`
  ];

  ui.configSummary.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.configSummary.appendChild(li);
  });
}

function renderHistogram(src) {
  const bins = new Uint32Array(321);
  for (let i = 0; i < src.heights.length; i += 1) bins[src.heights[i]] += 1;
  let maxBin = 1;
  for (let i = src.config.minY; i <= src.config.maxY; i += 1) maxBin = Math.max(maxBin, bins[i]);

  histCtx.clearRect(0, 0, ui.histogram.width, ui.histogram.height);
  histCtx.fillStyle = '#0b1324';
  histCtx.fillRect(0, 0, ui.histogram.width, ui.histogram.height);

  for (let i = src.config.minY; i <= src.config.maxY; i += 1) {
    const x = ((i - src.config.minY) / Math.max(1, src.config.maxY - src.config.minY)) * ui.histogram.width;
    const h = (bins[i] / maxBin) * (ui.histogram.height - 16);
    histCtx.fillStyle = i < src.config.seaLevel ? '#3c78d8' : '#7fd38f';
    histCtx.fillRect(x, ui.histogram.height - h, Math.max(1, ui.histogram.width / 256), h);
  }
}

function updateImpactNote() {
  const size = Number(ui.mapSize.value);
  const quality = ui.qualityMode.value;
  const coast = ui.coastStyle.value;
  const world = WORLD_PRESETS[ui.worldType.value];

  const notes = [world.description];
  if (quality === 'high') notes.push('Haute qualité : plus lent, mais meilleur relief.');
  if (size === 4096) notes.push('4096 : très lourd, recommandé uniquement pour export final.');
  if (coast === 'rocky') notes.push('Côtes rocheuses : plus de falaises, moins de plages.');

  ui.impactNote.textContent = notes.join(' · ');
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
    const cfg = collectSettings(1);
    if (state.full && state.full.width === cfg.targetWidth && state.full.config.seed === cfg.seed && state.full.config.quality === cfg.quality) {
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
    preset: WORLD_PRESETS[ui.worldType.value].label,
    simple: {
      mapSize: ui.mapSize.value,
      worldType: ui.worldType.value,
      reliefStyle: ui.reliefStyle.value,
      waterAmount: ui.waterAmount.value,
      coastStyle: ui.coastStyle.value,
      riversLevel: ui.riversLevel.value,
      quality: ui.qualityMode.value
    },
    config: full.config,
    mapping: {
      minY,
      maxY,
      minecraftMinY: MC_MIN_Y,
      minecraftMaxY: MC_MAX_Y,
      seaLevel: full.config.seaLevel,
      seaGray8: minecraftYToGray(full.config.seaLevel, 8),
      seaGray16: minecraftYToGray(full.config.seaLevel, 16),
      formula: 'gray = ((terrainY - minecraftMinY) / (minecraftMaxY - minecraftMinY)) * 255'
    }
  };
  downloadBlob('heightmap_export.json', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

function bindSimpleInteractions() {
  ['mapSize', 'worldType', 'reliefStyle', 'waterAmount', 'coastStyle', 'riversLevel', 'qualityMode'].forEach((key) => {
    ui[key].addEventListener('change', () => {
      const derived = deriveConfigFromSimple();
      syncAdvancedInputs(derived);
      updateImpactNote();
      state.full = null;
      setManualGuidance();
    });
  });

  ui.seed.addEventListener('change', () => {
    state.full = null;
    setManualGuidance();
  });

  ui.generate.addEventListener('click', () => {
    state.full = null;
    launchGeneration('full', 1);
  });

  ui.quickPreview.addEventListener('click', () => {
    state.full = null;
    const scale = previewScaleFor(Number(ui.mapSize.value));
    launchGeneration('preview', scale);
  });

  ui.randomSeed.addEventListener('click', () => {
    randomSeed();
    state.full = null;
    setManualGuidance();
  });

  ui.newSeed.addEventListener('click', () => {
    randomSeed();
    state.full = null;
    setManualGuidance();
  });

  ['sea-level', 'min-y', 'max-y', 'erosion-strength', 'mountain-scale', 'river-depth', 'coastline-complexity', 'quantization', 'cleanup-strength'].forEach((id) => {
    const el = $(id);
    el.addEventListener('input', () => {
      bindAdvancedValue(id, id === 'sea-level' ? `Y${el.value}` : null);
      state.full = null;
      setManualGuidance();
    });
  });
}

ui.previewMode.addEventListener('change', renderPreview);
ui.showGrid.addEventListener('change', renderPreview);
ui.zoom.addEventListener('input', () => { ui.canvas.style.transform = `scale(${ui.zoom.value})`; });
ui.downloadPng.addEventListener('click', exportPng);
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

fillWorldTypeOptions();
Object.entries(DEFAULT_SIMPLE).forEach(([k, v]) => {
  const id = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const el = $(id);
  if (el) el.value = v;
});
const derived = deriveConfigFromSimple();
syncAdvancedInputs(derived);
bindSimpleInteractions();
updateImpactNote();
setManualGuidance();
