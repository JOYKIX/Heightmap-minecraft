import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';
import { fileToImageData, detectImageType, clamp } from '../js/utils.js';
import { drawGray16ToCanvas } from '../ui/preview.js';
import { quantizeToMinecraftY, toGray16Array } from '../core/heightmap-export.js';
import { exportPseudo16Png } from '../export/png16-export.js';
import { classifyMinecraftLayer, mapGray16ToMinecraft, minecraftYToGray16 } from '../core/worldpainter.js';

export function renderConverter(appState) {
  const r = appState.converter.result;
  return pageScaffold({
    title: 'Convertisseur Heightmap WorldPainter',
    description: 'Mapping strict WorldPainter: altitude Minecraft réelle puis conversion grayscale 16-bit.',
    controls: `
      <label>Image source <input id="convFile" type="file" accept="image/*" /></label>
      <p class="muted">Éditeur de couches: ${appState.converter.layers.length} couches actives.</p>
      <button id="btnConvert">Convertir en Y Minecraft</button>
      <button id="btnExportConv">Exporter PNG 16-bit</button>
      <h3>Réglages import WorldPainter</h3>
      <ul>
        <li>From Image: Lowest Value = 0</li>
        <li>From Image: Highest Value = 65535</li>
        <li>To Minecraft: Build Limit Lower = -64</li>
        <li>To Minecraft: Build Limit Upper = 319</li>
        <li>To Minecraft: Water Level = 64</li>
        <li>Sea Level Gray16 = ${minecraftYToGray16(64, appState.settings.minY, appState.settings.maxY)}</li>
      </ul>
    `,
    preview: '<h2>Preview conversion</h2><canvas id="convCanvas" width="1024" height="1024"></canvas><p id="convHover" class="muted">Survolez l\'image pour voir altitude Y, gray16 et couche Minecraft.</p>',
    side: `<h3>Validation</h3>${statList([
      ['Classes détectées', r?.classes ?? '-'], ['min/max Y', r ? `${r.minY}/${r.maxY}` : '-'],
      ['Sea level', appState.settings.seaLevel], ['Sea level gray16', minecraftYToGray16(appState.settings.seaLevel, appState.settings.minY, appState.settings.maxY)], ['Build limits', `${appState.settings.minY}..${appState.settings.maxY}`],
      ['Format export', 'PNG 16-bit grayscale (1 channel, no alpha)'], ['Compatibilité', 'WorldPainter immédiate']
    ])}`
  });
}

function bindHoverInfo(canvas, label, result) {
  if (!canvas || !label || !result) return;
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (result.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (result.height / rect.height));
    if (x < 0 || y < 0 || x >= result.width || y >= result.height) return;
    const i = y * result.width + x;
    const blockY = result.y[i];
    const gray16 = result.gray16[i];
    label.textContent = `x=${x}, z=${y} | Y=${blockY} | Gray16=${gray16} | Layer=${classifyMinecraftLayer(blockY)} | SeaLevel=64`;
  };
}

export function bindConverter(root, appState, notify) {
  const canvas = root.querySelector('#convCanvas');
  const hover = root.querySelector('#convHover');
  if (appState.converter.result) {
    drawGray16ToCanvas(canvas, appState.converter.result.gray16, appState.converter.result.width, appState.converter.result.height);
    bindHoverInfo(canvas, hover, appState.converter.result);
  }

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
      const gray16 = Math.round(lum * 65535);
      y[i] = mode === 'heightmap-grayscale'
        ? mapGray16ToMinecraft(gray16)
        : clamp(appState.settings.seaLevel - 20 + lum * 220, appState.settings.minY, appState.settings.maxY);
    }
    const yQ = quantizeToMinecraftY(y, appState.settings.minY, appState.settings.maxY);
    const gray16 = toGray16Array(yQ, appState.settings.minY, appState.settings.maxY);
    let minY = Infinity, maxY = -Infinity;
    for (const v of yQ) { if (v < minY) minY = v; if (v > maxY) maxY = v; }
    appState.converter.result = { width: source.width, height: source.height, y: yQ, gray16, minY, maxY, classes: mode };
    drawGray16ToCanvas(canvas, gray16, source.width, source.height);
    bindHoverInfo(canvas, hover, appState.converter.result);
    notify('Conversion terminée.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelector('#btnExportConv')?.addEventListener('click', async () => {
    if (!appState.converter.result) return notify('Convertissez une image d’abord.');
    await exportPseudo16Png(appState.converter.result.gray16, appState.converter.result.width, appState.converter.result.height, 'converted-heightmap.png');
  });
}
