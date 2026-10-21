/**
 * Eski kayıtları güncel GameWorld biçimine dönüştürür.
 * Biçim sürümü: 1 = aşama 6 (finans/transfer yok), 2 = aşama 7, 3 = aşama 8 (ceza, gelişim, antrenman),
 * 4 = aşama 9 (1. Lig, yönetim, sezon arşivi), 5 = menajer kartı, 6 = altyapı (U19) ve gelişim geçmişi,
 * 7 = transfer / kiralık listesi.
 */
import type { GameData } from './data';
import { initFinance, initFinances, payMonthly } from './finance/finance';
import { ACADEMY_SEED_SALT, fillAcademies, generateClubSquad } from './generation/worldGenerator';
import { recordGrowth } from './squad/growth';
import { refreshAiListings } from './transfer/listing';
import { isWindowOpen } from './transfer/window';
import { Rng } from './rng';
import { initialBoard } from './season/expectation';
import { DEFAULT_TRAINING } from './squad/training';
import type { GameWorld } from './types';

export const CURRENT_WORLD_VERSION = 7;

/** `raw` eski biçimdeki dünya; dönüştürülmüş dünya döner (yerinde değiştirir). */
export function migrateWorld(raw: unknown, fromVersion: number, data: GameData): GameWorld {
  const world = raw as GameWorld;
  if (fromVersion < 2) {
    for (const p of Object.values(world.players)) p.loan ??= null;
    world.finances = initFinances(world.clubs, world.date, world.players);
    world.offers = [];
    world.nextOfferId = 1;
    world.news = [];
    world.nextNewsId = 1;
  }
  if (fromVersion < 3) {
    for (const p of Object.values(world.players)) {
      p.yellowCards ??= 0;
      p.suspension ??= 0;
      p.progress ??= 0;
      p.trend ??= 0;
      p.lastComplaint ??= null;
    }
    world.training ??= { [world.playerClubId]: { ...DEFAULT_TRAINING } };
  }
  if (fromVersion < 4) {
    for (const club of world.clubs) club.division ??= 1;
    // 1. Lig kulüplerini kadrolarıyla ekle
    const rng = new Rng((world.seed ^ 0x9e3779b9) >>> 0);
    for (const source of data.lowerClubs) {
      if (world.clubs.some((c) => c.id === source.id)) continue;
      const club = { ...source, colors: { ...source.colors }, division: 2 as const };
      world.clubs.push(club);
      for (const player of generateClubSquad(rng, data, club, world.date, world.nextPlayerId)) {
        world.players[player.id] = player;
        world.nextPlayerId = Math.max(world.nextPlayerId, player.id + 1);
      }
      const fin = initFinance(club, world.date);
      payMonthly(fin, Object.values(world.players), club.id);
      world.finances[club.id] = fin;
    }
    for (const fin of Object.values(world.finances)) {
      fin.current.income.prize ??= 0;
      for (const r of fin.history) r.income.prize ??= 0;
    }
    world.board ??= initialBoard(world.clubs.find((c) => c.id === world.playerClubId)!);
    world.history ??= [];
    world.seasonState ??= world.season.fixtures.every((f) => f.result !== null) ? 'ended' : 'running';
    world.gameOver ??= null;
  }
  if (fromVersion < 5) {
    // Menajer kartı: bu sezonki sonuçlar ve geçmiş şampiyonluklardan
    const user = world.playerClubId;
    const record = { won: 0, drawn: 0, lost: 0 };
    for (const f of world.season.fixtures) {
      if (!f.result || (f.homeId !== user && f.awayId !== user)) continue;
      const own = f.homeId === user ? f.result.homeGoals : f.result.awayGoals;
      const opp = f.homeId === user ? f.result.awayGoals : f.result.homeGoals;
      if (own > opp) record.won++;
      else if (own === opp) record.drawn++;
      else record.lost++;
    }
    world.manager ??= {
      name: 'Menajer',
      joined: world.history.length > 0 ? `${world.history[0]!.year}-07-01` : `${world.season.year}-07-01`,
      ...record,
      titles: world.history.filter((h) => h.championId === user).length,
    };
  }
  if (fromVersion < 6) {
    // Altyapı: her kulübe U19 kadrosu (ayrı rng; mevcut oyuncular A takımda kalır), takip listesi, gelişim geçmişi
    world.youthWatch ??= [];
    if (!Object.values(world.players).some((p) => p.academy)) {
      fillAcademies(world, data, new Rng((world.seed ^ ACADEMY_SEED_SALT ^ 0x6) >>> 0));
    }
    recordGrowth(world);
  }
  if (fromVersion < 7 && isWindowOpen(world.date)) refreshAiListings(world);
  return world;
}
