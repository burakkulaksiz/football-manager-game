/**
 * Moral (0–100): sonuçlar, maç puanı ve forma şansıyla değişir, zamanla 60'a döner.
 * Maçta verime ±%5 etki eder (engine.ts → efficiency).
 */
import { addDays } from '../date';
import { clubPlayers } from '../generation/worldGenerator';
import { addNews } from '../news';
import { isAvailable } from '../player';
import type { Fixture, GameWorld, MatchResult } from '../types';

export const MORALE_BASELINE = 60;
/** Bu sıranın (CA'ya göre kadro sırası) üstündeki oyuncular forma bekler. */
export const EXPECTS_TO_PLAY = 14;
/** Morali bunun altına düşen oyuncu şikâyet eder. */
export const COMPLAINT_THRESHOLD = 30;
const COMPLAINT_COOLDOWN_DAYS = 45;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Maç sonrası moral: sonuç + kişisel performans + forma şansı. */
export function applyMatchMorale(world: GameWorld, fixture: Fixture, result: MatchResult): void {
  for (const clubId of [fixture.homeId, fixture.awayId]) {
    const own = clubId === fixture.homeId ? result.homeGoals : result.awayGoals;
    const opp = clubId === fixture.homeId ? result.awayGoals : result.homeGoals;
    const teamDelta = own > opp ? 5 : own === opp ? 0 : -5;
    const records = new Map(result.players.filter((r) => r.clubId === clubId).map((r) => [r.playerId, r]));
    const ranked = clubPlayers(world, clubId).sort((a, b) => b.currentAbility - a.currentAbility);

    ranked.forEach((p, rank) => {
      const rec = records.get(p.id);
      if (rec) {
        const personal = rec.rating >= 7.5 ? 3 : rec.rating <= 5.5 ? -3 : 0;
        p.morale = clamp(p.morale + teamDelta + personal + (rec.started ? 1 : 0));
      } else if (rank < EXPECTS_TO_PLAY && isAvailable(p)) {
        // Oynamayı bekleyen sağlam oyuncu kenarda kaldı
        p.morale = clamp(p.morale - 3);
      } else {
        p.morale = clamp(p.morale + teamDelta / 2);
      }
    });
  }
}

/**
 * Her gün: moral yavaşça ortalamaya döner (farkın %3'ü, en az 1 puan;
 * yoksa yuvarlama yüzünden küçük farklar hiç kapanmazdı).
 */
export function moraleDrift(world: GameWorld): void {
  for (const p of Object.values(world.players)) {
    const gap = MORALE_BASELINE - p.morale;
    if (gap === 0) continue;
    const step = Math.sign(gap) * Math.max(1, Math.abs(gap) * 0.03);
    p.morale = clamp(Math.abs(step) >= Math.abs(gap) ? MORALE_BASELINE : p.morale + step);
  }
}

/** Haftalık: morali çok düşen oyuncumuz forma şansı için şikâyet eder (haber). */
export function playerComplaints(world: GameWorld): void {
  for (const p of clubPlayers(world, world.playerClubId)) {
    if (p.morale >= COMPLAINT_THRESHOLD || !isAvailable(p)) continue;
    if (p.lastComplaint && addDays(p.lastComplaint, COMPLAINT_COOLDOWN_DAYS) > world.date) continue;
    p.lastComplaint = world.date;
    addNews(world, {
      category: 'player',
      title: `${p.firstName} ${p.lastName} mutsuz`,
      body: `${p.firstName} ${p.lastName} forma şansı bulamamaktan şikâyetçi. Moralini düzeltmek için ona süre vermeyi düşünebilirsin.`,
      important: true,
      playerId: p.id,
      clubId: p.clubId!,
    });
  }
}
