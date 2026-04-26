const routes = new Map();

export function registerRoute(name, render) {
  routes.set(name, render);
}

export function startRouter(onRoute) {
  const run = () => {
    const hash = window.location.hash.replace('#/', '') || 'home';
    onRoute(hash, routes.get(hash));
  };
  window.addEventListener('hashchange', run);
  run();
}
