export function applyLightErosion(heightFloat, width, height, strength = 0.22) {
  const src = new Float32Array(heightFloat);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const h = src[i];
      let sum = 0;
      let count = 0;
      let maxDrop = 0;
      let maxRise = 0;

      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const ni = (y + oy) * width + (x + ox);
          const n = src[ni];
          sum += n;
          count++;
          const diff = h - n;
          if (diff > maxDrop) maxDrop = diff;
          if (-diff > maxRise) maxRise = -diff;
        }
      }

      const avg = sum / count;
      const slope = Math.max(maxDrop, maxRise);
      const cliffPreserve = slope > 11 ? 0.2 : 1;
      const thermal = slope > 2.2 ? (maxDrop - maxRise) * 0.03 : 0;
      const smooth = (avg - h) * strength * cliffPreserve;
      heightFloat[i] = h + smooth - thermal;
    }
  }
}
