export const html = (strings, ...vals) => strings.map((s, i) => s + (vals[i] ?? '')).join('');

export function navItem(href, label, active) {
  return `<a href="#/${href}" class="${active ? 'active' : ''}">${label}</a>`;
}

export function statList(entries) {
  return `<ul class="stats">${entries.map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('')}</ul>`;
}
