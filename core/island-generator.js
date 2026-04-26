import { fbm2D } from './noise.js';
import { applyOceanBorder, validateNoLandTouchesEdges } from './coast-engine.js';
import { clamp } from '../js/utils.js';

export function generateIslandLandmass(config) {
  const { width, height, seed = 1, landRatio = 0.42, oceanBorder = 'standard' } = config;
  let tries = 0;
  while (tries++ < 4) {
    const landPotential = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const nx = x / width - 0.5;
        const ny = y / height - 0.5;
        const angle = Math.atan2(ny, nx);
        const radius = Math.sqrt(nx * nx + ny * ny);
        const asym = 0.12 * Math.sin(angle * 2.2 + seed * 0.01);
        const warpX = nx + (fbm2D(nx * 3 + 2, ny * 3, 3, 2, 0.5, seed) - 0.5) * 0.16;
        const warpY = ny + (fbm2D(nx * 3, ny * 3 + 2, 3, 2, 0.5, seed + 1) - 0.5) * 0.16;
        const warpedRadius = Math.sqrt(warpX * warpX + warpY * warpY);
        const radial = 1 - clamp((warpedRadius + asym) * 1.75, 0, 1);
        const macro = fbm2D(nx * 2.5 + 20, ny * 2.5 - 17, 4, 2, 0.5, seed + 2);
        const coastal = fbm2D(nx * 8.5, ny * 8.5, 3, 2, 0.6, seed + 3);
        landPotential[i] = radial * 0.58 + macro * 0.32 + coastal * 0.1;
      }
    }
    const bordered = applyOceanBorder(landPotential, width, height, oceanBorder);
    const values = [...bordered].sort((a, b) => a - b);
    const threshold = values[Math.floor((1 - landRatio) * values.length)];
    const landMask = new Uint8Array(width * height);
    for (let i = 0; i < landMask.length; i++) landMask[i] = bordered[i] > threshold ? 1 : 0;
    if (validateNoLandTouchesEdges(landMask, width, height)) return { landPotential: bordered, landMask, threshold };
  }
  throw new Error('Impossible de garantir la marge océanique.');
}
