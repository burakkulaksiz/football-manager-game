/**
 * Gelişim geçmişi: genç oyuncuların (≤ 23 yaş) aylık yetenek (CA) kaydı.
 * Altyapı ekranındaki gelişim grafikleri ve "son 6 ay" değerlendirmesi buradan gelir.
 * Kayıt sıkı tutulur: başlangıç ayı + art arda aylık değerler (en fazla 36 ay).
 */
import { ageOn } from '../player';
import type { GameWorld, Player } from '../types';

/** Bu yaştan büyük oyuncunun geçmişi tutulmaz (kayıt boyutu). */
export const GROWTH_MAX_AGE = 23;
/** En fazla kaç ay tutulur. */
export const GROWTH_MONTHS = 36;

/** 'YYYY-MM' ayına `n` ay ekler. */
export function addMonths(month: string, n: number): string {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** İki ay arasındaki fark (b − a, ay olarak). */
export function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}

/** Oyuncunun bu ayki yeteneğini kaydeder (aynı ay ikinci kez yazılmaz; ara aylar son değerle doldurulur). */
export function recordPlayerGrowth(p: Player, month: string): void {
  if (!p.growth) {
    p.growth = { start: month, ca: [p.currentAbility] };
    return;
  }
  const g = p.growth;
  const last = addMonths(g.start, g.ca.length - 1);
  const gap = monthsBetween(last, month);
  if (gap <= 0) return;
  for (let i = 1; i < gap; i++) g.ca.push(g.ca[g.ca.length - 1]!);
  g.ca.push(p.currentAbility);
  if (g.ca.length > GROWTH_MONTHS) {
    const drop = g.ca.length - GROWTH_MONTHS;
    g.ca.splice(0, drop);
    g.start = addMonths(g.start, drop);
  }
}

/** Ay başı: kulübü olan genç oyuncuların yeteneğini kaydeder; yaşı geçenlerin geçmişini siler. */
export function recordGrowth(world: GameWorld): void {
  const month = world.date.slice(0, 7);
  for (const p of Object.values(world.players)) {
    if (ageOn(p.birthDate, world.date) > GROWTH_MAX_AGE) {
      delete p.growth;
      continue;
    }
    if (p.clubId) recordPlayerGrowth(p, month);
  }
}

/** Son `months` aydaki yetenek değişimi (geçmiş yoksa 0). */
export function growthChange(p: Player, months: number): number {
  const ca = p.growth?.ca;
  if (!ca || ca.length < 2) return 0;
  const from = ca[Math.max(0, ca.length - 1 - months)]!;
  return p.currentAbility - from;
}

export type GrowthRate = 'fast' | 'good' | 'slow' | 'falling' | 'none';

/** Son 6 ayın gelişim değerlendirmesi (yetenek puanı gizli; ekranda yalnızca bu etiket görünür). */
export function growthRate(p: Player): GrowthRate {
  if (!p.growth || p.growth.ca.length < 3) return 'none';
  const change = growthChange(p, 6);
  if (change >= 10) return 'fast';
  if (change >= 4) return 'good';
  if (change >= 0) return 'slow';
  return 'falling';
}
