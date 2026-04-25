import { createDefaultSettings } from './src/config/terrain-settings.js';
import { populateSidebar } from './src/ui/sidebar.js';
import { bindControls } from './src/ui/controls.js';
import { refreshPreview } from './src/ui/preview.js';
import { updateStatsPanel } from './src/ui/stats-panel.js';
import { notify } from './src/ui/notifications.js';

const appState = {
  settings: createDefaultSettings(),
  terrain: null,
  generationStatus: 'idle',
  statistics: null,
  lastError: null
};

const worker = new Worker(new URL('./src/workers/terrain-worker.js', import.meta.url), { type: 'module' });

function updateProgress(progress, step) {
  const progressBar = document.getElementById('progress');
  if (progressBar) progressBar.style.width = `${Math.round(progress * 100)}%`;
  notify(`Pipeline: ${step} (${Math.round(progress * 100)}%)`, 'info');
}

function generate() {
  appState.generationStatus = 'running';
  appState.lastError = null;
  appState.settings.seed = appState.settings.seed?.trim() || createDefaultSettings().seed;
  notify('Génération en cours…', 'info');
  updateProgress(0.01, 'initialisation');
  worker.postMessage({ type: 'generate', payload: appState.settings });
}

function onWorkerMessage(event) {
  const { type, payload } = event.data;
  if (type === 'progress') {
    updateProgress(payload.progress, payload.step);
    return;
  }

  if (type === 'error') {
    appState.generationStatus = 'error';
    appState.lastError = payload.message;
    console.error('[terrain-worker] génération échouée:', payload);
    notify(`Erreur worker: ${payload.message}`, 'error');
    return;
  }

  if (type === 'result') {
    appState.generationStatus = 'done';
    appState.terrain = {
      ...payload,
      heightMap: Float32Array.from(payload.heightMap ?? []),
      biomeMap: Uint8Array.from(payload.biomeMap ?? []),
      biomeCounts: Uint32Array.from(payload.biomeCounts ?? []),
      riverMap: Uint8Array.from(payload.riverMap ?? [])
    };
    appState.statistics = payload.profile;
    refreshPreview(appState);
    updateStatsPanel(appState);
    notify('Génération terminée.', 'success');
  }
}

function downloadPng() {
  if (!appState.terrain) {
    notify('Aucune heightmap disponible. Générez un terrain d’abord.', 'error');
    return;
  }

  const size = appState.settings.mapSize;
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = size;
  exportCanvas.height = size;
  const exportCtx = exportCanvas.getContext('2d', { willReadFrequently: true });
  if (!exportCtx) {
    notify('Export PNG indisponible: contexte canvas introuvable.', 'error');
    return;
  }

  refreshPreview({ ...appState, settings: { ...appState.settings, previewMode: 'grayscale' } }, exportCtx, exportCanvas);
  const a = document.createElement('a');
  a.href = exportCanvas.toDataURL('image/png');
  const safeSeed = appState.settings.seed.replace(/[^\w.-]+/g, '-').slice(0, 80);
  a.download = `heightmap-${safeSeed || 'map'}.png`;
  a.click();
}

function downloadJson() {
  const payload = {
    settings: appState.settings,
    hasTerrain: Boolean(appState.terrain),
    generatedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `heightmap-config-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function init() {
  populateSidebar();
  const worldType = document.getElementById('world-type');
  if (worldType) worldType.value = appState.settings.worldType;
  const biomePreset = document.getElementById('biome-preset');
  if (biomePreset) biomePreset.value = appState.settings.biomePreset;
  worker.addEventListener('message', onWorkerMessage);
  worker.addEventListener('error', (event) => {
    console.error('[terrain-worker] runtime error:', event);
    notify(`Erreur worker: ${event.message || 'erreur inconnue'}`, 'error');
    appState.generationStatus = 'error';
  });

  bindControls(appState, {
    generate,
    refreshPreview: () => refreshPreview(appState),
    downloadPng,
    downloadJson
  });

  notify('Prêt. Modifiez les paramètres puis cliquez sur Générer.', 'info');
}

init();
