import { BIOME_PROFILES } from '../config/biome-profiles.js';

export function updateStatsPanel(state) {
  const { terrain, settings } = state;
  if (!terrain) return;

  const stats = document.getElementById('stats');
  const biomeResults = document.getElementById('biome-results');
  const wp = document.getElementById('wp-compatibility');
  const summary = document.getElementById('config-summary');

  const min = Math.min(...terrain.heightMap);
  const max = Math.max(...terrain.heightMap);
  const avg = terrain.heightMap.reduce((acc, value) => acc + value, 0) / terrain.heightMap.length;
  stats.innerHTML = `<li>Min Y: ${min.toFixed(0)}</li><li>Max Y: ${max.toFixed(0)}</li><li>Moyenne: ${avg.toFixed(1)}</li>`;

  biomeResults.innerHTML = BIOME_PROFILES.map((biome, i) => `<li>${biome.name}: ${((terrain.biomeCounts[i] / terrain.biomeMap.length) * 100).toFixed(1)}%</li>`).join('');

  wp.innerHTML = `<li>Surface entre Y${settings.minY} et Y${settings.maxY}</li><li>Sea level: Y${settings.height.seaLevel}</li>`;
  summary.innerHTML = `<li>Seed: ${settings.seed}</li><li>Taille: ${settings.mapSize}x${settings.mapSize}</li><li>Qualité: ${settings.quality}</li>`;
}
