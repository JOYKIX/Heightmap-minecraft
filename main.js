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
  statistics: null
};

const worker = new Worker(new URL('./src/workers/terrain-worker.js', import.meta.url), { type: 'module' });

function updateProgress(progress, step) {
  document.getElementById('progress').style.width = `${Math.round(progress * 100)}%`;
  notify(`Pipeline: ${step} (${Math.round(progress * 100)}%)`, 'info');
}

function generate() {
  appState.generationStatus = 'running';
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
    notify(`Erreur worker: ${payload.message}`, 'error');
    return;
  }

  if (type === 'result') {
    appState.generationStatus = 'done';
    appState.terrain = {
      ...payload,
      heightMap: Float32Array.from(payload.heightMap),
      biomeMap: Uint8Array.from(payload.biomeMap),
      biomeCounts: Uint32Array.from(payload.biomeCounts),
      riverMap: Uint8Array.from(payload.riverMap)
    };
    appState.statistics = payload.profile;
    refreshPreview(appState);
    updateStatsPanel(appState);
    notify('Génération terminée.', 'success');
  }
}

function downloadPng() {
  const canvas = document.getElementById('canvas');
  if (!appState.terrain || !canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `heightmap-${appState.settings.seed}.png`;
  a.click();
}

function init() {
  populateSidebar();
  document.getElementById('world-type').value = appState.settings.worldType;
  document.getElementById('biome-preset').value = appState.settings.biomePreset;
  worker.addEventListener('message', onWorkerMessage);

  bindControls(appState, {
    generate,
    refreshPreview: () => refreshPreview(appState),
    downloadPng
  });

  notify('Prêt. Modifiez les paramètres puis cliquez sur Générer.', 'info');
}

init();
