import { createValueNoise2D, fbm2D } from './noise.js';
import {
  generateLandPotential,
  applyOceanBorderMask,
  createLandMaskByCoverage,
  cleanupLandMask,
  enforceOceanEdges,
  validateNoLandTouchesEdges
} from './landmass.js';
import { computeDistanceFields, shapeOceanAndCoast } from './coast.js';
import { generateBiomeMap, generateClimateMaps, calculateBiomeStats, getBiomeProfileByIndex } from './biomes.js';
import { carveRivers } from './rivers.js';
import { applyLightErosion } from './erosion.js';
import { cleanupHeights, quantizeToMinecraftY, validateHeightmap } from './cleanup.js';
import { heightToGrayscale, minecraftYToGray } from './worldpainter.js';

export function generateTerrain(config) {
  const started = performance.now();
  const steps = [];
  const mark = (label) => steps.push(label);

  mark('1. Lire la config utilisateur');
  const finalConfig = { ...config };

  let landPotential;
  let cleanMask;
  let coverageStats;

  for (let attempt = 0; attempt < 3; attempt++) {
    mark('2. Générer landPotential');
    landPotential = generateLandPotential(finalConfig);

    mark('3. Appliquer ocean border obligatoire');
    applyOceanBorderMask(landPotential, finalConfig);

    mark('4. Créer landMask selon le % de terre');
    const coverage = createLandMaskByCoverage(landPotential, finalConfig);
    coverageStats = coverage;

    mark('5. Nettoyer le landMask');
    cleanMask = cleanupLandMask(coverage.mask, finalConfig.width, finalConfig.height, 3);

    mark('6. Vérifier que la terre ne touche aucun bord');
    enforceOceanEdges(cleanMask, finalConfig.width, finalConfig.height);
    if (validateNoLandTouchesEdges(cleanMask, finalConfig.width, finalConfig.height)) break;
  }

  mark('7. Calculer distanceToCoast');
  mark('8. Calculer distanceToLand');
  const { distanceToCoast, distanceToLand } = computeDistanceFields(cleanMask, finalConfig.width, finalConfig.height);

  mark('9. Générer climate maps');
  const { moistureMap, temperatureMap, elevationIntentMap } = generateClimateMaps(finalConfig, {
    landMask: cleanMask,
    distanceToCoast
  });

  mark('10. Générer biomeMap');
  const { biomeMap, biomeIds } = generateBiomeMap(finalConfig, {
    landMask: cleanMask,
    distanceToCoast,
    moistureMap,
    temperatureMap,
    elevationIntentMap
  });

  mark('11. Générer baseHeight');
  const baseHeight = buildBaseHeights(finalConfig, cleanMask, biomeMap, biomeIds, distanceToCoast, elevationIntentMap);

  mark('12. Appliquer relief par biome');
  applyBiomeRelief(baseHeight, finalConfig, cleanMask, biomeMap, biomeIds);

  mark('13. Ajouter montagnes');
  addMountains(baseHeight, finalConfig, cleanMask, biomeMap, biomeIds, distanceToCoast);

  mark('14. Ajouter vallées');
  addValleys(baseHeight, finalConfig, cleanMask);

  mark('15. Ajouter rivières');
  carveRivers(baseHeight, cleanMask, finalConfig, biomeMap, biomeIds);

  mark('16. Ajouter érosion légère');
  applyLightErosion(baseHeight, finalConfig.width, finalConfig.height, 0.16);

  mark('17. Nettoyer les artefacts');
  shapeOceanAndCoast(baseHeight, cleanMask, distanceToLand, finalConfig.seaLevel);
  cleanupHeights(baseHeight, finalConfig, cleanMask);

  mark('18. Quantifier en Y entier');
  const yInt = quantizeToMinecraftY(baseHeight, finalConfig.minY, finalConfig.maxY);

  mark('19. Convertir en grayscale');
  const grayscale = heightToGrayscale(yInt, finalConfig.minY, finalConfig.maxY);

  mark('20. Afficher preview');
  mark('21. Exporter PNG');

  const biomeStats = calculateBiomeStats(biomeMap, biomeIds);
  const validation = validateHeightmap(yInt, finalConfig, cleanMask);

  const landPixels = cleanMask.reduce((s, v) => s + v, 0);
  const total = cleanMask.length;
  const oceanPixels = total - landPixels;

  const stats = {
    targetLand: finalConfig.landCoverage * 100,
    realLand: (landPixels / total) * 100,
    realOcean: (oceanPixels / total) * 100,
    preCleanupRealLand: (coverageStats?.realLand ?? 0) * 100,
    edgeTouch: !validateNoLandTouchesEdges(cleanMask, finalConfig.width, finalConfig.height),
    minAltitude: validation.min,
    maxAltitude: validation.max,
    seaLevel: finalConfig.seaLevel,
    graySeaLevel: minecraftYToGray(finalConfig.seaLevel, finalConfig.minY, finalConfig.maxY),
    biomeCount: biomeIds.length,
    biomes: biomeStats,
    generationMs: performance.now() - started,
    worldPainterCompatible: validation.worldPainterCompatible,
    pipelineSteps: steps
  };

  if (!validation.worldPainterCompatible) {
    stats.error = 'Validation échouée: heightmap non compatible WorldPainter.';
  }

  return {
    config: finalConfig,
    landMask: cleanMask,
    distanceToCoast,
    distanceToLand,
    moistureMap,
    temperatureMap,
    elevationIntentMap,
    biomeMap,
    biomeIds,
    yInt,
    grayscale,
    stats
  };
}

function buildBaseHeights(config, landMask, biomeMap, biomeIds, distanceToCoast, elevationIntentMap) {
  const { width, height, seaLevel } = config;
  const out = new Float32Array(width * height);

  const macroNoise = createValueNoise2D(`${config.seed}:height:macro`, 128);
  const mesoNoise = createValueNoise2D(`${config.seed}:height:meso`, 192);
  const microNoise = createValueNoise2D(`${config.seed}:height:micro`, 256);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) {
        out[i] = seaLevel - 8;
        continue;
      }

      const nx = x / width;
      const ny = y / height;
      const macro = fbm2D(macroNoise, nx, ny, 4, 2.0, 0.5, 1.1);
      const meso = fbm2D(mesoNoise, nx, ny, 3, 2.1, 0.55, 3.4);
      const micro = fbm2D(microNoise, nx, ny, 2, 2.0, 0.55, 8.5);
      const inland = Math.min(1, distanceToCoast[i] / 24);
      const profile = getBiomeProfileByIndex(biomeMap[i], biomeIds);

      let h = seaLevel +
        (macro - 0.5) * 48 +
        (meso - 0.5) * 22 +
        (micro - 0.5) * 6 +
        inland * 16 +
        elevationIntentMap[i] * 38;

      h = h * (1 - profile.flatness * 0.1) + profile.preferredAltitude * 0.1;
      out[i] = h;
    }
  }

  return out;
}

function applyBiomeRelief(baseHeight, config, landMask, biomeMap, biomeIds) {
  for (let i = 0; i < baseHeight.length; i++) {
    if (!landMask[i]) continue;
    const profile = getBiomeProfileByIndex(biomeMap[i], biomeIds);
    const roughBoost = (profile.roughness - 0.5) * 12;
    const flatten = profile.flatness * 0.22;
    baseHeight[i] = baseHeight[i] * (1 - flatten) + profile.preferredAltitude * flatten + roughBoost;

    if (baseHeight[i] < profile.minAltitude) {
      baseHeight[i] = profile.minAltitude + (baseHeight[i] - profile.minAltitude) * 0.45;
    }
    if (baseHeight[i] > profile.maxAltitude) {
      baseHeight[i] = profile.maxAltitude + (baseHeight[i] - profile.maxAltitude) * 0.25;
    }
  }
}

function addMountains(baseHeight, config, landMask, biomeMap, biomeIds, distanceToCoast) {
  const ridgeNoise = createValueNoise2D(`${config.seed}:height:ridge`, 96);
  const chainNoise = createValueNoise2D(`${config.seed}:height:chain`, 72);
  const { width, height } = config;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const profile = getBiomeProfileByIndex(biomeMap[i], biomeIds);
      if (profile.mountainInfluence <= 0.05) continue;

      const nx = x / width;
      const ny = y / height;
      const ridge = Math.max(0, 1 - Math.abs(fbm2D(ridgeNoise, nx, ny, 4, 2.0, 0.5, 2.2) - 0.5) * 4.2);
      const chain = fbm2D(chainNoise, nx * 0.85, ny * 1.15, 3, 2.0, 0.52, 1.4);
      const inland = Math.min(1, distanceToCoast[i] / 32);
      const mass = ridge * chain * inland * profile.mountainInfluence;
      baseHeight[i] += mass * 110;
    }
  }
}

function addValleys(baseHeight, config, landMask) {
  const valleyNoise = createValueNoise2D(`${config.seed}:height:valley`, 128);
  const { width, height } = config;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const nx = x / width;
      const ny = y / height;
      const n = fbm2D(valleyNoise, nx, ny, 4, 2.0, 0.5, 2.4);
      const valleyMask = Math.max(0, 1 - Math.abs(n - 0.5) * 6.5);
      if (valleyMask <= 0) continue;
      baseHeight[i] -= valleyMask * 18;
    }
  }
}
