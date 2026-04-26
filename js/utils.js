export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const idx = (x, y, w) => y * w + x;

export async function fileToImageData(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, imageData };
}

export function detectImageType(imageData) {
  const data = imageData.data;
  let grayLike = 0;
  let alpha = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (Math.abs(r - g) < 4 && Math.abs(g - b) < 4) grayLike++;
    if (a < 250) alpha++;
  }
  const ratio = grayLike / (data.length / 4);
  return {
    mode: ratio > 0.9 ? 'heightmap-grayscale' : 'color-map',
    hasAlpha: alpha > 0,
    grayRatio: ratio
  };
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
