import { clamp } from '../js/utils.js';

export const OCEAN_BORDER_PRESETS = { small: 0.08, standard: 0.15, large: 0.25, huge: 0.35 };

export function applyOceanBorder(landPotential, width, height, preset = 'standard') {
  const border = OCEAN_BORDER_PRESETS[preset] ?? OCEAN_BORDER_PRESETS.standard;
  const out = new Float32Array(landPotential.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / (width - 1);
      const ny = y / (height - 1);
      const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
      const fade = clamp((edge - border) / Math.max(0.0001, 0.5 - border), 0, 1);
      out[i] = landPotential[i] * fade;
    }
  }
  return out;
}

export function validateNoLandTouchesEdges(mask, width, height) {
  for (let x = 0; x < width; x++) if (mask[x] || mask[(height - 1) * width + x]) return false;
  for (let y = 0; y < height; y++) if (mask[y * width] || mask[y * width + width - 1]) return false;
  return true;
}
