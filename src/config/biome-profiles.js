export const BIOME_PROFILES = Object.freeze([
  { id: 'ocean', name: 'Océan', color: '#2f5f9b', preferredAltitude: 40, moistureRange: [0.5, 1], temperatureRange: [0, 1], roughness: 0.05 },
  { id: 'coast', name: 'Côte', color: '#f1dda4', preferredAltitude: 64, moistureRange: [0.4, 1], temperatureRange: [0.1, 1], roughness: 0.1 },
  { id: 'plains', name: 'Plaines', color: '#7ecb6f', preferredAltitude: 78, moistureRange: [0.35, 0.8], temperatureRange: [0.25, 0.85], roughness: 0.15 },
  { id: 'forest', name: 'Forêt', color: '#2f8b4b', preferredAltitude: 90, moistureRange: [0.45, 1], temperatureRange: [0.2, 0.75], roughness: 0.28 },
  { id: 'desert', name: 'Désert', color: '#e4c47a', preferredAltitude: 84, moistureRange: [0, 0.3], temperatureRange: [0.55, 1], roughness: 0.22 },
  { id: 'mountains', name: 'Montagnes', color: '#9aa3ad', preferredAltitude: 170, moistureRange: [0.2, 0.8], temperatureRange: [0, 0.6], roughness: 0.85 },
  { id: 'tundra', name: 'Toundra', color: '#bad9ee', preferredAltitude: 125, moistureRange: [0.2, 0.9], temperatureRange: [0, 0.25], roughness: 0.38 }
]);

export const BIOME_PRESETS = Object.freeze({
  balanced_pokemon: {
    label: 'Balanced Pokémon',
    mix: { ocean: 0, coast: 0, plains: 34, forest: 23, desert: 12, mountains: 21, tundra: 10 }
  },
  wet_world: {
    label: 'Monde humide',
    mix: { ocean: 0, coast: 0, plains: 20, forest: 42, desert: 3, mountains: 23, tundra: 12 }
  },
  dry_world: {
    label: 'Monde aride',
    mix: { ocean: 0, coast: 0, plains: 22, forest: 10, desert: 38, mountains: 20, tundra: 10 }
  }
});
