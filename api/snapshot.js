import { officialResult, officeAllowedForUf, officeFromQuery, UFS } from './_tse.js';

export default async function handler(request, response) {
  try {
    const query = Object.fromEntries(new URL(request.url, 'http://localhost').searchParams);
    const office = officeFromQuery(query);
    const states = {};
    const national = office.scopes.includes('br')
      ? await officialResult({ office })
      : {
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
    await Promise.all(UFS.map(async uf => {
      if (!officeAllowedForUf(office, uf)) return;
      states[uf.toUpperCase()] = await officialResult({ office, uf });
    }));
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 's-maxage=30, stale-while-revalidate=120');
    response.statusCode = 200;
    response.end(JSON.stringify({ office: office.name, national, states, collectedAt: new Date().toISOString() }));
  } catch (error) {
    response.statusCode = error.status || 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Nao disponivel na fonte', detail: error.message }));
  }
}
