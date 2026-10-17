/** Kondisyon: maçta düşer, maçlar arasında günlük toparlanır. */
import type { GameWorld } from '../types';
import { INTENSITY_EFFECTS, trainingOf } from './training';

/**
 * Günlük toparlanma: 6 + doğal kondisyon × 0.25 puan (ortalama ~9).
 * Üst sınırı antrenman yoğunluğu belirler (yoğun antrenmanda oyuncular hep biraz yorgun).
 * Sakat oyuncu 60'ın üstüne çıkmaz.
 */
export function recoverCondition(world: GameWorld): void {
  for (const p of Object.values(world.players)) {
    const cap = p.injury ? 60 : INTENSITY_EFFECTS[trainingOf(world, p.clubId).intensity].conditionCap;
    const rate = 6 + p.attributes.naturalFitness * 0.25;
    if (p.condition < cap) p.condition = Math.min(cap, Math.round(p.condition + rate));
    else if (p.condition > cap) p.condition = Math.max(cap, p.condition - 2);
  }
}
