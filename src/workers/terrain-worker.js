import { generateTerrain } from '../core/terrain-engine.js';

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (type !== 'generate') return;

  try {
    const terrain = generateTerrain(payload, (step, progress) => {
      self.postMessage({ type: 'progress', payload: { step, progress } });
    });

    self.postMessage({
      type: 'result',
      payload: {
        ...terrain,
        heightMap: Array.from(terrain.heightMap),
        biomeMap: Array.from(terrain.biomeMap),
        biomeCounts: Array.from(terrain.biomeCounts),
        riverMap: Array.from(terrain.riverMap)
      }
    });
  } catch (error) {
    self.postMessage({ type: 'error', payload: { message: error.message } });
  }
};
