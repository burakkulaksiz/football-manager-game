/**
 * Yapay zekâ transferleri: kulüpler arası alımlar ve kullanıcının oyuncularına teklifler.
 * Yalnızca transfer döneminde, günlük küçük olasılıklarla çalışır.
 */
import { addDays } from '../date';
import { clubPlayers, getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { ageOn, marketValue, primaryPosition, roundNice } from '../player';
import { Rng } from '../rng';
import type { Club, GameWorld, Player } from '../types';
import {
  aiSigningWage,
  askingPrice,
  formatPlain,
  groupOf,
  preferredYears,
  squadRanks,
  transferPlayer,
  WAGE_BUDGET_SLACK,
  type SquadRanks,
  willingToJoin,
  type PositionGroup,
} from './market';
import { isActive, MIN_SQUAD_TO_SELL, triggerReleaseClause } from './offers';
import { totalWages } from '../finance/finance';
import { transferWindow } from './window';

/** Kadroda istenen en az oyuncu sayısı (mevki grubuna göre). */
const GROUP_TARGET: Record<PositionGroup, number> = { GK: 3, DEF: 8, MID: 7, ATT: 6 };
/** Bu kadro büyüklüğüne ulaşan kulüp oyuncu almaz. */
export const MAX_SQUAD = 28;

/**
 * Yapay zekâ kulübünün A takımında olması gereken en az oyuncu sayısı. Alım kuralı yalnızca ilk 11 seviyesine yakın oyuncuları
 * alıyor; sözleşmesi bitenlerin yedekleri serbest kalınca kadro bunun altına inebilir. Altındaki kulüp serbest oyunculardan
 * yedek tamamlar (denge raporu: bunsuz kadrolar 28 → 20'ye küçülüyor, serbest oyuncu havuzu şişiyor, ligin ortalama yeteneği yapay yükseliyor).
 */
export const MIN_AI_SQUAD = 24;
/** Kadrosu eksik kulübün transfer döneminde günlük yedek tamamlama olasılığı; yurtdışı kulüplerde yarısı. */
const DEPTH_CHANCE = 0.35;
/** Yedek tamamlamanın kendi rastgelelik akışı (mevcut akışı bozmaz). */
export const DEPTH_SEED_SALT = 0xdee7;
/** Yedek olarak alınacak oyuncunun, kulübün ilk 11 ortalamasının en fazla bu kadar altında / üstünde olması. */
const DEPTH_BELOW = 30;
const DEPTH_ABOVE = 6;
/** İhtiyaç duyulan mevki grubundaki adaya verilen puan bonusu (CA cinsinden). */
const DEPTH_GROUP_BONUS = 8;

/** Günlük alım girişimi olasılığı (yaz / devre arası). */
const BUY_CHANCE = { summer: 0.05, winter: 0.03 };
/**
 * Yurtdışı kulüplerinin alım sıklığı çarpanı: maç oynamadıkları için kadro ihtiyaçları daha az; aralarındaki
 * transferler kullanıcıyı ilgilendirmez (hem kalabalık hem işlemci yükü).
 */
const FOREIGN_BUY_FACTOR = 0.4;

/** Günün transfer işlerinde paylaşılan bilgiler (her denemede tüm oyuncuları yeniden taramamak için). */
interface DayContext {
  squadSizes: Map<string, number>;
  ranks: SquadRanks;
}

function dayContext(world: GameWorld): DayContext {
  const squadSizes = new Map<string, number>();
  for (const p of Object.values(world.players)) if (p.clubId) squadSizes.set(p.clubId, (squadSizes.get(p.clubId) ?? 0) + 1);
  return { squadSizes, ranks: squadRanks(world) };
}
/** Kullanıcıya günlük teklif gelme olasılığı. */
const OFFER_CHANCE = { summer: 0.06, winter: 0.04 };

/** Mevki grubunda ilk 11'e girenlerin sayısı: kaleci 1, defans 4, orta saha 3, forvet 3 (lig geneli ölçümlerle aynı). */
const GROUP_STARTERS: Record<PositionGroup, number> = { GK: 1, DEF: 4, MID: 3, ATT: 3 };

/**
 * Kadronun bir mevki grubundaki seviyesi: o gruptaki en iyi oyuncuların ortalama CA'sı. CA ölçeği mevkiye göre farklıdır (başlangıçta kaleci ~115,
 * defans ~124, orta saha ~125, forvet ~122); alım eşiği tek bir "ilk 11 ortalaması" ise kaleciler eşiğe ulaşamaz, diğer gruplar kolay geçer ve
 * forvet / defans sürekli yükselirken kaleci durağan kalır (denge raporu: forvet CA +12, kaleci +6 → gol ortalaması 2,7 → 3,0). Grupta oyuncu yoksa `fallback`.
 */
export function groupLevel(squad: readonly Player[], group: PositionGroup, fallback: number): number {
  const cas = squad
    .filter((p) => groupOf(primaryPosition(p)) === group)
    .map((p) => p.currentAbility)
    .sort((a, b) => b - a)
    .slice(0, GROUP_STARTERS[group]);
  return cas.length === 0 ? fallback : cas.reduce((a, b) => a + b, 0) / cas.length;
}

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
function attemptPurchase(world: GameWorld, buyer: Club, rng: Rng, ctx: DayContext): void {
  const fin = world.finances[buyer.id]!;
  if (fin.transferBudget < 250_000) return;
  const squad = clubPlayers(world, buyer.id);
  if (squad.length >= MAX_SQUAD) return;

  const group = neededGroup(rng, squad);
  const level = groupLevel(squad, group, topElevenAverage(squad) - 10);
  const { squadSizes, ranks } = ctx;

  const candidates: { player: Player; price: number; score: number }[] = [];
  for (const p of Object.values(world.players)) {
    if (p.clubId === buyer.id || p.clubId === world.playerClubId || p.loan || p.academy) continue;
    if (groupOf(primaryPosition(p)) !== group) continue;
    if (ageOn(p.birthDate, world.date) > 32 || p.currentAbility < level - 8) continue;
    // Serbest oyuncu bedelsiz; kulübü olan için satıcı kadrosu ve itibar kontrolü
    if (p.clubId) {
      if ((squadSizes.get(p.clubId) ?? 0) <= MIN_SQUAD_TO_SELL + 2) continue;
      if (getClub(world, p.clubId).reputation > buyer.reputation + 5) continue;
      if (!willingToJoin(world, p, buyer.id)) continue;
    }
    const price = p.clubId ? askingPrice(world, p, ranks) : 0;
    if (price > fin.transferBudget) continue;
    // Yetenek iyi, fiyat bütçeye göre makul olsun
    candidates.push({ player: p, price, score: p.currentAbility - (price / fin.transferBudget) * 15 + rng.float(0, 6) });
  }
  if (candidates.length === 0) return;
  candidates.sort((a, b) => b.score - a.score);
  const first = Math.min(candidates.length - 1, rng.int(0, 2));
  // Maaş bütçesine sığmayan adaylar elenir (önceden hiç kontrol edilmiyordu: maaş toplamı sürekli şişiyordu)
  const wageRoom = fin.wageBudget * WAGE_BUDGET_SLACK - totalWages(squad, buyer.id);
  let pick: (typeof candidates)[number] | undefined;
  let wage = 0;
  for (const c of [...candidates.slice(first), ...candidates.slice(0, first)].slice(0, 6)) {
    const w = aiSigningWage(world, c.player, buyer.id);
    if (w <= wageRoom) {
      pick = c;
      wage = w;
      break;
    }
  }
  if (!pick) return;
  const fee = Math.min(fin.transferBudget, roundNice(pick.price * rng.float(0.9, 1.08)));
  const [minYears, maxYears] = preferredYears(ageOn(pick.player.birthDate, world.date));
  const sellerId = pick.player.clubId;
  if (sellerId) squadSizes.set(sellerId, (squadSizes.get(sellerId) ?? 1) - 1);
  squadSizes.set(buyer.id, (squadSizes.get(buyer.id) ?? 0) + 1);
  transferPlayer(world, pick.player, buyer.id, fee, {
    wage,
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

  const squadSizes = new Map<string, number>();
  for (const p of Object.values(world.players)) if (p.clubId) squadSizes.set(p.clubId, (squadSizes.get(p.clubId) ?? 0) + 1);
  const buyers = world.clubs.filter((c) =>
    c.id !== userId && c.reputation >= userRep - 15 && (squadSizes.get(c.id) ?? 0) < MAX_SQUAD);
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
  // İyi oyunculara ve ucuz serbest kalma bedeli olanlara ilgi daha fazla
  const cheapClause = (p: Player) => p.contract.releaseClause !== undefined && p.contract.releaseClause <= marketValue(p, world.date) * 1.5;
  const player = targets[rng.weightedIndex(targets.map((p) => p.currentAbility ** 2 * (cheapClause(p) ? 3 : 1)))]!;
  const value = marketValue(player, world.date);
  // Serbest kalma bedeli makulse ve bütçe yetiyorsa kulüp bedeli öder: satış reddedilemez
  const clause = player.contract.releaseClause;
  if (clause !== undefined && clause <= fin.transferBudget && clause <= value * 1.6) {
    triggerReleaseClause(world, player, buyer.id);
    return;
  }
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

function dayRng(world: GameWorld): Rng {
  const day = Number(world.date.slice(0, 4)) * 372 + Number(world.date.slice(5, 7)) * 31 + Number(world.date.slice(8, 10));
  return new Rng((world.seed ^ DEPTH_SEED_SALT ^ Math.imul(day, 2654435761)) >>> 0);
}

/**
 * Kadrosu `MIN_AI_SQUAD`'ın altındaki yapay zekâ kulüpleri serbest oyunculardan (bedelsiz) yedek alır:
 * kulübün seviyesine uygun ve maaş bütçesine sığan en iyi oyuncu. En çok ihtiyaç duyulan mevki grubu öncelikli sayılır
 * (puan bonusu); o grupta serbest oyuncu yoksa başka gruptan da alınır (aksi hâlde kadro takılı kalır).
 */
export function fillAiDepth(world: GameWorld): void {
  const squads = new Map<string, Player[]>();
  const free: Player[] = [];
  for (const p of Object.values(world.players)) {
    if (p.academy) continue;
    if (!p.clubId) free.push(p);
    else (squads.get(p.clubId) ?? squads.set(p.clubId, []).get(p.clubId)!).push(p);
  }
  if (free.length === 0) return;
  const rng = dayRng(world);
  for (const club of world.clubs) {
    if (club.id === world.playerClubId) continue;
    const squad = squads.get(club.id) ?? [];
    if (squad.length >= MIN_AI_SQUAD) continue;
    if (!rng.chance(DEPTH_CHANCE * (club.country !== undefined ? 0.5 : 1))) continue;

    const group = neededGroup(rng, squad);
    const level = topElevenAverage(squad);
    const fin = world.finances[club.id]!;
    const wageRoom = fin.wageBudget - totalWages(squad, club.id);
    let best: { player: Player; wage: number; score: number } | null = null;
    for (const p of free) {
      if (p.clubId) continue;
      if (ageOn(p.birthDate, world.date) > 34) continue;
      if (p.currentAbility < level - DEPTH_BELOW || p.currentAbility > level + DEPTH_ABOVE) continue;
      const wage = aiSigningWage(world, p, club.id);
      if (wage > wageRoom) continue;
      const score = p.currentAbility + (groupOf(primaryPosition(p)) === group ? DEPTH_GROUP_BONUS : 0) + rng.float(0, 4);
      if (!best || score > best.score) best = { player: p, wage, score };
    }
    if (!best) continue;
    const [minYears, maxYears] = preferredYears(ageOn(best.player.birthDate, world.date));
    transferPlayer(world, best.player, club.id, 0, { wage: best.wage, years: rng.int(minYears, maxYears), signingBonus: 0 });
    squad.push(best.player);
    squads.set(club.id, squad);
    free.splice(free.indexOf(best.player), 1);
  }
}

/** Transfer dönemindeki günlük yapay zekâ hamleleri. */
export function aiTransferDay(world: GameWorld, rng: Rng): void {
  const window = transferWindow(world.date);
  if (!window.open) return;
  const season = window.name === 'Yaz' ? 'summer' : 'winter';
  let ctx: DayContext | null = null;
  for (const club of world.clubs) {
    if (club.id === world.playerClubId) continue;
    const chance = BUY_CHANCE[season] * (club.country !== undefined ? FOREIGN_BUY_FACTOR : 1);
    if (rng.chance(chance)) attemptPurchase(world, club, rng, (ctx ??= dayContext(world)));
  }
  if (rng.chance(OFFER_CHANCE[season])) attemptOfferToUser(world, rng);
  fillAiDepth(world);
}
