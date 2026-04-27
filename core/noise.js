import { lerp } from '../js/utils.js';

function hash2(x, y, s = 1337) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 362437);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export function valueNoise2D(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export function fbm2D(x, y, octaves = 5, lacunarity = 2, gain = 0.5, seed = 0) {
  let amp = 1, freq = 1, sum = 0, ampSum = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 17);
    ampSum += amp;
    freq *= lacunarity;
    amp *= gain;
  }
  return ampSum > 0 ? sum / ampSum : 0;
}
