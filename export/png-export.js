export async function exportHeightmapPng(terrain, fileName = 'heightmap-worldpainter.png') {
  const { config, grayscale } = terrain;
  const canvas = document.createElement('canvas');
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(config.width, config.height);

  for (let i = 0; i < grayscale.length; i++) {
    const g = grayscale[i];
    const o = i * 4;
    image.data[o] = g;
    image.data[o + 1] = g;
    image.data[o + 2] = g;
    image.data[o + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
