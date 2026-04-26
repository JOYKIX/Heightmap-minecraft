import { clamp, detectImageType } from '../js/utils.js';

export function analyzeImportedImage(image) {
  return {
    width: image.width,
    height: image.height,
    ...detectImageType(image.imageData)
  };
}

export function extendOceanCanvas(image, paddingPct, seaLevel = 64, mode = 'heightmap-grayscale') {
  const padX = Math.round(image.width * (paddingPct / 100));
  const padY = Math.round(image.height * (paddingPct / 100));
  const outW = image.width + 2 * padX;
  const outH = image.height + 2 * padY;
  const out = new Uint8ClampedArray(outW * outH * 4);
  const src = image.imageData.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const o = (y * outW + x) * 4;
      const sx = clamp(x - padX, 0, image.width - 1);
      const sy = clamp(y - padY, 0, image.height - 1);
      const si = (sy * image.width + sx) * 4;
      const isInside = x >= padX && x < padX + image.width && y >= padY && y < padY + image.height;
      if (isInside) {
        out[o] = src[si]; out[o + 1] = src[si + 1]; out[o + 2] = src[si + 2]; out[o + 3] = 255;
      } else {
        const nx = Math.min(x, outW - 1 - x) / Math.max(1, padX);
        const ny = Math.min(y, outH - 1 - y) / Math.max(1, padY);
        const edge = Math.min(nx, ny);
        const depth = 1 - clamp(edge, 0, 1);
        if (mode === 'heightmap-grayscale') {
          const yVal = seaLevel - 12 - depth * 80;
          const gray = clamp(Math.round(((yVal + 64) / 384) * 255), 0, 255);
          out[o] = out[o + 1] = out[o + 2] = gray;
        } else {
          const deep = [8, 40, 92], shallow = [45, 102, 168];
          out[o] = Math.round(shallow[0] * (1 - depth) + deep[0] * depth);
          out[o + 1] = Math.round(shallow[1] * (1 - depth) + deep[1] * depth);
          out[o + 2] = Math.round(shallow[2] * (1 - depth) + deep[2] * depth);
        }
        out[o + 3] = 255;
      }
    }
  }

  return { width: outW, height: outH, data: out, padX, padY };
}
