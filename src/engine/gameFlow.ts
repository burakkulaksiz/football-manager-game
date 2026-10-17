/**
 * Oyun akışı: "Devam" butonunun motor tarafı.
 * Bu fonksiyonlar dünyayı YERİNDE değiştirir (store sonra yeni referans oluşturur).
 */
import { addDays, type GameDate } from './date';
import { buildResult } from './match/engine';
import { applyResult, playFixture, startFixture } from './match/simulate';
import type { MatchState } from './match/state';
import { Rng } from './rng';
import type { Fixture, GameWorld } from './types';

export type AdvanceResult =
  | { kind: 'played'; round: number; fixtures: Fixture[] }
  | { kind: 'userMatch'; fixture: Fixture }
  | { kind: 'moved'; days: number };

/** Bugün oynanmamış maç varsa onlar. */
export function todaysFixtures(world: GameWorld): Fixture[] {
  return world.season.fixtures.filter((f) => f.date === world.date && f.result === null);
}

/** Kulübümüzün bugün oynanmamış maçı. */
export function todaysUserFixture(world: GameWorld): Fixture | null {
  const id = world.playerClubId;
  return todaysFixtures(world).find((f) => f.homeId === id || f.awayId === id) ?? null;
}

/** Bugün veya sonrasındaki ilk oynanmamış maçın tarihi; sezon bittiyse null. */
export function nextMatchDate(world: GameWorld): GameDate | null {
  let next: GameDate | null = null;
  for (const f of world.season.fixtures) {
    if (f.result === null && f.date >= world.date && (next === null || f.date < next)) next = f.date;
  }
  return next;
}

/** Kulübümüzün sıradaki (oynanmamış) maçı. */
export function nextFixtureFor(world: GameWorld, clubId: string): Fixture | null {
  return (
    world.season.fixtures
      .filter((f) => f.result === null && (f.homeId === clubId || f.awayId === clubId))
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null
  );
}

export function isSeasonOver(world: GameWorld): boolean {
  return world.season.fixtures.every((f) => f.result !== null);
}

/**
 * Tek günlük ilerleme. Günlük işler (sakatlık iyileşmesi, kondisyon, transfer haberleri…)
 * sonraki aşamalarda buraya eklenecek.
 */
function advanceOneDay(world: GameWorld): void {
  world.date = addDays(world.date, 1);
}

/** Bugünkü (kalan) tüm maçları arka planda oynatır. */
export function playTodaysMatches(world: GameWorld): Fixture[] {
  const fixtures = todaysFixtures(world);
  const rng = Rng.fromState(world.rngState);
  for (const f of fixtures) applyResult(world, f, playFixture(world, f, rng));
  world.rngState = rng.getState();
  return fixtures;
}

/** Kullanıcının bugünkü maçını canlı oynatmak için başlatır. */
export function startUserMatch(world: GameWorld): MatchState | null {
  const fixture = todaysUserFixture(world);
  if (!fixture) return null;
  const rng = Rng.fromState(world.rngState);
  const state = startFixture(world, fixture, rng);
  world.rngState = rng.getState();
  return state;
}

/** Canlı maç bitince: sonucu işler, günün diğer maçlarını oynatır, haftanın maçlarını döndürür. */
export function finishUserMatch(world: GameWorld, state: MatchState): Fixture[] {
  const fixture = world.season.fixtures.find((f) => f.id === state.fixtureId);
  if (!fixture) throw new Error(`Fikstür bulunamadı: ${state.fixtureId}`);
  applyResult(world, fixture, buildResult(state));
  playTodaysMatches(world);
  return world.season.fixtures.filter((f) => f.round === fixture.round);
}

/**
 * "Devam":
 *  - Bugün kulübümüzün maçı varsa 'userMatch' döner (canlı maç ekranı açılır).
 *    `autoPlayUserMatch` ise o maç da arka planda oynanır (testler / anında sonuç).
 *  - Bugün başka maçlar varsa onları oynatır (tarih değişmez).
 *  - Değilse, gün gün ilerleyerek bir sonraki maç gününe gelir.
 *  - Sezon bittiyse bir gün ilerler (yeni sezon döngüsü 9. aşamada).
 */
export function advance(world: GameWorld, options: { autoPlayUserMatch?: boolean } = {}): AdvanceResult {
  const userFixture = todaysUserFixture(world);
  if (userFixture && !options.autoPlayUserMatch) return { kind: 'userMatch', fixture: userFixture };

  const today = todaysFixtures(world);
  if (today.length > 0) {
    const fixtures = playTodaysMatches(world);
    return { kind: 'played', round: fixtures[0]!.round, fixtures };
  }
  const next = nextMatchDate(world);
  let days = 0;
  do {
    advanceOneDay(world);
    days++;
  } while (next !== null && world.date < next);
  return { kind: 'moved', days };
}
