export function minecraftYToGray(y, minY, maxY) {
  return Math.round(((y - minY) / (maxY - minY)) * 255);
}

export function grayToMinecraftY(gray, minY, maxY) {
  return Math.round((gray / 255) * (maxY - minY) + minY);
}

export function heightToGrayscale(yInt, minY, maxY) {
  const out = new Uint8ClampedArray(yInt.length);
  for (let i = 0; i < yInt.length; i++) out[i] = minecraftYToGray(yInt[i], minY, maxY);
  return out;
}

export function worldPainterSettings(config) {
  return {
    lowestValue: config.minY,
    waterLevel: config.seaLevel,
    highestValue: config.maxY,
    buildLimits: '-64 / 320'
  };
}
