import { BIOME_PROFILES } from '../config/biome-profiles.js';
import { fbm2D } from '../utils/noise.js';
import { clamp } from '../utils/math.js';

export function applyMountains(baseHeight, biomeMap, settings, seedValue, profiler) {
  profiler.start('mountains');
  const { width, height } = settings.dimensions;
  const mountainBiome = BIOME_PROFILES.findIndex((b) => b.id === 'mountains');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const ridge = Math.pow(fbm2D(x / width * 6, y / height * 6, seedValue + 600, 4, 2.2, 0.5), 1.4);
      const influence = biomeMap[i] === mountainBiome ? 1 : 0.3;
      baseHeight[i] = clamp(baseHeight[i] + ridge * 60 * influence * settings.mountainScale, settings.minY, settings.maxY);
    }
  }
  profiler.end('mountains');
}
