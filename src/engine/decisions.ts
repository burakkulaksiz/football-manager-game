/**
 * Karar bekleyen konular (saf): bunlar varken Devam tarihi ilerletmez (arayüz listeyi gösterir).
 * - Oyuncumuza gelen teklif (yanıt bekliyor), verdiğimiz teklife karşı teklif, kabul edilen teklifte sözleşme görüşmesi.
 * - Oyuncu görüşme talebi.
 * - Yazın (Temmuz–Ağustos) U19 yaş sınırını geçen genç (A takıma al ya da bırak).
 * - Sezonun son iki haftası: sözleşmesi 30 Haziran'da bitecek önemli oyuncu (yenile ya da gitmesine izin ver).
 */
import { makeDate } from './date';
import { clubPlayers } from './generation/worldGenerator';
import { academyPlayers, isOverAge } from './squad/academy';
import type { GameWorld } from './types';

export type DecisionKind = 'offer' | 'counter' | 'contract' | 'request' | 'overAge' | 'expiring';

export interface Decision {
  /** Benzersiz (gitmesine izin verilen sözleşmeler bununla hatırlanır). */
  id: string;
  kind: DecisionKind;
  playerId: number;
  offerId?: number;
  requestId?: number;
}

/** Kadronun bu kadar iyisinin sözleşmesi bitecekse karar istenir. */
export const EXPIRING_SQUAD_RANK = 18;
/** Sezon sonundan (30 Haziran) kaç gün önce sözleşme kararı istenir. */
export const EXPIRING_NOTICE_DAYS = 14;

export function pendingDecisions(world: GameWorld): Decision[] {
  if (world.gameOver) return [];
  const user = world.playerClubId;
  const out: Decision[] = [];
  for (const o of world.offers) {
    if (o.sellerId === user && o.status === 'pending') out.push({ id: `offer-${o.id}`, kind: 'offer', playerId: o.playerId, offerId: o.id });
    else if (o.buyerId === user && o.status === 'countered') out.push({ id: `counter-${o.id}`, kind: 'counter', playerId: o.playerId, offerId: o.id });
    else if (o.buyerId === user && o.status === 'accepted') out.push({ id: `contract-${o.id}`, kind: 'contract', playerId: o.playerId, offerId: o.id });
  }
  for (const r of world.requests) out.push({ id: `request-${r.id}`, kind: 'request', playerId: r.playerId, requestId: r.id });
  // U19 yaş sınırı 1 Temmuz'da değerlendirilir: karar yazın (Temmuz–Ağustos) istenir, sezon ortasında 19'una basan beklemez
  const month = Number(world.date.slice(5, 7));
  if (month === 7 || month === 8) {
    for (const p of academyPlayers(world, user)) {
      if (isOverAge(p, world.date)) out.push({ id: `overAge-${p.id}`, kind: 'overAge', playerId: p.id });
    }
  }
  // Sezonun son iki haftası: sözleşmesi bitecek önemli oyuncular
  const year = Number(world.date.slice(0, 4));
  const seasonEnd = makeDate(year, 6, 30);
  const daysLeft = (Date.parse(seasonEnd) - Date.parse(world.date)) / 86_400_000;
  if (daysLeft >= 0 && daysLeft <= EXPIRING_NOTICE_DAYS) {
    const squad = clubPlayers(world, user).sort((a, b) => b.currentAbility - a.currentAbility).slice(0, EXPIRING_SQUAD_RANK);
    const dismissed = new Set(world.dismissedDecisions ?? []);
    for (const p of squad) {
      const id = `expiring-${p.id}-${year}`;
      if (!p.loan && p.contract.expires === seasonEnd && !dismissed.has(id)) out.push({ id, kind: 'expiring', playerId: p.id });
    }
  }
  return out;
}

/** Sözleşmesi bitecek oyuncunun gitmesine izin ver (kararı kapatır; oyuncu 30 Haziran'da ayrılır). */
export function letContractExpire(world: GameWorld, decisionId: string): void {
  const list = (world.dismissedDecisions ??= []);
  if (!list.includes(decisionId)) list.push(decisionId);
  if (list.length > 200) list.splice(0, list.length - 200);
}
