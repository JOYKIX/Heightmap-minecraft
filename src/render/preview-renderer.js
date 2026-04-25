import { renderGrayscale } from './grayscale-renderer.js';
import { renderBiome } from './biome-renderer.js';
import { renderHillshade } from './hillshade-renderer.js';

export function renderPreview(ctx, terrain, settings, mode) {
  if (!terrain) return;
  if (mode === 'biome-map') return renderBiome(ctx, terrain, settings);
  if (mode === 'hillshade') return renderHillshade(ctx, terrain, settings);
  return renderGrayscale(ctx, terrain, settings);
}
