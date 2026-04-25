import { BIOME_PROFILES } from '../config/biome-profiles.js';
import { clamp, idx } from '../utils/math.js';
import { fbm2D } from '../utils/noise.js';

function scoreBiome(biome, moisture, temperature, elevation, targetMix) {
  const moistureScore = 1 - Math.abs(moisture - (biome.moistureRange[0] + biome.moistureRange[1]) * 0.5);
  const tempScore = 1 - Math.abs(temperature - (biome.temperatureRange[0] + biome.temperatureRange[1]) * 0.5);
  const altitudeScore = 1 - Math.abs(elevation - biome.preferredAltitude / 260);
  const mixBoost = (targetMix.get(biome.id) ?? 10) / 100;
  return moistureScore * 0.4 + tempScore * 0.33 + altitudeScore * 0.22 + mixBoost * 0.05;
}

export function assignBiomes(mask, settings, seedValue, profiler) {
  profiler.start('biomes');
  const { width, height } = settings.dimensions;
  const biomeMap = new Uint8Array(width * height);
  const moistureMap = new Float32Array(width * height);
  const temperatureMap = new Float32Array(width * height);
  const mix = new Map(settings.biomeMix.map((item) => [item.id, item.target]));
  const oceanIdx = BIOME_PROFILES.findIndex((b) => b.id === 'ocean');
  const coastIdx = BIOME_PROFILES.findIndex((b) => b.id === 'coast');

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const moisture = fbm2D(x / width * 4, y / height * 4, seedValue + 101, 4, 2, 0.52);
      const temperature = clamp(1 - Math.abs(y / height - 0.5) * 1.2 + fbm2D(x / width * 2, y / height * 2, seedValue + 202, 3, 2, 0.48) * 0.3, 0, 1);
      const elevation = fbm2D(x / width * 3, y / height * 3, seedValue + 303, 3, 2, 0.5);
      moistureMap[i] = moisture;
      temperatureMap[i] = temperature;

      if (mask[i] === 0) {
        biomeMap[i] = oceanIdx;
        continue;
      }

      const edge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
      if (edge) {
        biomeMap[i] = coastIdx;
        continue;
      }

      let bestScore = -Infinity;
      let bestIndex = 2;
      for (let b = 2; b < BIOME_PROFILES.length; b += 1) {
        const score = scoreBiome(BIOME_PROFILES[b], moisture, temperature, elevation, mix);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = b;
        }
      }
      biomeMap[i] = bestIndex;
    }
  }

  profiler.end('biomes');
  return { biomeMap, moistureMap, temperatureMap };
}
