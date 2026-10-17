/**
 * Diziliş ve otomatik kadro seçimi.
 * 5. aşamada taktik ekranı gelene kadar tüm takımlar varsayılan 4-2-3-1 ile oynar.
 */
import { primaryPosition } from '../player';
import type { Player, Position } from '../types';

/** 11 mevkilik diziliş (kaleci ilk sırada). */
export type Formation = readonly Position[];

export const DEFAULT_FORMATION: Formation = [
  'GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MC', 'AMR', 'AMC', 'AML', 'ST',
];

/** Maç kadrosundaki yedek sayısı. */
export const BENCH_SIZE = 9;

/**
 * Oyuncunun bir mevkideki verimi (0–1).
 * Doğal mevki (20) → 1.0, becerikli (15) → ~0.89, hiç oynamadığı mevki → 0.6,
 * kaleci yerine saha oyuncusu (ya da tersi) → 0.2. Yanlış mevki cezası buradan gelir.
 */
export function slotFit(player: Player, slot: Position): number {
  const familiarity = player.positions[slot];
  if (familiarity !== undefined) return 0.55 + 0.45 * (familiarity / 20);
  const isKeeper = primaryPosition(player) === 'GK';
  if (isKeeper !== (slot === 'GK')) return 0.2;
  return 0.6;
}

export interface Lineup {
  starters: { playerId: number; slot: Position }[];
  bench: number[];
}

/** Doldurulma sırası: az bulunan mevkiler önce seçilsin. */
const FILL_ORDER: readonly Position[] = [
  'GK', 'DC', 'DR', 'DL', 'WBR', 'WBL', 'DM', 'MC', 'AMC', 'MR', 'ML', 'AMR', 'AML', 'ST',
];

/**
 * Otomatik ilk 11: her mevki için (CA × mevki verimi) en yüksek oyuncu, açgözlü seçim.
 * Sakatlar seçilmez. Yedekler: bir kaleci + kalan en iyi oyuncular.
 */
export function autoSelectLineup(squad: readonly Player[], formation: Formation = DEFAULT_FORMATION): Lineup {
  const available = squad.filter((p) => p.injury === null);
  const used = new Set<number>();
  const picked: { playerId: number; slot: Position; order: number }[] = [];

  const slotIndexes = formation
    .map((pos, i) => ({ pos, i }))
    .sort((a, b) => FILL_ORDER.indexOf(a.pos) - FILL_ORDER.indexOf(b.pos));

  for (const { pos, i } of slotIndexes) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const score = p.currentAbility * slotFit(p, pos);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best) {
      picked.push({ playerId: best.id, slot: pos, order: i });
      used.add(best.id);
    }
  }
  // Dizilişteki sıraya geri döndür (kaleci, defans, orta saha, hücum).
  const starters = picked.sort((a, b) => a.order - b.order).map(({ playerId, slot }) => ({ playerId, slot }));

  const rest = available.filter((p) => !used.has(p.id)).sort((a, b) => b.currentAbility - a.currentAbility);
  const bench: number[] = [];
  const backupKeeper = rest.find((p) => primaryPosition(p) === 'GK');
  if (backupKeeper) bench.push(backupKeeper.id);
  for (const p of rest) {
    if (bench.length >= BENCH_SIZE) break;
    if (p !== backupKeeper) bench.push(p.id);
  }
  return { starters, bench };
}
