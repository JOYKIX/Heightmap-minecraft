export const MINECRAFT_HEIGHT = Object.freeze({
  minY: -64,
  maxY: 320,
  seaLevel: 63,
  surfaceMinY: 20,
  surfaceMaxY: 260
});

export const WORLD_TYPES = Object.freeze({
  'ile-pokemon': { label: 'Île Pokémon', shape: 'compact', landCoverage: 0.62 },
  'ile-realiste': { label: 'Île réaliste', shape: 'compact', landCoverage: 0.5 },
  archipel: { label: 'Archipel', shape: 'fragmented', landCoverage: 0.36 },
  'grande-ile-rpg': { label: 'Grande île RPG', shape: 'elongated', landCoverage: 0.58 },
  'continent-cotier': { label: 'Continent côtier', shape: 'continental', landCoverage: 0.75 }
});

export const QUALITY_PROFILE = Object.freeze({
  fast: { noiseOctaves: 3, erosionPasses: 1, riverDensity: 0.5 },
  balanced: { noiseOctaves: 4, erosionPasses: 2, riverDensity: 1 },
  high: { noiseOctaves: 5, erosionPasses: 3, riverDensity: 1.35 },
  extreme: { noiseOctaves: 6, erosionPasses: 5, riverDensity: 1.8 }
});
