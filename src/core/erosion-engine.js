import { clamp } from '../utils/math.js';

export function erodeTerrain(heightMap, settings, profiler) {
  profiler.start('erosion');
  const { width, height } = settings.dimensions;
  const temp = new Float32Array(heightMap.length);

  for (let pass = 0; pass < settings.qualityProfile.erosionPasses; pass += 1) {
    temp.set(heightMap);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        const avg = (
          temp[i - width] + temp[i + width] + temp[i - 1] + temp[i + 1] + temp[i]
        ) / 5;
        heightMap[i] = clamp(temp[i] * (1 - settings.erosionStrength * 0.17) + avg * settings.erosionStrength * 0.17, settings.minY, settings.maxY);
      }
    }
  }

  profiler.end('erosion');
}
