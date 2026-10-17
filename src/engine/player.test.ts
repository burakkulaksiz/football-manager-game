import { describe, expect, it } from 'vitest';
import { ALL_ATTRS, type Attributes } from './attributes';
import { ageOn, computeCurrentAbility, marketValue, roundNice } from './player';
import type { Player } from './types';

function uniformAttrs(value: number): Attributes {
  return Object.fromEntries(ALL_ATTRS.map((k) => [k, value])) as Attributes;
}

function testPlayer(overrides: Partial<Player>): Player {
  return {
    id: 1, firstName: 'Test', lastName: 'Oyuncu', birthDate: '2000-01-01', nationality: 'TUR',
    clubId: null, squadNumber: null, positions: { ST: 20 }, foot: 'right',
    attributes: uniformAttrs(12), hidden: { consistency: 10, injuryProneness: 10, professionalism: 10 },
    currentAbility: 120, potentialAbility: 120, morale: 70, form: [], condition: 100, injury: null,
    contract: { wage: 500_000, expires: '2029-06-30' }, loan: null,
    yellowCards: 0, suspension: 0, progress: 0, trend: 0, lastComplaint: null,
    ...overrides,
  };
}

describe('oyuncu yardımcıları', () => {
  it('yaşı doğum gününe göre doğru hesaplar', () => {
    expect(ageOn('2000-07-01', '2026-07-01')).toBe(26);
    expect(ageOn('2000-07-02', '2026-07-01')).toBe(25);
    expect(ageOn('2000-06-30', '2026-07-01')).toBe(26);
  });

  it('CA: tüm özellikler 1 → 1, 20 → 200', () => {
    expect(computeCurrentAbility(uniformAttrs(1), 'ST')).toBe(1);
    expect(computeCurrentAbility(uniformAttrs(20), 'ST')).toBe(200);
    expect(computeCurrentAbility(uniformAttrs(20), 'GK')).toBe(200);
  });

  it('CA yalnızca pozisyonla ilgili özelliklerden etkilenir', () => {
    const striker = { ...uniformAttrs(10), finishing: 20 };
    expect(computeCurrentAbility(striker, 'ST')).toBeGreaterThan(computeCurrentAbility(striker, 'DC'));
  });

  it('roundNice 2 anlamlı basamağa yuvarlar', () => {
    expect(roundNice(12_345_678)).toBe(12_000_000);
    expect(roundNice(987)).toBe(990);
  });

  it('piyasa değeri CA ile artar', () => {
    const date = '2026-07-01';
    const weak = marketValue(testPlayer({ currentAbility: 90, potentialAbility: 90 }), date);
    const strong = marketValue(testPlayer({ currentAbility: 150, potentialAbility: 150 }), date);
    expect(strong).toBeGreaterThan(weak * 10);
  });

  it('30 yaş sonrası değer düşer; potansiyelli gencin değeri yüksektir', () => {
    const date = '2026-07-01';
    const prime = marketValue(testPlayer({ birthDate: '2000-01-01' }), date);
    const old = marketValue(testPlayer({ birthDate: '1993-01-01' }), date);
    const talent = marketValue(
      testPlayer({ birthDate: '2008-01-01', currentAbility: 120, potentialAbility: 170 }),
      date,
    );
    expect(old).toBeLessThan(prime);
    expect(talent).toBeGreaterThan(prime);
  });

  it('sözleşmesi bitmek üzere olan oyuncunun değeri düşer', () => {
    const date = '2026-07-01';
    const long = marketValue(testPlayer({}), date);
    const expiring = marketValue(testPlayer({ contract: { wage: 1, expires: '2026-12-31' } }), date);
    expect(expiring).toBeLessThan(long);
  });
});
