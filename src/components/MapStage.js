import { useMemo } from 'preact/hooks';
import { html } from '../lib/html.js';
import { candidateFor, STATES } from '../data/official.js';
import { ElectionMap } from '../map/ElectionMap.js';
import { BackButton } from './BackButton.js';
import { Legend } from './Legend.js';
import { MapModes } from './MapModes.js';

function tally(results) {
  const sides = [0, 1].map(() => ({ places: 0, electorate: 0 }));
  let electorate = 0;
  for (const result of results) {
    if (!result?.available) continue;
    electorate += result.electorate || 0;
    sides[result.winner || 0].places += 1;
    sides[result.winner || 0].electorate += result.electorate || 0;
  }
  return sides.map(side => ({ places: side.places, electorateShare: electorate ? side.electorate / electorate : 0 }));
}

function partyTally(results) {
  const map = new Map();
  for (const result of results) {
    if (!result?.available) continue;
    const leader = candidateFor(result, result.winner || 0);
    const key = leader.party || leader.name;
    const entry = map.get(key) || { label: key, color: leader.color, places: 0 };
    entry.places += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.places - a.places).slice(0, 10);
}

function placeResult(snapshot, municipality) {
  const municipal = snapshot.results.get(municipality.id);
  return municipal?.available ? municipal : snapshot.states[municipality.uf];
}

function mapView({ geo, snapshot, route, municipality, zoneRows }) {
  const { uf } = route;
  if (municipality) {
    return zoneRows?.length
      ? { rows: zoneRows, noun: 'zonas', units: [], unit: 'municipios', hint: 'Recorte por zona ainda não integrado aos arquivos oficiais.' }
      : { rows: [snapshot.results.get(municipality.id)], noun: 'município', units: ['municipios', 'eleitorado'], unit: route.unit, hint: 'Resultado municipal consultado sob demanda na fonte oficial.' };
  }
  if (uf) {
    return {
      rows: geo.states[uf].municipalities.map(m => placeResult(snapshot, m)),
      noun: 'municípios',
      units: ['municipios', 'eleitorado'],
      unit: route.unit,
      hint: 'Clique em um município para consultar o arquivo oficial correspondente.',
    };
  }
  const byState = route.unit === 'estados';
  return {
    rows: byState ? Object.values(snapshot.states) : geo.municipalities.map(m => placeResult(snapshot, m)),
    noun: byState ? 'estados' : 'municípios',
    units: ['estados', 'municipios', 'eleitorado'],
    unit: route.unit,
    hint: 'Clique em um estado para ver os resultados oficiais por UF.',
  };
}

export function MapStage({ stageRef, geo, snapshot, route, municipality, zoneRows, theme, flipped }) {
  const { uf } = route;
  const view = useMemo(() => mapView({ geo, snapshot, route, municipality, zoneRows }), [geo, snapshot, uf, municipality, zoneRows, route.unit]);
  const sides = useMemo(() => tally(view.rows), [view]);
  const parties = useMemo(() => partyTally(view.rows), [view]);
  const unit = view.units.includes(view.unit) ? view.unit : 'municipios';

  return html`<section class="stage" ref=${stageRef} aria-label="Mapa interativo">
    <header class="stage-head">
      <div class="stage-place">
        ${uf && html`<${BackButton} to=${municipality ? STATES[uf][0] : 'Brasil'} article=${municipality ? '' : 'o '} onClick=${route.back}/>`}
        <h2 class="stage-title">${municipality?.name || (uf ? STATES[uf][0] : 'Brasil')}${municipality && html`<span>${STATES[uf][0]}</span>`}</h2>
        <p class="stage-hint">${snapshot.loading ? 'Consultando arquivos oficiais do TSE...' : view.hint}</p>
      </div>
      <${MapModes} units=${view.units} unit=${unit} metric=${route.metric} onUnit=${route.setUnit} onMetric=${route.setMetric}/>
    </header>

    <div class="map-area">
      <${ElectionMap} geo=${geo} theme=${theme} unit=${unit} metric=${route.metric} flipped=${flipped}
        results=${snapshot.results} stateResults=${snapshot.states}
        uf=${uf} municipality=${municipality} zoneRows=${zoneRows} selectedZone=${route.zone}
        onState=${route.openState} onMunicipality=${route.openMunicipality} onZone=${route.selectZone}/>
    </div>

    <${Legend} theme=${theme} metric=${route.metric} bubbles=${unit === 'eleitorado'} tally=${sides} parties=${parties} noun=${view.noun}/>
  </section>`;
}
