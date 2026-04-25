export function cleanupHeights(heightFloat, config, landMask) {
  const { minY, maxY, seaLevel, width, height } = config;

  for (let i = 0; i < heightFloat.length; i++) {
    let h = heightFloat[i];
    if (!Number.isFinite(h)) h = seaLevel;
    if (!landMask[i] && h > seaLevel - 1) h = seaLevel - 1;
    if (h < minY) h = minY;
    if (h > maxY) h = maxY;
    heightFloat[i] = h;
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const c = heightFloat[i];
      let localMin = Infinity;
      let localMax = -Infinity;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const n = heightFloat[(y + oy) * width + (x + ox)];
          if (n < localMin) localMin = n;
          if (n > localMax) localMax = n;
        }
      }
      if (c > localMax + 12) heightFloat[i] = localMax + 4;
      if (c < localMin - 12) heightFloat[i] = localMin - 4;
    }
  }
}

export function fillInlandSinks(heightFloat, config, landMask, passes = 2) {
  const { width, height, seaLevel } = config;

  for (let pass = 0; pass < passes; pass++) {
    const src = new Float32Array(heightFloat);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!landMask[i]) continue;
        if (src[i] <= seaLevel + 1) continue;

        let lowerNeighbors = 0;
        let minNeighbor = Infinity;
        let avgNeighbor = 0;
        let count = 0;

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const ni = (y + oy) * width + (x + ox);
            if (!landMask[ni]) continue;
            const n = src[ni];
            avgNeighbor += n;
            count++;
            if (n < minNeighbor) minNeighbor = n;
            if (n < src[i] - 0.5) lowerNeighbors++;
          }
        }

        if (count < 3) continue;
        avgNeighbor /= count;
        const enclosed = lowerNeighbors === 0;
        const pitDepth = avgNeighbor - src[i];
        if (enclosed && pitDepth > 2.2) {
          const raiseTo = minNeighbor + Math.min(1.8, pitDepth * 0.55);
          heightFloat[i] = Math.max(src[i], raiseTo);
        }
      }
    }
  }
}

export function quantizeToMinecraftY(heightFloat, minY, maxY) {
  const yInt = new Uint16Array(heightFloat.length);
  for (let i = 0; i < heightFloat.length; i++) {
    const q = Math.round(heightFloat[i]);
    yInt[i] = Math.max(minY, Math.min(maxY, q));
  }
  return yInt;
}

export function validateHeightmap(yInt, config, landMask) {
  let min = 9999;
  let max = -9999;
  let nanCount = 0;
  for (let i = 0; i < yInt.length; i++) {
    const v = yInt[i];
    if (!Number.isFinite(v)) nanCount++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const edgeTouch = hasLandOnEdges(landMask, config.width, config.height);
  return { min, max, nanCount, edgeTouch, worldPainterCompatible: nanCount === 0 && !edgeTouch };
}

function hasLandOnEdges(mask, width, height) {
  for (let x = 0; x < width; x++) if (mask[x] || mask[(height - 1) * width + x]) return true;
  for (let y = 0; y < height; y++) if (mask[y * width] || mask[y * width + width - 1]) return true;
  return false;
}
