import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';
import { minecraftYToGray16 } from '../core/worldpainter.js';

export function renderSettings(appState) {
  const seaGray16 = minecraftYToGray16(appState.settings.seaLevel, appState.settings.minY, appState.settings.maxY);
  return pageScaffold({
    title: 'Paramètres / Presets',
    description: 'Réglages globaux Minecraft verrouillés pour la conversion WorldPainter stricte en 16-bit.',
    controls: `
      <h2>Build limits Minecraft</h2>
      <label>Min Y <input id="setMinY" type="number" value="${appState.settings.minY}" readonly /></label>
      <label>Sea Level <input id="setSea" type="number" value="${appState.settings.seaLevel}" readonly /></label>
      <label>Max Y <input id="setMaxY" type="number" value="${appState.settings.maxY}" readonly /></label>
      <label>Ocean Border
        <select id="setBorder">
          <option value="small">Small (8%)</option><option value="standard" selected>Standard (15%)</option>
          <option value="large">Large (25%)</option><option value="huge">Huge (35%)</option>
        </select>
      </label>
      <button id="saveSettings">Sauvegarder</button>
      <h3>WorldPainter import recommandé</h3>
      <ul>
        <li>From Image → Lowest Value = 0</li>
        <li>From Image → Highest Value = 65535</li>
        <li>To Minecraft → Build Limit Lower = -64</li>
        <li>To Minecraft → Build Limit Upper = 319</li>
        <li>To Minecraft → Water Level = 64</li>
        <li>Sea Level Gray16 = ${seaGray16}</li>
      </ul>
    `,
    preview: '<h2>Presets</h2><p>Les paramètres sont appliqués au générateur procédural et à l’outil d’extension d’océan.</p>',
    side: `<h3>Validation</h3>${statList([
      ['minY', appState.settings.minY], ['seaLevel', appState.settings.seaLevel], ['maxY', appState.settings.maxY], ['seaGray16', seaGray16]
    ])}`
  });
}

export function bindSettings(root, appState, notify) {
  root.querySelector('#saveSettings')?.addEventListener('click', () => {
    appState.settings.minY = -64;
    appState.settings.seaLevel = 64;
    appState.settings.maxY = 319;
    appState.settings.oceanBorder = root.querySelector('#setBorder').value;
    notify('Paramètres sauvegardés (build limits WorldPainter stricts).');
  });
}
