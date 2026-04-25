export function notify(message, level = 'info') {
  const banner = document.getElementById('pipeline-step');
  if (!banner) return;
  banner.textContent = message;
  banner.dataset.level = level;
}
