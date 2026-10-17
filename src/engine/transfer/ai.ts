/**
 * Yapay zekâ transferleri: kulüpler arası alımlar ve kullanıcının oyuncularına teklifler.
 * Yalnızca transfer döneminde, günlük küçük olasılıklarla çalışır.
 */
import { addDays } from '../date';
import { clubPlayers, getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { ageOn, marketValue, primaryPosition, roundNice } from '../player';
import type { Rng } from '../rng';
import type { Club, GameWorld, Player } from '../types';
import {
  askingPrice,
  formatPlain,
  groupOf,
  preferredYears,
  transferPlayer,
  wageDemand,
  willingToJoin,
  type PositionGroup,
} from './market';
import { isActive, MIN_SQUAD_TO_SELL } from './offers';
import { transferWindow } from './window';

/** Kadroda istenen en az oyuncu sayısı (mevki grubuna göre). */
const GROUP_TARGET: Record<PositionGroup, number> = { GK: 3, DEF: 8, MID: 7, ATT: 6 };
/** Bu kadro büyüklüğüne ulaşan kulüp oyuncu almaz. */
export const MAX_SQUAD = 28;

/** Günlük alım girişimi olasılığı (yaz / devre arası). */
const BUY_CHANCE = { summer: 0.05, winter: 0.03 };
/** Kullanıcıya günlük teklif gelme olasılığı. */
const OFFER_CHANCE = { summer: 0.06, winter: 0.04 };

function topElevenAverage(squad: readonly Player[]): number {
  const cas = squad.map((p) => p.currentAbility).sort((a, b) => b - a).slice(0, 11);
  return cas.length === 0 ? 0 : cas.reduce((a, b) => a + b, 0) / cas.length;
}

/** Kadronun en çok ihtiyaç duyduğu mevki grubu. */
function neededGroup(rng: Rng, squad: readonly Player[]): PositionGroup {
  const counts: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of squad) counts[groupOf(primaryPosition(p))]++;
  const groups = Object.keys(GROUP_TARGET) as PositionGroup[];
  const deficits = groups.map((g) => GROUP_TARGET[g] - counts[g]);
  const worst = Math.max(...deficits);
  if (worst > 0) return groups[deficits.indexOf(worst)]!;
  return groups[rng.weightedIndex([0.1, 0.3, 0.3, 0.3])]!;
}

/** Bir yapay zekâ kulübünün alım girişimi. */
function attemptPurchase(world: GameWorld, buyer: Club, rng: Rng): void {
  const squad = clubPlayers(world, buyer.id);
  if (squad.length >= MAX_SQUAD) return;
  const fin = world.finances[buyer.id]!;
  if (fin.transferBudget < 250_000) return;

  const group = neededGroup(rng, squad);
  const level = topElevenAverage(squad);
  const squadSizes = new Map<string, number>();
  for (const p of Object.values(world.players)) if (p.clubId) squadSizes.set(p.clubId, (squadSizes.get(p.clubId) ?? 0) + 1);

  const candidates: { player: Player; price: number; score: number }[] = [];
  for (const p of Object.values(world.players)) {
    if (!p.clubId || p.clubId === buyer.id || p.clubId === world.playerClubId || p.loan) continue;
    if (groupOf(primaryPosition(p)) !== group) continue;
    if ((squadSizes.get(p.clubId) ?? 0) <= MIN_SQUAD_TO_SELL + 2) continue;
    if (ageOn(p.birthDate, world.date) > 32 || p.currentAbility < level - 8) continue;
    if (getClub(world, p.clubId).reputation > buyer.reputation + 5) continue;
    if (!willingToJoin(world, p, buyer.id)) continue;
    const price = askingPrice(world, p);
    if (price > fin.transferBudget) continue;
    // Yetenek iyi, fiyat bütçeye göre makul olsun
    candidates.push({ player: p, price, score: p.currentAbility - (price / fin.transferBudget) * 15 + rng.float(0, 6) });
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => b.score - a.score);
  const pick = candidates[Math.min(candidates.length - 1, rng.int(0, 2))]!;
  const fee = Math.min(fin.transferBudget, roundNice(pick.price * rng.float(0.9, 1.08)));
  const [minYears, maxYears] = preferredYears(ageOn(pick.player.birthDate, world.date));
  transferPlayer(world, pick.player, buyer.id, fee, {
    wage: wageDemand(world, pick.player, buyer.id),
    years: rng.int(minYears, maxYears),
    signingBonus: 0,
  });
}

/** Yapay zekâ kulüplerinden kullanıcının bir oyuncusuna teklif. */
function attemptOfferToUser(world: GameWorld, rng: Rng): void {
  const userId = world.playerClubId;
  const userRep = getClub(world, userId).reputation;
  const userSquad = clubPlayers(world, userId);
  if (userSquad.length <= 18) return;

  const buyers = world.clubs.filter((c) =>
    c.id !== userId && c.reputation >= userRep - 15 && clubPlayers(world, c.id).length < MAX_SQUAD);
  if (buyers.length === 0) return;
  const buyer = rng.pick(buyers);
  const fin = world.finances[buyer.id]!;
  const level = topElevenAverage(clubPlayers(world, buyer.id));

  const targets = userSquad.filter((p) =>
    !p.loan &&
    p.currentAbility >= level - 10 &&
    marketValue(p, world.date) * 0.8 <= fin.transferBudget &&
    willingToJoin(world, p, buyer.id) &&
    !world.offers.some((o) => o.playerId === p.id && isActive(o)));
  if (targets.length === 0) return;
  // İyi oyunculara ilgi daha fazla
  const player = targets[rng.weightedIndex(targets.map((p) => p.currentAbility ** 2))]!;
  const value = marketValue(player, world.date);
  const fee = Math.min(fin.transferBudget, roundNice(value * rng.float(0.8, 1.15)));
  const maxFee = Math.max(fee, roundNice(value * rng.float(1.1, 1.4)));

  world.offers.push({
    id: world.nextOfferId++,
    playerId: player.id,
    buyerId: buyer.id,
    sellerId: userId,
    kind: 'transfer',
    fee,
    counterFee: null,
    status: 'pending',
    created: world.date,
    respondOn: addDays(world.date, 7),
    patience: 0,
    maxFee,
    note: 'Yanıtını bekliyor (7 gün).',
  });
  addNews(world, {
    category: 'offer',
    title: `${buyer.name}, ${player.firstName} ${player.lastName} için teklif yaptı`,
    body: `${buyer.name}, ${player.firstName} ${player.lastName} için €${formatPlain(fee)} teklif etti. Transfer Merkezi'nden kabul edebilir, reddedebilir ya da karşı teklif yapabilirsin.`,
    important: true,
    playerId: player.id,
    clubId: buyer.id,
  });
}

/** Transfer dönemindeki günlük yapay zekâ hamleleri. */
export function aiTransferDay(world: GameWorld, rng: Rng): void {
  const window = transferWindow(world.date);
  if (!window.open) return;
  const season = window.name === 'Yaz' ? 'summer' : 'winter';
  for (const club of world.clubs) {
    if (club.id === world.playerClubId) continue;
    if (rng.chance(BUY_CHANCE[season])) attemptPurchase(world, club, rng);
  }
  if (rng.chance(OFFER_CHANCE[season])) attemptOfferToUser(world, rng);
}
