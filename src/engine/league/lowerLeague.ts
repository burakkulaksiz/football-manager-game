/**
 * 1. Lig: kulüpler çift devreli lig oynar, ilk PROMOTED_COUNT Süper Lig'e çıkar.
 * Maçlar gerçek motorla oynanır ama tohum ayrı akıştan (ana rastgelelik kaymaz) ve kalıcı etkisi yok
 * (form, kondisyon, sakatlık, finans işlenmez); kayıtta yalnızca skor tutulur.
 */
import type { GameDate } from '../date';
import { simulateToEnd } from '../match/engine';
import { startFixture } from '../match/simulate';
import { Rng } from '../rng';
import { divisionOf } from '../season/expectation';
import type { GameWorld } from '../types';
import { generateSeason } from './schedule';
import { tableFrom, type StandingRow, type TableFixture } from './standings';

export type LowerFixture = TableFixture & { round: number };

export const LOWER_SEED_SALT = 0x1e9a2b47;

export function lowerLeagueIds(world: GameWorld): string[] {
  return world.clubs.filter((c) => divisionOf(c) === 2).map((c) => c.id);
}

/**
 * Sezonun 1. Lig fikstürü; Süper Lig fikstürü kurulduktan sonra çağrılır. Haftalar Süper Lig'in lig günlerine yayılır
 * (1. Lig'in hafta sayısı fazlaysa bazı günlerde iki hafta oynanır).
 */
export function generateLowerLeague(world: GameWorld, year: number): LowerFixture[] | undefined {
  const ids = lowerLeagueIds(world);
  // shortcut: tek sayıda kulüpte (bay gerekir) 1. Lig oynanmaz, çıkanlar rastgele seçilir; veri tek sayı olursa bay ekle
  if (ids.length < 2 || ids.length % 2 !== 0) return undefined;
  const { fixtures } = generateSeason(new Rng((world.seed ^ LOWER_SEED_SALT ^ year) >>> 0), ids, year);
  const days = [...new Set(world.season.fixtures.filter((f) => f.competition === undefined && f.league === undefined).map((f) => f.date))].sort();
  const rounds = fixtures[fixtures.length - 1]!.round;
  return fixtures.map((f) => ({
    id: f.id,
    round: f.round,
    date: days[Math.floor(((f.round - 1) * days.length) / rounds)] ?? f.date,
    homeId: f.homeId,
    awayId: f.awayId,
    result: null,
  }));
}

/** Tarihi `upTo`'ya kadar gelmiş, oynanmamış 1. Lig maçlarını oynatır. */
export function playLowerLeague(world: GameWorld, upTo: GameDate): void {
  for (const f of world.season.lower ?? []) {
    if (f.result !== null || f.date > upTo) continue;
    const seed = (world.seed ^ LOWER_SEED_SALT ^ Math.imul(world.season.year * 1000 + f.id, 2654435761)) >>> 0;
    const state = startFixture(world, { id: f.id, round: f.round, date: f.date, homeId: f.homeId, awayId: f.awayId, result: null }, seed);
    simulateToEnd(state, world.players);
    f.result = { homeGoals: state.score.home, awayGoals: state.score.away };
  }
}

export function lowerStandings(world: GameWorld): StandingRow[] {
  return tableFrom(lowerLeagueIds(world), world.season.lower ?? []);
}
