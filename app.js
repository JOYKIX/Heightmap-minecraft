import { appState } from './js/state.js';
import { registerRoute, startRouter } from './js/router.js';
import { navItem } from './ui/components.js';
import { createNotifier } from './ui/notifications.js';
import { renderHome } from './pages/home.js';
import { renderProcedural, bindProcedural } from './pages/procedural-generator.js';
import { renderExtender, bindExtender } from './pages/image-ocean-extender.js';
import { renderConverter, bindConverter } from './pages/heightmap-converter.js';
import { renderSettings, bindSettings } from './pages/settings.js';

const app = document.getElementById('app');
const notify = createNotifier();

registerRoute('home', () => renderHome(appState));
registerRoute('procedural', () => renderProcedural(appState));
registerRoute('extend-ocean', () => renderExtender(appState));
registerRoute('converter', () => renderConverter(appState));
registerRoute('settings', () => renderSettings(appState));

function renderShell(content, route) {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">Heightmap Studio</div>
        <nav class="nav">
          ${navItem('home', 'Home', route === 'home')}
          ${navItem('procedural', 'Procedural Island', route === 'procedural')}
          ${navItem('extend-ocean', 'Extend Ocean', route === 'extend-ocean')}
          ${navItem('converter', 'Heightmap Converter', route === 'converter')}
          ${navItem('settings', 'Settings', route === 'settings')}
        </nav>
      </aside>
      <main class="main">${content}</main>
    </div>
  `;
}

startRouter((route, renderer) => {
  appState.route = route;
  const content = renderer ? renderer() : renderHome(appState);
  renderShell(content, route);
  if (route === 'procedural') bindProcedural(app, appState, notify);
  if (route === 'extend-ocean') bindExtender(app, appState, notify);
  if (route === 'converter') bindConverter(app, appState, notify);
  if (route === 'settings') bindSettings(app, appState, notify);
});
