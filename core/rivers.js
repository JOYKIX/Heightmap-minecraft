import { createRng } from './random.js';

export function carveRivers(heightFloat, landMask, config, biomeMap, biomeIds) {
  const { width, height, seaLevel, seed } = config;
  const rng = createRng(`${seed}:rivers`);
  const starts = [];
  const riverFactor = { none: 0, few: 0.00004, some: 0.00009, many: 0.00018 }[config.riverAmount] ?? 0.00009;
  const targetSources = Math.max(2, Math.floor(width * height * riverFactor));

  for (let i = 0; i < heightFloat.length && starts.length < targetSources * 4; i += 31) {
    if (!landMask[i]) continue;
    if (heightFloat[i] < seaLevel + 35) continue;
    if (rng() < 0.08) starts.push(i);
  }

  let carved = 0;
  for (let s = 0; s < starts.length && carved < targetSources; s++) {
    let idx = starts[s];
    let guard = 0;
    while (guard++ < 1200) {
      if (!landMask[idx] || heightFloat[idx] <= seaLevel + 1) break;
      const x = idx % width;
      const y = (idx / width) | 0;

      const biomeId = biomeIds[biomeMap[idx]];
      const widthFactor = biomeId === 'jungle' || biomeId === 'swamp' ? 2 : 1;
      dig(heightFloat, width, height, x, y, widthFactor);

      let best = idx;
      let bestH = heightFloat[idx];
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const xx = x + ox;
          const yy = y + oy;
          if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
          const ni = yy * width + xx;
          const wobble = (rng() - 0.5) * 0.8;
          const nh = heightFloat[ni] + wobble;
          if (nh < bestH) {
            bestH = nh;
            best = ni;
          }
        }
      }
      if (best === idx) break;
      if (heightFloat[best] > heightFloat[idx]) break;
      idx = best;
    }
    carved++;
  }
}

function dig(heightFloat, width, height, x, y, widthFactor) {
  for (let oy = -widthFactor; oy <= widthFactor; oy++) {
    for (let ox = -widthFactor; ox <= widthFactor; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue;
      const dist = Math.hypot(ox, oy);
      const i = yy * width + xx;
      if (dist <= widthFactor + 0.1) heightFloat[i] -= (2.2 - dist * 0.8);
      if (dist <= widthFactor + 2) heightFloat[i] -= 0.3;
    }
  }
}
