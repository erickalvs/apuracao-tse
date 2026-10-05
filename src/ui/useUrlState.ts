import { useMemo } from "react";

export type ViewMode = "progress" | "leader" | "official" | "candidate";

export type UrlState = {
  electionId: string;
  officeCode: string;
  uf?: string;
  municipality?: string;
  mode: ViewMode;
  candidate?: string;
};

const defaults: UrlState = {
  electionId: "6257",
  officeCode: "1",
  mode: "progress"
};

export function useUrlState(): [UrlState, (next: Partial<UrlState>) => void] {
  const state = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      electionId: params.get("e") || defaults.electionId,
      officeCode: params.get("cargo") || defaults.officeCode,
      uf: params.get("uf") || undefined,
      municipality: params.get("mun") || undefined,
      mode: (params.get("modo") as ViewMode) || defaults.mode,
      candidate: params.get("cand") || undefined
    };
  }, [window.location.search]);

  function setState(next: Partial<UrlState>) {
    const merged = { ...state, ...next };
    const params = new URLSearchParams();
    params.set("e", merged.electionId);
    params.set("cargo", merged.officeCode);
    params.set("modo", merged.mode);
    if (merged.uf) params.set("uf", merged.uf);
    if (merged.municipality) params.set("mun", merged.municipality);
    if (merged.candidate) params.set("cand", merged.candidate);
    window.history.pushState(null, "", `${window.location.pathname}?${params}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return [state, setState];
}
