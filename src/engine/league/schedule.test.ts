import { describe, expect, it } from 'vitest';
import { weekday } from '../date';
import { Rng } from '../rng';
import { circlePairings, generateSeason, isBreakWeekend, seasonLabel } from './schedule';

const TEAMS = Array.from({ length: 18 }, (_, i) => `t${i + 1}`);
const season = generateSeason(new Rng(1), TEAMS, 2026);
const fx = season.fixtures;

describe('fikstür', () => {
  it('34 hafta × 9 maç = 306 maç', () => {
    expect(fx).toHaveLength(306);
    for (let r = 1; r <= 34; r++) expect(fx.filter((f) => f.round === r)).toHaveLength(9);
  });

  it('her takım her hafta tam bir maç oynar', () => {
    for (let r = 1; r <= 34; r++) {
      const teams = fx.filter((f) => f.round === r).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(teams).size).toBe(18);
    }
  });

  it('her takım diğerleriyle bir kez evinde, bir kez deplasmanda oynar', () => {
    for (const a of TEAMS) {
      for (const b of TEAMS) {
        if (a === b) continue;
        expect(fx.filter((f) => f.homeId === a && f.awayId === b)).toHaveLength(1);
      }
    }
  });

  it('2. devre 1. devrenin ev/deplasman tersi', () => {
    for (const f of fx.filter((f) => f.round <= 17)) {
      const rev = fx.find((g) => g.round === f.round + 17 && g.homeId === f.awayId);
      expect(rev?.awayId).toBe(f.homeId);
    }
  });

  it('hiçbir takım üst üste 3 maçtan fazla evinde ya da deplasmanda oynamaz', () => {
    for (const t of TEAMS) {
      const venues = fx
        .filter((f) => f.homeId === t || f.awayId === t)
        .sort((a, b) => a.round - b.round)
        .map((f) => (f.homeId === t ? 'H' : 'A'))
        .join('');
      expect(venues).not.toMatch(/HHHH|AAAA/);
    }
  });

  it('maçlar cumartesi, Ağustos–Mayıs arası, aralar boş ve haftalar sıralı', () => {
    const dates = [...new Set(fx.map((f) => f.date))];
    expect(dates).toHaveLength(34);
    for (const d of dates) {
      expect(weekday(d)).toBe(6);
      expect(isBreakWeekend(d)).toBe(false);
    }
    expect(dates[0]! >= '2026-08-08').toBe(true);
    expect(dates[33]! <= '2027-05-31').toBe(true);
    expect([...dates].sort()).toEqual(dates);
  });

  it('çember yöntemi tek sayıda takımı reddeder', () => {
    expect(() => circlePairings(['a', 'b', 'c'])).toThrow();
  });

  it('sezon etiketi', () => {
    expect(seasonLabel(2026)).toBe('2026/27');
    expect(seasonLabel(2099)).toBe('2099/00');
  });
});
