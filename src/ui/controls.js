import { normalizeSettings } from '../config/terrain-settings.js';
import { buildBiomeMix } from '../config/presets.js';

function getValue(id, fallback = '') {
  const el = document.getElementById(id);
  if (!el) return fallback;
  return el.value ?? fallback;
}

function getNumberValue(id, fallback = 0) {
  const value = Number(getValue(id, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function readSettingsFromDOM(state) {
  const selectedWorldType = getValue('world-type', state.settings.worldType);
  const settings = {
    ...state.settings,
    mapSize: getNumberValue('map-size', state.settings.mapSize),
    worldType: selectedWorldType,
    quality: getValue('quality-mode', state.settings.quality),
    seed: String(getValue('seed', state.settings.seed)).trim(),
    biomePreset: getValue('biome-preset', state.settings.biomePreset),
    previewMode: getValue('preview-mode', state.settings.previewMode),
    minY: getNumberValue('min-y', state.settings.minY),
    maxY: getNumberValue('max-y', state.settings.maxY),
    riverIntensity: getNumberValue('river-depth', state.settings.riverIntensity),
    erosionStrength: getNumberValue('cleanup-strength', state.settings.erosionStrength),
    mountainScale: getNumberValue('mountain-scale', state.settings.mountainScale),
    oceanBorder: getValue('ocean-border', state.settings.oceanBorder ?? 'standard'),
    oceanDepth: getValue('ocean-depth', state.settings.oceanDepth ?? 'medium'),
    coastStyle: getValue('coast-style', state.settings.coastStyle ?? 'mixed'),
    riversLevel: getValue('rivers-level', state.settings.riversLevel ?? 'few'),
    reliefStyle: getValue('relief-style', state.settings.reliefStyle ?? 'playable'),
    landCoveragePreset: getValue('land-coverage', state.settings.landCoveragePreset ?? 'medium'),
    debug: getValue('quality-mode', state.settings.quality) === 'extreme'
  };

  settings.biomeMix = buildBiomeMix(settings.biomePreset);
  return normalizeSettings(settings);
}

export function bindControls(state, actions) {
  document.getElementById('generate')?.addEventListener('click', () => {
    state.settings = readSettingsFromDOM(state);
    actions.generate();
  });

  document.getElementById('preview-mode')?.addEventListener('change', () => {
    state.settings.previewMode = getValue('preview-mode', state.settings.previewMode);
    actions.refreshPreview();
  });

  document.getElementById('quick-preview')?.addEventListener('click', actions.refreshPreview);
  document.getElementById('download-png')?.addEventListener('click', actions.downloadPng);
  document.getElementById('download-json')?.addEventListener('click', actions.downloadJson);

  const randomizeSeed = () => {
    const seedInput = document.getElementById('seed');
    if (seedInput) seedInput.value = `map-${Date.now().toString(36)}`;
  };

  document.getElementById('random-seed')?.addEventListener('click', randomizeSeed);
  document.getElementById('new-seed')?.addEventListener('click', randomizeSeed);

  document.getElementById('biome-rebalance')?.addEventListener('click', () => {
    const nextPreset = getValue('biome-preset', state.settings.biomePreset);
    state.settings.biomePreset = nextPreset;
    state.settings.biomeMix = buildBiomeMix(nextPreset);
  });

  document.getElementById('biome-random')?.addEventListener('click', () => {
    const presetSelect = document.getElementById('biome-preset');
    if (!presetSelect || !presetSelect.options.length) return;
    const randomIndex = Math.floor(Math.random() * presetSelect.options.length);
    presetSelect.selectedIndex = randomIndex;
    state.settings.biomePreset = presetSelect.value;
    state.settings.biomeMix = buildBiomeMix(presetSelect.value);
  });
}
