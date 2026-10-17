/**
 * Puan durumu: galibiyet 3, beraberlik 1.
 * Puan eşitliğinde (TFF kuralına yakın):
 *   1) eşit takımlar arasındaki maçlar tamamen oynandıysa ikili puan, sonra ikili averaj
 *   2) genel averaj, 3) atılan gol.
 */
import type { Fixture } from '../types';

export type Outcome = 'W' | 'D' | 'L';

export interface StandingRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Son 5 maç, en yenisi sonda. */
  form: Outcome[];
}

export function goalDifference(row: StandingRow): number {
  return row.goalsFor - row.goalsAgainst;
}

function emptyRow(clubId: string): StandingRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] };
}

function applyResult(row: StandingRow, scored: number, conceded: number): void {
  row.played++;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  const outcome: Outcome = scored > conceded ? 'W' : scored === conceded ? 'D' : 'L';
  if (outcome === 'W') { row.won++; row.points += 3; }
  else if (outcome === 'D') { row.drawn++; row.points += 1; }
  else row.lost++;
  row.form.push(outcome);
}

function tally(clubIds: readonly string[], fixtures: readonly Fixture[]): Map<string, StandingRow> {
  const rows = new Map(clubIds.map((id) => [id, emptyRow(id)]));
  const played = fixtures
    .filter((f) => f.result !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  for (const f of played) {
    const home = rows.get(f.homeId);
    const away = rows.get(f.awayId);
    if (!home || !away) continue; // mini lig: grup dışı maç
    applyResult(home, f.result!.homeGoals, f.result!.awayGoals);
    applyResult(away, f.result!.awayGoals, f.result!.homeGoals);
  }
  return rows;
}

/** Eşit puanlı grup içinde sıralama. */
function sortTiedGroup(group: StandingRow[], fixtures: readonly Fixture[]): StandingRow[] {
  const ids = new Set(group.map((r) => r.clubId));
  const mutual = fixtures.filter((f) => ids.has(f.homeId) && ids.has(f.awayId));
  const mutualComplete = mutual.length > 0 && mutual.every((f) => f.result !== null);
  const h2h = mutualComplete ? tally([...ids], mutual) : null;

  return [...group].sort((a, b) => {
    if (h2h) {
      const ha = h2h.get(a.clubId)!;
      const hb = h2h.get(b.clubId)!;
      if (hb.points !== ha.points) return hb.points - ha.points;
      if (goalDifference(hb) !== goalDifference(ha)) return goalDifference(hb) - goalDifference(ha);
    }
    if (goalDifference(b) !== goalDifference(a)) return goalDifference(b) - goalDifference(a);
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubId.localeCompare(b.clubId);
  });
}

export function computeStandings(clubIds: readonly string[], fixtures: readonly Fixture[]): StandingRow[] {
  const rows = [...tally(clubIds, fixtures).values()].sort((a, b) => b.points - a.points);
  for (const row of rows) row.form = row.form.slice(-5);

  // Aynı puandaki takımları gruplayıp kendi içinde sırala.
  const result: StandingRow[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && rows[j]!.points === rows[i]!.points) j++;
    const group = rows.slice(i, j);
    result.push(...(group.length > 1 ? sortTiedGroup(group, fixtures) : group));
    i = j;
  }
  return result;
}
