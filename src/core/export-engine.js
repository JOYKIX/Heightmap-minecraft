import { clamp } from '../utils/math.js';

export function toGrayscale8(heightMap, minY, maxY) {
  const out = new Uint8ClampedArray(heightMap.length * 4);
  const range = Math.max(1, maxY - minY);
  for (let i = 0; i < heightMap.length; i += 1) {
    const gray = Math.round(clamp((heightMap[i] - minY) / range, 0, 1) * 255);
    const p = i * 4;
    out[p] = gray;
    out[p + 1] = gray;
    out[p + 2] = gray;
    out[p + 3] = 255;
  }
  return out;
}
