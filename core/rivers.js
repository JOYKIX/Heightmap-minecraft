export function carveRivers(heightFloat, landMask, config, biomeMap, biomeIds, geography = null) {
  const { width, height, seaLevel } = config;
  const total = width * height;

  const flowAccum = computeFlowAccumulation(heightFloat, landMask, width, height);
  const riverMask = new Float32Array(total);

  const riverDensity = { none: 0, few: 0.00002, some: 0.00006, many: 0.00012 }[config.riverAmount] ?? 0.00006;
  const targetSources = Math.max(2, Math.floor(total * riverDensity));

  const candidates = [];
  for (let i = 0; i < total; i++) {
    if (!landMask[i]) continue;
    if (heightFloat[i] < seaLevel + 18) continue;
    const flow = flowAccum[i];
    if (flow < 18) continue;
    const biome = biomeIds[biomeMap[i]];
    const affinity = biomeRiverBoost(biome);
    const structural = geography?.riverBasins?.[i] ?? 0.5;
    const score = flow * (0.7 + affinity * 0.2 + structural * 0.1);
    candidates.push([i, score]);
  }

  candidates.sort((a, b) => b[1] - a[1]);

  let carved = 0;
  for (let c = 0; c < candidates.length && carved < targetSources; c++) {
    const source = candidates[c][0];
    if (riverMask[source] > 0.2) continue;
    const ok = traceAndCarveRiver(heightFloat, landMask, riverMask, config, source);
    if (ok) carved++;
  }

  return { rivers: carved, attemptedSources: candidates.length, targetSources, riverMap: riverMask, flowAccumulation: flowAccum };
}

function computeFlowAccumulation(heightFloat, landMask, width, height) {
  const total = width * height;
  const order = new Int32Array(total);
  for (let i = 0; i < total; i++) order[i] = i;
  order.sort((a, b) => heightFloat[b] - heightFloat[a]);

  const flow = new Float32Array(total);
  for (let i = 0; i < total; i++) flow[i] = landMask[i] ? 1 : 0;

  for (let o = 0; o < total; o++) {
    const idx = order[o];
    if (!landMask[idx]) continue;
    const down = findDownhillNeighbor(heightFloat, width, height, idx);
    if (down >= 0 && landMask[down]) flow[down] += flow[idx];
  }

  return flow;
}

function traceAndCarveRiver(heightFloat, landMask, riverMask, config, start) {
  const { width, height, seaLevel } = config;
  let idx = start;
  const path = new Int32Array(2600);
  let pathLen = 0;

  for (let step = 0; step < path.length; step++) {
    if (pathLen >= path.length) break;
    path[pathLen++] = idx;

    if (!landMask[idx] || heightFloat[idx] <= seaLevel + 1) break;

    const next = findDownhillNeighbor(heightFloat, width, height, idx);
    if (next < 0 || next === idx) break;
    if (heightFloat[next] > heightFloat[idx] + 0.35) break;
    idx = next;

    const x = idx % width;
    const y = (idx / width) | 0;
    if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) break;
  }

  if (pathLen < 16) return false;

  for (let p = 0; p < pathLen; p++) {
    const pi = path[p];
    const t = p / Math.max(1, pathLen - 1);
    const riverRadius = t < 0.25 ? 1 : t < 0.65 ? 2 : 3;
    const valleyRadius = riverRadius + 3 + Math.floor(t * 3);
    digRiverBed(heightFloat, riverMask, width, height, pi % width, (pi / width) | 0, riverRadius, t);
    carveValley(heightFloat, width, height, pi % width, (pi / width) | 0, valleyRadius, t);
  }

  return true;
}

function findDownhillNeighbor(heightFloat, width, height, idx) {
  const x = idx % width;
  const y = (idx / width) | 0;

  let next = -1;
  let bestHeight = heightFloat[idx];

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const ni = yy * width + xx;
      const n = heightFloat[ni];
      if (n < bestHeight) {
        bestHeight = n;
        next = ni;
      }
    }
  }

  return next;
}

function digRiverBed(heightFloat, riverMask, width, height, x, y, radius, t) {
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const d = Math.hypot(ox, oy);
      if (d > radius + 0.25) continue;
      const i = yy * width + xx;
      const depth = Math.max(0.6, (2.6 + t * 2.2) - d * 1.25);
      heightFloat[i] -= depth;
      riverMask[i] = Math.max(riverMask[i], Math.max(0, 1 - d / (radius + 0.001)));
    }
  }
}

function carveValley(heightFloat, width, height, x, y, radius, t) {
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const d = Math.hypot(ox, oy);
      if (d > radius + 0.2) continue;
      const i = yy * width + xx;
      const valleyInfluence = Math.max(0, 1 - d / (radius + 0.0001));
      const bowl = valleyInfluence * (0.45 + t * 1.25);
      heightFloat[i] -= bowl;
    }
  }
}

function biomeRiverBoost(biome) {
  if (biome === 'jungle' || biome === 'swamp') return 1.4;
  if (biome === 'desert') return 0.35;
  if (biome === 'mountains') return 1.2;
  return 1;
}
