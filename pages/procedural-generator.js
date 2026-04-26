import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';
import { generateProceduralIsland } from '../core/terrain-engine.js';
import { drawGray16ToCanvas } from '../ui/preview.js';
import { exportPseudo16Png } from '../export/png16-export.js';
import { exportHeightmapJson } from '../export/json-export.js';

export function renderProcedural(appState) {
  const stats = appState.procedural.stats || {};
  return pageScaffold({
    title: 'Générateur procédural',
    description: 'Pipeline complet 1 pixel = 1 bloc, îles crédibles avec marge océanique garantie.',
    controls: `
      <label>Seed <input id="procSeed" value="${appState.procedural.seed}" /></label>
      <label>Land % cible <input id="procLand" type="number" min="0.2" max="0.75" step="0.01" value="${appState.procedural.landRatio}" /></label>
      <label>Ocean Border
        <select id="procBorder">
          <option value="small">Small</option><option value="standard" selected>Standard</option>
          <option value="large">Large</option><option value="huge">Huge</option>
        </select>
      </label>
      <button id="btnGenerateProc">Générer île</button>
      <button id="btnExportProcPng">Exporter PNG</button>
      <button id="btnExportProcJson">Exporter JSON</button>
    `,
    preview: `<h2>Preview heightmap</h2><canvas id="procCanvas" width="1024" height="1024"></canvas>`,
    side: `<h3>Stats</h3>${statList([
      ['Terre %', stats.landPct ?? '-'], ['Océan %', stats.oceanPct ?? '-'], ['Alt min/max', `${stats.minY ?? '-'} / ${stats.maxY ?? '-'}`],
      ['Rivières', stats.rivers ?? '-'], ['Temps', stats.generationMs ? `${stats.generationMs} ms` : '-']
    ])}<p class="muted">${(stats.pipeline || []).join(' → ')}</p>`
  });
}

export function bindProcedural(root, appState, notify) {
  const canvas = root.querySelector('#procCanvas');
  if (appState.procedural.result) drawGray16ToCanvas(canvas, appState.procedural.result.gray16, appState.procedural.result.width, appState.procedural.result.height);

  root.querySelector('#btnGenerateProc')?.addEventListener('click', () => {
    appState.procedural.seed = root.querySelector('#procSeed').value;
    appState.procedural.landRatio = Number(root.querySelector('#procLand').value);
    appState.settings.oceanBorder = root.querySelector('#procBorder').value;
    const result = generateProceduralIsland({ ...appState.settings, ...appState.procedural });
    appState.procedural.result = result;
    appState.procedural.stats = result.stats;
    drawGray16ToCanvas(canvas, result.gray16, result.width, result.height);
    notify('Île procédurale générée.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelector('#btnExportProcPng')?.addEventListener('click', () => {
    if (!appState.procedural.result) return notify('Générez une île d’abord.');
    exportPseudo16Png(appState.procedural.result.gray16, appState.procedural.result.width, appState.procedural.result.height, 'procedural-island.png');
  });

  root.querySelector('#btnExportProcJson')?.addEventListener('click', () => {
    if (!appState.procedural.result) return notify('Générez une île d’abord.');
    exportHeightmapJson({ stats: appState.procedural.stats, width: appState.procedural.result.width, height: appState.procedural.result.height }, 'procedural-island.json');
  });
}
