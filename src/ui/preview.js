import { renderPreview } from '../render/preview-renderer.js';

export function refreshPreview(state) {
  const canvas = document.getElementById('canvas');
  if (!canvas || !state.terrain) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = state.settings.mapSize;
  canvas.height = state.settings.mapSize;
  renderPreview(ctx, state.terrain, state.settings, state.settings.previewMode);
}
