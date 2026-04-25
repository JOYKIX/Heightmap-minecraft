export function readConfigFromUi(baseConfig) {
  const seed = document.getElementById('seedInput').value || baseConfig.seed;
  const size = Number(document.getElementById('sizeSelect').value);
  const landCoverage = Number(document.getElementById('landCoverage').value);
  const border = document.getElementById('oceanBorder').value;
  const riverAmount = document.getElementById('riverAmount').value;
  const preset = document.getElementById('presetSelect').value;

  return {
    ...baseConfig,
    seed,
    width: size,
    height: size,
    landCoverage,
    oceanBorder: border,
    riverAmount,
    preset
  };
}

export function setStatus(text) {
  document.getElementById('statusText').textContent = text;
}

export function randomSeed() {
  const value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  document.getElementById('seedInput').value = value;
}
