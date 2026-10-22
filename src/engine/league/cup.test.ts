import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { weekday } from '../date';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld, getClub, leagueClubs } from '../generation/worldGenerator';
import { buildResult, createMatch, simulateToEnd } from '../match/engine';
import { autoSelectLineup } from '../match/formation';
import { divisionOf } from '../season/expectation';
import { playSeason } from '../testing';
import {
  CUP_ROUNDS,
  cupChampion,
  cupFixtures,
  cupParticipants,
  cupRoundDate,
  FINAL_ROUND,
  fixtureWinner,
  leagueFixtures,
} from './cup';
import { fixtureLabel } from './competitions';
import { computeStandings } from './standings';

const START = '2026-07-01';

describe('Türkiye Kupası takvimi', () => {
  it('turlar çarşamba, sırayla ve lig maçlarıyla çakışmadan', () => {
    const world = createWorld(gameData, 5, 'kasimpasa', START);
    const leagueDates = new Set(world.season.fixtures.map((f) => f.date));
    const dates = CUP_ROUNDS.map((_, i) => cupRoundDate(2026, i + 1));
    for (const d of dates) {
      expect(weekday(d)).toBe(3);
      expect(leagueDates.has(d)).toBe(false);
    }
    expect([...dates].sort()).toEqual(dates);
    // Final ligin son haftasından önce
    expect(dates[dates.length - 1]! < [...leagueDates].sort().at(-1)!).toBe(true);
    // Sezon başında kura yok
    expect(cupFixtures(world)).toHaveLength(0);
  });
});

describe('Türkiye Kupası sezonu', () => {
  const world = createWorld(gameData, 11, 'kasimpasa', START);
  playSeason(world);
  // Sezon sonu işlemleri ertesi gün
  advance(world, gameData);

  it('26 kulüp: 1. Turda 10 maç (6 bay), sonra 8, 4, 2 ve final', () => {
    expect(cupParticipants(world)).toHaveLength(26);
    expect(CUP_ROUNDS.map((_, i) => cupFixtures(world, i + 1).length)).toEqual([10, 8, 4, 2, 1]);
    const firstRound = cupFixtures(world, 1).flatMap((f) => [f.homeId, f.awayId]);
    // Bay geçenler en yüksek itibarlı Süper Lig kulüpleri
    const seeded = leagueClubs(world).sort((a, b) => b.reputation - a.reputation).slice(0, 6);
    for (const c of seeded) expect(firstRound).not.toContain(c.id);
  });

  it('her maçın bir kazananı var; kazananlar bir sonraki tura çıkar; alt lig takımı evinde oynar', () => {
    for (let round = 1; round <= FINAL_ROUND; round++) {
      const fixtures = cupFixtures(world, round);
      for (const f of fixtures) {
        expect(fixtureWinner(f)).not.toBeNull();
        expect(fixtureLabel(f)).toContain(CUP_ROUNDS[round - 1]!.name);
        const dh = divisionOf(getClub(world, f.homeId));
        const da = divisionOf(getClub(world, f.awayId));
        if (round < FINAL_ROUND && dh !== da) expect(dh).toBeGreaterThan(da);
      }
      if (round > 1) {
        const winners = cupFixtures(world, round - 1).map((f) => fixtureWinner(f)!);
        const teams = fixtures.flatMap((f) => [f.homeId, f.awayId]);
        for (const w of winners) expect(teams).toContain(w);
      }
    }
    const champion = cupChampion(world);
    expect(champion).not.toBeNull();
    expect(world.history.at(-1)?.cupWinnerId).toBe(champion);
    expect(world.news.some((n) => n.category === 'cup' && n.title.includes('kazandı'))).toBe(true);
  });

  it('kupa maçları puan durumunu etkilemez', () => {
    const ids = leagueClubs(world).map((c) => c.id);
    expect(computeStandings(ids, world.season.fixtures)).toEqual(computeStandings(ids, leagueFixtures(world.season.fixtures)));
    const total = computeStandings(ids, world.season.fixtures).reduce((s, r) => s + r.played, 0);
    expect(total).toBe(18 * 34);
  });
});

describe('penaltı atışları', () => {
  it('eleme maçında beraberlik penaltılarla biter; lig maçında penaltı yok', () => {
    const world = createWorld(gameData, 3, 'galatasaray', START);
    const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(world, clubId)) });
    let shootouts = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const knockout = createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed, knockout: true }, world.players);
      simulateToEnd(knockout, world.players);
      const result = buildResult(knockout);
      if (result.homeGoals === result.awayGoals) {
        shootouts++;
        expect(result.penalties).toBeDefined();
        expect(result.penalties!.home).not.toBe(result.penalties!.away);
        expect(knockout.events.some((e) => e.type === 'shootout')).toBe(true);
      } else {
        expect(result.penalties).toBeUndefined();
      }
      const league = createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed }, world.players);
      simulateToEnd(league, world.players);
      expect(buildResult(league).penalties).toBeUndefined();
    }
    expect(shootouts).toBeGreaterThan(0);
  });
});
