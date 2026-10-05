export type Election = {
  id: string;
  pleito: string;
  year: number;
  round: string;
  title: string;
  cycle: string;
  source: string;
};

export type Office = {
  code: string;
  name: string;
  electionId: string;
  scopes: string[];
  onlyUf?: string[];
  exceptUf?: string[];
};

export type Candidate = {
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
};

export type Result = {
  selection: {
    electionId: string;
    round: string;
    officeCode: string;
    officeName: string;
    scope: "br" | "uf" | "municipality";
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
  candidates: Candidate[];
  leading: { status: "none" | "tie" | "leading" | "official"; candidates: Candidate[] } | null;
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
};

export type Municipality = {
  code: string;
  name: string;
  uf: string;
  ibgeCode?: string;
};

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  elections: (signal?: AbortSignal) =>
    getJson<{ elections: Election[]; offices: Office[]; polling: { defaultMs: number; cacheTtlMs: number }; validation: unknown[] }>("/api/elections", signal),
  geo: (signal?: AbortSignal) => getJson<{ source: string; collectedAt: string; data: GeoJSON.FeatureCollection }>("/api/geo/states", signal),
  result: (params: { electionId: string; officeCode: string; uf?: string; municipality?: string }, signal?: AbortSignal) => {
    const search = new URLSearchParams({ electionId: params.electionId, officeCode: params.officeCode });
    if (params.uf) search.set("uf", params.uf);
    if (params.municipality) search.set("municipality", params.municipality);
    return getJson<{ status: string; warning?: string; result: Result }>(`/api/results?${search}`, signal);
  },
  municipalities: (params: { electionId: string; uf?: string }, signal?: AbortSignal) => {
    const search = new URLSearchParams({ electionId: params.electionId });
    if (params.uf) search.set("uf", params.uf);
    return getJson<{ municipalities: Municipality[] }>(`/api/municipalities?${search}`, signal);
  }
};
