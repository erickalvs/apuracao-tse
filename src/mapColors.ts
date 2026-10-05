import { Result } from "./api";

export const leaderPalette = ["#2563eb", "#dc2626", "#059669", "#7c3aed", "#c2410c", "#0891b2", "#4d7c0f", "#be123c"];

export type LeaderLegendItem = {
  key: string;
  color: string;
  name: string;
  party: string;
  states: number;
};

export function buildLeaderLegend(results: Map<string, Result>) {
  const entries = new Map<string, LeaderLegendItem>();
  for (const result of results.values()) {
    const leader = result.leading?.status === "tie" ? undefined : result.leading?.candidates[0];
    if (!leader) continue;
    const key = leader.number;
    const existing = entries.get(key);
    if (existing) {
      existing.states += 1;
    } else {
      entries.set(key, {
        key,
        color: leaderPalette[entries.size % leaderPalette.length],
        name: leader.ballotName,
        party: leader.party,
        states: 1
      });
    }
  }
  return [...entries.values()];
}
