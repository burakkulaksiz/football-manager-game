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

export interface PlayerSeasonStats {
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  manOfTheMatch: number;
  /** Ortalama maç puanı; hiç oynamadıysa null. */
  avgRating: number | null;
}

/** Bir oyuncunun sezon istatistikleri (maç kayıtlarından). */
export function playerSeasonStats(
  fixtures: readonly Fixture[],
  playerId: number,
  /** Sonucu sıkıştırılan yurtdışı maçlarının sayaçları (Season.tallies). */
  tallies?: Readonly<Record<string, number[]>>,
): PlayerSeasonStats {
  const s: PlayerSeasonStats = { apps: 0, starts: 0, goals: 0, assists: 0, yellow: 0, red: 0, manOfTheMatch: 0, avgRating: null };
  let ratingSum = 0;
  for (const [key, t] of Object.entries(tallies ?? {})) {
    if (!key.startsWith(`${playerId}|`)) continue;
    const [apps = 0, starts = 0, goals = 0, assists = 0, ratingTenths = 0, motm = 0, yellow = 0, red = 0] = t;
    s.apps += apps;
    s.starts += starts;
    s.goals += goals;
    s.assists += assists;
    ratingSum += ratingTenths / 10;
    s.manOfTheMatch += motm;
    s.yellow += yellow;
    s.red += red;
  }
  for (const f of fixtures) {
    const r = f.result;
    if (!r) continue;
    const rec = r.players.find((p) => p.playerId === playerId);
    if (!rec) continue;
    s.apps++;
    if (rec.started) s.starts++;
    s.goals += rec.goals;
    s.assists += rec.assists;
    ratingSum += rec.rating;
    if (r.manOfTheMatch === playerId) s.manOfTheMatch++;
    for (const c of r.cards) {
      if (c.playerId !== playerId) continue;
      if (c.type === 'yellow') s.yellow++;
      else s.red++;
    }
  }
  if (s.apps > 0) s.avgRating = Math.round((ratingSum / s.apps) * 100) / 100;
  return s;
}

export interface LeaderRow {
  playerId: number;
  clubId: string;
  value: number;
  apps: number;
}

/** Tüm oyuncuların maç kayıtlarını toplar: asist ve puan sıralamaları için. */
function aggregate(fixtures: readonly Fixture[]): Map<number, { clubId: string; apps: number; assists: number; ratingSum: number }> {
  const rows = new Map<number, { clubId: string; apps: number; assists: number; ratingSum: number }>();
  for (const f of fixtures) {
    for (const rec of f.result?.players ?? []) {
      const row = rows.get(rec.playerId) ?? { clubId: rec.clubId, apps: 0, assists: 0, ratingSum: 0 };
      row.clubId = rec.clubId;
      row.apps++;
      row.assists += rec.assists;
      row.ratingSum += rec.rating;
      rows.set(rec.playerId, row);
    }
  }
  return rows;
}

export function topAssists(fixtures: readonly Fixture[], limit = 20): LeaderRow[] {
  return [...aggregate(fixtures).entries()]
    .filter(([, r]) => r.assists > 0)
    .map(([playerId, r]) => ({ playerId, clubId: r.clubId, value: r.assists, apps: r.apps }))
    .sort((a, b) => b.value - a.value || a.apps - b.apps || a.playerId - b.playerId)
    .slice(0, limit);
}

/** En yüksek ortalama puan; en az `minApps` maç oynamış olanlar arasında. */
export function topRatings(fixtures: readonly Fixture[], minApps: number, limit = 20): LeaderRow[] {
  return [...aggregate(fixtures).entries()]
    .filter(([, r]) => r.apps >= minApps)
    .map(([playerId, r]) => ({ playerId, clubId: r.clubId, value: Math.round((r.ratingSum / r.apps) * 100) / 100, apps: r.apps }))
    .sort((a, b) => b.value - a.value || b.apps - a.apps || a.playerId - b.playerId)
    .slice(0, limit);
}
