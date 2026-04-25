export function computeDistanceFields(landMask, width, height) {
  const distanceToCoast = new Uint16Array(width * height);
  const distanceToLand = new Uint16Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const isLand = landMask[i] === 1;
      let best = 9999;
      for (let oy = -28; oy <= 28; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -28; ox <= 28; ox++) {
          const xx = x + ox;
          if (xx < 0 || xx >= width) continue;
          const j = yy * width + xx;
          const otherLand = landMask[j] === 1;
          if (isLand !== otherLand) {
            const d = Math.abs(ox) + Math.abs(oy);
            if (d < best) best = d;
          }
        }
      }
      if (best === 9999) best = 28;
      if (isLand) distanceToCoast[i] = best;
      else distanceToLand[i] = best;
    }
  }

  return { distanceToCoast, distanceToLand };
}

export function shapeOceanAndCoast(heightFloat, landMask, distanceToLand, seaLevel) {
  for (let i = 0; i < heightFloat.length; i++) {
    if (landMask[i]) continue;
    const d = distanceToLand[i];

    if (d <= 2) {
      // bord d'eau / transition
      heightFloat[i] = clamp(heightFloat[i], seaLevel - 2, seaLevel - 1);
    } else if (d <= 6) {
      // plateau côtier Y58-63
      const t = (d - 2) / 4;
      heightFloat[i] = lerp(seaLevel - 1, 58, t);
    } else if (d <= 14) {
      // océan moyen Y35-50
      const t = (d - 6) / 8;
      heightFloat[i] = lerp(58, 45, t);
    } else {
      // océan profond Y20-35 + fosses légères
      const t = Math.min(1, (d - 14) / 20);
      heightFloat[i] = lerp(45, 24, t);
      const trench = ((i * 2654435761) >>> 0) % 97 === 0 ? 4 : 0;
      heightFloat[i] -= trench;
    }

    if (heightFloat[i] >= seaLevel) heightFloat[i] = seaLevel - 1;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
