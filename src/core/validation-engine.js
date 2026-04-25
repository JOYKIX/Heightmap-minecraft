export function validateSettings(settings) {
  const errors = [];
  if (settings.minY >= settings.maxY) errors.push('minY doit être inférieur à maxY.');
  if (settings.mapSize < 128 || settings.mapSize > 4096) errors.push('mapSize doit rester entre 128 et 4096.');
  if (!Number.isFinite(settings.riverIntensity)) errors.push('riverIntensity invalide.');
  if (!Number.isFinite(settings.erosionStrength)) errors.push('erosionStrength invalide.');
  return { ok: errors.length === 0, errors };
}
