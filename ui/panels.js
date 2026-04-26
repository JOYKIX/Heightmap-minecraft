export function pageScaffold({ title, description, controls = '', preview = '', side = '' }) {
  return `
    <section class="page-header">
      <h1>${title}</h1>
      <p class="muted">${description}</p>
    </section>
    <section class="panel">${controls}</section>
    <section class="panel">${preview}</section>
    <section class="panel">${side}</section>
  `;
}
