export function computeDistanceFields(landMask, width, height) {
  const total = width * height;
  const distanceToCoast = new Uint16Array(total);
  const distanceToLand = new Uint16Array(total);

  const INF = 65535;
  for (let i = 0; i < total; i++) {
    distanceToCoast[i] = INF;
    distanceToLand[i] = INF;
  }

  const q = new Int32Array(total);

  // Seed land distances from coastline ocean cells
  let head = 0;
  let tail = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const isLand = landMask[i] === 1;
      let borderOther = false;
      for (let oy = -1; oy <= 1 && !borderOther; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const ni = (y + oy) * width + (x + ox);
          if ((landMask[ni] === 1) !== isLand) {
            borderOther = true;
            break;
          }
        }
      }

      if (!borderOther) continue;
      if (isLand) {
        distanceToCoast[i] = 0;
      } else {
        distanceToLand[i] = 0;
      }
      q[tail++] = i;
    }
  }

  // Multi-source BFS for each medium
  propagateDistance(q, head, tail, distanceToCoast, landMask, width, height, 1);
  propagateDistance(q, head, tail, distanceToLand, landMask, width, height, 0);

  // Cap values for stability
  for (let i = 0; i < total; i++) {
    if (distanceToCoast[i] === INF) distanceToCoast[i] = 0;
    if (distanceToLand[i] === INF) distanceToLand[i] = 0;
  }

  return { distanceToCoast, distanceToLand };
}

function propagateDistance(queue, head0, tail0, outDistance, landMask, width, height, medium) {
  const INF = 65535;
  let head = 0;
  let tail = 0;

  for (let i = head0; i < tail0; i++) {
    const idx = queue[i];
    if ((landMask[idx] === 1 ? 1 : 0) === medium && outDistance[idx] === 0) {
      queue[tail++] = idx;
    }
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx / width) | 0;
    const current = outDistance[idx];

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const xx = x + ox;
        const yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const ni = yy * width + xx;
        if ((landMask[ni] === 1 ? 1 : 0) !== medium) continue;
        const step = ox && oy ? 2 : 1;
        const nd = current + step;
        if (nd >= outDistance[ni] || outDistance[ni] !== INF && nd >= outDistance[ni]) continue;
        outDistance[ni] = nd;
        queue[tail++] = ni;
      }
    }
  }
}

export function shapeOceanAndCoast(heightFloat, landMask, distanceToLand, seaLevel) {
  for (let i = 0; i < heightFloat.length; i++) {
    if (landMask[i]) continue;
    const d = distanceToLand[i];

    if (d <= 3) {
      // plage/lagon
      const t = d / 3;
      heightFloat[i] = lerp(seaLevel - 1, seaLevel - 4, t);
    } else if (d <= 11) {
      // plateau continental
      const t = (d - 3) / 8;
      heightFloat[i] = lerp(seaLevel - 4, seaLevel - 16, t);
    } else if (d <= 28) {
      // pente océanique
      const t = (d - 11) / 17;
      heightFloat[i] = lerp(seaLevel - 16, seaLevel - 45, t);
    } else {
      // grands fonds + fosse ponctuelle
      const t = Math.min(1, (d - 28) / 52);
      heightFloat[i] = lerp(seaLevel - 45, seaLevel - 68, t);
      const trench = ((i * 1103515245 + 12345) >>> 0) % 101 === 0 ? 6 : 0;
      heightFloat[i] -= trench;
    }

    if (heightFloat[i] >= seaLevel) heightFloat[i] = seaLevel - 1;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
