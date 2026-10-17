/**
 * Oyuncu özellikleri (1–20 ölçeği, FM 2005 benzeri).
 * Anahtarlar İngilizce (kod içi), Türkçe etiketler UI katmanında (src/ui/labels.ts).
 */
export const TECHNICAL_ATTRS = [
  'corners', 'crossing', 'dribbling', 'finishing', 'firstTouch', 'freeKicks', 'heading',
  'longShots', 'longThrows', 'marking', 'passing', 'penaltyTaking', 'tackling', 'technique',
] as const;

export const MENTAL_ATTRS = [
  'aggression', 'anticipation', 'bravery', 'composure', 'concentration', 'creativity', 'decisions',
  'determination', 'flair', 'leadership', 'offTheBall', 'positioning', 'teamwork', 'workRate',
] as const;

export const PHYSICAL_ATTRS = [
  'acceleration', 'agility', 'balance', 'jumping', 'naturalFitness', 'pace', 'stamina', 'strength',
] as const;

export const GOALKEEPING_ATTRS = [
  'aerialAbility', 'commandOfArea', 'communication', 'eccentricity', 'handling', 'kicking',
  'oneOnOnes', 'reflexes', 'rushingOut', 'throwing',
] as const;

/** Oyuncuya gösterilmeyen gizli özellikler. */
export const HIDDEN_ATTRS = ['consistency', 'injuryProneness', 'professionalism'] as const;

export type TechnicalAttr = (typeof TECHNICAL_ATTRS)[number];
export type MentalAttr = (typeof MENTAL_ATTRS)[number];
export type PhysicalAttr = (typeof PHYSICAL_ATTRS)[number];
export type GoalkeepingAttr = (typeof GOALKEEPING_ATTRS)[number];
export type HiddenAttr = (typeof HIDDEN_ATTRS)[number];

export type AttributeKey = TechnicalAttr | MentalAttr | PhysicalAttr | GoalkeepingAttr;
export type Attributes = Record<AttributeKey, number>;
export type HiddenAttributes = Record<HiddenAttr, number>;

export const ALL_ATTRS: readonly AttributeKey[] = [
  ...TECHNICAL_ATTRS,
  ...MENTAL_ATTRS,
  ...PHYSICAL_ATTRS,
  ...GOALKEEPING_ATTRS,
];

/**
 * Oyuncunun genel seviyesinden bağımsız özellikler (karakter + doğal kondisyon):
 * iyi bir oyuncu agresif olmak zorunda değil, vasat biri lider olabilir.
 */
export const LEVEL_INDEPENDENT_ATTRS: readonly AttributeKey[] = [
  'aggression', 'determination', 'leadership', 'flair', 'eccentricity', 'naturalFitness',
];

export const ATTR_MIN = 1;
export const ATTR_MAX = 20;

export function clampAttr(value: number): number {
  return Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(value)));
}
