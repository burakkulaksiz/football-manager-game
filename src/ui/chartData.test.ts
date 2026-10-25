import { describe, expect, it } from 'vitest';
import type { Fixture } from '../engine';
import { formSeries, positionHistory } from './chartData';

let id = 0;
function fx(round: number, date: string, homeId: string, awayId: string, score: [number, number] | null, competition?: 'cup'): Fixture {
  return { id: ++id, round, date, homeId, awayId, result: score ? { homeGoals: score[0], awayGoals: score[1] } as Fixture['result'] : null, competition };
}

const CLUBS = ['a', 'b', 'c', 'd'];

describe('positionHistory', () => {
  const fixtures = [
    fx(1, '2026-08-01', 'a', 'b', [2, 0]),
    fx(1, '2026-08-01', 'c', 'd', [1, 1]),
    fx(2, '2026-08-08', 'a', 'c', [0, 3]),
    fx(2, '2026-08-08', 'b', 'd', [1, 0]),
    fx(3, '2026-08-15', 'a', 'd', null),
    fx(3, '2026-08-15', 'b', 'c', null),
    fx(2, '2026-08-09', 'a', 'b', [5, 5], 'cup'),
  ];
  const h = positionHistory(CLUBS, fixtures);

  it('yalnızca tamamen oynanmış haftaları alır, kupa maçını saymaz', () => {
    expect(h.rounds).toEqual([1, 2]);
    expect(h.points.get('a')).toEqual([3, 3]);
  });

  it('her haftanın sonundaki sırayı verir', () => {
    expect(h.positions.get('a')![0]).toBe(1);
    expect(h.positions.get('c')).toEqual([2, 1]);
    // Her hafta sıralar 1..N'nin bir permütasyonu
    for (let r = 0; r < h.rounds.length; r++) {
      expect(CLUBS.map((c) => h.positions.get(c)![r]!).sort()).toEqual([1, 2, 3, 4]);
    }
  });
});

describe('formSeries', () => {
  const fixtures = [
    fx(1, '2026-08-01', 'a', 'b', [2, 0]),
    fx(2, '2026-08-08', 'c', 'a', [1, 1]),
    fx(3, '2026-08-15', 'a', 'd', [0, 2]),
    fx(1, '2026-08-20', 'b', 'c', [1, 0]),
    fx(4, '2026-08-22', 'a', 'c', null),
  ];

  it('kulübün oynanmış maçlarını tarih sırasıyla, kendi açısından verir', () => {
    const s = formSeries('a', fixtures);
    expect(s.map((m) => m.outcome)).toEqual(['W', 'D', 'L']);
    expect(s.map((m) => m.opponentId)).toEqual(['b', 'c', 'd']);
    expect(s[1]).toMatchObject({ home: false, scored: 1, conceded: 1 });
  });

  it('son 5 maç ve sezon ortalamasını hesaplar', () => {
    const s = formSeries('a', fixtures);
    expect(s[0]!.rolling).toBe(3);
    expect(s[2]!.rolling).toBeCloseTo(4 / 3);
    expect(s[2]!.seasonAverage).toBeCloseTo(4 / 3);
  });

  it('beş maçtan sonra pencere kayar', () => {
    const many = ['W', 'W', 'W', 'W', 'W', 'L', 'L'].map((o, i) =>
      fx(i + 1, `2026-09-${String(i + 1).padStart(2, '0')}`, 'a', 'b', o === 'W' ? [1, 0] : [0, 1]),
    );
    const s = formSeries('a', many);
    expect(s[4]!.rolling).toBe(3);
    expect(s[6]!.rolling).toBe(3 * 3 / 5);
    expect(s[6]!.seasonAverage).toBeCloseTo(15 / 7);
  });
});
