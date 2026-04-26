import { minecraftYToGray16, WORLDPAINTER_DEFAULTS } from './worldpainter.js';

export function quantizeToMinecraftY(height, minY = WORLDPAINTER_DEFAULTS.minY, maxY = WORLDPAINTER_DEFAULTS.maxY) {
  const out = new Int16Array(height.length);
  for (let i = 0; i < height.length; i++) out[i] = Math.round(Math.max(minY, Math.min(maxY, height[i])));
  return out;
}

export function yToGray16(yValue, minY = WORLDPAINTER_DEFAULTS.minY, maxY = WORLDPAINTER_DEFAULTS.maxY) {
  return minecraftYToGray16(yValue, minY, maxY);
}

export function toGray16Array(yValues, minY = WORLDPAINTER_DEFAULTS.minY, maxY = WORLDPAINTER_DEFAULTS.maxY) {
  const out = new Uint16Array(yValues.length);
  for (let i = 0; i < yValues.length; i++) out[i] = minecraftYToGray16(yValues[i], minY, maxY);
  return out;
}
