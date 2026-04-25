import { generateTerrain } from '../core/terrain-engine.js';

self.onmessage = (event) => {
  const { config } = event.data;
  const terrain = generateTerrain(config);
  self.postMessage({
    terrain: {
      ...terrain,
      yInt: terrain.yInt,
      grayscale: terrain.grayscale,
      landMask: terrain.landMask,
      biomeMap: terrain.biomeMap
    }
  });
};
