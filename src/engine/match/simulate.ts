/** Maç motorunun oyun dünyasıyla bağlantısı: kurulum, arka plan maçları, sonucu işleme. */
import { clubPlayers, getClub } from '../generation/worldGenerator';
import type { Rng } from '../rng';
import type { Fixture, GameWorld, MatchResult } from '../types';
import { buildResult, createMatch, simulateToEnd, type MatchSetup } from './engine';
import { autoSelectLineup } from './formation';
import type { MatchState } from './state';

/** Son kaç maç puanı form olarak tutulur. */
const FORM_LENGTH = 5;

/** Fikstür için maç kurulumu. Maç tohumu dünya RNG'sinden çekilir (tekrarlanabilirlik). */
export function setupFixture(world: GameWorld, fixture: Fixture, rng: Rng): MatchSetup {
  const team = (clubId: string) => ({
    clubId,
    name: getClub(world, clubId).name,
    lineup: autoSelectLineup(clubPlayers(world, clubId)),
    userControlled: clubId === world.playerClubId,
  });
  return {
    fixtureId: fixture.id,
    home: team(fixture.homeId),
    away: team(fixture.awayId),
    seed: rng.int(0, 0xffffffff),
  };
}

export function startFixture(world: GameWorld, fixture: Fixture, rng: Rng): MatchState {
  return createMatch(setupFixture(world, fixture, rng), world.players);
}

/** Maçı arka planda baştan sona oynatır. */
export function playFixture(world: GameWorld, fixture: Fixture, rng: Rng): MatchResult {
  const state = startFixture(world, fixture, rng);
  simulateToEnd(state, world.players);
  return buildResult(state);
}

/** Sonucu fikstüre yazar ve oyuncuların form listesini günceller. */
export function applyResult(world: GameWorld, fixture: Fixture, result: MatchResult): void {
  fixture.result = result;
  for (const record of result.players) {
    const player = world.players[record.playerId];
    if (!player) continue;
    player.form = [...player.form, record.rating].slice(-FORM_LENGTH);
  }
}
