import { MINECRAFT_HEIGHT, WORLD_TYPES } from './constants.js';
import { SIMPLE_DEFAULTS, buildBiomeMix } from './presets.js';

export function createDefaultSettings() {
  const preset = WORLD_TYPES[SIMPLE_DEFAULTS.worldType];
  return {
    ...SIMPLE_DEFAULTS,
    shape: preset.shape,
    landCoverage: preset.landCoverage,
    dimensions: { width: SIMPLE_DEFAULTS.mapSize, height: SIMPLE_DEFAULTS.mapSize },
    height: { ...MINECRAFT_HEIGHT, minY: SIMPLE_DEFAULTS.minY, maxY: SIMPLE_DEFAULTS.maxY },
    biomeMix: buildBiomeMix(SIMPLE_DEFAULTS.biomePreset),
    debug: false
  };
}

export function normalizeSettings(raw) {
  const mapSize = Number(raw.mapSize) || SIMPLE_DEFAULTS.mapSize;
  const minY = Number(raw.minY);
  const maxY = Number(raw.maxY);
  const worldPreset = WORLD_TYPES[raw.worldType] ?? WORLD_TYPES['ile-pokemon'];
  return {
    ...raw,
    mapSize,
    shape: worldPreset.shape,
    landCoverage: worldPreset.landCoverage,
    dimensions: { width: mapSize, height: mapSize },
    minY,
    maxY,
    height: {
      ...MINECRAFT_HEIGHT,
      minY,
      maxY
    },
    riverIntensity: Number(raw.riverIntensity),
    erosionStrength: Number(raw.erosionStrength),
    mountainScale: Number(raw.mountainScale),
    debug: Boolean(raw.debug)
  };
}
