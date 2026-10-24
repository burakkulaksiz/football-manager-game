import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld, leagueClubs } from '../generation/worldGenerator';
import { migrateWorld } from '../migrate';
import { playSeason, makeResult } from '../testing';
import { willingToJoin } from '../transfer/market';
import type { Fixture, GameWorld } from '../types';
import { checkSacking, SACK_CONFIDENCE } from './board';
import {
  lossPenaltyFactor,
  MANAGER_BACKGROUNDS,
  managerReputation,
  managerSacked,
  managerTransferBonus,
  reputationAfterMatch,
  sackThreshold,
} from './manager';

const START = '2026-07-01';

/** Kulübümüzün bir maçı (sonuç verilmiş). */
function userMatch(world: GameWorld, opponentId: string, own: number, opp: number): Fixture {
  return { id: 9999, round: 1, date: world.date, homeId: world.playerClubId, awayId: opponentId, result: makeResult(own, opp) };
}

describe('menajer itibarı', () => {
  it('başlangıç itibarı seçilen geçmişten', () => {
    for (const background of ['amateur', 'player', 'international', 'coach'] as const) {
      const world = createWorld(gameData, 1, 'kasimpasa', START, 'Test', background);
      expect(managerReputation(world)).toBe(MANAGER_BACKGROUNDS[background].reputation);
      expect(world.manager.reputationHistory).toHaveLength(1);
    }
  });

  it('güçlüyü yenmek zayıfı yenmekten çok kazandırır; zayıfa kaybetmek en çok kaybettirir; rekorlar tutulur', () => {
    const clubs = leagueClubs(createWorld(gameData, 1, 'kasimpasa', START)).sort((a, b) => b.reputation - a.reputation);
    const strong = clubs[0]!.id;
    const weak = clubs[clubs.length - 1]!.id;
    const delta = (opponent: string, own: number, opp: number) => {
      const w = createWorld(gameData, 1, 'kasimpasa', START);
      const before = managerReputation(w);
      reputationAfterMatch(w, userMatch(w, opponent, own, opp));
      return { delta: managerReputation(w) - before, world: w };
    };
    expect(delta(strong, 2, 1).delta).toBeGreaterThan(delta(weak, 2, 1).delta);
    expect(delta(weak, 0, 1).delta).toBeLessThan(delta(strong, 0, 1).delta);
    expect(delta(weak, 0, 1).delta).toBeLessThan(0);
    const { world } = delta(weak, 5, 0);
    expect(world.manager.bestWin).toMatchObject({ scored: 5, conceded: 0 });
  });

  it('sezon sonu: kariyere sezon yazılır (tüm maçların G-B-M ve golleri), aylık itibar geçmişi tutulur', () => {
    const world = createWorld(gameData, 4, 'trabzonspor', START);
    playSeason(world);
    advance(world, gameData);
    const season = world.manager.seasons![0]!;
    const own = world.season.fixtures.filter((f) => f.result && (f.homeId === world.playerClubId || f.awayId === world.playerClubId));
    expect(season.won! + season.drawn! + season.lost!).toBe(own.length);
    expect(season.position).toBe(world.history[0]!.userPosition);
    expect(season.reputation).toBe(managerReputation(world));
    expect(world.manager.reputationHistory!.length).toBeGreaterThanOrEqual(11);
  }, 60_000);

  it('görevden alınma: itibar 8 düşer, sezon "görevden alındı" olarak yazılır', () => {
    const world = createWorld(gameData, 5, 'trabzonspor', START);
    const before = managerReputation(world);
    managerSacked(world, 12);
    expect(managerReputation(world)).toBeCloseTo(before - 8, 5);
    expect(world.manager.seasons![0]).toMatchObject({ sacked: true, position: 12 });
  });
});

describe('itibarın etkileri', () => {
  it('ünlü menajerin kulübüne oyuncu gelir, tanınmayanınkine gelmez (sınırdaki oyuncu)', () => {
    const world = createWorld(gameData, 6, 'erzurumspor', START);
    const own = world.clubs.find((c) => c.id === world.playerClubId)!.reputation;
    // Kulübümüzden 25 itibar puanı büyük kulübün genç oyuncusu: normalde (20 puan sınırı) gelmez
    const bigger = world.clubs.find((c) => c.country === undefined && c.reputation - own >= 24 && c.reputation - own <= 29);
    expect(bigger).toBeDefined();
    const player = clubPlayers(world, bigger!.id).find((p) => Number(START.slice(0, 4)) - Number(p.birthDate.slice(0, 4)) < 29)!;
    world.manager.reputation = 1;
    expect(willingToJoin(world, player, world.playerClubId)).toBe(false);
    world.manager.reputation = 100;
    expect(managerTransferBonus(world)).toBe(10);
    expect(willingToJoin(world, player, world.playerClubId)).toBe(true);
  });

  it('itibarlı menajere yönetim daha sabırlı: düşük eşik, yenilgide daha az güven kaybı', () => {
    const world = createWorld(gameData, 7, 'galatasaray', START);
    world.manager.reputation = 100;
    expect(sackThreshold(world, SACK_CONFIDENCE)).toBe(5);
    expect(lossPenaltyFactor(world)).toBeCloseTo(0.8);
    world.seasonState = 'ended';
    world.board.confidence = 8;
    checkSacking(world);
    expect(world.gameOver).toBeNull();
    world.manager.reputation = 15;
    checkSacking(world);
    expect(world.gameOver).not.toBeNull();
  });
});

describe('kayıt dönüşümü (biçim 14 → 15)', () => {
  it('itibar geçmiş başarılardan, kariyer sezonları arşivden', () => {
    const world = createWorld(gameData, 8, 'besiktas', START);
    playSeason(world);
    advance(world, gameData);
    const raw = structuredClone(world);
    for (const k of ['background', 'reputation', 'reputationHistory', 'seasons', 'bestWin', 'worstDefeat'] as const) delete raw.manager[k];
    const migrated = migrateWorld(raw, 14, gameData);
    expect(migrated.manager.background).toBe('player');
    expect(migrated.manager.reputation).toBeGreaterThanOrEqual(35);
    expect(migrated.manager.seasons).toEqual([expect.objectContaining({ year: 2026, clubId: 'besiktas', position: world.history[0]!.userPosition })]);
    expect(migrated.manager.reputationHistory).toHaveLength(1);
  }, 60_000);
});
