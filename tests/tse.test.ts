import { describe, expect, it } from "vitest";
import { buildResultUrl, normalizeResult, OfficialResult, padElection } from "../server/tse";

const baseRaw: OfficialResult = {
  ele: "6257",
  t: "1",
  f: "o",
  tpabr: "br",
  cdabr: "br",
  dg: "04/10/2026",
  hg: "18:00:33",
  idg: "1248642",
  dt: "04/10/2026",
  ht: "17:58:28",
  and: "p",
  md: "n",
  carg: [
    {
      cd: "1",
      nmn: "Presidente",
      agr: [
        {
          n: "a",
          nm: "Partido A",
          com: "A",
          par: [
            {
              n: "13",
              sg: "PT",
              cand: [{ n: "13", sqcand: "00123", nm: "Nome A", nmu: "A", dvt: "Valido", seq: "2", e: "n", vap: "10", pvap: "50,00", pvapn: "50,000000000" }]
            }
          ]
        },
        {
          n: "b",
          nm: "Partido B",
          com: "B",
          par: [
            {
              n: "22",
              sg: "PL",
              cand: [{ n: "22", sqcand: "00456", nm: "Nome B", nmu: "B", dvt: "Valido", seq: "1", e: "n", vap: "10", pvap: "50,00", pvapn: "50,000000000" }]
            }
          ]
        }
      ]
    }
  ],
  s: { ts: "100", st: "050", pst: "50,00", pstn: "50,000000000" },
  e: { te: "1000", c: "800", a: "200" },
  v: { vv: "20", vb: "1", vn: "2", van: "0", vansj: "0", vnt: "0" }
};

describe("TSE adapter", () => {
  it("preserves election identifiers with leading zero padding in URLs", () => {
    expect(padElection("6257")).toBe("006257");
    expect(buildResultUrl("https://resultados.tse.jus.br/oficial", { electionId: "6257", officeCode: "1", uf: "sp" })).toContain(
      "/sp/sp-c0001-e006257-u.json"
    );
  });

  it("detects ties without declaring candidates elected", () => {
    const result = normalizeResult(baseRaw, { url: "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json", collectedAt: "2026-10-04T21:00:00Z" });
    expect(result.leading?.status).toBe("tie");
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0].electedFlag).toBe("n");
  });

  it("does not coerce missing fields to zero", () => {
    const result = normalizeResult({ ...baseRaw, s: undefined, e: undefined, v: undefined }, { url: "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json", collectedAt: "2026-10-04T21:00:00Z" });
    expect(result.summary.sectionsTotalized).toBeNull();
    expect(result.summary.validVotes).toBeNull();
  });

  it("uses official elected flag as an official status, not vote order", () => {
    const raw = structuredClone(baseRaw);
    raw.carg[0].agr[1].par[0].cand[0].e = "s";
    const result = normalizeResult(raw, { url: "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json", collectedAt: "2026-10-04T21:00:00Z" });
    expect(result.leading?.status).toBe("official");
    expect(result.leading?.candidates[0].number).toBe("22");
  });
});
