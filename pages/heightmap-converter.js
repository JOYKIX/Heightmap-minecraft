import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';
import { fileToImageData, detectImageType, clamp } from '../js/utils.js';
import { drawGray16ToCanvas } from '../ui/preview.js';
import { quantizeToMinecraftY, toGray16Array } from '../core/heightmap-export.js';
import { exportPseudo16Png } from '../export/png16-export.js';

export function renderConverter(appState) {
  const r = appState.converter.result;
  return pageScaffold({
    title: 'Convertisseur Heightmap WorldPainter',
    description: 'Conversion d’image importée en altitudes Minecraft quantifiées puis export gris 16-bit.',
    controls: `
      <label>Image source <input id="convFile" type="file" accept="image/*" /></label>
      <p class="muted">Éditeur de couches: ${appState.converter.layers.length} couches actives.</p>
      <button id="btnConvert">Convertir en Y Minecraft</button>
      <button id="btnExportConv">Exporter PNG</button>
    `,
    preview: '<h2>Preview conversion</h2><canvas id="convCanvas" width="1024" height="1024"></canvas>',
    side: `<h3>Validation</h3>${statList([
      ['Classes détectées', r?.classes ?? '-'], ['min/max Y', r ? `${r.minY}/${r.maxY}` : '-'],
      ['Sea level', appState.settings.seaLevel], ['Format export', 'PNG pseudo16'], ['Compatibilité', 'WorldPainter (workflow recommandé: importer en RAW 16 si possible)']
    ])}`
  });
}

export function bindConverter(root, appState, notify) {
  const canvas = root.querySelector('#convCanvas');
  if (appState.converter.result) drawGray16ToCanvas(canvas, appState.converter.result.gray16, appState.converter.result.width, appState.converter.result.height);

  root.querySelector('#btnConvert')?.addEventListener('click', async () => {
    const file = root.querySelector('#convFile').files?.[0];
    if (!file) return notify('Importez une image.');
    const source = await fileToImageData(file);
    appState.converter.source = source;
    const mode = detectImageType(source.imageData).mode;
    const px = source.width * source.height;
    const y = new Float32Array(px);
    const d = source.imageData.data;
    for (let i = 0; i < px; i++) {
      const o = i * 4;
      const lum = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
      y[i] = mode === 'heightmap-grayscale'
        ? appState.settings.minY + lum * (appState.settings.maxY - appState.settings.minY)
        : clamp(appState.settings.seaLevel - 20 + lum * 220, appState.settings.minY, appState.settings.maxY);
    }
    const yQ = quantizeToMinecraftY(y, appState.settings.minY, appState.settings.maxY);
    const gray16 = toGray16Array(yQ, appState.settings.minY, appState.settings.maxY);
    let minY = Infinity, maxY = -Infinity;
    for (const v of yQ) { if (v < minY) minY = v; if (v > maxY) maxY = v; }
    appState.converter.result = { width: source.width, height: source.height, y: yQ, gray16, minY, maxY, classes: mode };
    drawGray16ToCanvas(canvas, gray16, source.width, source.height);
    notify('Conversion terminée.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelector('#btnExportConv')?.addEventListener('click', () => {
    if (!appState.converter.result) return notify('Convertissez une image d’abord.');
    exportPseudo16Png(appState.converter.result.gray16, appState.converter.result.width, appState.converter.result.height, 'converted-heightmap.png');
  });
}
