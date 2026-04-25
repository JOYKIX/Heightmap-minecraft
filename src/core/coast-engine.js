import { fbm2D } from '../utils/noise.js';
import { clamp, idx, smoothstep } from '../utils/math.js';

const SHAPE_SETTINGS = {
  compact: { radius: 0.56, x: 1, y: 1 },
  elongated: { radius: 0.6, x: 1.2, y: 0.82 },
  fragmented: { radius: 0.67, x: 1.1, y: 0.93 },
  continental: { radius: 0.78, x: 1.25, y: 0.8 }
};

export function generateLandMask(settings, seedValue, profiler) {
  profiler.start('landmask');
  const { width, height } = settings.dimensions;
  const shape = SHAPE_SETTINGS[settings.shape] ?? SHAPE_SETTINGS.compact;
  const potential = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x / width - 0.5) * shape.x;
      const ny = (y / height - 0.5) * shape.y;
      const distance = Math.hypot(nx, ny);
      const radial = 1 - smoothstep(clamp(distance / shape.radius, 0, 1));
      const coastNoise = fbm2D(x / width * 5, y / height * 5, seedValue + 11, 4, 2.1, 0.5) - 0.5;
      potential[idx(x, y, width)] = clamp(radial + coastNoise * 0.25, 0, 1);
    }
  }

  const sorted = Array.from(potential).sort((a, b) => a - b);
  const threshold = sorted[Math.floor((1 - settings.landCoverage) * (sorted.length - 1))];
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = potential[i] >= threshold ? 1 : 0;
  }
  profiler.end('landmask');
  return mask;
}
