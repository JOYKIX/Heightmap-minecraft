import { pageScaffold } from '../ui/panels.js';
import { statList } from '../ui/components.js';

export function renderHome(appState) {
  return pageScaffold({
    title: 'Accueil / Dashboard',
    description: 'Studio de heightmaps compatible WorldPainter, orienté rendu naturel (formes organiques, côtes réalistes, relief avancé).',
    controls: '<h2>Modules</h2><p>Nouveau preset “Ultra naturel” et pipeline enrichi : shelf océanique, falaises côtières, rivières plus naturelles et weathering.</p>',
    preview: '<h2>Workflow recommandé</h2><ol><li>Procedural Generator (Style Ultra naturel)</li><li>Export 16-bit PNG</li><li>Import dans WorldPainter</li><li>Ajout des biomes et textures</li></ol>',
    side: `<h3>État global</h3>${statList([
      ['Route', appState.route],
      ['Seed courant', appState.procedural.seed],
      ['Sea level', appState.settings.seaLevel],
      ['Résolution', appState.procedural.resolution]
    ])}`
  });
}
