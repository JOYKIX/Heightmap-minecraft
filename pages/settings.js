import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';
import { minecraftYToGray16 } from '../core/worldpainter.js';

export function renderSettings(appState) {
  const seaGray16 = minecraftYToGray16(appState.settings.seaLevel, appState.settings.minY, appState.settings.maxY);
  return pageScaffold({
    title: 'Paramètres WorldPainter',
    description: 'Paramètres verrouillés pour une conversion heightmap Minecraft Y → PNG 16-bit grayscale.',
    controls: `
      <h2>Build limits Minecraft</h2>
      <label>Min Y <input type="number" value="${appState.settings.minY}" readonly /></label>
      <label>Sea Level <input type="number" value="${appState.settings.seaLevel}" readonly /></label>
      <label>Max Y <input type="number" value="${appState.settings.maxY}" readonly /></label>
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
    preview: '<h2>Validation</h2><p>Le pipeline procedural et le convertisseur utilisent automatiquement ces limites.</p>',
    side: `<h3>État</h3>${statList([
      ['minY', appState.settings.minY],
      ['seaLevel', appState.settings.seaLevel],
      ['maxY', appState.settings.maxY],
      ['seaGray16', seaGray16],
      ['Export', 'PNG 16-bit grayscale'],
      ['Échelle', '1 pixel = 1 bloc']
    ])}`
  });
}

export function bindSettings() {}
