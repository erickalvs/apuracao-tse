import { municipalitiesForUf, officeFromQuery, officialResult } from './_tse.js';

export const config = { maxDuration: 60 };

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

function compactResult(result) {
  if (!result?.available) return result;
  return {
    ...result,
    allCandidates: (result.allCandidates || []).slice(0, 12),
    compact: true,
  };
}

export default async function handler(request, response) {
  try {
    const query = Object.fromEntries(new URL(request.url, 'http://localhost').searchParams);
    const office = officeFromQuery(query);
    const uf = String(query.uf || '').toLowerCase();
    if (!uf || uf.length !== 2) throw Object.assign(new Error('UF obrigatoria'), { status: 422 });
    const municipalities = await municipalitiesForUf(office.electionId, uf);
    const rows = await mapLimit(municipalities, Number(process.env.TSE_MUNICIPAL_CONCURRENCY || 24), async municipality => {
      const result = await officialResult({ office, uf, municipality: municipality.tseCode });
      return {
        ibgeCode: municipality.ibgeCode,
        tseCode: municipality.tseCode,
        name: municipality.name,
        result: compactResult(result),
      };
    });
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 's-maxage=120, stale-while-revalidate=600');
    response.statusCode = 200;
    response.end(JSON.stringify({ uf: uf.toUpperCase(), office: office.name, municipalities: rows, collectedAt: new Date().toISOString() }));
  } catch (error) {
    response.statusCode = error.status || 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Nao disponivel na fonte', detail: error.message }));
  }
}
