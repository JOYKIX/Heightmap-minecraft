import { BIOME_PRESETS } from './biome-profiles.js';

export const SIMPLE_DEFAULTS = Object.freeze({
  mapSize: 1024,
  worldType: 'ile-pokemon',
  quality: 'balanced',
  seed: 'minecraft-surface',
  biomePreset: 'balanced_pokemon',
  previewMode: 'grayscale',
  minY: 20,
  maxY: 260,
  riverIntensity: 0.55,
  erosionStrength: 0.5,
  mountainScale: 1.1
});

export function buildBiomeMix(presetId) {
  const preset = BIOME_PRESETS[presetId] ?? BIOME_PRESETS.balanced_pokemon;
  return Object.entries(preset.mix).map(([id, target]) => ({ id, target }));
}
