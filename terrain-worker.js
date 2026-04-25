const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const SURFACE_MIN_Y = 20;
const SURFACE_MAX_Y = 260;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const fract = (v) => v - Math.floor(v);

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
    total += noise2D(x * f, y * f, seed + i * 17.3) * a;
    norm += a;
    f *= lacunarity;
    a *= gain;
  }
  return total / norm;
}

function ridged(x, y, seed, sharpness) {
  return Math.pow(1 - Math.abs(fbm(x, y, seed, 6, 2.04, 0.51) * 2 - 1), sharpness);
}

function idx(x, y, width) {
  return y * width + x;
}

const QUALITY = {
  fast: { octavesDelta: -2, erosionPasses: 1, cleanupPasses: 0, riversMul: 0.45, reliefMul: 0.55 },
  balanced: { octavesDelta: -1, erosionPasses: 2, cleanupPasses: 1, riversMul: 0.75, reliefMul: 0.8 },
  high: { octavesDelta: 0, erosionPasses: 3, cleanupPasses: 1, riversMul: 1, reliefMul: 1 },
  extreme: { octavesDelta: 1, erosionPasses: 4, cleanupPasses: 2, riversMul: 1.2, reliefMul: 1.18 }
};

function qOct(base, quality) {
  return Math.max(2, base + QUALITY[quality].octavesDelta);
}

function islandMask(x, y, width, height, cfg, seedNum) {
  const nx = x / width - 0.5;
  const ny = y / height - 0.5;
  const radial = Math.hypot(nx * (1 + cfg.islandAsymmetry * 0.7), ny * (1 - cfg.islandAsymmetry * 0.45)) / cfg.islandSize;
  const ang = Math.atan2(ny, nx);
  const peninsulas = Math.sin(ang * 3.1 + seedNum * 0.001) * 0.11 + Math.sin(ang * 8.2 + seedNum * 0.002) * 0.05;
  const warp = (fbm(nx * 7, ny * 7, seedNum + 90, qOct(4, cfg.quality), 2.1, 0.55) - 0.5) * (0.3 + cfg.coastlineComplexity * 0.5);
  const bays = (fbm(nx * 10.5, ny * 10.5, seedNum + 117, qOct(3, cfg.quality), 2.2, 0.5) - 0.5) * cfg.coastFragmentation * 0.45;
  const archipelago = fbm(nx * 13, ny * 13, seedNum + 202, qOct(4, cfg.quality), 2.25, 0.48) * cfg.archipelagoAmount * 0.2;
  const edge = radial + warp - peninsulas + bays + archipelago;
  return clamp(1 - smoothstep(clamp(edge * 1.5, 0, 1)), 0, 1);
}

function generate(payload) {
  const { cfg, phase } = payload;
  const width = cfg.width;
  const height = cfg.height;
  const len = width * height;
  const map = new Float32Array(len);
  const heights = new Uint16Array(len);
  const slope = new Float32Array(len);
  const seedNum = hashString(`${cfg.seed}-${cfg.targetWidth}-${cfg.targetHeight}-${phase}`);
  const post = (step, progress) => self.postMessage({ type: 'progress', step, progress });
  const minY = clamp(Number.isFinite(cfg.minY) ? cfg.minY : SURFACE_MIN_Y, SURFACE_MIN_Y, SURFACE_MAX_Y - 10);
  const maxY = clamp(Number.isFinite(cfg.maxY) ? cfg.maxY : SURFACE_MAX_Y, minY + 10, SURFACE_MAX_Y);
  const riverDepth = clamp(Number.isFinite(cfg.riverDepth) ? cfg.riverDepth : 1, 0.3, 2.5);
  const cleanupStrength = clamp(Number.isFinite(cfg.cleanupStrength) ? cfg.cleanupStrength : 0.5, 0, 1);

  const continentalCache = new Float32Array(len);
  const warpXCache = new Float32Array(len);
  const warpYCache = new Float32Array(len);

  post('1/9 Base terrain', 0.05);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const sx = (x / width) * cfg.landmassScale;
      const sy = (y / height) * cfg.landmassScale;
      const warpX = (fbm(sx * 2.1, sy * 2.1, seedNum + 7, qOct(4, cfg.quality), 2.1, 0.52) - 0.5) * cfg.coastlineComplexity * 0.6;
      const warpY = (fbm(sx * 2.1, sy * 2.1, seedNum + 13, qOct(4, cfg.quality), 2.1, 0.52) - 0.5) * cfg.coastlineComplexity * 0.6;
      warpXCache[i] = sx + warpX;
      warpYCache[i] = sy + warpY;
      continentalCache[i] = fbm(warpXCache[i] * 1.8, warpYCache[i] * 1.8, seedNum + 30, qOct(6, cfg.quality), 2.02, 0.52);
    }
  }

  post('2/9 Altitude attribution', 0.18);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const wx = warpXCache[i];
      const wy = warpYCache[i];
      const im = islandMask(x, y, width, height, cfg, seedNum);
      const shelf = fbm(wx * 5.8, wy * 5.8, seedNum + 38, qOct(4, cfg.quality), 2.1, 0.53) * cfg.shelfWidth;
      const coastal = fbm(wx * 8.5, wy * 8.5, seedNum + 44, qOct(4, cfg.quality), 2.2, 0.5);
      const abyss = fbm(wx * 4.2, wy * 4.2, seedNum + 49, qOct(5, cfg.quality), 2.15, 0.48);
      const baseSignal = (continentalCache[i] * (0.62 + cfg.landmassDensity * 0.4)) + (coastal - 0.5) * 0.12 + (shelf - 0.5) * 0.14 - (0.5 - abyss) * cfg.abyssFrequency * 0.12;

      let h;
      if (baseSignal < 0.22) h = lerp(20, 35, baseSignal / 0.22);
      else if (baseSignal < 0.38) h = lerp(35, 58, (baseSignal - 0.22) / 0.16);
      else if (baseSignal < 0.48) h = lerp(58, 69, (baseSignal - 0.38) / 0.1);
      else if (baseSignal < 0.68) h = lerp(70, 95, (baseSignal - 0.48) / 0.2);
      else if (baseSignal < 0.83) h = lerp(95, 150, (baseSignal - 0.68) / 0.15);
      else h = lerp(150, 220, (baseSignal - 0.83) / 0.17);

      h = lerp(24, h, clamp((im - 0.25) / 0.55, 0, 1));
      h = cfg.seaLevel + (h - cfg.seaLevel) * cfg.layerContrast;
      const micro = (fbm(wx * 16, wy * 16, seedNum + 88, qOct(3, cfg.quality), 2.3, 0.46) - 0.5) * (4 + cfg.terrainVariation * 8) * QUALITY[cfg.quality].reliefMul;
      map[i] = clamp(h + micro, minY, maxY);
    }
  }

  post('3/9 Coast + mountains', 0.35);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y, width);
      const h = map[i];
      if (h >= cfg.seaLevel - 10 && h <= cfg.seaLevel + 14) {
        const n1 = map[idx(x - 1, y, width)] < cfg.seaLevel;
        const n2 = map[idx(x + 1, y, width)] < cfg.seaLevel;
        const n3 = map[idx(x, y - 1, width)] < cfg.seaLevel;
        const n4 = map[idx(x, y + 1, width)] < cfg.seaLevel;
        const water = (n1 ? 1 : 0) + (n2 ? 1 : 0) + (n3 ? 1 : 0) + (n4 ? 1 : 0);
        if (water > 0) {
          const capNoise = fbm(x / width * 8, y / height * 8, seedNum + 211, qOct(3, cfg.quality), 2.2, 0.52);
          map[i] = capNoise < cfg.cliffAmount ? h + 1.1 : lerp(h, cfg.seaLevel + 1.7, 0.35 + cfg.coastErosion * 0.2);
        }
      }
      const wx = x / width;
      const wy = y / height;
      const ridge = ridged(wx * (2.9 / cfg.massifSize), wy * (2.9 / cfg.massifSize), seedNum + 301, cfg.ridgeSharpness);
      const chainMask = fbm(wx * 2.4, wy * 2.4, seedNum + 313, qOct(4, cfg.quality), 2.08, 0.53);
      const alpine = ridged(wx * 6.2, wy * 6.2, seedNum + 333, 1.7) * cfg.alpineEffect;
      let uplift = ridge * chainMask * cfg.mountainIntensity * 68 + alpine * 26;
      if (chainMask > 0.7) uplift += cfg.peakAmount * 28;
      map[i] = clamp(map[i] + uplift, minY, maxY);
    }
  }

  post('4/9 Valleys + rivers', 0.5);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y, width);
      const valleyMask = 1 - Math.pow(fbm(x / width * 3.4, y / height * 3.4, seedNum + 370, qOct(5, cfg.quality), 2.1, 0.48), 1.16);
      const cut = valleyMask * cfg.valleyStrength * (map[i] > 95 ? 22 : 9);
      map[i] = clamp(map[i] - cut, minY, maxY);
    }
  }

  const rng = mulberry32(seedNum ^ 0x5a5a);
  const riverCount = Math.floor(width * height * (0.00002 + cfg.riverDensity * 0.00009) * QUALITY[cfg.quality].riversMul);
  const maxSteps = Math.floor((width + height) * 0.6);
  for (let i = 0; i < riverCount; i += 1) {
    let x = Math.floor(rng() * width);
    let y = Math.floor(rng() * height);
    if (map[idx(x, y, width)] < 105) continue;
    for (let s = 0; s < maxSteps; s += 1) {
      const ci = idx(x, y, width);
      const current = map[ci];
      let nx = x;
      let ny = y;
      let nh = current;

      const li = idx(x - 1, y, width); if (map[li] < nh) { nh = map[li]; nx = x - 1; ny = y; }
      const ri = idx(x + 1, y, width); if (map[ri] < nh) { nh = map[ri]; nx = x + 1; ny = y; }
      const ui = idx(x, y - 1, width); if (map[ui] < nh) { nh = map[ui]; nx = x; ny = y - 1; }
      const di = idx(x, y + 1, width); if (map[di] < nh) { nh = map[di]; nx = x; ny = y + 1; }
      if (nh > current) break;
      const depth = (1 + (s / maxSteps) * 3) * riverDepth;
      map[ci] -= depth;
      map[li] -= depth * 0.16;
      map[ri] -= depth * 0.16;
      map[ui] -= depth * 0.16;
      map[di] -= depth * 0.16;
      x = nx;
      y = ny;
      if (map[idx(x, y, width)] <= cfg.seaLevel + 0.5) {
        map[idx(x, y, width)] = Math.min(map[idx(x, y, width)], cfg.seaLevel);
        break;
      }
    }
  }

  post('5/9 Erosion', 0.66);
  const baseIterations = Math.floor(2 + cfg.erosionStrength * 6);
  const iterations = Math.max(1, Math.floor(baseIterations * (QUALITY[cfg.quality].erosionPasses / 3)));
  const talus = 1.3 + cfg.erosionStrength * 2.5;
  const delta = new Float32Array(len);
  for (let k = 0; k < iterations; k += 1) {
    delta.fill(0);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const h = map[i];
        const nIdx = [idx(x - 1, y, width), idx(x + 1, y, width), idx(x, y - 1, width), idx(x, y + 1, width)];
        for (let n = 0; n < 4; n += 1) {
          const ni = nIdx[n];
          const diff = h - map[ni];
          if (diff > talus) {
            const moved = (diff - talus) * 0.16;
            delta[i] -= moved;
            delta[ni] += moved;
          }
        }
      }
    }
    for (let i = 0; i < len; i += 1) map[i] += delta[i];
  }

  post('6/9 Quantization + cleanup', 0.79);
  const plateauStep = 12 - cfg.plateauAmount * 8;
  for (let i = 0; i < len; i += 1) {
    const q = clamp(Math.round(map[i]), minY, maxY);
    heights[i] = clamp(Math.round(lerp(q, Math.round(q / plateauStep) * plateauStep, cfg.plateauAmount * 0.24)), minY, maxY);
  }

  const cleanupPasses = Math.max(0, Math.round(QUALITY[cfg.quality].cleanupPasses * (0.35 + cleanupStrength * 1.65)));
  for (let p = 0; p < cleanupPasses; p += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const h = heights[i];
        const l = heights[idx(x - 1, y, width)];
        const r = heights[idx(x + 1, y, width)];
        const u = heights[idx(x, y - 1, width)];
        const d = heights[idx(x, y + 1, width)];
        const maxN = Math.max(l, r, u, d);
        const minN = Math.min(l, r, u, d);
        if (h > maxN + 22) heights[i] = clamp(maxN + 8, minY, maxY);
        if (h < minN - 18) heights[i] = clamp(minN - 6, minY, maxY);
      }
    }
  }

  post('7/9 Safe pass + slope', 0.89);
  if (cfg.safeMode) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const here = heights[i];
        const l = heights[idx(x - 1, y, width)];
        const r = heights[idx(x + 1, y, width)];
        const u = heights[idx(x, y - 1, width)];
        const d = heights[idx(x, y + 1, width)];
        const avg = (l + r + u + d) / 4;
        if (Math.abs(here - avg) >= 12) heights[i] = clamp(Math.round((here + avg) / 2), minY, maxY);
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const c = heights[i];
      const l = heights[idx(Math.max(0, x - 1), y, width)];
      const r = heights[idx(Math.min(width - 1, x + 1), y, width)];
      const u = heights[idx(x, Math.max(0, y - 1), width)];
      const d = heights[idx(x, Math.min(height - 1, y + 1), width)];
      slope[i] = Math.abs(r - l) + Math.abs(d - u) + Math.abs(c - (l + r + u + d) / 4);
    }
  }

  post('8/9 8-bit preview image', 0.96);
  const image = new Uint8ClampedArray(len * 4);
  for (let i = 0; i < len; i += 1) {
    const t = clamp((heights[i] - MC_MIN_Y) / Math.max(1, MC_MAX_Y - MC_MIN_Y), 0, 1);
    const g = Math.round(t * 255);
    const o = i * 4;
    image[o] = g;
    image[o + 1] = g;
    image[o + 2] = g;
    image[o + 3] = 255;
  }

  post('9/9 Done', 1);
  self.postMessage({
    type: 'done',
    phase,
    width,
    height,
    heights,
    slope,
    image,
    config: cfg
  }, [heights.buffer, slope.buffer, image.buffer]);
}

self.onmessage = (event) => {
  const data = event.data;
  if (data.type === 'generate') {
    generate(data);
  }
};
