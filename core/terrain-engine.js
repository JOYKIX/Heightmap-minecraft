import { createValueNoise2D, fbm2D } from './noise.js';
import {
  generateLandPotential,
  applyOceanBorder,
  createLandMaskByCoverage,
  cleanupLandMask,
  validateNoLandTouchesEdges
} from './landmass.js';
import { computeDistanceFields, shapeOceanAndCoast } from './coast.js';
import { generateBiomeMap, calculateBiomeStats, getBiomeProfileByIndex } from './biomes.js';
import { carveRivers } from './rivers.js';
import { applyLightErosion } from './erosion.js';
import { cleanupHeights, quantizeToMinecraftY, validateHeightmap } from './cleanup.js';
import { heightToGrayscale, minecraftYToGray } from './worldpainter.js';

export function generateTerrain(config) {
  const started = performance.now();
  const steps = [];
  const mark = (label) => steps.push(label);

  mark('1. Lire config');
  const finalConfig = { ...config };

  mark('2. Initialiser seed');

  mark('3. Créer landPotential');
  const landPotential = generateLandPotential(finalConfig);

  mark('4. Appliquer ocean border');
  applyOceanBorder(landPotential, finalConfig);

  mark('5. Créer landMask');
  const { mask: landMask } = createLandMaskByCoverage(landPotential, finalConfig);

  mark('6. Nettoyer landMask');
  const cleanMask = cleanupLandMask(landMask, finalConfig.width, finalConfig.height, 2);

  mark('7. Calculer distanceToCoast / distanceToLand');
  const { distanceToCoast, distanceToLand } = computeDistanceFields(cleanMask, finalConfig.width, finalConfig.height);

  mark('8. Générer biomeMap');
  const { biomeMap, biomeIds } = generateBiomeMap(finalConfig, { landMask: cleanMask, distanceToCoast });

  mark('9. Générer baseHeight float');
  const baseHeight = new Float32Array(finalConfig.width * finalConfig.height);
  const macroNoise = createValueNoise2D(`${finalConfig.seed}:height:macro`, 128);
  const mesoNoise = createValueNoise2D(`${finalConfig.seed}:height:meso`, 192);
  const microNoise = createValueNoise2D(`${finalConfig.seed}:height:micro`, 256);

  for (let y = 0; y < finalConfig.height; y++) {
    for (let x = 0; x < finalConfig.width; x++) {
      const i = y * finalConfig.width + x;
      const nx = x / finalConfig.width;
      const ny = y / finalConfig.height;
      const macro = fbm2D(macroNoise, nx, ny, 4, 2, 0.52, 1.2);
      const meso = fbm2D(mesoNoise, nx, ny, 3, 2.15, 0.56, 3.2);
      const micro = fbm2D(microNoise, nx, ny, 2, 2.1, 0.5, 8.0);
      baseHeight[i] = finalConfig.seaLevel + (macro - 0.5) * 55 + (meso - 0.5) * 20 + (micro - 0.5) * 6;
    }
  }

  mark('10. Appliquer relief par biome');
  for (let i = 0; i < baseHeight.length; i++) {
    if (!cleanMask[i]) continue;
    const profile = getBiomeProfileByIndex(biomeMap[i], biomeIds);
    baseHeight[i] = baseHeight[i] * (1 - profile.flatness * 0.15) + profile.preferredAltitude * 0.15;
    baseHeight[i] += (profile.roughness - 0.5) * 8;
  }

  mark('11. Générer montagnes');
  const ridgeNoise = createValueNoise2D(`${finalConfig.seed}:height:ridge`, 128);
  for (let y = 0; y < finalConfig.height; y++) {
    for (let x = 0; x < finalConfig.width; x++) {
      const i = y * finalConfig.width + x;
      if (!cleanMask[i]) continue;
      const profile = getBiomeProfileByIndex(biomeMap[i], biomeIds);
      const dCoast = Math.min(32, distanceToCoast[i]);
      const inland = dCoast / 32;
      const r = Math.abs(fbm2D(ridgeNoise, x / finalConfig.width, y / finalConfig.height, 4, 2, 0.5, 2) - 0.5);
      const ridge = Math.max(0, 1 - r * 3.5);
      baseHeight[i] += ridge * profile.mountainInfluence * inland * 95;
    }
  }

  mark('12. Générer rivières');
  carveRivers(baseHeight, cleanMask, finalConfig, biomeMap, biomeIds);

  mark('13. Appliquer érosion légère');
  applyLightErosion(baseHeight, finalConfig.width, finalConfig.height, 0.18);

  mark('14. Nettoyer heightmap');
  shapeOceanAndCoast(baseHeight, cleanMask, distanceToLand, finalConfig.seaLevel);
  cleanupHeights(baseHeight, finalConfig, cleanMask);

  mark('15. Quantifier en Y entier');
  const yInt = quantizeToMinecraftY(baseHeight, finalConfig.minY, finalConfig.maxY);

  mark('16. Convertir en grayscale');
  const grayscale = heightToGrayscale(yInt, finalConfig.minY, finalConfig.maxY);

  mark('17. Render preview');

  mark('18. Export PNG');

  const biomeStats = calculateBiomeStats(biomeMap, biomeIds);
  const validation = validateHeightmap(yInt, finalConfig, cleanMask);

  const landPixels = cleanMask.reduce((s, v) => s + v, 0);
  const total = cleanMask.length;
  const oceanPixels = total - landPixels;

  const stats = {
    targetLand: finalConfig.landCoverage * 100,
    realLand: (landPixels / total) * 100,
    realOcean: (oceanPixels / total) * 100,
    edgeTouch: !validateNoLandTouchesEdges(cleanMask, finalConfig.width, finalConfig.height),
    minAltitude: validation.min,
    maxAltitude: validation.max,
    seaLevel: finalConfig.seaLevel,
    graySeaLevel: minecraftYToGray(finalConfig.seaLevel, finalConfig.minY, finalConfig.maxY),
    biomes: biomeStats,
    generationMs: performance.now() - started,
    worldPainterCompatible: validation.worldPainterCompatible,
    pipelineSteps: steps
  };

  return { config: finalConfig, landMask: cleanMask, distanceToCoast, distanceToLand, biomeMap, biomeIds, yInt, grayscale, stats };
}
