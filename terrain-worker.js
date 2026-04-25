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
    total += noise2D(x * f, y * f, seed + i * 19.7) * a;
    norm += a;
    f *= lacunarity;
    a *= gain;
  }
  return total / Math.max(0.0001, norm);
}

function ridged(x, y, seed, sharpness = 1.4, octaves = 5) {
  const n = fbm(x, y, seed, octaves, 2.03, 0.52) * 2 - 1;
  return Math.pow(1 - Math.abs(n), sharpness);
}

function idx(x, y, width) {
  return y * width + x;
}

const QUALITY = {
  fast: { octavesDelta: -2, erosionPasses: 2, riverStepsMul: 0.65, cleanupPasses: 1, detailMul: 0.65 },
  balanced: { octavesDelta: -1, erosionPasses: 3, riverStepsMul: 0.85, cleanupPasses: 2, detailMul: 0.85 },
  high: { octavesDelta: 0, erosionPasses: 4, riverStepsMul: 1, cleanupPasses: 3, detailMul: 1 },
  extreme: { octavesDelta: 1, erosionPasses: 5, riverStepsMul: 1.2, cleanupPasses: 4, detailMul: 1.2 }
};

function qOct(base, quality) {
  return Math.max(2, base + QUALITY[quality].octavesDelta);
}

function normalizedGradient(x, y, width, height, angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = x / (width - 1) - 0.5;
  const ny = y / (height - 1) - 0.5;
  const g = nx * dx + ny * dy;
  return (g + 0.75) / 1.5;
}

function buildLandmass(x, y, width, height, cfg, seedNum) {
  const nx = x / width - 0.5;
  const ny = y / height - 0.5;
  const angle = Math.atan2(ny, nx);

  const warpA = (fbm(nx * 2.6, ny * 2.6, seedNum + 13, qOct(4, cfg.quality), 2.15, 0.54) - 0.5) * (0.58 + cfg.coastlineComplexity * 0.45);
  const warpB = (fbm(nx * 4.9, ny * 4.9, seedNum + 31, qOct(3, cfg.quality), 2.22, 0.5) - 0.5) * (0.24 + cfg.coastFragmentation * 0.34);

  const eX = nx * (1.06 + cfg.islandAsymmetry * 0.72) + warpA * 0.52;
  const eY = ny * (0.94 - cfg.islandAsymmetry * 0.35) + warpB * 0.42;

  const radial = Math.hypot(eX, eY) / Math.max(0.2, cfg.islandSize);

  const peninsulas = Math.sin(angle * 2.5 + seedNum * 0.0011) * 0.14
    + Math.sin(angle * 5.6 + seedNum * 0.0019) * 0.08
    + Math.sin(angle * 9.2 + seedNum * 0.0033) * 0.04;

  const continental = fbm((nx + warpA * 0.35) * 1.9 * cfg.landmassScale, (ny + warpB * 0.35) * 1.9 * cfg.landmassScale, seedNum + 79, qOct(6, cfg.quality), 2.0, 0.53);
  const secondary = fbm(nx * 5.5, ny * 5.5, seedNum + 87, qOct(4, cfg.quality), 2.15, 0.48);
  const fracture = ridged(nx * 11.5, ny * 11.5, seedNum + 109, 1.85, qOct(4, cfg.quality));

  const archipelago = fbm(nx * 9.8, ny * 9.8, seedNum + 137, qOct(5, cfg.quality), 2.2, 0.48) * cfg.archipelagoAmount;
  const coastlineBreak = (fracture - 0.5) * cfg.coastFragmentation * 0.42;

  const edge = radial
    - peninsulas
    + (0.5 - continental) * (0.95 - cfg.landmassDensity * 0.32)
    + (0.5 - secondary) * 0.28
    + coastlineBreak
    + (0.53 - archipelago) * 0.22;

  return clamp(1 - smoothstep(clamp(edge * 1.42, 0, 1)), 0, 1);
}

function applyMinecraftBands(signal, seaLevel) {
  if (signal < 0.16) return lerp(25, 45, signal / 0.16);
  if (signal < 0.32) return lerp(45, 58, (signal - 0.16) / 0.16);
  if (signal < 0.43) return lerp(62, 68, (signal - 0.32) / 0.11);
  if (signal < 0.63) return lerp(70, 90, (signal - 0.43) / 0.2);
  if (signal < 0.77) return lerp(90, 120, (signal - 0.63) / 0.14);
  if (signal < 0.89) return lerp(120, 150, (signal - 0.77) / 0.12);
  if (signal < 0.98) return lerp(150, 220, (signal - 0.89) / 0.09);
  return lerp(220, 255, (signal - 0.98) / 0.02);
}

function generate(payload) {
  const { cfg, phase } = payload;
  const width = cfg.width;
  const height = cfg.height;
  const len = width * height;

  const map = new Float32Array(len);
  const landMask = new Float32Array(len);
  const mountainMask = new Float32Array(len);
  const flow = new Float32Array(len);
  const heights = new Uint16Array(len);
  const slope = new Float32Array(len);

  const seedNum = hashString(`${cfg.seed}-${cfg.targetWidth}-${cfg.targetHeight}-${phase}`);
  const rng = mulberry32(seedNum ^ 0x6c8e9);

  const quality = QUALITY[cfg.quality] || QUALITY.high;
  const post = (step, progress) => self.postMessage({ type: 'progress', step, progress });

  const seaLevel = clamp(cfg.seaLevel ?? 64, 50, 110);
  const minY = clamp(Number.isFinite(cfg.minY) ? cfg.minY : SURFACE_MIN_Y, SURFACE_MIN_Y, SURFACE_MAX_Y - 20);
  const maxY = clamp(Number.isFinite(cfg.maxY) ? cfg.maxY : SURFACE_MAX_Y, minY + 40, SURFACE_MAX_Y);
  const cleanupStrength = clamp(Number.isFinite(cfg.cleanupStrength) ? cfg.cleanupStrength : 0.5, 0, 1);
  const riverDepth = clamp(Number.isFinite(cfg.riverDepth) ? cfg.riverDepth : 1, 0.3, 2.5);

  const tectonicAngle = rng() * Math.PI;

  // 1) Générer une masse terrestre
  post('1/11 Masse terrestre', 0.05);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      landMask[i] = buildLandmass(x, y, width, height, cfg, seedNum);
    }
  }

  // 2) Générer les altitudes principales (macro/meso/micro)
  post('2/11 Altitudes principales', 0.12);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const nx = x / width;
      const ny = y / height;
      const lm = landMask[i];

      const macro = fbm(nx * 1.5 * cfg.landmassScale, ny * 1.5 * cfg.landmassScale, seedNum + 201, qOct(5, cfg.quality), 2.02, 0.52);
      const meso = fbm(nx * 5.3, ny * 5.3, seedNum + 219, qOct(4, cfg.quality), 2.18, 0.49);
      const micro = fbm(nx * 14.5, ny * 14.5, seedNum + 237, qOct(3, cfg.quality), 2.3, 0.45);

      const hierarchy = macro * 0.56 + meso * 0.32 + micro * 0.12 * (0.4 + cfg.terrainVariation * 0.9) * quality.detailMul;
      const marineFloor = lerp(25, 56, macro * 0.8 + meso * 0.2);
      const landCandidate = applyMinecraftBands(hierarchy, seaLevel);
      const shoreBlend = smoothstep(clamp((lm - 0.28) / 0.48, 0, 1));
      map[i] = lerp(marineFloor, landCandidate, shoreBlend);
    }
  }

  // 3) Créer les couches Minecraft
  post('3/11 Couches altitudinales Minecraft', 0.2);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const h = map[i];
      const coastNoise = fbm(x / width * 9.5, y / height * 9.5, seedNum + 301, qOct(3, cfg.quality), 2.2, 0.5);

      if (h < 45) map[i] = lerp(25, 45, clamp((h - 25) / 20, 0, 1));
      else if (h < 58) map[i] = lerp(45, 58, clamp((h - 45) / 13, 0, 1));
      else if (h < 70) map[i] = lerp(62, 68, clamp((h - 58) / 12, 0, 1));
      else if (h < 92) map[i] = lerp(70, 90, clamp((h - 70) / 22, 0, 1));
      else if (h < 126) map[i] = lerp(90, 120, clamp((h - 92) / 34, 0, 1));
      else if (h < 155) map[i] = lerp(120, 150, clamp((h - 126) / 29, 0, 1));
      else if (h < 226) map[i] = lerp(150, 220, clamp((h - 155) / 71, 0, 1));
      else map[i] = lerp(220, maxY, clamp((h - 226) / Math.max(1, maxY - 226), 0, 1));

      if (landMask[i] > 0.4 && map[i] >= seaLevel - 2 && map[i] <= seaLevel + 7) {
        map[i] += (coastNoise - 0.5) * 2.3;
      }
    }
  }

  // 4) Ajouter montagnes
  post('4/11 Chaînes montagneuses', 0.3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const lm = landMask[i];
      if (lm < 0.46) continue;

      const nx = x / width;
      const ny = y / height;
      const tectonic = normalizedGradient(x, y, width, height, tectonicAngle);
      const tectonicBand = ridged(nx * 2.1 + Math.cos(tectonicAngle) * 0.7, ny * 2.1 + Math.sin(tectonicAngle) * 0.7, seedNum + 401, 1.65, qOct(5, cfg.quality));
      const massif = fbm(nx * (2.8 / cfg.massifSize), ny * (2.8 / cfg.massifSize), seedNum + 421, qOct(4, cfg.quality), 2.08, 0.53);
      const ridgeA = ridged(nx * 5.5, ny * 5.5, seedNum + 437, cfg.ridgeSharpness, qOct(4, cfg.quality));
      const ridgeB = ridged(nx * 9.7, ny * 9.7, seedNum + 449, cfg.ridgeSharpness * 0.8, qOct(3, cfg.quality));

      const mMask = clamp((tectonicBand * 0.48 + massif * 0.36 + tectonic * 0.16) * lm, 0, 1);
      mountainMask[i] = mMask;

      let uplift = (ridgeA * 46 + ridgeB * 22) * cfg.mountainIntensity * mMask;
      if (mMask > 0.64) uplift += cfg.peakAmount * 26 * Math.pow(mMask, 1.5);
      uplift *= 0.84 + cfg.alpineEffect * 0.42;

      map[i] = clamp(map[i] + uplift, minY, maxY);
    }
  }

  // 5) Ajouter vallées (drainage + convergence)
  post('5/11 Vallées cohérentes', 0.4);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = idx(x, y, width);
      if (landMask[i] < 0.45 || map[i] < seaLevel + 2) continue;

      const h = map[i];
      const l = map[idx(x - 1, y, width)];
      const r = map[idx(x + 1, y, width)];
      const u = map[idx(x, y - 1, width)];
      const d = map[idx(x, y + 1, width)];
      const avg = (l + r + u + d) / 4;
      const convergence = clamp((avg - h + 6) / 14, 0, 1);
      const valleySignal = 1 - ridged(x / width * 3.6, y / height * 3.6, seedNum + 503, 1.4, qOct(4, cfg.quality));

      const carve = convergence * valleySignal * cfg.valleyStrength * (map[i] > 135 ? 14 : 8);
      map[i] = clamp(map[i] - carve, minY, maxY);
    }
  }

  // 6) Ajouter rivières
  post('6/11 Rivières descendantes', 0.5);
  const sources = Math.floor(width * height * (0.000015 + cfg.riverDensity * 0.00008) * quality.riverStepsMul);
  const maxSteps = Math.floor((width + height) * 0.7 * quality.riverStepsMul);

  for (let s = 0; s < sources; s += 1) {
    let x = Math.floor(rng() * (width - 2)) + 1;
    let y = Math.floor(rng() * (height - 2)) + 1;
    let ci = idx(x, y, width);
    if (map[ci] < 120 || landMask[ci] < 0.5 || mountainMask[ci] < 0.35) continue;

    let lastHeight = map[ci] + 0.001;
    for (let step = 0; step < maxSteps; step += 1) {
      ci = idx(x, y, width);
      const current = map[ci];
      if (current >= lastHeight + 0.001) break;
      lastHeight = current;

      let nx = x;
      let ny = y;
      let nh = current;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          const ti = idx(x + ox, y + oy, width);
          const th = map[ti];
          if (th < nh) {
            nh = th;
            nx = x + ox;
            ny = y + oy;
          }
        }
      }

      if (nx === x && ny === y) {
        map[ci] -= 0.5;
        break;
      }

      const channelDepth = riverDepth * (0.7 + step / Math.max(1, maxSteps) * 1.8);
      map[ci] -= channelDepth;
      flow[ci] += 1;

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const ni = idx(x + ox, y + oy, width);
          map[ni] -= channelDepth * 0.11;
        }
      }

      x = nx;
      y = ny;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) break;
      if (map[idx(x, y, width)] <= seaLevel + 0.4) {
        map[idx(x, y, width)] = Math.min(map[idx(x, y, width)], seaLevel);
        break;
      }
    }
  }

  // 7) Ajouter érosion (hydraulique + thermique + pente)
  post('7/11 Érosion multi-pass', 0.63);
  const erosionPasses = Math.max(1, Math.round(quality.erosionPasses * (0.5 + cfg.erosionStrength * 1.4)));
  const delta = new Float32Array(len);
  const sediment = new Float32Array(len);
  const talus = 1.2 + cfg.erosionStrength * 2.8;

  for (let pass = 0; pass < erosionPasses; pass += 1) {
    delta.fill(0);
    sediment.fill(0);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const h = map[i];

        const nIds = [idx(x - 1, y, width), idx(x + 1, y, width), idx(x, y - 1, width), idx(x, y + 1, width)];
        let lowest = i;
        let lowH = h;

        for (let n = 0; n < 4; n += 1) {
          const ni = nIds[n];
          if (map[ni] < lowH) {
            lowH = map[ni];
            lowest = ni;
          }

          const diff = h - map[ni];
          if (diff > talus) {
            const moved = (diff - talus) * 0.18;
            delta[i] -= moved;
            delta[ni] += moved;
          }
        }

        if (lowest !== i) {
          const hydraulic = clamp((h - lowH) / 12, 0, 1) * (0.26 + cfg.erosionStrength * 0.3);
          delta[i] -= hydraulic;
          delta[lowest] += hydraulic * 0.64;
          sediment[i] += hydraulic * 0.36;
        }
      }
    }

    for (let i = 0; i < len; i += 1) {
      map[i] = clamp(map[i] + delta[i] - sediment[i] * 0.18, minY, maxY);
    }
  }

  // 8) Ajouter détails locaux
  post('8/11 Détails locaux', 0.73);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const lm = landMask[i];
      if (lm < 0.42 || map[i] < seaLevel + 2) continue;

      const nx = x / width;
      const ny = y / height;
      const rocky = ridged(nx * 16.5, ny * 16.5, seedNum + 611, 1.55, qOct(3, cfg.quality));
      const hummock = fbm(nx * 12.2, ny * 12.2, seedNum + 623, qOct(3, cfg.quality), 2.28, 0.44);
      const localPlateau = 1 - ridged(nx * 7.8, ny * 7.8, seedNum + 641, 1.35, qOct(3, cfg.quality));
      const modulation = smoothstep(clamp((mountainMask[i] - 0.22) / 0.58, 0, 1));

      const localDetail = (rocky - 0.5) * 5.5 * modulation + (hummock - 0.5) * 3.1 * (1 - modulation);
      const plateauBreak = (localPlateau - 0.45) * cfg.terrainSharpness * 1.4;
      map[i] = clamp(map[i] + localDetail + plateauBreak, minY, maxY);
    }
  }

  // 9) Nettoyer (anti artefacts + worldpainter safe)
  post('9/11 Nettoyage WorldPainter', 0.82);
  const cleanupPasses = Math.max(1, Math.round(quality.cleanupPasses * (0.55 + cleanupStrength * 1.8)));
  const scratch = new Float32Array(len);

  for (let pass = 0; pass < cleanupPasses; pass += 1) {
    scratch.set(map);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = idx(x, y, width);
        const c = map[i];

        const l = map[idx(x - 1, y, width)];
        const r = map[idx(x + 1, y, width)];
        const u = map[idx(x, y - 1, width)];
        const d = map[idx(x, y + 1, width)];
        const avg = (l + r + u + d) / 4;
        const maxN = Math.max(l, r, u, d);
        const minN = Math.min(l, r, u, d);

        if (c > maxN + 16) scratch[i] = maxN + 7;
        else if (c < minN - 14) scratch[i] = minN - 5;
        else if (Math.abs(c - avg) > 11) scratch[i] = lerp(c, avg, 0.42);

        if (landMask[i] > 0.35 && scratch[i] < seaLevel - 3) scratch[i] = seaLevel - 2;

        if (scratch[i] >= seaLevel - 2 && scratch[i] <= seaLevel + 4) {
          scratch[i] = Math.round(scratch[i]);
        }
      }
    }
    map.set(scratch);
  }

  // 10) Quantifier (entiers Minecraft)
  post('10/11 Quantification Minecraft', 0.91);
  const plateauStep = clamp(11 - cfg.plateauAmount * 7, 3, 11);
  for (let i = 0; i < len; i += 1) {
    let h = clamp(map[i], minY, maxY);

    if (h > seaLevel + 12) {
      const terracingBlend = cfg.plateauAmount * 0.24;
      const terrace = Math.round(h / plateauStep) * plateauStep;
      h = lerp(h, terrace, terracingBlend);
    }

    heights[i] = clamp(Math.round(h), minY, maxY);
  }

  // 11) Convertir en grayscale + slope
  post('11/11 Grayscale export', 0.97);
  const image = new Uint8ClampedArray(len * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y, width);
      const c = heights[i];

      const l = heights[idx(Math.max(0, x - 1), y, width)];
      const r = heights[idx(Math.min(width - 1, x + 1), y, width)];
      const u = heights[idx(x, Math.max(0, y - 1), width)];
      const d = heights[idx(x, Math.min(height - 1, y + 1), width)];
      slope[i] = Math.abs(r - l) + Math.abs(d - u) + Math.abs(c - (l + r + u + d) / 4);

      const t = clamp((c - MC_MIN_Y) / Math.max(1, MC_MAX_Y - MC_MIN_Y), 0, 1);
      const g = Math.round(t * 255);
      const o = i * 4;
      image[o] = g;
      image[o + 1] = g;
      image[o + 2] = g;
      image[o + 3] = 255;
    }
  }

  post('Terminé', 1);
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
