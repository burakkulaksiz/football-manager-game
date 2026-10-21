/**
 * Transfer teklifleri: kullanıcının teklifleri, gelen tekliflere yanıt, sözleşme görüşmesi
 * ve her gün işlenen yanıtlar.
 */
import { addDays } from '../date';
import { addExpense, totalWages } from '../finance/finance';
import { clubPlayers, getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { ageOn, roundNice } from '../player';
import type { GameWorld, Player, TransferOffer } from '../types';
import {
  askingPrice,
  contractExpiry,
  formatPlain,
  loanFeeAsk,
  loanPlayer,
  playerImportance,
  preferredYears,
  transferPlayer,
  wageDemand,
  willingToJoin,
  type TransferTerms,
} from './market';
import { isWindowOpen } from './window';

/** Sözleşme görüşmesinde oyuncunun sabrı (kaç ret hakkı). */
export const NEGOTIATION_PATIENCE = 3;
/** Satıcı kulübün kadrosu bu sayının altına düşecekse satmaz. */
export const MIN_SQUAD_TO_SELL = 20;

const ACTIVE: ReadonlySet<TransferOffer['status']> = new Set(['pending', 'countered', 'accepted']);

export function isActive(offer: TransferOffer): boolean {
  return ACTIVE.has(offer.status);
}

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

/* ------------------------------------------------------------------ */
/* Kullanıcı alıcı                                                      */
/* ------------------------------------------------------------------ */

/** Teklif yapılabilir mi? Yapılamıyorsa sebebi döner. */
export function offerBlocker(world: GameWorld, player: Player, kind: TransferOffer['kind']): string | null {
  const userId = world.playerClubId;
  if (!isWindowOpen(world.date)) return 'Transfer dönemi kapalı.';
  if (player.clubId === userId) return 'Oyuncu zaten kulübünde.';
  if (!player.clubId) return 'Oyuncu serbest.';
  if (player.loan) return 'Oyuncu başka bir kulüpte kiralık.';
  if (world.offers.some((o) => o.playerId === player.id && o.buyerId === userId && isActive(o))) {
    return 'Bu oyuncu için zaten açık bir teklifin var.';
  }
  if (kind === 'transfer' && !willingToJoin(world, player, userId)) {
    return `${fullName(player)} kulübüne gelmeye istekli değil.`;
  }
  return null;
}

/** Kullanıcının teklifi: kulüp ertesi gün yanıtlar. Hata varsa metin döner. */
export function makeOffer(world: GameWorld, playerId: number, kind: TransferOffer['kind'], fee: number): TransferOffer | string {
  const player = world.players[playerId];
  if (!player) return 'Oyuncu bulunamadı.';
  const blocker = offerBlocker(world, player, kind);
  if (blocker) return blocker;
  const fin = world.finances[world.playerClubId]!;
  if (fee < 0) return 'Geçersiz tutar.';
  if (fee > fin.transferBudget) return `Transfer bütçen yetersiz (€${formatPlain(fin.transferBudget)}).`;
  if (kind === 'loan') {
    const projected = totalWages(Object.values(world.players), world.playerClubId) + player.contract.wage;
    if (projected > fin.wageBudget) return 'Oyuncunun maaşı için maaş bütçen yetersiz.';
  }
  const offer: TransferOffer = {
    id: world.nextOfferId++,
    playerId,
    buyerId: world.playerClubId,
    sellerId: player.clubId!,
    kind,
    fee: roundNice(fee),
    counterFee: null,
    status: 'pending',
    created: world.date,
    respondOn: addDays(world.date, 1),
    patience: NEGOTIATION_PATIENCE,
    maxFee: null,
    note: 'Kulübün yanıtı bekleniyor.',
  };
  world.offers.push(offer);
  return offer;
}

/** Karşı teklifi kabul et: transferde sözleşme görüşmesine geçilir, kiralıkta hemen tamamlanır. */
export function acceptCounter(world: GameWorld, offerId: number): string | null {
  const offer = world.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'countered' || offer.buyerId !== world.playerClubId || offer.counterFee === null) {
    return 'Kabul edilecek bir karşı teklif yok.';
  }
  if (offer.counterFee > world.finances[world.playerClubId]!.transferBudget) return 'Transfer bütçen yetersiz.';
  offer.fee = offer.counterFee;
  offer.counterFee = null;
  if (offer.kind === 'loan') {
    loanPlayer(world, world.players[offer.playerId]!, offer.buyerId, offer.fee);
    offer.status = 'completed';
    offer.note = 'Kiralık tamamlandı.';
  } else {
    offer.status = 'accepted';
    offer.note = 'Kulüple anlaşıldı. Oyuncuyla sözleşme görüşmesi yapabilirsin.';
  }
  return null;
}

export function withdrawOffer(world: GameWorld, offerId: number): void {
  const offer = world.offers.find((o) => o.id === offerId);
  if (offer && isActive(offer)) {
    offer.status = 'cancelled';
    offer.note = 'Teklif geri çekildi.';
  }
}

/* ------------------------------------------------------------------ */
/* Sözleşme görüşmesi                                                   */
/* ------------------------------------------------------------------ */

export interface NegotiationResult {
  outcome: 'signed' | 'counter' | 'rejected' | 'collapsed' | 'error';
  message: string;
  /** Oyuncunun istediği (karşı teklif). */
  demand?: TransferTerms;
}

/** Oyuncunun bu şartlara bakışı; maaş + yıllara bölünmüş imza bonusu talebi karşılamalı. */
export function evaluateTerms(world: GameWorld, player: Player, clubId: string, terms: TransferTerms): { ok: boolean; close: boolean; demand: TransferTerms } {
  const demandWage = wageDemand(world, player, clubId);
  const [minYears, maxYears] = preferredYears(ageOn(player.birthDate, world.date));
  const years = Math.min(maxYears, Math.max(minYears, terms.years));
  // İstediği süre dışında bir sözleşme için daha fazla para ister.
  const required = demandWage * (terms.years >= minYears && terms.years <= maxYears ? 1 : 1.1);
  const effective = terms.wage + terms.signingBonus / Math.max(1, terms.years);
  return {
    ok: effective >= required,
    close: effective >= required * 0.8,
    demand: { wage: roundNice(required), years, signingBonus: 0 },
  };
}

function wageBudgetError(world: GameWorld, player: Player, wage: number): string | null {
  const clubId = world.playerClubId;
  const current = totalWages(Object.values(world.players), clubId) - (player.clubId === clubId ? player.contract.wage : 0);
  const budget = world.finances[clubId]!.wageBudget;
  return current + wage > budget ? `Maaş bütçesi yetersiz: en fazla €${formatPlain(Math.max(0, budget - current))}/yıl verebilirsin.` : null;
}

function respond(world: GameWorld, player: Player, clubId: string, terms: TransferTerms, patience: number): NegotiationResult & { patienceLeft: number } {
  const verdict = evaluateTerms(world, player, clubId, terms);
  if (verdict.ok) return { outcome: 'signed', message: `${fullName(player)} sözleşmeyi kabul etti!`, patienceLeft: patience };
  const left = patience - 1;
  if (left <= 0) {
    return { outcome: 'collapsed', message: `${fullName(player)} görüşmeleri kesti; anlaşma sağlanamadı.`, demand: verdict.demand, patienceLeft: 0 };
  }
  const want = `Yıllık €${formatPlain(verdict.demand.wage)} ve ${verdict.demand.years} yıllık sözleşme istiyor.`;
  return verdict.close
    ? { outcome: 'counter', message: `Teklif yakın ama yeterli değil. ${want}`, demand: verdict.demand, patienceLeft: left }
    : { outcome: 'rejected', message: `Teklif çok düşük bulundu. ${want}`, demand: verdict.demand, patienceLeft: left };
}

/** Kabul edilmiş transfer teklifinde oyuncuyla sözleşme görüşmesi. */
export function negotiateTransfer(world: GameWorld, offerId: number, terms: TransferTerms): NegotiationResult {
  const offer = world.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'accepted' || offer.kind !== 'transfer') {
    return { outcome: 'error', message: 'Görüşülecek bir anlaşma yok.' };
  }
  const player = world.players[offer.playerId]!;
  const fin = world.finances[world.playerClubId]!;
  if (offer.fee + terms.signingBonus > fin.transferBudget) {
    return { outcome: 'error', message: 'Bonservis ve imza bonusu için transfer bütçen yetersiz.' };
  }
  const budgetError = wageBudgetError(world, player, terms.wage);
  if (budgetError) return { outcome: 'error', message: budgetError };

  const result = respond(world, player, world.playerClubId, terms, offer.patience);
  offer.patience = result.patienceLeft;
  if (result.outcome === 'signed') {
    transferPlayer(world, player, world.playerClubId, offer.fee, terms);
    offer.status = 'completed';
    offer.note = 'Transfer tamamlandı.';
  } else if (result.outcome === 'collapsed') {
    offer.status = 'collapsed';
    offer.note = 'Oyuncuyla anlaşılamadı.';
  } else {
    offer.note = result.message;
  }
  return result;
}

/** Serbest oyuncuyla sözleşme (bonservis yok; transfer dönemi şartı yok). */
export function negotiateFreeAgent(world: GameWorld, playerId: number, terms: TransferTerms): NegotiationResult {
  const player = world.players[playerId];
  if (!player || player.clubId) return { outcome: 'error', message: 'Oyuncu serbest değil.' };
  const budgetError = wageBudgetError(world, player, terms.wage);
  if (budgetError) return { outcome: 'error', message: budgetError };
  const fin = world.finances[world.playerClubId]!;
  if (terms.signingBonus > fin.transferBudget) return { outcome: 'error', message: 'İmza bonusu için transfer bütçen yetersiz.' };
  const result = respond(world, player, world.playerClubId, terms, Infinity);
  if (result.outcome === 'signed') transferPlayer(world, player, world.playerClubId, 0, terms);
  return result;
}

/** Kendi oyuncumuzla sözleşme yenileme (sabır sınırı yok; talep altında kabul etmez). */
export function negotiateRenewal(world: GameWorld, playerId: number, terms: TransferTerms): NegotiationResult {
  const player = world.players[playerId];
  if (!player || player.clubId !== world.playerClubId || player.loan) {
    return { outcome: 'error', message: 'Bu oyuncuyla sözleşme yenilenemez.' };
  }
  const budgetError = wageBudgetError(world, player, terms.wage);
  if (budgetError) return { outcome: 'error', message: budgetError };
  const fin = world.finances[world.playerClubId]!;
  if (terms.signingBonus > fin.balance) return { outcome: 'error', message: 'İmza bonusu için kasada yeterli para yok.' };

  const result = respond(world, player, world.playerClubId, terms, Infinity);
  if (result.outcome !== 'signed') return result;
  // Yenilemede süre bu sezonun sonundan itibaren sayılır.
  player.contract = { wage: terms.wage, expires: contractExpiry(world.date, terms.years) };
  player.morale = Math.min(100, player.morale + 8);
  if (terms.signingBonus > 0) addExpense(fin, 'signingBonuses', terms.signingBonus);
  addNews(world, {
    category: 'contract',
    title: `${fullName(player)} sözleşme yeniledi`,
    body: `${fullName(player)} ile ${terms.years} yıllık yeni sözleşme imzalandı (yıllık €${formatPlain(terms.wage)}).`,
    important: false,
    playerId,
    clubId: world.playerClubId,
  });
  return result;
}

/* ------------------------------------------------------------------ */
/* Kullanıcı satıcı: gelen tekliflere yanıt                             */
/* ------------------------------------------------------------------ */

export function respondToIncoming(world: GameWorld, offerId: number, action: 'accept' | 'reject' | 'counter', counterFee?: number): string | null {
  const offer = world.offers.find((o) => o.id === offerId);
  if (!offer || offer.sellerId !== world.playerClubId || offer.status !== 'pending') return 'Yanıt verilecek bir teklif yok.';
  if (action === 'accept') {
    completeAiDeal(world, offer, offer.fee);
    return null;
  }
  if (action === 'reject') {
    offer.status = 'rejected';
    offer.note = 'Teklifi reddettin.';
    return null;
  }
  if (counterFee === undefined || counterFee <= offer.fee) return 'Karşı teklif mevcut tekliften yüksek olmalı.';
  offer.status = 'countered';
  offer.counterFee = roundNice(counterFee);
  offer.respondOn = addDays(world.date, 1);
  offer.note = `€${formatPlain(offer.counterFee)} istedin; ${getClub(world, offer.buyerId).name} yanıtı bekleniyor.`;
  return null;
}

/** Yapay zekâ kulübünün kullanıcıdan alımı ya da kiralaması (oyuncuyla anlaşmayı kendisi yapar). */
export function completeAiDeal(world: GameWorld, offer: TransferOffer, fee: number): void {
  if (offer.kind === 'loan') {
    loanPlayer(world, world.players[offer.playerId]!, offer.buyerId, fee);
    offer.fee = fee;
    offer.status = 'completed';
    offer.note = 'Kiralık tamamlandı.';
    return;
  }
  completeAiPurchase(world, offer, fee);
}

/** Yapay zekâ kulübün satın alımı (oyuncuyla anlaşmayı kendisi yapar). */
export function completeAiPurchase(world: GameWorld, offer: TransferOffer, fee: number): void {
  const player = world.players[offer.playerId]!;
  const age = ageOn(player.birthDate, world.date);
  const [minYears, maxYears] = preferredYears(age);
  const wage = wageDemand(world, player, offer.buyerId);
  transferPlayer(world, player, offer.buyerId, fee, { wage, years: Math.round((minYears + maxYears) / 2), signingBonus: 0 });
  offer.fee = fee;
  offer.status = 'completed';
  offer.note = 'Transfer tamamlandı.';
}

/* ------------------------------------------------------------------ */
/* Günlük işlem                                                         */
/* ------------------------------------------------------------------ */

/** Satıcı yapay zekâ kulübün kullanıcının teklifine kararı. */
function sellerDecision(world: GameWorld, offer: TransferOffer): void {
  const player = world.players[offer.playerId]!;
  const seller = getClub(world, offer.sellerId).name;
  const name = fullName(player);
  const importance = playerImportance(world, player);
  const squadSize = clubPlayers(world, offer.sellerId).length;
  const reject = (note: string) => {
    offer.status = 'rejected';
    offer.note = note;
  };

  if (squadSize <= MIN_SQUAD_TO_SELL) reject(`${seller} kadrosu dar olduğu için oyuncu satmıyor.`);
  else if (offer.kind === 'loan') {
    const ask = loanFeeAsk(world, player);
    if (importance >= 1) reject(`${seller}, ilk 11 oyuncusunu kiralık vermiyor.`);
    else if (offer.fee >= ask * 0.8) {
      loanPlayer(world, player, offer.buyerId, offer.fee);
      offer.status = 'completed';
      offer.note = 'Kiralık tamamlandı.';
      return; // loanPlayer haberi zaten yazdı
    } else {
      offer.status = 'countered';
      offer.counterFee = ask;
      offer.note = `${seller} kiralık bedeli olarak €${formatPlain(ask)} istiyor.`;
    }
  } else {
    const ask = askingPrice(world, player);
    if (offer.fee >= ask * 0.92) {
      offer.status = 'accepted';
      offer.note = 'Kulüple anlaşıldı. Oyuncuyla sözleşme görüşmesi yapabilirsin.';
    } else if (offer.fee >= ask * 0.6) {
      offer.status = 'countered';
      offer.counterFee = ask;
      offer.note = `${seller} €${formatPlain(ask)} istiyor.`;
    } else {
      reject(`${seller} teklifi çok düşük buldu.`);
    }
  }

  const titles: Record<string, string> = {
    accepted: `${seller} teklifini kabul etti`,
    countered: `${seller} karşı teklif yaptı`,
    rejected: `${seller} teklifini reddetti`,
  };
  addNews(world, {
    category: 'offer',
    title: `${titles[offer.status] ?? seller}: ${name}`,
    body: offer.note,
    important: true,
    playerId: player.id,
    clubId: offer.sellerId,
  });
}

/** Alıcı yapay zekâ kulübün, kullanıcının karşı teklifine kararı. */
function buyerDecision(world: GameWorld, offer: TransferOffer): void {
  const player = world.players[offer.playerId]!;
  const buyer = getClub(world, offer.buyerId).name;
  const counter = offer.counterFee ?? offer.fee;
  const affordable = counter <= world.finances[offer.buyerId]!.transferBudget;
  if (offer.maxFee !== null && counter <= offer.maxFee && (affordable || offer.kind === 'loan')) {
    completeAiDeal(world, offer, counter);
    return; // transferPlayer / loanPlayer haberi yazdı
  }
  offer.status = 'rejected';
  offer.note = `${buyer} karşı teklifini kabul etmedi ve masadan kalktı.`;
  addNews(world, {
    category: 'offer',
    title: `${buyer} geri çekildi: ${fullName(player)}`,
    body: offer.note,
    important: true,
    playerId: player.id,
    clubId: offer.buyerId,
  });
}

/** Her gün: vadesi gelen yanıtlar, süresi dolan teklifler, dönem kapanınca iptaller. */
export function processOffers(world: GameWorld): void {
  const user = world.playerClubId;
  const windowOpen = isWindowOpen(world.date);
  for (const offer of world.offers) {
    if (!isActive(offer)) continue;
    if (!windowOpen) {
      offer.status = 'cancelled';
      offer.note = 'Transfer dönemi kapandı.';
      continue;
    }
    if (offer.respondOn > world.date) continue;

    if (offer.buyerId === user) {
      if (offer.status === 'pending') sellerDecision(world, offer);
    } else if (offer.sellerId === user) {
      if (offer.status === 'pending') {
        offer.status = 'cancelled';
        offer.note = 'Yanıt vermediğin için teklif düştü.';
        const p = world.players[offer.playerId]!;
        addNews(world, {
          category: 'offer',
          title: `Teklif düştü: ${fullName(p)}`,
          body: `${getClub(world, offer.buyerId).name} teklifine yanıt vermediğin için geri çekildi.`,
          important: true,
          playerId: p.id,
          clubId: offer.buyerId,
        });
      } else if (offer.status === 'countered') {
        buyerDecision(world, offer);
      }
    }
  }
  // Eski, kapanmış teklifleri sınırla
  if (world.offers.length > 200) world.offers = world.offers.filter((o) => isActive(o)).concat(world.offers.filter((o) => !isActive(o)).slice(-100));
}
