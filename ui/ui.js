import { PRESETS } from '../data/presets.js';
import { BIOME_ORDER, BIOME_PROFILES } from '../data/biome-profiles.js';

export function populatePresets() {
  const select = document.getElementById('presetSelect');
  Object.keys(PRESETS).forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  });
}

export function populateBiomeControls() {
  const host = document.getElementById('biomeControls');
  if (!host) return;
  host.innerHTML = '';

  BIOME_ORDER.forEach((id) => {
    const profile = BIOME_PROFILES[id];
    if (!profile) return;

    const row = document.createElement('div');
    row.className = 'biome-row';
    row.innerHTML = `
      <label><input type="checkbox" data-biome-enabled="${id}" ${profile.enabled !== false ? 'checked' : ''}/> ${profile.name}</label>
      <label>% <input type="number" data-biome-target="${id}" step="1" min="0" max="100" value="${profile.targetPercent}" /></label>
      <label>Taille <input type="number" data-biome-region="${id}" step="0.05" min="0.1" max="1" value="${profile.regionSize}" /></label>
      <label>Transition <input type="number" data-biome-softness="${id}" step="0.05" min="0" max="1" value="${profile.transitionSoftness}" /></label>
      <label>Relief <input type="number" data-biome-relief="${id}" step="0.05" min="0" max="1" value="${profile.reliefIntensity}" /></label>
    `;
    host.appendChild(row);
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
