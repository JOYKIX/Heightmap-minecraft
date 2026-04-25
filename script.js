const $ = (id) => document.getElementById(id);

const ui = {
  width: $('width'),
  height: $('height'),
  seed: $('seed'),
  preset: $('preset'),
  safeMode: $('safe-mode'),
  seaLevel: $('sea-level'),
  terrainScale: $('terrain-scale'),
  landmassFrequency: $('landmass-frequency'),
  continentRoughness: $('continent-roughness'),
  coastlineComplexity: $('coastline-complexity'),
  islandAsymmetry: $('island-asymmetry'),
  archipelagoFactor: $('archipelago-factor'),
  mountainIntensity: $('mountain-intensity'),
  valleyStrength: $('valley-strength'),
  riverDensity: $('river-density'),
  riverDepth: $('river-depth'),
  erosionAmount: $('erosion-amount'),
  terrainSharpness: $('terrain-sharpness'),
  beachWidth: $('beach-width'),
  cliffChance: $('cliff-chance'),
  previewMode: $('preview-mode'),
  bitDepth: $('bit-depth'),
  zoom: $('zoom'),
  showGrid: $('show-grid'),
  generate: $('generate'),
  downloadPng: $('download-png'),
  downloadJson: $('download-json'),
  downloadRaw16: $('download-raw16'),
  canvas: $('canvas'),
  histogram: $('histogram'),
  progress: $('progress'),
  pipelineStep: $('pipeline-step'),
  stats: $('stats'),
  viewport: $('viewport')
};

const PRESETS = {
  'Realistic Island': { coastlineComplexity: 0.68, islandAsymmetry: 0.56, mountainIntensity: 0.72, archipelagoFactor: 0.28, riverDensity: 0.4, erosionAmount: 0.47 },
  'Pokémon Region Island': { coastlineComplexity: 0.58, islandAsymmetry: 0.42, mountainIntensity: 0.61, archipelagoFactor: 0.44, riverDensity: 0.35, erosionAmount: 0.3 },
  'Dramatic Fantasy': { coastlineComplexity: 0.84, islandAsymmetry: 0.76, mountainIntensity: 0.9, archipelagoFactor: 0.5, riverDensity: 0.46, erosionAmount: 0.22 },
  'Tropical Archipelago': { coastlineComplexity: 0.72, islandAsymmetry: 0.66, mountainIntensity: 0.52, archipelagoFactor: 0.83, riverDensity: 0.28, erosionAmount: 0.38 },
  'Survival Friendly': { coastlineComplexity: 0.49, islandAsymmetry: 0.4, mountainIntensity: 0.55, archipelagoFactor: 0.22, riverDensity: 0.48, erosionAmount: 0.54 },
  'Massive Continent': { coastlineComplexity: 0.41, islandAsymmetry: 0.36, mountainIntensity: 0.64, archipelagoFactor: 0.06, riverDensity: 0.45, erosionAmount: 0.5 },
  'Alpine Region': { coastlineComplexity: 0.52, islandAsymmetry: 0.43, mountainIntensity: 0.94, archipelagoFactor: 0.18, riverDensity: 0.63, erosionAmount: 0.51 },
  'Minecraft Realistic': { coastlineComplexity: 0.63, islandAsymmetry: 0.52, mountainIntensity: 0.82, archipelagoFactor: 0.29, riverDensity: 0.51, erosionAmount: 0.56 },
  'WorldPainter Optimized': { coastlineComplexity: 0.57, islandAsymmetry: 0.47, mountainIntensity: 0.7, archipelagoFactor: 0.2, riverDensity: 0.43, erosionAmount: 0.58 }
};

const ctx = ui.canvas.getContext('2d', { willReadFrequently: true });
const histCtx = ui.histogram.getContext('2d');
let state = { heights: [], config: null };

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

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
function fract(v) { return v - Math.floor(v); }

function valueNoise(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 57.3) * 43758.5453;
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
    total += noise2D(x * f, y * f, seed + i * 19.1) * a;
    norm += a;
    f *= lacunarity;
    a *= gain;
  }
  return total / norm;
}

function ridged(x, y, seed) {
  const n = fbm(x, y, seed, 5, 2.05, 0.52);
  return 1 - Math.abs(n * 2 - 1);
}

function neighbors(x, y, w, h) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h);
}

function collectConfig() {
  const cfg = {
    width: Number(ui.width.value),
    height: Number(ui.height.value),
    seed: ui.seed.value.trim() || 'heightmap',
    safeMode: ui.safeMode.checked,
    seaLevel: Number(ui.seaLevel.value),
    terrainScale: Number(ui.terrainScale.value),
    landmassFrequency: Number(ui.landmassFrequency.value),
    continentRoughness: Number(ui.continentRoughness.value),
    coastlineComplexity: Number(ui.coastlineComplexity.value),
    islandAsymmetry: Number(ui.islandAsymmetry.value),
    archipelagoFactor: Number(ui.archipelagoFactor.value),
    mountainIntensity: Number(ui.mountainIntensity.value),
    valleyStrength: Number(ui.valleyStrength.value),
    riverDensity: Number(ui.riverDensity.value),
    riverDepth: Number(ui.riverDepth.value),
    erosionAmount: Number(ui.erosionAmount.value),
    terrainSharpness: Number(ui.terrainSharpness.value),
    beachWidth: Number(ui.beachWidth.value),
    cliffChance: Number(ui.cliffChance.value),
    bitDepth: Number(ui.bitDepth.value)
  };
  if (cfg.safeMode) cfg.seaLevel = 64;
  return cfg;
}

function setProgress(step, pct) {
  ui.pipelineStep.textContent = step;
  ui.progress.style.width = `${Math.round(pct * 100)}%`;
}

function yBand(continental, mountain, valley, seaLevel) {
  if (continental < 0.2) return lerp(28, 55, continental / 0.2);
  if (continental < 0.3) return lerp(55, seaLevel - 1, (continental - 0.2) / 0.1);
  if (continental < 0.36) return lerp(seaLevel - 2, seaLevel + 5, (continental - 0.3) / 0.06);
  if (continental < 0.58) return lerp(68, 98, (continental - 0.36) / 0.22);
  if (continental < 0.75) return lerp(98, 132, (continental - 0.58) / 0.17);
  const base = lerp(132, 188, (continental - 0.75) / 0.25);
  return base + mountain * 55 - valley * 16;
}

function buildIslandMask(x, y, cfg, seedNum) {
  const nx = x / cfg.width - 0.5;
  const ny = y / cfg.height - 0.5;
  const asym = cfg.islandAsymmetry;
  const angle = Math.atan2(ny, nx);
  const radial = Math.hypot(nx * (1 + asym * 0.45), ny * (1 - asym * 0.35));

  const warp = (fbm(nx * 4, ny * 4, seedNum + 30, 4, 2.2, 0.5) - 0.5) * (0.3 + cfg.coastlineComplexity * 0.7);
  const peninsula = (Math.sin(angle * 3 + seedNum * 0.01) * 0.08 + Math.sin(angle * 7 + seedNum * 0.013) * 0.03) * cfg.coastlineComplexity;
  const arch = fbm(nx * 7, ny * 7, seedNum + 50) * cfg.archipelagoFactor * 0.22;

  const edge = radial + warp - peninsula + arch;
  return clamp(1 - smoothstep(clamp(edge * 1.9, 0, 1)), 0, 1);
}

function quantizeMinecraftLayers(heights, cfg) {
  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      heights[y][x] = clamp(Math.round(heights[y][x]), 0, 255);
    }
  }
}

function postQuantCleanup(heights, cfg) {
  const copy = heights.map((row) => [...row]);
  for (let y = 1; y < cfg.height - 1; y += 1) {
    for (let x = 1; x < cfg.width - 1; x += 1) {
      const n = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => copy[ny][nx]);
      const avg = n.reduce((a, b) => a + b, 0) / n.length;
      if (Math.abs(copy[y][x] - avg) >= 14) heights[y][x] = Math.round((copy[y][x] + avg) / 2);
    }
  }
}

function cleanupForWorldPainter(heights, cfg) {
  const sea = cfg.seaLevel;
  const land = (v) => v >= sea;
  const w = cfg.width;
  const h = cfg.height;

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const here = heights[y][x];
      const ns = neighbors(x, y, w, h).map(([nx, ny]) => heights[ny][nx]);
      const landN = ns.filter(land).length;
      if (!land(here) && landN >= 3) heights[y][x] = sea + 1;
      if (land(here) && landN <= 1) heights[y][x] = sea - 1;
      if (land(here) && here < sea + 1) heights[y][x] = sea + 1;
    }
  }
}

function runErosion(heights, cfg) {
  const iter = Math.floor(2 + cfg.erosionAmount * 8);
  const talus = 1.2 + cfg.erosionAmount * 2.8;
  for (let k = 0; k < iter; k += 1) {
    const d = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));
    for (let y = 1; y < cfg.height - 1; y += 1) {
      for (let x = 1; x < cfg.width - 1; x += 1) {
        const h = heights[y][x];
        let sum = 0;
        for (const [nx, ny] of neighbors(x, y, cfg.width, cfg.height)) {
          const diff = h - heights[ny][nx];
          if (diff > talus) {
            const move = (diff - talus) * 0.18;
            d[y][x] -= move;
            d[ny][nx] += move;
            sum += move;
          }
        }
        if (sum > 2.5) d[y][x] += 0.45;
      }
    }
    for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) heights[y][x] += d[y][x];
  }
}

function carveRivers(heights, cfg, rng) {
  const sourceCount = Math.floor(cfg.width * cfg.height * (0.00003 + cfg.riverDensity * 0.00008));
  const sea = cfg.seaLevel;
  const maxSteps = Math.floor((cfg.width + cfg.height) * 0.85);

  for (let i = 0; i < sourceCount; i += 1) {
    let x = Math.floor(rng() * cfg.width);
    let y = Math.floor(rng() * cfg.height);
    if (heights[y][x] < sea + 24) continue;

    for (let s = 0; s < maxSteps; s += 1) {
      const cur = heights[y][x];
      const options = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => ({ x: nx, y: ny, h: heights[ny][nx] }));
      options.sort((a, b) => a.h - b.h);
      const down = options[0];
      if (!down || down.h > cur + 0.05) break;

      const depth = cfg.riverDepth * (0.35 + s / maxSteps);
      heights[y][x] = Math.max(sea - 3, heights[y][x] - depth * 0.3);
      for (const [nx, ny] of neighbors(x, y, cfg.width, cfg.height)) {
        heights[ny][nx] -= depth * 0.08;
      }

      x = down.x;
      y = down.y;
      if (heights[y][x] <= sea + 1) {
        heights[y][x] = Math.min(heights[y][x], sea);
        break;
      }
    }
  }
}

function coastalPass(heights, cfg, seedNum) {
  const sea = cfg.seaLevel;
  for (let y = 1; y < cfg.height - 1; y += 1) {
    for (let x = 1; x < cfg.width - 1; x += 1) {
      const h = heights[y][x];
      if (h < sea - 8 || h > sea + 14) continue;
      const around = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => heights[ny][nx]);
      const waterN = around.filter((n) => n < sea).length;
      if (waterN === 0) continue;
      const cliffNoise = fbm(x / cfg.width * 5, y / cfg.height * 5, seedNum + 700);
      const cliff = cliffNoise < cfg.cliffChance;
      const beachTop = sea + cfg.beachWidth;
      if (cliff) heights[y][x] = clamp(heights[y][x] + 1.6, sea - 1, sea + 14);
      else heights[y][x] = clamp(lerp(h, sea + 1 + waterN * 0.4, 0.42), sea - 1, beachTop);
    }
  }
}

async function generateTerrain() {
  const cfg = collectConfig();
  ui.canvas.width = cfg.width;
  ui.canvas.height = cfg.height;

  const seedNum = hashString(`${cfg.seed}-${cfg.width}-${cfg.height}-${cfg.seaLevel}`);
  const rng = mulberry32(seedNum);

  const heights = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));

  const steps = [
    '1/13 Float map', '2/13 Continents / islands', '3/13 Relief layering', '4/13 Mountain systems',
    '5/13 Valley carving', '6/13 River drainage', '7/13 Coasts / beaches', '8/13 Erosion pass',
    '9/13 Minecraft Y mapping', '10/13 Artifact cleanup', '11/13 Minecraft quantization',
    '12/13 Grayscale conversion', '13/13 WorldPainter export buffer'
  ];

  setProgress(steps[0], 0.05);
  await new Promise((r) => setTimeout(r, 0));

  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const sx = (x / cfg.width) * cfg.terrainScale * cfg.landmassFrequency;
      const sy = (y / cfg.height) * cfg.terrainScale * cfg.landmassFrequency;
      const warpX = fbm(sx * 2, sy * 2, seedNum + 101, 4, 2.1, 0.5) - 0.5;
      const warpY = fbm(sx * 2, sy * 2, seedNum + 137, 4, 2.1, 0.5) - 0.5;
      const wx = sx + warpX * 0.42 * cfg.coastlineComplexity;
      const wy = sy + warpY * 0.42 * cfg.coastlineComplexity;

      const continental = fbm(wx * 1.6, wy * 1.6, seedNum + 3, 6, 2.02, 0.52);
      const ridge = ridged(wx * 3.1, wy * 3.1, seedNum + 19);
      const valley = fbm(wx * 2.4, wy * 2.4, seedNum + 33, 5, 2.14, 0.49);
      const erosionNoise = fbm(wx * 5.5, wy * 5.5, seedNum + 51, 3, 2, 0.55);
      const detail = fbm(wx * 9.5, wy * 9.5, seedNum + 67, 3, 2.2, 0.5);
      const islandMask = buildIslandMask(x, y, cfg, seedNum);

      const cont = clamp(continental * (0.65 + cfg.continentRoughness * 0.35) * islandMask + cfg.archipelagoFactor * (detail - 0.45) * 0.2, 0, 1);
      const mountainMask = Math.pow(ridge, 1.6) * cfg.mountainIntensity;
      const valleyMask = (1 - Math.pow(valley, 1.15)) * cfg.valleyStrength;
      let h = yBand(cont, mountainMask, valleyMask, cfg.seaLevel);
      h += (erosionNoise - 0.5) * 8 * cfg.continentRoughness;
      h += (detail - 0.5) * 4;
      h = cfg.seaLevel + (h - cfg.seaLevel) * cfg.terrainSharpness;
      heights[y][x] = clamp(h, 0, 255);
    }
  }

  setProgress(steps[3], 0.33);
  await new Promise((r) => setTimeout(r, 0));

  setProgress(steps[5], 0.5);
  carveRivers(heights, cfg, rng);
  await new Promise((r) => setTimeout(r, 0));

  setProgress(steps[6], 0.61);
  coastalPass(heights, cfg, seedNum);
  await new Promise((r) => setTimeout(r, 0));

  setProgress(steps[7], 0.72);
  runErosion(heights, cfg);

  setProgress(steps[9], 0.81);
  if (cfg.safeMode) cleanupForWorldPainter(heights, cfg);

  setProgress(steps[10], 0.9);
  quantizeMinecraftLayers(heights, cfg);
  postQuantCleanup(heights, cfg);

  setProgress(steps[12], 1);
  state = { heights, config: cfg };
  renderPreview();
  renderStats();
  renderHistogram();
}

function yToGray(y) {
  return clamp(Math.round((y / 255) * 255), 0, 255);
}

function colorTerrain(y, sea) {
  if (y < sea - 10) return [10, 40, 95];
  if (y < sea) return [20, 68, 135];
  if (y <= sea + 4) return [214, 191, 138];
  if (y <= 85) return [84, 145, 76];
  if (y <= 120) return [91, 126, 78];
  if (y <= 200) return [116, 112, 105];
  return [238, 242, 255];
}

function slopeAt(x, y, heights, cfg) {
  const c = heights[y][x];
  const l = heights[y][Math.max(0, x - 1)];
  const r = heights[y][Math.min(cfg.width - 1, x + 1)];
  const u = heights[Math.max(0, y - 1)][x];
  const d = heights[Math.min(cfg.height - 1, y + 1)][x];
  return Math.abs(r - l) + Math.abs(d - u) + Math.abs(c - (l + r + u + d) / 4);
}

function renderPreview() {
  if (!state.heights.length) return;
  const { heights, config: cfg } = state;
  const image = ctx.createImageData(cfg.width, cfg.height);
  const mode = ui.previewMode.value;

  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const idx = (y * cfg.width + x) * 4;
      const h = heights[y][x];
      let rgb;

      if (mode === 'grayscale') {
        const g = yToGray(h);
        rgb = [g, g, g];
      } else if (mode === 'terrain') {
        rgb = colorTerrain(h, cfg.seaLevel);
      } else if (mode === 'hillshade') {
        const s = slopeAt(x, y, heights, cfg);
        const g = clamp(Math.round(180 + (h - cfg.seaLevel) * 0.65 - s * 1.8), 10, 245);
        rgb = [g, g, g];
      } else if (mode === 'contour') {
        const g = yToGray(h);
        const contour = h % 8 === 0 || h % 16 === 0;
        rgb = contour ? [255, 245, 150] : [g, g, g];
      } else if (mode === 'water') {
        if (h < cfg.seaLevel) rgb = [21, 87, 196];
        else {
          const g = yToGray(h);
          rgb = [g, g, g];
        }
      } else {
        if (h < cfg.seaLevel) rgb = [33, 74, 171];
        else if (h <= 85) rgb = [71, 163, 72];
        else if (h <= 120) rgb = [130, 144, 62];
        else rgb = [157, 136, 117];
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
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
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
  const total = flat.length;
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const mean = flat.reduce((a, b) => a + b, 0) / total;

  const land = flat.filter((v) => v >= cfg.seaLevel).length;
  const beach = flat.filter((v) => v >= cfg.seaLevel - 2 && v <= cfg.seaLevel + 6).length;
  const plains = flat.filter((v) => v >= 68 && v <= 85).length;
  const hills = flat.filter((v) => v >= 85 && v <= 120).length;
  const mountains = flat.filter((v) => v > 120 && v <= 200).length;
  const peaks = flat.filter((v) => v > 200).length;

  ui.stats.innerHTML = '';
  const rows = [
    `Résolution: ${cfg.width}x${cfg.height}`,
    `Seed: ${cfg.seed}`,
    `Sea level: Y${cfg.seaLevel}`,
    `Altitudes: min ${min} | moy ${mean.toFixed(1)} | max ${max}`,
    `Terres: ${((land / total) * 100).toFixed(1)}% | Océan: ${(100 - (land / total) * 100).toFixed(1)}%`,
    `Plages (Y${cfg.seaLevel - 2}..${cfg.seaLevel + 6}): ${((beach / total) * 100).toFixed(1)}%`,
    `Plaines: ${((plains / total) * 100).toFixed(1)}% | Collines: ${((hills / total) * 100).toFixed(1)}%`,
    `Montagnes: ${((mountains / total) * 100).toFixed(1)}% | Pics: ${((peaks / total) * 100).toFixed(1)}%`,
    cfg.safeMode ? 'Mode: WorldPainter Safe Import (actif)' : 'Mode: custom'
  ];
  rows.forEach((t) => {
    const li = document.createElement('li');
    li.textContent = t;
    ui.stats.appendChild(li);
  });
}

function renderHistogram() {
  const { heights } = state;
  const bins = Array(256).fill(0);
  heights.flat().forEach((v) => { bins[Math.round(v)] += 1; });
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

  histCtx.strokeStyle = '#f0e68c';
  const seaX = (state.config.seaLevel / 255) * ui.histogram.width;
  histCtx.beginPath();
  histCtx.moveTo(seaX, 0);
  histCtx.lineTo(seaX, ui.histogram.height);
  histCtx.stroke();
}

function filenameBase() {
  const cfg = state.config;
  return `heightmap_${cfg.seed}_${cfg.width}x${cfg.height}_worldpainter`;
}

function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportPng() {
  renderPreview();
  const a = document.createElement('a');
  a.download = `${filenameBase()}.png`;
  a.href = ui.canvas.toDataURL('image/png');
  a.click();
}

function exportPresetJson() {
  const payload = {
    preset: ui.preset.value,
    generatedAt: new Date().toISOString(),
    config: state.config,
    notes: 'Altitudes Minecraft quantifiées. 1 pixel = 1 bloc.'
  };
  downloadBlob(`${filenameBase()}_preset.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

function exportRaw16() {
  const raw16 = state.heights.map((row) => row.map((v) => Math.round(v * 257)));
  downloadBlob(`${filenameBase()}_raw16.json`, new Blob([JSON.stringify({ width: state.config.width, height: state.config.height, raw16 }, null, 0)], { type: 'application/json' }));
}

function bindRangeValue(id) {
  const input = $(id);
  const badge = $(`${id}-val`);
  const refresh = () => { badge.textContent = input.value; };
  input.addEventListener('input', refresh);
  refresh();
}

['sea-level', 'terrain-scale', 'landmass-frequency', 'continent-roughness', 'coastline-complexity', 'island-asymmetry', 'archipelago-factor', 'mountain-intensity', 'valley-strength', 'river-density', 'river-depth', 'erosion-amount', 'terrain-sharpness', 'beach-width', 'cliff-chance'].forEach(bindRangeValue);

Object.keys(PRESETS).forEach((p) => {
  const option = document.createElement('option');
  option.value = p;
  option.textContent = p;
  ui.preset.appendChild(option);
});
ui.preset.value = 'Realistic Island';

ui.preset.addEventListener('change', () => {
  const p = PRESETS[ui.preset.value];
  Object.entries(p).forEach(([k, v]) => {
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
ui.downloadJson.addEventListener('click', exportPresetJson);
ui.downloadRaw16.addEventListener('click', exportRaw16);

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
