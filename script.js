const $ = (id) => document.getElementById(id);

const MC_MIN_Y = -64;
const MC_MAX_Y = 320;
const SURFACE_MIN_Y = 20;
const SURFACE_MAX_Y = 260;

const ALTITUDE_BANDS = [
  { name: 'Abysses', min: 20, max: 35, roughness: 0.18, slope: 0.32 },
  { name: 'Océan profond', min: 35, max: 50, roughness: 0.2, slope: 0.34 },
  { name: 'Océan moyen', min: 50, max: 58, roughness: 0.18, slope: 0.3 },
  { name: 'Shelf sous-marin', min: 58, max: 63, roughness: 0.24, slope: 0.35 },
  { name: 'Sea level', min: 63, max: 64, roughness: 0.12, slope: 0.1 },
  { name: 'Plage humide', min: 64, max: 66, roughness: 0.22, slope: 0.22 },
  { name: 'Plage sèche', min: 66, max: 69, roughness: 0.24, slope: 0.24 },
  { name: 'Plaine basse', min: 70, max: 82, roughness: 0.26, slope: 0.25 },
  { name: 'Plaine standard', min: 82, max: 95, roughness: 0.32, slope: 0.33 },
  { name: 'Collines', min: 95, max: 120, roughness: 0.4, slope: 0.46 },
  { name: 'Hautes terres', min: 120, max: 150, roughness: 0.48, slope: 0.52 },
  { name: 'Montagnes basses', min: 150, max: 180, roughness: 0.58, slope: 0.63 },
  { name: 'Montagnes élevées', min: 180, max: 220, roughness: 0.7, slope: 0.72 },
  { name: 'Pics', min: 220, max: 260, roughness: 0.84, slope: 0.88 }
];

const ui = {
  width: $('width'), height: $('height'), seed: $('seed'), preset: $('preset'), safeMode: $('safe-mode'),
  seaLevel: $('sea-level'), islandSize: $('island-size'), landmassScale: $('landmass-scale'), landmassDensity: $('landmass-density'),
  coastlineComplexity: $('coastline-complexity'), coastFragmentation: $('coast-fragmentation'), islandAsymmetry: $('island-asymmetry'),
  archipelagoAmount: $('archipelago-amount'), coastErosion: $('coast-erosion'),
  mountainIntensity: $('mountain-intensity'), ridgeSharpness: $('ridge-sharpness'), alpineEffect: $('alpine-effect'), massifSize: $('massif-size'),
  peakAmount: $('peak-amount'), valleyStrength: $('valley-strength'), riverDensity: $('river-density'), erosionStrength: $('erosion-strength'),
  terrainSharpness: $('terrain-sharpness'), plateauAmount: $('plateau-amount'), cliffAmount: $('cliff-amount'), terrainVariation: $('terrain-variation'),
  abyssFrequency: $('abyss-frequency'), shelfWidth: $('shelf-width'), layerContrast: $('layer-contrast'),
  previewMode: $('preview-mode'), zoom: $('zoom'), showGrid: $('show-grid'),
  generate: $('generate'), downloadPng: $('download-png'), downloadPgm16: $('download-pgm16'), downloadJson: $('download-json'),
  canvas: $('canvas'), histogram: $('histogram'), progress: $('progress'), pipelineStep: $('pipeline-step'), stats: $('stats'), viewport: $('viewport')
};

const PRESETS = {
  'Minecraft Realistic': { coastlineComplexity: 0.68, mountainIntensity: 0.72, riverDensity: 0.45, terrainSharpness: 1.25, erosionStrength: 0.48, layerContrast: 1.2 },
  'Archipel Dense': { archipelagoAmount: 0.74, landmassDensity: 0.47, coastFragmentation: 0.66, mountainIntensity: 0.54, riverDensity: 0.34, shelfWidth: 0.7 },
  'Alpine Chains': { mountainIntensity: 0.9, ridgeSharpness: 2.4, alpineEffect: 0.84, massifSize: 0.95, peakAmount: 0.72, layerContrast: 1.36 },
  'WorldPainter Safe': { safeMode: true, seaLevel: 64, coastErosion: 0.52, terrainSharpness: 1.36, cliffAmount: 0.32, abyssFrequency: 0.14 }
};

const ctx = ui.canvas.getContext('2d', { willReadFrequently: true });
const histCtx = ui.histogram.getContext('2d');
let state = { floatMap: [], heights: [], config: null, slope: [], bands: [] };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t * t * (3 - 2 * t);
const fract = (v) => v - Math.floor(v);

function hashString(str) { let h = 2166136261; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed) { return () => { seed += 0x6d2b79f5; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function valueNoise(x, y, seed) { return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 57.3) * 43758.5453123); }

function noise2D(x, y, seed) {
  const xi = Math.floor(x); const yi = Math.floor(y); const xf = x - xi; const yf = y - yi;
  const n00 = valueNoise(xi, yi, seed), n10 = valueNoise(xi + 1, yi, seed), n01 = valueNoise(xi, yi + 1, seed), n11 = valueNoise(xi + 1, yi + 1, seed);
  const u = smoothstep(xf), v = smoothstep(yf);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

function fbm(x, y, seed, octaves = 5, lacunarity = 2, gain = 0.5) {
  let f = 1, a = 1, total = 0, norm = 0;
  for (let i = 0; i < octaves; i += 1) { total += noise2D(x * f, y * f, seed + i * 17.3) * a; norm += a; f *= lacunarity; a *= gain; }
  return total / norm;
}

function ridged(x, y, seed, sharpness) { return Math.pow(1 - Math.abs(fbm(x, y, seed, 6, 2.04, 0.51) * 2 - 1), sharpness); }
function neighbors(x, y, w, h) { return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h); }

function collectConfig() {
  const cfg = {
    width: Number(ui.width.value), height: Number(ui.height.value), seed: ui.seed.value.trim() || 'minecraft-surface', safeMode: ui.safeMode.checked,
    seaLevel: Number(ui.seaLevel.value), islandSize: Number(ui.islandSize.value), landmassScale: Number(ui.landmassScale.value), landmassDensity: Number(ui.landmassDensity.value),
    coastlineComplexity: Number(ui.coastlineComplexity.value), coastFragmentation: Number(ui.coastFragmentation.value), islandAsymmetry: Number(ui.islandAsymmetry.value),
    archipelagoAmount: Number(ui.archipelagoAmount.value), coastErosion: Number(ui.coastErosion.value),
    mountainIntensity: Number(ui.mountainIntensity.value), ridgeSharpness: Number(ui.ridgeSharpness.value), alpineEffect: Number(ui.alpineEffect.value), massifSize: Number(ui.massifSize.value),
    peakAmount: Number(ui.peakAmount.value), valleyStrength: Number(ui.valleyStrength.value), riverDensity: Number(ui.riverDensity.value), erosionStrength: Number(ui.erosionStrength.value),
    terrainSharpness: Number(ui.terrainSharpness.value), plateauAmount: Number(ui.plateauAmount.value), cliffAmount: Number(ui.cliffAmount.value), terrainVariation: Number(ui.terrainVariation.value),
    abyssFrequency: Number(ui.abyssFrequency.value), shelfWidth: Number(ui.shelfWidth.value), layerContrast: Number(ui.layerContrast.value)
  };
  if (cfg.safeMode) cfg.seaLevel = 64;
  return cfg;
}

function setProgress(step, pct) { ui.pipelineStep.textContent = step; ui.progress.style.width = `${Math.round(pct * 100)}%`; }

function buildIslandMask(x, y, cfg, seedNum) {
  const nx = x / cfg.width - 0.5, ny = y / cfg.height - 0.5;
  const radial = Math.hypot(nx * (1 + cfg.islandAsymmetry * 0.7), ny * (1 - cfg.islandAsymmetry * 0.45)) / cfg.islandSize;
  const ang = Math.atan2(ny, nx);
  const peninsulas = Math.sin(ang * 3.1 + seedNum * 0.001) * 0.11 + Math.sin(ang * 8.2 + seedNum * 0.002) * 0.05;
  const warp = (fbm(nx * 7, ny * 7, seedNum + 90, 4, 2.1, 0.55) - 0.5) * (0.3 + cfg.coastlineComplexity * 0.5);
  const bays = (fbm(nx * 10.5, ny * 10.5, seedNum + 117, 3, 2.2, 0.5) - 0.5) * cfg.coastFragmentation * 0.45;
  const archipelago = fbm(nx * 13, ny * 13, seedNum + 202, 4, 2.25, 0.48) * cfg.archipelagoAmount * 0.2;
  const edge = radial + warp - peninsulas + bays + archipelago;
  return clamp(1 - smoothstep(clamp(edge * 1.5, 0, 1)), 0, 1);
}

function findBandByY(y) { return ALTITUDE_BANDS.find((band) => y >= band.min && y <= band.max) || ALTITUDE_BANDS[ALTITUDE_BANDS.length - 1]; }

function generateFloatTerrain(cfg, seedNum) {
  const map = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));
  const bands = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));
  for (let y = 0; y < cfg.height; y += 1) {
    for (let x = 0; x < cfg.width; x += 1) {
      const sx = (x / cfg.width) * cfg.landmassScale; const sy = (y / cfg.height) * cfg.landmassScale;
      const warpX = (fbm(sx * 2.1, sy * 2.1, seedNum + 7, 4, 2.1, 0.52) - 0.5) * cfg.coastlineComplexity * 0.6;
      const warpY = (fbm(sx * 2.1, sy * 2.1, seedNum + 13, 4, 2.1, 0.52) - 0.5) * cfg.coastlineComplexity * 0.6;
      const wx = sx + warpX, wy = sy + warpY;
      const islandMask = buildIslandMask(x, y, cfg, seedNum);
      const continental = fbm(wx * 1.8, wy * 1.8, seedNum + 30, 6, 2.02, 0.52);
      const shelf = fbm(wx * 5.8, wy * 5.8, seedNum + 38, 4, 2.1, 0.53) * cfg.shelfWidth;
      const coastal = fbm(wx * 8.5, wy * 8.5, seedNum + 44, 4, 2.2, 0.5);
      const abyss = fbm(wx * 4.2, wy * 4.2, seedNum + 49, 5, 2.15, 0.48);
      const baseSignal = (continental * (0.62 + cfg.landmassDensity * 0.4)) + (coastal - 0.5) * 0.12 + (shelf - 0.5) * 0.14 - (0.5 - abyss) * cfg.abyssFrequency * 0.12;

      let h;
      if (baseSignal < 0.22) h = lerp(20, 35, baseSignal / 0.22);
      else if (baseSignal < 0.38) h = lerp(35, 58, (baseSignal - 0.22) / 0.16);
      else if (baseSignal < 0.48) h = lerp(58, 69, (baseSignal - 0.38) / 0.1);
      else if (baseSignal < 0.68) h = lerp(70, 95, (baseSignal - 0.48) / 0.2);
      else if (baseSignal < 0.83) h = lerp(95, 150, (baseSignal - 0.68) / 0.15);
      else h = lerp(150, 220, (baseSignal - 0.83) / 0.17);

      h = lerp(24, h, clamp((islandMask - 0.25) / 0.55, 0, 1));
      h = cfg.seaLevel + (h - cfg.seaLevel) * cfg.layerContrast;
      const band = findBandByY(h);
      const micro = (fbm(wx * 16, wy * 16, seedNum + 88, 3, 2.3, 0.46) - 0.5) * (band.roughness * (4 + cfg.terrainVariation * 8));
      map[y][x] = clamp(h + micro, SURFACE_MIN_Y, SURFACE_MAX_Y);
      bands[y][x] = ALTITUDE_BANDS.indexOf(band);
    }
  }
  return { map, bands };
}

function shapeCoasts(floatMap, cfg, seedNum) {
  for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
    const h = floatMap[y][x]; if (h < cfg.seaLevel - 10 || h > cfg.seaLevel + 14) continue;
    const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => floatMap[ny][nx]);
    const water = ns.filter((n) => n < cfg.seaLevel).length; if (water === 0) continue;
    const capNoise = fbm(x / cfg.width * 8, y / cfg.height * 8, seedNum + 211, 3, 2.2, 0.52);
    const cliff = capNoise < cfg.cliffAmount;
    floatMap[y][x] = cliff ? h + 1.1 : lerp(h, cfg.seaLevel + 1.7, 0.35 + cfg.coastErosion * 0.2);
  }
}

function applyLocalRelief(floatMap, cfg, seedNum) {
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    const h = floatMap[y][x];
    const band = findBandByY(h);
    const localNoise = (fbm(x / cfg.width * 18, y / cfg.height * 18, seedNum + 260, 4, 2.3, 0.48) - 0.5) * band.roughness * 7;
    const breaks = (fbm(x / cfg.width * 42, y / cfg.height * 42, seedNum + 270, 2, 2, 0.5) > 0.67 ? band.slope * 2.2 : 0);
    floatMap[y][x] = clamp(h + localNoise + breaks, SURFACE_MIN_Y, SURFACE_MAX_Y);
  }
}

function addMountains(floatMap, cfg, seedNum) {
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    const wx = x / cfg.width, wy = y / cfg.height;
    const ridge = ridged(wx * (2.9 / cfg.massifSize), wy * (2.9 / cfg.massifSize), seedNum + 301, cfg.ridgeSharpness);
    const chainMask = fbm(wx * 2.4, wy * 2.4, seedNum + 313, 4, 2.08, 0.53);
    const alpine = ridged(wx * 6.2, wy * 6.2, seedNum + 333, 1.7) * cfg.alpineEffect;
    let uplift = ridge * chainMask * cfg.mountainIntensity * 68 + alpine * 26;
    if (chainMask > 0.7) uplift += cfg.peakAmount * 28;
    floatMap[y][x] = clamp(floatMap[y][x] + uplift, SURFACE_MIN_Y, SURFACE_MAX_Y);
  }
}

function carveValleys(floatMap, cfg, seedNum) {
  for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
    const valleyMask = 1 - Math.pow(fbm(x / cfg.width * 3.4, y / cfg.height * 3.4, seedNum + 370, 5, 2.1, 0.48), 1.16);
    const cut = valleyMask * cfg.valleyStrength * (floatMap[y][x] > 95 ? 22 : 9);
    floatMap[y][x] = clamp(floatMap[y][x] - cut, SURFACE_MIN_Y, SURFACE_MAX_Y);
  }
}

function carveRivers(floatMap, cfg, seedNum) {
  const rng = mulberry32(seedNum ^ 0x5a5a);
  const riverCount = Math.floor(cfg.width * cfg.height * (0.00002 + cfg.riverDensity * 0.00009));
  const maxSteps = Math.floor((cfg.width + cfg.height) * 0.8);

  for (let i = 0; i < riverCount; i += 1) {
    let x = Math.floor(rng() * cfg.width), y = Math.floor(rng() * cfg.height);
    if (floatMap[y][x] < 105) continue;
    for (let s = 0; s < maxSteps; s += 1) {
      const current = floatMap[y][x];
      const options = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => ({ x: nx, y: ny, h: floatMap[ny][nx] })).sort((a, b) => a.h - b.h);
      const next = options[0]; if (!next || next.h > current) break;
      const depth = 1.1 + (s / maxSteps) * 3.8;
      floatMap[y][x] -= depth;
      for (const [nx, ny] of neighbors(x, y, cfg.width, cfg.height)) floatMap[ny][nx] -= depth * 0.19;
      x = next.x; y = next.y;
      if (floatMap[y][x] <= cfg.seaLevel + 0.5) { floatMap[y][x] = Math.min(floatMap[y][x], cfg.seaLevel); break; }
    }
  }
}

function applyErosion(floatMap, cfg) {
  const iterations = Math.floor(2 + cfg.erosionStrength * 7), talus = 1.3 + cfg.erosionStrength * 2.5;
  for (let k = 0; k < iterations; k += 1) {
    const delta = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(0));
    for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
      const h = floatMap[y][x];
      for (const [nx, ny] of neighbors(x, y, cfg.width, cfg.height)) {
        const diff = h - floatMap[ny][nx];
        if (diff > talus) { const moved = (diff - talus) * 0.16; delta[y][x] -= moved; delta[ny][nx] += moved; }
      }
    }
    for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) floatMap[y][x] += delta[y][x];
  }
}

function quantizeMinecraft(floatMap) { return floatMap.map((row) => row.map((v) => clamp(Math.round(v), SURFACE_MIN_Y, SURFACE_MAX_Y))); }

function cleanupArtifacts(heightInt, cfg) {
  for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
    const here = heightInt[y][x];
    const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => heightInt[ny][nx]);
    const maxN = Math.max(...ns), minN = Math.min(...ns);
    if (here > maxN + 22) heightInt[y][x] = maxN + 8;
    if (here < minN - 18) heightInt[y][x] = minN - 6;
  }

  const visited = Array.from({ length: cfg.height }, () => Array(cfg.width).fill(false));
  const minIslandSize = Math.max(64, Math.floor((cfg.width * cfg.height) * 0.00012));
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    if (visited[y][x] || heightInt[y][x] < cfg.seaLevel) continue;
    const queue = [[x, y]], cells = [];
    visited[y][x] = true;
    while (queue.length) {
      const [cx, cy] = queue.pop();
      cells.push([cx, cy]);
      for (const [nx, ny] of neighbors(cx, cy, cfg.width, cfg.height)) {
        if (!visited[ny][nx] && heightInt[ny][nx] >= cfg.seaLevel) { visited[ny][nx] = true; queue.push([nx, ny]); }
      }
    }
    if (cells.length < minIslandSize) cells.forEach(([cx, cy]) => { heightInt[cy][cx] = cfg.seaLevel - 1; });
  }
}

function applyWorldPainterSafePass(heightInt, cfg) {
  for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
    const here = heightInt[y][x];
    const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => heightInt[ny][nx]);
    const avg = ns.reduce((a, b) => a + b, 0) / ns.length;
    if (Math.abs(here - avg) >= 12) heightInt[y][x] = Math.round((here + avg) / 2);
    const landN = ns.filter((n) => n >= cfg.seaLevel).length;
    if (here < cfg.seaLevel && landN >= 3) heightInt[y][x] = cfg.seaLevel;
    if (here >= cfg.seaLevel && landN <= 1) heightInt[y][x] = cfg.seaLevel - 1;
  }
}

function localContrastPass(heightInt, cfg) {
  for (let y = 1; y < cfg.height - 1; y += 1) for (let x = 1; x < cfg.width - 1; x += 1) {
    const here = heightInt[y][x];
    const ns = neighbors(x, y, cfg.width, cfg.height).map(([nx, ny]) => heightInt[ny][nx]);
    const localMean = ns.reduce((a, b) => a + b, 0) / ns.length;
    const boosted = here + (here - localMean) * (0.25 + (cfg.terrainSharpness - 1) * 0.3);
    heightInt[y][x] = clamp(Math.round(boosted), SURFACE_MIN_Y, SURFACE_MAX_Y);
  }
}

function slopeAt(x, y, heights, cfg) {
  const c = heights[y][x], l = heights[y][Math.max(0, x - 1)], r = heights[y][Math.min(cfg.width - 1, x + 1)], u = heights[Math.max(0, y - 1)][x], d = heights[Math.min(cfg.height - 1, y + 1)][x];
  return Math.abs(r - l) + Math.abs(d - u) + Math.abs(c - (l + r + u + d) / 4);
}

function minecraftYToGray(y, minY, maxY, bitDepth = 8) {
  const t = clamp((y - minY) / Math.max(1, maxY - minY), 0, 1);
  const max = bitDepth === 16 ? 65535 : 255;
  return Math.round(t * max);
}

async function generateTerrain() {
  const cfg = collectConfig();
  ui.canvas.width = cfg.width; ui.canvas.height = cfg.height;
  const seedNum = hashString(`${cfg.seed}-${cfg.width}-${cfg.height}`);
  const stepList = [
    '1/13 Génération float', '2/13 Construction masse terrestre', '3/13 Attribution altitudinale', '4/13 Génération côtière', '5/13 Relief local',
    '6/13 Montagnes', '7/13 Vallées', '8/13 Rivières', '9/13 Érosion', '10/13 Quantification Minecraft', '11/13 Nettoyage', '12/13 Conversion grayscale', '13/13 Export buffers'
  ];

  setProgress(stepList[0], 0.04);
  const { map, bands } = generateFloatTerrain(cfg, seedNum);
  await new Promise((r) => setTimeout(r, 0));

  setProgress(stepList[3], 0.28); shapeCoasts(map, cfg, seedNum);
  setProgress(stepList[4], 0.36); applyLocalRelief(map, cfg, seedNum);
  setProgress(stepList[5], 0.44); addMountains(map, cfg, seedNum);
  setProgress(stepList[6], 0.52); carveValleys(map, cfg, seedNum);
  setProgress(stepList[7], 0.62); carveRivers(map, cfg, seedNum);
  setProgress(stepList[8], 0.71); applyErosion(map, cfg);

  setProgress(stepList[9], 0.8);
  const heights = quantizeMinecraft(map);
  const plateauStep = 12 - cfg.plateauAmount * 8;
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    heights[y][x] = clamp(Math.round(lerp(heights[y][x], Math.round(heights[y][x] / plateauStep) * plateauStep, cfg.plateauAmount * 0.24)), SURFACE_MIN_Y, SURFACE_MAX_Y);
  }

  setProgress(stepList[10], 0.88);
  cleanupArtifacts(heights, cfg);
  localContrastPass(heights, cfg);
  if (cfg.safeMode) applyWorldPainterSafePass(heights, cfg);

  setProgress(stepList[11], 0.94);
  const slope = Array.from({ length: cfg.height }, (_, y) => Array.from({ length: cfg.width }, (_, x) => slopeAt(x, y, heights, cfg)));

  setProgress(stepList[12], 1);
  state = { floatMap: map, heights, config: cfg, slope, bands };
  renderPreview(); renderStats(); renderHistogram();
}

function heatColor(t) {
  const r = clamp(Math.round(255 * (1.5 * t)), 0, 255);
  const g = clamp(Math.round(255 * (1.4 - Math.abs(t - 0.5) * 2)), 0, 255);
  const b = clamp(Math.round(255 * (1.2 - 1.6 * t)), 0, 255);
  return [r, g, b];
}

function renderPreview() {
  if (!state.heights.length) return;
  const { heights, config: cfg, slope } = state;
  const image = ctx.createImageData(cfg.width, cfg.height);
  const mode = ui.previewMode.value;
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    const idx = (y * cfg.width + x) * 4, h = heights[y][x];
    let rgb = [0, 0, 0];
    if (mode === 'grayscale') { const g = minecraftYToGray(h, MC_MIN_Y, MC_MAX_Y, 8); rgb = [g, g, g]; }
    else if (mode === 'hillshade') { const shade = clamp(185 + (h - cfg.seaLevel) * 0.75 - slope[y][x] * 1.8, 8, 245); rgb = [shade, shade, shade]; }
    else if (mode === 'contour-preview') { const g = minecraftYToGray(h, MC_MIN_Y, MC_MAX_Y, 8); rgb = (h % 8 === 0 || h % 16 === 0) ? [255, 245, 140] : [g, g, g]; }
    else if (mode === 'slope-preview') { const s = clamp(Math.round(slope[y][x] * 10), 0, 255); rgb = [s, 80, 255 - s]; }
    else if (mode === 'altitude-heatmap') rgb = heatColor(clamp((h - SURFACE_MIN_Y) / (SURFACE_MAX_Y - SURFACE_MIN_Y), 0, 1));
    image.data[idx] = rgb[0]; image.data[idx + 1] = rgb[1]; image.data[idx + 2] = rgb[2]; image.data[idx + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (ui.showGrid.checked) drawGridOverlay(cfg.width, cfg.height);
}

function drawGridOverlay(w, h) {
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
  ctx.restore();
}

function renderStats() {
  const { heights, config: cfg } = state;
  const flat = heights.flat(), minY = Math.min(...flat), maxY = Math.max(...flat), mean = flat.reduce((a, b) => a + b, 0) / flat.length;
  const seaGray8 = minecraftYToGray(cfg.seaLevel, MC_MIN_Y, MC_MAX_Y, 8), seaGray16 = minecraftYToGray(cfg.seaLevel, MC_MIN_Y, MC_MAX_Y, 16);
  const land = flat.filter((v) => v >= cfg.seaLevel).length, oceanPct = 100 - (land / flat.length) * 100;
  const rows = [
    `Résolution: ${cfg.width}x${cfg.height}`,
    `Seed: ${cfg.seed}`,
    `Sea level: Y${cfg.seaLevel} (pivot Minecraft 1.21)`,
    `Altitude min/max: Y${minY} -> Y${maxY} (surface cible Y20 -> Y260)`,
    `Moyenne: Y${mean.toFixed(1)}`,
    `Mapping global: minY ${MC_MIN_Y}, maxY ${MC_MAX_Y}`,
    `Sea gray 8-bit: ${seaGray8}`,
    `Sea gray 16-bit: ${seaGray16}`,
    `Terres: ${((land / flat.length) * 100).toFixed(1)}% | Océan: ${oceanPct.toFixed(1)}%`,
    cfg.safeMode ? 'Mode: WorldPainter Safe (anti-trous + anti-artefacts)' : 'Mode: Custom'
  ];
  ui.stats.innerHTML = ''; rows.forEach((text) => { const li = document.createElement('li'); li.textContent = text; ui.stats.appendChild(li); });
}

function renderHistogram() {
  const bins = Array(261).fill(0);
  state.heights.flat().forEach((v) => { bins[v] += 1; });
  const maxBin = Math.max(...bins);
  histCtx.clearRect(0, 0, ui.histogram.width, ui.histogram.height);
  histCtx.fillStyle = '#0b1324'; histCtx.fillRect(0, 0, ui.histogram.width, ui.histogram.height);
  for (let i = SURFACE_MIN_Y; i <= SURFACE_MAX_Y; i += 1) {
    const x = ((i - SURFACE_MIN_Y) / (SURFACE_MAX_Y - SURFACE_MIN_Y)) * ui.histogram.width;
    const h = (bins[i] / maxBin) * (ui.histogram.height - 16);
    histCtx.fillStyle = i < state.config.seaLevel ? '#3c78d8' : '#7fd38f';
    histCtx.fillRect(x, ui.histogram.height - h, Math.max(1, ui.histogram.width / 256), h);
  }
  const seaX = ((state.config.seaLevel - SURFACE_MIN_Y) / (SURFACE_MAX_Y - SURFACE_MIN_Y)) * ui.histogram.width;
  histCtx.strokeStyle = '#f0e68c'; histCtx.beginPath(); histCtx.moveTo(seaX, 0); histCtx.lineTo(seaX, ui.histogram.height); histCtx.stroke();
}

function filenameBase() { const cfg = state.config; return `heightmap_surface_${cfg.seed}_${cfg.width}x${cfg.height}`; }
function downloadBlob(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); }

function exportPng() {
  if (!state.heights.length) return;
  const { heights, config: cfg } = state;
  const image = ctx.createImageData(cfg.width, cfg.height);
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    const idx = (y * cfg.width + x) * 4;
    const g = minecraftYToGray(heights[y][x], MC_MIN_Y, MC_MAX_Y, 8);
    image.data[idx] = g; image.data[idx + 1] = g; image.data[idx + 2] = g; image.data[idx + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const a = document.createElement('a'); a.download = `${filenameBase()}.png`; a.href = ui.canvas.toDataURL('image/png'); a.click();
  renderPreview();
}

function exportPgm16() {
  if (!state.heights.length) return;
  const { heights, config: cfg } = state;
  const header = `P5\n${cfg.width} ${cfg.height}\n65535\n`;
  const body = new Uint8Array(cfg.width * cfg.height * 2);
  let offset = 0;
  for (let y = 0; y < cfg.height; y += 1) for (let x = 0; x < cfg.width; x += 1) {
    const gray16 = minecraftYToGray(heights[y][x], MC_MIN_Y, MC_MAX_Y, 16);
    body[offset++] = (gray16 >> 8) & 0xff; body[offset++] = gray16 & 0xff;
  }
  downloadBlob(`${filenameBase()}.pgm`, new Blob([header, body], { type: 'application/octet-stream' }));
}

function exportPresetJson() {
  if (!state.heights.length) return;
  const minY = Math.min(...state.heights.flat()), maxY = Math.max(...state.heights.flat());
  const payload = {
    generatedAt: new Date().toISOString(), preset: ui.preset.value, config: state.config,
    minecraftVersion: '1.21+',
    pipeline: ['float', 'landmass', 'altitude attribution', 'coast', 'local relief', 'mountains', 'valleys', 'rivers', 'erosion', 'minecraft quantization', 'cleanup', 'grayscale', 'export'],
    mapping: { minY, maxY, minecraftMinY: MC_MIN_Y, minecraftMaxY: MC_MAX_Y, seaLevel: state.config.seaLevel, seaGray8: minecraftYToGray(state.config.seaLevel, MC_MIN_Y, MC_MAX_Y, 8), seaGray16: minecraftYToGray(state.config.seaLevel, MC_MIN_Y, MC_MAX_Y, 16) },
    note: 'Surface only: relief visible uniquement. Pas de caves, minerais, structures ou underground.'
  };
  downloadBlob(`${filenameBase()}_preset.json`, new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
}

function bindRangeValue(id) { const input = $(id); const badge = $(`${id}-val`); const refresh = () => { badge.textContent = input.value; }; input.addEventListener('input', refresh); refresh(); }
[
  'sea-level', 'abyss-frequency', 'shelf-width', 'layer-contrast', 'island-size', 'landmass-scale', 'landmass-density', 'coastline-complexity', 'coast-fragmentation',
  'island-asymmetry', 'archipelago-amount', 'coast-erosion', 'mountain-intensity', 'ridge-sharpness', 'alpine-effect', 'massif-size', 'peak-amount',
  'valley-strength', 'river-density', 'erosion-strength', 'terrain-sharpness', 'plateau-amount', 'cliff-amount', 'terrain-variation'
].forEach(bindRangeValue);

Object.keys(PRESETS).forEach((name) => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; ui.preset.appendChild(opt); });
ui.preset.value = 'Minecraft Realistic';

ui.preset.addEventListener('change', () => {
  const preset = PRESETS[ui.preset.value];
  Object.entries(preset).forEach(([k, v]) => {
    if (k === 'safeMode') { ui.safeMode.checked = Boolean(v); return; }
    const id = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const el = $(id);
    if (el) { el.value = String(v); el.dispatchEvent(new Event('input')); }
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
  let drag = false, sx = 0, sy = 0;
  ui.viewport.addEventListener('mousedown', (e) => { drag = true; sx = e.clientX + ui.viewport.scrollLeft; sy = e.clientY + ui.viewport.scrollTop; });
  window.addEventListener('mouseup', () => { drag = false; });
  window.addEventListener('mousemove', (e) => { if (!drag) return; ui.viewport.scrollLeft = sx - e.clientX; ui.viewport.scrollTop = sy - e.clientY; });
})();

generateTerrain();
