import { describe, expect, it } from 'vitest';
import { gameData } from '../gameData';
import { advance, finishUserMatch, isSeasonOver, nextMatchDate, startUserMatch } from './gameFlow';
import { createWorld } from './generation/worldGenerator';
import { computeStandings } from './league/standings';
import { simulateToEnd } from './match/engine';
import { playSeason } from './testing';
import type { GameWorld } from './types';

const START = '2026-07-01';

/** Devam'a, bir sonraki maç gününe varana kadar basar (aradaki haber duraklarını geçer). */
function advanceToMatchDay(world: GameWorld): void {
  const target = nextMatchDate(world)!;
  while (world.date < target) {
    const r = advance(world);
    expect(r.kind).toBe('moved');
  }
}

describe('oyun akışı', () => {
  it('Devam ya önemli bir haberde ya da maç gününde durur; maç günü canlı maç için durur', () => {
    const world = createWorld(gameData, 5, 'galatasaray', START);
    const first = nextMatchDate(world)!;

    const r = advance(world);
    expect(r.kind).toBe('moved');
    if (r.kind === 'moved' && world.date < first) expect(r.news.length).toBeGreaterThan(0);
    advanceToMatchDay(world);
    expect(world.date).toBe(first);

    const result = advance(world);
    expect(result.kind).toBe('userMatch');
    // Kendi maçımız oynanmadan diğer maçlar da oynanmaz.
    expect(world.season.fixtures.filter((f) => f.round === 1).every((f) => !f.result)).toBe(true);
  });

  it('canlı maç bitince sonuç işlenir ve haftanın diğer maçları oynanır', () => {
    const world = createWorld(gameData, 6, 'besiktas', START);
    advanceToMatchDay(world);
    const state = startUserMatch(world)!;
    expect(state).not.toBeNull();
    simulateToEnd(state, world.players);
    const round = finishUserMatch(world, state);
    expect(round).toHaveLength(9);
    expect(round.every((f) => f.result !== null)).toBe(true);
    const own = round.find((f) => f.id === state.fixtureId)!;
    expect(own.result!.homeGoals).toBe(state.score.home);
    // Maça çıkan oyuncuların formuna puan eklendi.
    const someone = own.result!.players[0]!;
    expect(world.players[someone.playerId]!.form).toEqual([someone.rating]);
  });

  it('tam sezon oynanır; puan tablosu ve gol kayıtları tutarlı', () => {
    const world = createWorld(gameData, 11, 'fenerbahce', START);
    playSeason(world);
    expect(isSeasonOver(world)).toBe(true);

    const table = computeStandings(world.clubs.map((c) => c.id), world.season.fixtures);
    expect(table.every((r) => r.played === 34)).toBe(true);
    expect(table.reduce((s, r) => s + r.goalsFor, 0)).toBe(table.reduce((s, r) => s + r.goalsAgainst, 0));

    for (const f of world.season.fixtures) {
      const r = f.result!;
      expect(r.goals).toHaveLength(r.homeGoals + r.awayGoals);
      for (const g of r.goals) {
        expect([f.homeId, f.awayId]).toContain(g.clubId);
        // Oyuncu sonradan transfer olmuş olabilir; o maçta o kulüp adına oynamış olmalı.
        expect(r.players.find((p) => p.playerId === g.playerId)?.clubId).toBe(g.clubId);
      }
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
