importScripts('biome-profiles.js');

const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const SURFACE_MIN_Y = 20;
const SURFACE_MAX_Y = 260;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const fract = (v) => v - Math.floor(v);
const idx = (x, y, width) => y * width + x;

const BIOMES = self.BIOME_SYSTEM.BIOME_PROFILES;

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueNoise(x, y, seed) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 57.3) * 43758.5453123);
}

function noise2D(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const n00 = valueNoise(xi, yi, seed);
  const n10 = valueNoise(xi + 1, yi, seed);
  const n01 = valueNoise(xi, yi + 1, seed);
  const n11 = valueNoise(xi + 1, yi + 1, seed);
  const u = smoothstep(xf);
  const v = smoothstep(yf);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

function fbm(x, y, seed, octaves = 5, lacunarity = 2, gain = 0.5) {
  let f = 1;
  let a = 1;
  let total = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    total += noise2D(x * f, y * f, seed + i * 31.7) * a;
    norm += a;
    f *= lacunarity;
    a *= gain;
  }
  return total / Math.max(0.0001, norm);
}

function ridged(x, y, seed, sharpness = 1.5) {
  const n = fbm(x, y, seed, 5, 2.03, 0.52) * 2 - 1;
  return Math.pow(1 - Math.abs(n), sharpness);
}

function createLandPotential(x, y, width, height, cfg, seedNum) {
  const nx = x / Math.max(1, width - 1) - 0.5;
  const ny = y / Math.max(1, height - 1) - 0.5;

  const baseShape = cfg.shapeElongation;
  const warpedX = nx * baseShape.x + (fbm(nx * 3.2, ny * 3.2, seedNum + 11, 4, 2.1, 0.5) - 0.5) * cfg.domainWarp;
  const warpedY = ny * baseShape.y + (fbm(nx * 3.2, ny * 3.2, seedNum + 17, 4, 2.1, 0.5) - 0.5) * cfg.domainWarp;

  const d = Math.hypot(warpedX, warpedY);
  const normalized = d / Math.max(0.18, cfg.mainIslandRadius);
  const radial = 1 - smoothstep(clamp(normalized, 0, 1));

  const lowFreq = fbm(nx * 2.0, ny * 2.0, seedNum + 23, 5, 2.0, 0.52);
  const coast = fbm(nx * 10.5, ny * 10.5, seedNum + 29, 4, 2.18, 0.46);
  const fracture = ridged(nx * 7.0, ny * 7.0, seedNum + 31, 1.2 + cfg.coastSharpness * 1.1);

  const borderN = Math.min(x, y, width - 1 - x, height - 1 - y) / Math.max(1, Math.min(width, height));
  const borderMask = smoothstep(clamp((borderN - cfg.oceanBorderNormalized) / Math.max(0.0001, 0.18), 0, 1));

  return clamp(radial * 0.62 + lowFreq * 0.22 + coast * cfg.coastComplexity + (fracture - 0.5) * 0.1, 0, 1) * borderMask;
}

function adaptiveLandMask(potential, targetCoverage) {
  const sorted = Array.from(potential);
  sorted.sort((a, b) => a - b);
  const thresholdIndex = Math.max(0, Math.min(sorted.length - 1, Math.floor((1 - targetCoverage) * (sorted.length - 1))));
  const threshold = sorted[thresholdIndex];
  const mask = new Uint8Array(potential.length);
  let land = 0;
  for (let i = 0; i < potential.length; i += 1) {
    const value = potential[i] >= threshold ? 1 : 0;
    mask[i] = value;
    land += value;
  }
  return { mask, threshold, landRatio: land / potential.length };
}

function cleanupMask(mask, width, height) {
  let removedMicroIslands = 0;
  let removedWaterHoles = 0;
  const out = new Uint8Array(mask);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y, width);
      const c = mask[i];
      let same = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          if (mask[idx(x + ox, y + oy, width)] === c) same += 1;
        }
      }
      if (c === 1 && same <= 1) {
        out[i] = 0;
        removedMicroIslands += 1;
      }
      if (c === 0 && same <= 1) {
        out[i] = 1;
        removedWaterHoles += 1;
      }
    }
  }

  mask.set(out);
  return { removedMicroIslands, removedWaterHoles };
}

function distanceToCoast(mask, width, height) {
  const dist = new Float32Array(mask.length);
  const maxD = Math.max(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const isLand = mask[i] === 1;
      let nearest = maxD;
      for (let r = 1; r < 36; r += 1) {
        let found = false;
        for (let oy = -r; oy <= r; oy += 1) {
          for (let ox = -r; ox <= r; ox += 1) {
            const xx = x + ox;
            const yy = y + oy;
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
            const j = idx(xx, yy, width);
            if ((mask[j] === 1) !== isLand) {
              nearest = Math.hypot(ox, oy);
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      dist[i] = nearest;
    }
  }
  return dist;
}

function climateSuitability(profile, moisture, temperature, altitude, coastalness) {
  const mCenter = (profile.moistureRange[0] + profile.moistureRange[1]) * 0.5;
  const tCenter = (profile.temperatureRange[0] + profile.temperatureRange[1]) * 0.5;
  const mWidth = Math.max(0.05, (profile.moistureRange[1] - profile.moistureRange[0]) * 0.5);
  const tWidth = Math.max(0.05, (profile.temperatureRange[1] - profile.temperatureRange[0]) * 0.5);
  const mScore = 1 - clamp(Math.abs(moisture - mCenter) / mWidth, 0, 1.4);
  const tScore = 1 - clamp(Math.abs(temperature - tCenter) / tWidth, 0, 1.4);

  const altScore = 1 - clamp(Math.abs(altitude - profile.preferredAltitude) / Math.max(8, profile.maxAltitude - profile.minAltitude), 0, 1.4);
  const coastScore = 1 - Math.abs(coastalness - profile.coastAffinity);
  return mScore * 0.34 + tScore * 0.3 + altScore * 0.28 + coastScore * 0.08;
}

function computeBiomeHeight(profile, x, y, width, height, baseHeight, seedNum, inland, moisture) {
  const nx = x / width;
  const ny = y / height;
  const macro = fbm(nx * (1.5 + profile.noiseScale), ny * (1.5 + profile.noiseScale), seedNum + 1200 + profile.preferredAltitude, 4, 2.04, 0.52);
  const micro = fbm(nx * (5.1 + profile.noiseScale * 1.7), ny * (5.1 + profile.noiseScale * 1.7), seedNum + 2300 + profile.maxAltitude, 3, 2.2, 0.46);
  const ridge = ridged(nx * (4 + profile.mountainInfluence * 3), ny * (4 + profile.mountainInfluence * 3), seedNum + 3300 + profile.minAltitude, 1.3 + profile.mountainInfluence * 1.2);

  let h = lerp(baseHeight, profile.preferredAltitude, 0.54 + profile.flatness * 0.1);
  h += (macro - 0.5) * 16 * profile.roughness;
  h += (micro - 0.5) * 10 * profile.roughness;
  h += ridge * profile.mountainInfluence * 42 * inland;

  if (profile.id === 'plains') h = lerp(h, Math.round(h / 2) * 2, profile.flatness * 0.62);
  if (profile.id === 'mountains') h += Math.pow(ridge, 1.1) * 55;
  if (profile.id === 'plateau') h = lerp(h, profile.preferredAltitude + (macro - 0.5) * 8, 0.72);
  if (profile.id === 'canyon') {
    const terrace = Math.round((h - profile.minAltitude) / 6) * 6 + profile.minAltitude;
    const ravine = Math.pow(ridged(nx * 8.2, ny * 8.2, seedNum + 7777, 2), 1.2);
    h = lerp(h, terrace, 0.6) - ravine * 18 * profile.valleyStrength;
  }
  if (profile.id === 'swamp') {
    h = lerp(h, profile.preferredAltitude + (macro - 0.5) * 3, 0.85);
    h -= Math.max(0, moisture - 0.72) * 4;
  }
  if (profile.id === 'desert') {
    const dunes = fbm(nx * 10.5, ny * 10.5, seedNum + 4400, 3, 2.1, 0.45);
    h += (dunes - 0.5) * 8;
  }
  return clamp(h, profile.minAltitude, profile.maxAltitude);
}

function estimateBiomeRegions(biomeMap, width, height, oceanIndex) {
  const visited = new Uint8Array(biomeMap.length);
  let regions = 0;
  const qx = new Int32Array(biomeMap.length);
  const qy = new Int32Array(biomeMap.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = idx(x, y, width);
      if (visited[start] || biomeMap[start] === oceanIndex) continue;
      regions += 1;
      const biome = biomeMap[start];
      let head = 0;
      let tail = 0;
      visited[start] = 1;
      qx[tail] = x; qy[tail] = y; tail += 1;
      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head += 1;
        const nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (let n = 0; n < 4; n += 1) {
          const xx = cx + nb[n][0];
          const yy = cy + nb[n][1];
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const ni = idx(xx, yy, width);
          if (visited[ni] || biomeMap[ni] !== biome) continue;
          visited[ni] = 1;
          qx[tail] = xx; qy[tail] = yy; tail += 1;
        }
      }
    }
  }
  return regions;
}

function generate(payload) {
  const { cfg, phase } = payload;
  const width = cfg.width;
  const height = cfg.height;
  const len = width * height;

  const seedNum = hashString(`${cfg.seed}-${cfg.targetWidth}-${cfg.targetHeight}-${phase}`);
  const rng = mulberry32(seedNum ^ 0x9abcde);
  const post = (step, progress) => self.postMessage({ type: 'progress', step, progress });

  const map = new Float32Array(len);
  const baseHeight = new Float32Array(len);
  const moistureMap = new Float32Array(len);
  const temperatureMap = new Float32Array(len);
  const biomeInfluenceMap = new Float32Array(len);
  const potential = new Float32Array(len);
  const heights = new Uint16Array(len);
  const slope = new Float32Array(len);
  const biomeMap = new Uint8Array(len);

  const seaLevel = 64;
  const minY = clamp(cfg.minY, SURFACE_MIN_Y, 240);
  const maxY = clamp(cfg.maxY, minY + 40, SURFACE_MAX_Y);

  const profilesById = Object.fromEntries(BIOMES.map((b, i) => [b.id, { ...b, biomeIndex: i }]));
  const userMixById = Object.fromEntries((cfg.biomeMix || []).map((b) => [b.id, b]));

  const dynamicBiomes = BIOMES.filter((b) => !['ocean', 'coast'].includes(b.id)).map((base) => {
    const user = userMixById[base.id] || {};
    const o = user.overrides || {};
    return {
      ...base,
      enabled: user.enabled !== false,
      targetPercent: user.targetPercent ?? base.targetPercent,
      minAltitude: o.minAltitude ?? base.minAltitude,
      maxAltitude: o.maxAltitude ?? base.maxAltitude,
      roughness: o.roughness ?? base.roughness,
      flatness: o.flatness ?? base.flatness,
      riverAffinity: o.riverAffinity ?? base.riverAffinity,
      mountainInfluence: o.mountainInfluence ?? base.mountainInfluence,
      coastAffinity: o.coastAffinity ?? base.coastAffinity,
      erosionStrength: o.erosionStrength ?? base.erosionStrength
    };
  }).filter((b) => b.enabled);

  let totalTarget = dynamicBiomes.reduce((sum, b) => sum + Math.max(0, b.targetPercent), 0);
  if (totalTarget <= 0) {
    dynamicBiomes.push({ ...profilesById.plains, enabled: true, targetPercent: 100 });
    totalTarget = 100;
  }
  dynamicBiomes.forEach((b) => { b.targetPercent = (Math.max(0, b.targetPercent) / totalTarget) * 100; });

  post('1/9 Générer masse terrestre', 0.06);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      potential[idx(x, y, width)] = createLandPotential(x, y, width, height, cfg, seedNum);
    }
  }

  const targetCoverage = clamp(cfg.landCoverage, 0.2, 0.75);
  const firstMask = adaptiveLandMask(potential, targetCoverage);
  const landMask = firstMask.mask;
  const cleanupStats = cleanupMask(landMask, width, height);

  let landCount = 0;
  for (let i = 0; i < len; i += 1) landCount += landMask[i];
  const realCoverage = landCount / len;

  post('2/9 Distance à la côte', 0.14);
  const coastDistance = distanceToCoast(landMask, width, height);

  post('3/9 Cartes climatiques + base altitude', 0.26);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const nx = x / width;
      const ny = y / height;
      const inland = clamp(coastDistance[i] / 30, 0, 1);
      const macro = fbm(nx * 2, ny * 2, seedNum + 101, 4, 2, 0.52);
      const meso = fbm(nx * 6, ny * 6, seedNum + 131, 4, 2.2, 0.48);

      if (landMask[i]) {
        baseHeight[i] = 70 + macro * 18 + meso * 12 + inland * 18;
      } else {
        const shelf = clamp(coastDistance[i] / cfg.shelfWidthCells, 0, 1);
        baseHeight[i] = lerp(63, cfg.oceanFloorMin - fbm(nx * 5, ny * 5, seedNum + 191, 3, 2.1, 0.5) * cfg.oceanDepthNoise, smoothstep(shelf));
      }

      const humidityNoise = fbm(nx * 3.5, ny * 3.5, seedNum + 222, 4, 2.04, 0.5);
      const rainShadow = clamp(1 - (baseHeight[i] - 68) / 170, 0, 1);
      moistureMap[i] = clamp(humidityNoise * 0.7 + (1 - inland) * 0.2 + rainShadow * 0.2, 0, 1);

      const latitude = 1 - Math.abs(ny * 2 - 1);
      const tempNoise = fbm(nx * 2.7, ny * 2.7, seedNum + 254, 3, 2.1, 0.5);
      temperatureMap[i] = clamp(latitude * 0.55 + tempNoise * 0.45 - clamp((baseHeight[i] - 78) / 200, 0, 0.45), 0, 1);
    }
  }

  post('4/9 Placement biomes (règles + % cible)', 0.4);
  const coastProfile = profilesById.coast;
  const oceanProfile = profilesById.ocean;
  const assignedCounts = Object.fromEntries(dynamicBiomes.map((b) => [b.id, 0]));
  const maxCounts = Object.fromEntries(dynamicBiomes.map((b) => [b.id, Math.round((landCount * b.targetPercent) / 100)]));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      if (!landMask[i]) {
        biomeMap[i] = oceanProfile.biomeIndex;
        map[i] = baseHeight[i];
        continue;
      }

      const coastBand = coastDistance[i] <= Math.max(2, cfg.beachWidthCells + 2);
      if (coastBand) {
        biomeMap[i] = coastProfile.biomeIndex;
        map[i] = lerp(baseHeight[i], coastProfile.preferredAltitude, 0.9);
        continue;
      }

      const coastalness = clamp(1 - coastDistance[i] / 35, 0, 1);
      let best = dynamicBiomes[0];
      let bestScore = -999;

      for (let b = 0; b < dynamicBiomes.length; b += 1) {
        const biome = dynamicBiomes[b];
        const suitability = climateSuitability(biome, moistureMap[i], temperatureMap[i], baseHeight[i], coastalness);
        const cell = fbm((x / width) * 1.2, (y / height) * 1.2, seedNum + 4000 + biome.biomeIndex * 17, 3, 2, 0.52);
        const quotaPressure = assignedCounts[biome.id] >= maxCounts[biome.id] ? -0.12 : 0;
        const score = suitability + cell * 0.35 + quotaPressure;
        if (score > bestScore) {
          bestScore = score;
          best = biome;
        }
      }

      biomeMap[i] = best.biomeIndex;
      assignedCounts[best.id] += 1;
      map[i] = computeBiomeHeight(best, x, y, width, height, baseHeight[i], seedNum, clamp(coastDistance[i] / 32, 0, 1), moistureMap[i]);
    }
  }

  post('5/9 Transitions douces entre biomes', 0.52);
  const scratch = new Float32Array(map);
  const transitionPx = Math.max(1, Math.round(cfg.biomeTransitionWidth * 12));
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y, width);
      if (!landMask[i]) continue;
      let diff = 0;
      let sum = 0;
      let count = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (!ox && !oy) continue;
          const j = idx(x + ox, y + oy, width);
          sum += map[j];
          count += 1;
          if (biomeMap[j] !== biomeMap[i]) diff += 1;
        }
      }
      const influence = clamp(diff / 8, 0, 1);
      biomeInfluenceMap[i] = influence;
      if (coastDistance[i] <= transitionPx) {
        scratch[i] = lerp(map[i], sum / count, influence * 0.38);
      } else {
        scratch[i] = lerp(map[i], sum / count, influence * 0.26);
      }
    }
  }
  map.set(scratch);

  post('6/9 Rivières + érosion par biome', 0.68);
  let riversCreated = 0;
  const sources = Math.floor(len * cfg.riverAmountDensity * 1.6);
  for (let s = 0; s < sources; s += 1) {
    let x = Math.floor(rng() * (width - 2)) + 1;
    let y = Math.floor(rng() * (height - 2)) + 1;
    let i = idx(x, y, width);
    if (!landMask[i]) continue;
    const profile = BIOMES[biomeMap[i]];
    if (rng() > profile.riverAffinity) continue;
    if (map[i] < profile.preferredAltitude) continue;

    riversCreated += 1;
    const widthMul = Math.max(1, Math.round(cfg.riverWidth * profile.riverWidthMultiplier));
    const depthMul = cfg.riverDepth * profile.riverDepthMultiplier;
    const steps = Math.floor((width + height) * 0.32);
    for (let step = 0; step < steps; step += 1) {
      i = idx(x, y, width);
      map[i] -= depthMul;

      for (let oy = -widthMul; oy <= widthMul; oy += 1) {
        for (let ox = -widthMul; ox <= widthMul; ox += 1) {
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
          const j = idx(xx, yy, width);
          map[j] -= depthMul * 0.22;
          map[j] -= profile.valleyStrength * 0.06;
        }
      }

      let nextX = x;
      let nextY = y;
      let low = map[i];
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (!ox && !oy) continue;
          const xx = x + ox;
          const yy = y + oy;
          const h = map[idx(xx, yy, width)];
          if (h < low) {
            low = h;
            nextX = xx;
            nextY = yy;
          }
        }
      }
      if (nextX === x && nextY === y) break;
      x = nextX;
      y = nextY;
      if (map[idx(x, y, width)] <= seaLevel + 0.2 || !landMask[idx(x, y, width)]) break;
    }
  }

  for (let i = 0; i < len; i += 1) {
    if (!landMask[i]) continue;
    const profile = BIOMES[biomeMap[i]];
    const e = profile.erosionStrength;
    map[i] = lerp(map[i], baseHeight[i], e * 0.08);
  }

  post('7/9 Nettoyage + quantification Y Minecraft', 0.82);
  const clean = new Float32Array(map);
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const avg = (map[idx(x - 1, y, width)] + map[idx(x + 1, y, width)] + map[idx(x, y - 1, width)] + map[idx(x, y + 1, width)]) / 4;
        if (Math.abs(map[i] - avg) > 20) clean[i] = lerp(map[i], avg, 0.32);
      }
    }
    map.set(clean);
  }

  let minGenerated = 999;
  let maxGenerated = -999;
  for (let i = 0; i < len; i += 1) {
    const h = clamp(Math.round(map[i]), minY, maxY);
    heights[i] = h;
    minGenerated = Math.min(minGenerated, h);
    maxGenerated = Math.max(maxGenerated, h);
  }

  post('8/9 Export grayscale WorldPainter', 0.92);
  const image = new Uint8ClampedArray(len * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const c = heights[i];
      const l = heights[idx(Math.max(0, x - 1), y, width)];
      const r = heights[idx(Math.min(width - 1, x + 1), y, width)];
      const u = heights[idx(x, Math.max(0, y - 1), width)];
      const d = heights[idx(x, Math.min(height - 1, y + 1), width)];
      slope[i] = Math.abs(r - l) + Math.abs(d - u);

      const g = Math.round(clamp((c - MC_MIN_Y) / (MC_MAX_Y - MC_MIN_Y), 0, 1) * 255);
      const o = i * 4;
      image[o] = g;
      image[o + 1] = g;
      image[o + 2] = g;
      image[o + 3] = 255;
    }
  }

  const biomeCounts = new Array(BIOMES.length).fill(0);
  for (let i = 0; i < len; i += 1) biomeCounts[biomeMap[i]] += 1;

  const distribution = dynamicBiomes.map((b) => ({
    id: b.id,
    name: b.name,
    target: b.targetPercent,
    real: (biomeCounts[b.biomeIndex] / Math.max(1, landCount)) * 100
  }));

  const biomePalette = Object.fromEntries(BIOMES.map((b, i) => [i, b.color]));
  const regions = estimateBiomeRegions(biomeMap, width, height, profilesById.ocean.biomeIndex);

  cfg.generationStats = {
    targetLandPct: targetCoverage * 100,
    realLandPct: realCoverage * 100,
    realOceanPct: 100 - realCoverage * 100,
    removedMicroIslands: cleanupStats.removedMicroIslands,
    removedWaterHoles: cleanupStats.removedWaterHoles,
    minY: minGenerated,
    maxY: maxGenerated,
    seaLevel,
    islandCount: Math.max(1, Math.round(cfg.secondaryIslands + 1)),
    riverCount: riversCreated,
    biomeRegionCount: regions,
    biomeDistribution: distribution,
    biomePalette,
    worldPainterSafe: true,
    worldPainterTips: {
      lowMapping: `0 → Y${minGenerated}`,
      waterLevel: 'Y64',
      highMapping: `255 → Y${maxGenerated}`,
      buildLimit: '-64 / 319'
    }
  };

  post('9/9 Terminé', 1);
  self.postMessage({ type: 'done', phase, width, height, heights, slope, biomeMap, image, config: cfg }, [heights.buffer, slope.buffer, biomeMap.buffer, image.buffer]);
}

self.onmessage = (event) => {
  if (event.data.type === 'generate') generate(event.data);
};
