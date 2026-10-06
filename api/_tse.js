const OFFICIAL_BASE = process.env.TSE_OFFICIAL_BASE || 'https://resultados.tse.jus.br/oficial';
const ADAPTER_VERSION = 'ea20-2026-open-apuracao-v1';

export const UFS = ['ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to'];

export const OFFICES = {
  Presidente: { electionId: '6257', officeCode: '1', scopes: ['br', 'uf', 'municipality'] },
  Governador: { electionId: '6259', officeCode: '3', scopes: ['uf', 'municipality'] },
  Senado: { electionId: '6259', officeCode: '5', scopes: ['uf', 'municipality'] },
  'Deputado federal': { electionId: '6259', officeCode: '6', scopes: ['uf', 'municipality'] },
  'Deputado estadual': { electionId: '6259', officeCode: '7', scopes: ['uf', 'municipality'], exceptUf: ['df'] },
  'Deputado distrital': { electionId: '6259', officeCode: '8', scopes: ['uf', 'municipality'], onlyUf: ['df'] },
};

const officeByCode = Object.fromEntries(Object.entries(OFFICES).map(([name, config]) => [`${config.electionId}:${config.officeCode}`, { ...config, name }]));
const memory = new Map();
const TTL = Number(process.env.CACHE_TTL_MS || 25000);

const padElection = id => String(id).padStart(6, '0');
const padOffice = code => String(code).padStart(4, '0');
const parseNumber = value => {
  if (value == null || value === '') return 0;
  const parsed = Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const parsePercent = value => parseNumber(value) / 100;
const nowIso = () => new Date().toISOString();

export function officeFromQuery(query) {
  if (query.office && OFFICES[query.office]) return { name: query.office, ...OFFICES[query.office] };
  const byCode = officeByCode[`${query.electionId}:${query.officeCode}`];
  if (byCode) return byCode;
  throw Object.assign(new Error('Cargo nao suportado'), { status: 422 });
}

export function officeAllowedForUf(office, uf) {
  if (office.onlyUf && !office.onlyUf.includes(uf)) return false;
  if (office.exceptUf && office.exceptUf.includes(uf)) return false;
  return true;
}

function resultUrl({ electionId, officeCode, uf, municipality }) {
  const cycle = electionId === '6257' || electionId === '6259' ? 'ele2026' : `ele${electionId}`;
  const scope = (uf || 'br').toLowerCase();
  const prefix = municipality ? `${scope}${String(municipality).padStart(5, '0')}` : scope;
  return `${OFFICIAL_BASE}/${cycle}/${electionId}/dados/${scope}/${prefix}-c${padOffice(officeCode)}-e${padElection(electionId)}-u.json`;
}

function municipalitiesUrl(electionId) {
  return `${OFFICIAL_BASE}/ele2026/${electionId}/config/mun-e${padElection(electionId)}-cm.json`;
}

async function fetchJson(url) {
  const cached = memory.get(url);
  if (cached && cached.expires > Date.now()) return cached.value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const headers = {};
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;
    const response = await fetch(url, { headers, signal: controller.signal });
    if (response.status === 304 && cached?.value) {
      cached.expires = Date.now() + TTL;
      return cached.value;
    }
    if (!response.ok) throw Object.assign(new Error(`Fonte oficial respondeu HTTP ${response.status}`), { status: response.status });
    const value = await response.json();
    memory.set(url, {
      value,
      expires: Date.now() + TTL,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

export async function municipalityCodeFromIbge(electionId, uf, ibgeCode) {
  if (!ibgeCode) return null;
  const raw = await fetchJson(municipalitiesUrl(electionId));
  const blocks = Array.isArray(raw?.abr) ? raw.abr : [];
  for (const block of blocks) {
    if (String(block.cd || '').toLowerCase() !== uf) continue;
    for (const item of block.mu || []) {
      if (String(item.cdi || '') === String(ibgeCode)) return String(item.cd || '');
    }
  }
  return null;
}

export async function municipalitiesForUf(electionId, uf) {
  const raw = await fetchJson(municipalitiesUrl(electionId));
  const blocks = Array.isArray(raw?.abr) ? raw.abr : [];
  const block = blocks.find(item => String(item.cd || '').toLowerCase() === uf);
  return (block?.mu || [])
    .map(item => ({
      tseCode: String(item.cd || ''),
      ibgeCode: String(item.cdi || ''),
      name: String(item.nm || ''),
      uf,
    }))
    .filter(item => item.tseCode && item.ibgeCode);
}

function officialDate(date, time) {
  return date && time ? `${date} ${time}` : null;
}

function unavailable({ office, uf, municipality, url, message }) {
  return {
    available: false,
    message,
    id: municipality || uf || 'br',
    name: uf ? uf.toUpperCase() : 'Brasil',
    uf: uf?.toUpperCase(),
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
    candidates: [],
    office: office.name,
    source: { url, environment: 'oficial', collectedAt: nowIso(), adapterVersion: ADAPTER_VERSION },
  };
}

export async function officialResult({ office, uf, municipality }) {
  const targetUf = uf?.toLowerCase();
  if (!office.scopes.includes('br') && !targetUf) {
    return unavailable({ office, message: 'Este cargo tem abrangencia estadual. Selecione uma UF.' });
  }
  if (targetUf && !officeAllowedForUf(office, targetUf)) {
    return unavailable({ office, uf: targetUf, municipality, message: 'Cargo incompativel com a UF selecionada.' });
  }
  const url = resultUrl({ ...office, uf: targetUf, municipality });
  try {
    const raw = await fetchJson(url);
    return normalizeResult(raw, { office, uf: targetUf, municipality, url });
  } catch (error) {
    const status = error?.status;
    return unavailable({
      office,
      uf: targetUf,
      municipality,
      url,
      message: status === 404 ? 'Nao disponivel na fonte oficial para este recorte.' : (error.message || 'Fonte oficial indisponivel.'),
    });
  }
}

export function normalizeResult(raw, { office, uf, municipality, url }) {
  const cargo = raw?.carg?.[0] || {};
  const candidates = [];
  for (const group of cargo.agr || []) {
    for (const party of group.par || []) {
      for (const cand of party.cand || []) {
        candidates.push({
          name: String(cand.nmu || cand.nm || ''),
          fullName: String(cand.nm || ''),
          number: String(cand.n || ''),
          party: String(party.sg || ''),
          coalition: String(group.com || group.nm || ''),
          votes: parseNumber(cand.vap),
          percent: parsePercent(cand.pvapn || cand.pvap),
          status: String(cand.st || (cand.e === 's' ? 'Eleito' : '')),
          elected: cand.e === 's',
        });
      }
    }
  }
  candidates.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, 'pt-BR'));
  const top = candidates.slice(0, 2);
  const otherVotes = Math.max(0, candidates.slice(2).reduce((sum, item) => sum + item.votes, 0));
  const sections = parseNumber(raw?.s?.ts);
  const completion = parsePercent(raw?.s?.pstn || raw?.s?.pst);
  const cast = parseNumber(raw?.v?.tv || raw?.e?.c);
  const valid = parseNumber(raw?.v?.vv);
  const blank = parseNumber(raw?.v?.vb);
  const nulls = parseNumber(raw?.v?.vn);
  const electorate = parseNumber(raw?.e?.te);
  const votes = [top[0]?.votes || 0, top[1]?.votes || 0, otherVotes];
  const winner = votes[1] > votes[0] ? 1 : 0;
  const coloredTop = top.map(withPartyColor);
  return {
    available: true,
    id: municipality || raw?.cdabr || uf || 'br',
    name: raw?.cdabr === 'br' ? 'Brasil' : (uf ? uf.toUpperCase() : 'Brasil'),
    uf: uf?.toUpperCase(),
    electorate,
    cast,
    blank,
    nulls,
    valid,
    sections,
    done: sections * completion,
    completion,
    turnout: electorate && completion ? cast / electorate / Math.max(completion, 0.000001) : 0,
    votes,
    winner,
    candidates: [
      { ...(coloredTop[0] || withPartyColor({ name: 'Nao disponivel', party: '', number: '' })), tone: 'blue' },
      { ...(coloredTop[1] || withPartyColor({ name: 'Nao disponivel', party: '', number: '' })), tone: 'red' },
      { name: 'Outros candidatos', party: '', number: '', votes: otherVotes, tone: 'other', color: '#8c8577' },
    ],
    allCandidates: candidates.map(withPartyColor),
    office: office.name,
    countingStatus: raw?.and === 'f' ? 'final' : raw?.and === 'p' ? 'partial' : 'unknown',
    source: {
      url,
      environment: 'oficial',
      collectedAt: nowIso(),
      officialGeneratedAt: officialDate(raw?.dg, raw?.hg),
      officialTotalizedAt: officialDate(raw?.dt, raw?.ht),
      generationId: raw?.idg || null,
      adapterVersion: ADAPTER_VERSION,
    },
  };
}

const PARTY_COLORS = {
  PL: '#2563eb',
  PT: '#dc2626',
  REPUBLICANOS: '#be123c',
  PSD: '#0891b2',
  MDB: '#059669',
  PP: '#65a30d',
  UNIÃO: '#c2410c',
  PSB: '#f59e0b',
  PDT: '#7c3aed',
  AVANTE: '#9333ea',
  NOVO: '#f97316',
  UP: '#b91c1c',
  PSTU: '#991b1b',
  PCB: '#7f1d1d',
  PCO: '#a16207',
  DC: '#0d9488',
  MISSÃO: '#4f46e5',
  DEMOCRATA: '#64748b',
};
const FALLBACK_COLORS = ['#2563eb', '#dc2626', '#059669', '#f59e0b', '#7c3aed', '#0891b2', '#be123c', '#65a30d', '#c2410c', '#0d9488'];

function hashText(value) {
  let h = 2166136261;
  for (const char of String(value || '')) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function colorForParty(party) {
  const key = String(party || '').toUpperCase();
  return PARTY_COLORS[key] || FALLBACK_COLORS[hashText(key) % FALLBACK_COLORS.length];
}

function withPartyColor(candidate) {
  return { ...candidate, color: colorForParty(candidate.party) };
}
