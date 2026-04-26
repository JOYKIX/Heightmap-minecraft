import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';

export function renderHome(appState) {
  return pageScaffold({
    title: 'Accueil / Dashboard',
    description: 'Application multipages dynamique pour génération procédurale, extension d’océan, et conversion heightmap WorldPainter.',
    controls: `<h2>Modules</h2><p>Utilisez la navigation pour ouvrir les 4 modules métier et la page paramètres.</p>`,
    preview: `<h2>Workflow recommandé</h2><ol><li>Procedural Island</li><li>Extend Ocean</li><li>Heightmap Converter</li><li>Export 16-bit + JSON</li></ol>`,
    side: `<h3>État global</h3>${statList([
      ['Route', appState.route],
      ['Seed courant', appState.procedural.seed],
      ['Sea level', appState.settings.seaLevel],
      ['Résolution', appState.settings.resolution]
    ])}`
  });
}
