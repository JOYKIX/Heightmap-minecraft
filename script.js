const $ = (id) => document.getElementById(id);

const ui = {
  width: $('width'), height: $('height'), seed: $('seed'), preset: $('preset'), safeMode: $('safe-mode'),
  seaLevel: $('sea-level'), islandSize: $('island-size'), landmassScale: $('landmass-scale'), landmassDensity: $('landmass-density'),
  coastlineComplexity: $('coastline-complexity'), coastFragmentation: $('coast-fragmentation'), islandAsymmetry: $('island-asymmetry'),
  archipelagoAmount: $('archipelago-amount'), coastErosion: $('coast-erosion'),
  mountainIntensity: $('mountain-intensity'), ridgeSharpness: $('ridge-sharpness'), alpineEffect: $('alpine-effect'), massifSize: $('massif-size'),
  peakAmount: $('peak-amount'), valleyStrength: $('valley-strength'), riverDensity: $('river-density'), erosionStrength: $('erosion-strength'),
  terrainSharpness: $('terrain-sharpness'), plateauAmount: $('plateau-amount'), cliffAmount: $('cliff-amount'), terrainVariation: $('terrain-variation'),
  previewMode: $('preview-mode'), zoom: $('zoom'), showGrid: $('show-grid'),
  generate: $('generate'), downloadPng: $('download-png'), downloadPgm16: $('download-pgm16'), downloadJson: $('download-json'),
  canvas: $('canvas'), histogram: $('histogram'), progress: $('progress'), pipelineStep: $('pipeline-step'), stats: $('stats'), viewport: $('viewport')
};

const PRESETS = {
  'Minecraft Realistic': { coastlineComplexity: 0.68, mountainIntensity: 0.72, riverDensity: 0.45, terrainSharpness: 1.25, erosionStrength: 0.48 },
  'Archipel Dense': { archipelagoAmount: 0.74, landmassDensity: 0.47, coastFragmentation: 0.66, mountainIntensity: 0.54, riverDensity: 0.34 },
  'Alpine Chains': { mountainIntensity: 0.9, ridgeSharpness: 2.4, alpineEffect: 0.84, massifSize: 0.95, peakAmount: 0.72 },
  'WorldPainter Safe': { safeMode: true, seaLevel: 64, coastErosion: 0.52, terrainSharpness: 1.36, cliffAmount: 0.32 }
};

const ctx = ui.canvas.getContext('2d', { willReadFrequently: true });
const histCtx = ui.histogram.getContext('2d');
let state = { floatMap: [], heights: [], config: null, slope: [] };

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
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 57.3) * 43758.5453123;
  return fract(n);
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
    total += noise2D(x * f, y * f, seed + i * 13.7) * a;
    norm += a;
    f *= lacunarity;
    a *= gain;
  }
  return total / norm;
}

function ridged(x, y, seed, sharpness) {
  const n = fbm(x, y, seed, 6, 2.04, 0.51);
  return Math.pow(1 - Math.abs(n * 2 - 1), sharpness);
}

function neighbors(x, y, w, h) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h);
}

function collectConfig() {
  const cfg = {
    width: Number(ui.width.value), height: Number(ui.height.value), seed: ui.seed.value.trim() || 'minecraft-surface',
    safeMode: ui.safeMode.checked, seaLevel: Number(ui.seaLevel.value),
    islandSize: Number(ui.islandSize.value), landmassScale: Number(ui.landmassScale.value), landmassDensity: Number(ui.landmassDensity.value),
    coastlineComplexity: Number(ui.coastlineComplexity.value), coastFragmentation: Number(ui.coastFragmentation.value), islandAsymmetry: Number(ui.islandAsymmetry.value),
    archipelagoAmount: Number(ui.archipelagoAmount.value), coastErosion: Number(ui.coastErosion.value),
    mountainIntensity: Number(ui.mountainIntensity.value), ridgeSharpness: Number(ui.ridgeSharpness.value), alpineEffect: Number(ui.alpineEffect.value),
    massifSize: Number(ui.massifSize.value), peakAmount: Number(ui.peakAmount.value), valleyStrength: Number(ui.valleyStrength.value),
    riverDensity: Number(ui.riverDensity.value), erosionStrength: Number(ui.erosionStrength.value), terrainSharpness: Number(ui.terrainSharpness.value),
    plateauAmount: Number(ui.plateauAmount.value), cliffAmount: Number(ui.cliffAmount.value), terrainVariation: Number(ui.terrainVariation.value)
  };
  if (cfg.safeMode) cfg.seaLevel = 64;
  return cfg;
}

function setProgress(step, pct) {
  ui.pipelineStep.textContent = step;
  ui.progress.style.width = `${Math.round(pct * 100)}%`;
}

function buildIslandMask(x, y, cfg, seedNum) {
  const nx = x / cfg.width - 0.5;
  const ny = y / cfg.height - 0.5;
  const asymX = 1 + cfg.islandAsymmetry * 0.7;
  const asymY = 1 - cfg.islandAsymmetry * 0.5;
  const radial = Math.hypot(nx * asymX, ny * asymY) / cfg.islandSize;
  const ang = Math.atan2(ny, nx);
  const peninsulas = Math.sin(ang * 3.3 + seedNum * 0.001) * 0.09 + Math.sin(ang * 7.4 + seedNum * 0.0023) * 0.04;
  const warp = (fbm(nx * 6.5, ny * 6.5, seedNum + 90, 4, 2.1, 0.55) - 0.5) * (0.22 + cfg.coastlineComplexity * 0.48);
  const bays = (fbm(nx * 8, ny * 8, seedNum + 117, 3, 2.2, 0.5) - 0.5) * cfg.coastFragmentation * 0.35;
  const arch = fbm(nx * 10.5, ny * 10.5, seedNum + 202, 4, 2.25, 0.48) * cfg.archipelagoAmount * 0.2;
  const edge = radial + warp - peninsulas + bays + arch;
  return clamp(1 - smoothstep(clamp(edge * 1.65, 0, 1)), 0, 1);
}

function generateFloatTerrain(cfg) {
  const seedNum = hashString(`${cfg.seed}-${cfg.width}-${cfg.height}`);
  const floatMap = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));

  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const sx = (x / cfg.width) * cfg.landmassScale;
      const sy = (y / cfg.height) * cfg.landmassScale;

      const warpX = (fbm(sx * 2.1, sy * 2.1, seedNum + 7, 4, 2.1, 0.52) - 0.5) * cfg.coastlineComplexity * 0.5;
      const warpY = (fbm(sx * 2.1, sy * 2.1, seedNum + 13, 4, 2.1, 0.52) - 0.5) * cfg.coastlineComplexity * 0.5;
      const wx = sx + warpX;
      const wy = sy + warpY;

      const islandMask = buildIslandMask(x, y, cfg, seedNum);
      const continental = fbm(wx * 1.7, wy * 1.7, seedNum + 30, 6, 2.02, 0.52);
      const coastNoise = fbm(wx * 7, wy * 7, seedNum + 41, 4, 2.2, 0.5);
      const ridge = ridged(wx * (2.4 / cfg.massifSize), wy * (2.4 / cfg.massifSize), seedNum + 61, cfg.ridgeSharpness);
      const valley = fbm(wx * 2.9, wy * 2.9, seedNum + 75, 5, 2.15, 0.49);
      const detail = fbm(wx * 10.5, wy * 10.5, seedNum + 101, 4, 2.25, 0.47);

      const landSignal = continental * (0.6 + cfg.landmassDensity * 0.45) + coastNoise * cfg.coastFragmentation * 0.16;
      const mountainMask = ridge * cfg.mountainIntensity * (0.55 + cfg.alpineEffect * 0.6);
      const valleyMask = (1 - Math.pow(valley, 1.2)) * cfg.valleyStrength;

      let h = 0;
      if (landSignal < 0.22) h = lerp(20, 35, landSignal / 0.22); // abysses
      else if (landSignal < 0.35) h = lerp(35, 58, (landSignal - 0.22) / 0.13); // ocean
      else if (landSignal < 0.43) h = lerp(58, 68, (landSignal - 0.35) / 0.08); // beaches + low plain
      else if (landSignal < 0.62) h = lerp(68, 90, (landSignal - 0.43) / 0.19); // plains
      else if (landSignal < 0.78) h = lerp(90, 140, (landSignal - 0.62) / 0.16); // hills/highland
      else h = lerp(140, 210, (landSignal - 0.78) / 0.22); // mountains

      h += mountainMask * (40 + cfg.peakAmount * 35);
      h -= valleyMask * 22;
      h += (detail - 0.5) * (8 + cfg.terrainVariation * 9);

      const plateauStep = 12 - cfg.plateauAmount * 8;
      h = lerp(h, Math.round(h / plateauStep) * plateauStep, cfg.plateauAmount * 0.25);
      h = cfg.seaLevel + (h - cfg.seaLevel) * cfg.terrainSharpness;

      const coastBlend = clamp((islandMask - 0.35) / 0.4, 0, 1);
      floatMap[y][x] = lerp(24, clamp(h, 20, 255), coastBlend);
    }
  }

  return { floatMap, seedNum };
}

function carveRivers(floatMap, cfg, seedNum) {
  const rng = mulberry32(seedNum ^ 0x5a5a);
  const count = Math.floor(cfg.width * cfg.height * (0.00002 + cfg.riverDensity * 0.0001));
  const maxSteps = Math.floor((cfg.width + cfg.height) * 0.7);

  for (let i = 0; i < count; i += 1) {
    let x = Math.floor(rng() * cfg.width);
    let y = Math.floor(rng() * cfg.height);
    if (floatMap[y][x] < cfg.seaLevel + 28) continue;

    for (let s = 0; s < maxSteps; s += 1) {
      const cur = floatMap[y][x];
      const options = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => ({ x: nx, y: ny, h: floatMap[ny][nx] }));
      options.sort((a, b) => a.h - b.h);
      const next = options[0];
      if (!next || next.h > cur) break;

      const depth = 1.2 + (s / maxSteps) * 4.5;
      floatMap[y][x] -= depth;
      for (const [nx, ny] of neighbors(x, y, cfg.width, cfg.height)) floatMap[ny][nx] -= depth * 0.21;

      x = next.x;
      y = next.y;
      if (floatMap[y][x] <= cfg.seaLevel + 0.5) {
        floatMap[y][x] = Math.min(floatMap[y][x], cfg.seaLevel);
        break;
      }
    }
  }
}

function applyErosion(floatMap, cfg) {
  const iterations = Math.floor(2 + cfg.erosionStrength * 7);
  const talus = 1.3 + cfg.erosionStrength * 2.5;

  for (let k = 0; k < iterations; k += 1) {
    const delta = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));
    for (let y = 1; y < cfg.height - 1; y += 1) {
      for (let x = 1; x < cfg.width - 1; x += 1) {
        const h = floatMap[y][x];
        for (const [nx, ny] of neighbors(x, y, cfg.width, cfg.height)) {
          const diff = h - floatMap[ny][nx];
          if (diff > talus) {
            const moved = (diff - talus) * 0.16;
            delta[y][x] -= moved;
            delta[ny][nx] += moved;
          }
        }
      }
    }
    for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) floatMap[y][x] += delta[y][x];
  }
}

function stabilizeCoasts(floatMap, cfg) {
  for (let y = 1; y < cfg.height - 1; y += 1) {
    for (let x = 1; x < cfg.width - 1; x += 1) {
      const h = floatMap[y][x];
      if (h < cfg.seaLevel - 8 || h > cfg.seaLevel + 12) continue;
      const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => floatMap[ny][nx]);
      const waterN = ns.filter((v) => v < cfg.seaLevel).length;
      if (waterN === 0) continue;
      const cliff = fbm(x / cfg.width * 5, y / cfg.height * 5, 999, 3, 2, 0.55) < cfg.cliffAmount;
      if (cliff) floatMap[y][x] += 1.4;
      else floatMap[y][x] = lerp(h, cfg.seaLevel + 1.5, 0.35 + cfg.coastErosion * 0.2);
    }
  }
}

function applyWorldPainterSafePass(heightInt, cfg) {
  for (let y = 1; y < cfg.height - 1; y += 1) {
    for (let x = 1; x < cfg.width - 1; x += 1) {
      const here = heightInt[y][x];
      const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => heightInt[ny][nx]);
      const avg = ns.reduce((a, b) => a + b, 0) / ns.length;
      if (Math.abs(here - avg) >= 12) heightInt[y][x] = Math.round((here + avg) / 2);
      const landN = ns.filter((n) => n >= cfg.seaLevel).length;
      if (here < cfg.seaLevel && landN >= 3) heightInt[y][x] = cfg.seaLevel;
      if (here >= cfg.seaLevel && landN <= 1) heightInt[y][x] = cfg.seaLevel - 1;
    }
  }
}

function cleanupArtifacts(heightInt, cfg) {
  for (let y = 1; y < cfg.height - 1; y += 1) {
    for (let x = 1; x < cfg.width - 1; x += 1) {
      const here = heightInt[y][x];
      const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => heightInt[ny][nx]);
      const maxN = Math.max(...ns);
      const minN = Math.min(...ns);
      if (here > maxN + 22) heightInt[y][x] = maxN + 8;
      if (here < minN - 18) heightInt[y][x] = minN - 6;
    }
  }
}

function slopeAt(x, y, heights, cfg) {
  const c = heights[y][x];
  const l = heights[y][Math.max(0, x - 1)];
  const r = heights[y][Math.min(cfg.width - 1, x + 1)];
  const u = heights[Math.max(0, y - 1)][x];
  const d = heights[Math.min(cfg.height - 1, y + 1)][x];
  return Math.abs(r - l) + Math.abs(d - u) + Math.abs(c - (l + r + u + d) / 4);
}

function minecraftYToGray(y, minY, maxY, bitDepth = 8) {
  const t = clamp((y - minY) / Math.max(1, (maxY - minY)), 0, 1);
  const max = bitDepth === 16 ? 65535 : 255;
  return Math.round(t * max);
}

async function generateTerrain() {
  const cfg = collectConfig();
  ui.canvas.width = cfg.width;
  ui.canvas.height = cfg.height;
  const steps = [
    '1/12 Float terrain', '2/12 Relief layering', '3/12 Coastal shaping', '4/12 Mountain chains',
    '5/12 Valley carving', '6/12 Rivers', '7/12 Erosion', '8/12 Minecraft Y conversion',
    '9/12 Cleanup', '10/12 Quantization', '11/12 Grayscale mapping', '12/12 Export buffers'
  ];

  setProgress(steps[0], 0.05);
  const { floatMap, seedNum } = generateFloatTerrain(cfg);
  await new Promise((r) => setTimeout(r, 0));

  setProgress(steps[5], 0.45);
  carveRivers(floatMap, cfg, seedNum);
  await new Promise((r) => setTimeout(r, 0));

  setProgress(steps[6], 0.58);
  applyErosion(floatMap, cfg);
  stabilizeCoasts(floatMap, cfg);

  setProgress(steps[8], 0.75);
  const heights = floatMap.map((row) => row.map((v) => clamp(Math.round(v), 0, 255)));
  cleanupArtifacts(heights, cfg);
  if (cfg.safeMode) applyWorldPainterSafePass(heights, cfg);

  setProgress(steps[10], 0.92);
  const slope = Array.from({ length: cfg.height }, (_, y) =>
    Array.from({ length: cfg.width }, (_, x) => slopeAt(x, y, heights, cfg))
  );

  setProgress(steps[11], 1);
  state = { floatMap, heights, config: cfg, slope };
  renderPreview();
  renderStats();
  renderHistogram();
}

function colorTerrain(y, sea) {
  if (y < sea - 14) return [10, 36, 90];
  if (y < sea) return [22, 76, 155];
  if (y <= sea + 4) return [212, 194, 147];
  if (y <= 90) return [84, 145, 76];
  if (y <= 150) return [112, 132, 95];
  if (y <= 210) return [120, 115, 108];
  return [238, 242, 255];
}

function renderPreview() {
  if (!state.heights.length) return;
  const { heights, config: cfg, slope } = state;
  const image = ctx.createImageData(cfg.width, cfg.height);
  const mode = ui.previewMode.value;

  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const idx = (y * cfg.width + x) * 4;
      const h = heights[y][x];
      let rgb = [0, 0, 0];

      if (mode === 'grayscale') {
        const g = minecraftYToGray(h, 0, 255, 8);
        rgb = [g, g, g];
      } else if (mode === 'hillshade') {
        const shade = clamp(180 + (h - cfg.seaLevel) * 0.7 - slope[y][x] * 1.7, 8, 245);
        rgb = [shade, shade, shade];
      } else if (mode === 'topographic') {
        rgb = colorTerrain(h, cfg.seaLevel);
      } else if (mode === 'biome-coloring') {
        if (h < cfg.seaLevel) rgb = [34, 83, 180];
        else if (h <= cfg.seaLevel + 4) rgb = [194, 172, 114];
        else if (h <= 90) rgb = [90, 171, 82];
        else if (h <= 150) rgb = [132, 140, 76];
        else rgb = [147, 126, 108];
      } else if (mode === 'slope-preview') {
        const s = clamp(Math.round(slope[y][x] * 10), 0, 255);
        rgb = [s, 80, 255 - s];
      } else if (mode === 'contour-preview') {
        const g = minecraftYToGray(h, 0, 255, 8);
        const contour = h % 8 === 0 || h % 16 === 0;
        rgb = contour ? [255, 245, 140] : [g, g, g];
      }

      image.data[idx] = rgb[0];
      image.data[idx + 1] = rgb[1];
      image.data[idx + 2] = rgb[2];
      image.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  if (ui.showGrid.checked) drawGridOverlay(cfg.width, cfg.height);
}

function drawGridOverlay(w, h) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function renderStats() {
  const { heights, config: cfg } = state;
  const flat = heights.flat();
  const minY = Math.min(...flat);
  const maxY = Math.max(...flat);
  const mean = flat.reduce((a, b) => a + b, 0) / flat.length;

  const seaGray8 = minecraftYToGray(cfg.seaLevel, minY, maxY, 8);
  const seaGray16 = minecraftYToGray(cfg.seaLevel, minY, maxY, 16);
  const land = flat.filter((v) => v >= cfg.seaLevel).length;
  const oceanPct = 100 - (land / flat.length) * 100;
  const cliffs = flat.filter((v) => v > 150).length;

  const rows = [
    `Résolution: ${cfg.width}x${cfg.height}`,
    `Seed: ${cfg.seed}`,
    `Sea level: Y${cfg.seaLevel}`,
    `Altitude min/max: Y${minY} -> Y${maxY}`,
    `Moyenne: Y${mean.toFixed(1)}`,
    `Sea gray 8-bit: ${seaGray8}`,
    `Sea gray 16-bit: ${seaGray16}`,
    `Terres: ${((land / flat.length) * 100).toFixed(1)}% | Océan: ${oceanPct.toFixed(1)}%`,
    `Hautes altitudes (>Y150): ${((cliffs / flat.length) * 100).toFixed(1)}%`,
    cfg.safeMode ? 'Mode: WorldPainter Safe (quantification + nettoyage + stabilisation)' : 'Mode: Custom'
  ];

  ui.stats.innerHTML = '';
  rows.forEach((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    ui.stats.appendChild(li);
  });
}

function renderHistogram() {
  const bins = Array(256).fill(0);
  state.heights.flat().forEach((v) => { bins[v] += 1; });
  const maxBin = Math.max(...bins);

  histCtx.clearRect(0, 0, ui.histogram.width, ui.histogram.height);
  histCtx.fillStyle = '#0b1324';
  histCtx.fillRect(0, 0, ui.histogram.width, ui.histogram.height);

  for (let i = 0; i < 256; i += 1) {
    const x = (i / 255) * ui.histogram.width;
    const h = (bins[i] / maxBin) * (ui.histogram.height - 16);
    histCtx.fillStyle = i < state.config.seaLevel ? '#3c78d8' : '#7fd38f';
    histCtx.fillRect(x, ui.histogram.height - h, Math.max(1, ui.histogram.width / 256), h);
  }

  const seaX = (state.config.seaLevel / 255) * ui.histogram.width;
  histCtx.strokeStyle = '#f0e68c';
  histCtx.beginPath();
  histCtx.moveTo(seaX, 0);
  histCtx.lineTo(seaX, ui.histogram.height);
  histCtx.stroke();
}

function filenameBase() {
  const cfg = state.config;
  return `heightmap_surface_${cfg.seed}_${cfg.width}x${cfg.height}`;
}

function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPng() {
  if (!state.heights.length) return;
  const { heights, config: cfg } = state;
  const image = ctx.createImageData(cfg.width, cfg.height);
  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const idx = (y * cfg.width + x) * 4;
      const g = minecraftYToGray(heights[y][x], 0, 255, 8);
      image.data[idx] = g;
      image.data[idx + 1] = g;
      image.data[idx + 2] = g;
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const a = document.createElement('a');
  a.download = `${filenameBase()}.png`;
  a.href = ui.canvas.toDataURL('image/png');
  a.click();
  renderPreview();
}

function exportPgm16() {
  if (!state.heights.length) return;
  const { heights, config: cfg } = state;
  const header = `P5\n${cfg.width} ${cfg.height}\n65535\n`;
  const body = new Uint8Array(cfg.width * cfg.height * 2);
  let offset = 0;
  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const gray16 = minecraftYToGray(heights[y][x], 0, 255, 16);
      body[offset++] = (gray16 >> 8) & 0xff;
      body[offset++] = gray16 & 0xff;
    }
  }
  downloadBlob(`${filenameBase()}.pgm`, new Blob([header, body], { type: 'application/octet-stream' }));
}

function exportPresetJson() {
  if (!state.heights.length) return;
  const minY = Math.min(...state.heights.flat());
  const maxY = Math.max(...state.heights.flat());
  const payload = {
    generatedAt: new Date().toISOString(),
    preset: ui.preset.value,
    config: state.config,
    mapping: {
      minY,
      maxY,
      seaLevel: state.config.seaLevel,
      seaGray8: minecraftYToGray(state.config.seaLevel, minY, maxY, 8),
      seaGray16: minecraftYToGray(state.config.seaLevel, minY, maxY, 16)
    },
    note: 'Surface only: relief, altitudes, côtes, vallées, rivières, océan. Aucun underground.'
  };
  downloadBlob(`${filenameBase()}_preset.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

function bindRangeValue(id) {
  const input = $(id);
  const badge = $(`${id}-val`);
  const refresh = () => { badge.textContent = input.value; };
  input.addEventListener('input', refresh);
  refresh();
}

[
  'sea-level', 'island-size', 'landmass-scale', 'landmass-density', 'coastline-complexity', 'coast-fragmentation', 'island-asymmetry', 'archipelago-amount', 'coast-erosion',
  'mountain-intensity', 'ridge-sharpness', 'alpine-effect', 'massif-size', 'peak-amount', 'valley-strength', 'river-density', 'erosion-strength',
  'terrain-sharpness', 'plateau-amount', 'cliff-amount', 'terrain-variation'
].forEach(bindRangeValue);

Object.keys(PRESETS).forEach((name) => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  ui.preset.appendChild(opt);
});
ui.preset.value = 'Minecraft Realistic';

ui.preset.addEventListener('change', () => {
  const preset = PRESETS[ui.preset.value];
  Object.entries(preset).forEach(([k, v]) => {
    if (k === 'safeMode') {
      ui.safeMode.checked = Boolean(v);
      return;
    }
    const id = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const el = $(id);
    if (el) {
      el.value = String(v);
      el.dispatchEvent(new Event('input'));
    }
  });
});

ui.generate.addEventListener('click', generateTerrain);
ui.previewMode.addEventListener('change', renderPreview);
ui.showGrid.addEventListener('change', renderPreview);
ui.zoom.addEventListener('input', () => { ui.canvas.style.transform = `scale(${ui.zoom.value})`; });
ui.downloadPng.addEventListener('click', exportPng);
ui.downloadPgm16.addEventListener('click', exportPgm16);
ui.downloadJson.addEventListener('click', exportPresetJson);

(function enablePan() {
  let drag = false;
  let sx = 0;
  let sy = 0;
  ui.viewport.addEventListener('mousedown', (e) => {
    drag = true;
    sx = e.clientX + ui.viewport.scrollLeft;
    sy = e.clientY + ui.viewport.scrollTop;
  });
  window.addEventListener('mouseup', () => { drag = false; });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    ui.viewport.scrollLeft = sx - e.clientX;
    ui.viewport.scrollTop = sy - e.clientY;
  });
})();

generateTerrain();
