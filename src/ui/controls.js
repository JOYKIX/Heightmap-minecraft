import { normalizeSettings } from '../config/terrain-settings.js';
import { buildBiomeMix } from '../config/presets.js';

function readSettingsFromDOM(state) {
  const settings = {
    ...state.settings,
    mapSize: Number(document.getElementById('map-size').value),
    worldType: document.getElementById('world-type').value,
    quality: document.getElementById('quality-mode').value,
    seed: document.getElementById('seed').value.trim(),
    biomePreset: document.getElementById('biome-preset').value,
    previewMode: document.getElementById('preview-mode').value,
    minY: Number(document.getElementById('min-y').value),
    maxY: Number(document.getElementById('max-y').value),
    riverIntensity: Number(document.getElementById('river-depth').value),
    erosionStrength: Number(document.getElementById('cleanup-strength').value),
    mountainScale: Number(document.getElementById('mountain-scale').value),
    debug: document.getElementById('quality-mode').value === 'extreme'
  };

  settings.biomeMix = buildBiomeMix(settings.biomePreset);
  return normalizeSettings(settings);
}

export function bindControls(state, actions) {
  document.getElementById('generate').addEventListener('click', () => {
    state.settings = readSettingsFromDOM(state);
    actions.generate();
  });

  document.getElementById('preview-mode').addEventListener('change', () => {
    state.settings.previewMode = document.getElementById('preview-mode').value;
    actions.refreshPreview();
  });

  document.getElementById('download-png').addEventListener('click', actions.downloadPng);

  document.getElementById('random-seed').addEventListener('click', () => {
    document.getElementById('seed').value = `map-${Date.now().toString(36)}`;
  });
}
