export function renderStats(stats, el) {
  const biomeLines = Object.entries(stats.biomes)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<li>${k}: ${v.toFixed(1)}%</li>`)
    .join('');

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
      <li>Temps génération: ${stats.generationMs.toFixed(0)} ms</li>
      <li>Compatibilité WorldPainter: ${stats.worldPainterCompatible ? 'Oui' : 'Non'}</li>
    </ul>
    <h4>Biomes réels</h4>
    <ul>${biomeLines}</ul>
  `;
}

export function renderWorldPainterSettings(config, el) {
  el.innerHTML = `
    <h3>WorldPainter</h3>
    <ul>
      <li>Lowest Value = ${config.minY}</li>
      <li>Water Level = ${config.seaLevel}</li>
      <li>Highest Value = ${config.maxY}</li>
      <li>Build limits = -64 / 320</li>
    </ul>
  `;
}
