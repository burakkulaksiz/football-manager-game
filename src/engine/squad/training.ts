/** Antrenman: odak (hangi özellikler gelişir) ve yoğunluk (gelişim hızı ↔ kondisyon/sakatlık). */
import {
  MENTAL_ATTRS,
  PHYSICAL_ATTRS,
  TECHNICAL_ATTRS,
  type AttributeKey,
} from '../attributes';
import type { GameWorld, Training, TrainingFocus, TrainingIntensity } from '../types';

export const DEFAULT_TRAINING: Training = { focus: 'balanced', intensity: 'normal' };

export function trainingOf(world: GameWorld, clubId: string | null): Training {
  return (clubId && world.training[clubId]) || DEFAULT_TRAINING;
}

/** Yoğunluğun etkileri. */
export const INTENSITY_EFFECTS: Record<TrainingIntensity, {
  /** Gelişim hızı çarpanı (gerileme etkilenmez). */
  development: number;
  /** Maçlar arasında toparlanılan en yüksek kondisyon. */
  conditionCap: number;
  /** Antrenman sakatlığı riski çarpanı. */
  injury: number;
}> = {
  light: { development: 0.8, conditionCap: 100, injury: 0.6 },
  normal: { development: 1, conditionCap: 98, injury: 1 },
  hard: { development: 1.25, conditionCap: 94, injury: 1.6 },
};

/** Odağın öne çıkardığı özellikler (gelişimde 3 kat ağırlık). */
export const FOCUS_ATTRS: Record<TrainingFocus, readonly AttributeKey[]> = {
  balanced: [],
  physical: PHYSICAL_ATTRS,
  technical: TECHNICAL_ATTRS,
  tactical: MENTAL_ATTRS,
  attacking: ['finishing', 'offTheBall', 'dribbling', 'composure', 'longShots', 'crossing', 'firstTouch', 'technique', 'creativity', 'flair'],
  defending: ['marking', 'tackling', 'positioning', 'heading', 'anticipation', 'concentration', 'bravery', 'strength', 'jumping'],
};
