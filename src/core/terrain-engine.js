import { hashSeed } from '../utils/random.js';
import { Profiler } from '../utils/profiler.js';
import { QUALITY_PROFILE } from '../config/constants.js';
import { runTerrainPipeline } from './terrain-pipeline.js';
import { validateSettings } from './validation-engine.js';

export function generateTerrain(settings, onProgress) {
  const validation = validateSettings(settings);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' | '));
  }

  const profiler = new Profiler(settings.debug);
  settings.qualityProfile = QUALITY_PROFILE[settings.quality] ?? QUALITY_PROFILE.balanced;
  const seedValue = hashSeed(settings.seed);
  const payload = runTerrainPipeline(settings, seedValue, profiler, onProgress);

  return {
    ...payload,
    profile: profiler.report({
      seed: settings.seed,
      mapSize: settings.mapSize
    })
  };
}
