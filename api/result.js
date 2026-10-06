import { municipalityCodeFromIbge, officeFromQuery, officialResult } from './_tse.js';

export default async function handler(request, response) {
  try {
    const query = Object.fromEntries(new URL(request.url, 'http://localhost').searchParams);
    const office = officeFromQuery(query);
    const uf = query.uf?.toLowerCase();
    const municipality = query.municipality || await municipalityCodeFromIbge(office.electionId, uf, query.ibge);
    const result = await officialResult({ office, uf, municipality });
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.statusCode = 200;
    response.end(JSON.stringify({ result }));
  } catch (error) {
    response.statusCode = error.status || 500;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ error: 'Nao disponivel na fonte', detail: error.message }));
  }
}
