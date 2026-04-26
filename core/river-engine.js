import { clamp } from '../js/utils.js';

export function carveRivers(heightMap, landMask, width, height, seaLevel) {
  const out = new Float32Array(heightMap);
  const rivers = [];
  for (let s = 0; s < 24; s++) {
    let x = Math.floor(Math.random() * width);
    let y = Math.floor(Math.random() * height);
    let i = y * width + x;
    if (!landMask[i] || out[i] < seaLevel + 60) continue;
    const path = [];
    for (let step = 0; step < 600; step++) {
      i = y * width + x;
      if (!landMask[i] || out[i] <= seaLevel + 1) break;
      path.push(i);
      let best = i;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = clamp(x + ox, 0, width - 1);
          const ny = clamp(y + oy, 0, height - 1);
          const ni = ny * width + nx;
          if (out[ni] < out[best]) best = ni;
        }
      }
      if (best === i) break;
      x = best % width;
      y = (best / width) | 0;
    }
    if (path.length > 24) {
      for (const p of path) out[p] -= 4;
      rivers.push(path.length);
    }
  }
  return { heightMap: out, riverCount: rivers.length };
}
