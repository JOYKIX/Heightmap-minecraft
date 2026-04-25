import { clamp } from '../utils/math.js';

export function renderHillshade(ctx, terrain, settings) {
  const { mapSize } = settings;
  const pixels = new Uint8ClampedArray(mapSize * mapSize * 4);
  const z = terrain.heightMap;

  for (let y = 1; y < mapSize - 1; y += 1) {
    for (let x = 1; x < mapSize - 1; x += 1) {
      const i = y * mapSize + x;
      const dzdx = (z[i + 1] - z[i - 1]) * 0.5;
      const dzdy = (z[i + mapSize] - z[i - mapSize]) * 0.5;
      const shade = clamp(180 - dzdx * 2.4 - dzdy * 1.8, 0, 255);
      const p = i * 4;
      pixels[p] = shade;
      pixels[p + 1] = shade;
      pixels[p + 2] = shade;
      pixels[p + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(pixels, mapSize, mapSize), 0, 0);
}
