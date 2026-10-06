import { html } from '../lib/html.js';
import { int } from '../lib/format.js';
import { COMPLETION_STEPS, completionPalette } from '../data/official.js';

const pts = ratio => String(+(ratio * 100).toFixed(1)).replace('.', ',');

const Ramp = ({ colors }) => html`<span class="legend-ramp">${colors.map(color => html`<i key=${color} style=${{ background: color }}></i>`)}</span>`;

export function Legend({ theme, metric, bubbles, parties = [], noun }) {
  return html`<div class="legend">
    ${metric === 'apurado'
      ? html`<span class="legend-scale"><${Ramp} colors=${completionPalette(theme)}/>seções apuradas: até ${COMPLETION_STEPS.map(pts).join(' · ')} · mais (%)</span>`
      : html`
        ${parties.map(item => html`<span class="legend-side" key=${item.label}>
          <i class="swatch" style=${{ background: item.color }}></i>
          <b>${item.label}</b> lidera em ${int(item.places)} ${noun}
        </span>`)}
        <span class="legend-scale">Cores por partido do líder no recorte.</span>`}
    ${bubbles && html`<span class="legend-scale"><i class="legend-bubble"></i>área do círculo = eleitorado</span>`}
  </div>`;
}
