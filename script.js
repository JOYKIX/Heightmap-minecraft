const $ = (id) => document.getElementById(id);

const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const BIOME_DATA = globalThis.BIOME_SYSTEM;

const DEFAULT_SIMPLE = {
  mapSize: '1024',
  worldType: 'ile-pokemon',
  landCoverage: 'medium',
  oceanBorder: 'standard',
  reliefStyle: 'playable',
  oceanDepth: 'medium',
  coastStyle: 'mixed',
  riversLevel: 'few',
  quality: 'balanced'
};

const ui = {
  mapSize: $('map-size'),
  worldType: $('world-type'),
  landCoverage: $('land-coverage'),
  oceanBorder: $('ocean-border'),
  reliefStyle: $('relief-style'),
  oceanDepth: $('ocean-depth'),
  coastStyle: $('coast-style'),
  riversLevel: $('rivers-level'),
  qualityMode: $('quality-mode'),
  biomePreset: $('biome-preset'),
  biomeList: $('biome-list'),
  biomeAdvancedList: $('biome-advanced-list'),
  biomeTotal: $('biome-total'),
  biomeRebalance: $('biome-rebalance'),
  biomeRandom: $('biome-random'),
  biomeTransitionWidth: $('biome-transition-width'),
  seed: $('seed'),
  randomSeed: $('random-seed'),
  newSeed: $('new-seed'),
  generate: $('generate'),
  quickPreview: $('quick-preview'),
  quickPreviewBadge: $('quick-preview-badge'),
  impactNote: $('impact-note'),

  minY: $('min-y'),
  maxY: $('max-y'),
  mountainScale: $('mountain-scale'),
  riverDepth: $('river-depth'),
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
  biomeResults: $('biome-results'),
  configSummary: $('config-summary'),
  worldPainterCompatibility: $('wp-compatibility'),
  viewport: $('viewport')
};

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

const RELIEF_PROFILE = {
  'very-flat': { reliefInterior: 0.35, mountainAmount: 0.25, mountainHeight: 38, playableFlatBias: 0.88 },
  playable: { reliefInterior: 0.55, mountainAmount: 0.42, mountainHeight: 62, playableFlatBias: 0.72 },
  varied: { reliefInterior: 0.72, mountainAmount: 0.55, mountainHeight: 84, playableFlatBias: 0.58 },
  mountainous: { reliefInterior: 0.86, mountainAmount: 0.72, mountainHeight: 104, playableFlatBias: 0.42 },
  extreme: { reliefInterior: 1.0, mountainAmount: 0.9, mountainHeight: 132, playableFlatBias: 0.25 }
};

const OCEAN_DEPTH_PROFILE = {
  shallow: { oceanFloorMin: 44, oceanDepthNoise: 8, shelfWidthCells: 10 },
  medium: { oceanFloorMin: 35, oceanDepthNoise: 12, shelfWidthCells: 15 },
  deep: { oceanFloorMin: 25, oceanDepthNoise: 17, shelfWidthCells: 20 }
};

const COAST_PROFILE = {
  soft: { beachWidthCells: 5, coastCliffBoost: 0, coastComplexity: 0.08, coastSharpness: 0.2 },
  mixed: { beachWidthCells: 3, coastCliffBoost: 2, coastComplexity: 0.14, coastSharpness: 0.5 },
  rocky: { beachWidthCells: 2, coastCliffBoost: 4, coastComplexity: 0.2, coastSharpness: 0.85 },
  cliff: { beachWidthCells: 1, coastCliffBoost: 7, coastComplexity: 0.22, coastSharpness: 1 }
};

const RIVER_PROFILE = {
  none: { riverAmountDensity: 0, riverWidth: 1, riverDepth: 0 },
  few: { riverAmountDensity: 0.00002, riverWidth: 1, riverDepth: 1.5 },
  medium: { riverAmountDensity: 0.00004, riverWidth: 2, riverDepth: 2.4 },
  many: { riverAmountDensity: 0.00006, riverWidth: 3, riverDepth: 3.2 }
};

const WORLD_PRESETS = {
  'ile-pokemon': { label: 'Île Pokémon', landCoverage: 'high', oceanBorder: 'standard', reliefStyle: 'varied', coastStyle: 'mixed', riversLevel: 'few', shape: 'compact', secondaryIslands: 2 },
  'ile-realiste': { label: 'Île réaliste', landCoverage: 'medium', oceanBorder: 'wide', reliefStyle: 'varied', coastStyle: 'mixed', riversLevel: 'medium', shape: 'compact', secondaryIslands: 3 },
  archipel: { label: 'Archipel', landCoverage: 'low', oceanBorder: 'standard', reliefStyle: 'playable', coastStyle: 'soft', riversLevel: 'few', shape: 'fragmented', secondaryIslands: 7 },
  'grande-ile-rpg': { label: 'Grande île RPG', landCoverage: 'high', oceanBorder: 'near', reliefStyle: 'varied', coastStyle: 'mixed', riversLevel: 'medium', shape: 'elongated', secondaryIslands: 2 },
  'continent-cotier': { label: 'Continent côtier', landCoverage: 'very-high', oceanBorder: 'near', reliefStyle: 'mountainous', coastStyle: 'rocky', riversLevel: 'many', shape: 'continental', secondaryIslands: 1 }
};

const SHAPE_PROFILE = {
  compact: { mainIslandRadius: 0.58, shapeElongation: { x: 1, y: 1 }, domainWarp: 0.14 },
  elongated: { mainIslandRadius: 0.6, shapeElongation: { x: 1.22, y: 0.84 }, domainWarp: 0.15 },
  fragmented: { mainIslandRadius: 0.66, shapeElongation: { x: 1.06, y: 0.9 }, domainWarp: 0.22 },
  archipelago: { mainIslandRadius: 0.7, shapeElongation: { x: 1.08, y: 0.92 }, domainWarp: 0.25 },
  continental: { mainIslandRadius: 0.78, shapeElongation: { x: 1.28, y: 0.78 }, domainWarp: 0.1 }
};

const QUALITY_LABEL = { fast: 'Rapide', balanced: 'Équilibrée', high: 'Haute qualité' };
const ctx = ui.canvas.getContext('2d', { willReadFrequently: true });
const histCtx = ui.histogram.getContext('2d');
const worker = new Worker('terrain-worker.js');
let pendingJob = null;
const state = { preview: null, full: null, config: null, biomeMix: [] };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function minecraftYToGray(y, bitDepth = 8) {
  const t = clamp((y - MC_MIN_Y) / Math.max(1, MC_MAX_Y - MC_MIN_Y), 0, 1);
  return Math.round(t * (bitDepth === 16 ? 65535 : 255));
}

function setProgress(step, pct) {
  ui.pipelineStep.textContent = step;
  ui.progress.style.width = `${Math.round(pct * 100)}%`;
}

function setManualGuidance(message = 'Modifiez vos paramètres puis cliquez sur Générer') {
  ui.pipelineStep.textContent = message;
  ui.progress.style.width = '0%';
}

function randomSeed() {
  const token = Math.random().toString(36).slice(2, 8);
  ui.seed.value = `map-${Date.now().toString(36)}-${token}`;
}

function fillWorldTypeOptions() {
  Object.entries(WORLD_PRESETS).forEach(([value, preset]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = preset.label;
    ui.worldType.appendChild(opt);
  });
}

function fillBiomePresetOptions() {
  Object.entries(BIOME_DATA.BIOME_PRESETS).forEach(([value, preset]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = preset.label;
    ui.biomePreset.appendChild(opt);
  });
  ui.biomePreset.value = 'balanced_pokemon';
}

function applyPresetToSimple(id) {
  const preset = WORLD_PRESETS[id];
  if (!preset) return;
  ui.landCoverage.value = preset.landCoverage;
  ui.oceanBorder.value = preset.oceanBorder;
  ui.reliefStyle.value = preset.reliefStyle;
  ui.coastStyle.value = preset.coastStyle;
  ui.riversLevel.value = preset.riversLevel;
}

function loadBiomePreset(id) {
  const preset = BIOME_DATA.BIOME_PRESETS[id];
  if (!preset) return;
  state.biomeMix = BIOME_DATA.BIOME_PROFILES.map((profile) => {
    const target = preset.mix[profile.id] ?? profile.targetPercent;
    const enabled = profile.id === 'ocean' || profile.id === 'coast' ? true : target > 0;
    return {
      id: profile.id,
      enabled,
      targetPercent: target,
      locked: profile.id === 'ocean' || profile.id === 'coast',
      overrides: {
        minAltitude: profile.minAltitude,
        maxAltitude: profile.maxAltitude,
        roughness: profile.roughness,
        flatness: profile.flatness,
        riverAffinity: profile.riverAffinity,
        mountainInfluence: profile.mountainInfluence,
        coastAffinity: profile.coastAffinity,
        erosionStrength: profile.erosionStrength
      }
    };
  });
  normalizeBiomeMix();
  renderBiomeEditor();
}

function normalizeBiomeMix() {
  const lands = state.biomeMix.filter((b) => b.id !== 'ocean' && b.id !== 'coast' && b.enabled);
  const total = lands.reduce((sum, b) => sum + Number(b.targetPercent || 0), 0);
  if (total <= 0) {
    const defaultPlains = lands.find((b) => b.id === 'plains') || lands[0];
    if (defaultPlains) defaultPlains.targetPercent = 100;
  } else {
    lands.forEach((b) => { b.targetPercent = (Number(b.targetPercent || 0) / total) * 100; });
  }
}

function randomizeBiomeMix() {
  const editable = state.biomeMix.filter((b) => !b.locked && b.id !== 'ocean' && b.id !== 'coast' && b.enabled);
  if (!editable.length) return;
  let total = 0;
  editable.forEach((b) => {
    b.targetPercent = Math.random() * 100;
    total += b.targetPercent;
  });
  editable.forEach((b) => { b.targetPercent = (b.targetPercent / total) * 100; });
  renderBiomeEditor();
  setManualGuidance();
}

function renderBiomeEditor() {
  ui.biomeList.innerHTML = '';
  ui.biomeAdvancedList.innerHTML = '';

  state.biomeMix.forEach((entry) => {
    const profile = BIOME_DATA.BIOME_PROFILES.find((p) => p.id === entry.id);
    const item = document.createElement('div');
    item.className = 'biome-item';
    item.innerHTML = `
      <div class="top">
        <input data-action="enabled" data-id="${entry.id}" type="checkbox" ${entry.enabled ? 'checked' : ''} ${entry.locked ? 'disabled' : ''} />
        <span><span class="dot" style="display:inline-block;background:${profile.color}"></span> ${profile.name}</span>
        <label class="check"><input data-action="locked" data-id="${entry.id}" type="checkbox" ${entry.locked ? 'checked' : ''} ${entry.id === 'ocean' || entry.id === 'coast' ? 'disabled' : ''}/>Lock</label>
      </div>
      <div class="pct-row">
        <input data-action="range" data-id="${entry.id}" type="range" min="0" max="100" step="0.1" value="${entry.targetPercent.toFixed(2)}" ${entry.enabled ? '' : 'disabled'} ${entry.locked ? 'disabled' : ''}/>
        <input data-action="percent" data-id="${entry.id}" type="number" min="0" max="100" step="0.1" value="${entry.targetPercent.toFixed(1)}" ${entry.enabled ? '' : 'disabled'} ${entry.locked ? 'disabled' : ''}/>
        <span>%</span>
      </div>`;
    ui.biomeList.appendChild(item);

    if (entry.id === 'ocean' || entry.id === 'coast') return;
    const adv = document.createElement('div');
    adv.className = 'biome-advanced-item';
    adv.innerHTML = `<strong>${profile.name}</strong>
      <div class="biome-advanced-grid">
        <label>Min Y<input data-adv="minAltitude" data-id="${entry.id}" type="number" value="${entry.overrides.minAltitude}"/></label>
        <label>Max Y<input data-adv="maxAltitude" data-id="${entry.id}" type="number" value="${entry.overrides.maxAltitude}"/></label>
        <label>Rough<input data-adv="roughness" data-id="${entry.id}" type="number" step="0.01" min="0" max="1" value="${entry.overrides.roughness}"/></label>
        <label>Flat<input data-adv="flatness" data-id="${entry.id}" type="number" step="0.01" min="0" max="1" value="${entry.overrides.flatness}"/></label>
        <label>River<input data-adv="riverAffinity" data-id="${entry.id}" type="number" step="0.01" min="0" max="1" value="${entry.overrides.riverAffinity}"/></label>
        <label>Montagne<input data-adv="mountainInfluence" data-id="${entry.id}" type="number" step="0.01" min="0" max="1" value="${entry.overrides.mountainInfluence}"/></label>
        <label>Côte<input data-adv="coastAffinity" data-id="${entry.id}" type="number" step="0.01" min="0" max="1" value="${entry.overrides.coastAffinity}"/></label>
        <label>Erosion<input data-adv="erosionStrength" data-id="${entry.id}" type="number" step="0.01" min="0" max="1" value="${entry.overrides.erosionStrength}"/></label>
      </div>`;
    ui.biomeAdvancedList.appendChild(adv);
  });

  const total = state.biomeMix
    .filter((b) => b.enabled && b.id !== 'ocean' && b.id !== 'coast')
    .reduce((sum, b) => sum + Number(b.targetPercent), 0);
  ui.biomeTotal.textContent = `Total biomes terrestres : ${total.toFixed(1)}%${Math.abs(total - 100) > 0.25 ? ' (warning: rééquilibrage conseillé)' : ''}`;
  ui.biomeTotal.style.color = Math.abs(total - 100) > 0.25 ? 'var(--warning)' : 'var(--muted)';
}

function deriveConfigFromSimple() {
  const preset = WORLD_PRESETS[ui.worldType.value];
  const landCoverage = LAND_COVERAGE[ui.landCoverage.value];
  const oceanBorder = OCEAN_BORDER[ui.oceanBorder.value];
  const relief = RELIEF_PROFILE[ui.reliefStyle.value];
  const ocean = OCEAN_DEPTH_PROFILE[ui.oceanDepth.value];
  const coast = COAST_PROFILE[ui.coastStyle.value];
  const rivers = RIVER_PROFILE[ui.riversLevel.value];
  const shape = SHAPE_PROFILE[preset.shape] || SHAPE_PROFILE.compact;

  return {
    ...relief,
    ...ocean,
    ...coast,
    ...rivers,
    ...shape,
    landCoverage,
    oceanBorderNormalized: oceanBorder,
    secondaryIslands: preset.secondaryIslands,
    ridgeSharpness: 1.2 + Number(ui.mountainScale.value) * 1.2,
    minY: clamp(Number(ui.minY.value) || 20, -64, 240),
    maxY: clamp(Number(ui.maxY.value) || 260, 80, 320),
    biomeTransitionWidth: Number(ui.biomeTransitionWidth.value)
  };
}

function collectSettings(scale = 1) {
  const targetSize = Number(ui.mapSize.value);
  const dim = Math.max(256, Math.floor(targetSize * scale));
  const d = deriveConfigFromSimple();
  const biomeMix = state.biomeMix.map((entry) => ({
    ...entry,
    targetPercent: Number(entry.targetPercent || 0)
  }));

  return {
    width: dim,
    height: dim,
    targetWidth: targetSize,
    targetHeight: targetSize,
    seed: ui.seed.value.trim() || 'minecraft-surface',
    quality: ui.qualityMode.value,
    safeMode: true,
    biomeMix,
    biomePreset: ui.biomePreset.value,
    ...d,
    riverDepth: d.riverDepth + Number(ui.riverDepth.value)
  };
}

function previewScaleFor(size) {
  if (size >= 4096) return 0.2;
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
      biomeMap: new Uint8Array(data.biomeMap),
      image: new Uint8ClampedArray(data.image),
      config: data.config
    };

    state.preview = payload;
    if (data.phase === 'full') state.full = payload;

    ui.canvas.width = payload.width;
    ui.canvas.height = payload.height;
    renderPreview();
    renderStats(payload);
    renderHistogram(payload);
    renderSummary(payload.config);
    renderWorldPainter(payload.config);
    setProgress(`${data.phase === 'full' ? 'Génération finale' : 'Preview'} prête (${payload.width}x${payload.height})`, 1);
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
    const palette = src.config.generationStats?.biomePalette || {};
    for (let i = 0; i < src.heights.length; i += 1) {
      const h = src.heights[i];
      const s = clamp(Math.round(src.slope[i] * 8), 0, 255);
      const o = i * 4;
      if (mode === 'hillshade') {
        const shade = clamp(180 + (h - 64) * 0.7 - src.slope[i] * 1.6, 12, 245);
        out[o] = shade; out[o + 1] = shade; out[o + 2] = shade;
      } else if (mode === 'slope-preview') {
        out[o] = s; out[o + 1] = 90; out[o + 2] = 255 - s;
      } else if (mode === 'contour-preview') {
        const g = minecraftYToGray(h, 8);
        const contour = h % 8 === 0 || h % 16 === 0;
        out[o] = contour ? 255 : g;
        out[o + 1] = contour ? 230 : g;
        out[o + 2] = contour ? 120 : g;
      } else if (mode === 'biome-map') {
        const color = palette[src.biomeMap[i]] || '#808080';
        out[o] = Number.parseInt(color.slice(1, 3), 16);
        out[o + 1] = Number.parseInt(color.slice(3, 5), 16);
        out[o + 2] = Number.parseInt(color.slice(5, 7), 16);
      } else {
        const t = clamp((h - src.config.minY) / Math.max(1, src.config.maxY - src.config.minY), 0, 1);
        out[o] = clamp(Math.round(255 * (1.6 * t)), 0, 255);
        out[o + 1] = clamp(Math.round(255 * (1.4 - Math.abs(t - 0.5) * 2)), 0, 255);
        out[o + 2] = clamp(Math.round(255 * (1.25 - 1.8 * t)), 0, 255);
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
  const st = src.config.generationStats || {};
  const rows = [
    `Résolution preview: ${src.width}x${src.height} (cible ${src.config.targetWidth}x${src.config.targetHeight})`,
    `Terre cible : ${(st.targetLandPct || 0).toFixed(1)}%`,
    `Terre réelle : ${(st.realLandPct || 0).toFixed(1)}%`,
    `Océan réel : ${(st.realOceanPct || 0).toFixed(1)}%`,
    `Sea level : Y${st.seaLevel || 64}`,
    `Altitude min/max : Y${st.minY ?? src.config.minY} → Y${st.maxY ?? src.config.maxY}`,
    `Nombre d'îles : ${st.islandCount || 1}`,
    `Nombre de rivières : ${st.riverCount || 0}`,
    `Régions biomes : ${st.biomeRegionCount || 0}`,
    `Micro-îles supprimées : ${st.removedMicroIslands || 0}`
  ];

  ui.stats.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.stats.appendChild(li);
  });

  ui.biomeResults.innerHTML = '';
  (st.biomeDistribution || []).forEach((b) => {
    const li = document.createElement('li');
    li.textContent = `${b.name} : cible ${b.target.toFixed(1)}% · réel ${b.real.toFixed(1)}%`;
    ui.biomeResults.appendChild(li);
  });
}

function renderSummary(cfg) {
  const rows = [
    `Type : ${WORLD_PRESETS[ui.worldType.value].label}`,
    `Preset biomes : ${BIOME_DATA.BIOME_PRESETS[ui.biomePreset.value]?.label || ui.biomePreset.value}`,
    `Land coverage : ${ui.landCoverage.options[ui.landCoverage.selectedIndex].text}`,
    `Marge océanique : ${ui.oceanBorder.options[ui.oceanBorder.selectedIndex].text}`,
    `Relief : ${ui.reliefStyle.options[ui.reliefStyle.selectedIndex].text}`,
    `Océan : ${ui.oceanDepth.options[ui.oceanDepth.selectedIndex].text}`,
    `Côtes : ${ui.coastStyle.options[ui.coastStyle.selectedIndex].text}`,
    `Rivières : ${ui.riversLevel.options[ui.riversLevel.selectedIndex].text}`,
    `Qualité : ${QUALITY_LABEL[cfg.quality] || cfg.quality}`
  ];

  ui.configSummary.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.configSummary.appendChild(li);
  });
}

function renderWorldPainter(cfg) {
  const tips = cfg.generationStats?.worldPainterTips;
  const rows = [
    'Compatibilité WorldPainter : Oui (profil WorldPainter Safe)',
    `Low mapping : ${tips?.lowMapping || `0 → Y${cfg.minY}`}`,
    `Water level : ${tips?.waterLevel || 'Y64'}`,
    `High mapping : ${tips?.highMapping || `255 → Y${cfg.maxY}`}`,
    `Build limit : ${tips?.buildLimit || '-64 / 319'}`
  ];

  ui.worldPainterCompatibility.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.worldPainterCompatibility.appendChild(li);
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
    histCtx.fillStyle = i < 64 ? '#3c78d8' : '#7fd38f';
    histCtx.fillRect(x, ui.histogram.height - h, Math.max(1, ui.histogram.width / 256), h);
  }
}

function updateImpactNote() {
  const preset = WORLD_PRESETS[ui.worldType.value];
  ui.impactNote.textContent = `${preset.label} · Terre cible ${Math.round(LAND_COVERAGE[ui.landCoverage.value] * 100)}% · Marge océanique ${ui.oceanBorder.options[ui.oceanBorder.selectedIndex].text}`;
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

  const off = document.createElement('canvas');
  off.width = full.width;
  off.height = full.height;
  off.getContext('2d').putImageData(new ImageData(image, full.width, full.height), 0, 0);

  const a = document.createElement('a');
  a.download = `${filenameBase(full.config)}.png`;
  a.href = off.toDataURL('image/png');
  a.click();
}

async function exportPresetJson() {
  if (!state.preview) return;
  const full = await awaitFullResolution();
  const payload = {
    generatedAt: new Date().toISOString(),
    preset: WORLD_PRESETS[ui.worldType.value].label,
    biomePreset: BIOME_DATA.BIOME_PRESETS[ui.biomePreset.value]?.label,
    simple: {
      mapSize: ui.mapSize.value,
      worldType: ui.worldType.value,
      landCoverage: ui.landCoverage.value,
      oceanBorder: ui.oceanBorder.value,
      reliefStyle: ui.reliefStyle.value,
      oceanDepth: ui.oceanDepth.value,
      coastStyle: ui.coastStyle.value,
      riversLevel: ui.riversLevel.value,
      quality: ui.qualityMode.value
    },
    biomeMix: state.biomeMix,
    config: full.config,
    worldPainter: full.config.generationStats?.worldPainterTips
  };
  downloadBlob('heightmap_export.json', new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

function bindSimpleInteractions() {
  ['mapSize', 'worldType', 'landCoverage', 'oceanBorder', 'reliefStyle', 'oceanDepth', 'coastStyle', 'riversLevel', 'qualityMode'].forEach((key) => {
    ui[key].addEventListener('change', () => {
      if (key === 'worldType') applyPresetToSimple(ui.worldType.value);
      updateImpactNote();
      state.full = null;
      setManualGuidance();
    });
  });

  ui.biomePreset.addEventListener('change', () => {
    loadBiomePreset(ui.biomePreset.value);
    state.full = null;
    setManualGuidance();
  });

  ui.biomeRebalance.addEventListener('click', () => {
    normalizeBiomeMix();
    renderBiomeEditor();
    state.full = null;
    setManualGuidance();
  });
  ui.biomeRandom.addEventListener('click', randomizeBiomeMix);

  ui.biomeList.addEventListener('input', (event) => {
    const target = event.target;
    const id = target.dataset.id;
    if (!id) return;
    const entry = state.biomeMix.find((b) => b.id === id);
    if (!entry) return;
    if (target.dataset.action === 'enabled') entry.enabled = target.checked;
    if (target.dataset.action === 'locked') entry.locked = target.checked;
    if (target.dataset.action === 'percent' || target.dataset.action === 'range') {
      entry.targetPercent = clamp(Number(target.value), 0, 100);
    }
    renderBiomeEditor();
    state.full = null;
    setManualGuidance();
  });

  ui.biomeAdvancedList.addEventListener('input', (event) => {
    const target = event.target;
    const id = target.dataset.id;
    const field = target.dataset.adv;
    if (!id || !field) return;
    const entry = state.biomeMix.find((b) => b.id === id);
    if (!entry) return;
    entry.overrides[field] = Number(target.value);
    state.full = null;
    setManualGuidance();
  });

  ui.biomeTransitionWidth.addEventListener('input', () => { state.full = null; setManualGuidance(); });

  ui.seed.addEventListener('change', () => { state.full = null; setManualGuidance(); });
  ui.generate.addEventListener('click', () => { state.full = null; launchGeneration('full', 1); });
  ui.quickPreview.addEventListener('click', () => { state.full = null; launchGeneration('preview', previewScaleFor(Number(ui.mapSize.value))); });
  ui.randomSeed.addEventListener('click', () => { randomSeed(); state.full = null; setManualGuidance(); });
  ui.newSeed.addEventListener('click', () => { randomSeed(); state.full = null; setManualGuidance(); });

  ['min-y', 'max-y', 'mountain-scale', 'river-depth', 'cleanup-strength'].forEach((id) => {
    $(id).addEventListener('input', () => { state.full = null; setManualGuidance(); });
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
fillBiomePresetOptions();
Object.entries(DEFAULT_SIMPLE).forEach(([k, v]) => {
  const id = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  const el = $(id);
  if (el) el.value = v;
});
applyPresetToSimple(ui.worldType.value);
loadBiomePreset(ui.biomePreset.value);
bindSimpleInteractions();
updateImpactNote();
setManualGuidance();
