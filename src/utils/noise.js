import { lerp } from './math.js';

const fract = (v) => v - Math.floor(v);

function hash2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 13.1) * 43758.5453;
  return fract(n);
}

export function valueNoise2D(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;

  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);

  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

export function fbm2D(x, y, seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise2D(x * frequency, y * frequency, seed + i * 13) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return total / Math.max(0.0001, norm);
}
