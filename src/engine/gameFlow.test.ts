import { describe, expect, it } from 'vitest';
import { gameData } from '../gameData';
import { advance, isSeasonOver, nextMatchDate } from './gameFlow';
import { clubPlayers, createWorld } from './generation/worldGenerator';
import { computeStandings } from './league/standings';
import { selectBestXI, simulateQuickMatch, teamStrength } from './match/quickSim';
import { Rng } from './rng';
import type { GameWorld } from './types';

const START = '2026-07-01';

/** Sezonu sonuna kadar oynatır. */
function playSeason(world: GameWorld): void {
  let guard = 0;
  while (!isSeasonOver(world) && guard++ < 1000) advance(world);
}

describe('oyun akışı', () => {
  it('Devam önce ilk maç gününe gider, sonra maçları oynatır', () => {
    const world = createWorld(gameData, 5, 'galatasaray', START);
    const first = nextMatchDate(world)!;

    const moved = advance(world);
    expect(moved.kind).toBe('moved');
    expect(world.date).toBe(first);

    const played = advance(world);
    expect(played).toMatchObject({ kind: 'played', round: 1 });
    expect(world.date).toBe(first);
    expect(world.season.fixtures.filter((f) => f.round === 1).every((f) => f.result)).toBe(true);
    expect(world.season.fixtures.filter((f) => f.round === 2).every((f) => !f.result)).toBe(true);
  });

  it('tam sezon oynanır; puan tablosu tutarlı', () => {
    const world = createWorld(gameData, 11, 'fenerbahce', START);
    playSeason(world);
    expect(isSeasonOver(world)).toBe(true);

    const table = computeStandings(world.clubs.map((c) => c.id), world.season.fixtures);
    expect(table.every((r) => r.played === 34)).toBe(true);
    const goalsFor = table.reduce((s, r) => s + r.goalsFor, 0);
    const goalsAgainst = table.reduce((s, r) => s + r.goalsAgainst, 0);
    expect(goalsFor).toBe(goalsAgainst);

    // Golleri atan oyuncular o maçta oynayan kulüplerden.
    for (const f of world.season.fixtures) {
      for (const g of f.result!.goals) {
        expect([f.homeId, f.awayId]).toContain(g.clubId);
        expect(world.players[g.playerId]!.clubId).toBe(g.clubId);
      }
      expect(f.result!.goals).toHaveLength(f.result!.homeGoals + f.result!.awayGoals);
    }
  });

  it('aynı seed ile aynı sezon sonuçları', () => {
    const a = createWorld(gameData, 3, 'besiktas', START);
    const b = createWorld(gameData, 3, 'besiktas', START);
    playSeason(a);
    playSeason(b);
    expect(a.season.fixtures).toEqual(b.season.fixtures);
  });
});

describe('anında maç sonucu — istatistik', () => {
  // 20 sezon × 306 maç ≈ 6000 maç
  const fixtures = Array.from({ length: 20 }, (_, i) => {
    const world = createWorld(gameData, 1000 + i, 'galatasaray', START);
    playSeason(world);
    return world;
  });
  const results = fixtures.flatMap((w) => w.season.fixtures.map((f) => f.result!));
  const n = results.length;
  const avgGoals = results.reduce((s, r) => s + r.homeGoals + r.awayGoals, 0) / n;
  const homeWins = results.filter((r) => r.homeGoals > r.awayGoals).length / n;
  const draws = results.filter((r) => r.homeGoals === r.awayGoals).length / n;

  it(`maç başına ~2.6 gol (ölçülen: ${avgGoals.toFixed(2)})`, () => {
    expect(avgGoals).toBeGreaterThan(2.4);
    expect(avgGoals).toBeLessThan(2.85);
  });

  it(`ev sahibi galibiyeti ~%45 (ölçülen: %${(homeWins * 100).toFixed(1)})`, () => {
    expect(homeWins).toBeGreaterThan(0.4);
    expect(homeWins).toBeLessThan(0.5);
  });

  it(`beraberlik ~%25 (ölçülen: %${(draws * 100).toFixed(1)})`, () => {
    expect(draws).toBeGreaterThan(0.2);
    expect(draws).toBeLessThan(0.32);
  });

  it('güçlü takım zayıf takımı çoğunlukla yener', () => {
    const world = createWorld(gameData, 77, 'galatasaray', START);
    const strong = { clubId: 'galatasaray', xi: selectBestXI(clubPlayers(world, 'galatasaray')) };
    const weak = { clubId: 'karagumruk', xi: selectBestXI(clubPlayers(world, 'karagumruk')) };
    expect(teamStrength(strong.xi)).toBeGreaterThan(teamStrength(weak.xi));
    const rng = new Rng(9);
    let wins = 0;
    let losses = 0;
    for (let i = 0; i < 2000; i++) {
      const r = simulateQuickMatch(rng, strong, weak);
      if (r.homeGoals > r.awayGoals) wins++;
      if (r.homeGoals < r.awayGoals) losses++;
    }
    expect(wins / 2000).toBeGreaterThan(0.6);
    expect(losses / 2000).toBeLessThan(0.15);
  });

  it('ilk 11 bir kaleci ve 10 saha oyuncusundan oluşur', () => {
    const world = createWorld(gameData, 1, 'galatasaray', START);
    const xi = selectBestXI(clubPlayers(world, 'trabzonspor'));
    expect(xi).toHaveLength(11);
    expect(xi[0]!.positions.GK).toBe(20);
  });
});
