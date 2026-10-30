/** Maç motorunun oyun dünyasıyla bağlantısı: kurulum, arka plan maçları, sonucu işleme. */
import { processMatchFinances } from '../finance/finance';
import { boardAfterMatch } from '../season/board';
import { pressAfterMatch } from '../season/press';
import { reputationAfterMatch } from '../season/manager';
import { processDiscipline } from '../squad/discipline';
import { injurePlayer } from '../squad/injuries';
import { applyMatchMorale } from '../squad/morale';
import { trackPromises } from '../squad/talks';
import { cupAfterMatch, FINAL_ROUND, isCupFixture } from '../league/cup';
import { europeAfterMatch, europeMatchOptions, isEuropeFixture } from '../league/europe';
import { payContractBonuses } from '../transfer/agents';
import { facilityLevel, matchInjuryFactor } from '../finance/facilities';
import { learnFromMatch } from '../transfer/scouting';
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
  const injuryRisk = matchInjuryFactor(facilityLevel(world, clubId, 'medical'));
  if (tactics) {
    return {
      clubId,
      name,
      injuryRisk,
      lineup: resolveLineup(tactics, squad),
      userControlled: clubId === world.playerClubId,
      formation: tactics.formation,
      custom: tactics.custom ?? null,
      plan: tactics.activePlan ?? 0,
      instructions: tactics.instructions,
      captainId: tactics.captainId,
      viceCaptainId: tactics.viceCaptainId,
      penaltyTakerId: tactics.penaltyTakerId,
      freeKickTakerId: tactics.freeKickTakerId,
      cornerTakerId: tactics.cornerTakerId ?? null,
      targetManId: tactics.targetManId ?? null,
    };
  }
  const formation = chooseFormation(squad);
  return { clubId, name, lineup: autoSelectLineup(squad, FORMATIONS[formation]), formation, injuryRisk };
}

/** Fikstür için maç kurulumu. */
export function setupFixture(world: GameWorld, fixture: Fixture, seed: number): MatchSetup {
  return {
    fixtureId: fixture.id,
    home: teamSetup(world, fixture.homeId),
    away: teamSetup(world, fixture.awayId),
    seed,
    // Kupa: eleme (beraberlikte penaltılar), final tarafsız sahada
    ...(isCupFixture(fixture) ? { knockout: true, neutral: fixture.round === FINAL_ROUND } : {}),
    // Avrupa: rövanşta toplam skor, final tarafsız
    ...(isEuropeFixture(fixture) ? europeMatchOptions(world, fixture) : {}),
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

/**
 * Sonucu fikstüre yazar ve maçın kalıcı etkilerini işler: finans (bilet, prim), form,
 * maç sonu kondisyonu, sakatlıklar, kart cezaları ve moral.
 */
export function applyResult(world: GameWorld, fixture: Fixture, result: MatchResult, rng: Rng): void {
  fixture.result = result;
  processMatchFinances(world, fixture);
  for (const record of result.players) {
    const player = world.players[record.playerId];
    if (!player) continue;
    player.form = [...player.form, record.rating].slice(-FORM_LENGTH);
    if (record.condition !== undefined) player.condition = record.condition;
  }
  for (const injury of result.injuries) {
    const player = world.players[injury.playerId];
    if (player) injurePlayer(world, player, rng, 'match');
  }
  processDiscipline(world, fixture, result, rng);
  applyMatchMorale(world, fixture, result);
  trackPromises(world, fixture, result);
  payContractBonuses(world, result);
  learnFromMatch(world, fixture.homeId, fixture.awayId, result.players);
  boardAfterMatch(world, fixture);
  pressAfterMatch(world, fixture);
  reputationAfterMatch(world, fixture);
  if (isCupFixture(fixture)) cupAfterMatch(world, fixture);
  if (isEuropeFixture(fixture)) europeAfterMatch(world, fixture);
}
