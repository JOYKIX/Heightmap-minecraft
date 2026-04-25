import { createRng } from './random.js';

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function createValueNoise2D(seed = 'default', grid = 64) {
  const rng = createRng(seed);
  const values = new Float32Array(grid * grid);
  for (let i = 0; i < values.length; i++) values[i] = rng();

  const get = (x, y) => {
    const xi = ((x % grid) + grid) % grid;
    const yi = ((y % grid) + grid) % grid;
    return values[yi * grid + xi];
  };

  return (x, y, frequency = 1) => {
    const fx = x * frequency;
    const fy = y * frequency;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = smoothstep(fx - x0);
    const ty = smoothstep(fy - y0);
    const a = get(x0, y0);
    const b = get(x1, y0);
    const c = get(x0, y1);
    const d = get(x1, y1);
    const ab = a + (b - a) * tx;
    const cd = c + (d - c) * tx;
    return ab + (cd - ab) * ty;
  };
}

export function fbm2D(noiseFn, x, y, octaves = 4, lacunarity = 2, gain = 0.5, baseFrequency = 1) {
  let amp = 1;
  let freq = baseFrequency;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noiseFn(x, y, freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}
