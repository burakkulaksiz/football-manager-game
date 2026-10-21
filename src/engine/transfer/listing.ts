/**
 * Transfer / kiralık listesi.
 *
 * - Kullanıcı kendi oyuncusunu listeye koyar (bedel isteğe bağlı). Transfer döneminde yapay zekâ kulüplerinden
 *   bu bedele yakın teklifler gelir; kiralık listesindekine kiralık teklifi gelir. Teklifler Transfer Merkezi'nde
 *   her teklif gibi yanıtlanır. Transfer listesine konan oyuncunun morali düşer (satılmak istenmek hoş değil).
 * - Yapay zekâ kulüpleri her dönem başında fazlalıklarını listeler: kadroda yeri olmayan tecrübeliler satılık
 *   (istenen bonservis daha düşük), süre bulamayan gençler kiralık (kiralık bedeli daha düşük).
 */
import { addDays } from '../date';
import { clubPlayers, getClub } from '../generation/worldGenerator';
import { addNews } from '../news';
import { ageOn, marketValue, roundNice } from '../player';
import type { Rng } from '../rng';
import type { GameWorld, Listing, ListingKind, Player } from '../types';
import { MAX_SQUAD } from './ai';
import { formatPlain, loanFeeAsk } from './market';
import { isActive } from './offers';
import { transferWindow } from './window';

/** Transfer listesine konan oyuncunun moral kaybı. */
export const LIST_MORALE_HIT = 8;
/** Kullanıcının listedeki oyuncusuna günlük teklif olasılığı (yaz / devre arası). */
const LISTED_OFFER_CHANCE = { summer: 0.08, winter: 0.06 };
/** Yapay zekâ kulübü dönem başına en fazla bu kadar oyuncu listeler. */
const AI_MAX_LISTED = { transfer: 3, loan: 2 };

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

/** Listeye koyarken önerilen bedel: transferde piyasa değerinin %90'ı, kiralıkta kiralık bedeli. */
export function suggestedListPrice(world: GameWorld, p: Player, kind: ListingKind): number {
  return kind === 'transfer' ? roundNice(marketValue(p, world.date) * 0.9) : loanFeeAsk(world, p);
}

/** Listeye konamama nedeni (yoksa null). */
export function listBlocker(world: GameWorld, p: Player): string | null {
  if (p.clubId !== world.playerClubId) return 'Yalnızca kendi oyuncunu listeye koyabilirsin.';
  if (p.loan) return 'Kiralık oyuncu listeye konamaz.';
  return null;
}

/** Oyuncuyu listeye koyar (ya da listesini değiştirir). Hata varsa açıklaması döner. */
export function listPlayer(world: GameWorld, p: Player, kind: ListingKind, price: number | null): string | null {
  const blocker = listBlocker(world, p);
  if (blocker) return blocker;
  if (price !== null && price < 0) return 'Bedel negatif olamaz.';
  const wasTransferListed = p.listing?.kind === 'transfer';
  const listing: Listing = { kind, price: price === null ? null : roundNice(price), since: world.date };
  p.listing = listing;
  // Satılık olduğunu öğrenen oyuncunun morali düşer (kiralık listesi ve fiyat değişikliği etkilemez)
  if (kind === 'transfer' && !wasTransferListed) p.morale = Math.max(0, p.morale - LIST_MORALE_HIT);
  return null;
}

export function unlistPlayer(p: Player): void {
  delete p.listing;
}

/** İstenen bedel (kullanıcı belirlediyse o, değilse önerilen). */
export function listingPrice(world: GameWorld, p: Player): number {
  return p.listing?.price ?? suggestedListPrice(world, p, p.listing?.kind ?? 'transfer');
}

function topElevenAverage(squad: readonly Player[]): number {
  const cas = squad.map((p) => p.currentAbility).sort((a, b) => b - a).slice(0, 11);
  return cas.length === 0 ? 0 : cas.reduce((a, b) => a + b, 0) / cas.length;
}

/**
 * Listedeki oyuncumuzla ilgilenecek kulüpler: oyuncu onların kadrosunda işe yarar seviyede
 * (ilk 11 ortalamasının 22 altı ile 12 üstü arası), kadroları dolu değil, transferde bütçeleri yetiyor.
 */
function interestedClubs(world: GameWorld, p: Player, fee: number): string[] {
  return world.clubs
    .filter((c) => c.id !== world.playerClubId)
    .filter((c) => {
      const squad = clubPlayers(world, c.id);
      if (squad.length >= MAX_SQUAD) return false;
      const level = topElevenAverage(squad);
      if (p.currentAbility < level - 22 || p.currentAbility > level + 12) return false;
      return p.listing?.kind === 'loan' || world.finances[c.id]!.transferBudget >= fee * 0.7;
    })
    .map((c) => c.id);
}

/**
 * Her gün (dönem açıkken): listedeki oyuncularımıza teklif. Oyuncu başına aynı anda en fazla bir açık teklif.
 * Teklif bedeli istenen bedelin %65–100'ü; alıcının gizli üst sınırı %100–115 (karşı teklifle pazarlık).
 */
export function listedOffersDay(world: GameWorld, rng: Rng): void {
  const window = transferWindow(world.date);
  if (!window.open) return;
  const chance = window.name === 'Yaz' ? LISTED_OFFER_CHANCE.summer : LISTED_OFFER_CHANCE.winter;
  for (const p of Object.values(world.players)) {
    if (!p.listing || p.clubId !== world.playerClubId) continue;
    if (world.offers.some((o) => o.playerId === p.id && isActive(o))) continue;
    if (!rng.chance(chance)) continue;
    const kind = p.listing.kind;
    const asked = listingPrice(world, p);
    const clubs = interestedClubs(world, p, asked);
    if (clubs.length === 0) continue;
    const buyerId = clubs[rng.int(0, clubs.length - 1)]!;
    const budget = world.finances[buyerId]!.transferBudget;
    const fee = roundNice(Math.min(kind === 'transfer' ? budget : Infinity, asked * rng.float(0.65, 1)));
    const maxFee = roundNice(Math.max(fee, Math.min(kind === 'transfer' ? budget : Infinity, asked * rng.float(1, 1.15))));
    const buyer = getClub(world, buyerId).name;
    world.offers.push({
      id: world.nextOfferId++,
      playerId: p.id,
      buyerId,
      sellerId: world.playerClubId,
      kind,
      fee,
      counterFee: null,
      status: 'pending',
      created: world.date,
      respondOn: addDays(world.date, 7),
      patience: 0,
      maxFee,
      note: 'Yanıtını bekliyor (7 gün).',
    });
    const what = kind === 'loan' ? 'kiralamak için' : 'için';
    addNews(world, {
      category: 'offer',
      title: `${buyer}, ${fullName(p)} ${what} teklif yaptı`,
      body:
        `${kind === 'loan' ? 'Kiralık listesindeki' : 'Transfer listesindeki'} ${fullName(p)} için ${buyer} €${formatPlain(fee)} teklif etti` +
        `${p.listing.price !== null ? ` (istediğin: €${formatPlain(p.listing.price)})` : ''}. ` +
        "Transfer Merkezi'nden kabul edebilir, reddedebilir ya da karşı teklif yapabilirsin.",
      important: true,
      playerId: p.id,
      clubId: buyerId,
    });
  }
}

/**
 * Dönem başında yapay zekâ kulüplerinin listeleri yenilenir: A takımda kadro sırası 22+ olan 22+ yaşındakiler
 * satılık (en fazla 3), kadro sırası 16+ olan 21 yaş altı gençler kiralık (en fazla 2).
 */
export function refreshAiListings(world: GameWorld): void {
  for (const club of world.clubs) {
    if (club.id === world.playerClubId) continue;
    const squad = clubPlayers(world, club.id).sort((a, b) => b.currentAbility - a.currentAbility);
    let transfers = 0;
    let loans = 0;
    squad.forEach((p, rank) => {
      delete p.listing;
      if (p.loan) return;
      const age = ageOn(p.birthDate, world.date);
      if (age <= 21 && rank >= 15 && loans < AI_MAX_LISTED.loan) {
        p.listing = { kind: 'loan', price: null, since: world.date };
        loans++;
      } else if (age >= 22 && rank >= 21 && transfers < AI_MAX_LISTED.transfer) {
        p.listing = { kind: 'transfer', price: null, since: world.date };
        transfers++;
      }
    });
  }
}

/** Dönem bugün açıldıysa yapay zekâ listelerini yeniler. */
export function listingsOnWindowOpen(world: GameWorld): void {
  if (transferWindow(world.date).open && !transferWindow(addDays(world.date, -1)).open) refreshAiListings(world);
}
