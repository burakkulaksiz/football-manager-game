/**
 * Ligler: Süper Lig (lig maçında `Fixture.league` yok), 1. Lig (Season.lower, ayrı; lowerLeague.ts) ve yurtdışı ligleri
 * (`league` = ülke kodu). Yurtdışı ligleri Süper Lig gibi tam motorla ve tam etkiyle (form, kondisyon, sakatlık, kart, finans)
 * oynanır, ama kendi rastgelelik akışıyla (ana akış kaymaz; oynatma gameFlow.ts). Kullanıcının liginde olmayan yurtdışı
 * maçlarının sonucu kayıt boyutu için sıkıştırılır (skor, goller, takım istatistiği). Takvim pazar: Süper Lig (cumartesi),
 * kupa (çarşamba), Avrupa (salı / perşembe) ve milli maçlarla (cuma / salı) çakışmaz. Küme düşme yok (alt ligleri yok).
 */
import { addDays, makeDate, weekday, type GameDate } from '../date';
import { foreignCountries } from '../generation/foreign';
import { getClub, leagueClubs } from '../generation/worldGenerator';
import { Rng } from '../rng';
import type { Club, Fixture, GameWorld, LeagueSummary, MatchResult, Season } from '../types';
import { isBreakWeekend, generateSeason } from './schedule';
import { computeStandings, goalDifference, type StandingRow } from './standings';

export const LEAGUES_SEED_SALT = 0x6c3a9e15;

/** Yurtdışı liglerinin adı (ülke kodu → lig). Listede olmayan ülkenin ligi "<kod> Ligi". */
export const LEAGUE_NAMES: Readonly<Record<string, string>> = {
  ENG: 'Premier League', ESP: 'La Liga', GER: 'Bundesliga', ITA: 'Serie A', FRA: 'Ligue 1',
  POR: 'Liga Portugal', NED: 'Eredivisie', BEL: 'Pro League',
};

/** Ligin adı: yoksa Süper Lig. */
export function leagueName(league: string | undefined): string {
  return league === undefined ? 'Süper Lig' : LEAGUE_NAMES[league] ?? `${league} Ligi`;
}

/** Kulübün ligi: yurtdışında ülke kodu, Türkiye'de undefined (Süper Lig; 1. Lig kulübü için de). */
export function leagueOf(club: Club): string | undefined {
  return club.country;
}

/** Kullanıcının ligi (işsizken ya da Türkiye'de undefined = Süper Lig). */
export function userLeague(world: GameWorld): string | undefined {
  return world.clubs.find((c) => c.id === world.playerClubId)?.country;
}

/** Bir ligin kulüpleri (undefined = Süper Lig). */
export function clubsInLeague(world: GameWorld, league: string | undefined): Club[] {
  return league === undefined ? leagueClubs(world) : world.clubs.filter((c) => c.country === league);
}

/** Bir ligin maçları (kupa ve Avrupa hariç). */
export function leagueFixturesOf(fixtures: readonly Fixture[], league: string | undefined): Fixture[] {
  return fixtures.filter((f) => f.competition === undefined && f.league === league);
}

/** Bir ligin puan durumu. */
export function leagueTable(world: GameWorld, league: string | undefined): StandingRow[] {
  return computeStandings(clubsInLeague(world, league).map((c) => c.id), leagueFixturesOf(world.season.fixtures, league));
}

/** Kulübün kendi ligindeki sırası (lig oynanmıyorsa 0). */
export function leaguePosition(world: GameWorld, clubId: string): number {
  return leagueTable(world, leagueOf(getClub(world, clubId))).findIndex((r) => r.clubId === clubId) + 1;
}

/** Fikstürü olan yurtdışı ligleri (veri sırasıyla). */
export function activeForeignLeagues(world: GameWorld): string[] {
  const played = new Set(world.season.fixtures.map((f) => f.league).filter((l) => l !== undefined));
  return foreignCountries(world).filter((l) => played.has(l));
}

const isWinter = (d: GameDate) => {
  const month = Number(d.slice(5, 7));
  const day = Number(d.slice(8, 10));
  return (month === 12 && day >= 24) || (month === 1 && day <= 15);
};

/**
 * Yurtdışı liginin hafta tarihleri: 8 Ağustos'tan sonraki pazarlar, 24 Mayıs'a kadar; milli aralar atlanır. Kış arası
 * yalnızca gerekirse (20 takımlı ligler, İngiltere gibi) kullanılır; o da yetmezse milli ara dışındaki çarşambalar.
 */
export function foreignMatchDates(year: number, rounds: number): GameDate[] {
  const last = makeDate(year + 1, 5, 24);
  const first = (dayOfWeek: number, from: GameDate) => {
    let d = from;
    while (weekday(d) !== dayOfWeek) d = addDays(d, 1);
    return d;
  };
  const sundays: GameDate[] = [];
  for (let d = first(0, makeDate(year, 8, 8)); d <= last; d = addDays(d, 7)) if (!isBreakWeekend(d) || isWinter(d)) sundays.push(d);
  const preferred = sundays.filter((d) => !isWinter(d));
  const dates = preferred.length >= rounds ? preferred : sundays;
  for (let d = first(3, makeDate(year, 10, 1)); dates.length < rounds && d <= last; d = addDays(d, 7)) {
    if (!isBreakWeekend(d) && !isWinter(d)) dates.push(d);
  }
  return dates.sort().slice(0, rounds);
}

const leagueHash = (league: string) => [...league].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/**
 * Sezonun yurtdışı lig fikstürleri world.season.fixtures'a eklenir (Süper Lig fikstüründen sonra; kimlikler devam eder).
 * Her ligin kendi tohumu: ana rastgelelik akışı kaymaz.
 */
export function generateForeignLeagues(world: GameWorld, year: number): void {
  let id = world.season.fixtures.reduce((max, f) => Math.max(max, f.id), 0) + 1;
  for (const league of foreignCountries(world)) {
    const ids = clubsInLeague(world, league).map((c) => c.id);
    // shortcut: tek sayıda kulüpte lig oynanmaz (bay gerekir); veri tek sayı olursa bay ekle
    if (ids.length < 2 || ids.length % 2 !== 0) continue;
    const rng = new Rng((world.seed ^ LEAGUES_SEED_SALT ^ Math.imul(year, 2654435761) ^ leagueHash(league)) >>> 0);
    const { fixtures } = generateSeason(rng, ids, year);
    const dates = foreignMatchDates(year, fixtures[fixtures.length - 1]!.round);
    for (const f of fixtures) world.season.fixtures.push({ ...f, id: id++, date: dates[f.round - 1] ?? dates[dates.length - 1]!, league });
  }
}

/** Sıkıştırılacak sonucun oyuncu kayıtları sezon sayaçlarına eklenir (oyuncunun sezon / kariyer istatistiği kaybolmasın). */
export function tallyResult(season: Season, result: MatchResult): void {
  const tallies = (season.tallies ??= {});
  const row = (playerId: number, clubId: string) => (tallies[`${playerId}|${clubId}`] ??= [0, 0, 0, 0, 0, 0, 0, 0]);
  for (const r of result.players) {
    const t = row(r.playerId, r.clubId);
    t[0]!++;
    if (r.started) t[1]!++;
    t[2]! += r.goals;
    t[3]! += r.assists;
    t[4]! += Math.round(r.rating * 10);
    if (result.manOfTheMatch === r.playerId) t[5]!++;
  }
  for (const c of result.cards) row(c.playerId, c.clubId)[c.type === 'yellow' ? 6 : 7]!++;
}

/**
 * Sonucu sıkıştırılan bir ligin krallık listesi sayaçlardan: gol, asist ya da puan ortalaması (en az `minApps` maç).
 * Kullanıcının ligi ve Süper Lig için league/stats.ts (topScorers…) maç kayıtlarından hesaplar.
 */
export function tallyLeaders(
  world: GameWorld, league: string, stat: 'goals' | 'assists' | 'rating', limit: number, minApps = 1,
): { playerId: number; clubId: string; value: number }[] {
  const clubs = new Set(clubsInLeague(world, league).map((c) => c.id));
  const rows: { playerId: number; clubId: string; value: number }[] = [];
  for (const [key, t] of Object.entries(world.season.tallies ?? {})) {
    const [id, clubId] = key.split('|') as [string, string];
    const [apps = 0, , goals = 0, assists = 0, ratingTenths = 0] = t;
    if (!clubs.has(clubId) || apps < minApps) continue;
    const value = stat === 'goals' ? goals : stat === 'assists' ? assists : ratingTenths / 10 / apps;
    if (value > 0) rows.push({ playerId: Number(id), clubId, value });
  }
  return rows.sort((a, b) => b.value - a.value || a.playerId - b.playerId).slice(0, limit);
}

/** Kullanıcının liginde olmayan yurtdışı maçı: kayda yalnızca skor, goller ve takım istatistiği (oyuncu kayıtları sayaçlarda). */
export function compactResult(result: MatchResult): MatchResult {
  const { homeGoals, awayGoals, goals, stats, manOfTheMatch, attendance } = result;
  return { homeGoals, awayGoals, goals, cards: [], injuries: [], stats, players: [], manOfTheMatch, ...(attendance !== undefined ? { attendance } : {}) };
}

/** Günün yurtdışı maçlarının rastgelelik akışı (ana akıştan ayrı; aynı tohum + aynı gün → aynı sonuçlar). */
export function leaguesRng(world: GameWorld): Rng {
  return new Rng((world.seed ^ LEAGUES_SEED_SALT ^ Math.imul(Number(world.date.replaceAll('-', '')), 40503)) >>> 0);
}

/** Sezon sonu: oynanan yurtdışı liglerinin final tabloları. */
export function foreignLeagueSummaries(world: GameWorld): LeagueSummary[] {
  return activeForeignLeagues(world).map((league) => {
    const table = leagueTable(world, league);
    const champion = getClub(world, table[0]!.clubId);
    return {
      league,
      table: table.map((r) => ({ clubId: r.clubId, name: getClub(world, r.clubId).name, points: r.points, goalDifference: goalDifference(r) })),
      championId: champion.id,
      championName: champion.name,
    };
  });
}
