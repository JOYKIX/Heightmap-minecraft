import { BIOME_PROFILES } from '../data/biome-profiles.js';
import { createValueNoise2D, fbm2D } from './noise.js';

const LAND_BIOMES = ['plains', 'hills', 'mountains', 'plateau', 'canyon', 'swamp', 'forest', 'jungle', 'desert', 'tundra'];

export function generateClimateMaps(config, context) {
  const { width, height, seed } = config;
  const { landMask, distanceToCoast } = context;

  const moistureMap = new Float32Array(width * height);
  const temperatureMap = new Float32Array(width * height);
  const elevationIntentMap = new Float32Array(width * height);

  const moistNoise = createValueNoise2D(`${seed}:climate:moisture`, 96);
  const tempNoise = createValueNoise2D(`${seed}:climate:temp`, 96);
  const elevNoise = createValueNoise2D(`${seed}:climate:elev`, 84);

  for (let y = 0; y < height; y++) {
    const latitude = Math.abs((y / Math.max(1, height - 1)) * 2 - 1);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;
      const coastInfluence = Math.min(1, distanceToCoast[i] / 26);

      const m = fbm2D(moistNoise, nx, ny, 4, 2.0, 0.5, 2.2);
      const t = fbm2D(tempNoise, nx, ny, 4, 2.0, 0.5, 2.2);
      const e = fbm2D(elevNoise, nx, ny, 3, 2.0, 0.5, 1.6);

      moistureMap[i] = !landMask[i] ? 1 : clamp01(m * 0.7 + (1 - coastInfluence) * 0.25 + 0.05);
      temperatureMap[i] = !landMask[i] ? 0.5 : clamp01(t * 0.8 + (1 - latitude) * 0.2 - latitude * 0.1);
      elevationIntentMap[i] = !landMask[i] ? 0 : clamp01(e * 0.75 + coastInfluence * 0.2 + 0.05);
    }
  }

  return { moistureMap, temperatureMap, elevationIntentMap };
}

export function generateBiomeMap(config, context) {
  const { width, height, seed } = config;
  const { landMask, distanceToCoast, moistureMap, temperatureMap, elevationIntentMap } = context;
  const biomeMap = new Uint8Array(width * height);
  const biomeIds = ['ocean', 'coast', ...LAND_BIOMES];
  const biomeToIndex = Object.fromEntries(biomeIds.map((id, i) => [id, i]));

  const regionNoise = createValueNoise2D(`${seed}:biome:region`, 48);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) {
        biomeMap[i] = biomeToIndex.ocean;
        continue;
      }

      if (distanceToCoast[i] <= 3) {
        biomeMap[i] = biomeToIndex.coast;
        continue;
      }

      const nx = x / width;
      const ny = y / height;
      const region = fbm2D(regionNoise, nx, ny, 2, 2.0, 0.5, 1.1);
      const moisture = moistureMap[i];
      const temp = temperatureMap[i];
      const elevIntent = elevationIntentMap[i];

      let biome = 'plains';
      if (elevIntent > 0.82) biome = temp < 0.44 ? 'tundra' : 'mountains';
      else if (elevIntent > 0.7) biome = moisture < 0.35 ? 'plateau' : 'hills';
      else if (elevIntent > 0.58 && moisture < 0.25) biome = 'canyon';
      else if (moisture > 0.8 && temp > 0.58) biome = 'jungle';
      else if (moisture > 0.76 && elevIntent < 0.42) biome = 'swamp';
      else if (moisture < 0.27 && temp > 0.52) biome = 'desert';
      else if (moisture > 0.62) biome = 'forest';
      else if (region > 0.6) biome = 'hills';

      biomeMap[i] = biomeToIndex[biome];
    }
  }

  smoothBiomeRegions(biomeMap, width, height, biomeToIndex.coast, biomeToIndex.ocean);
  return { biomeMap, biomeIds, biomeToIndex };
}

function smoothBiomeRegions(biomeMap, width, height, coastIdx, oceanIdx) {
  const src = new Uint8Array(biomeMap);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (src[i] === coastIdx || src[i] === oceanIdx) continue;
      const counts = new Uint16Array(16);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const ni = (y + oy) * width + (x + ox);
          counts[src[ni]]++;
        }
      }
      let best = src[i];
      let bestCount = 0;
      for (let b = 0; b < counts.length; b++) {
        if (counts[b] > bestCount) {
          best = b;
          bestCount = counts[b];
        }
      }
      if (bestCount >= 5) biomeMap[i] = best;
    }
  }
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

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
