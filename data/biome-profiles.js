const biome = (overrides) => ({
  enabled: true,
  targetPercent: 0,
  minY: 62,
  maxY: 120,
  preferredY: 85,
  roughness: 0.4,
  flatness: 0.5,
  moistureAffinity: 0.5,
  temperatureAffinity: 0.5,
  coastAffinity: 0.3,
  mountainAffinity: 0.3,
  riverAffinity: 0.3,
  erosionStrength: 0.35,
  transitionSoftness: 0.55,
  regionSize: 0.5,
  reliefIntensity: 0.5,
  ...overrides
});

export const BIOME_PROFILES = {
  ocean: biome({ id: 'ocean', name: 'Océan', targetPercent: 35, minY: 20, maxY: 63, preferredY: 43, roughness: 0.08, flatness: 0.95, moistureAffinity: 1, temperatureAffinity: 0.5, coastAffinity: 1, mountainAffinity: 0, riverAffinity: 0, erosionStrength: 0.08, transitionSoftness: 0.75, regionSize: 1, reliefIntensity: 0.2 }),
  coast: biome({ id: 'coast', name: 'Côte', targetPercent: 8, minY: 62, maxY: 71, preferredY: 66, roughness: 0.22, flatness: 0.76, moistureAffinity: 0.7, temperatureAffinity: 0.5, coastAffinity: 1, mountainAffinity: 0.1, riverAffinity: 0.7, erosionStrength: 0.28, transitionSoftness: 0.8, regionSize: 0.7, reliefIntensity: 0.35 }),
  plains: biome({ id: 'plains', name: 'Plaines', targetPercent: 18, minY: 70, maxY: 95, preferredY: 82, roughness: 0.18, flatness: 0.92, moistureAffinity: 0.5, temperatureAffinity: 0.56, coastAffinity: 0.5, mountainAffinity: 0.2, riverAffinity: 0.5, erosionStrength: 0.25, transitionSoftness: 0.75, regionSize: 0.82, reliefIntensity: 0.2 }),
  hills: biome({ id: 'hills', name: 'Collines', targetPercent: 10, minY: 85, maxY: 120, preferredY: 102, roughness: 0.5, flatness: 0.35, moistureAffinity: 0.52, temperatureAffinity: 0.52, coastAffinity: 0.24, mountainAffinity: 0.45, riverAffinity: 0.5, erosionStrength: 0.42, transitionSoftness: 0.58, regionSize: 0.6, reliefIntensity: 0.48 }),
  forest: biome({ id: 'forest', name: 'Forêt', targetPercent: 12, minY: 70, maxY: 110, preferredY: 90, roughness: 0.3, flatness: 0.65, moistureAffinity: 0.72, temperatureAffinity: 0.5, coastAffinity: 0.25, mountainAffinity: 0.25, riverAffinity: 0.62, erosionStrength: 0.38, transitionSoftness: 0.7, regionSize: 0.68, reliefIntensity: 0.35 }),
  jungle: biome({ id: 'jungle', name: 'Jungle', targetPercent: 6, minY: 70, maxY: 120, preferredY: 95, roughness: 0.4, flatness: 0.48, moistureAffinity: 0.96, temperatureAffinity: 0.82, coastAffinity: 0.35, mountainAffinity: 0.3, riverAffinity: 0.9, erosionStrength: 0.5, transitionSoftness: 0.66, regionSize: 0.55, reliefIntensity: 0.45 }),
  swamp: biome({ id: 'swamp', name: 'Marais', targetPercent: 5, minY: 62, maxY: 72, preferredY: 67, roughness: 0.1, flatness: 0.97, moistureAffinity: 0.96, temperatureAffinity: 0.62, coastAffinity: 0.62, mountainAffinity: 0.05, riverAffinity: 1, erosionStrength: 0.2, transitionSoftness: 0.83, regionSize: 0.5, reliefIntensity: 0.12 }),
  desert: biome({ id: 'desert', name: 'Désert', targetPercent: 7, minY: 65, maxY: 105, preferredY: 82, roughness: 0.2, flatness: 0.76, moistureAffinity: 0.08, temperatureAffinity: 0.9, coastAffinity: 0.15, mountainAffinity: 0.25, riverAffinity: 0.08, erosionStrength: 0.16, transitionSoftness: 0.54, regionSize: 0.72, reliefIntensity: 0.3 }),
  canyon: biome({ id: 'canyon', name: 'Canyon / Badlands', targetPercent: 5, minY: 70, maxY: 150, preferredY: 105, roughness: 0.72, flatness: 0.26, moistureAffinity: 0.12, temperatureAffinity: 0.72, coastAffinity: 0.08, mountainAffinity: 0.58, riverAffinity: 0.26, erosionStrength: 0.48, transitionSoftness: 0.42, regionSize: 0.45, reliefIntensity: 0.65 }),
  plateau: biome({ id: 'plateau', name: 'Plateaux', targetPercent: 8, minY: 110, maxY: 160, preferredY: 134, roughness: 0.35, flatness: 0.74, moistureAffinity: 0.32, temperatureAffinity: 0.55, coastAffinity: 0.1, mountainAffinity: 0.55, riverAffinity: 0.18, erosionStrength: 0.34, transitionSoftness: 0.52, regionSize: 0.6, reliefIntensity: 0.45 }),
  mountains: biome({ id: 'mountains', name: 'Montagnes', targetPercent: 10, minY: 130, maxY: 240, preferredY: 178, roughness: 0.86, flatness: 0.1, moistureAffinity: 0.45, temperatureAffinity: 0.42, coastAffinity: 0.05, mountainAffinity: 1, riverAffinity: 0.34, erosionStrength: 0.55, transitionSoftness: 0.45, regionSize: 0.7, reliefIntensity: 0.95 }),
  tundra: biome({ id: 'tundra', name: 'Toundra', targetPercent: 4, minY: 90, maxY: 170, preferredY: 128, roughness: 0.42, flatness: 0.48, moistureAffinity: 0.45, temperatureAffinity: 0.1, coastAffinity: 0.1, mountainAffinity: 0.55, riverAffinity: 0.25, erosionStrength: 0.34, transitionSoftness: 0.62, regionSize: 0.66, reliefIntensity: 0.42 })
};

export const BIOME_ORDER = ['plains', 'hills', 'forest', 'jungle', 'swamp', 'desert', 'canyon', 'plateau', 'mountains', 'tundra', 'coast', 'ocean'];

export function resolveBiomeProfiles(config = {}) {
  const overrides = config.biomes || {};
  const out = {};
  for (const [id, base] of Object.entries(BIOME_PROFILES)) {
    out[id] = { ...base, ...(overrides[id] || {}) };
  }
  return out;
}
