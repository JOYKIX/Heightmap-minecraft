import { BIOME_COLORS } from './colors.js';

export function renderPreview(canvas, terrain, mode = 'grayscale') {
  const { config, grayscale, biomeMap, biomeIds, yInt, debugMaps } = terrain;
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
    } else if (mode === 'ridge') {
      [r, g, b] = scalarToMono(debugMaps?.ridgeMap?.[i] ?? 0);
    } else if (mode === 'moisture') {
      [r, g, b] = moistureColor(debugMaps?.moistureMap?.[i] ?? 0);
    } else if (mode === 'direction') {
      [r, g, b] = directionColor(debugMaps?.terrainDirection?.[i] ?? 0);
    } else if (mode === 'basin') {
      [r, g, b] = scalarToBlue(debugMaps?.basinMap?.[i] ?? 0);
    } else if (mode === 'slope') {
      [r, g, b] = slopeColor(debugMaps?.slopeMap?.[i] ?? 0);
    } else if (mode === 'river') {
      [r, g, b] = riverColor(debugMaps?.riverMap?.[i] ?? 0);
    } else if (mode === 'coast-distance') {
      const v = Math.min(1, (debugMaps?.coastDistanceMap?.[i] ?? 0) / 80);
      [r, g, b] = scalarToMono(v);
    } else if (mode === 'structure') {
      [r, g, b] = scalarToPurple(debugMaps?.worldStructureMap?.[i] ?? 0);
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

function scalarToMono(v) {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return [c, c, c];
}

function scalarToBlue(v) {
  const t = Math.max(0, Math.min(1, v));
  return [Math.round(40 + t * 55), Math.round(70 + t * 120), Math.round(120 + t * 135)];
}

function scalarToPurple(v) {
  const t = Math.max(0, Math.min(1, v));
  return [Math.round(70 + t * 170), Math.round(40 + t * 80), Math.round(80 + t * 170)];
}

function moistureColor(v) {
  const t = Math.max(0, Math.min(1, v));
  return [Math.round(160 - t * 140), Math.round(80 + t * 130), Math.round(40 + t * 180)];
}

function slopeColor(v) {
  const t = Math.max(0, Math.min(1, v));
  return [Math.round(30 + t * 225), Math.round(35 + (1 - t) * 120), Math.round(45 + (1 - t) * 80)];
}

function riverColor(v) {
  const t = Math.max(0, Math.min(1, v));
  const base = 20;
  const blue = Math.round(80 + t * 175);
  return [base, Math.round(base + t * 70), blue];
}

function directionColor(v) {
  const angle = ((v % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const r = Math.round(127 + Math.sin(angle) * 120);
  const g = Math.round(127 + Math.sin(angle + 2.09) * 120);
  const b = Math.round(127 + Math.sin(angle + 4.18) * 120);
  return [r, g, b];
}
