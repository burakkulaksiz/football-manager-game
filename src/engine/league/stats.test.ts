import { describe, expect, it } from 'vitest';
import { makeResult } from '../testing';
import type { Fixture } from '../types';
import { cleanSheets, playerSeasonStats, topAssists, topRatings, topScorers } from './stats';

const fixtures: Fixture[] = [
  {
    id: 1, round: 1, date: '2026-08-08', homeId: 'a', awayId: 'b',
    result: makeResult(2, 0, [{ minute: 10, clubId: 'a', playerId: 7 }, { minute: 50, clubId: 'a', playerId: 7 }]),
  },
  {
    id: 2, round: 2, date: '2026-08-15', homeId: 'b', awayId: 'a',
    result: makeResult(1, 1, [{ minute: 5, clubId: 'b', playerId: 3 }, { minute: 9, clubId: 'a', playerId: 8 }]),
  },
  { id: 3, round: 3, date: '2026-08-22', homeId: 'a', awayId: 'b', result: null },
];

describe('lig istatistikleri', () => {
  it('gol krallığı sırası', () => {
    expect(topScorers(fixtures)).toEqual([
      { playerId: 7, clubId: 'a', goals: 2 },
      { playerId: 3, clubId: 'b', goals: 1 },
      { playerId: 8, clubId: 'a', goals: 1 },
    ]);
  });

  it('gol yemeden biten maçlar', () => {
    expect(cleanSheets(fixtures, 'a')).toBe(1);
    expect(cleanSheets(fixtures, 'b')).toBe(0);
  });
});

describe('oyuncu sezon istatistikleri', () => {
  const result = makeResult(1, 0, [{ minute: 30, clubId: 'a', playerId: 7, assistId: 9 }]);
  result.players = [
    { playerId: 7, clubId: 'a', started: true, minutes: 90, rating: 8, goals: 1, assists: 0 },
    { playerId: 9, clubId: 'a', started: false, minutes: 20, rating: 7, goals: 0, assists: 1 },
  ];
  result.cards = [{ minute: 50, clubId: 'a', playerId: 9, type: 'yellow' }];
  result.manOfTheMatch = 7;
  const fx: Fixture[] = [{ id: 1, round: 1, date: '2026-08-08', homeId: 'a', awayId: 'b', result }];

  it('maç, gol, asist, kart, ortalama puan', () => {
    expect(playerSeasonStats(fx, 7)).toMatchObject({ apps: 1, starts: 1, goals: 1, manOfTheMatch: 1, avgRating: 8 });
    expect(playerSeasonStats(fx, 9)).toMatchObject({ apps: 1, starts: 0, assists: 1, yellow: 1, avgRating: 7 });
    expect(playerSeasonStats(fx, 1)).toMatchObject({ apps: 0, avgRating: null });
  });

  it('asist ve puan sıralamaları', () => {
    expect(topAssists(fx)).toEqual([{ playerId: 9, clubId: 'a', value: 1, apps: 1 }]);
    expect(topRatings(fx, 1).map((r) => r.playerId)).toEqual([7, 9]);
  });
});
