import {
  ALL_ATTRS,
  clampAttr,
  GOALKEEPING_ATTRS,
  LEVEL_INDEPENDENT_ATTRS,
  TECHNICAL_ATTRS,
  type AttributeKey,
  type Attributes,
  type HiddenAttributes,
} from '../attributes';
import type { GameData } from '../data';
import { addDays, makeDate, type GameDate } from '../date';
import { baseWage, computeCurrentAbility } from '../player';
import { POSITION_WEIGHTS, RELATED_POSITIONS } from '../positions';
import type { Rng } from '../rng';
import type { Foot, Player, Position } from '../types';

export interface PlayerGenOptions {
  position: Position;
  /** Hedef seviye, 1–20 ölçeğinde: kilit özelliklerin ortalaması kabaca bu civarda olur. */
  level: number;
  age: number;
  nationality: string;
  clubId: string | null;
  /** Ham maaşın çarpanı (kulüp itibarı). Kulüp toplamı daha sonra bütçeye göre ölçeklenir. */
  wageFactor: number;
  /** Ek potansiyel (altyapı oyuncuları için). */
  extraPotential?: number;
}

/** Pozisyon için önem ağırlığına göre seviyeden sapma (bkz. POSITION_WEIGHTS). */
const WEIGHT_OFFSET: Record<0 | 1 | 2 | 3, number> = { 0: -2, 1: -0.5, 2: 0.5, 3: 1.5 };

const MENTAL_GROWTH_ATTRS: readonly AttributeKey[] = [
  'decisions', 'composure', 'anticipation', 'positioning', 'concentration',
];
const SPEED_ATTRS: readonly AttributeKey[] = ['pace', 'acceleration', 'agility'];

/** Kalecilerde düşük tutulan saha içi teknik özellikler (pas ve ilk kontrol hariç). */
const GK_WEAK_ATTRS = new Set<AttributeKey>(
  TECHNICAL_ATTRS.filter((a) => a !== 'passing' && a !== 'firstTouch'),
);

function generateAttributes(rng: Rng, position: Position, level: number, age: number): Attributes {
  const weights = POSITION_WEIGHTS[position];
  const isGK = position === 'GK';
  const gkAttrs = new Set<AttributeKey>(GOALKEEPING_ATTRS);
  const attrs = {} as Attributes;

  for (const key of ALL_ATTRS) {
    let value: number;
    if (LEVEL_INDEPENDENT_ATTRS.includes(key)) {
      value = rng.normal(11, 3.5);
    } else if (gkAttrs.has(key) && !isGK) {
      // Saha oyuncularının kalecilik özellikleri çok düşük.
      value = rng.int(1, 4);
    } else if (isGK && GK_WEAK_ATTRS.has(key)) {
      // Kalecilerin saha içi teknik özellikleri düşük.
      value = level - 7 + rng.normal(0, 2);
    } else {
      const w = (weights[key] ?? 0) as 0 | 1 | 2 | 3;
      const spread = w === 0 ? 2.5 : 1.5;
      value = level + WEIGHT_OFFSET[w] + rng.normal(0, spread);
    }
    attrs[key] = value;
  }

  // Yaş etkisi: gençler zihinsel olarak ham, yaşlılar hız kaybeder ama tecrübe kazanır.
  const mentalBonus = Math.max(-2, Math.min(2, (age - 24) * 0.3));
  for (const key of MENTAL_GROWTH_ATTRS) attrs[key] += mentalBonus;
  if (age > 29) for (const key of SPEED_ATTRS) attrs[key] -= (age - 29) * 0.5;
  if (age < 21) attrs.strength -= 21 - age;

  for (const key of ALL_ATTRS) attrs[key] = clampAttr(attrs[key]);
  return attrs;
}

function generateHidden(rng: Rng): HiddenAttributes {
  return {
    consistency: clampAttr(rng.normal(12, 3)),
    injuryProneness: clampAttr(rng.normal(8, 4)),
    professionalism: clampAttr(rng.normal(11, 4)),
  };
}

/** Ana pozisyon 20; %50 ihtimalle 1–2 yakın pozisyonda ek yatkınlık. */
function generatePositions(rng: Rng, position: Position): Partial<Record<Position, number>> {
  const positions: Partial<Record<Position, number>> = { [position]: 20 };
  const related = [...RELATED_POSITIONS[position]];
  const extraCount = rng.weightedIndex([50, 35, 15]);
  rng.shuffle(related);
  for (const p of related.slice(0, extraCount)) {
    positions[p] = rng.int(10, 19);
  }
  return positions;
}

function generateFoot(rng: Rng, position: Position): Foot {
  const leftSided = position === 'DL' || position === 'WBL' || position === 'ML' || position === 'AML';
  const rightSided = position === 'DR' || position === 'WBR' || position === 'MR' || position === 'AMR';
  const [right, left, both] = leftSided ? [10, 82, 8] : rightSided ? [85, 7, 8] : [72, 22, 6];
  return (['right', 'left', 'both'] as const)[rng.weightedIndex([right, left, both])]!;
}

/** Verilen tarihte tam olarak `age` yaşında olacak bir doğum tarihi. */
function birthDateFor(rng: Rng, age: number, date: GameDate): GameDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return addDays(makeDate(y - age, m, d), -rng.int(0, 364));
}

function pickName(rng: Rng, data: GameData, nationality: string): { firstName: string; lastName: string } {
  const nation = data.nations.find((n) => n.code === nationality);
  const pool = nation && data.namePools[nation.namePool];
  if (!pool) throw new Error(`İsim havuzu yok: ${nationality}`);
  return { firstName: rng.pick(pool.firstNames), lastName: rng.pick(pool.lastNames) };
}

/** Potansiyel: genç oyuncunun önünde daha çok gelişme payı var. */
function generatePotential(rng: Rng, ca: number, age: number, extra: number): number {
  const headroom = age < 27 ? (27 - age) * rng.float(1, 5) : rng.int(0, 3);
  return Math.min(200, Math.round(ca + headroom + extra));
}

export function generatePlayer(
  rng: Rng,
  data: GameData,
  id: number,
  date: GameDate,
  opts: PlayerGenOptions,
): Player {
  const { position, level, age, nationality } = opts;
  const attributes = generateAttributes(rng, position, level, age);
  const currentAbility = computeCurrentAbility(attributes, position);
  const potentialAbility = generatePotential(rng, currentAbility, age, opts.extraPotential ?? 0);

  // Sözleşme 30 Haziran'da biter; gençlere daha kısa, diğerlerine 1–5 yıl.
  const contractYears = age < 21 ? rng.int(2, 3) : rng.int(1, 5);
  const startYear = Number(date.slice(0, 4));

  return {
    id,
    ...pickName(rng, data, nationality),
    birthDate: birthDateFor(rng, age, date),
    nationality,
    clubId: opts.clubId,
    squadNumber: null,
    positions: generatePositions(rng, position),
    foot: generateFoot(rng, position),
    attributes,
    hidden: generateHidden(rng),
    currentAbility,
    potentialAbility,
    morale: rng.int(55, 80),
    form: [],
    condition: rng.int(88, 100),
    injury: null,
    contract: {
      wage: baseWage(currentAbility) * opts.wageFactor,
      expires: makeDate(startYear + contractYears, 6, 30),
    },
    loan: null,
    yellowCards: 0,
    suspension: 0,
    progress: 0,
    trend: 0,
    lastComplaint: null,
  };
}
