/** Yalnızca testlerde kullanılan yardımcılar. */
import { gameData } from '../gameData';
import { advance, isSeasonOver } from './gameFlow';
import type { GameWorld, GoalEvent, MatchResult, TeamMatchStats } from './types';

const emptyStats = (): TeamMatchStats => ({
  possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0,
});

/** Sadece skor ve goller önemliyken kullanılan minimal maç sonucu. */
export function makeResult(homeGoals: number, awayGoals: number, goals: GoalEvent[] = []): MatchResult {
  return {
    homeGoals,
    awayGoals,
    goals,
    cards: [],
    injuries: [],
    stats: { home: emptyStats(), away: emptyStats() },
    players: [],
    manOfTheMatch: null,
  };
}

/**
 * Sezonu sonuna kadar oynatır (kendi maçımız da arka planda).
 * Yönetim güveni her gün tazelenir: kötü giden bir sezonda görevden alınma oyunu yarıda kesmesin.
 */
export function playSeason(world: GameWorld): void {
  let guard = 0;
  while (!isSeasonOver(world) && guard++ < 1000) {
    world.board.confidence = 100;
    advance(world, gameData, { autoPlayUserMatch: true });
  }
}

/**
 * Belirtilen tarihe kadar oyunu oynatır (kendi maçımız da otomatik). Sezon döngüsü sınanırken menajer görevden
 * alınmasın diye yönetim güveni eşiğin üstünde tutulur (görevden alma 'yönetim' testinde ayrıca sınanır).
 */
export function playUntil(world: GameWorld, date: string): void {
  let guard = 0;
  while (world.date < date && !world.gameOver && guard++ < 3000) {
    world.board.confidence = Math.max(world.board.confidence, 50);
    advance(world, gameData, { autoPlayUserMatch: true });
  }
}
