import { createRng } from './random.js';

export function carveRivers(heightFloat, landMask, config, biomeMap, biomeIds) {
  const { width, height, seaLevel, seed } = config;
  const rng = createRng(`${seed}:rivers`);
  const sources = [];
  const riverDensity = { none: 0, few: 0.00003, some: 0.00008, many: 0.00016 }[config.riverAmount] ?? 0.00008;
  const targetSources = Math.max(2, Math.floor(width * height * riverDensity));

  for (let i = 0; i < heightFloat.length && sources.length < targetSources * 6; i += 17) {
    if (!landMask[i]) continue;
    const biome = biomeIds[biomeMap[i]];
    const affinity = biomeRiverBoost(biome);
    if (heightFloat[i] < seaLevel + 25) continue;
    if (rng() < 0.07 * affinity) sources.push(i);
  }

  let carved = 0;
  for (let s = 0; s < sources.length && carved < targetSources; s++) {
    const ok = traceAndCarveRiver(heightFloat, landMask, config, biomeMap, biomeIds, sources[s], rng);
    if (ok) carved++;
  }

  return { rivers: carved, attemptedSources: sources.length, targetSources };
}

function traceAndCarveRiver(heightFloat, landMask, config, biomeMap, biomeIds, start, rng) {
  const { width, height, seaLevel } = config;
  let idx = start;
  let lastHeight = heightFloat[idx];
  const path = new Int32Array(2200);
  let pathLen = 0;

  for (let step = 0; step < path.length; step++) {
    if (pathLen >= path.length) break;
    path[pathLen++] = idx;

    if (!landMask[idx] || heightFloat[idx] <= seaLevel + 1) break;
    const x = idx % width;
    const y = (idx / width) | 0;

    let next = idx;
    let bestScore = Infinity;

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
        const ni = yy * width + xx;
        const dh = heightFloat[ni] - heightFloat[idx];
        const meander = (rng() - 0.5) * 0.35;
        const score = dh + meander;
        if (score < bestScore) {
          bestScore = score;
          next = ni;
        }
      }
    }

    if (next === idx) break;

    const nextHeight = heightFloat[next];
    if (nextHeight > lastHeight + 0.2) break;

    idx = next;
    lastHeight = Math.min(lastHeight, nextHeight);

    if (!landMask[idx]) break;
  }

  if (pathLen < 14) return false;

  for (let p = 0; p < pathLen; p++) {
    const pi = path[p];
    const biome = biomeIds[biomeMap[pi]];
    const widthFactor = biome === 'jungle' || biome === 'swamp' || biome === 'plains' ? 2 : 1;
    digRiverBed(heightFloat, width, height, pi % width, (pi / width) | 0, widthFactor);
    carveValley(heightFloat, width, height, pi % width, (pi / width) | 0, widthFactor + 3);
  }

  return true;
}

function digRiverBed(heightFloat, width, height, x, y, radius) {
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const d = Math.hypot(ox, oy);
      if (d > radius + 0.2) continue;
      const i = yy * width + xx;
      heightFloat[i] -= Math.max(0.5, 2.8 - d * 1.15);
    }
  }
}

function carveValley(heightFloat, width, height, x, y, radius) {
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const d = Math.hypot(ox, oy);
      if (d > radius + 0.2) continue;
      const i = yy * width + xx;
      const valleyInfluence = Math.max(0, 1 - d / (radius + 0.0001));
      heightFloat[i] -= valleyInfluence * 0.8;
    }
  }
}

function biomeRiverBoost(biome) {
  if (biome === 'jungle' || biome === 'swamp') return 1.55;
  if (biome === 'desert') return 0.35;
  if (biome === 'mountains') return 1.15;
  return 1;
}
