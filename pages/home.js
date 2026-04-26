import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';

export function renderHome(appState) {
  return pageScaffold({
    title: 'Accueil / Dashboard',
    description: 'Studio de heightmaps compatible WorldPainter (générateur procédural, extension d’océan, conversion).',
    controls: '<h2>Modules</h2><p>Le Procedural Generator a été simplifié en surface et renforcé côté moteur.</p>',
    preview: '<h2>Workflow recommandé</h2><ol><li>Procedural Generator</li><li>Export 16-bit PNG</li><li>Import dans WorldPainter</li></ol>',
    side: `<h3>État global</h3>${statList([
      ['Route', appState.route],
      ['Seed courant', appState.procedural.seed],
      ['Sea level', appState.settings.seaLevel],
      ['Résolution', appState.procedural.resolution]
    ])}`
  });
}
