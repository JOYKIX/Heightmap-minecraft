import { fbm2D } from './noise.js';
import { clamp } from '../js/utils.js';

export const BIOMES = {
  plains: { preferredY: 95, roughness: 0.18, moisture: 0.55, temperature: 0.55 },
  forest: { preferredY: 110, roughness: 0.24, moisture: 0.7, temperature: 0.5 },
  jungle: { preferredY: 125, roughness: 0.26, moisture: 0.9, temperature: 0.85 },
  swamp: { preferredY: 68, roughness: 0.08, moisture: 0.95, temperature: 0.7 },
  savanna: { preferredY: 98, roughness: 0.16, moisture: 0.35, temperature: 0.8 },
  desert: { preferredY: 104, roughness: 0.12, moisture: 0.12, temperature: 0.92 },
  mesa: { preferredY: 155, roughness: 0.3, moisture: 0.2, temperature: 0.7 },
  hills: { preferredY: 128, roughness: 0.35, moisture: 0.5, temperature: 0.5 },
  plateau: { preferredY: 150, roughness: 0.2, moisture: 0.35, temperature: 0.55 },
  mountains: { preferredY: 220, roughness: 0.52, moisture: 0.45, temperature: 0.3 },
  snow: { preferredY: 265, roughness: 0.45, moisture: 0.4, temperature: 0.08 },
  coast: { preferredY: 68, roughness: 0.1, moisture: 0.75, temperature: 0.6 },
  ocean: { preferredY: 30, roughness: 0.08, moisture: 1, temperature: 0.5 }
};

export function generateClimateMaps(width, height, seed) {
  const moisture = new Float32Array(width * height);
  const temperature = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width, ny = y / height;
      moisture[i] = fbm2D(nx * 4, ny * 4, 4, 2, 0.5, seed + 11);
      temperature[i] = clamp(1 - Math.abs(ny - 0.5) * 1.5 + (fbm2D(nx * 3, ny * 3, 3, 2, 0.5, seed + 12) - 0.5) * 0.3, 0, 1);
    }
  }
  return { moisture, temperature };
}

export function generateBiomeWeights(heightMap, landMask, climate, width, height) {
  const entries = Object.entries(BIOMES);
  const weights = Array.from({ length: width * height }, () => ({}));
  const biomeMap = new Array(width * height);
  for (let i = 0; i < width * height; i++) {
    if (!landMask[i]) {
      weights[i].ocean = 1;
      biomeMap[i] = 'ocean';
      continue;
    }
    const y = heightMap[i], m = climate.moisture[i], t = climate.temperature[i];
    let sum = 0, best = ['plains', -1];
    for (const [name, b] of entries) {
      const hFit = 1 - Math.min(1, Math.abs(y - b.preferredY) / 140);
      const mFit = 1 - Math.min(1, Math.abs(m - b.moisture));
      const tFit = 1 - Math.min(1, Math.abs(t - b.temperature));
      const w = Math.max(0, hFit * 0.45 + mFit * 0.3 + tFit * 0.25);
      if (w > 0.05) weights[i][name] = w;
      sum += w;
      if (w > best[1]) best = [name, w];
    }
    for (const k of Object.keys(weights[i])) weights[i][k] /= sum || 1;
    biomeMap[i] = best[0];
  }
  return { biomeMap, biomeWeights: weights };
}
