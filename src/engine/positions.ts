import type { AttributeKey } from './attributes';
import type { Position } from './types';

/** Sahadaki sıraya göre (kaleden forvete) pozisyonlar. */
export const POSITIONS: readonly Position[] = [
  'GK', 'DR', 'DC', 'DL', 'WBR', 'WBL', 'DM', 'MR', 'MC', 'ML', 'AMR', 'AMC', 'AML', 'ST',
];

/** İkincil pozisyon üretiminde kullanılan "yakın" pozisyonlar. */
export const RELATED_POSITIONS: Record<Position, readonly Position[]> = {
  GK: [],
  DR: ['WBR', 'DC', 'MR'],
  DC: ['DR', 'DL', 'DM'],
  DL: ['WBL', 'DC', 'ML'],
  WBR: ['DR', 'MR', 'AMR'],
  WBL: ['DL', 'ML', 'AML'],
  DM: ['MC', 'DC'],
  MR: ['AMR', 'WBR', 'MC', 'ML'],
  MC: ['DM', 'AMC', 'MR', 'ML'],
  ML: ['AML', 'WBL', 'MC', 'MR'],
  AMR: ['MR', 'AML', 'AMC', 'ST'],
  AMC: ['MC', 'ST', 'AMR', 'AML'],
  AML: ['ML', 'AMR', 'AMC', 'ST'],
  ST: ['AMC', 'AMR', 'AML'],
};

type Weight = 1 | 2 | 3;

/**
 * Her pozisyon için özelliklerin önemi: 3 = kilit, 2 = önemli, 1 = yardımcı.
 * Listede olmayan özellikler o pozisyonun mevcut yeteneğine (CA) katkı vermez.
 * Hem oyuncu üretiminde (hangi özellikler yüksek olsun) hem CA hesabında kullanılır.
 */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, Weight>>> = {
  GK: {
    handling: 3, reflexes: 3, oneOnOnes: 2, aerialAbility: 2, commandOfArea: 2, positioning: 2,
    concentration: 2, agility: 2, communication: 1, kicking: 1, rushingOut: 1, throwing: 1,
    decisions: 1, jumping: 1, composure: 1, anticipation: 1,
  },
  DC: {
    marking: 3, tackling: 3, heading: 3, positioning: 3, strength: 2, jumping: 2, anticipation: 2,
    bravery: 2, concentration: 2, decisions: 1, composure: 1, pace: 1, passing: 1,
  },
  DR: {
    pace: 3, tackling: 2, marking: 2, positioning: 2, crossing: 2, stamina: 2, acceleration: 2,
    workRate: 1, teamwork: 1, dribbling: 1, passing: 1, anticipation: 1, concentration: 1,
  },
  DL: {
    pace: 3, tackling: 2, marking: 2, positioning: 2, crossing: 2, stamina: 2, acceleration: 2,
    workRate: 1, teamwork: 1, dribbling: 1, passing: 1, anticipation: 1, concentration: 1,
  },
  WBR: {
    crossing: 3, pace: 3, stamina: 3, dribbling: 2, workRate: 2, acceleration: 2, tackling: 1,
    marking: 1, passing: 1, teamwork: 1, offTheBall: 1, technique: 1,
  },
  WBL: {
    crossing: 3, pace: 3, stamina: 3, dribbling: 2, workRate: 2, acceleration: 2, tackling: 1,
    marking: 1, passing: 1, teamwork: 1, offTheBall: 1, technique: 1,
  },
  DM: {
    tackling: 3, positioning: 3, marking: 2, passing: 2, anticipation: 2, workRate: 2, teamwork: 2,
    decisions: 2, stamina: 1, strength: 1, concentration: 1, firstTouch: 1,
  },
  MC: {
    passing: 3, decisions: 2, creativity: 2, firstTouch: 2, technique: 2, teamwork: 2, workRate: 2,
    stamina: 2, longShots: 1, tackling: 1, anticipation: 1, offTheBall: 1, composure: 1,
  },
  MR: {
    crossing: 3, pace: 2, dribbling: 2, stamina: 2, passing: 2, workRate: 2, acceleration: 2,
    technique: 1, offTheBall: 1, teamwork: 1, firstTouch: 1,
  },
  ML: {
    crossing: 3, pace: 2, dribbling: 2, stamina: 2, passing: 2, workRate: 2, acceleration: 2,
    technique: 1, offTheBall: 1, teamwork: 1, firstTouch: 1,
  },
  AMR: {
    dribbling: 3, pace: 3, acceleration: 3, crossing: 2, technique: 2, flair: 2, offTheBall: 2,
    agility: 2, finishing: 1, firstTouch: 1, creativity: 1, passing: 1,
  },
  AML: {
    dribbling: 3, pace: 3, acceleration: 3, crossing: 2, technique: 2, flair: 2, offTheBall: 2,
    agility: 2, finishing: 1, firstTouch: 1, creativity: 1, passing: 1,
  },
  AMC: {
    passing: 3, creativity: 3, technique: 2, firstTouch: 2, dribbling: 2, flair: 2, decisions: 2,
    offTheBall: 2, longShots: 2, finishing: 1, composure: 1, agility: 1,
  },
  ST: {
    finishing: 3, offTheBall: 3, composure: 2, firstTouch: 2, heading: 2, pace: 2,
    acceleration: 2, anticipation: 2, dribbling: 1, strength: 1, technique: 1, jumping: 1,
  },
};

/** Pozisyon yatkınlığı bu değer ve üstündeyse "doğal" pozisyon. */
export const NATURAL_FAMILIARITY = 18;
