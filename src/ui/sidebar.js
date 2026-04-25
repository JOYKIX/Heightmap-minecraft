import { BIOME_PRESETS } from '../config/biome-profiles.js';
import { WORLD_TYPES } from '../config/constants.js';

export function populateSidebar() {
  const worldType = document.getElementById('world-type');
  const biomePreset = document.getElementById('biome-preset');

  Object.entries(WORLD_TYPES).forEach(([id, value]) => {
    worldType.append(new Option(value.label, id));
  });
  Object.entries(BIOME_PRESETS).forEach(([id, value]) => {
    biomePreset.append(new Option(value.label, id));
  });
}
