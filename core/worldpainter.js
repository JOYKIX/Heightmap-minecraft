export const WORLDPAINTER_DEFAULTS = {
  minY: -64,
  maxY: 319,
  seaLevel: 64,
  imageLow: 0,
  imageHigh: 65535,
  lowMapping: -64,
  highMapping: 319
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function minecraftYToGray16(y, minY = WORLDPAINTER_DEFAULTS.minY, maxY = WORLDPAINTER_DEFAULTS.maxY) {
  const yClamped = clamp(Math.round(y), minY, maxY);
  return Math.round(((yClamped - minY) / (maxY - minY)) * 65535);
}

export function mapGray16ToMinecraft(gray16, {
  imageLow = WORLDPAINTER_DEFAULTS.imageLow,
  imageHigh = WORLDPAINTER_DEFAULTS.imageHigh,
  lowMapping = WORLDPAINTER_DEFAULTS.lowMapping,
  highMapping = WORLDPAINTER_DEFAULTS.highMapping
} = {}) {
  const srcRange = Math.max(1, imageHigh - imageLow);
  const t = clamp((gray16 - imageLow) / srcRange, 0, 1);
  return Math.round(lowMapping + t * (highMapping - lowMapping));
}

export function minecraftYToGray(y, minY = WORLDPAINTER_DEFAULTS.minY, maxY = WORLDPAINTER_DEFAULTS.maxY) {
  return Math.round((minecraftYToGray16(y, minY, maxY) / 65535) * 255);
}

export function grayToMinecraftY(gray, minY = WORLDPAINTER_DEFAULTS.minY, maxY = WORLDPAINTER_DEFAULTS.maxY) {
  const gray16 = Math.round((clamp(gray, 0, 255) / 255) * 65535);
  return mapGray16ToMinecraft(gray16, { imageLow: 0, imageHigh: 65535, lowMapping: minY, highMapping: maxY });
}

export function classifyMinecraftLayer(y) {
  if (y <= 20) return 'Océan profond';
  if (y <= 50) return 'Océan';
  if (y <= 63) return 'Hauts-fonds';
  if (y === 64) return 'Sea Level';
  if (y <= 70) return 'Plages';
  if (y <= 90) return 'Terres basses';
  if (y <= 120) return 'Collines';
  if (y <= 220) return 'Montagnes';
  return 'Pics';
}

export function worldPainterSettings(config = WORLDPAINTER_DEFAULTS) {
  return {
    lowestValue: 0,
    highestValue: 65535,
    waterLevel: config.seaLevel,
    buildLimitLower: config.minY,
    buildLimitUpper: config.maxY,
    lowMapping: config.minY,
    highMapping: config.maxY,
    seaGray16: minecraftYToGray16(config.seaLevel, config.minY, config.maxY)
  };
}
