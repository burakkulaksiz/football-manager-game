import { describe, expect, it } from 'vitest';
import type { Fixture } from '../types';
import { cleanSheets, topScorers } from './stats';

const fixtures: Fixture[] = [
  {
    id: 1, round: 1, date: '2026-08-08', homeId: 'a', awayId: 'b',
    result: {
      homeGoals: 2, awayGoals: 0,
      goals: [{ minute: 10, clubId: 'a', playerId: 7 }, { minute: 50, clubId: 'a', playerId: 7 }],
    },
  },
  {
    id: 2, round: 2, date: '2026-08-15', homeId: 'b', awayId: 'a',
    result: { homeGoals: 1, awayGoals: 1, goals: [{ minute: 5, clubId: 'b', playerId: 3 }, { minute: 9, clubId: 'a', playerId: 8 }] },
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
