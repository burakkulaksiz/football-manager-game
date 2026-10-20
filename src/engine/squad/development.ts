/**
 * Oyuncu gelişimi (haftalık, pazartesi).
 *
 * Her oyuncunun yaşa göre haftalık "gelişim puanı" vardır (gençlerde artı, 30+ eksi).
 * Artı puan: potansiyele kalan mesafe × profesyonellik × antrenman yoğunluğu ile ölçeklenir.
 * Eksi puan: profesyonellik ve doğal kondisyon yavaşlatır.
 * Birikim ±1'e ulaşınca bir özellik ±1 değişir ve CA yeniden hesaplanır.
 * Artışta hangi özelliğin gelişeceğini mevki ve antrenman odağı, düşüşte çoğunlukla fiziksel özellikler belirler.
 */
import {
  ALL_ATTRS,
  ATTR_MAX,
  ATTR_MIN,
  GOALKEEPING_ATTRS,
  PHYSICAL_ATTRS,
  TECHNICAL_ATTRS,
  type AttributeKey,
} from '../attributes';
import { ageOn, computeCurrentAbility, primaryPosition } from '../player';
import { POSITION_WEIGHTS } from '../positions';
import type { Rng } from '../rng';
import type { GameWorld, Player } from '../types';
import { DEFAULT_TRAINING, FOCUS_ATTRS, INTENSITY_EFFECTS, trainingOf } from './training';

/** Yaşa göre haftalık gelişim puanı (özellik puanı cinsinden). */
export function ageRate(age: number): number {
  if (age <= 18) return 0.5;
  if (age <= 20) return 0.42;
  if (age <= 22) return 0.3;
  if (age <= 24) return 0.18;
  if (age <= 27) return 0.07;
  if (age <= 29) return 0;
  if (age <= 31) return -0.07;
  if (age <= 33) return -0.15;
  return -0.28;
}

/** Antrenmanla geliştirilemeyen özellikler. */
const UNTRAINABLE: ReadonlySet<AttributeKey> = new Set(['aggression', 'eccentricity', 'flair', 'naturalFitness']);
const GK_ATTRS: ReadonlySet<AttributeKey> = new Set(GOALKEEPING_ATTRS);
const PHYSICAL: ReadonlySet<AttributeKey> = new Set(PHYSICAL_ATTRS);
const TECHNICAL: ReadonlySet<AttributeKey> = new Set(TECHNICAL_ATTRS);

function improveAttribute(p: Player, focus: readonly AttributeKey[], rng: Rng): void {
  const position = primaryPosition(p);
  const isGK = position === 'GK';
  const weights = ALL_ATTRS.map((a) => {
    const value = p.attributes[a];
    if (value >= ATTR_MAX || UNTRAINABLE.has(a)) return 0;
    if (GK_ATTRS.has(a) && !isGK) return 0; // saha oyuncusu kalecilik geliştirmez
    if (TECHNICAL.has(a) && isGK) return 0.1; // kaleci saha tekniğini çok az geliştirir
    const positional = POSITION_WEIGHTS[position][a] ?? 0.4;
    const focused = focus.includes(a) ? 3 : 1;
    // Yüksek özellik daha zor gelişir
    return positional * focused * ((ATTR_MAX - value) / 10);
  });
  if (weights.every((w) => w === 0)) return;
  p.attributes[ALL_ATTRS[rng.weightedIndex(weights)]!]++;
}

function declineAttribute(p: Player, rng: Rng): void {
  const isGK = primaryPosition(p) === 'GK';
  const weights = ALL_ATTRS.map((a) => {
    if (p.attributes[a] <= ATTR_MIN || UNTRAINABLE.has(a)) return 0;
    if (PHYSICAL.has(a)) return 3;
    if (GK_ATTRS.has(a)) return isGK ? 1 : 0;
    if (TECHNICAL.has(a)) return isGK ? 0.1 : 1;
    return 0.3;
  });
  if (weights.every((w) => w === 0)) return;
  p.attributes[ALL_ATTRS[rng.weightedIndex(weights)]!]--;
}

/** Bir oyuncunun bir haftalık gelişimi. Değişen özellik sayısını döndürür (+/−). */
export function developPlayer(world: GameWorld, p: Player, rng: Rng): number {
  const age = ageOn(p.birthDate, world.date);
  const base = ageRate(age);
  // Altyapı (U19) kendi antrenman programıyla çalışır: normal yoğunluk, dengeli
  const training = p.academy ? DEFAULT_TRAINING : trainingOf(world, p.clubId);
  const professionalism = p.hidden.professionalism / 20;
  let gain: number;
  if (base > 0) {
    const room = Math.max(0, Math.min(1, (p.potentialAbility - p.currentAbility) / 25));
    gain = base * room * (0.6 + professionalism * 0.8) * INTENSITY_EFFECTS[training.intensity].development;
  } else {
    // Profesyonel ve doğal kondisyonu iyi oyuncu daha yavaş geriler
    gain = base * (1.2 - professionalism * 0.4) * (1.15 - (p.attributes.naturalFitness / 20) * 0.3);
  }
  // Sakat oyuncu gelişemez (gerileme sürer)
  if (p.injury && gain > 0) gain = 0;
  p.progress += gain * rng.float(0.6, 1.4);

  let changes = 0;
  const focus = FOCUS_ATTRS[training.focus];
  while (p.progress >= 1) {
    improveAttribute(p, focus, rng);
    p.progress -= 1;
    changes++;
  }
  while (p.progress <= -1) {
    declineAttribute(p, rng);
    p.progress += 1;
    changes--;
  }
  if (changes !== 0) {
    p.currentAbility = computeCurrentAbility(p.attributes, primaryPosition(p));
    p.potentialAbility = Math.max(p.potentialAbility, p.currentAbility);
  }
  p.trend = Math.round((p.trend * 0.7 + changes) * 100) / 100;
  return changes;
}

/** Haftalık gelişim (tüm oyuncular). */
export function weeklyDevelopment(world: GameWorld, rng: Rng): void {
  for (const p of Object.values(world.players)) developPlayer(world, p, rng);
}
