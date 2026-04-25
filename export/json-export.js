export function exportTerrainJson(terrain, fileName = 'heightmap-data.json') {
  const payload = {
    config: terrain.config,
    stats: terrain.stats,
    heightY: Array.from(terrain.yInt),
    grayscale: Array.from(terrain.grayscale)
  };

  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
