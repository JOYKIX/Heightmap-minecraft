const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const SURFACE_MIN_Y = 20;
const SURFACE_MAX_Y = 260;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const fract = (v) => v - Math.floor(v);
const idx = (x, y, width) => y * width + x;

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

  // Ocean border guarantee
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
      for (let r = 1; r < 32; r += 1) {
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

function generate(payload) {
  const { cfg, phase } = payload;
  const width = cfg.width;
  const height = cfg.height;
  const len = width * height;

  const map = new Float32Array(len);
  const heights = new Uint16Array(len);
  const slope = new Float32Array(len);
  const potential = new Float32Array(len);

  const seedNum = hashString(`${cfg.seed}-${cfg.targetWidth}-${cfg.targetHeight}-${phase}`);
  const rng = mulberry32(seedNum ^ 0x9abcde);
  const post = (step, progress) => self.postMessage({ type: 'progress', step, progress });

  const seaLevel = 64;
  const minY = clamp(cfg.minY, SURFACE_MIN_Y, 240);
  const maxY = clamp(cfg.maxY, minY + 40, SURFACE_MAX_Y);

  post('1/12 Masque terre potentiel', 0.05);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      potential[i] = createLandPotential(x, y, width, height, cfg, seedNum);
    }
  }

  post('2/12 Seuil adaptatif land coverage', 0.12);
  const targetCoverage = clamp(cfg.landCoverage, 0.2, 0.75);
  const firstMask = adaptiveLandMask(potential, targetCoverage);
  const landMask = firstMask.mask;

  post('3/12 Nettoyage masque terre/mer', 0.18);
  const cleanupStats = cleanupMask(landMask, width, height);

  let landCount = 0;
  for (let i = 0; i < len; i += 1) landCount += landMask[i];
  const realCoverage = landCount / len;
  const coastDistance = distanceToCoast(landMask, width, height);

  post('4/12 Base altitude Minecraft', 0.28);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const nx = x / width;
      const ny = y / height;
      const inland = clamp(coastDistance[i] / 26, 0, 1);
      const macro = fbm(nx * 2.0, ny * 2.0, seedNum + 101, 5, 2.0, 0.52);
      const meso = fbm(nx * 6.0, ny * 6.0, seedNum + 113, 4, 2.1, 0.48);

      if (landMask[i]) {
        const plainsBias = cfg.playableFlatBias;
        const baseLowLand = lerp(72, 95, macro * 0.65 + meso * 0.35);
        const relief = (1 - plainsBias) * cfg.reliefInterior;
        const interiorLift = inland * inland * relief * 65;
        map[i] = baseLowLand + interiorLift;
      } else {
        const shelf = clamp(coastDistance[i] / cfg.shelfWidthCells, 0, 1);
        const abyssNoise = fbm(nx * 4.3, ny * 4.3, seedNum + 127, 4, 2.2, 0.5);
        const baseOcean = lerp(62, cfg.oceanFloorMin, smoothstep(shelf));
        map[i] = baseOcean - abyssNoise * cfg.oceanDepthNoise;
      }
    }
  }

  post('5/12 Côtes / plages / falaises', 0.38);
  for (let i = 0; i < len; i += 1) {
    const d = coastDistance[i];
    if (!landMask[i]) {
      if (d < cfg.shelfWidthCells) {
        map[i] = Math.max(map[i], lerp(63, 56, d / Math.max(1, cfg.shelfWidthCells)));
      }
    } else {
      if (d <= cfg.beachWidthCells) {
        map[i] = lerp(64, 69, d / Math.max(1, cfg.beachWidthCells));
      } else if (cfg.coastCliffBoost > 0 && d <= cfg.beachWidthCells + 2) {
        map[i] += cfg.coastCliffBoost;
      }
    }
  }

  post('6/12 Montagnes intérieures', 0.48);
  const mountainMask = new Float32Array(len);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      if (!landMask[i]) continue;
      const inland = clamp(coastDistance[i] / 34, 0, 1);
      const ridge = ridged(x / width * 5.3, y / height * 5.3, seedNum + 151, cfg.ridgeSharpness);
      const massif = fbm(x / width * 2.2, y / height * 2.2, seedNum + 163, 4, 2.0, 0.54);
      const m = smoothstep(clamp((ridge * 0.65 + massif * 0.35) * inland - (1 - cfg.mountainAmount) * 0.35, 0, 1));
      mountainMask[i] = m;
      map[i] += m * cfg.mountainHeight;
    }
  }

  post('7/12 Zones plates jouables', 0.58);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y, width);
      if (!landMask[i] || mountainMask[i] > 0.52) continue;
      const plainsSignal = fbm(x / width * 3.4, y / height * 3.4, seedNum + 181, 3, 2.2, 0.5);
      if (plainsSignal > 0.58) {
        const avg = (map[idx(x - 1, y, width)] + map[idx(x + 1, y, width)] + map[idx(x, y - 1, width)] + map[idx(x, y + 1, width)]) / 4;
        map[i] = lerp(map[i], Math.round(avg / 2) * 2, cfg.playableFlatBias * 0.75);
      }
    }
  }

  post('8/12 Rivières et vallées', 0.7);
  let riversCreated = 0;
  const sources = Math.floor(len * cfg.riverAmountDensity);
  for (let s = 0; s < sources; s += 1) {
    let x = Math.floor(rng() * (width - 2)) + 1;
    let y = Math.floor(rng() * (height - 2)) + 1;
    let i = idx(x, y, width);
    if (!landMask[i] || map[i] < 105 || mountainMask[i] < 0.3) continue;

    riversCreated += 1;
    const steps = Math.floor((width + height) * 0.42);
    for (let step = 0; step < steps; step += 1) {
      i = idx(x, y, width);
      map[i] -= cfg.riverDepth;

      for (let oy = -cfg.riverWidth; oy <= cfg.riverWidth; oy += 1) {
        for (let ox = -cfg.riverWidth; ox <= cfg.riverWidth; ox += 1) {
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
          map[idx(xx, yy, width)] -= cfg.riverDepth * 0.3;
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

  post('9/12 Nettoyage anti-artefacts', 0.82);
  const scratch = new Float32Array(len);
  for (let pass = 0; pass < 2; pass += 1) {
    scratch.set(map);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const avg = (map[idx(x - 1, y, width)] + map[idx(x + 1, y, width)] + map[idx(x, y - 1, width)] + map[idx(x, y + 1, width)]) / 4;
        if (Math.abs(map[i] - avg) > 18) scratch[i] = lerp(map[i], avg, 0.4);
      }
    }
    map.set(scratch);
  }

  post('10/12 Quantification Minecraft', 0.9);
  let minGenerated = 999;
  let maxGenerated = -999;
  for (let i = 0; i < len; i += 1) {
    const h = clamp(Math.round(map[i]), minY, maxY);
    heights[i] = h;
    minGenerated = Math.min(minGenerated, h);
    maxGenerated = Math.max(maxGenerated, h);
  }

  post('11/12 Grayscale WorldPainter', 0.96);
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

  const islandsApprox = Math.max(1, Math.round(cfg.secondaryIslands + 1));

  cfg.generationStats = {
    targetLandPct: targetCoverage * 100,
    realLandPct: realCoverage * 100,
    realOceanPct: 100 - realCoverage * 100,
    removedMicroIslands: cleanupStats.removedMicroIslands,
    removedWaterHoles: cleanupStats.removedWaterHoles,
    minY: minGenerated,
    maxY: maxGenerated,
    seaLevel,
    islandCount: islandsApprox,
    riverCount: riversCreated,
    worldPainterSafe: true,
    worldPainterTips: {
      lowMapping: `0 → Y${minGenerated}`,
      waterLevel: 'Y64',
      highMapping: `255 → Y${maxGenerated}`,
      buildLimit: '-64 / 319'
    }
  };

  post('12/12 Terminé', 1);
  self.postMessage({ type: 'done', phase, width, height, heights, slope, image, config: cfg }, [heights.buffer, slope.buffer, image.buffer]);
}

self.onmessage = (event) => {
  if (event.data.type === 'generate') generate(event.data);
};
