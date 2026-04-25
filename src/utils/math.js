export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const saturate = (value) => clamp(value, 0, 1);

export function idx(x, y, width) {
  return y * width + x;
}
