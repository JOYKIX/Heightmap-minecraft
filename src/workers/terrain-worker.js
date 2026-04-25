import { generateTerrain } from '../core/terrain-engine.js';

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (type !== 'generate') return;

  try {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Configuration absente ou invalide.');
    }
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
    const message = error instanceof Error ? error.message : 'Erreur inconnue du worker';
    // eslint-disable-next-line no-console
    console.error('[terrain-worker] error', error);
    self.postMessage({ type: 'error', payload: { message } });
  }
};
