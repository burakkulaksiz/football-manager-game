/**
 * Oyun akışı: "Devam" butonunun motor tarafı.
 * Bu fonksiyonlar dünyayı YERİNDE değiştirir (store sonra yeni referans oluşturur).
 */
import type { GameData } from './data';
import { processDay } from './daily';
import { addDays, makeDate, type GameDate } from './date';
import { playLowerLeague } from './league/lowerLeague';
import { buildResult } from './match/engine';
import { applyResult, drawMatchSeed, playFixture, startFixture } from './match/simulate';
import type { MatchState } from './match/state';
import { Rng } from './rng';
import type { Competition, Fixture, GameWorld, NewsItem } from './types';

export type AdvanceResult =
  | { kind: 'played'; round: number; competition?: Competition; fixtures: Fixture[] }
  | { kind: 'userMatch'; fixture: Fixture }
  /** Takvim ilerledi; kullanıcıyı ilgilendiren haber geldiyse o gün durur. */
  | { kind: 'moved'; days: number; news: NewsItem[] };

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
 * Tek günlük ilerleme: takvim + günlük işler (finans, transfer, kiralıklar…).
 * Kullanıcıyı ilgilendiren yeni haberleri döndürür.
 */
function advanceOneDay(world: GameWorld, data: GameData, stopOn: (n: NewsItem) => boolean): NewsItem[] {
  const before = world.nextNewsId;
  world.date = addDays(world.date, 1);
  const rng = Rng.fromState(world.rngState);
  processDay(world, rng, data);
  world.rngState = rng.getState();
  return world.news.filter((n) => n.id >= before && n.important && stopOn(n));
}

/** Bugünkü (kalan) tüm maçları arka planda oynatır. */
export function playTodaysMatches(world: GameWorld): Fixture[] {
  const fixtures = todaysFixtures(world);
  const rng = Rng.fromState(world.rngState);
  for (const f of fixtures) applyResult(world, f, playFixture(world, f, rng), rng);
  world.rngState = rng.getState();
  playLowerLeague(world, world.date);
  return fixtures;
}

/**
 * Kullanıcının bugünkü maçını canlı oynatmak için başlatır.
 * `seed` verilirse (başlama öncesi taktik değişti) maç aynı tohumla yeniden kurulur.
 */
export function startUserMatch(world: GameWorld, seed?: number): MatchState | null {
  const fixture = todaysUserFixture(world);
  if (!fixture) return null;
  if (seed !== undefined) return startFixture(world, fixture, seed);
  const rng = Rng.fromState(world.rngState);
  const state = startFixture(world, fixture, drawMatchSeed(rng));
  world.rngState = rng.getState();
  return state;
}

/** Canlı maç bitince: sonucu işler, günün diğer maçlarını oynatır, haftanın maçlarını döndürür. */
export function finishUserMatch(world: GameWorld, state: MatchState): Fixture[] {
  const fixture = world.season.fixtures.find((f) => f.id === state.fixtureId);
  if (!fixture) throw new Error(`Fikstür bulunamadı: ${state.fixtureId}`);
  const rng = Rng.fromState(world.rngState);
  applyResult(world, fixture, buildResult(state), rng);
  world.rngState = rng.getState();
  playTodaysMatches(world);
  // Aynı haftanın (kupada aynı turun) maçları
  return world.season.fixtures.filter((f) => f.round === fixture.round && f.competition === fixture.competition);
}

/**
 * "Devam":
 *  - Bugün kulübümüzün maçı varsa 'userMatch' döner (canlı maç ekranı açılır).
 *    `autoPlayUserMatch` ise o maç da arka planda oynanır (testler / anında sonuç).
 *  - Bugün başka maçlar varsa onları oynatır (tarih değişmez).
 *  - Değilse, gün gün ilerleyerek bir sonraki maç gününe gelir; kullanıcıyı ilgilendiren bir haber
 *    (teklif yanıtı, gelen teklif, transfer dönemi…) çıkarsa o gün durur.
 *  - Sezon bittiyse bir gün ilerler (yeni sezon döngüsü 9. aşamada).
 * `stopOn`: hangi önemli haberde durulacağı (ayarlar: kapatılan haber türlerinde Devam durmaz); verilmezse hepsinde.
 */
export function advance(
  world: GameWorld,
  data: GameData,
  options: { autoPlayUserMatch?: boolean; stopOn?: (n: NewsItem) => boolean } = {},
): AdvanceResult {
  if (world.gameOver) return { kind: 'moved', days: 0, news: [] };
  const userFixture = todaysUserFixture(world);
  if (userFixture && !options.autoPlayUserMatch) return { kind: 'userMatch', fixture: userFixture };

  const today = todaysFixtures(world);
  if (today.length > 0) {
    const fixtures = playTodaysMatches(world);
    return { kind: 'played', round: fixtures[0]!.round, competition: fixtures[0]!.competition, fixtures };
  }
  // Sezon arasında bir sonraki durak yeni sezonun başlangıcıdır (1 Temmuz).
  const next = nextMatchDate(world) ?? makeDate(world.season.year + 1, 7, 1);
  let days = 0;
  let news: NewsItem[] = [];
  do {
    news = advanceOneDay(world, data, options.stopOn ?? (() => true));
    days++;
  } while (news.length === 0 && !world.gameOver && world.date < next);
  return { kind: 'moved', days, news };
}
