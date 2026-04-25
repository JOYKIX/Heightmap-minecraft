import { BIOME_PROFILES } from '../data/biome-profiles.js';
import { createValueNoise2D, fbm2D } from './noise.js';

const LAND_BIOMES = ['plains', 'hills', 'mountains', 'plateau', 'canyon', 'swamp', 'forest', 'jungle', 'desert', 'tundra'];

export function generateBiomeMap(config, context) {
  const { width, height, seed } = config;
  const { landMask, distanceToCoast } = context;
  const biomeMap = new Uint8Array(width * height);
  const biomeIds = ['ocean', 'coast', ...LAND_BIOMES];
  const biomeToIndex = Object.fromEntries(biomeIds.map((id, i) => [id, i]));

  const regionNoise = createValueNoise2D(`${seed}:biome:region`, 64);
  const humidNoise = createValueNoise2D(`${seed}:biome:humid`, 96);
  const tempNoise = createValueNoise2D(`${seed}:biome:temp`, 96);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) {
        biomeMap[i] = biomeToIndex.ocean;
        continue;
      }

      if (distanceToCoast[i] <= 4) {
        biomeMap[i] = biomeToIndex.coast;
        continue;
      }

      const nx = x / width;
      const ny = y / height;
      const region = fbm2D(regionNoise, nx, ny, 2, 2.0, 0.5, 1.2);
      const humidity = fbm2D(humidNoise, nx, ny, 3, 2.0, 0.5, 1.8);
      const temp = fbm2D(tempNoise, nx, ny, 3, 2.0, 0.5, 1.8);

      let biome = 'plains';
      if (region > 0.7) biome = 'mountains';
      else if (region > 0.6) biome = temp > 0.55 ? 'plateau' : 'tundra';
      else if (region > 0.5) biome = humidity > 0.65 ? 'forest' : 'hills';
      else if (region > 0.42) biome = humidity > 0.75 ? 'jungle' : 'plains';
      else if (region > 0.34) biome = humidity < 0.3 ? 'desert' : 'plains';
      else biome = humidity > 0.7 ? 'swamp' : 'canyon';

      biomeMap[i] = biomeToIndex[biome];
    }
  }

  return { biomeMap, biomeIds, biomeToIndex };
}

export function calculateBiomeStats(biomeMap, biomeIds) {
  const counts = new Array(biomeIds.length).fill(0);
  for (let i = 0; i < biomeMap.length; i++) counts[biomeMap[i]]++;
  const total = biomeMap.length;
  const percentages = {};
  biomeIds.forEach((id, i) => {
    percentages[id] = (counts[i] / total) * 100;
  });
  return percentages;
}

export function getBiomeProfileByIndex(index, biomeIds) {
  const id = biomeIds[index] || 'plains';
  return BIOME_PROFILES[id] || BIOME_PROFILES.plains;
}
