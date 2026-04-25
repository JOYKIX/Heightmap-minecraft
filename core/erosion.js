export function applyAdvancedErosion(heightFloat, width, height, landMask, iterations = 2, strength = 0.22) {
  const total = width * height;
  const water = new Float32Array(total);

  for (let iter = 0; iter < iterations; iter++) {
    const src = new Float32Array(heightFloat);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (!landMask[i]) continue;

        const h = src[i];
        let sum = 0;
        let count = 0;
        let maxDrop = 0;
        let minNeighbor = h;

        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const ni = (y + oy) * width + (x + ox);
            if (!landMask[ni]) continue;
            const n = src[ni];
            sum += n;
            count++;
            const diff = h - n;
            if (diff > maxDrop) maxDrop = diff;
            if (n < minNeighbor) minNeighbor = n;
          }
        }

        if (count === 0) continue;

        const avg = sum / count;
        const slope = maxDrop;
        const cliff = slope > 10 ? 1 : 0;

        // Thermal erosion (talus)
        const talus = 2.2;
        let thermal = 0;
        if (slope > talus) {
          thermal = (slope - talus) * 0.08;
        }

        // Simplified hydraulic erosion/deposition
        const rain = 0.035 + Math.max(0, 1 - slope * 0.06) * 0.04;
        water[i] = water[i] * 0.75 + rain;
        const carryingCapacity = water[i] * (0.55 + slope * 0.12);
        const erode = Math.min(carryingCapacity * 0.08, Math.max(0, h - minNeighbor) * 0.25);
        const deposit = slope < 1.6 ? water[i] * 0.025 : 0;

        // Cliff preservation: do not over-smooth steep terrain
        const smoothFactor = cliff ? 0.14 : 1;
        const smooth = (avg - h) * strength * smoothFactor;

        heightFloat[i] = h + smooth - thermal - erode + deposit;
      }
    }
  }
}
