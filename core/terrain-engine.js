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
import { applyAdvancedErosion } from './erosion.js';
import { cleanupHeights, quantizeToMinecraftY, validateHeightmap } from './cleanup.js';
import { heightToGrayscale, minecraftYToGray } from './worldpainter.js';

export function generateTerrain(config) {
  const started = performance.now();
  const steps = [];
  const mark = (label) => steps.push(label);

  mark('1. Créer une structure globale');
  const finalConfig = { ...config };

  let landPotential;
  let cleanMask;
  let coverageStats;

  for (let attempt = 0; attempt < 4; attempt++) {
    mark('2. Créer une landmass réaliste');
    landPotential = generateLandPotential(finalConfig);

    mark('3. Appliquer ocean border obligatoire');
    applyOceanBorderMask(landPotential, finalConfig);

    mark('4. Déterminer les bassins (mask de terre)');
    const coverage = createLandMaskByCoverage(landPotential, finalConfig);
    coverageStats = coverage;

    cleanMask = cleanupLandMask(coverage.mask, finalConfig.width, finalConfig.height, 4);
    enforceOceanEdges(cleanMask, finalConfig.width, finalConfig.height);
    if (validateNoLandTouchesEdges(cleanMask, finalConfig.width, finalConfig.height)) break;
  }

  const { width, height } = finalConfig;

  mark('5. Générer distances côte/terre');
  const { distanceToCoast, distanceToLand } = computeDistanceFields(cleanMask, width, height);

  mark('6. Construire worldStructureMap + direction field');
  const geography = generateGeographySkeleton(finalConfig, cleanMask, distanceToCoast);

  mark('7. Générer climate maps');
  const climate = generateClimateMaps(finalConfig, {
    landMask: cleanMask,
    distanceToCoast,
    geography
  });

  mark('8. Générer biomes + biomeWeights');
  const biomeResult = generateBiomeMap(finalConfig, {
    landMask: cleanMask,
    distanceToCoast,
    geography,
    ...climate
  });

  mark('9. Générer grandes altitudes (macro+meso+micro)');
  const baseHeight = buildBaseHeights(finalConfig, cleanMask, biomeResult, distanceToCoast, climate, geography);

  mark('10. Appliquer reliefs spécifiques par biome');
  applyBiomeRelief(baseHeight, finalConfig, cleanMask, biomeResult, climate, geography);

  mark('11. Générer montagnes en chaînes et crêtes');
  addMountains(baseHeight, finalConfig, cleanMask, biomeResult, distanceToCoast, climate, geography);

  mark('12. Générer vallées et bassins de convergence');
  addValleys(baseHeight, finalConfig, cleanMask, geography);

  mark('13. Générer rivières (sources, drainage, embouchures)');
  const riverStats = carveRivers(baseHeight, cleanMask, finalConfig, biomeResult.biomeMap, biomeResult.biomeIds, geography);

  mark('14. Générer côtes et océan réalistes');
  shapeOceanAndCoast(baseHeight, cleanMask, distanceToLand, finalConfig.seaLevel);

  mark('15. Érosion avancée (thermal + hydraulic simplifiée)');
  applyAdvancedErosion(baseHeight, width, height, cleanMask, 2, 0.2);

  mark('16. Nettoyage final');
  cleanupHeights(baseHeight, finalConfig, cleanMask);

  mark('17. Quantification Minecraft Y');
  const yInt = quantizeToMinecraftY(baseHeight, finalConfig.minY, finalConfig.maxY);

  mark('18. Convertir en grayscale WorldPainter');
  const grayscale = heightToGrayscale(yInt, finalConfig.minY, finalConfig.maxY);

  mark('19. Générer debug maps');
  const slopeMap = computeSlopeMap(yInt, width, height, cleanMask);
  const debugMaps = {
    biomeMap: biomeResult.biomeMap,
    ridgeMap: geography.mainRidgeLine,
    moistureMap: climate.moistureMap,
    terrainDirection: geography.terrainDirectionField,
    basinMap: geography.riverBasins,
    slopeMap,
    riverMap: riverStats.riverMap,
    coastDistanceMap: distanceToCoast,
    flowAccumulationMap: riverStats.flowAccumulation,
    worldStructureMap: geography.worldStructureMap
  };

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
    debugMaps,
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
  const mesoNoise = createValueNoise2D(`${config.seed}:height:meso`, 156);
  const microNoise = createValueNoise2D(`${config.seed}:height:micro`, 220);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) {
        const offshore = Math.min(1, distanceToCoast[i] / 100);
        out[i] = seaLevel - 2 - offshore * 64;
        continue;
      }

      const nx = x / width;
      const ny = y / height;
      const macro = fbm2D(macroNoise, nx, ny, 4, 2.0, 0.5, 1.05);
      const meso = fbm2D(mesoNoise, nx, ny, 3, 2.1, 0.55, 2.9);
      const micro = fbm2D(microNoise, nx, ny, 2, 2.0, 0.55, 7.2);
      const inland = Math.min(1, distanceToCoast[i] / 28);

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

      const structure = geography.worldStructureMap[i];
      const ridge = geography.mainRidgeLine[i];
      const basin = geography.lowlandBasins[i];
      const plateau = geography.plateauZones[i];

      const h =
        seaLevel +
        (macro - 0.5) * (30 + roughness * 24) +
        (meso - 0.5) * (15 + roughness * 13) +
        (micro - 0.5) * (4 + roughness * 7) +
        inland * 11 +
        climate.elevationIntentMap[i] * 26 +
        structure * 8 +
        ridge * 24 +
        plateau * 13 -
        basin * 14;

      out[i] = h * (1 - flatness * 0.12) + preferred * (0.12 + flatness * 0.1);
    }
  }

  return out;
}

function applyBiomeRelief(baseHeight, config, landMask, biomeResult, climate, geography) {
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
      if (w <= 0.015) continue;
      const profile = getBiomeProfileByIndex(b, biomeResult.biomeIds, biomeResult.profiles);
      minY = Math.min(minY, profile.minY);
      maxY = Math.max(maxY, profile.maxY);
      erosion += profile.erosionStrength * w;
      reliefIntensity += profile.reliefIntensity * w;
      transition += profile.transitionSoftness * w;
      roughness += profile.roughness * w;
      preferred += profile.preferredY * w;
    }

    const regional = (climate.biomeRegionMap[i] - 0.5) * (1.8 + roughness * 2.8);
    const structureDetail = (geography.worldStructureMap[i] - geography.riverBasins[i]) * (1.2 + reliefIntensity);
    baseHeight[i] =
      baseHeight[i] * (1 - blendStrength * 0.18) +
      preferred * (blendStrength * 0.18) +
      regional * (0.42 + reliefIntensity) +
      structureDetail;

    if (baseHeight[i] < minY) baseHeight[i] = minY + (baseHeight[i] - minY) * (0.36 + transition * 0.42);
    if (baseHeight[i] > maxY) baseHeight[i] = maxY + (baseHeight[i] - maxY) * (0.22 + transition * 0.22);

    baseHeight[i] -= erosion * 1.18;
  }
}

function addMountains(baseHeight, config, landMask, biomeResult, distanceToCoast, climate, geography) {
  const ridgeNoise = createValueNoise2D(`${config.seed}:height:ridge`, 82);
  const chainNoise = createValueNoise2D(`${config.seed}:height:chain`, 68);
  const { width, height } = config;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const nx = x / width;
      const ny = y / height;
      const ridge = Math.max(0, 1 - Math.abs(fbm2D(ridgeNoise, nx, ny, 4, 2.0, 0.5, 2.0) - 0.5) * 4.5);
      const chain = Math.max(0, 1 - Math.abs(fbm2D(chainNoise, nx * 0.8, ny * 1.2, 3, 2.0, 0.52, 1.25) - 0.5) * 3.8);
      const inland = Math.min(1, distanceToCoast[i] / 32);
      const direction = geography.terrainDirectionField[i];
      const directional = Math.max(0, Math.cos(nx * Math.cos(direction) * 16 + ny * Math.sin(direction) * 16 + direction));

      const mountainMass = ridge * chain * directional * inland * climate.mountainPotentialMap[i] * geography.mountainCore[i];
      const piedmont = geography.mountainCore[i] * (1 - ridge) * 0.45;
      const plateauMass = geography.plateauZones[i] * (1 - ridge) * 0.55;
      baseHeight[i] += mountainMass * 112 + piedmont * 24 + plateauMass * 21;

      const biome = biomeResult.biomeIds[biomeResult.biomeMap[i]];
      if (biome === 'mountains' || biome === 'tundra') {
        baseHeight[i] += mountainMass * 18;
      }
    }
  }
}

function addValleys(baseHeight, config, landMask, geography) {
  const valleyNoise = createValueNoise2D(`${config.seed}:height:valley`, 112);
  const broadValleyNoise = createValueNoise2D(`${config.seed}:height:valley:broad`, 64);
  const { width, height } = config;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;

      const nx = x / width;
      const ny = y / height;
      const basin = geography.riverBasins[i];
      const directional = geography.terrainDirectionField[i];
      const valley = Math.max(0, 1 - Math.abs(fbm2D(valleyNoise, nx, ny, 3, 2.0, 0.52, 1.8) - 0.5) * 4.1);
      const broad = Math.max(0, 1 - Math.abs(fbm2D(broadValleyNoise, nx * 0.7, ny * 1.3, 2, 2.0, 0.5, 0.95) - 0.5) * 2.3);
      const oriented = Math.max(0, Math.sin(nx * Math.cos(directional) * 9 + ny * Math.sin(directional) * 9 + directional));

      const carve = valley * basin * 8 + broad * basin * oriented * 10;
      baseHeight[i] -= carve;
    }
  }
}

function computeSlopeMap(yInt, width, height, landMask) {
  const out = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (!landMask[i]) continue;
      let maxDiff = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const ni = (y + oy) * width + (x + ox);
          const d = Math.abs(yInt[i] - yInt[ni]);
          if (d > maxDiff) maxDiff = d;
        }
      }
      out[i] = Math.min(1, maxDiff / 22);
    }
  }

  return out;
}
