import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { HttpCache } from "./cache.js";
import {
  buildMunicipalitiesUrl,
  buildResultUrl,
  ELECTIONS,
  OFFICES,
  OfficialResultSchema,
  officeAllowedForUf,
  normalizeResult,
  UF_BY_IBGE
} from "./tse.js";

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const officialBase = process.env.TSE_OFFICIAL_BASE ?? "https://resultados.tse.jus.br/oficial";
  const ttlMs = Number(process.env.CACHE_TTL_MS ?? 25000);
  const pollMs = Number(process.env.TSE_POLL_MS ?? 30000);
  const ibgeUrl =
    process.env.IBGE_GEO_URL ??
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF";
  const cache = new HttpCache(ttlMs);

  app.get("/api/health", async () => ({ ok: true, officialBase, pollMs }));

  app.get("/api/elections", async () => ({
    elections: ELECTIONS,
    offices: OFFICES,
    polling: { defaultMs: pollMs, cacheTtlMs: ttlMs },
    validation: [
      {
        url: "https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados",
        status: "validated-documentation",
        note: "Pagina tecnica 2026 consultada em 2026-10-04."
      },
      {
        url: `${officialBase}/ele2026/6257/dados/br/br-c0001-e006257-u.json`,
        status: "validated-200",
        note: "EA20 Presidente Brasil respondeu 200 com ETag e Last-Modified."
      },
      {
        url: `${officialBase}/ele2026/6257/config/mun-e006257-cm.json`,
        status: "validated-200",
        note: "EA12 municipios respondeu 200."
      },
      {
        url: `${officialBase}/ele2026/comum/config/ele-c.json`,
        status: "validated-404",
        note: "Caminho espelhado dos exemplos de simulado retornou 404 no ambiente oficial; app usa a lista oficial publicada como fallback conservador."
      }
    ]
  }));

  app.get("/api/geo/states", async () => {
    const entry = await cache.getJson(ibgeUrl, (value) => value);
    const geo = entry.value as any;
    geo.features = geo.features.map((feature: any) => {
      const meta = UF_BY_IBGE[String(feature.properties.codarea)] ?? { uf: String(feature.properties.codarea), name: "UF" };
      return { ...feature, properties: { ...feature.properties, ...meta } };
    });
    return { source: ibgeUrl, collectedAt: entry.collectedAt, data: geo };
  });

  app.get("/api/municipalities", async (request) => {
    const query = z.object({ electionId: z.string(), uf: z.string().length(2).optional() }).parse(request.query);
    const url = buildMunicipalitiesUrl(officialBase, query.electionId);
    const entry = await cache.getJson(url, (value) => value);
    const raw = entry.value as any;
    const blocks = Array.isArray(raw?.abr) ? raw.abr : [];
    const municipios = blocks
      .flatMap((block: any) =>
        (block.mu ?? []).map((item: any) => ({
          code: String(item.cd ?? ""),
          name: String(item.nm ?? ""),
          uf: String(block.cd ?? item.uf ?? "").toLowerCase(),
          ibgeCode: item.cdi ? String(item.cdi) : undefined,
          capital: item.c === "s",
          zones: item.z ?? [],
          original: item
        }))
      )
      .filter((item: any) => item.code && item.name && (!query.uf || item.uf === query.uf.toLowerCase()));
    return {
      source: { url, collectedAt: entry.collectedAt, status: entry.status, error: entry.error },
      municipalities: municipios
    };
  });

  app.get("/api/results", async (request, reply) => {
    const query = z
      .object({
        electionId: z.string(),
        officeCode: z.string(),
        uf: z.string().length(2).optional(),
        municipality: z.string().optional()
      })
      .parse(request.query);
    const uf = query.uf?.toLowerCase();
    const office = OFFICES.find((item) => item.code === query.officeCode);
    if (office && !(office.scopes as readonly string[]).includes("br") && !uf) {
      reply.code(422);
      return { error: "Selecione uma UF para consultar este cargo estadual." };
    }
    if (!officeAllowedForUf(query.officeCode, uf)) {
      reply.code(422);
      return { error: "Cargo incompativel com a UF selecionada." };
    }
    const url = buildResultUrl(officialBase, { ...query, uf });
    const entry = await cache.getJson(url, (value) => OfficialResultSchema.parse(value));
    if (!entry.value) {
      throw new Error("Fonte oficial nao retornou conteudo valido");
    }
    const result = normalizeResult(entry.value, {
      url,
      collectedAt: entry.collectedAt,
      etag: entry.etag,
      lastModified: entry.lastModified
    });
    return { status: entry.status, warning: entry.error, result };
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    app.log.error(error);
    reply.code(500).send({
      error: "Nao disponivel na fonte",
      detail: message
    });
  });

  return app;
}
