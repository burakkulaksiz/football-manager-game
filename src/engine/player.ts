import { ATTR_MAX, ATTR_MIN, type Attributes } from './attributes';
import type { GameDate } from './date';
import { daysBetween } from './date';
import { NATURAL_FAMILIARITY, POSITIONS, POSITION_WEIGHTS } from './positions';
import type { Player, Position } from './types';

/** Verilen tarihteki tam yaş. */
export function ageOn(birthDate: GameDate, date: GameDate): number {
  // Çok sık çağrılır (yapay zekâ taramaları, listeler): Date ya da split yerine sabit konumlardan okunur.
  // 'YYYY-MM-DD' biçiminde ay+gün metin olarak karşılaştırılabilir.
  const age = Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return date.slice(5) < birthDate.slice(5) ? age - 1 : age;
}

/** En yüksek yatkınlıktan başlayarak, doğal (18+) pozisyonlar — saha sırasına göre. */
export function naturalPositions(player: Player): Position[] {
  return POSITIONS.filter((p) => (player.positions[p] ?? 0) >= NATURAL_FAMILIARITY);
}

const POSITION_ORDER: ReadonlyMap<string, number> = new Map(POSITIONS.map((p, i) => [p, i]));

/**
 * Oyuncunun asıl pozisyonu: en yüksek yatkınlık (eşitlikte saha sırası; hiç yatkınlık yoksa saha sırasının ilki).
 * Çok sık çağrılır (kadro seçimi, maç motoru): 14 mevkinin hepsi yerine yalnızca oyuncunun yatkın olduğu (genelde 1–5) mevkiler taranır;
 * sonuç saha sırasıyla tam taramayla aynıdır.
 */
export function primaryPosition(player: Player): Position {
  let best: Position = POSITIONS[0]!;
  let bestValue = 0;
  let bestOrder = 0;
  for (const key in player.positions) {
    const order = POSITION_ORDER.get(key);
    if (order === undefined) continue;
    const v = player.positions[key as Position] ?? 0;
    if (v > bestValue || (v === bestValue && v > 0 && order < bestOrder)) {
      best = key as Position;
      bestValue = v;
      bestOrder = order;
    }
  }
  return best;
}

/**
 * Mevcut yetenek (CA, 1–200): pozisyon ağırlıklı özellik ortalamasının 1–200'e ölçeklenmesi.
 * Ortalama 1 → 1, ortalama 20 → 200. Süper Lig yıldızı ~150+, ortalama oyuncu ~105.
 */
export function computeCurrentAbility(attributes: Attributes, position: Position): number {
  let sum = 0;
  let weightSum = 0;
  for (const [attr, weight] of Object.entries(POSITION_WEIGHTS[position])) {
    sum += attributes[attr as keyof Attributes] * weight;
    weightSum += weight;
  }
  const mean = sum / weightSum;
  const ca = 1 + ((mean - ATTR_MIN) / (ATTR_MAX - ATTR_MIN)) * 199;
  return Math.max(1, Math.min(200, Math.round(ca)));
}

/** Sayıyı 2 anlamlı basamağa yuvarlar (12.345.678 → 12.000.000). */
export function roundNice(n: number): number {
  if (n <= 0) return 0;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / magnitude) * magnitude;
}

/** CA'ya göre ham yıllık maaş (€). Kulüp bütçesine göre sonradan ölçeklenir. */
export function baseWage(currentAbility: number): number {
  return 2000 * Math.exp(currentAbility / 25);
}

/**
 * Piyasa değeri (€) — saklanmaz, her seferinde hesaplanır ki hep güncel olsun.
 * - Temel: CA'ya üstel bağlı (CA 150 ≈ €10 Mn, CA 120 ≈ €1,7 Mn).
 * - Genç ve potansiyeli yüksekse potansiyelin bir kısmı değere eklenir.
 * - 29 yaş sonrası her yıl ~%18 düşer.
 * - Sözleşmesi 1 yıldan az kaldıysa değer düşer.
 */
export function marketValue(player: Player, date: GameDate): number {
  const age = ageOn(player.birthDate, date);
  const youthFactor = Math.max(0, Math.min(1, (24 - age) / 7)) * 0.6;
  const effectiveAbility =
    player.currentAbility + (player.potentialAbility - player.currentAbility) * youthFactor;

  let value = 1500 * Math.exp(effectiveAbility / 17);
  if (age > 29) value *= 0.82 ** (age - 29);

  const yearsLeft = daysBetween(date, player.contract.expires) / 365;
  if (yearsLeft < 1) value *= 0.5 + 0.5 * Math.max(0, yearsLeft);

  return Math.max(10_000, roundNice(value));
}

/** Maç kadrosuna girebilir mi (sakat ya da cezalı değil)? */
export function isAvailable(player: Player): boolean {
  return player.injury === null && player.suspension === 0;
}
