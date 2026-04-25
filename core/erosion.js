export function applyLightErosion(heightFloat, width, height, strength = 0.22) {
  const src = new Float32Array(heightFloat);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const avg = (
        src[i] + src[i - 1] + src[i + 1] + src[i - width] + src[i + width] +
        src[i - width - 1] + src[i - width + 1] + src[i + width - 1] + src[i + width + 1]
      ) / 9;
      heightFloat[i] = src[i] * (1 - strength) + avg * strength;
    }
  }
}
