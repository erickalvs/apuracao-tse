import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Info, LocateFixed, RotateCcw, Search, X } from "lucide-react";
import { api, Candidate, Municipality, Result } from "../api";
import { number, percent, dateTime } from "../format";
import { buildLeaderLegend } from "../mapColors";
import { BrazilMap } from "./BrazilMap";
import { useUrlState, ViewMode } from "./useUrlState";

const UF_NAMES: Record<string, string> = {
  ac: "Acre",
  al: "Alagoas",
  ap: "Amapa",
  am: "Amazonas",
  ba: "Bahia",
  ce: "Ceara",
  df: "Distrito Federal",
  es: "Espirito Santo",
  go: "Goias",
  ma: "Maranhao",
  mt: "Mato Grosso",
  ms: "Mato Grosso do Sul",
  mg: "Minas Gerais",
  pa: "Para",
  pb: "Paraiba",
  pr: "Parana",
  pe: "Pernambuco",
  pi: "Piaui",
  rj: "Rio de Janeiro",
  rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul",
  ro: "Rondonia",
  rr: "Roraima",
  sc: "Santa Catarina",
  sp: "Sao Paulo",
  se: "Sergipe",
  to: "Tocantins"
};

export function App() {
  const [urlState, setUrlState] = useUrlState();
  const [, forceRender] = useState(0);
  const [search, setSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    const listener = () => forceRender((value) => value + 1);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  const elections = useQuery({ queryKey: ["elections"], queryFn: ({ signal }) => api.elections(signal) });
  const geo = useQuery({ queryKey: ["geo"], queryFn: ({ signal }) => api.geo(signal) });
  const currentOffice = elections.data?.offices.find((office) => office.code === urlState.officeCode);
  const effectiveElectionId = currentOffice?.electionId ?? urlState.electionId;
  const needsUfForResult = Boolean(currentOffice && !currentOffice.scopes.includes("br") && !urlState.uf);
  const selectionCompatible = Boolean(currentOffice && (!urlState.uf || officeAllowedForUf(urlState.officeCode, urlState.uf)));
  const result = useQuery({
    queryKey: ["result", effectiveElectionId, urlState.officeCode, urlState.uf, urlState.municipality],
    queryFn: ({ signal }) =>
      api.result({ electionId: effectiveElectionId, officeCode: urlState.officeCode, uf: urlState.uf, municipality: urlState.municipality }, signal),
    enabled: Boolean(currentOffice) && !needsUfForResult && selectionCompatible,
    refetchInterval: elections.data?.polling.defaultMs ?? 30000
  });
  const municipalities = useQuery({
    queryKey: ["municipalities", effectiveElectionId, urlState.uf],
    queryFn: ({ signal }) => api.municipalities({ electionId: effectiveElectionId, uf: urlState.uf }, signal),
    enabled: Boolean(urlState.uf)
  });

  const filteredMunicipalities = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = municipalities.data?.municipalities ?? [];
    if (!term) return source.slice(0, 30);
    return source.filter((item) => item.name.toLowerCase().includes(term) || item.code.includes(term)).slice(0, 30);
  }, [municipalities.data, search]);

  const stateResults = useStateResultMap(urlState.officeCode, effectiveElectionId, geo.data?.data);
  const selectedResult = needsUfForResult ? undefined : result.data?.result;
  const candidates = useMemo(() => {
    const term = candidateSearch.trim().toLowerCase();
    const all = selectedResult?.candidates ?? [];
    return term ? all.filter((cand) => `${cand.ballotName} ${cand.party} ${cand.number}`.toLowerCase().includes(term)) : all;
  }, [candidateSearch, selectedResult]);

  const selectedUfName = urlState.uf ? UF_NAMES[urlState.uf] : undefined;

  function selectOffice(code: string) {
    const office = elections.data?.offices.find((item) => item.code === code);
    const nextUf = normalizeUfForOffice(code, urlState.uf);
    setUrlState({ officeCode: code, electionId: office?.electionId ?? effectiveElectionId, uf: nextUf, municipality: undefined });
  }

  function selectUf(uf: string) {
    setUrlState({ uf, municipality: undefined });
  }

  function selectMunicipality(item: Municipality) {
    setUrlState({ uf: item.uf, municipality: item.code });
  }

  return (
    <main className="app-shell">
      <section className="map-stage" aria-label="Mapa interativo do Brasil">
        <div className="brand-strip">
          <strong>Apura Brasil</strong>
          <span>Dados oficiais do TSE. Interface independente.</span>
        </div>

        <div className="floating top-left controls" aria-label="Selecao da consulta">
          <select value={effectiveElectionId} onChange={(event) => setUrlState({ electionId: event.target.value })} aria-label="Eleicao">
            {elections.data?.elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.year} - {election.title}
              </option>
            ))}
          </select>
          <select value={urlState.officeCode} onChange={(event) => selectOffice(event.target.value)} aria-label="Cargo">
            {elections.data?.offices.map((office) => (
              <option key={office.code} value={office.code}>
                {office.name}
              </option>
            ))}
          </select>
          <select value={urlState.mode} onChange={(event) => setUrlState({ mode: event.target.value as ViewMode })} aria-label="Modo do mapa">
            <option value="progress">Andamento</option>
            <option value="leader">Lideranca parcial</option>
            <option value="official">Resultado oficial</option>
            <option value="candidate">Votacao de candidato</option>
          </select>
        </div>

        <div className="floating top-right search-box">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar UF ou municipio" aria-label="Buscar UF ou municipio" />
          {search && (
            <div className="search-results">
              {Object.entries(UF_NAMES)
                .filter(([uf, name]) => `${uf} ${name}`.toLowerCase().includes(search.toLowerCase()))
                .map(([uf, name]) => (
                  <button key={uf} onClick={() => selectUf(uf)}>
                    {name} ({uf.toUpperCase()})
                  </button>
                ))}
              {filteredMunicipalities.map((item) => (
                <button key={item.code} onClick={() => selectMunicipality(item)}>
                  {item.name} ({item.uf.toUpperCase()})
                </button>
              ))}
            </div>
          )}
        </div>

        <MapLegend mode={urlState.mode} officeCode={urlState.officeCode} results={stateResults} selectedResult={selectedResult} />

        <div className="floating map-actions">
          <button title="Resumo nacional" onClick={() => setUrlState({ uf: undefined, municipality: undefined })}>
            <LocateFixed size={18} />
          </button>
          <button title="Restaurar Brasil" onClick={() => setUrlState({ uf: undefined, municipality: undefined, mode: "progress" })}>
            <RotateCcw size={18} />
          </button>
          <button title="Fonte e metodologia" onClick={() => setShowMethodology(true)}>
            <Info size={18} />
          </button>
        </div>

        <div className="update-chip" aria-live="polite">
          {needsUfForResult
            ? "Selecione uma UF"
            : result.isFetching
              ? "Atualizando..."
              : `Ultima consulta: ${selectedResult ? new Date(selectedResult.source.collectedAt).toLocaleTimeString("pt-BR") : "aguardando"}`}
        </div>

        {geo.data?.data ? (
          <BrazilMap
            geo={geo.data.data}
            selectedUf={urlState.uf}
            mode={urlState.mode}
            results={stateResults}
            nationalResult={selectedResult}
            onSelectUf={selectUf}
          />
        ) : (
          <div className="map-loading">Carregando malha oficial do IBGE...</div>
        )}
      </section>

      {(selectedResult || result.isError || urlState.uf) && (
        <aside className="detail-panel" aria-label="Detalhes da apuracao">
          <div className="panel-header">
            <div>
              <p className="breadcrumb">Brasil{selectedUfName ? ` > ${selectedUfName}` : ""}{urlState.municipality ? ` > ${urlState.municipality}` : ""}</p>
              <h1>{selectedUfName ?? "Resumo nacional"}</h1>
              <span>{currentOffice?.name ?? "Cargo"} - 1o turno</span>
            </div>
            <button title="Fechar painel" onClick={() => setUrlState({ uf: undefined, municipality: undefined })}>
              <X size={18} />
            </button>
          </div>

          {!selectionCompatible && <div className="notice">Cargo incompativel com a UF selecionada. Escolha uma UF valida para este cargo.</div>}
          {!needsUfForResult && result.isError && <div className="notice">Nao disponivel na fonte: {(result.error as Error).message}</div>}
          {!needsUfForResult && result.data?.warning && <div className="notice">Atualizacao interrompida: {result.data.warning}</div>}
          {selectedResult && (
            <details className="panel-section" open>
              <summary>Detalhes da votacao</summary>
              <ResultSummary result={selectedResult} />
            </details>
          )}

          {urlState.uf && (
            <details className="panel-section">
              <summary>Municipios</summary>
              <section className="municipality-block">
                <label>
                  Municipio
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou codigo TSE" />
                </label>
                <div className="municipality-list">
                  {filteredMunicipalities.map((item) => (
                    <button key={item.code} className={item.code === urlState.municipality ? "active" : ""} onClick={() => selectMunicipality(item)}>
                      {item.name}
                      <span>{item.code}</span>
                    </button>
                  ))}
                </div>
              </section>
            </details>
          )}

          {selectedResult && (
            <details className="panel-section">
              <summary>Candidatos</summary>
              <section>
                <div className="candidate-tools">
                  <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Buscar candidato" aria-label="Buscar candidato" />
                </div>
                <div className="candidate-list">
                  {candidates.map((candidate) => (
                    <CandidateRow key={`${candidate.number}-${candidate.name}`} candidate={candidate} max={selectedResult.candidates[0]?.votes ?? 1} />
                  ))}
                </div>
              </section>
            </details>
          )}
        </aside>
      )}

      {showMethodology && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Fonte e metodologia">
          <div className="modal">
            <button className="modal-close" onClick={() => setShowMethodology(false)} title="Fechar">
              <X size={18} />
            </button>
            <h2>Fonte e metodologia</h2>
            <p>Resultados consumidos dos arquivos JSON oficiais de divulgacao do TSE, especialmente EA20. Geometria das UFs carregada da API de malhas do IBGE.</p>
            <p>A interface nao faz projecoes, nao declara eleitos por lideranca e preserva os horarios de geracao oficial e de consulta da aplicacao.</p>
            <p>Polling padrao: {elections.data?.polling.defaultMs ?? 30000} ms, com cache compartilhado no backend e validacao condicional quando a CDN informa ETag ou Last-Modified.</p>
          </div>
        </div>
      )}
    </main>
  );
}

function useStateResultMap(officeCode: string, electionId: string, geo?: GeoJSON.FeatureCollection) {
  const ufs = useMemo(() => (geo?.features ?? []).map((feature: any) => feature.properties.uf as string).filter(Boolean), [geo]);
  const queries = useQueries({
    queries: ufs.map((uf) => ({
      queryKey: ["state-result", electionId, officeCode, uf],
      queryFn: ({ signal }) => api.result({ electionId, officeCode, uf }, signal),
      enabled: Boolean(geo) && officeAllowedForUf(officeCode, uf),
      refetchInterval: 30000
    }))
  });
  return useMemo(() => {
    const output = new Map<string, Result>();
    queries.forEach((query, index) => {
      if (query.data?.result) output.set(ufs[index], query.data.result);
    });
    return output;
  }, [queries.map((query) => query.dataUpdatedAt).join(","), ufs.join(",")]);
}

function officeAllowedForUf(officeCode: string, uf: string) {
  if (officeCode === "7") return uf !== "df";
  if (officeCode === "8") return uf === "df";
  return true;
}

function normalizeUfForOffice(officeCode: string, uf?: string) {
  if (officeCode === "8") return "df";
  if (officeCode === "7" && uf === "df") return undefined;
  return uf;
}

function ResultSummary({ result }: { result: Result }) {
  return (
    <section className="summary-grid">
      <Metric label="Situacao" value={result.summary.countingStatus === "final" ? "Final" : result.summary.countingStatus === "partial" ? "Parcial" : "Nao informada"} />
      <Metric label="Secoes totalizadas" value={`${number(result.summary.sectionsTotalized)} de ${number(result.summary.sectionsTotal)}`} />
      <Metric label="% secoes" value={percent(result.summary.sectionsPercent)} />
      <Metric label="Eleitorado" value={number(result.summary.electorate)} />
      <Metric label="Comparecimento" value={number(result.summary.attendance)} />
      <Metric label="Abstencao" value={number(result.summary.abstention)} />
      <Metric label="Votos validos" value={number(result.summary.validVotes)} />
      <Metric label="Brancos / nulos" value={`${number(result.summary.blankVotes)} / ${number(result.summary.nullVotes)}`} />
      <Metric label="Dado oficial" value={dateTime(result.source.officialGeneratedAt)} />
      <Metric label="Consulta app" value={new Date(result.source.collectedAt).toLocaleString("pt-BR")} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CandidateRow({ candidate, max }: { candidate: Candidate; max: number | null }) {
  const width = max && candidate.votes ? Math.max(2, (candidate.votes / max) * 100) : 0;
  return (
    <article className="candidate-row">
      <div className="candidate-main">
        <strong>{candidate.ballotName}</strong>
        <span>
          {candidate.number} - {candidate.party} - {candidate.voteDestination}
        </span>
      </div>
      <div className="candidate-votes">
        <strong>{number(candidate.votes)}</strong>
        <span>{candidate.percentLabel}</span>
      </div>
      <div className="vote-bar" aria-hidden="true">
        <span style={{ width: `${width}%` }} />
      </div>
      <small>{candidate.officialStatus}</small>
    </article>
  );
}

function MapLegend({ mode, officeCode, results, selectedResult }: { mode: ViewMode; officeCode: string; results: Map<string, Result>; selectedResult?: Result }) {
  const leaders = useMemo(() => buildLeaderLegend(results), [results]);
  const selectedCandidate = selectedResult?.leading?.candidates[0];
  const showPartyOnly = officeCode === "3";
  return (
    <div className="floating bottom-left legend">
      <span className="legend-title">{legendTitle(mode)}</span>
      {mode === "leader" ? (
        <div className="legend-items" aria-label="Cores dos lideres parciais">
          {leaders.length ? (
            leaders.slice(0, 8).map((item) => (
              <div className="legend-item" key={item.key}>
                <span className="legend-swatch" style={{ background: item.color }} aria-hidden="true" />
                <strong>{showPartyOnly ? item.party : item.name}</strong>
                <small>
                  {showPartyOnly ? "" : `${item.party} · `}
                  {item.states} UF{item.states === 1 ? "" : "s"}
                </small>
              </div>
            ))
          ) : (
            <span>Aguardando resultados por UF.</span>
          )}
          <div className="legend-item">
            <span className="legend-swatch neutral" aria-hidden="true" />
            <strong>Sem dado ou empate</strong>
            <small>Tom neutro no mapa</small>
          </div>
        </div>
      ) : mode === "candidate" ? (
        <>
          <div className="legend-scale candidate" />
          <span>{selectedCandidate ? `Escala pela votação de ${selectedCandidate.ballotName}.` : legendDescription(mode)}</span>
        </>
      ) : (
        <>
          <div className={`legend-scale ${mode}`} />
          <span>{legendDescription(mode)}</span>
        </>
      )}
    </div>
  );
}

function legendTitle(mode: ViewMode) {
  return mode === "leader" ? "Lideranca parcial" : mode === "official" ? "Resultado oficial" : mode === "candidate" ? "Votacao de candidato" : "Andamento da apuracao";
}

function legendDescription(mode: ViewMode) {
  if (mode === "leader") return "Cores estaveis por candidato; empate e ausencia usam tons neutros.";
  if (mode === "official") return "Baseado somente em situacoes oficiais publicadas pelo TSE.";
  if (mode === "candidate") return "Escala pelo percentual do candidato selecionado quando disponivel.";
  return "Escala pelo percentual de secoes totalizadas.";
}
