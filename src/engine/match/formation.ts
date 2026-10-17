/**
 * Dizilişler ve otomatik kadro seçimi.
 */
import { primaryPosition } from '../player';
import type { Player, Position } from '../types';

/** 11 mevkilik diziliş (kaleci ilk sırada). */
export type Formation = readonly Position[];

export type FormationId = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '4-5-1';

export const FORMATION_IDS: readonly FormationId[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1'];

export const FORMATIONS: Record<FormationId, Formation> = {
  '4-4-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'],
  '4-3-3': ['GK', 'DR', 'DC', 'DC', 'DL', 'MC', 'MC', 'MC', 'AMR', 'AML', 'ST'],
  '4-2-3-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MC', 'AMR', 'AMC', 'AML', 'ST'],
  '3-5-2': ['GK', 'DC', 'DC', 'DC', 'WBR', 'WBL', 'MC', 'MC', 'AMC', 'ST', 'ST'],
  '5-3-2': ['GK', 'DR', 'DC', 'DC', 'DC', 'DL', 'DM', 'MC', 'MC', 'ST', 'ST'],
  '4-5-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'MC', 'ML', 'ST'],
};

/**
 * Taktik sahasında her mevkinin yeri (yüzde): x soldan sağa, y yukarıdan aşağı.
 * Takım yukarı doğru hücum eder; sağ bek sağda (x büyük) durur.
 */
export const FORMATION_LAYOUT: Record<FormationId, readonly [number, number][]> = {
  '4-4-2': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [85, 47], [62, 51], [38, 51], [15, 47], [62, 19], [38, 19]],
  '4-3-3': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [72, 50], [50, 55], [28, 50], [83, 25], [17, 25], [50, 16]],
  '4-2-3-1': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [38, 59], [62, 57], [83, 33], [50, 35], [17, 33], [50, 14]],
  '3-5-2': [[50, 91], [72, 76], [50, 79], [28, 76], [88, 50], [12, 50], [64, 54], [36, 54], [50, 35], [62, 17], [38, 17]],
  '5-3-2': [[50, 91], [88, 68], [70, 77], [50, 79], [30, 77], [12, 68], [50, 59], [70, 47], [30, 47], [62, 19], [38, 19]],
  '4-5-1': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [85, 45], [67, 50], [50, 55], [33, 50], [15, 45], [50, 16]],
};

export const DEFAULT_FORMATION_ID: FormationId = '4-2-3-1';
export const DEFAULT_FORMATION: Formation = FORMATIONS[DEFAULT_FORMATION_ID];

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
  const assigned = assignToFormation(available, formation);
  const starters = assigned.flatMap((playerId, i) => (playerId === null ? [] : [{ playerId, slot: formation[i]! }]));
  const used = new Set(starters.map((s) => s.playerId));
  return { starters, bench: autoBench(available, used) };
}

/** Otomatik yedekler: bir kaleci + kalan en iyi oyuncular (en fazla BENCH_SIZE). */
export function autoBench(available: readonly Player[], used: ReadonlySet<number>): number[] {
  const rest = available.filter((p) => !used.has(p.id)).sort((a, b) => b.currentAbility - a.currentAbility);
  const bench: number[] = [];
  const backupKeeper = rest.find((p) => primaryPosition(p) === 'GK');
  if (backupKeeper) bench.push(backupKeeper.id);
  for (const p of rest) {
    if (bench.length >= BENCH_SIZE) break;
    if (p !== backupKeeper) bench.push(p.id);
  }
  return bench;
}

/** Kadronun bir dizilişe uygunluğu: ilk 11'in (CA × mevki verimi) toplamı. */
export function lineupStrength(squad: readonly Player[], lineup: Lineup): number {
  const byId = new Map(squad.map((p) => [p.id, p]));
  return lineup.starters.reduce((sum, { playerId, slot }) => {
    const p = byId.get(playerId);
    return p ? sum + p.currentAbility * slotFit(p, slot) : sum;
  }, 0);
}

/** Yapay zekâ: kadrosuna en uygun dizilişi seçer. */
export function chooseFormation(squad: readonly Player[]): FormationId {
  let best = DEFAULT_FORMATION_ID;
  let bestScore = -1;
  for (const id of FORMATION_IDS) {
    const score = lineupStrength(squad, autoSelectLineup(squad, FORMATIONS[id]));
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Var olan oyuncuları yeni dizilişin mevkilerine en iyi uyumla dağıtır (açgözlü).
 * Sonuç dizisi formation ile aynı sırada; oyuncu yetmezse bazı mevkiler null kalır.
 */
export function assignToFormation(players: readonly Player[], formation: Formation): (number | null)[] {
  const result: (number | null)[] = new Array(formation.length).fill(null);
  const used = new Set<number>();
  const order = formation
    .map((pos, i) => ({ pos, i }))
    .sort((a, b) => FILL_ORDER.indexOf(a.pos) - FILL_ORDER.indexOf(b.pos));
  for (const { pos, i } of order) {
    let best: Player | null = null;
    let bestScore = -1;
    for (const p of players) {
      if (used.has(p.id)) continue;
      const score = p.currentAbility * slotFit(p, pos);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best) {
      result[i] = best.id;
      used.add(best.id);
    }
  }
  return result;
}
