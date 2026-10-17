/**
 * Oyun akışı: "Devam" butonunun motor tarafı.
 * Bu fonksiyonlar dünyayı YERİNDE değiştirir (store sonra yeni referans oluşturur).
 */
import { addDays, type GameDate } from './date';
import { clubPlayers } from './generation/worldGenerator';
import { selectBestXI, simulateQuickMatch } from './match/quickSim';
import { Rng } from './rng';
import type { Fixture, GameWorld } from './types';

export type AdvanceResult =
  | { kind: 'played'; round: number; fixtures: Fixture[] }
  | { kind: 'moved'; days: number };

/** Bugün oynanmamış maç varsa onlar. */
export function todaysFixtures(world: GameWorld): Fixture[] {
  return world.season.fixtures.filter((f) => f.date === world.date && f.result === null);
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

/** Bugünkü tüm maçları anında oynatır. */
export function playTodaysMatches(world: GameWorld): Fixture[] {
  const fixtures = todaysFixtures(world);
  const rng = Rng.fromState(world.rngState);
  for (const f of fixtures) {
    f.result = simulateQuickMatch(
      rng,
      { clubId: f.homeId, xi: selectBestXI(clubPlayers(world, f.homeId)) },
      { clubId: f.awayId, xi: selectBestXI(clubPlayers(world, f.awayId)) },
    );
  }
  world.rngState = rng.getState();
  return fixtures;
}

/**
 * "Devam":
 *  - Bugün maç günüyse maçları oynatır (tarih değişmez).
 *  - Değilse, gün gün ilerleyerek bir sonraki maç gününe gelir.
 *  - Sezon bittiyse bir gün ilerler (yeni sezon döngüsü 9. aşamada).
 */
export function advance(world: GameWorld): AdvanceResult {
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
