export function computeDistanceFields(landMask, width, height) {
  const distanceToCoast = new Uint16Array(width * height);
  const distanceToLand = new Uint16Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const isLand = landMask[i] === 1;
      let best = 9999;
      for (let oy = -24; oy <= 24; oy++) {
        const yy = y + oy;
        if (yy < 0 || yy >= height) continue;
        for (let ox = -24; ox <= 24; ox++) {
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
      if (best === 9999) best = 24;
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
    if (d <= 4) heightFloat[i] = seaLevel - 2 - Math.min(5, d);
    else if (d <= 14) heightFloat[i] = seaLevel - 8 - d * 1.2;
    else heightFloat[i] = Math.max(20, seaLevel - 24 - d * 0.75);
  }
}
