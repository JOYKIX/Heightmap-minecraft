import { PRESETS } from '../data/presets.js';

export function populatePresets() {
  const select = document.getElementById('presetSelect');
  Object.keys(PRESETS).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  });
}

export function applyPresetToConfig(config, presetKey) {
  const preset = PRESETS[presetKey] || PRESETS.realistic_island;
  return { ...config, ...preset };
}

export function initPreviewModes() {
  const select = document.getElementById('previewMode');
  ['grayscale', 'biome', 'hillshade', 'heatmap'].forEach((mode) => {
    const opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode;
    select.appendChild(opt);
  });
}
