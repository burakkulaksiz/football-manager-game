/**
 * Taraftar memnuniyeti (0–100; yalnızca kullanıcının kulübü, BoardState.fans, yoksa 60).
 * Maç sonuçları, sezon sonu ve büyük transferlerle değişir; iç saha seyircisini ve yönetimin güvenini etkiler.
 */
import type { Fixture, GameWorld } from '../types';

export const DEFAULT_FANS = 60;
/** Bunun altında yönetim her ay güven kaybeder. */
export const UNHAPPY_FANS = 25;
/** Bunun üstünde yönetim her ay biraz güven kazanır. */
export const DELIGHTED_FANS = 80;

export function fansOf(world: GameWorld): number {
  return world.board.fans ?? DEFAULT_FANS;
}

export function changeFans(world: GameWorld, delta: number): void {
  world.board.fans = Math.max(0, Math.min(100, Math.round((fansOf(world) + delta) * 10) / 10));
}

export function fansLabel(fans: number): string {
  if (fans >= DELIGHTED_FANS) return 'Coşkulu';
  if (fans >= 60) return 'Memnun';
  if (fans >= 40) return 'Kararsız';
  if (fans >= UNHAPPY_FANS) return 'Huzursuz';
  return 'Öfkeli';
}

/** İç saha seyircisine çarpan: öfkeli taraftar ×0,85, coşkulu ×1,15. */
export function fansAttendanceFactor(fans: number): number {
  return 0.85 + 0.3 * (fans / 100);
}

/** Kullanıcının maçından sonra: galibiyet +2, yenilgi −3 (3+ farkla bir puan daha); büyük kulüpte beraberlik −1. */
export function fansAfterMatch(world: GameWorld, fixture: Fixture): void {
  const user = world.playerClubId;
  if (!fixture.result || (fixture.homeId !== user && fixture.awayId !== user)) return;
  const own = fixture.homeId === user ? fixture.result.homeGoals : fixture.result.awayGoals;
  const opp = fixture.homeId === user ? fixture.result.awayGoals : fixture.result.homeGoals;
  const rout = Math.abs(own - opp) >= 3 ? 1 : 0;
  const delta = own > opp ? 2 + rout : own < opp ? -3 - rout : world.board.targetPosition <= 4 ? -1 : 0;
  changeFans(world, delta);
}

/** Ay başı: memnuniyet yavaşça ortalamaya döner (farkın %10'u). */
export function fansMonthly(world: GameWorld): void {
  changeFans(world, (DEFAULT_FANS - fansOf(world)) * 0.1);
}

/** Sezon sonu: şampiyonluk +10, hedef tuttu +5, hedefin 3 sırasından fazla gerisi −8. */
export function fansSeasonEnd(world: GameWorld, position: number): void {
  const diff = world.board.targetPosition - position;
  changeFans(world, position === 1 ? 10 : diff >= 0 ? 5 : diff < -3 ? -8 : 0);
}
