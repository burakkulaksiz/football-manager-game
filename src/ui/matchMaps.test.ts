import { describe, expect, it } from 'vitest';
import type { ShotRecord } from '../engine';
import { heatPoints, shotMarks, shotSummary, territory } from './matchMaps';
import { PITCH_LENGTH, PITCH_WIDTH } from './pitch';

const shot = (s: Partial<ShotRecord>): ShotRecord => ({ minute: 10, side: 'home', playerId: 1, outcome: 'saved', ...s });

describe('şut haritası', () => {
  it('ev sahibi sağdaki, deplasman soldaki kaleye şut çeker; gol ağda biter', () => {
    const [home, away] = shotMarks([shot({ outcome: 'goal' }), shot({ minute: 20, side: 'away', outcome: 'goal' })]);
    expect(home!.from.x).toBeGreaterThan(PITCH_LENGTH / 2);
    expect(home!.to.x).toBeGreaterThan(PITCH_LENGTH);
    expect(away!.from.x).toBeLessThan(PITCH_LENGTH / 2);
    expect(away!.to.x).toBeLessThan(0);
  });

  it('penaltı penaltı noktasından, aut direklerin dışından', () => {
    const [pen, miss] = shotMarks([shot({ kind: 'penalty', outcome: 'missed' }), shot({ minute: 30, outcome: 'missed' })]);
    expect(pen!.from).toEqual({ x: PITCH_LENGTH - 11, y: PITCH_WIDTH / 2 });
    expect(Math.abs(miss!.to.y - PITCH_WIDTH / 2)).toBeGreaterThan(3.66);
  });

  it('aynı dakikadaki iki şut farklı yerde; aynı veri hep aynı yerde', () => {
    const shots = [shot({ outcome: 'saved' }), shot({ outcome: 'blocked' })];
    const a = shotMarks(shots);
    expect(a[0]!.from).not.toEqual(a[1]!.from);
    expect(shotMarks(shots)).toEqual(a);
  });

  it('özet: şut / isabet / gol', () => {
    const shots = [shot({ outcome: 'goal' }), shot({ outcome: 'saved' }), shot({ outcome: 'missed' }), shot({ side: 'away' })];
    expect(shotSummary(shots, 'home')).toEqual({ shots: 3, onTarget: 2, goals: 1 });
  });
});

describe('ısı haritası', () => {
  it('her dakika bir nokta, saha içinde; atak rakip yarıda', () => {
    const pts = heatPoints('hhaAgm|HHcG');
    expect(pts).toHaveLength(10);
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(1);
      expect(p.x).toBeLessThanOrEqual(PITCH_LENGTH - 1);
    }
    expect(pts[2]!.side).toBe('home');
    expect(pts[2]!.x).toBeGreaterThan(PITCH_LENGTH / 2);
    expect(pts[3]!.side).toBe('away');
    expect(pts[3]!.x).toBeLessThan(PITCH_LENGTH / 2);
  });

  it('bölge payları toplamı 100', () => {
    const t = territory(heatPoints('hhhaaaAAcgsmHHkkff|aaaAAA'));
    expect(t.own + t.middle + t.opp).toBe(100);
    expect(territory([])).toEqual({ own: 0, middle: 0, opp: 0 });
  });
});
