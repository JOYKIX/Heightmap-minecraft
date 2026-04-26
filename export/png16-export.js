import { downloadBlob } from '../js/utils.js';

export function exportPseudo16Png(gray16, width, height, filename = 'heightmap-pseudo16.png') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(width, height);
  for (let i = 0; i < gray16.length; i++) {
    const v16 = gray16[i];
    const hi = (v16 >> 8) & 255;
    const lo = v16 & 255;
    const o = i * 4;
    img.data[o] = hi;
    img.data[o + 1] = lo;
    img.data[o + 2] = hi;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  canvas.toBlob((blob) => blob && downloadBlob(blob, filename), 'image/png');
}
