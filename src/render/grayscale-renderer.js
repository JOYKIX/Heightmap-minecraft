import { toGrayscale8 } from '../core/export-engine.js';

export function renderGrayscale(ctx, terrain, settings) {
  const pixels = toGrayscale8(terrain.heightMap, settings.minY, settings.maxY);
  ctx.putImageData(new ImageData(pixels, settings.mapSize, settings.mapSize), 0, 0);
}
