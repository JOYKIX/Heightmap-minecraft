import { clamp } from '../js/utils.js';

export function applyErosion(heightMap, width, height, passes = 2) {
  let src = new Float32Array(heightMap);
  for (let pass = 0; pass < passes; pass++) {
    const dst = new Float32Array(src);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        let avg = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) avg += src[(y + oy) * width + (x + ox)];
        avg /= 9;
        const slope = Math.abs(src[i] - avg);
        const keepCliff = slope > 22 ? 0.15 : 0.45;
        dst[i] = clamp(src[i] * (1 - keepCliff) + avg * keepCliff, -64, 320);
      }
    }
    src = dst;
  }
  return src;
}
