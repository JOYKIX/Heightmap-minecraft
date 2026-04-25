import { createValueNoise2D, fbm2D } from './noise.js';
import {
  generateLandPotential,
  applyOceanBorderMask,
  createLandMaskByCoverage,
  cleanupLandMask,
  enforceOceanEdges,
  validateNoLandTouchesEdges,
  generateGeographySkeleton
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

  mark('7. Calculer distanceToCoast / distanceToLand');
  const { distanceToCoast, distanceToLand } = computeDistanceFields(cleanMask, finalConfig.width, finalConfig.height);

  mark('8. Construire squelette géographique');
  const geography = generateGeographySkeleton(finalConfig, cleanMask, distanceToCoast);

  mark('9. Générer climate maps');
  const climate = generateClimateMaps(finalConfig, {
    landMask: cleanMask,
    distanceToCoast,
    geography
  });

  mark('10. Générer biomeMap + influences');
  const biomeResult = generateBiomeMap(finalConfig, {
    landMask: cleanMask,
    distanceToCoast,
    ...climate
  });

  mark('11. Générer baseHeight');
  const baseHeight = buildBaseHeights(finalConfig, cleanMask, biomeResult, distanceToCoast, climate, geography);

  mark('12. Blending du relief par biome');
  applyBiomeRelief(baseHeight, finalConfig, cleanMask, biomeResult, climate);

  mark('13. Ajouter montagnes et plateaux structurés');
  addMountains(baseHeight, finalConfig, cleanMask, biomeResult, distanceToCoast, climate, geography);

  mark('14. Ajouter vallées');
  addValleys(baseHeight, finalConfig, cleanMask, geography);

  mark('15. Ajouter rivières');
  const riverStats = carveRivers(baseHeight, cleanMask, finalConfig, biomeResult.biomeMap, biomeResult.biomeIds);

  mark('16. Ajouter érosion légère');
  applyLightErosion(baseHeight, finalConfig.width, finalConfig.height, 0.16);

  mark('17. Nettoyer les artefacts');
  shapeOceanAndCoast(baseHeight, cleanMask, distanceToLand, finalConfig.seaLevel);
  cleanupHeights(baseHeight, finalConfig, cleanMask);

  mark('18. Quantifier en Y entier');
  const yInt = quantizeToMinecraftY(baseHeight, finalConfig.minY, finalConfig.maxY);

  mark('19. Convertir en grayscale');
  const grayscale = heightToGrayscale(yInt, finalConfig.minY, finalConfig.maxY);

  const biomeStats = calculateBiomeStats(biomeResult.biomeMap, biomeResult.biomeIds, biomeResult.profiles);
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
    biomeCount: biomeResult.biomeIds.length,
    biomes: biomeStats.byBiome,
    biomeWarnings: biomeStats.warnings,
    riverCount: riverStats?.rivers ?? 0,
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
    geography,
    ...climate,
    ...biomeResult,
    yInt,
    grayscale,
    stats
  };
}

function buildBaseHeights(config, landMask, biomeResult, distanceToCoast, climate, geography) {
  const { width, height, seaLevel } = config;
  const out = new Float32Array(width * height);

  const macroNoise = createValueNoise2D(`${config.seed}:height:macro`, 128);
  const mesoNoise = createValueNoise2D(`${config.seed}:height:meso`, 192);
  const microNoise = createValueNoise2D(`${config.seed}:height:micro`, 256);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) {
        const offshore = Math.min(1, distanceToCoast[i] / 180);
        out[i] = seaLevel - 2 - offshore * 40;
        continue;
      }

      const nx = x / width;
      const ny = y / height;
      const macro = fbm2D(macroNoise, nx, ny, 4, 2.0, 0.5, 1.1);
      const meso = fbm2D(mesoNoise, nx, ny, 3, 2.1, 0.55, 3.4);
      const micro = fbm2D(microNoise, nx, ny, 2, 2.0, 0.55, 8.5);
      const inland = Math.min(1, distanceToCoast[i] / 24);

      let preferred = 0;
      let roughness = 0;
      let flatness = 0;
      for (let b = 0; b < biomeResult.biomeIds.length; b++) {
        const w = biomeResult.biomeWeights[i][b];
        if (w <= 0) continue;
        const profile = getBiomeProfileByIndex(b, biomeResult.biomeIds, biomeResult.profiles);
        preferred += profile.preferredY * w;
        roughness += profile.roughness * w;
        flatness += profile.flatness * w;
      }

      const h =
        seaLevel +
        (macro - 0.5) * (26 + roughness * 26) +
        (meso - 0.5) * (14 + roughness * 12) +
        (micro - 0.5) * (3 + roughness * 5) +
        inland * 10 +
        climate.elevationIntentMap[i] * 24 +
        geography.mainRidgeLine[i] * 36 -
        geography.lowlandBasins[i] * 10;

      out[i] = h * (1 - flatness * 0.13) + preferred * (0.1 + flatness * 0.12);
    }
  }

  return out;
}

function applyBiomeRelief(baseHeight, config, landMask, biomeResult, climate) {
  const blendStrength = config.biomeBlendStrength ?? 0.75;
  for (let i = 0; i < baseHeight.length; i++) {
    if (!landMask[i]) continue;

    let minY = 1000;
    let maxY = -1000;
    let erosion = 0;
    let reliefIntensity = 0;
    let transition = 0;
    let roughness = 0;
    let preferred = 0;

    for (let b = 0; b < biomeResult.biomeIds.length; b++) {
      const w = biomeResult.biomeWeights[i][b];
      if (w <= 0.02) continue;
      const profile = getBiomeProfileByIndex(b, biomeResult.biomeIds, biomeResult.profiles);
      minY = Math.min(minY, profile.minY);
      maxY = Math.max(maxY, profile.maxY);
      erosion += profile.erosionStrength * w;
      reliefIntensity += profile.reliefIntensity * w;
      transition += profile.transitionSoftness * w;
      roughness += profile.roughness * w;
      preferred += profile.preferredY * w;
    }

    const localDetail = (climate.biomeRegionMap[i] - 0.5) * (1.5 + roughness * 2.5);
    baseHeight[i] =
      baseHeight[i] * (1 - blendStrength * 0.16) +
      preferred * (blendStrength * 0.16) +
      localDetail * (0.4 + reliefIntensity);

    if (baseHeight[i] < minY) baseHeight[i] = minY + (baseHeight[i] - minY) * (0.35 + transition * 0.45);
    if (baseHeight[i] > maxY) baseHeight[i] = maxY + (baseHeight[i] - maxY) * (0.2 + transition * 0.25);

    baseHeight[i] -= erosion * 1.1;
  }
}

function addMountains(baseHeight, config, landMask, biomeResult, distanceToCoast, climate, geography) {
  const ridgeNoise = createValueNoise2D(`${config.seed}:height:ridge`, 96);
  const { width, height } = config;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const nx = x / width;
      const ny = y / height;
      const ridge = Math.max(0, 1 - Math.abs(fbm2D(ridgeNoise, nx, ny, 4, 2.0, 0.5, 2.2) - 0.5) * 4.2);
      const inland = Math.min(1, distanceToCoast[i] / 30);
      const mountainMass = ridge * inland * climate.mountainPotentialMap[i] * geography.mountainCore[i];
      const plateauMass = geography.plateauZones[i] * (1 - ridge) * 0.6;
      baseHeight[i] += mountainMass * 100 + plateauMass * 24;
    }
  }
}

function addValleys(baseHeight, config, landMask, geography) {
  const valleyNoise = createValueNoise2D(`${config.seed}:height:valley`, 128);
  const { width, height } = config;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const nx = x / width;
      const ny = y / height;
      const n = fbm2D(valleyNoise, nx, ny, 4, 2.0, 0.5, 2.4);
      const valleyMask = Math.max(0, 1 - Math.abs(n - 0.5) * 6.5) * geography.riverBasins[i];
      if (valleyMask <= 0) continue;
      baseHeight[i] -= valleyMask * 16;
    }
  }
}
