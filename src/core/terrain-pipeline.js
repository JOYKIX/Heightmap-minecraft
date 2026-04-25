import { createGrid } from '../utils/arrays.js';
import { fbm2D } from '../utils/noise.js';
import { BIOME_PROFILES } from '../config/biome-profiles.js';
import { generateLandMask } from './coast-engine.js';
import { assignBiomes } from './biome-engine.js';
import { applyMountains } from './mountain-engine.js';
import { carveRivers } from './river-engine.js';
import { erodeTerrain } from './erosion-engine.js';

export function runTerrainPipeline(settings, seedValue, profiler, progress = () => {}) {
  const { width, height } = settings.dimensions;
  progress('landMask', 0.08);
  const landMask = generateLandMask(settings, seedValue, profiler);

  progress('baseHeight', 0.2);
  const heightMap = createGrid(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (landMask[i] === 0) {
        heightMap[i] = settings.height.seaLevel - 18 - fbm2D(x / width * 4, y / height * 4, seedValue + 40, 3, 2, 0.5) * 8;
      } else {
        heightMap[i] = settings.height.seaLevel + fbm2D(x / width * 3, y / height * 3, seedValue + 50, 4, 2, 0.5) * 42;
      }
    }
  }

  progress('biomes', 0.35);
  const { biomeMap, moistureMap, temperatureMap } = assignBiomes(landMask, settings, seedValue, profiler);

  progress('mountains', 0.5);
  applyMountains(heightMap, biomeMap, settings, seedValue, profiler);

  progress('rivers', 0.68);
  const riverMap = carveRivers(heightMap, biomeMap, settings, seedValue, profiler);

  progress('erosion', 0.83);
  erodeTerrain(heightMap, settings, profiler);

  progress('quantization', 0.94);
  for (let i = 0; i < heightMap.length; i += 1) {
    heightMap[i] = Math.round(heightMap[i]);
  }

  const biomeCounts = new Uint32Array(BIOME_PROFILES.length);
  for (let i = 0; i < biomeMap.length; i += 1) biomeCounts[biomeMap[i]] += 1;

  progress('complete', 1);
  return { heightMap, landMask, biomeMap, biomeCounts, riverMap, moistureMap, temperatureMap };
}
