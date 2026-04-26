export function quantizeToMinecraftY(height, minY = -64, maxY = 320) {
  const out = new Int16Array(height.length);
  for (let i = 0; i < height.length; i++) out[i] = Math.round(Math.max(minY, Math.min(maxY, height[i])));
  return out;
}

export function yToGray16(yValue, minY = -64, maxY = 320) {
  return Math.round(((yValue - minY) / (maxY - minY)) * 65535);
}

export function toGray16Array(yValues, minY = -64, maxY = 320) {
  const out = new Uint16Array(yValues.length);
  for (let i = 0; i < yValues.length; i++) out[i] = yToGray16(yValues[i], minY, maxY);
  return out;
}
