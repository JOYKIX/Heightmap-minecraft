export const appState = {
  route: 'home',
  toasts: [],
  settings: {
    minY: -64,
    seaLevel: 64,
    maxY: 320,
    oceanBorder: 'standard',
    resolution: 1024
  },
  procedural: {
    seed: 'island-001',
    landRatio: 0.42,
    includeArchipelago: true,
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
      ['Ocean Deep', -64, 20], ['Ocean', 20, 50], ['Shallow Water', 50, 63], ['Beach', 64, 70],
      ['Plains', 70, 105], ['Forest', 75, 115], ['Swamp', 62, 72], ['Savanna', 70, 105],
      ['Desert', 70, 110], ['Mesa/Canyon', 120, 190], ['Hills', 105, 135], ['Mountains', 170, 250],
      ['Snow/Alps', 220, 290], ['Peaks', 290, 320]
    ],
    result: null
  }
};
