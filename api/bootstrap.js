import { municipalitiesForUf, officeAllowedForUf, officeFromQuery, officialResult, UFS } from './_tse.js';

export const config = { maxDuration: 60 };

const CACHE = new Map();
const BOOTSTRAP_TTL_MS = Number(process.env.TSE_BOOTSTRAP_CACHE_MS || 120000);

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function emptyNational(office) {
  return {
    available: false,
    message: 'Este cargo tem abrangencia estadual. Selecione uma UF.',
    id: 'br',
    name: 'Brasil',
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
    source: { environment: 'oficial', collectedAt: new Date().toISOString(), adapterVersion: 'ea20-2026-open-apuracao-v1' },
  };
}

function compactResult(result) {
  if (!result?.available) return result;
  return {
    ...result,
    allCandidates: (result.allCandidates || []).slice(0, 12),
    compact: true,
  };
}

async function municipalityRows(office, uf) {
  const municipalities = await municipalitiesForUf(office.electionId, uf);
  return mapLimit(municipalities, Number(process.env.TSE_MUNICIPAL_CONCURRENCY || 24), async municipality => {
    const result = await officialResult({ office, uf, municipality: municipality.tseCode });
    return {
      ibgeCode: municipality.ibgeCode,
      tseCode: municipality.tseCode,
      name: municipality.name,
      result: compactResult(result),
    };
  });
}

async function buildBootstrap(office) {
  const states = {};
  const municipalitiesByUf = {};
  const national = office.scopes.includes('br') ? await officialResult({ office }) : emptyNational(office);
  const ufs = UFS.filter(uf => officeAllowedForUf(office, uf));

  await Promise.all(ufs.map(async uf => {
    states[uf.toUpperCase()] = await officialResult({ office, uf });
  }));

  await mapLimit(ufs, Number(process.env.TSE_BOOTSTRAP_UF_CONCURRENCY || 4), async uf => {
    municipalitiesByUf[uf.toUpperCase()] = {
      uf: uf.toUpperCase(),
      office: office.name,
      municipalities: await municipalityRows(office, uf),
      collectedAt: new Date().toISOString(),
    };
  });

  return {
    office: office.name,
    national,
    states,
    municipalitiesByUf,
    collectedAt: new Date().toISOString(),
  };
}

export default async function handler(request, response) {
  try {
    const query = Object.fromEntries(new URL(request.url, 'http://localhost').searchParams);
    const office = officeFromQuery(query);
    const key = `${office.name}:${query.format || 'default'}`;
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.at < BOOTSTRAP_TTL_MS) {
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 's-maxage=120, stale-while-revalidate=600');
      response.statusCode = 200;
      response.end(JSON.stringify(cached.payload));
      return;
    }

    const payload = await buildBootstrap(office);
    CACHE.set(key, { at: Date.now(), payload });
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 's-maxage=120, stale-while-revalidate=600');
    response.statusCode = 200;
    response.end(JSON.stringify(payload));
  } catch (error) {
    response.statusCode = error.status || 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Nao disponivel na fonte', detail: error.message }));
  }
}
