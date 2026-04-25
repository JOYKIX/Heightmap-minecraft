import { BIOME_ORDER, resolveBiomeProfiles } from '../data/biome-profiles.js';
import { createValueNoise2D, fbm2D } from './noise.js';

const LAND_BIOMES = BIOME_ORDER.filter((b) => !['coast', 'ocean'].includes(b));

export function generateClimateMaps(config, context) {
  const { width, height, seed } = config;
  const { landMask, distanceToCoast, geography } = context;

  const moistureMap = new Float32Array(width * height);
  const temperatureMap = new Float32Array(width * height);
  const elevationIntentMap = new Float32Array(width * height);
  const mountainPotentialMap = new Float32Array(width * height);
  const riverInfluenceMap = new Float32Array(width * height);
  const biomeRegionMap = new Float32Array(width * height);

  const moistNoise = createValueNoise2D(`${seed}:climate:moisture`, 84);
  const tempNoise = createValueNoise2D(`${seed}:climate:temp`, 96);
  const elevNoise = createValueNoise2D(`${seed}:climate:elev`, 80);
  const mountainNoise = createValueNoise2D(`${seed}:climate:mountain`, 68);
  const rainShadowNoise = createValueNoise2D(`${seed}:climate:rainshadow`, 74);
  const regionNoise = createValueNoise2D(`${seed}:biome:region`, 42);

  for (let y = 0; y < height; y++) {
    const latitude = Math.abs((y / Math.max(1, height - 1)) * 2 - 1);
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const nx = x / width;
      const ny = y / height;
      const coastInfluence = Math.min(1, distanceToCoast[i] / 32);
      const ridge = geography?.mainRidgeLine?.[i] ?? 0;
      const mountainCore = geography?.mountainCore?.[i] ?? 0;
      const basin = geography?.riverBasins?.[i] ?? 0;
      const structure = geography?.worldStructureMap?.[i] ?? 0;

      const m = fbm2D(moistNoise, nx, ny, 4, 2.0, 0.5, 2.0);
      const t = fbm2D(tempNoise, nx, ny, 4, 2.0, 0.5, 2.2);
      const e = fbm2D(elevNoise, nx, ny, 3, 2.0, 0.5, 1.5);
      const mountainN = fbm2D(mountainNoise, nx, ny, 3, 2.0, 0.55, 1.8);
      const shadow = fbm2D(rainShadowNoise, nx * 0.8 + 0.14, ny * 1.2 - 0.12, 3, 2.0, 0.54, 1.45);
      const regionN = fbm2D(regionNoise, nx, ny, 2, 2.0, 0.5, 1.1);

      if (!landMask[i]) {
        moistureMap[i] = 1;
        temperatureMap[i] = 0.5;
        elevationIntentMap[i] = 0;
        mountainPotentialMap[i] = 0;
        riverInfluenceMap[i] = 0;
        biomeRegionMap[i] = regionN;
        continue;
      }

      const rainShadow = mountainCore * 0.35 * (0.55 + (shadow - 0.5) * 0.45);
      moistureMap[i] = clamp01(m * 0.58 + (1 - coastInfluence) * 0.18 + basin * 0.23 + (1 - ridge) * 0.07 - rainShadow + 0.06);
      temperatureMap[i] = clamp01(t * 0.68 + (1 - latitude) * 0.2 - mountainCore * 0.2 - latitude * 0.12 + (1 - structure) * 0.06);
      elevationIntentMap[i] = clamp01(e * 0.38 + ridge * 0.3 + mountainCore * 0.2 + coastInfluence * 0.1 + structure * 0.08);
      mountainPotentialMap[i] = clamp01(mountainN * 0.35 + ridge * 0.35 + mountainCore * 0.2 + structure * 0.1);
      riverInfluenceMap[i] = clamp01(basin * 0.52 + (1 - coastInfluence) * 0.18 + (1 - mountainCore) * 0.15 + moistureMap[i] * 0.15);
      biomeRegionMap[i] = regionN;
    }
  }

  return { moistureMap, temperatureMap, elevationIntentMap, mountainPotentialMap, riverInfluenceMap, biomeRegionMap };
}

export function generateBiomeMap(config, context) {
  const { width, height, seed } = config;
  const {
    landMask,
    distanceToCoast,
    moistureMap,
    temperatureMap,
    elevationIntentMap,
    mountainPotentialMap,
    riverInfluenceMap,
    biomeRegionMap,
    geography
  } = context;

  const profiles = resolveBiomeProfiles(config);
  const biomeIds = ['ocean', 'coast', ...LAND_BIOMES.filter((id) => profiles[id]?.enabled !== false)];
  const biomeToIndex = Object.fromEntries(biomeIds.map((id, i) => [id, i]));

  const biomeWeights = Array.from({ length: width * height }, () => new Float32Array(biomeIds.length));
  const biomeMap = new Uint8Array(width * height);

  const regionNoises = Object.fromEntries(
    biomeIds.map((id) => [id, createValueNoise2D(`${seed}:biome:${id}`, Math.max(32, Math.round(90 * (1 - (profiles[id]?.regionSize ?? 0.5) * 0.72))))])
  );

  const targets = Object.fromEntries(biomeIds.map((id) => [id, (profiles[id]?.targetPercent ?? 0) / 100]));

  for (let i = 0; i < biomeMap.length; i++) {
    const weights = biomeWeights[i];
    if (!landMask[i]) {
      weights[biomeToIndex.ocean] = 1;
      biomeMap[i] = biomeToIndex.ocean;
      continue;
    }

    if (distanceToCoast[i] <= 2) {
      weights[biomeToIndex.coast] = 1;
      biomeMap[i] = biomeToIndex.coast;
      continue;
    }

    const x = i % width;
    const y = (i / width) | 0;
    const nx = x / width;
    const ny = y / height;
    const structure = geography?.worldStructureMap?.[i] ?? 0;
    const basin = geography?.riverBasins?.[i] ?? 0;

    for (let b = 0; b < biomeIds.length; b++) {
      const id = biomeIds[b];
      if (id === 'ocean' || id === 'coast') continue;
      const profile = profiles[id];
      if (!profile || profile.enabled === false) continue;

      const region = fbm2D(regionNoises[id], nx, ny, 2, 2.0, 0.52, 1.2 + (1 - profile.regionSize) * 1.7);
      const climateMatch =
        0.25 * (1 - Math.abs(moistureMap[i] - profile.moistureAffinity)) +
        0.2 * (1 - Math.abs(temperatureMap[i] - profile.temperatureAffinity)) +
        0.16 * (1 - Math.abs(riverInfluenceMap[i] - profile.riverAffinity)) +
        0.16 * (1 - Math.abs(mountainPotentialMap[i] - profile.mountainAffinity)) +
        0.1 * (1 - Math.abs((1 - Math.min(1, distanceToCoast[i] / 34)) - profile.coastAffinity));

      const reliefMatch = 1 - Math.abs(elevationIntentMap[i] - normalizedAltitude(profile.preferredY));
      const geoBias = 1 - Math.abs(structure - profile.mountainAffinity * 0.75) * 0.6 + basin * profile.riverAffinity * 0.2;

      const score =
        climateMatch * 0.68 +
        reliefMatch * 0.14 +
        geoBias * 0.08 +
        biomeRegionMap[i] * 0.05 +
        region * 0.05;

      weights[b] = Math.max(0.0001, score);
    }

    normalizeWeights(weights);
    applyTargetBias(weights, biomeIds, targets, profiles);

    let bestIndex = 0;
    let bestWeight = -1;
    for (let b = 0; b < weights.length; b++) {
      if (weights[b] > bestWeight) {
        bestWeight = weights[b];
        bestIndex = b;
      }
    }
    biomeMap[i] = bestIndex;
  }

  smoothBiomeRegions(biomeMap, width, height, biomeToIndex.coast, biomeToIndex.ocean);
  return { biomeMap, biomeIds, biomeToIndex, biomeWeights, profiles };
}

function applyTargetBias(weights, biomeIds, targets, profiles) {
  for (let i = 0; i < biomeIds.length; i++) {
    const id = biomeIds[i];
    const target = targets[id];
    if (!target) continue;
    const soft = profiles[id]?.transitionSoftness ?? 0.5;
    weights[i] *= 0.78 + target * (0.65 + soft * 0.7);
  }
  normalizeWeights(weights);
}

function smoothBiomeRegions(biomeMap, width, height, coastIdx, oceanIdx) {
  const src = new Uint8Array(biomeMap);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (src[i] === coastIdx || src[i] === oceanIdx) continue;
      const counts = new Uint16Array(48);
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

export function calculateBiomeStats(biomeMap, biomeIds, profiles = {}) {
  const counts = new Array(biomeIds.length).fill(0);
  for (let i = 0; i < biomeMap.length; i++) counts[biomeMap[i]]++;
  const total = biomeMap.length;
  const byBiome = {};
  const warnings = [];
  biomeIds.forEach((id, i) => {
    const real = (counts[i] / total) * 100;
    const target = profiles[id]?.targetPercent ?? null;
    byBiome[id] = { target, real };
    if (target !== null && target > 0 && Math.abs(real - target) > Math.max(3, target * 0.6)) {
      warnings.push(`Biome ${id}: cible ${target.toFixed(1)}% vs réel ${real.toFixed(1)}%`);
    }
  });
  return { byBiome, warnings };
}

export function getBiomeProfileByIndex(index, biomeIds, profiles = null) {
  const id = biomeIds[index] || 'plains';
  const resolved = profiles || resolveBiomeProfiles({});
  return resolved[id] || resolved.plains;
}

function normalizeWeights(weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i];
  if (sum <= 0) return;
  for (let i = 0; i < weights.length; i++) weights[i] /= sum;
}

function normalizedAltitude(y) {
  return clamp01((y - 62) / 170);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
