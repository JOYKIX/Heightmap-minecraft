const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const landInput = document.getElementById('land');
const oceanInput = document.getElementById('ocean');
const riverInput = document.getElementById('river');
const seedInput = document.getElementById('seed');
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

function findThreshold(values, targetLandRatio) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((1 - targetLandRatio) * sorted.length)));
  return sorted[index];
}

function neighbors(x, y, width, height) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1]
  ].filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height);
}

function carveRivers(heightmap, width, height, riverPercent, rng, seaLevel) {
  const riverSources = Math.floor((width * height * riverPercent) / 14000);
  for (let i = 0; i < riverSources; i += 1) {
    let x = Math.floor(rng() * width);
    let y = Math.floor(rng() * height);

    if (heightmap[y][x] < seaLevel + 0.15) {
      continue;
    }

    for (let steps = 0; steps < 700; steps += 1) {
      heightmap[y][x] = Math.max(seaLevel - 0.02, heightmap[y][x] - 0.17);
      if (heightmap[y][x] <= seaLevel) {
        break;
      }

      const next = neighbors(x, y, width, height)
        .map(([nx, ny]) => ({ x: nx, y: ny, h: heightmap[ny][nx] + rng() * 0.015 }))
        .sort((a, b) => a.h - b.h)[0];

      if (!next || (next.x === x && next.y === y)) {
        break;
      }

      x = next.x;
      y = next.y;
    }
  }
}

function generateMap() {
  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  const requestedLand = Number(landInput.value) / 100;
  const oceanRatio = Number(oceanInput.value) / 100;
  const riverPercent = Number(riverInput.value);
  const seed = `${seedInput.value}-${width}-${height}`;

  const adjustedLand = Math.min(0.95, Math.max(0.05, requestedLand * (1 - oceanRatio * 0.25)));

  canvas.width = width;
  canvas.height = height;

  const rng = mulberry32(hashString(seed));
  const baseNoise = createValueNoise(rng, 7, 7);
  const detailNoise = createValueNoise(rng, 24, 24);
  const fineNoise = createValueNoise(rng, 60, 60);

  const heights = Array.from({ length: height }, () => Array(width).fill(0));
  const rawValues = [];

  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.hypot(centerX, centerY);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const d = Math.hypot(dx, dy) / maxDist;
      const islandMask = Math.max(0, 1 - Math.pow(d, 1.7));

      const n1 = baseNoise(x, y, width, height);
      const n2 = detailNoise(x, y, width, height);
      const n3 = fineNoise(x, y, width, height);

      const value = n1 * 0.56 + n2 * 0.31 + n3 * 0.13;
      const continental = value * 0.8 + islandMask * 0.2;

      heights[y][x] = continental;
      rawValues.push(continental);
    }
  }

  const seaLevel = findThreshold(rawValues, adjustedLand);
  carveRivers(heights, width, height, riverPercent, rng, seaLevel);

  const image = ctx.createImageData(width, height);
  let landCount = 0;
  let oceanCount = 0;
  let riverCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const h = heights[y][x];
      const normalized = Math.max(0, Math.min(1, (h - seaLevel + 0.4) / 0.8));
      const shade = Math.floor(normalized * 255);

      image.data[idx] = shade;
      image.data[idx + 1] = shade;
      image.data[idx + 2] = shade;
      image.data[idx + 3] = 255;

      if (h <= seaLevel) {
        oceanCount += 1;
      } else if (h <= seaLevel + 0.02) {
        riverCount += 1;
      } else {
        landCount += 1;
      }
    }
  }

  ctx.putImageData(image, 0, 0);

  const total = width * height;
  stats.textContent = [
    `Résolution: ${width}x${height} (1 px = 1 bloc)`,
    `Terres: ${((landCount / total) * 100).toFixed(1)}%`,
    `Océan: ${((oceanCount / total) * 100).toFixed(1)}%`,
    `Rivières basses: ${((riverCount / total) * 100).toFixed(1)}%`
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
