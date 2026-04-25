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
  const minYCandidate = Number(raw.minY);
  const maxYCandidate = Number(raw.maxY);
  const minY = Number.isFinite(minYCandidate) ? minYCandidate : SIMPLE_DEFAULTS.minY;
  const maxY = Number.isFinite(maxYCandidate) ? maxYCandidate : SIMPLE_DEFAULTS.maxY;
  const worldPreset = WORLD_TYPES[raw.worldType] ?? WORLD_TYPES['ile-pokemon'];
  const riverIntensity = Number(raw.riverIntensity);
  const erosionStrength = Number(raw.erosionStrength);
  const mountainScale = Number(raw.mountainScale);

  return {
    ...raw,
    mapSize,
    worldType: raw.worldType in WORLD_TYPES ? raw.worldType : SIMPLE_DEFAULTS.worldType,
    quality: raw.quality ?? SIMPLE_DEFAULTS.quality,
    seed: raw.seed?.trim() || SIMPLE_DEFAULTS.seed,
    biomePreset: raw.biomePreset ?? SIMPLE_DEFAULTS.biomePreset,
    previewMode: raw.previewMode ?? SIMPLE_DEFAULTS.previewMode,
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
    riverIntensity: Number.isFinite(riverIntensity) ? riverIntensity : SIMPLE_DEFAULTS.riverIntensity,
    erosionStrength: Number.isFinite(erosionStrength) ? erosionStrength : SIMPLE_DEFAULTS.erosionStrength,
    mountainScale: Number.isFinite(mountainScale) ? mountainScale : SIMPLE_DEFAULTS.mountainScale,
    biomeMix: Array.isArray(raw.biomeMix) && raw.biomeMix.length > 0 ? raw.biomeMix : buildBiomeMix(raw.biomePreset),
    debug: Boolean(raw.debug)
  };
}
