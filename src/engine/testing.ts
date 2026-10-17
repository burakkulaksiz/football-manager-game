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

/** Sezonu sonuna kadar oynatır (kendi maçımız da arka planda). */
export function playSeason(world: GameWorld): void {
  let guard = 0;
  while (!isSeasonOver(world) && guard++ < 1000) advance(world, gameData, { autoPlayUserMatch: true });
}
