import { describe, expect, it } from 'vitest';
import type { Fixture } from '../types';
import { computeStandings, goalDifference } from './standings';

let nextId = 1;
function match(homeId: string, awayId: string, hg: number | null, ag = 0, date = '2026-08-08'): Fixture {
  return {
    id: nextId++,
    round: 1,
    date,
    homeId,
    awayId,
    result: hg === null ? null : { homeGoals: hg, awayGoals: ag, goals: [] },
  };
}

describe('puan durumu', () => {
  it('galibiyet 3, beraberlik 1, mağlubiyet 0 puan; goller ve form', () => {
    const table = computeStandings(['a', 'b', 'c'], [
      match('a', 'b', 2, 0),
      match('b', 'c', 1, 1),
      match('c', 'a', 3, 1),
      match('a', 'c', null), // oynanmadı, sayılmaz
    ]);
    const row = (id: string) => table.find((r) => r.clubId === id)!;
    expect(row('a')).toMatchObject({ played: 2, won: 1, lost: 1, points: 3, goalsFor: 3, goalsAgainst: 3 });
    expect(row('b')).toMatchObject({ played: 2, drawn: 1, lost: 1, points: 1 });
    expect(row('c')).toMatchObject({ played: 2, won: 1, drawn: 1, points: 4 });
    expect(table.map((r) => r.clubId)).toEqual(['c', 'a', 'b']);
    expect(row('a').form).toEqual(['W', 'L']);
  });

  it('eşit puanda, karşılıklı maçlar bitmediyse genel averaj belirler', () => {
    // a: G(x) M(b) B(y) = 4 puan, averaj +4 ; b: G(a) B(x) = 4 puan, averaj +1
    const table = computeStandings(['a', 'b', 'x', 'y'], [
      match('a', 'x', 5, 0),
      match('a', 'b', 0, 1), // ikili maçta b önde ama rövanş oynanmadı
      match('b', 'a', null),
      match('a', 'y', 0, 0),
      match('b', 'x', 0, 0),
    ]);
    const a = table.find((r) => r.clubId === 'a')!;
    const b = table.find((r) => r.clubId === 'b')!;
    expect(a.points).toBe(b.points);
    expect(table[0]!.clubId).toBe('a'); // ikili kural uygulanmaz, averajı +4 olan a önde
  });

  it('eşit puanda, karşılıklı maçlar bittiyse ikili puan genel averajdan önce gelir', () => {
    const fixtures = [
      match('a', 'b', 1, 0),
      match('b', 'a', 0, 0), // ikili: a 4 puan, b 1 puan
      match('a', 'x', 0, 1),
      match('x', 'a', 1, 0), // a: toplam 4 puan, averaj -1
      match('b', 'x', 6, 0),
      match('x', 'b', 1, 0), // b: toplam 4 puan, averaj +4
    ];
    const table = computeStandings(['a', 'b', 'x'], fixtures);
    const a = table.find((r) => r.clubId === 'a')!;
    const b = table.find((r) => r.clubId === 'b')!;
    expect(a.points).toBe(b.points);
    expect(table[0]!.clubId).toBe('x'); // 9 puan
    expect(goalDifference(b)).toBeGreaterThan(goalDifference(a)); // averajda b önde
    expect(table.findIndex((r) => r.clubId === 'a')).toBeLessThan(table.findIndex((r) => r.clubId === 'b'));
  });

  it('form en fazla son 5 maçı tutar', () => {
    const fixtures = Array.from({ length: 7 }, (_, i) =>
      match('a', 'b', i % 2, 0, `2026-08-${String(10 + i).padStart(2, '0')}`),
    );
    const a = computeStandings(['a', 'b'], fixtures).find((r) => r.clubId === 'a')!;
    expect(a.form).toEqual(['D', 'W', 'D', 'W', 'D']);
  });
});
