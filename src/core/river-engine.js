import { BIOME_PROFILES } from '../config/biome-profiles.js';
import { clamp } from '../utils/math.js';
import { mulberry32 } from '../utils/random.js';

export function carveRivers(heightMap, biomeMap, settings, seedValue, profiler) {
  profiler.start('rivers');
  const { width, height } = settings.dimensions;
  const riverMap = new Uint8Array(width * height);
  const mountainBiome = BIOME_PROFILES.findIndex((b) => b.id === 'mountains');
  const rng = mulberry32(seedValue + 900);
  const targetSources = Math.floor(width * height * 0.00006 * settings.riverIntensity);

  for (let s = 0; s < targetSources; s += 1) {
    let x = Math.floor(rng() * width);
    let y = Math.floor(rng() * height);
    let i = y * width + x;
    if (biomeMap[i] !== mountainBiome) continue;

    for (let step = 0; step < 300; step += 1) {
      i = y * width + x;
      riverMap[i] = 1;
      heightMap[i] = clamp(heightMap[i] - 2.4, settings.minY, settings.maxY);
      let lowest = heightMap[i];
      let nextX = x;
      let nextY = y;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (!ox && !oy) continue;
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
          const ni = yy * width + xx;
          if (heightMap[ni] < lowest) {
            lowest = heightMap[ni];
            nextX = xx;
            nextY = yy;
          }
        }
      }
      if (nextX === x && nextY === y) break;
      x = nextX;
      y = nextY;
      if (heightMap[y * width + x] <= settings.height.seaLevel + 2) break;
    }
  }

  profiler.end('rivers');
  return riverMap;
}
