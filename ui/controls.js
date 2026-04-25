import { BIOME_ORDER, BIOME_PROFILES } from '../data/biome-profiles.js';

export function readConfigFromUi(baseConfig) {
  const seed = document.getElementById('seedInput').value || baseConfig.seed;
  const size = Number(document.getElementById('sizeSelect').value);
  const landCoverage = Number(document.getElementById('landCoverage').value);
  const border = document.getElementById('oceanBorder').value;
  const riverAmount = document.getElementById('riverAmount').value;
  const preset = document.getElementById('presetSelect').value;
  const biomeBlendStrength = Number(document.getElementById('biomeBlendStrength')?.value ?? 0.75);

  return {
    ...baseConfig,
    seed,
    width: size,
    height: size,
    landCoverage,
    oceanBorder: border,
    riverAmount,
    preset,
    biomeBlendStrength,
    biomes: readBiomesFromUi()
  };
}

function readBiomesFromUi() {
  const out = {};
  BIOME_ORDER.forEach((id) => {
    const base = BIOME_PROFILES[id];
    if (!base) return;
    const enabled = document.querySelector(`[data-biome-enabled="${id}"]`)?.checked ?? base.enabled;
    const targetPercent = Number(document.querySelector(`[data-biome-target="${id}"]`)?.value ?? base.targetPercent);
    const regionSize = Number(document.querySelector(`[data-biome-region="${id}"]`)?.value ?? base.regionSize);
    const transitionSoftness = Number(document.querySelector(`[data-biome-softness="${id}"]`)?.value ?? base.transitionSoftness);
    const reliefIntensity = Number(document.querySelector(`[data-biome-relief="${id}"]`)?.value ?? base.reliefIntensity);
    out[id] = { enabled, targetPercent, regionSize, transitionSoftness, reliefIntensity };
  });
  return out;
}

export function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

export function randomSeed() {
  const value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  document.getElementById('seedInput').value = value;
}
