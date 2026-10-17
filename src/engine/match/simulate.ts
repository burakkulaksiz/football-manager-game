/** Maç motorunun oyun dünyasıyla bağlantısı: kurulum, arka plan maçları, sonucu işleme. */
import { clubPlayers, getClub } from '../generation/worldGenerator';
import type { Rng } from '../rng';
import type { Fixture, GameWorld, MatchResult } from '../types';
import { buildResult, createMatch, simulateToEnd, type MatchSetup, type TeamSetup } from './engine';
import { autoSelectLineup, chooseFormation, FORMATIONS } from './formation';
import type { MatchState } from './state';
import { resolveLineup } from './tactics';

/** Son kaç maç puanı form olarak tutulur. */
const FORM_LENGTH = 5;

/** Kulübün maç kadrosu: kayıtlı taktiği varsa o, yoksa yapay zekâ kadrosuna en uygun dizilişi seçer. */
function teamSetup(world: GameWorld, clubId: string): TeamSetup {
  const squad = clubPlayers(world, clubId);
  const name = getClub(world, clubId).name;
  const tactics = world.tactics[clubId];
  if (tactics) {
    return {
      clubId,
      name,
      lineup: resolveLineup(tactics, squad),
      userControlled: clubId === world.playerClubId,
      formation: tactics.formation,
      instructions: tactics.instructions,
      captainId: tactics.captainId,
      penaltyTakerId: tactics.penaltyTakerId,
      freeKickTakerId: tactics.freeKickTakerId,
    };
  }
  const formation = chooseFormation(squad);
  return { clubId, name, lineup: autoSelectLineup(squad, FORMATIONS[formation]), formation };
}

/** Fikstür için maç kurulumu. */
export function setupFixture(world: GameWorld, fixture: Fixture, seed: number): MatchSetup {
  return {
    fixtureId: fixture.id,
    home: teamSetup(world, fixture.homeId),
    away: teamSetup(world, fixture.awayId),
    seed,
  };
}

/** Maç tohumu dünya RNG'sinden çekilir (tekrarlanabilirlik). */
export function drawMatchSeed(rng: Rng): number {
  return rng.int(0, 0xffffffff);
}

export function startFixture(world: GameWorld, fixture: Fixture, seed: number): MatchState {
  return createMatch(setupFixture(world, fixture, seed), world.players);
}

/** Maçı arka planda baştan sona oynatır. */
export function playFixture(world: GameWorld, fixture: Fixture, rng: Rng): MatchResult {
  const state = startFixture(world, fixture, drawMatchSeed(rng));
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
