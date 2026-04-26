import { pageScaffold } from '../ui/panels.js';
import { fileToImageData } from '../js/utils.js';
import { analyzeImportedImage, extendOceanCanvas } from '../core/image-processing.js';
import { drawRGBA } from '../ui/preview.js';
import { statList } from '../ui/components.js';
import { downloadBlob } from '../js/utils.js';

export function renderExtender(appState) {
  const detected = appState.extend.detected;
  const result = appState.extend.result;
  return pageScaffold({
    title: 'Import & Extend Ocean',
    description: 'Import d’image puis ajout intelligent d’océan sans déformation de l’île.',
    controls: `
      <label>Importer image <input id="extFile" type="file" accept="image/*" /></label>
      <label>Padding autour (%)
        <select id="extPad">
          <option value="10">10%</option><option value="25" selected>25%</option><option value="50">50%</option>
        </select>
      </label>
      <button id="btnExtend">Étendre océan</button>
      <button id="btnExportExt">Exporter image étendue</button>
    `,
    preview: '<h2>Preview</h2><canvas id="extCanvas" width="1024" height="1024"></canvas>',
    side: `<h3>Validation</h3>${statList([
      ['Type', detected?.mode ?? '-'], ['Alpha', detected ? String(detected.hasAlpha) : '-'],
      ['Dimensions source', detected ? `${detected.width}x${detected.height}` : '-'],
      ['Dimensions finales', result ? `${result.width}x${result.height}` : '-'],
      ['Padding', `${appState.extend.paddingPct}%`]
    ])}`
  });
}

export function bindExtender(root, appState, notify) {
  const canvas = root.querySelector('#extCanvas');
  if (appState.extend.result) drawRGBA(canvas, appState.extend.result.data, appState.extend.result.width, appState.extend.result.height);

  root.querySelector('#btnExtend')?.addEventListener('click', async () => {
    const file = root.querySelector('#extFile').files?.[0];
    if (!file) return notify('Importez une image.');
    appState.extend.paddingPct = Number(root.querySelector('#extPad').value);
    const source = await fileToImageData(file);
    appState.extend.source = source;
    appState.extend.detected = analyzeImportedImage(source);
    appState.extend.result = extendOceanCanvas(source, appState.extend.paddingPct, appState.settings.seaLevel, appState.extend.detected.mode);
    drawRGBA(canvas, appState.extend.result.data, appState.extend.result.width, appState.extend.result.height);
    notify('Océan étendu avec succès.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelector('#btnExportExt')?.addEventListener('click', () => {
    if (!appState.extend.result) return notify('Étendez une image d’abord.');
    const c = document.createElement('canvas');
    c.width = appState.extend.result.width; c.height = appState.extend.result.height;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    img.data.set(appState.extend.result.data); ctx.putImageData(img, 0, 0);
    c.toBlob((blob) => blob && downloadBlob(blob, 'extended-ocean.png'), 'image/png');
  });
}
