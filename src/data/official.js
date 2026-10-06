import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

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
const FALLBACK_COLORS = ['#2563eb', '#dc2626', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#be123c', '#65a30d', '#c2410c', '#0d9488'];
const MUNICIPAL_CACHE_MS = 30 * 60 * 1000;
const MUNICIPAL_PARALLELISM = 4;
const MUNICIPAL_FORMAT_VERSION = 'compact-v2';

const stepOf = (value, limits) => {
  const step = limits.findIndex(limit => value < limit);
  return step < 0 ? limits.length : step;
};

export function resultColor(result, theme = 'dark', metric = 'lider') {
  if (!result?.available) return MAP_EMPTY[theme];
  if (metric === 'apurado') return completionColors[theme][stepOf(result.completion || 0, COMPLETION_STEPS)];
  if (!result.valid || result.completion < .001) return MAP_EMPTY[theme];
  return candidateFor(result, result.winner || 0).color || FALLBACK_COLORS[0];
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

export function resultSignature(result) {
  return [
    result?.source?.generationId,
    result?.source?.officialGeneratedAt,
    result?.completion,
    result?.votes?.join('-'),
  ].filter(Boolean).join('|');
}

export function snapshotSignature(snapshot) {
  return [
    resultSignature(snapshot.national),
    ...Object.keys(snapshot.states).sort().map(uf => resultSignature(snapshot.states[uf])),
  ].join('::');
}

function sampleFromSnapshot(snapshot) {
  return {
    collectedAt: snapshot.collectedAt || new Date().toISOString(),
    signature: snapshotSignature(snapshot),
    national: snapshot.national,
    states: snapshot.states,
  };
}

function appendSample(previous, snapshot) {
  const samples = previous?.samples || [];
  const sample = sampleFromSnapshot(snapshot);
  if (samples.at(-1)?.signature === sample.signature) return samples;
  return [...samples, sample].slice(-80);
}

function resultForPlace(sample, place, current) {
  if (place.municipality) return current;
  if (place.uf) return sample.states[place.uf] || current;
  return sample.national || current;
}

export function buildOfficialTrend(samples, place, current) {
  const rows = samples
    .map(sample => {
      const result = resultForPlace(sample, place, current);
      if (!result?.available) return null;
      return {
        collectedAt: sample.collectedAt,
        completion: result.completion || 0,
        shares: [
          result.votes[0] / Math.max(1, result.valid),
          result.votes[1] / Math.max(1, result.valid),
        ],
      };
    })
    .filter(Boolean);
  if (current?.available && !rows.some(row => row.completion === current.completion && row.shares[0] === current.votes[0] / Math.max(1, current.valid))) {
    rows.push({
      collectedAt: current.source?.collectedAt || new Date().toISOString(),
      completion: current.completion || 0,
      shares: [
        current.votes[0] / Math.max(1, current.valid),
        current.votes[1] / Math.max(1, current.valid),
      ],
    });
  }
  return rows;
}

export function recentOfficialUpdates(samples, current, { national = false } = {}) {
  const updates = [];
  for (let i = samples.length - 1; i > 0 && updates.length < 7; i--) {
    const now = national ? samples[i].national : current;
    const before = national ? samples[i - 1].national : null;
    if (!now?.available || (national && !before?.available)) continue;
    const sections = national ? Math.max(0, (now.done || 0) - (before.done || 0)) : 0;
    updates.push({
      collectedAt: samples[i].collectedAt,
      sections,
      states: [],
      shares: [
        now.votes[0] / Math.max(1, now.valid),
        now.votes[1] / Math.max(1, now.valid),
      ],
      note: sections ? null : 'Snapshot oficial consultado; sem diferença de seções desde o ponto anterior.',
    });
  }
  return updates;
}

export function officialFlips(samples, currentStates) {
  const flips = [];
  for (let i = 1; i < samples.length; i++) {
    for (const uf of STATE_CODES) {
      const before = samples[i - 1].states[uf];
      const after = samples[i].states[uf];
      if (before?.available && after?.available && before.winner !== after.winner) {
        flips.push({ collectedAt: samples[i].collectedAt, uf, winner: after.winner });
      }
    }
  }
  if (!flips.length && currentStates) return [];
  return flips.reverse();
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
    samples: [],
    loadedUfs: new Set(),
    loadingMunicipalities: null,
    municipalitiesLoaded: false,
  };
}

function applyMunicipalityPayload(snapshot, geo, municipalityPayload) {
  for (const row of municipalityPayload?.municipalities || []) {
    const municipality = geo.byId.get(String(row.ibgeCode));
    if (!municipality) continue;
    snapshot.results.set(municipality.id, {
      ...row.result,
      id: municipality.id,
      name: municipality.name,
      uf: municipality.uf,
      tseCode: row.tseCode,
    });
  }
}

function hydrateSnapshot(geo, office, payload, municipalityPayloads, selectedMunicipality, selectedResult, previous) {
  const snapshot = baseSnapshot(geo, office);
  snapshot.loading = false;
  snapshot.collectedAt = payload.collectedAt;
  snapshot.loadedUfs = new Set(previous?.loadedUfs || []);
  snapshot.loadingMunicipalities = previous?.loadingMunicipalities || null;
  snapshot.municipalitiesLoaded = snapshot.loadedUfs.size >= STATE_CODES.length;
  snapshot.national = payload.national || snapshot.national;
  for (const [uf, result] of Object.entries(payload.states || {})) {
    snapshot.states[uf] = { ...result, name: STATES[uf]?.[0] || uf };
  }
  if (previous?.results) {
    for (const municipality of geo.municipalities) {
      const previousResult = previous.results.get(municipality.id);
      if (previousResult?.available) snapshot.results.set(municipality.id, previousResult);
    }
  }
  for (const municipalityPayload of municipalityPayloads || []) applyMunicipalityPayload(snapshot, geo, municipalityPayload);
  if (selectedMunicipality && selectedResult) {
    snapshot.results.set(selectedMunicipality.id, { ...selectedResult, id: selectedMunicipality.id, name: selectedMunicipality.name, uf: selectedMunicipality.uf });
  }
  snapshot.samples = appendSample(previous, snapshot);
  return snapshot;
}

export function useOfficialSnapshot(geo, office, uf, municipality) {
  const [state, setState] = useState(() => baseSnapshot(geo, office));
  const municipalCache = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    const cancelled = () => controller.signal.aborted;
    const municipalKey = code => `${office}:${code.toLowerCase()}`;
    const getMunicipalPayload = async code => {
      const key = municipalKey(code);
      const cached = municipalCache.current.get(key);
      if (cached && Date.now() - cached.at < MUNICIPAL_CACHE_MS) return cached.payload;
      const payload = await getJson(`/api/municipalities-results?office=${encodeURIComponent(office)}&uf=${code.toLowerCase()}&format=${MUNICIPAL_FORMAT_VERSION}`, controller.signal);
      municipalCache.current.set(key, { at: Date.now(), payload });
      return payload;
    };
    setState(baseSnapshot(geo, office));
    const run = async () => {
      try {
        const payload = await getJson(`/api/snapshot?office=${encodeURIComponent(office)}`, controller.signal);
        let selectedResult = null;
        if (municipality) {
          const selectedUf = municipality.uf.toLowerCase();
          const detail = await getJson(`/api/result?office=${encodeURIComponent(office)}&uf=${selectedUf}&ibge=${municipality.id}`, controller.signal);
          selectedResult = detail.result;
        }
        setState(previous => hydrateSnapshot(geo, office, payload, [], municipality, selectedResult, previous.office === office ? previous : null));
      } catch (error) {
        if (error.name === 'AbortError') return;
        setState(current => ({ ...current, loading: false, error: error.message || 'Erro ao consultar a fonte oficial.' }));
      }
    };
    run();
    (async () => {
      const priority = uf ? [uf, ...STATE_CODES.filter(code => code !== uf)] : STATE_CODES;
      let nextIndex = 0;
      const workers = Array.from({ length: Math.min(MUNICIPAL_PARALLELISM, priority.length) }, async () => {
        while (!cancelled() && nextIndex < priority.length) {
          const code = priority[nextIndex++];
          try {
            setState(previous => {
              if (previous.office !== office) return previous;
              return { ...previous, loadingMunicipalities: code };
            });
            const payload = await getMunicipalPayload(code);
            if (cancelled()) return;
            setState(previous => {
              if (previous.office !== office) return previous;
              const loadedUfs = new Set(previous.loadedUfs || []);
              loadedUfs.add(code);
              const selectedFullResult = municipality ? previous.results.get(municipality.id) : null;
              const next = {
                ...previous,
                results: new Map(previous.results),
                loadedUfs,
                loadingMunicipalities: code,
                municipalitiesLoaded: loadedUfs.size >= STATE_CODES.length,
              };
              applyMunicipalityPayload(next, geo, payload);
              if (selectedFullResult?.available && !selectedFullResult.compact) {
                next.results.set(municipality.id, selectedFullResult);
              }
              return next;
            });
          } catch (error) {
            if (error.name === 'AbortError') return;
          }
        }
      });
      await Promise.all(workers);
      if (!cancelled()) setState(previous => previous.office === office ? { ...previous, loadingMunicipalities: null, municipalitiesLoaded: true } : previous);
    })();
    const timer = setInterval(run, 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [geo, office, uf, municipality?.id]);

  return useMemo(() => state, [state]);
}
