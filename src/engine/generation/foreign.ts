/**
 * Yurtdışı kulüpleri (data/foreign_clubs.json): maç oynamazlar, puan tablosu yoktur. Kadroları yaşlanır,
 * gelişir; transfer pazarına alıcı ve satıcı olarak katılırlar (yapay zekâ alımları, kullanıcıya teklifler).
 * İtibar 100'ü geçebilir (devler ~120): kadro gücü ve oyuncuların Türkiye'ye gelme isteği buna göre.
 * Altyapıları (U19) yoktur; her yaz A takıma birkaç genç (17–18) katılır.
 */
import type { GameData } from '../data';
import { initFinance, payMonthly } from '../finance/finance';
import { Rng } from '../rng';
import { freeSquadNumber } from '../transfer/market';
import type { Club, ClubFinance, GameWorld } from '../types';
import { generateClubSquad, generateYouthPlayer, getClub } from './worldGenerator';

/** Yurtdışı kadrolarının ayrı rng'si: Türkiye dünyası (kadrolar, fikstür) bunlar eklenmeden önceki hâliyle aynı kalır. */
export const FOREIGN_SEED_SALT = 0xf0e16a;
/**
 * Maç geliri olmayan yabancı kulübün yayın + sponsor geliri maaş bütçesini aşağı yukarı karşılar
 * (yayın %75 + sponsor %30); yoksa kasa her ay erirdi.
 */
export const FOREIGN_TV_SHARE = 0.75;
/** Her yaz yabancı kulübün A takımına katılan genç sayısı. */
export const FOREIGN_INTAKE: readonly [number, number] = [2, 3];

export function isForeign(club: Club): boolean {
  return club.country !== undefined;
}

export function foreignClubs(world: GameWorld): Club[] {
  return world.clubs.filter(isForeign);
}

/** Yurtdışı ülkeleri, veri dosyasındaki sırayla (tekrarsız). */
export function foreignCountries(world: GameWorld): string[] {
  return [...new Set(foreignClubs(world).map((c) => c.country!))];
}

export function foreignFinanceShares(fin: ClubFinance): void {
  fin.tvIncome = Math.round(fin.wageBudget * FOREIGN_TV_SHARE);
}

/** Eksik yabancı kulüpleri kadroları ve finanslarıyla dünyaya ekler (yeni oyun ve eski kayıt dönüşümü). */
export function addForeignClubs(world: GameWorld, data: GameData, rng: Rng): void {
  for (const source of data.foreignClubs) {
    if (world.clubs.some((c) => c.id === source.id)) continue;
    const club: Club = { ...source, colors: { ...source.colors } };
    world.clubs.push(club);
    for (const player of generateClubSquad(rng, data, club, world.date, world.nextPlayerId)) {
      world.players[player.id] = player;
      world.nextPlayerId = Math.max(world.nextPlayerId, player.id + 1);
    }
    const fin = initFinance(club, world.date);
    foreignFinanceShares(fin);
    payMonthly(fin, Object.values(world.players), club.id);
    world.finances[club.id] = fin;
  }
}

/** 1 Temmuz: yabancı kulüplerin A takımına gençler katılır (altyapı yerine; kadrolar zamanla erimesin). */
export function foreignIntake(world: GameWorld, rng: Rng, data: GameData): void {
  for (const club of foreignClubs(world)) {
    const count = rng.int(FOREIGN_INTAKE[0], FOREIGN_INTAKE[1]);
    for (let i = 0; i < count; i++) {
      const youth = generateYouthPlayer(rng, data, club, world.date, world.nextPlayerId++, [17, 18]);
      youth.joined = world.date;
      world.players[youth.id] = youth;
      youth.squadNumber = freeSquadNumber(world, youth, club.id);
    }
  }
}

/**
 * Bölge filtresi (transfer araması, gözlemci araması): null = hepsi, 'TUR' = Türkiye kulüpleri,
 * 'abroad' = tüm yurtdışı, diğerleri ülke kodu. Serbest oyuncular yalnızca "hepsi"nde.
 */
export type Region = string | null;
export const ABROAD = 'abroad';

export function inRegion(world: GameWorld, p: { clubId: string | null }, region: Region): boolean {
  if (region === null) return true;
  if (!p.clubId) return false;
  const country = getClub(world, p.clubId).country;
  if (region === ABROAD) return country !== undefined;
  if (region === 'TUR') return country === undefined;
  return country === region;
}
