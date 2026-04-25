const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const landInput = document.getElementById('land');
const oceanInput = document.getElementById('ocean');
const riverInput = document.getElementById('river');
const seedInput = document.getElementById('seed');
const seaLevelInput = document.getElementById('sea-level');
const minYInput = document.getElementById('min-y');
const maxYInput = document.getElementById('max-y');
const bitDepthInput = document.getElementById('bit-depth');
const quantizeInput = document.getElementById('quantize');
const ditherInput = document.getElementById('dither');
const safeModeInput = document.getElementById('safe-mode');
const stats = document.getElementById('stats');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function createValueNoise(rng, gridSizeX, gridSizeY) {
  const values = Array.from({ length: gridSizeY + 1 }, () =>
    Array.from({ length: gridSizeX + 1 }, () => rng())
  );

  return function noise(x, y, width, height) {
    const gx = (x / width) * gridSizeX;
    const gy = (y / height) * gridSizeY;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, gridSizeX);
    const y1 = Math.min(y0 + 1, gridSizeY);
    const sx = smoothstep(gx - x0);
    const sy = smoothstep(gy - y0);

    const n0 = values[y0][x0] * (1 - sx) + values[y0][x1] * sx;
    const n1 = values[y1][x0] * (1 - sx) + values[y1][x1] * sx;
    return n0 * (1 - sy) + n1 * sy;
  };
}

function neighbors(x, y, width, height) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1]
  ].filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(clamp(fraction, 0, 1) * (sorted.length - 1));
  return sorted[index];
}

function generateAltitudeFromBands(continental, mountainNoise, seaLevel) {
  // Bandes d'altitude Minecraft inspirées des biomes.
  if (continental < 0.12) {
    return lerp(25, 45, continental / 0.12); // Deep ocean
  }
  if (continental < 0.2) {
    return lerp(45, 56, (continental - 0.12) / 0.08); // Ocean
  }
  if (continental < 0.28) {
    return lerp(56, 63, (continental - 0.2) / 0.08); // Shallow water
  }
  if (continental < 0.36) {
    return lerp(seaLevel - 2, seaLevel + 4, (continental - 0.28) / 0.08); // Beach/coast
  }
  if (continental < 0.5) {
    return lerp(68, 90, (continental - 0.36) / 0.14); // Lowland + plains
  }
  if (continental < 0.66) {
    return lerp(90, 120, (continental - 0.5) / 0.16); // Hills
  }
  if (continental < 0.78) {
    return lerp(120, 150, (continental - 0.66) / 0.12); // Highlands
  }

  const mountainBase = lerp(150, 210, (continental - 0.78) / 0.22);
  if (mountainNoise > 0.82) {
    return mountainBase + (mountainNoise - 0.82) * 250; // Peaks >210
  }
  return mountainBase;
}

function stabilizeCoastlines(heightmap, width, height, seaLevel, rng) {
  const copy = heightmap.map((row) => [...row]);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const h = copy[y][x];
      const nearSea = h >= seaLevel - 6 && h <= seaLevel + 8;
      if (!nearSea) {
        continue;
      }

      const adjacent = neighbors(x, y, width, height).map(([nx, ny]) => copy[ny][nx]);
      const waterNeighbors = adjacent.filter((v) => v < seaLevel).length;
      const landNeighbors = adjacent.length - waterNeighbors;

      if (waterNeighbors > 0 && landNeighbors > 0) {
        if (h < seaLevel - 1) {
          heightmap[y][x] = lerp(h, seaLevel - 1, 0.7);
        } else if (h <= seaLevel + 1) {
          heightmap[y][x] = seaLevel + (rng() < 0.6 ? 0 : 1);
        } else if (h <= seaLevel + 6) {
          heightmap[y][x] = lerp(h, seaLevel + 3 + rng() * 2, 0.5);
        }
      }
    }
  }
}

function cleanupMicroFeatures(heightmap, width, height, seaLevel) {
  const waterMask = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => heightmap[y][x] < seaLevel)
  );

  function flood(startX, startY, isWater) {
    const queue = [[startX, startY]];
    const cells = [];
    waterMask[startY][startX] = !isWater;

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      cells.push([cx, cy]);
      for (const [nx, ny] of neighbors(cx, cy, width, height)) {
        if (waterMask[ny][nx] === isWater) {
          waterMask[ny][nx] = !isWater;
          queue.push([nx, ny]);
        }
      }
    }

    return cells;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!waterMask[y][x]) {
        continue;
      }

      const lake = flood(x, y, true);
      const touchesBorder = lake.some(([lx, ly]) => lx === 0 || ly === 0 || lx === width - 1 || ly === height - 1);

      if (!touchesBorder && lake.length < 80) {
        for (const [lx, ly] of lake) {
          heightmap[ly][lx] = seaLevel + 2;
        }
      }
    }
  }

  // Rebuild mask for micro-island pass.
  const landMask = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => heightmap[y][x] >= seaLevel)
  );

  function floodLand(startX, startY) {
    const queue = [[startX, startY]];
    const cells = [];
    landMask[startY][startX] = false;

    while (queue.length > 0) {
      const [cx, cy] = queue.pop();
      cells.push([cx, cy]);
      for (const [nx, ny] of neighbors(cx, cy, width, height)) {
        if (landMask[ny][nx]) {
          landMask[ny][nx] = false;
          queue.push([nx, ny]);
        }
      }
    }

    return cells;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!landMask[y][x]) {
        continue;
      }

      const island = floodLand(x, y);
      const touchesBorder = island.some(([ix, iy]) => ix === 0 || iy === 0 || ix === width - 1 || iy === height - 1);
      if (!touchesBorder && island.length < 40) {
        for (const [ix, iy] of island) {
          heightmap[iy][ix] = seaLevel - 2;
        }
      }
    }
  }
}

function reduceSpikes(heightmap, width, height) {
  const copy = heightmap.map((row) => [...row]);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const h = copy[y][x];
      const adjacent = neighbors(x, y, width, height).map(([nx, ny]) => copy[ny][nx]);
      const avg = adjacent.reduce((a, b) => a + b, 0) / adjacent.length;

      if (h - avg > 20) {
        heightmap[y][x] = avg + 12;
      }
      if (avg - h > 18) {
        heightmap[y][x] = avg - 10;
      }
    }
  }
}

function carveRivers(heightmap, width, height, riverPercent, rng, seaLevel) {
  const maxHeight = Math.max(...heightmap.flat());
  const minSourceHeight = Math.max(seaLevel + 18, percentile(heightmap.flat(), 0.72));
  const riverSources = Math.floor((width * height * riverPercent) / 16000);

  for (let i = 0; i < riverSources; i += 1) {
    let x = Math.floor(rng() * width);
    let y = Math.floor(rng() * height);

    if (heightmap[y][x] < minSourceHeight) {
      continue;
    }

    let currentHeight = heightmap[y][x];

    for (let steps = 0; steps < 1200; steps += 1) {
      const t = steps / 1200;
      const riverDepth = lerp(3, 8, Math.min(1, currentHeight / maxHeight));
      const valleyDepth = lerp(2, 5, 1 - t);

      heightmap[y][x] = Math.max(seaLevel - 6, heightmap[y][x] - riverDepth);

      for (const [vx, vy] of neighbors(x, y, width, height)) {
        const distPenalty = Math.abs(vx - x) + Math.abs(vy - y);
        const carve = valleyDepth / (1 + distPenalty);
        heightmap[vy][vx] = Math.max(seaLevel - 6, heightmap[vy][vx] - carve);
      }

      const candidates = neighbors(x, y, width, height)
        .map(([nx, ny]) => ({ x: nx, y: ny, h: heightmap[ny][nx] + rng() * 0.2 }))
        .sort((a, b) => a.h - b.h);

      const next = candidates[0];
      if (!next) {
        break;
      }

      if (next.h > currentHeight + 0.2) {
        break;
      }

      x = next.x;
      y = next.y;
      currentHeight = next.h;

      if (currentHeight <= seaLevel + 1) {
        heightmap[y][x] = Math.min(heightmap[y][x], seaLevel);
        break;
      }
    }
  }
}

function minecraftYToGray(y, minY, maxY, outputBitDepth) {
  const normalized = clamp((y - minY) / (maxY - minY), 0, 1);
  const rawGray = Math.round(normalized * 255);
  if (outputBitDepth >= 8) {
    return rawGray;
  }

  const steps = (1 << outputBitDepth) - 1;
  return Math.round((Math.round((rawGray / 255) * steps) / steps) * 255);
}

function applyQuantization(heightmap, width, height, rng, useDither) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dither = useDither ? (rng() - 0.5) * 0.35 : 0;
      heightmap[y][x] = Math.round(heightmap[y][x] + dither);
    }
  }
}

function buildHeightField(width, height, config) {
  const { rng, seaLevel, requestedLand, oceanRatio } = config;
  const baseNoise = createValueNoise(rng, 7, 7);
  const detailNoise = createValueNoise(rng, 24, 24);
  const fineNoise = createValueNoise(rng, 60, 60);
  const mountainNoise = createValueNoise(rng, 13, 13);

  const heights = Array.from({ length: height }, () => Array(width).fill(0));
  const continentalValues = [];

  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.hypot(centerX, centerY);

  const adjustedLand = Math.min(0.95, Math.max(0.05, requestedLand * (1 - oceanRatio * 0.22)));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = Math.hypot(x - centerX, y - centerY) / maxDist;
      const islandMask = Math.max(0, 1 - Math.pow(d, 1.7));

      const n1 = baseNoise(x, y, width, height);
      const n2 = detailNoise(x, y, width, height);
      const n3 = fineNoise(x, y, width, height);
      const continent = n1 * 0.56 + n2 * 0.3 + n3 * 0.14;
      const continental = continent * 0.78 + islandMask * 0.22;

      continentalValues.push(continental);
      heights[y][x] = continental;
    }
  }

  // Recentrage du ratio de terres autour du seuil côtier.
  const coastThreshold = percentile(continentalValues, 1 - adjustedLand);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const continental = clamp(heights[y][x] - coastThreshold + 0.36, 0, 1);
      const mNoise = mountainNoise(x, y, width, height);
      const altitude = generateAltitudeFromBands(continental, mNoise, seaLevel);
      const reliefNoise = (detailNoise(x, y, width, height) - 0.5) * 6 + (fineNoise(x, y, width, height) - 0.5) * 2;
      heights[y][x] = clamp(altitude + reliefNoise, 0, 255);
    }
  }

  return heights;
}

function generateMap() {
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  const requestedLand = Number(landInput.value) / 100;
  const oceanRatio = Number(oceanInput.value) / 100;
  const riverPercent = Number(riverInput.value);
  const safeMode = safeModeInput.checked;

  let seaLevel = Number(seaLevelInput.value);
  let minY = Number(minYInput.value);
  let maxY = Number(maxYInput.value);
  const outputBitDepth = Number(bitDepthInput.value);
  const quantize = quantizeInput.checked;
  const dither = ditherInput.checked;

  if (safeMode) {
    seaLevel = 64;
    minY = 0;
    maxY = 255;
    seaLevelInput.value = seaLevel;
    minYInput.value = minY;
    maxYInput.value = maxY;
  }

  if (maxY <= minY) {
    maxY = minY + 1;
    maxYInput.value = maxY;
  }

  canvas.width = width;
  canvas.height = height;

  const seed = `${seedInput.value}-${width}-${height}-${seaLevel}`;
  const rng = mulberry32(hashString(seed));

  const heights = buildHeightField(width, height, { rng, seaLevel, requestedLand, oceanRatio });

  carveRivers(heights, width, height, riverPercent, rng, seaLevel);
  stabilizeCoastlines(heights, width, height, seaLevel, rng);
  cleanupMicroFeatures(heights, width, height, seaLevel);
  reduceSpikes(heights, width, height);

  if (quantize || safeMode) {
    applyQuantization(heights, width, height, rng, dither || safeMode);
  }

  const image = ctx.createImageData(width, height);
  let landCount = 0;
  let oceanCount = 0;
  let beachCount = 0;
  let riverLikeCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const blockY = heights[y][x];
      const shade = minecraftYToGray(blockY, minY, maxY, outputBitDepth);

      image.data[idx] = shade;
      image.data[idx + 1] = shade;
      image.data[idx + 2] = shade;
      image.data[idx + 3] = 255;

      if (blockY < seaLevel) {
        oceanCount += 1;
      } else {
        landCount += 1;
      }

      if (blockY >= seaLevel - 2 && blockY <= seaLevel + 4) {
        beachCount += 1;
      }

      if (blockY <= seaLevel + 1 && blockY >= seaLevel - 6) {
        const adj = neighbors(x, y, width, height).map(([nx, ny]) => heights[ny][nx]);
        const highAdj = adj.filter((h) => h > seaLevel + 8).length;
        if (highAdj >= 2) {
          riverLikeCount += 1;
        }
      }
    }
  }

  ctx.putImageData(image, 0, 0);

  const total = width * height;
  const seaGray = minecraftYToGray(seaLevel, minY, maxY, outputBitDepth);

  stats.textContent = [
    `Résolution: ${width}x${height} (1 px = 1 bloc)`,
    `Sea level Y=${seaLevel} => gris ${seaGray}/255`,
    `MinY=${minY} | MaxY=${maxY} | BitDepth=${outputBitDepth}`,
    `Terres: ${((landCount / total) * 100).toFixed(1)}%`,
    `Océan: ${((oceanCount / total) * 100).toFixed(1)}%`,
    `Plages côtières: ${((beachCount / total) * 100).toFixed(1)}%`,
    `Rivières/thalwegs: ${((riverLikeCount / total) * 100).toFixed(1)}%`,
    safeMode ? 'Mode: WorldPainter Safe Import' : 'Mode: Custom'
  ].join(' | ');
}

document.getElementById('generate').addEventListener('click', generateMap);

document.getElementById('download').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `heightmap-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

generateMap();
