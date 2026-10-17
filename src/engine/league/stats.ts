/** Lig istatistikleri — maç sonuçlarından türetilir, ayrıca saklanmaz. */
import type { Fixture } from '../types';

export interface ScorerRow {
  playerId: number;
  /** Golleri attığı kulüp (sezon içinde transfer olursa son kulübü). */
  clubId: string;
  goals: number;
}

export function topScorers(fixtures: readonly Fixture[], limit = 20): ScorerRow[] {
  const rows = new Map<number, ScorerRow>();
  for (const f of fixtures) {
    for (const g of f.result?.goals ?? []) {
      const row = rows.get(g.playerId) ?? { playerId: g.playerId, clubId: g.clubId, goals: 0 };
      row.goals++;
      row.clubId = g.clubId;
      rows.set(g.playerId, row);
    }
  }
  return [...rows.values()]
    .sort((a, b) => b.goals - a.goals || a.playerId - b.playerId)
    .slice(0, limit);
}

/** Kulübün gol yemeden bitirdiği maç sayısı. */
export function cleanSheets(fixtures: readonly Fixture[], clubId: string): number {
  return fixtures.filter(
    (f) =>
      f.result &&
      ((f.homeId === clubId && f.result.awayGoals === 0) ||
        (f.awayId === clubId && f.result.homeGoals === 0)),
  ).length;
}
