/** Taraftar/yönetim beklentisi → hedef lig sırası. */
import type { BoardState, Club, FanExpectation } from '../types';

export const EXPECTATION_TARGET: Record<FanExpectation, number> = {
  title: 1,
  europe: 4,
  top_half: 8,
  mid_table: 12,
  avoid_relegation: 15,
};

/** Kulübün ligi (JSON'da yoksa Süper Lig); 0 = yurtdışı (Türkiye liglerinde değil). */
export function divisionOf(club: Club): 0 | 1 | 2 {
  if (club.country !== undefined) return 0;
  return club.division ?? 1;
}

export function initialBoard(club: Club): BoardState {
  return { confidence: 60, targetPosition: EXPECTATION_TARGET[club.fanExpectation] };
}

/**
 * Yeni sezonda beklenti, itibar sırasından gelir: ilk 3 şampiyonluk, 4–5 Avrupa,
 * 6–9 ilk yarı, 10–14 orta sıra, gerisi ligde kalmak.
 */
export function expectationForRank(rank: number): FanExpectation {
  if (rank <= 3) return 'title';
  if (rank <= 5) return 'europe';
  if (rank <= 9) return 'top_half';
  if (rank <= 14) return 'mid_table';
  return 'avoid_relegation';
}
