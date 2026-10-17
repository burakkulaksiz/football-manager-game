/**
 * Eski kayıtları güncel GameWorld biçimine dönüştürür.
 * Biçim sürümü: 1 = aşama 6 (finans/transfer yok), 2 = aşama 7, 3 = aşama 8 (ceza, gelişim, antrenman).
 */
import { initFinances } from './finance/finance';
import { DEFAULT_TRAINING } from './squad/training';
import type { GameWorld } from './types';

export const CURRENT_WORLD_VERSION = 3;

/** `raw` eski biçimdeki dünya; dönüştürülmüş dünya döner (yerinde değiştirir). */
export function migrateWorld(raw: unknown, fromVersion: number): GameWorld {
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
  return world;
}
