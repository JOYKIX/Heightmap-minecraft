import { renderPreview } from '../render/preview-renderer.js';

export function refreshPreview(state, overrideCtx = null, overrideCanvas = null) {
  const canvas = overrideCanvas ?? document.getElementById('canvas');
  if (!canvas || !state.terrain) return;
  const ctx = overrideCtx ?? canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  if (!overrideCanvas) {
    canvas.width = state.settings.mapSize;
    canvas.height = state.settings.mapSize;
  }
  renderPreview(ctx, state.terrain, state.settings, state.settings.previewMode);
}
