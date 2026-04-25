import { clamp, lerp } from './math.js';

export function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = clamp((value - inMin) / Math.max(0.00001, inMax - inMin), 0, 1);
  return lerp(outMin, outMax, t);
}
