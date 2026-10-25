/**
 * Tekrarlanabilirlik: aynı tohumla iki dünya bir tam sezonu (milli maçlar dahil) ve yeni sezonun ilk haftalarını aynı oynar.
 * Ağır (iki dünya, iki sezon); diğer testlerden ayrı dosyada ki paralel koşabilsin. Önceden gameFlow.test (tam sezon) ve
 * season.test (sezon geçişi) iki ayrı ikili simülasyon yapıyordu; tek testte iki aşamada karşılaştırılır.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { createWorld } from '../generation/worldGenerator';
import { playUntil } from '../testing';

const START = '2026-07-01';

describe('tekrarlanabilirlik', () => {
  it('aynı seed ile aynı sezon sonuçları ve sezon geçişinden sonra aynı yeni sezon', () => {
    const a = createWorld(gameData, 55, 'trabzonspor', START);
    const b = createWorld(gameData, 55, 'trabzonspor', START);
    // 1) Sezon kapandıktan sonra, yeni sezon başlamadan (fikstür hâlâ biten sezonun): tüm sonuçlar ve milli maçlar aynı
    playUntil(a, '2027-06-15');
    playUntil(b, '2027-06-15');
    expect(a.seasonState).toBe('ended');
    expect(a.season.fixtures).toEqual(b.season.fixtures);
    expect(a.international.fixtures).toEqual(b.international.fixtures);
    // 2) Sezon geçişi (emeklilik, altyapı, transferler, yeni fikstür) ve yeni sezonun ilk haftaları da aynı
    playUntil(a, '2027-08-20');
    playUntil(b, '2027-08-20');
    expect(a.season.fixtures).toEqual(b.season.fixtures);
    expect(a.history).toEqual(b.history);
  }, 120_000);
});
