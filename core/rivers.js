export function carveRivers(heightFloat, landMask, config, biomeMap, biomeIds, geography = null) {
  const { width, height, seaLevel } = config;
  const total = width * height;

  const { flowAccum, receiver } = computeFlowAccumulation(heightFloat, landMask, width, height);
  const riverMask = new Float32Array(total);
  const sourceMask = new Uint8Array(total);

  const riverDensity = { none: 0, few: 0.00002, some: 0.00006, many: 0.00012 }[config.riverAmount] ?? 0.00006;
  const targetSources = Math.max(2, Math.floor(total * riverDensity));
  const minSourceSpacing = Math.max(10, Math.round(Math.min(width, height) * 0.045));

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
    if (sourceMask[source]) continue;
    const ok = traceAndCarveRiver(heightFloat, landMask, riverMask, config, source, receiver);
    if (ok) carved++;
    if (ok) stampSourceExclusion(sourceMask, width, height, source, minSourceSpacing);
  }

  return { rivers: carved, attemptedSources: candidates.length, targetSources, riverMap: riverMask, flowAccumulation: flowAccum };
}

function computeFlowAccumulation(heightFloat, landMask, width, height) {
  const total = width * height;
  const order = new Int32Array(total);
  for (let i = 0; i < total; i++) order[i] = i;
  order.sort((a, b) => heightFloat[b] - heightFloat[a]);

  const flow = new Float32Array(total);
  const receiver = new Int32Array(total);
  receiver.fill(-1);
  for (let i = 0; i < total; i++) flow[i] = landMask[i] ? 1 : 0;

  for (let o = 0; o < total; o++) {
    const idx = order[o];
    if (!landMask[idx]) continue;
    const down = findDownhillNeighbor(heightFloat, width, height, idx);
    receiver[idx] = down;
    if (down >= 0 && landMask[down]) flow[down] += flow[idx];
  }

  return { flowAccum: flow, receiver };
}

function traceAndCarveRiver(heightFloat, landMask, riverMask, config, start, receiver) {
  const { width, height, seaLevel } = config;
  let idx = start;
  const path = new Int32Array(2600);
  const visited = new Uint8Array(width * height);
  let pathLen = 0;

  for (let step = 0; step < path.length; step++) {
    if (pathLen >= path.length) break;
    if (visited[idx]) break;
    visited[idx] = 1;
    path[pathLen++] = idx;

    if (!landMask[idx] || heightFloat[idx] <= seaLevel + 1) break;

    let next = receiver?.[idx] ?? -1;
    if (next < 0 || next === idx) {
      next = breachLocalDepression(heightFloat, landMask, width, height, idx);
    }
    if (next < 0 || next === idx) break;
    if (heightFloat[next] > heightFloat[idx] + 1.1) break;
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
    softenRiverBanks(heightFloat, width, height, pi % width, (pi / width) | 0, riverRadius + 2);
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

function breachLocalDepression(heightFloat, landMask, width, height, idx) {
  const x = idx % width;
  const y = (idx / width) | 0;
  let best = -1;
  let bestHeight = Infinity;

  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (!ox && !oy) continue;
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const ni = yy * width + xx;
      if (!landMask[ni]) continue;
      const n = heightFloat[ni];
      if (n < bestHeight) {
        bestHeight = n;
        best = ni;
      }
    }
  }

  if (best < 0) return -1;

  const current = heightFloat[idx];
  if (bestHeight >= current - 0.15) {
    heightFloat[best] = current - 0.2;
  }
  return best;
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

function softenRiverBanks(heightFloat, width, height, x, y, radius) {
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const d = Math.hypot(ox, oy);
      if (d > radius + 0.2 || d < radius * 0.45) continue;
      const i = yy * width + xx;
      const ring = 1 - Math.abs(d - radius * 0.75) / (radius * 0.75 + 0.001);
      heightFloat[i] -= Math.max(0, ring) * 0.32;
    }
  }
}

function stampSourceExclusion(mask, width, height, center, radius) {
  const cx = center % width;
  const cy = (center / width) | 0;
  const r2 = radius * radius;
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const xx = cx + ox;
      const yy = cy + oy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      if (ox * ox + oy * oy > r2) continue;
      mask[yy * width + xx] = 1;
    }
  }
}

function biomeRiverBoost(biome) {
  if (biome === 'jungle' || biome === 'swamp') return 1.4;
  if (biome === 'desert') return 0.35;
  if (biome === 'mountains') return 1.2;
  return 1;
}
