/**
 * Oyuncu kariyeri: sezon sezon istatistikler (kulüp başına) ve kulüp hareketleri.
 *
 * - Sezon sonunda (endSeason) her oyuncunun o sezon forma giydiği her kulüp için bir satır yazılır.
 *   Sezon ortasında kulüp değiştiren oyuncunun iki satırı olur. Bu sezon canlı olarak fikstürden hesaplanır.
 * - Hareketler: transfer (bonservisle), serbest imza, kiralık ve dönüşü, serbest bırakılma, U19'dan A takıma yükselme.
 * Geçmiş oyunun başladığı sezondan itibaren birikir (kurgusal dünyada daha öncesi bilinmiyor).
 */
import type { GameDate } from '../date';
import type { PlayerSeasonStats } from '../league/stats';
import type { Fixture, GameWorld, Player } from '../types';

export interface CareerSeason extends PlayerSeasonStats {
  /** Sezonun başladığı yıl (2026 = 2026/27). */
  year: number;
  clubId: string;
  /** O kulüpte kiralık olarak. */
  loan?: boolean;
}

export type MoveKind = 'transfer' | 'free' | 'loan' | 'loanEnd' | 'release' | 'promoted';

export interface CareerMove {
  date: GameDate;
  kind: MoveKind;
  fromClubId: string | null;
  toClubId: string | null;
  fee: number;
}

/** Kayıt boyutu için en fazla bu kadar hareket tutulur (en eskiler düşer). */
const MAX_MOVES = 30;

const emptyStats = (): PlayerSeasonStats => ({ apps: 0, starts: 0, goals: 0, assists: 0, yellow: 0, red: 0, manOfTheMatch: 0, avgRating: null });

/**
 * Fikstürdeki maç kayıtlarından oyuncu × kulüp istatistikleri (tek geçiş).
 * `onlyPlayer` verilirse yalnızca o oyuncunun satırları.
 */
export function seasonStatsByClub(fixtures: readonly Fixture[], onlyPlayer?: number): Map<number, Map<string, PlayerSeasonStats>> {
  const out = new Map<number, Map<string, PlayerSeasonStats>>();
  const ratingSums = new Map<string, number>();
  const statsFor = (playerId: number, clubId: string) => {
    let byClub = out.get(playerId);
    if (!byClub) out.set(playerId, (byClub = new Map()));
    let s = byClub.get(clubId);
    if (!s) byClub.set(clubId, (s = emptyStats()));
    return s;
  };
  for (const f of fixtures) {
    const r = f.result;
    if (!r) continue;
    for (const rec of r.players) {
      if (onlyPlayer !== undefined && rec.playerId !== onlyPlayer) continue;
      const s = statsFor(rec.playerId, rec.clubId);
      s.apps++;
      if (rec.started) s.starts++;
      s.goals += rec.goals;
      s.assists += rec.assists;
      const key = `${rec.playerId}|${rec.clubId}`;
      ratingSums.set(key, (ratingSums.get(key) ?? 0) + rec.rating);
      if (r.manOfTheMatch === rec.playerId) s.manOfTheMatch++;
    }
    for (const c of r.cards) {
      if (onlyPlayer !== undefined && c.playerId !== onlyPlayer) continue;
      const s = statsFor(c.playerId, c.clubId);
      if (c.type === 'yellow') s.yellow++;
      else s.red++;
    }
  }
  for (const [playerId, byClub] of out) {
    for (const [clubId, s] of byClub) {
      const sum = ratingSums.get(`${playerId}|${clubId}`);
      if (s.apps > 0 && sum !== undefined) s.avgRating = Math.round((sum / s.apps) * 100) / 100;
    }
  }
  return out;
}

/** Sezon sonu: oynanan sezonun satırlarını oyuncuların kariyerine yazar (yalnızca forma giyilen kulüpler). */
export function recordSeasonCareers(world: GameWorld): void {
  const year = world.season.year;
  for (const [playerId, byClub] of seasonStatsByClub(world.season.fixtures)) {
    const p = world.players[playerId];
    if (!p) continue;
    p.career ??= [];
    if (p.career.some((c) => c.year === year)) continue; // aynı sezon iki kez yazılmaz
    for (const [clubId, s] of byClub) {
      if (s.apps === 0) continue;
      const loan = p.loan !== null && p.clubId === clubId;
      p.career.push(loan ? { ...s, year, clubId, loan } : { ...s, year, clubId });
    }
  }
}

/** Bu sezonun (henüz yazılmamış) satırları, canlı olarak. */
export function currentSeasonRows(world: GameWorld, p: Player): CareerSeason[] {
  const year = world.season.year;
  if (p.career?.some((c) => c.year === year)) return [];
  const byClub = seasonStatsByClub(world.season.fixtures, p.id).get(p.id);
  if (!byClub) return [];
  return [...byClub].map(([clubId, s]) => ({ ...s, year, clubId, ...(p.loan && p.clubId === clubId ? { loan: true } : {}) }));
}

/** Kulüp hareketini kaydeder. */
export function recordMove(p: Player, move: CareerMove): void {
  p.moves ??= [];
  p.moves.push(move);
  if (p.moves.length > MAX_MOVES) p.moves.splice(0, p.moves.length - MAX_MOVES);
}

/** Kariyer toplamı (verilen satırlardan). */
export function careerTotals(rows: readonly CareerSeason[]): PlayerSeasonStats {
  const total = emptyStats();
  let ratingSum = 0;
  for (const r of rows) {
    total.apps += r.apps;
    total.starts += r.starts;
    total.goals += r.goals;
    total.assists += r.assists;
    total.yellow += r.yellow;
    total.red += r.red;
    total.manOfTheMatch += r.manOfTheMatch;
    ratingSum += (r.avgRating ?? 0) * r.apps;
  }
  if (total.apps > 0) total.avgRating = Math.round((ratingSum / total.apps) * 100) / 100;
  return total;
}
