import { downloadBlob } from '../js/utils.js';

export function exportHeightmapJson(payload, filename = 'heightmap.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}
