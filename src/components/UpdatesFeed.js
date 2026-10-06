import { html } from '../lib/html.js';
import { int, percent } from '../lib/format.js';
import { candidateFor } from '../data/official.js';

export const hourMinute = value => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function UpdatesFeed({ updates, result }) {
  const candidates = [candidateFor(result, 0), candidateFor(result, 1)];
  return html`<section class="insight">
    <h3>Últimas atualizações</h3>
    ${updates.length
      ? html`<ol class="updates">${updates.map(update => html`<li key=${update.collectedAt}>
          <time>${hourMinute(update.collectedAt)}</time>
          <p class="update-what">
            ${update.sections
              ? html`<b>+${int(update.sections)}</b> ${Math.round(update.sections) === 1 ? 'seção' : 'seções'}`
              : html`<span>${update.note || 'Snapshot oficial consultado'}</span>`}
            ${update.states.map(uf => html`<span class="update-uf" key=${uf}>${uf}</span>`)}
          </p>
          <p class="update-shares">${[0, 1].map(index => html`<span key=${index}>
            <i class=${'swatch tone-' + candidates[index].tone} style=${{ background: candidates[index].color }}></i>${percent(update.shares[index])}
          </span>`)}</p>
        </li>`)}</ol>`
      : html`<p class="empty">Aguardando nova consulta oficial para comparar atualizações.</p>`}
  </section>`;
}
