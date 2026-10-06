import { useEffect, useMemo, useState } from 'preact/hooks';

export const STATES = {
  RO: ['Rondônia', 0, 'Norte'], AC: ['Acre', 0, 'Norte'], AM: ['Amazonas', 0, 'Norte'],
  RR: ['Roraima', 0, 'Norte'], PA: ['Pará', 0, 'Norte'], AP: ['Amapá', 0, 'Norte'],
  TO: ['Tocantins', 0, 'Norte'], MA: ['Maranhão', 0, 'Nordeste'], PI: ['Piauí', 0, 'Nordeste'],
  CE: ['Ceará', 0, 'Nordeste'], RN: ['Rio Grande do Norte', 0, 'Nordeste'],
  PB: ['Paraíba', 0, 'Nordeste'], PE: ['Pernambuco', 0, 'Nordeste'],
  AL: ['Alagoas', 0, 'Nordeste'], SE: ['Sergipe', 0, 'Nordeste'], BA: ['Bahia', 0, 'Nordeste'],
  MG: ['Minas Gerais', 0, 'Sudeste'], ES: ['Espírito Santo', 0, 'Sudeste'],
  RJ: ['Rio de Janeiro', 0, 'Sudeste'], SP: ['São Paulo', 0, 'Sudeste'],
  PR: ['Paraná', 0, 'Sul'], SC: ['Santa Catarina', 0, 'Sul'], RS: ['Rio Grande do Sul', 0, 'Sul'],
  MS: ['Mato Grosso do Sul', 0, 'Centro-Oeste'], MT: ['Mato Grosso', 0, 'Centro-Oeste'],
  GO: ['Goiás', 0, 'Centro-Oeste'], DF: ['Distrito Federal', 0, 'Centro-Oeste'],
};

export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
export const OFFICES = ['Presidente', 'Governador', 'Senado', 'Deputado federal', 'Deputado estadual', 'Deputado distrital'];

export const CANDIDATES = [
  { name: '1º colocado', party: '', number: '', tone: 'blue', color: '#4162e2', photo: null },
  { name: '2º colocado', party: '', number: '', tone: 'red', color: '#ee2d35', photo: null },
  { name: 'Outros candidatos', party: '', number: '', tone: 'other', color: '#8c8577', photo: null },
];

const STATE_CODES = Object.keys(STATES);
const MAP_BASE = { dark: '#1b1d22', light: '#e6e8ee' };
const MAP_EMPTY = { dark: '#272a30', light: '#dcdfe6' };
export const MARGIN_STEPS = [.1, .25, .45];
export const COMPLETION_STEPS = [.4, .7, .9, .99];
const marginColors = {
  dark: [['#263968', '#324c94', '#3c5dc4', '#4162e2'], ['#69292d', '#993136', '#cf3339', '#ee2d35']],
  light: [['#b9c4f5', '#879ae9', '#5e79e3', '#4162e2'], ['#f2b9bc', '#eb858a', '#e65359', '#ee2d35']],
};
const completionColors = {
  dark: ['#272a30', '#5a4931', '#866831', '#bd8f39', '#f0bd4f'],
  light: ['#dcdfe6', '#c9bea7', '#b29a67', '#97753a', '#7a4d00'],
};
export const marginPalette = (theme = 'dark') => marginColors[theme];
export const completionPalette = (theme = 'dark') => completionColors[theme];

const stepOf = (value, limits) => {
  const step = limits.findIndex(limit => value < limit);
  return step < 0 ? limits.length : step;
};

export function resultColor(result, theme = 'dark', metric = 'lider') {
  if (!result?.available) return MAP_EMPTY[theme];
  if (metric === 'apurado') return completionColors[theme][stepOf(result.completion || 0, COMPLETION_STEPS)];
  if (!result.valid || result.completion < .001) return MAP_EMPTY[theme];
  const margin = Math.abs((result.votes[0] || 0) - (result.votes[1] || 0)) / Math.max(1, result.valid);
  return marginColors[theme][result.winner || 0][stepOf(margin, MARGIN_STEPS)];
}

export function candidateFor(result, index) {
  return result?.candidates?.[index] || CANDIDATES[index] || CANDIDATES[2];
}

export function emptyResult({ id, name, uf, message = 'Não disponível na fonte oficial.' }) {
  return {
    available: false,
    message,
    id,
    name,
    uf,
    electorate: 0,
    cast: 0,
    blank: 0,
    nulls: 0,
    valid: 0,
    sections: 0,
    done: 0,
    completion: 0,
    turnout: 0,
    votes: [0, 0, 0],
    winner: 0,
    candidates: CANDIDATES,
  };
}

export function aggregate(results) {
  const total = emptyResult({ id: 'aggregate', name: 'Agregado oficial' });
  total.available = results.some(result => result?.available);
  total.message = total.available ? null : 'Não disponível na fonte oficial.';
  for (const result of results) {
    if (!result?.available) continue;
    for (const key of ['electorate', 'cast', 'blank', 'nulls', 'valid', 'sections']) total[key] += result[key] || 0;
    total.done += result.done || 0;
    result.votes.forEach((value, index) => total.votes[index] += value || 0);
  }
  total.completion = total.sections ? total.done / total.sections : 0;
  total.turnout = total.electorate && total.completion ? total.cast / total.electorate / total.completion : 0;
  total.winner = total.votes[1] > total.votes[0] ? 1 : 0;
  total.candidates = CANDIDATES;
  return total;
}

async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function baseSnapshot(geo, office) {
  const states = {};
  const results = new Map();
  for (const uf of STATE_CODES) {
    states[uf] = emptyResult({ id: uf, name: STATES[uf][0], uf });
  }
  for (const municipality of geo.municipalities) {
    results.set(municipality.id, emptyResult({
      id: municipality.id,
      name: municipality.name,
      uf: municipality.uf,
      message: 'Selecione o município para consultar o arquivo oficial.',
    }));
  }
  return {
    office,
    loading: true,
    error: null,
    results,
    states,
    national: emptyResult({ id: 'br', name: 'Brasil' }),
    collectedAt: null,
  };
}

function hydrateSnapshot(geo, office, payload, selectedMunicipality, selectedResult) {
  const snapshot = baseSnapshot(geo, office);
  snapshot.loading = false;
  snapshot.collectedAt = payload.collectedAt;
  snapshot.national = payload.national || snapshot.national;
  for (const [uf, result] of Object.entries(payload.states || {})) {
    snapshot.states[uf] = { ...result, name: STATES[uf]?.[0] || uf };
  }
  if (selectedMunicipality && selectedResult) {
    snapshot.results.set(selectedMunicipality.id, { ...selectedResult, id: selectedMunicipality.id, name: selectedMunicipality.name, uf: selectedMunicipality.uf });
  }
  return snapshot;
}

export function useOfficialSnapshot(geo, office, municipality) {
  const [state, setState] = useState(() => baseSnapshot(geo, office));

  useEffect(() => {
    const controller = new AbortController();
    setState(baseSnapshot(geo, office));
    const run = async () => {
      try {
        const payload = await getJson(`/api/snapshot?office=${encodeURIComponent(office)}`, controller.signal);
        let selectedResult = null;
        if (municipality) {
          const uf = municipality.uf.toLowerCase();
          const detail = await getJson(`/api/result?office=${encodeURIComponent(office)}&uf=${uf}&ibge=${municipality.id}`, controller.signal);
          selectedResult = detail.result;
        }
        setState(hydrateSnapshot(geo, office, payload, municipality, selectedResult));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setState(current => ({ ...current, loading: false, error: error.message || 'Erro ao consultar a fonte oficial.' }));
      }
    };
    run();
    const timer = setInterval(run, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [geo, office, municipality?.id]);

  return useMemo(() => state, [state]);
}
