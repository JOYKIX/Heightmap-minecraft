export function createGrid(length, fill = 0) {
  const out = new Float32Array(length);
  if (fill !== 0) out.fill(fill);
  return out;
}

export function normalize(values, min = 0, max = 1) {
  let currentMin = Infinity;
  let currentMax = -Infinity;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] < currentMin) currentMin = values[i];
    if (values[i] > currentMax) currentMax = values[i];
  }
  const range = Math.max(0.00001, currentMax - currentMin);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = ((values[i] - currentMin) / range) * (max - min) + min;
  }
  return values;
}
