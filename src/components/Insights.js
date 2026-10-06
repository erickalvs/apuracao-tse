import { html } from '../lib/html.js';
import { blankShare, int, percent } from '../lib/format.js';
import { candidateFor, STATES } from '../data/official.js';
import { TrendChart } from './TrendChart.js';
import { hourMinute, UpdatesFeed } from './UpdatesFeed.js';

function Turnout({ result }) {
  const stats = [
    ['Votos válidos', int(result.valid)],
    ['Comparecimento', percent(result.turnout)],
    ['Abstenção', percent(Math.max(0, 1 - result.turnout))],
    ['Brancos e nulos', percent(blankShare(result))],
    ['Seções apuradas', `${int(result.done)} de ${int(result.sections)}`],
  ];
  return html`<section class="insight">
    <h3>Participação</h3>
    <dl class="stats">${stats.map(([label, value]) => html`<div class="stat" key=${label}><dt>${label}</dt><dd>${value}</dd></div>`)}</dl>
  </section>`;
}

function Flips({ flips, result }) {
  return html`<section class="insight">
    <h3>Viradas</h3>
    ${flips.length
      ? html`<ol class="flips">${flips.map(flip => html`<li key=${flip.uf + flip.collectedAt}>
          <button title="Virada detectada entre snapshots oficiais">
            <time>${hourMinute(flip.collectedAt)}</time>
            <span><b>${STATES[flip.uf][0]}</b> virou para <i class=${'swatch tone-' + candidateFor(result, flip.winner).tone} style=${{ background: candidateFor(result, flip.winner).color }}></i>${candidateFor(result, flip.winner).name}</span>
          </button>
        </li>`)}</ol>`
      : html`<p class="note">Nenhuma virada detectada desde que esta sessão começou a consultar a fonte oficial.</p>`}
  </section>`;
}

function SourceInfo({ result, snapshot }) {
  const source = result.source || snapshot.national.source || {};
  return html`<section class="insight">
    <h3>Fonte</h3>
    <dl class="stats">
      <div class="stat"><dt>Dado oficial</dt><dd>${source.officialGeneratedAt || 'Não disponível'}</dd></div>
      <div class="stat"><dt>Consulta app</dt><dd>${source.collectedAt ? new Date(source.collectedAt).toLocaleString('pt-BR') : 'Não disponível'}</dd></div>
      <div class="stat"><dt>Geração</dt><dd>${source.generationId || 'Não disponível'}</dd></div>
      <div class="stat"><dt>Ambiente</dt><dd>${source.environment || 'oficial'}</dd></div>
    </dl>
  </section>`;
}

export function Insights({ place, result, trend, flips, updates, snapshot }) {
  return html`<div class="insights">
    <${TrendChart} points=${trend} place=${place} result=${result}/>
    <${Turnout} result=${result}/>
    ${flips && html`<${Flips} flips=${flips} result=${result}/>`}
    <${UpdatesFeed} updates=${updates} result=${result}/>
    <${SourceInfo} result=${result} snapshot=${snapshot}/>
  </div>`;
}
