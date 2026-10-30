import { describe, expect, it } from 'vitest';
import { playerTip } from './labels';

describe('playerTip', () => {
  const p = { firstName: 'Mauro', lastName: 'Icardi' };

  it('isim, mevki, kondisyon ve puan yazar', () => {
    expect(playerTip(p, { slot: 'ST', condition: 82.4, rating: 7.25 }, true)).toBe('Mauro Icardi · FV · Kondisyon %82 · Puan 7.3');
  });

  it('maç başlamadan puan yazmaz; sahada olmayanın mevkisi yok', () => {
    expect(playerTip(p, { slot: null, condition: 100, rating: 6 }, false)).toBe('Mauro Icardi · Kondisyon %100');
  });
});
