import { BIOME_COLORS } from './colors.js';

export function renderPreview(canvas, terrain, mode = 'grayscale') {
  const { config, grayscale, biomeMap, biomeIds, yInt } = terrain;
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(config.width, config.height);
  const out = image.data;

  for (let i = 0; i < grayscale.length; i++) {
    const o = i * 4;
    let r; let g; let b;

    if (mode === 'biome') {
      [r, g, b] = BIOME_COLORS[biomeIds[biomeMap[i]]] ?? [255, 0, 255];
    } else if (mode === 'heatmap') {
      const t = yInt[i] / 255;
      r = Math.min(255, 255 * t * 1.2);
      g = Math.min(255, 255 * (1 - Math.abs(t - 0.5) * 2));
      b = Math.min(255, 255 * (1 - t));
    } else if (mode === 'hillshade') {
      const h = grayscale[i];
      r = h * 0.9;
      g = h * 0.95;
      b = h;
    } else {
      r = g = b = grayscale[i];
    }

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
}
