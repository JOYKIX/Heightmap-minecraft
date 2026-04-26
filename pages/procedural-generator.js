import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';
import { generateProceduralIsland } from '../core/terrain-engine.js';
import { drawGray16ToCanvas } from '../ui/preview.js';
import { exportPseudo16Png } from '../export/png16-export.js';
import { classifyMinecraftLayer, minecraftYToGray16 } from '../core/worldpainter.js';

function option(selected, value, label) {
  return `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`;
}

export function renderProcedural(appState) {
  const stats = appState.procedural.stats || {};
  const validations = stats.validations || {};

  return pageScaffold({
    title: 'Procedural Generator',
    description: 'Générateur d’île réaliste optimisé WorldPainter : UI simple, pipeline avancé, export PNG 16-bit grayscale.',
    controls: `
      <label>Map Size
        <select id="procSize">
          ${option(appState.procedural.resolution, 512, '512')}
          ${option(appState.procedural.resolution, 1024, '1024')}
          ${option(appState.procedural.resolution, 2048, '2048')}
        </select>
      </label>
      <label>Island Size
        <select id="procIslandSize">
          ${option(appState.procedural.islandSize, 'small', 'Petite')}
          ${option(appState.procedural.islandSize, 'medium', 'Moyenne')}
          ${option(appState.procedural.islandSize, 'large', 'Grande')}
          ${option(appState.procedural.islandSize, 'immense', 'Immense')}
        </select>
      </label>
      <label>Relief
        <select id="procRelief">
          ${option(appState.procedural.relief, 'soft', 'Doux')}
          ${option(appState.procedural.relief, 'normal', 'Normal')}
          ${option(appState.procedural.relief, 'mountainous', 'Montagneux')}
          ${option(appState.procedural.relief, 'extreme', 'Extrême')}
        </select>
      </label>
      <label>Style
        <select id="procStyle">
          ${option(appState.procedural.style, 'balanced', 'Équilibré')}
          ${option(appState.procedural.style, 'archipelago', 'Archipel')}
          ${option(appState.procedural.style, 'mountainous', 'Montagneux')}
          ${option(appState.procedural.style, 'dramatic_coast', 'Côtier dramatique')}
        </select>
      </label>
      <label>Seed <input id="procSeed" value="${appState.procedural.seed}" /></label>
      <button id="btnGenerateProc">Générer</button>
      <button id="btnExportProcPng">Export 16-bit PNG</button>
    `,
    preview: `<h2>Preview heightmap</h2><canvas id="procCanvas" width="1024" height="1024"></canvas><p id="procHover" class="muted">Survolez pour lire altitude Y, gray16 et couche Minecraft.</p>`,
    side: `
      <h3>Validation & Stats</h3>
      ${statList([
        ['Map Size', stats.mapSize ?? '-'],
        ['Island Size', stats.islandSize ?? '-'],
        ['Relief', stats.relief ?? '-'],
        ['Style', stats.style ?? '-'],
        ['Altitude min', stats.minY ?? '-'],
        ['Altitude max', stats.maxY ?? '-'],
        ['Sea level', appState.settings.seaLevel],
        ['Sea level gray16', minecraftYToGray16(appState.settings.seaLevel, appState.settings.minY, appState.settings.maxY)],
        ['Terre %', stats.landPct ?? '-'],
        ['Océan %', stats.oceanPct ?? '-'],
        ['Rivières', stats.rivers ?? '-'],
        ['Temps', stats.generationMs ? `${stats.generationMs} ms` : '-'],
        ['WorldPainter', stats.worldPainter ?? 'Compatible 16-bit grayscale, 1px = 1 bloc'],
        ['Bords sans terre', validations.noLandOnEdges === undefined ? '-' : (validations.noLandOnEdges ? 'OK' : 'ÉCHEC')],
        ['Eau autour', validations.waterAroundIsland === undefined ? '-' : (validations.waterAroundIsland ? 'OK' : 'ÉCHEC')],
        ['Valeurs finies', validations.finiteValues === undefined ? '-' : (validations.finiteValues ? 'OK' : 'ÉCHEC')],
        ['Range Minecraft', validations.minecraftRangeOk === undefined ? '-' : (validations.minecraftRangeOk ? 'OK' : 'ÉCHEC')],
        ['Relief non plat', validations.nonFlat === undefined ? '-' : (validations.nonFlat ? 'OK' : 'ÉCHEC')]
      ])}
      <h3>WorldPainter</h3>
      <ul>
        <li>Min Y : -64</li>
        <li>Sea Level : 64</li>
        <li>Max Y : 319</li>
        <li>Export : 16-bit grayscale</li>
        <li>1 pixel = 1 bloc</li>
      </ul>
      <p class="muted">${(stats.pipeline || []).join(' → ')}</p>
    `
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
    const blockY = result.yMap[i];
    const gray16 = result.gray16[i];
    label.textContent = `x=${x}, z=${y} | Y=${blockY} | Gray16=${gray16} | Layer=${classifyMinecraftLayer(blockY)}`;
  };
}

export function bindProcedural(root, appState, notify) {
  const canvas = root.querySelector('#procCanvas');
  const hover = root.querySelector('#procHover');

  if (appState.procedural.result) {
    drawGray16ToCanvas(canvas, appState.procedural.result.gray16, appState.procedural.result.width, appState.procedural.result.height);
    bindHoverInfo(canvas, hover, appState.procedural.result);
  }

  root.querySelector('#btnGenerateProc')?.addEventListener('click', () => {
    appState.procedural.seed = root.querySelector('#procSeed').value || 'island';
    appState.procedural.resolution = Number(root.querySelector('#procSize').value);
    appState.procedural.islandSize = root.querySelector('#procIslandSize').value;
    appState.procedural.relief = root.querySelector('#procRelief').value;
    appState.procedural.style = root.querySelector('#procStyle').value;

    const result = generateProceduralIsland({ ...appState.settings, ...appState.procedural });
    appState.procedural.result = result;
    appState.procedural.stats = result.stats;

    drawGray16ToCanvas(canvas, result.gray16, result.width, result.height);
    bindHoverInfo(canvas, hover, result);
    notify('Génération procédurale terminée.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  root.querySelector('#btnExportProcPng')?.addEventListener('click', async () => {
    if (!appState.procedural.result) return notify('Générez une île d’abord.');
    await exportPseudo16Png(appState.procedural.result.gray16, appState.procedural.result.width, appState.procedural.result.height, 'procedural-island-16bit.png');
  });
}
