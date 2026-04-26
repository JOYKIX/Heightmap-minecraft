import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';

export function renderSettings(appState) {
  return pageScaffold({
    title: 'Paramètres / Presets',
    description: 'Réglages globaux Minecraft et preset océan.',
    controls: `
      <h2>Paramètres globaux</h2>
      <label>Min Y <input id="setMinY" type="number" value="${appState.settings.minY}" /></label>
      <label>Sea Level <input id="setSea" type="number" value="${appState.settings.seaLevel}" /></label>
      <label>Max Y <input id="setMaxY" type="number" value="${appState.settings.maxY}" /></label>
      <label>Ocean Border
        <select id="setBorder">
          <option value="small">Small (8%)</option><option value="standard" selected>Standard (15%)</option>
          <option value="large">Large (25%)</option><option value="huge">Huge (35%)</option>
        </select>
      </label>
      <button id="saveSettings">Sauvegarder</button>
    `,
    preview: '<h2>Presets</h2><p>Les paramètres sont appliqués au générateur procédural et à l’outil d’extension d’océan.</p>',
    side: `<h3>Validation</h3>${statList([
      ['minY', appState.settings.minY], ['seaLevel', appState.settings.seaLevel], ['maxY', appState.settings.maxY]
    ])}`
  });
}

export function bindSettings(root, appState, notify) {
  root.querySelector('#saveSettings')?.addEventListener('click', () => {
    appState.settings.minY = Number(root.querySelector('#setMinY').value);
    appState.settings.seaLevel = Number(root.querySelector('#setSea').value);
    appState.settings.maxY = Number(root.querySelector('#setMaxY').value);
    appState.settings.oceanBorder = root.querySelector('#setBorder').value;
    notify('Paramètres sauvegardés.');
  });
}
