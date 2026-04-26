export function renderStats(stats, el) {
  const biomeLines = Object.entries(stats.biomes)
    .sort((a, b) => b[1].real - a[1].real)
    .map(([k, v]) => `<li>${k}: cible ${formatTarget(v.target)} / réel ${v.real.toFixed(1)}%</li>`)
    .join('');

  const validationLine = stats.error ? `<li style="color:#f88;">Erreur validation: ${stats.error}</li>` : '';
  const warnings = (stats.biomeWarnings || []).map((w) => `<li style="color:#ffb56b;">⚠ ${w}</li>`).join('');

  el.innerHTML = `
    <h3>Validation finale</h3>
    <ul>
      <li>Terre cible: ${stats.targetLand.toFixed(1)}%</li>
      <li>Terre réelle: ${stats.realLand.toFixed(1)}%</li>
      <li>Océan réel: ${stats.realOcean.toFixed(1)}%</li>
      <li>Terre touche bord: ${stats.edgeTouch ? 'Oui' : 'Non'}</li>
      <li>Altitude min/max: ${stats.minAltitude} / ${stats.maxAltitude}</li>
      <li>Sea level: ${stats.seaLevel}</li>
      <li>Gray sea level: ${stats.graySeaLevel}</li>
      <li>Nombre de biomes: ${stats.biomeCount}</li>
      <li>Nombre de rivières: ${stats.riverCount}</li>
      <li>Temps génération: ${stats.generationMs.toFixed(0)} ms</li>
      <li>Compatibilité WorldPainter: ${stats.worldPainterCompatible ? 'Oui' : 'Non'}</li>
      ${validationLine}
      ${warnings}
    </ul>
    <h4>Biomes cibles vs réels</h4>
    <ul>${biomeLines}</ul>
  `;
}

function formatTarget(v) {
  if (v == null) return 'n/a';
  return `${v.toFixed(1)}%`;
}

export function renderWorldPainterSettings(config, el) {
  const graySeaLevel = Math.round(((config.seaLevel - config.minY) / (config.maxY - config.minY)) * 65535);
  el.innerHTML = `
    <h3>WorldPainter</h3>
    <ul>
      <li>From Image Lowest Value = 0</li>
      <li>From Image Highest Value = 65535</li>
      <li>Water Level = ${config.seaLevel}</li>
      <li>Build limits = -64 / 319</li>
      <li>Gray16 sea level = ${graySeaLevel}</li>
    </ul>
  `;
}
