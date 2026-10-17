import { describe, expect, it } from 'vitest';
import type { MatchResult } from '../types';
import { matchTimeline, teamAppearances } from './report';

const stats = { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0 };

function result(partial: Partial<MatchResult>): MatchResult {
  return {
    homeGoals: 0,
    awayGoals: 0,
    goals: [],
    cards: [],
    injuries: [],
    stats: { home: stats, away: { ...stats } },
    players: [],
    manOfTheMatch: null,
    ...partial,
  };
}

describe('maç raporu', () => {
  it('olaylar dakika ve uzatma sırasıyla dizilir', () => {
    const timeline = matchTimeline(
      result({
        goals: [
          { minute: 46, clubId: 'a', playerId: 1 },
          { minute: 12, clubId: 'b', playerId: 2, kind: 'penalty' },
        ],
        cards: [
          { minute: 45, extra: 2, clubId: 'a', playerId: 3, type: 'yellow' },
          { minute: 80, clubId: 'b', playerId: 4, type: 'red', secondYellow: true },
        ],
        injuries: [{ minute: 45, clubId: 'a', playerId: 5 }],
      }),
    );
    expect(timeline.map((e) => [e.minute, e.extra, e.kind])).toEqual([
      [12, 0, 'penalty'],
      [45, 0, 'injury'],
      [45, 2, 'yellow'],
      [46, 0, 'goal'],
      [80, 0, 'secondYellow'],
    ]);
  });

  it('giriş ve çıkış dakikaları oynanan süreden türetilir', () => {
    const rec = (playerId: number, started: boolean, minutes: number) =>
      ({ playerId, clubId: 'a', started, minutes, rating: 6.5, goals: 0, assists: 0 });
    const apps = teamAppearances(
      result({ players: [rec(1, true, 90), rec(2, true, 67), rec(3, false, 23), rec(4, false, 5), rec(9, true, 90)] }),
      'a',
    );
    expect(apps.map((a) => [a.record.playerId, a.minuteIn, a.minuteOut])).toEqual([
      [1, null, null],
      [2, null, 67],
      [9, null, null],
      [3, 67, null],
      [4, 85, null],
    ]);
  });
});
