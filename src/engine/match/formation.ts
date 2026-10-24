/**
 * Dizilişler ve otomatik kadro seçimi.
 */
import { isAvailable, primaryPosition } from '../player';
import type { Player, Position } from '../types';
import type { PlayerOrders } from './tactics';

/** 11 mevkilik diziliş (kaleci ilk sırada). */
export type Formation = readonly Position[];

export type FormationId =
  | '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '4-5-1'
  | '4-1-4-1' | '4-4-1-1' | '3-4-3' | '4-3-1-2';

export const FORMATION_IDS: readonly FormationId[] = [
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1', '4-1-4-1', '4-4-1-1', '3-4-3', '4-3-1-2',
];

/** Yapay zekânın seçtiği dizilişler (denge bunlarla ayarlı). */
export const AI_FORMATION_IDS: readonly FormationId[] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1'];

export const FORMATIONS: Record<FormationId, Formation> = {
  '4-4-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'ST', 'ST'],
  '4-3-3': ['GK', 'DR', 'DC', 'DC', 'DL', 'MC', 'MC', 'MC', 'AMR', 'AML', 'ST'],
  '4-2-3-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MC', 'AMR', 'AMC', 'AML', 'ST'],
  '3-5-2': ['GK', 'DC', 'DC', 'DC', 'WBR', 'WBL', 'MC', 'MC', 'AMC', 'ST', 'ST'],
  '5-3-2': ['GK', 'DR', 'DC', 'DC', 'DC', 'DL', 'DM', 'MC', 'MC', 'ST', 'ST'],
  '4-5-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'MC', 'ML', 'ST'],
  '4-1-4-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MR', 'MC', 'MC', 'ML', 'ST'],
  '4-4-1-1': ['GK', 'DR', 'DC', 'DC', 'DL', 'MR', 'MC', 'MC', 'ML', 'AMC', 'ST'],
  '3-4-3': ['GK', 'DC', 'DC', 'DC', 'MR', 'MC', 'MC', 'ML', 'AMR', 'AML', 'ST'],
  '4-3-1-2': ['GK', 'DR', 'DC', 'DC', 'DL', 'DM', 'MC', 'MC', 'AMC', 'ST', 'ST'],
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
  '4-1-4-1': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [50, 61], [85, 45], [62, 47], [38, 47], [15, 45], [50, 16]],
  '4-4-1-1': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [85, 49], [62, 53], [38, 53], [15, 49], [50, 32], [50, 15]],
  '3-4-3': [[50, 91], [72, 76], [50, 79], [28, 76], [86, 50], [62, 54], [38, 54], [14, 50], [80, 24], [20, 24], [50, 15]],
  '4-3-1-2': [[50, 91], [85, 72], [62, 76], [38, 76], [15, 72], [50, 60], [70, 49], [30, 49], [50, 34], [62, 17], [38, 17]],
};

/** Kullanıcının kendi dizilişi: 11 yerin mevkisi ve taktik sahasındaki konumu (kaleci ilk sırada). */
export interface CustomFormation {
  slots: Position[];
  layout: [number, number][];
}

/** Hazır ya da özel diziliş (taktik ve maçtaki takım bunu taşır). */
export interface FormationRef {
  formation: FormationId;
  /** Varsa hazır dizilişin yerine bu kullanılır. */
  custom?: CustomFormation | null;
}

export function slotsOf(f: FormationRef): Formation {
  return f.custom?.slots ?? FORMATIONS[f.formation];
}

export function layoutOf(f: FormationRef): readonly (readonly [number, number])[] {
  return f.custom?.layout ?? FORMATION_LAYOUT[f.formation];
}

/** Özel dizilişte bir saha oyuncusunun konabileceği alan (yüzde). */
export const CUSTOM_BOUNDS = { minX: 6, maxX: 94, minY: 10, maxY: 82 } as const;

/**
 * Taktik sahasındaki konumun mevkisi (x soldan sağa, y yukarıdan aşağı; takım yukarı hücum eder).
 * Kaleci yeri sabittir; saha oyuncusu kaleci olamaz.
 */
export function positionAt(x: number, y: number): Position {
  const side = (right: Position, centre: Position, left: Position, edge = 30) =>
    x > 100 - edge ? right : x < edge ? left : centre;
  if (y < 27) return 'ST';
  if (y < 42) return side('AMR', 'AMC', 'AML', 32);
  if (y < 57) return side('MR', 'MC', 'ML', 30);
  if (y < 67) return side('WBR', 'DM', 'WBL', 28);
  return side('DR', 'DC', 'DL', 28);
}

/**
 * Dizilişin adı: hazır dizilişte kendi adı, özelde satırlar (arkadan öne, yakın yükseklikteki oyuncular aynı satır).
 */
export function formationName(f: FormationRef): string {
  if (!f.custom) return f.formation;
  const ys = f.custom.layout.slice(1).map(([, y]) => y).sort((a, b) => b - a);
  const rows: number[] = [];
  let last = Infinity;
  for (const y of ys) {
    if (last - y > 7 || rows.length === 0) rows.push(1);
    else rows[rows.length - 1]!++;
    last = y;
  }
  return rows.join('-');
}

/** Hazır dizilişten düzenlenebilir özel diziliş. */
export function toCustom(f: FormationRef): CustomFormation {
  return { slots: [...slotsOf(f)], layout: layoutOf(f).map(([x, y]) => [x, y] as [number, number]) };
}

/** Özel dizilişte bir yeri taşır (kaleci taşınmaz); mevki yeni konumdan çıkar. */
export function moveCustomSpot(custom: CustomFormation, index: number, x: number, y: number): CustomFormation {
  if (index <= 0 || index >= custom.slots.length) return custom;
  const b = CUSTOM_BOUNDS;
  const cx = Math.round(Math.max(b.minX, Math.min(b.maxX, x)));
  const cy = Math.round(Math.max(b.minY, Math.min(b.maxY, y)));
  const slots = [...custom.slots];
  const layout = custom.layout.map(([lx, ly]) => [lx, ly] as [number, number]);
  slots[index] = positionAt(cx, cy);
  layout[index] = [cx, cy];
  return { slots, layout };
}

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
  /** `orders`: oyuncunun bireysel talimatları (yoksa varsayılan). */
  starters: { playerId: number; slot: Position; orders?: PlayerOrders }[];
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
  const available = squad.filter(isAvailable);
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

/** Kadro seçiminde yorgun oyuncuya ceza: 85+ kondisyon tam puan, altı orantılı düşer. */
function conditionFactor(condition: number): number {
  return condition >= 85 ? 1 : 0.7 + 0.3 * (condition / 85);
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
  for (const id of AI_FORMATION_IDS) {
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
      const score = p.currentAbility * slotFit(p, pos) * conditionFactor(p.condition);
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
