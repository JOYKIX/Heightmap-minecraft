const state = {
  file: null,
  source: null,
  original: null,
  corrected: null,
  minecraft: null,
  layers: null,
  info: null
};

const els = {
  fileInput: document.getElementById('fileInput'),
  dropZone: document.getElementById('dropZone'),
  status: document.getElementById('statusText'),
  analyze: document.getElementById('btnAnalyze'),
  autoFix: document.getElementById('btnAutoFix'),
  process: document.getElementById('btnProcess'),
  export8: document.getElementById('btnExport8'),
  export16: document.getElementById('btnExport16'),
  previewMode: document.getElementById('previewMode'),
  canvas: document.getElementById('previewCanvas'),
  stats: document.getElementById('statsPanel')
};

function setStatus(text) {
  els.status.textContent = text;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function mapRange(v, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return outMin + ((v - inMin) * (outMax - outMin)) / (inMax - inMin);
}

function createGrayInfo(values, bitDepth) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max, bitDepth };
}

async function loadHeightmap(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'png') return loadPng(file);
  if (ext === 'raw') throw new Error('RAW détecté: parsing RAW dépend du format source, non standard sans paramètres supplémentaires.');
  if (ext === 'tif' || ext === 'tiff') throw new Error('TIFF détecté: décodage TIFF non natif dans ce build browser-only. Convertissez en PNG grayscale 16-bit.');
  throw new Error('Format non supporté. Utilisez PNG, RAW ou TIFF.');
}

async function loadPng(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
  const gray = new Uint16Array(c.width * c.height);

  let alphaFound = false;
  let colorful = false;
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const a = rgba[o + 3];
    if (a !== 255) alphaFound = true;
    if (!(r === g && g === b)) colorful = true;
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b) * 257;
  }

  const guessedDepth = file.name.includes('16') ? 16 : 8;
  return {
    width: c.width,
    height: c.height,
    channels: 1,
    hasAlpha: alphaFound,
    colorful,
    bitDepth: guessedDepth,
    gray,
    sourceType: 'PNG'
  };
}

function normalizeHeightmap(gray) {
  const info = createGrayInfo(gray, 16);
  const normalized = new Float32Array(gray.length);
  const range = info.max - info.min || 1;
  for (let i = 0; i < gray.length; i++) {
    normalized[i] = (gray[i] - info.min) / range;
  }
  return { normalized, inputMin: info.min, inputMax: info.max };
}

function slopeAt(arr, w, h, x, y) {
  const xl = clamp(x - 1, 0, w - 1);
  const xr = clamp(x + 1, 0, w - 1);
  const yt = clamp(y - 1, 0, h - 1);
  const yb = clamp(y + 1, 0, h - 1);
  const dx = arr[y * w + xr] - arr[y * w + xl];
  const dy = arr[yb * w + x] - arr[yt * w + x];
  return Math.sqrt(dx * dx + dy * dy);
}

function applyAutoFix(map, w, h, smoothStrength, sharpenStrength, preservePeaks) {
  const pass1 = new Float32Array(map);
  const smooth = clamp(smoothStrength, 0, 1);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = map[i];
      const n = map[(y - 1) * w + x];
      const s = map[(y + 1) * w + x];
      const e = map[y * w + x + 1];
      const wv = map[y * w + x - 1];
      const avg = (v + n + s + e + wv) / 5;
      pass1[i] = v * (1 - smooth) + avg * smooth;
    }
  }

  const pass2 = new Float32Array(pass1.length);
  const sharp = clamp(sharpenStrength, 0, 1);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = pass1[i];
      const blur = (pass1[i - 1] + pass1[i + 1] + pass1[i - w] + pass1[i + w]) / 4;
      let out = v + (v - blur) * sharp;
      if (preservePeaks && v > 0.92) out = Math.max(out, v);
      pass2[i] = clamp(out, 0, 1);
    }
  }

  for (let x = 0; x < w; x++) {
    pass2[x] = pass1[x];
    pass2[(h - 1) * w + x] = pass1[(h - 1) * w + x];
  }
  for (let y = 0; y < h; y++) {
    pass2[y * w] = pass1[y * w];
    pass2[y * w + (w - 1)] = pass1[y * w + (w - 1)];
  }

  return pass2;
}

function toMinecraftHeights(normalized, minY, maxY, stretch = 1) {
  const out = new Float32Array(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    const stretched = clamp(Math.pow(normalized[i], 1 / stretch), 0, 1);
    out[i] = mapRange(stretched, 0, 1, minY, maxY);
  }
  return out;
}

function classifyLayer(y) {
  if (y <= 63 && y >= 20) return 'ocean';
  if (y <= 69) return 'beach';
  if (y <= 95) return 'lowlands';
  if (y <= 120) return 'hills';
  if (y <= 160) return 'highlands';
  if (y <= 240) return 'mountains';
  return 'peaks';
}

function detectLayers(minecraftMap) {
  const layers = new Array(minecraftMap.length);
  const counts = { ocean: 0, beach: 0, lowlands: 0, hills: 0, highlands: 0, mountains: 0, peaks: 0 };
  for (let i = 0; i < minecraftMap.length; i++) {
    const layer = classifyLayer(minecraftMap[i]);
    layers[i] = layer;
    counts[layer]++;
  }
  return { layers, counts };
}

function analyzeHeightmap(norm, mc, w, h) {
  let banding = 0;
  let clippingLow = 0;
  let clippingHigh = 0;
  let slopeSum = 0;

  for (let i = 0; i < norm.length; i++) {
    const q = Math.round(norm[i] * 255) / 255;
    if (Math.abs(norm[i] - q) < 0.0001) banding++;
    if (norm[i] < 0.01) clippingLow++;
    if (norm[i] > 0.99) clippingHigh++;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      slopeSum += slopeAt(mc, w, h, x, y);
    }
  }

  return {
    bandingRatio: banding / norm.length,
    clippingLowRatio: clippingLow / norm.length,
    clippingHighRatio: clippingHigh / norm.length,
    avgSlope: slopeSum / (w * h)
  };
}

function renderStats() {
  if (!state.info) {
    els.stats.innerHTML = '<p>Aucune image chargée.</p>';
    return;
  }

  const info = state.info;
  const a = info.analysis || {};
  const c = info.layerCounts || {};
  els.stats.innerHTML = `
    <ul>
      <li><b>Résolution:</b> ${info.width} × ${info.height}</li>
      <li><b>Format source:</b> ${info.sourceType}</li>
      <li><b>Bit depth détecté:</b> ${info.bitDepth}-bit</li>
      <li><b>Min grayscale:</b> ${info.grayMin}</li>
      <li><b>Max grayscale:</b> ${info.grayMax}</li>
      <li><b>Plage utilisée:</b> ${(info.grayMax - info.grayMin).toFixed(0)}</li>
      <li><b>Banding:</b> ${((a.bandingRatio || 0) * 100).toFixed(1)}%</li>
      <li><b>Clipping bas:</b> ${((a.clippingLowRatio || 0) * 100).toFixed(1)}%</li>
      <li><b>Clipping haut:</b> ${((a.clippingHighRatio || 0) * 100).toFixed(1)}%</li>
      <li><b>Pente moyenne:</b> ${(a.avgSlope || 0).toFixed(2)}</li>
      <li><b>Ocean:</b> ${c.ocean || 0}</li>
      <li><b>Beach:</b> ${c.beach || 0}</li>
      <li><b>Lowlands:</b> ${c.lowlands || 0}</li>
      <li><b>Hills:</b> ${c.hills || 0}</li>
      <li><b>Highlands:</b> ${c.highlands || 0}</li>
      <li><b>Mountains:</b> ${c.mountains || 0}</li>
      <li><b>Peaks:</b> ${c.peaks || 0}</li>
    </ul>
  `;
}

function renderPreview(mode) {
  if (!state.original) return;
  const ctx = els.canvas.getContext('2d');
  const w = state.info.width;
  const h = state.info.height;
  els.canvas.width = w;
  els.canvas.height = h;

  const imageData = ctx.createImageData(w, h);
  const out = imageData.data;

  const base = mode === 'original' ? state.original : (state.corrected || state.original);
  const mc = state.minecraft || new Float32Array(base.length);

  for (let i = 0; i < base.length; i++) {
    const o = i * 4;
    let r = 0, g = 0, b = 0;

    if (mode === 'original' || mode === 'corrected') {
      const gray = Math.round(base[i] * 255);
      r = g = b = gray;
    } else if (mode === 'heatmap') {
      const v = base[i];
      r = Math.round(255 * clamp((v - 0.2) * 1.3, 0, 1));
      g = Math.round(255 * clamp(1 - Math.abs(v - 0.5) * 2, 0, 1));
      b = Math.round(255 * clamp((0.8 - v) * 1.6, 0, 1));
    } else if (mode === 'hillshade') {
      const x = i % w;
      const y = (i / w) | 0;
      const slope = slopeAt(base, w, h, x, y);
      const shade = clamp(0.72 - slope * 1.2 + base[i] * 0.6, 0, 1);
      r = g = b = Math.round(shade * 255);
    } else if (mode === 'layers') {
      const layer = state.layers?.[i] || 'lowlands';
      const palette = {
        ocean: [40, 90, 170],
        beach: [224, 205, 140],
        lowlands: [80, 170, 90],
        hills: [120, 150, 80],
        highlands: [110, 120, 90],
        mountains: [135, 125, 120],
        peaks: [235, 235, 235]
      };
      [r, g, b] = palette[layer];
    } else if (mode === 'slope') {
      const x = i % w;
      const y = (i / w) | 0;
      const slope = clamp(slopeAt(mc, w, h, x, y) / 12, 0, 1);
      r = Math.round(255 * slope);
      g = Math.round(255 * (1 - slope));
      b = 60;
    }

    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
}

function runPipeline({ applyFixes }) {
  if (!state.source) throw new Error('Importez une heightmap d\'abord.');

  const minY = Number(document.getElementById('minY').value);
  const maxY = Number(document.getElementById('maxY').value);
  const stretch = Number(document.getElementById('heightStretch').value);
  const smoothStrength = Number(document.getElementById('smoothStrength').value);
  const sharpenStrength = Number(document.getElementById('sharpenStrength').value);
  const preservePeaks = document.getElementById('preservePeaks').checked;

  const normalizedPayload = normalizeHeightmap(state.source.gray);
  let normalized = normalizedPayload.normalized;
  state.original = normalized;

  if (applyFixes) {
    normalized = applyAutoFix(normalized, state.source.width, state.source.height, smoothStrength, sharpenStrength, preservePeaks);
  }

  const minecraft = toMinecraftHeights(normalized, minY, maxY, stretch);
  const layerPayload = detectLayers(minecraft);
  const analysis = analyzeHeightmap(normalized, minecraft, state.source.width, state.source.height);

  state.corrected = normalized;
  state.minecraft = minecraft;
  state.layers = layerPayload.layers;

  state.info = {
    width: state.source.width,
    height: state.source.height,
    sourceType: state.source.sourceType,
    bitDepth: state.source.bitDepth,
    grayMin: normalizedPayload.inputMin,
    grayMax: normalizedPayload.inputMax,
    analysis,
    layerCounts: layerPayload.counts
  };

  renderStats();
  renderPreview(els.previewMode.value);
}

function to8bitCanvasData(norm, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < norm.length; i++) {
    const g = Math.round(clamp(norm[i], 0, 1) * 255);
    const o = i * 4;
    img.data[o] = g;
    img.data[o + 1] = g;
    img.data[o + 2] = g;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function downloadCanvas(canvas, name) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function export8bitWorldPainter() {
  if (!state.corrected) throw new Error('Aucune donnée à exporter.');
  const c = to8bitCanvasData(state.corrected, state.info.width, state.info.height);
  downloadCanvas(c, 'heightmap-worldpainter-safe-8bit.png');
}

function exportPseudo16bit() {
  if (!state.corrected) throw new Error('Aucune donnée à exporter.');
  const w = state.info.width;
  const h = state.info.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < state.corrected.length; i++) {
    const value16 = Math.round(clamp(state.corrected[i], 0, 1) * 65535);
    const hi = (value16 >> 8) & 255;
    const lo = value16 & 255;
    const o = i * 4;
    img.data[o] = hi;
    img.data[o + 1] = lo;
    img.data[o + 2] = 0;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  downloadCanvas(c, 'heightmap-packed16-rg.png');
}

function registerEvents() {
  els.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setStatus('Import en cours...');
      state.file = file;
      state.source = await loadHeightmap(file);
      setStatus(`Importé: ${file.name}`);
      runPipeline({ applyFixes: false });
    } catch (err) {
      setStatus('Erreur import');
      alert(err.message);
    }
  });

  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag'));
  els.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    els.fileInput.files = e.dataTransfer.files;
    els.fileInput.dispatchEvent(new Event('change'));
  });

  els.analyze.addEventListener('click', () => {
    try {
      setStatus('Analyse...');
      runPipeline({ applyFixes: false });
      setStatus('Analyse terminée');
    } catch (err) {
      setStatus('Erreur analyse');
      alert(err.message);
    }
  });

  els.autoFix.addEventListener('click', () => {
    try {
      setStatus('Autofix...');
      runPipeline({ applyFixes: true });
      setStatus('Autofix terminé');
    } catch (err) {
      setStatus('Erreur autofix');
      alert(err.message);
    }
  });

  els.process.addEventListener('click', () => {
    try {
      setStatus('Conversion...');
      runPipeline({ applyFixes: true });
      setStatus('Conversion terminée');
    } catch (err) {
      setStatus('Erreur conversion');
      alert(err.message);
    }
  });

  els.previewMode.addEventListener('change', () => renderPreview(els.previewMode.value));

  els.export8.addEventListener('click', () => {
    try {
      export8bitWorldPainter();
      setStatus('Export 8-bit OK');
    } catch (err) {
      setStatus('Erreur export');
      alert(err.message);
    }
  });

  els.export16.addEventListener('click', () => {
    try {
      exportPseudo16bit();
      setStatus('Export 16-bit packed OK');
    } catch (err) {
      setStatus('Erreur export');
      alert(err.message);
    }
  });
}

registerEvents();
renderStats();
