import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { addDays } from '../date';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { Rng } from '../rng';
import type { GameWorld, Player } from '../types';
import { listBlocker, listedOffersDay, listPlayer, LIST_MORALE_HIT, refreshAiListings, unlistPlayer } from './listing';
import { askingPrice, LISTED_LOAN_DISCOUNT, LISTED_TRANSFER_DISCOUNT, loanFeeAsk } from './market';
import { processOffers, respondToIncoming } from './offers';

const START = '2026-07-01';

/** Listedeki oyuncumuza teklif gelene kadar (yaz dönemi) günleri ilerletir. */
function waitForOffer(world: GameWorld, player: Player, rng: Rng) {
  for (let i = 0; i < 60; i++) {
    listedOffersDay(world, rng);
    const offer = world.offers.find((o) => o.playerId === player.id && o.status === 'pending');
    if (offer) return offer;
    world.date = addDays(world.date, 1);
  }
  return undefined;
}

/** Kullanıcının, listeye konunca ilgi görecek orta seviyede bir oyuncusu (yedek). */
function benchPlayer(world: GameWorld): Player {
  return clubPlayers(world, world.playerClubId).sort((a, b) => b.currentAbility - a.currentAbility)[16]!;
}

describe('yapay zekâ listeleri', () => {
  const world = createWorld(gameData, 41, 'kasimpasa', START);

  it('yeni oyunda (yaz dönemi) yapay zekâ kulüpleri fazlalıklarını listeler; kullanıcının listesi boş', () => {
    let total = 0;
    for (const club of world.clubs) {
      const listed = clubPlayers(world, club.id).filter((p) => p.listing);
      if (club.id === world.playerClubId) {
        expect(listed).toHaveLength(0);
        continue;
      }
      expect(listed.filter((p) => p.listing!.kind === 'transfer').length).toBeLessThanOrEqual(3);
      expect(listed.filter((p) => p.listing!.kind === 'loan').length).toBeLessThanOrEqual(2);
      total += listed.length;
    }
    expect(total).toBeGreaterThan(world.clubs.length);
  });

  it('satılık listesindeki oyuncu daha ucuz, kiralık listesindekinin kiralık bedeli düşük', () => {
    const forSale = Object.values(world.players).find((p) => p.listing?.kind === 'transfer')!;
    const listedPrice = askingPrice(world, forSale);
    const listing = forSale.listing;
    delete forSale.listing;
    expect(listedPrice / askingPrice(world, forSale)).toBeCloseTo(LISTED_TRANSFER_DISCOUNT, 1);
    forSale.listing = listing;

    const forLoan = Object.values(world.players).find((p) => p.listing?.kind === 'loan')!;
    const loanAsk = loanFeeAsk(world, forLoan);
    const loanListing = forLoan.listing;
    delete forLoan.listing;
    expect(loanAsk / loanFeeAsk(world, forLoan)).toBeCloseTo(LISTED_LOAN_DISCOUNT, 1);
    forLoan.listing = loanListing;
  });

  it('dönem başında listeler yenilenir (eski listeler düşer)', () => {
    const w = createWorld(gameData, 42, 'kasimpasa', START);
    const other = clubPlayers(w, 'galatasaray')[0]!;
    other.listing = { kind: 'transfer', price: null, since: START };
    refreshAiListings(w);
    expect(other.listing).toBeUndefined(); // ilk 11 oyuncusu listede kalmaz
  });
});

describe('kendi oyuncumuzu listeye koyma', () => {
  it('transfer listesi morali düşürür; kiralık listesi ve fiyat değişikliği düşürmez; listeden çıkarma', () => {
    const world = createWorld(gameData, 43, 'kasimpasa', START);
    const p = benchPlayer(world);
    const morale = p.morale;
    expect(listPlayer(world, p, 'transfer', 1_234_567)).toBeNull();
    expect(p.listing).toMatchObject({ kind: 'transfer', since: START });
    expect(p.listing!.price).toBeGreaterThan(1_000_000);
    expect(p.morale).toBe(Math.max(0, morale - LIST_MORALE_HIT));
    listPlayer(world, p, 'transfer', 2_000_000);
    expect(p.morale).toBe(Math.max(0, morale - LIST_MORALE_HIT));
    unlistPlayer(p);
    expect(p.listing).toBeUndefined();
    const q = clubPlayers(world, 'kasimpasa')[20]!;
    const qMorale = q.morale;
    listPlayer(world, q, 'loan', null);
    expect(q.morale).toBe(qMorale);
  });

  it('başka kulübün ya da kiralık oyuncusu listeye konamaz', () => {
    const world = createWorld(gameData, 44, 'kasimpasa', START);
    const other = clubPlayers(world, 'galatasaray')[0]!;
    expect(listBlocker(world, other)).not.toBeNull();
    expect(listPlayer(world, other, 'transfer', null)).not.toBeNull();
    const p = benchPlayer(world);
    p.loan = { fromClubId: 'galatasaray', until: '2027-06-30' };
    expect(listPlayer(world, p, 'loan', null)).not.toBeNull();
  });
});

describe('listedeki oyuncuya gelen teklifler', () => {
  it('transfer listesindekine istenen bedele yakın transfer teklifi gelir (oyuncu başına tek açık teklif)', () => {
    const world = createWorld(gameData, 45, 'kasimpasa', START);
    const p = benchPlayer(world);
    listPlayer(world, p, 'transfer', 1_500_000);
    const offer = waitForOffer(world, p, new Rng(7));
    expect(offer).toBeDefined();
    expect(offer!.kind).toBe('transfer');
    expect(offer!.sellerId).toBe('kasimpasa');
    expect(offer!.fee).toBeLessThanOrEqual(1_500_000);
    expect(offer!.fee).toBeGreaterThanOrEqual(1_500_000 * 0.6);
    expect(world.news.some((n) => n.category === 'offer' && n.playerId === p.id)).toBe(true);
    // Açık teklif varken ikincisi gelmez
    const before = world.offers.length;
    for (let i = 0; i < 30; i++) listedOffersDay(world, new Rng(100 + i));
    expect(world.offers.filter((o) => o.playerId === p.id).length).toBe(world.offers.length - before + 1);
  });

  it('dönem kapalıyken teklif gelmez', () => {
    const world = createWorld(gameData, 46, 'kasimpasa', START);
    world.date = '2026-10-15';
    const p = benchPlayer(world);
    listPlayer(world, p, 'transfer', null);
    for (let i = 0; i < 30; i++) listedOffersDay(world, new Rng(i));
    expect(world.offers.some((o) => o.playerId === p.id)).toBe(false);
  });

  it('kiralık teklifi kabul edilince oyuncu kiralanır, listeden çıkar', () => {
    const world = createWorld(gameData, 47, 'kasimpasa', START);
    const p = benchPlayer(world);
    listPlayer(world, p, 'loan', null);
    const offer = waitForOffer(world, p, new Rng(3))!;
    expect(offer.kind).toBe('loan');
    expect(respondToIncoming(world, offer.id, 'accept')).toBeNull();
    expect(offer.status).toBe('completed');
    expect(p.clubId).toBe(offer.buyerId);
    expect(p.loan?.fromClubId).toBe('kasimpasa');
    expect(p.listing).toBeUndefined();
  });

  it('kiralıkta karşı teklif alıcının sınırı içindeyse kabul edilir', () => {
    const world = createWorld(gameData, 48, 'kasimpasa', START);
    const p = benchPlayer(world);
    listPlayer(world, p, 'loan', 400_000);
    const offer = waitForOffer(world, p, new Rng(5))!;
    const counter = Math.max(offer.fee + 10_000, offer.maxFee!);
    expect(respondToIncoming(world, offer.id, 'counter', counter)).toBeNull();
    world.date = offer.respondOn;
    processOffers(world);
    expect(offer.status).toBe('completed');
    expect(p.loan?.fromClubId).toBe('kasimpasa');
  });
});
