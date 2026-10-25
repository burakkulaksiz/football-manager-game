/**
 * Grafik verileri (saf hesap): lig sıralamasının haftalara göre seyri ve bir kulübün form eğrisi.
 */
import { computeStandings, type Fixture, type Outcome } from '../engine';

export const FORM_WINDOW = 5;

export interface PositionHistory {
  /** Tamamen oynanmış lig haftaları (artan). */
  rounds: number[];
  /** Kulüp başına her haftanın sonundaki sıra (1 = lider); `rounds` ile aynı uzunlukta. */
  positions: Map<string, number[]>;
  /** Kulüp başına her haftanın sonundaki puan. */
  points: Map<string, number[]>;
}

/**
 * Lig sıralaması hafta hafta: her hafta, o haftaya kadarki maçlarla puan tablosu yeniden hesaplanır
 * (sonraki haftaların sonuçları gizlenir; ikili averaj kuralı da o günkü gibi işler).
 */
export function positionHistory(clubIds: readonly string[], fixtures: readonly Fixture[]): PositionHistory {
  const league = fixtures.filter((f) => f.competition === undefined);
  const byRound = new Map<number, Fixture[]>();
  for (const f of league) byRound.set(f.round, [...(byRound.get(f.round) ?? []), f]);
  const rounds = [...byRound.entries()]
    .filter(([, list]) => list.every((f) => f.result !== null))
    .map(([round]) => round)
    .sort((a, b) => a - b);

  const positions = new Map(clubIds.map((id) => [id, [] as number[]]));
  const points = new Map(clubIds.map((id) => [id, [] as number[]]));
  for (const round of rounds) {
    const visible = league.map((f) => (f.round <= round ? f : { ...f, result: null }));
    computeStandings(clubIds, visible).forEach((row, i) => {
      positions.get(row.clubId)?.push(i + 1);
      points.get(row.clubId)?.push(row.points);
    });
  }
  return { rounds, positions, points };
}

export interface FormMatch {
  fixture: Fixture;
  opponentId: string;
  home: boolean;
  scored: number;
  conceded: number;
  outcome: Outcome;
  points: number;
  /** Bu maça kadar son 5 maçta maç başına puan (ilk maçlarda eldeki maçlar). */
  rolling: number;
  /** Bu maça kadar sezon boyu maç başına puan. */
  seasonAverage: number;
}

const POINTS: Record<Outcome, number> = { W: 3, D: 1, L: 0 };

/** Bir kulübün oynanmış maçları (lig, kupa, Avrupa) tarih sırasıyla; form eğrisi için ortalamalarla. */
export function formSeries(clubId: string, fixtures: readonly Fixture[]): FormMatch[] {
  const played = fixtures
    .filter((f) => f.result !== null && (f.homeId === clubId || f.awayId === clubId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const result: FormMatch[] = [];
  let total = 0;
  played.forEach((fixture, i) => {
    const home = fixture.homeId === clubId;
    const r = fixture.result!;
    const scored = home ? r.homeGoals : r.awayGoals;
    const conceded = home ? r.awayGoals : r.homeGoals;
    const outcome: Outcome = scored > conceded ? 'W' : scored === conceded ? 'D' : 'L';
    total += POINTS[outcome];
    const window = [...result.slice(Math.max(0, i - FORM_WINDOW + 1)).map((m) => m.points), POINTS[outcome]].slice(-FORM_WINDOW);
    result.push({
      fixture,
      opponentId: home ? fixture.awayId : fixture.homeId,
      home,
      scored,
      conceded,
      outcome,
      points: POINTS[outcome],
      rolling: window.reduce((a, b) => a + b, 0) / window.length,
      seasonAverage: total / (i + 1),
    });
  });
  return result;
}
