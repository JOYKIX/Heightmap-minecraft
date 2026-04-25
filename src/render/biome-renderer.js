import { BIOME_PROFILES } from '../config/biome-profiles.js';
import { hexToRgb } from '../utils/colors.js';

const palette = BIOME_PROFILES.map((biome) => hexToRgb(biome.color));

export function renderBiome(ctx, terrain, settings) {
  const pixels = new Uint8ClampedArray(settings.mapSize * settings.mapSize * 4);
  for (let i = 0; i < terrain.biomeMap.length; i += 1) {
    const [r, g, b] = palette[terrain.biomeMap[i]];
    const p = i * 4;
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    pixels[p + 3] = 255;
  }
  ctx.putImageData(new ImageData(pixels, settings.mapSize, settings.mapSize), 0, 0);
}
