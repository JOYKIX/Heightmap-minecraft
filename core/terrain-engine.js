import { createRng } from './random.js';
import { generateIslandLandmass } from './island-generator.js';
import { generateClimateMaps, generateBiomeWeights } from './biome-engine.js';
import { carveRivers } from './river-engine.js';
import { applyErosion } from './erosion-engine.js';
import { quantizeToMinecraftY, toGray16Array } from './heightmap-export.js';
import { fbm2D } from './noise.js';

export function generateProceduralIsland(config) {
  const t0 = performance.now();
  const pipeline = [];
  const width = config.resolution;
  const height = config.resolution;
  const seedInt = Math.floor(createRng(config.seed)() * 1000000);

  pipeline.push('1. Lire config');
  pipeline.push('2. Créer seed');
  const { landPotential, landMask } = generateIslandLandmass({ width, height, seed: seedInt, landRatio: config.landRatio, oceanBorder: config.oceanBorder });
  pipeline.push('3-6. landPotential + ocean border + landMask');

  const distanceToCoast = new Float32Array(width * height);
  for (let i = 0; i < landMask.length; i++) distanceToCoast[i] = landMask[i] ? 1 : 0;
  pipeline.push('7. distanceToCoast');

  const climate = generateClimateMaps(width, height, seedInt);
  pipeline.push('8. climate maps');

  const structure = { mountainCore: 0, ridgeLines: 0, basinZones: 0, coastalPlains: 0 };
  const baseHeight = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) {
        baseHeight[i] = 48 - (1 - landPotential[i]) * 60;
        continue;
      }
      const nx = x / width, ny = y / height;
      const macro = fbm2D(nx * 2, ny * 2, 4, 2, 0.5, seedInt + 30);
      const ridges = 1 - Math.abs(fbm2D(nx * 6, ny * 6, 3, 2, 0.5, seedInt + 31) * 2 - 1);
      const mountainMask = Math.max(0, macro - 0.58) * 2.5;
      const plainsMask = Math.max(0, 0.72 - macro) * 1.5;
      structure.mountainCore += mountainMask > 0.2 ? 1 : 0;
      structure.ridgeLines += ridges > 0.7 ? 1 : 0;
      structure.coastalPlains += plainsMask > 0.3 ? 1 : 0;
      baseHeight[i] = config.seaLevel + 6 + macro * 70 + ridges * mountainMask * 120 - plainsMask * 22;
    }
  }
  pipeline.push('9-14. biome, structure, montagnes/vallées');

  const biomes = generateBiomeWeights(baseHeight, landMask, climate, width, height);

  const rivers = carveRivers(baseHeight, landMask, width, height, config.seaLevel);
  let shaped = rivers.heightMap;
  pipeline.push('15. rivières');

  shaped = applyErosion(shaped, width, height, 2);
  pipeline.push('16. érosion + nettoyage');

  const yMap = quantizeToMinecraftY(shaped, config.minY, config.maxY);
  const gray16 = toGray16Array(yMap, config.minY, config.maxY);
  pipeline.push('17-18. quantification + export gray16');

  let landCount = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < yMap.length; i++) {
    if (landMask[i]) landCount++;
    if (yMap[i] < min) min = yMap[i];
    if (yMap[i] > max) max = yMap[i];
  }

  return {
    width, height, yMap, gray16, landMask, biomeMap: biomes.biomeMap, settings: { minY: config.minY, maxY: config.maxY, seaLevel: config.seaLevel },
    stats: {
      landPct: ((landCount / yMap.length) * 100).toFixed(2),
      oceanPct: (100 - (landCount / yMap.length) * 100).toFixed(2),
      minY: min,
      maxY: max,
      rivers: rivers.riverCount,
      generationMs: Math.round(performance.now() - t0),
      pipeline
    }
  };
}
