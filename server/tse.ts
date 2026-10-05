import { z } from "zod";

export type ElectionId = "6257" | "6259" | "6261";
export type Scope = "br" | "uf" | "municipality";

export const UF_BY_IBGE: Record<string, { uf: string; name: string }> = {
  "11": { uf: "ro", name: "Rondonia" },
  "12": { uf: "ac", name: "Acre" },
  "13": { uf: "am", name: "Amazonas" },
  "14": { uf: "rr", name: "Roraima" },
  "15": { uf: "pa", name: "Para" },
  "16": { uf: "ap", name: "Amapa" },
  "17": { uf: "to", name: "Tocantins" },
  "21": { uf: "ma", name: "Maranhao" },
  "22": { uf: "pi", name: "Piaui" },
  "23": { uf: "ce", name: "Ceara" },
  "24": { uf: "rn", name: "Rio Grande do Norte" },
  "25": { uf: "pb", name: "Paraiba" },
  "26": { uf: "pe", name: "Pernambuco" },
  "27": { uf: "al", name: "Alagoas" },
  "28": { uf: "se", name: "Sergipe" },
  "29": { uf: "ba", name: "Bahia" },
  "31": { uf: "mg", name: "Minas Gerais" },
  "32": { uf: "es", name: "Espirito Santo" },
  "33": { uf: "rj", name: "Rio de Janeiro" },
  "35": { uf: "sp", name: "Sao Paulo" },
  "41": { uf: "pr", name: "Parana" },
  "42": { uf: "sc", name: "Santa Catarina" },
  "43": { uf: "rs", name: "Rio Grande do Sul" },
  "50": { uf: "ms", name: "Mato Grosso do Sul" },
  "51": { uf: "mt", name: "Mato Grosso" },
  "52": { uf: "go", name: "Goias" },
  "53": { uf: "df", name: "Distrito Federal" }
};

export const OFFICES = [
  { code: "1", name: "Presidente", electionId: "6257", scopes: ["br", "uf", "municipality"] },
  { code: "3", name: "Governador", electionId: "6259", scopes: ["uf", "municipality"] },
  { code: "5", name: "Senador", electionId: "6259", scopes: ["uf", "municipality"] },
  { code: "6", name: "Deputado federal", electionId: "6259", scopes: ["uf", "municipality"] },
  { code: "7", name: "Deputado estadual", electionId: "6259", scopes: ["uf", "municipality"], exceptUf: ["df"] },
  { code: "8", name: "Deputado distrital", electionId: "6259", scopes: ["uf", "municipality"], onlyUf: ["df"] }
] as const;

export const ELECTIONS = [
  {
    id: "6257",
    pleito: "3220",
    year: 2026,
    round: "1",
    title: "Eleicao Geral Federal",
    cycle: "ele2026",
    source: "TSE 2026 technical page; EA11 official config URL returned 404 during validation"
  },
  {
    id: "6259",
    pleito: "3220",
    year: 2026,
    round: "1",
    title: "Eleicoes Gerais Estaduais 2026",
    cycle: "ele2026",
    source: "TSE 2026 technical page; EA11 official config URL returned 404 during validation"
  }
] as const;

export const OfficialResultSchema = z
  .object({
    ele: z.string(),
    t: z.string(),
    f: z.string().optional(),
    tpabr: z.string(),
    cdabr: z.string(),
    dg: z.string().optional(),
    hg: z.string().optional(),
    idg: z.string().optional(),
    dt: z.string().optional(),
    ht: z.string().optional(),
    and: z.string().optional(),
    md: z.string().optional(),
    carg: z.array(z.any()).default([]),
    s: z.record(z.string()).optional(),
    e: z.record(z.string()).optional(),
    v: z.record(z.string()).optional()
  })
  .passthrough();

export type OfficialResult = z.infer<typeof OfficialResultSchema>;

export type NormalizedCandidate = {
  number: string;
  name: string;
  ballotName: string;
  party: string;
  coalition: string;
  federation?: string;
  votes: number | null;
  percent: number | null;
  percentLabel: string;
  voteDestination: string;
  electedFlag: "s" | "n" | "";
  officialStatus: string;
  sequence: number;
  photoUrl?: string;
  original: unknown;
};

export type NormalizedResult = {
  selection: {
    electionId: string;
    round: string;
    officeCode: string;
    officeName: string;
    scope: Scope;
    uf?: string;
    municipality?: string;
  };
  summary: {
    countingStatus: "partial" | "final" | "unknown";
    mathematicallyDefined: boolean;
    sectionsTotalized: number | null;
    sectionsTotal: number | null;
    sectionsPercent: number | null;
    electorate: number | null;
    attendance: number | null;
    abstention: number | null;
    validVotes: number | null;
    blankVotes: number | null;
    nullVotes: number | null;
    otherVoteDestinations: Record<string, number | null>;
  };
  candidates: NormalizedCandidate[];
  leading:
    | {
        status: "none" | "tie" | "leading" | "official";
        candidates: NormalizedCandidate[];
      }
    | null;
  source: {
    url: string;
    environment: "oficial";
    collectedAt: string;
    officialGeneratedAt?: string;
    officialTotalizedAt?: string;
    generationId?: string;
    adapterVersion: string;
    etag?: string;
    lastModified?: string;
  };
  raw: OfficialResult;
};

export function padElection(id: string) {
  return id.padStart(6, "0");
}

export function padOffice(code: string) {
  return code.padStart(4, "0");
}

export function buildResultUrl(base: string, params: { electionId: string; officeCode: string; uf?: string; municipality?: string }) {
  const election = ELECTIONS.find((item) => item.id === params.electionId);
  if (!election) throw new Error("Eleicao nao suportada");
  const uf = (params.uf ?? "br").toLowerCase();
  const prefix = params.municipality ? `${uf}${params.municipality.padStart(5, "0")}` : uf;
  return `${base}/${election.cycle}/${params.electionId}/dados/${uf}/${prefix}-c${padOffice(params.officeCode)}-e${padElection(params.electionId)}-u.json`;
}

export function buildMunicipalitiesUrl(base: string, electionId: string) {
  const election = ELECTIONS.find((item) => item.id === electionId);
  if (!election) throw new Error("Eleicao nao suportada");
  return `${base}/${election.cycle}/${electionId}/config/mun-e${padElection(electionId)}-cm.json`;
}

function parseTseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value: unknown): number | null {
  return parseTseNumber(value);
}

function officialDate(date?: string, time?: string) {
  return date && time ? `${date} ${time}` : undefined;
}

export function normalizeResult(raw: OfficialResult, meta: { url: string; collectedAt: string; etag?: string; lastModified?: string }): NormalizedResult {
  const office = raw.carg[0] ?? {};
  const candidates: NormalizedCandidate[] = [];
  for (const group of office.agr ?? []) {
    for (const party of group.par ?? []) {
      for (const cand of party.cand ?? []) {
        const sqcand = String(cand.sqcand ?? "");
        candidates.push({
          number: String(cand.n ?? ""),
          name: String(cand.nm ?? ""),
          ballotName: String(cand.nmu ?? cand.nm ?? ""),
          party: String(party.sg ?? ""),
          coalition: String(group.com || group.nm || ""),
          federation: party.nfed ? String(party.nfed) : undefined,
          votes: parseTseNumber(cand.vap),
          percent: parsePercent(cand.pvapn ?? cand.pvap),
          percentLabel: cand.pvap ? `${cand.pvap}%` : "Nao disponivel na fonte",
          voteDestination: String(cand.dvt ?? ""),
          electedFlag: cand.e === "s" ? "s" : cand.e === "n" ? "n" : "",
          officialStatus: cand.st || (cand.e === "s" ? "Eleito/segundo turno segundo campo oficial" : "Nao eleito segundo campo oficial"),
          sequence: Number(cand.seq ?? 999999),
          photoUrl: sqcand ? `${new URL(meta.url).origin}/oficial/ele2026/${raw.ele}/fotos/${raw.cdabr}/${sqcand}.jpeg` : undefined,
          original: cand
        });
      }
    }
  }
  candidates.sort((a, b) => a.sequence - b.sequence || (b.votes ?? -1) - (a.votes ?? -1));
  const maxVotes = Math.max(...candidates.map((item) => item.votes ?? -1), -1);
  const leaders = maxVotes > 0 ? candidates.filter((item) => item.votes === maxVotes) : [];
  const elected = candidates.filter((item) => item.electedFlag === "s");

  return {
    selection: {
      electionId: raw.ele,
      round: raw.t,
      officeCode: String(office.cd ?? ""),
      officeName: String(office.nmn ?? office.nmm ?? office.nmf ?? ""),
      scope: raw.tpabr === "br" ? "br" : raw.cdabr.length > 2 ? "municipality" : "uf",
      uf: raw.cdabr.length >= 2 && raw.cdabr !== "br" ? raw.cdabr.slice(0, 2).toLowerCase() : undefined,
      municipality: raw.cdabr.length > 2 ? raw.cdabr.slice(2) : undefined
    },
    summary: {
      countingStatus: raw.and === "f" ? "final" : raw.and === "p" ? "partial" : "unknown",
      mathematicallyDefined: raw.md === "s",
      sectionsTotalized: parseTseNumber(raw.s?.st),
      sectionsTotal: parseTseNumber(raw.s?.ts),
      sectionsPercent: parsePercent(raw.s?.pstn ?? raw.s?.pst),
      electorate: parseTseNumber(raw.e?.te),
      attendance: parseTseNumber(raw.e?.c),
      abstention: parseTseNumber(raw.e?.a),
      validVotes: parseTseNumber(raw.v?.vv),
      blankVotes: parseTseNumber(raw.v?.vb),
      nullVotes: parseTseNumber(raw.v?.vn),
      otherVoteDestinations: {
        anulados: parseTseNumber(raw.v?.van),
        anuladosSubJudice: parseTseNumber(raw.v?.vansj),
        nulosTecnicos: parseTseNumber(raw.v?.vnt),
        semCandidatoValido: parseTseNumber(raw.v?.vscv)
      }
    },
    candidates,
    leading: elected.length
      ? { status: "official", candidates: elected }
      : leaders.length > 1
        ? { status: "tie", candidates: leaders }
        : leaders.length === 1
          ? { status: "leading", candidates: leaders }
          : { status: "none", candidates: [] },
    source: {
      url: meta.url,
      environment: "oficial",
      collectedAt: meta.collectedAt,
      officialGeneratedAt: officialDate(raw.dg, raw.hg),
      officialTotalizedAt: officialDate(raw.dt, raw.ht),
      generationId: raw.idg,
      adapterVersion: "ea20-2026-v1",
      etag: meta.etag,
      lastModified: meta.lastModified
    },
    raw
  };
}

export function officeAllowedForUf(officeCode: string, uf?: string) {
  const office = OFFICES.find((item) => item.code === officeCode);
  if (!office) return false;
  const restricted = office as { onlyUf?: readonly string[]; exceptUf?: readonly string[] };
  if (restricted.onlyUf && (!uf || !restricted.onlyUf.includes(uf))) return false;
  if (restricted.exceptUf && uf && restricted.exceptUf.includes(uf)) return false;
  return true;
}
