export const appState = {
  route: 'home',
  toasts: [],
  settings: {
    minY: -64,
    seaLevel: 64,
    maxY: 319,
    resolution: 1024
  },
  procedural: {
    seed: 'island-001',
    resolution: 1024,
    relief: 'ultra',
    islandSize: 'medium',
    style: 'ultra_realistic',
    result: null,
    stats: null
  },
  extend: {
    source: null,
    detected: null,
    paddingPct: 25,
    result: null
  },
  converter: {
    source: null,
    layers: [
      ['Océan profond', -64, 20],
      ['Océan', 20, 50],
      ['Hauts-fonds', 50, 63],
      ['Sea Level', 64, 64],
      ['Plages', 64, 70],
      ['Terres basses', 70, 90],
      ['Collines', 90, 120],
      ['Montagnes', 120, 220],
      ['Pics', 220, 319]
    ],
    result: null
  }
};
