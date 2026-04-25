const baseConfig = {
  width: 1024,
  height: 1024,
  seed: 'default',
  seaLevel: 64,
  minY: 0,
  maxY: 255,
  worldType: 'realistic_island',
  landCoverage: 0.45,
  oceanBorder: 'standard',
  reliefStyle: 'balanced',
  coastStyle: 'mixed',
  oceanDepth: 'medium',
  riverAmount: 'some',
  quality: 'balanced',
  enabledBiomes: {},
  biomeWeights: {},
  exportMode: 'worldpainter_safe'
};

let latestTerrain = null;

async function initApp() {
  try {
    const [terrainEngine, preview, pngExport, jsonExport, controls, statsUi, ui] = await Promise.all([
      import('./core/terrain-engine.js'),
      import('./render/preview.js'),
      import('./export/png-export.js'),
      import('./export/json-export.js'),
      import('./ui/controls.js'),
      import('./ui/stats.js'),
      import('./ui/ui.js')
    ]);

    ui.populatePresets();
    ui.populateBiomeControls();
    ui.initPreviewModes();
    statsUi.renderWorldPainterSettings(baseConfig, document.getElementById('wpSettings'));

    const canvas = document.getElementById('previewCanvas');
    const statsEl = document.getElementById('statsPanel');

    document.getElementById('btnRandomSeed').addEventListener('click', () => controls.randomSeed());

    document.getElementById('btnGenerate').addEventListener('click', () => {
      controls.setStatus('Génération...');
      const configFromUi = controls.readConfigFromUi(baseConfig);
      const config = ui.applyPresetToConfig(configFromUi, configFromUi.preset);
      latestTerrain = terrainEngine.generateTerrain(config);
      const mode = document.getElementById('previewMode').value;
      preview.renderPreview(canvas, latestTerrain, mode);
      statsUi.renderStats(latestTerrain.stats, statsEl);
      statsUi.renderWorldPainterSettings(config, document.getElementById('wpSettings'));
      controls.setStatus('Terminé');
    });

    document.getElementById('previewMode').addEventListener('change', (e) => {
      if (!latestTerrain) return;
      preview.renderPreview(canvas, latestTerrain, e.target.value);
    });

    document.getElementById('btnExportPng').addEventListener('click', async () => {
      if (!latestTerrain) return;
      await pngExport.exportHeightmapPng(latestTerrain);
    });

    document.getElementById('btnExportJson').addEventListener('click', () => {
      if (!latestTerrain) return;
      jsonExport.exportTerrainJson(latestTerrain);
    });

    document.getElementById('btnReset').addEventListener('click', () => {
      window.location.reload();
    });
  } catch (error) {
    console.error('Module mode failed, fallback active.', error);
    fallbackInit();
  }
}

function fallbackInit() {
  const status = document.getElementById('statusText');
  status.textContent = 'Fallback simple actif';
  const canvas = document.getElementById('previewCanvas');
  const ctx = canvas.getContext('2d');
  document.getElementById('btnGenerate').addEventListener('click', () => {
    const size = Number(document.getElementById('sizeSelect').value);
    canvas.width = size;
    canvas.height = size;
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const x = i % size;
      const y = (i / size) | 0;
      const gray = Math.max(0, Math.min(255, Math.round((Math.sin(x * 0.03) + Math.cos(y * 0.02)) * 40 + 110)));
      const o = i * 4;
      img.data[o] = gray;
      img.data[o + 1] = gray;
      img.data[o + 2] = gray;
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });
}

window.addEventListener('DOMContentLoaded', initApp);
