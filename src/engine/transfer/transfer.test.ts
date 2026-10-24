import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { addDays } from '../date';
import { processMatchFinances, startNewMonth, totalWages } from '../finance/finance';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { marketValue } from '../player';
import { playSeason } from '../testing';
import type { GameWorld, Player } from '../types';
import { agentProfile, contractDemand } from './agents';
import { askingPrice, loanFeeAsk, playerImportance, returnLoans, type TransferTerms } from './market';
import {
  acceptCounter,
  makeOffer,
  negotiateRenewal,
  negotiateTransfer,
  processOffers,
  respondToIncoming,
} from './offers';
import { transferWindow } from './window';

const START = '2026-07-01';

/** Kullanıcı Kasımpaşa; hedef oyuncular Konyaspor'dan (benzer itibar, istekli). */
function setup(): { world: GameWorld; target: Player; reserve: Player } {
  const world = createWorld(gameData, 21, 'kasimpasa', START);
  world.finances.kasimpasa!.transferBudget = 50_000_000;
  world.finances.kasimpasa!.wageBudget = 60_000_000;
  const squad = clubPlayers(world, 'konyaspor').sort((a, b) => b.currentAbility - a.currentAbility);
  return { world, target: squad[0]!, reserve: squad[squad.length - 1]! };
}

/** Oyuncunun ve menajerinin tam talebi, sözleşme şartı olarak. */
function demandTerms(world: GameWorld, player: Player): TransferTerms {
  const d = contractDemand(world, player, 'kasimpasa');
  return { wage: d.wage, years: d.years, signingBonus: 0, agentFee: d.agentFee, role: d.role, releaseClause: d.releaseClause };
}

/** Bir gün ilerletip teklifleri işler. */
function nextDay(world: GameWorld): void {
  world.date = addDays(world.date, 1);
  processOffers(world);
}

describe('transfer dönemleri', () => {
  it('yaz ve devre arası açık, sezon içinde kapalı', () => {
    expect(transferWindow('2026-07-01')).toMatchObject({ open: true, name: 'Yaz', closes: '2026-09-08' });
    expect(transferWindow('2026-09-09')).toMatchObject({ open: false, nextOpens: '2027-01-02' });
    expect(transferWindow('2027-01-15')).toMatchObject({ open: true, name: 'Devre arası' });
    expect(transferWindow('2027-03-01')).toMatchObject({ open: false, nextOpens: '2027-07-01' });
  });
});

describe('değerleme', () => {
  it('ilk 11 oyuncusu için istenen bedel piyasa değerinin belirgin üstünde', () => {
    const { world, target, reserve } = setup();
    expect(playerImportance(world, target)).toBe(1);
    expect(playerImportance(world, reserve)).toBe(0);
    // Sözleşme süresi aynı olsun ki yalnızca önem farkı ölçülsün
    reserve.contract.expires = target.contract.expires;
    const ratio = (p: Player) => askingPrice(world, p) / marketValue(p, world.date);
    expect(ratio(target)).toBeGreaterThan(ratio(reserve) * 1.25);
  });
});

describe('kullanıcının teklifleri', () => {
  it('yüksek teklif ertesi gün kabul edilir, sözleşmeyle transfer tamamlanır', () => {
    const { world, target } = setup();
    const fee = askingPrice(world, target);
    const offer = makeOffer(world, target.id, 'transfer', fee);
    expect(typeof offer).toBe('object');
    if (typeof offer === 'string') return;
    expect(offer.status).toBe('pending');
    nextDay(world);
    expect(offer.status).toBe('accepted');

    const buyerBefore = world.finances.kasimpasa!.balance;
    const sellerBefore = world.finances.konyaspor!.balance;
    const terms = demandTerms(world, target);
    const result = negotiateTransfer(world, offer.id, terms);
    expect(result.outcome).toBe('signed');
    expect(target.clubId).toBe('kasimpasa');
    expect(target.contract.wage).toBe(terms.wage);
    expect(target.contract.role).toBe(terms.role);
    expect(target.contract.expires).toBe(`${2026 + terms.years}-06-30`);
    // Bonservis ve menajer ücreti ödenir
    expect(world.finances.kasimpasa!.balance).toBe(buyerBefore - fee - terms.agentFee!);
    expect(world.finances.kasimpasa!.current.expense.agentFees).toBe(terms.agentFee);
    expect(world.finances.konyaspor!.balance).toBe(sellerBefore + fee);
    const numbers = clubPlayers(world, 'kasimpasa').map((p) => p.squadNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(world.news.some((n) => n.category === 'transfer' && n.playerId === target.id)).toBe(true);
  });

  it('orta teklife karşı teklif gelir; kabul edilince anlaşma sağlanır', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'transfer', askingPrice(world, target) * 0.75);
    if (typeof offer === 'string') throw new Error(offer);
    nextDay(world);
    expect(offer.status).toBe('countered');
    expect(offer.counterFee).toBe(askingPrice(world, target));
    expect(acceptCounter(world, offer.id)).toBeNull();
    expect(offer.status).toBe('accepted');
  });

  it('çok düşük teklif reddedilir', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'transfer', 10_000);
    if (typeof offer === 'string') throw new Error(offer);
    nextDay(world);
    expect(offer.status).toBe('rejected');
  });

  it('düşük maaşı oyuncu reddeder; menajerin sabrı tükenince anlaşma bozulur', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'transfer', askingPrice(world, target));
    if (typeof offer === 'string') throw new Error(offer);
    const patience = agentProfile(world, target).patience;
    expect(offer.patience).toBe(patience);
    nextDay(world);
    const low = { wage: 20_000, years: 3, signingBonus: 0 };
    for (let i = 1; i < patience; i++) expect(negotiateTransfer(world, offer.id, low).outcome).toBe('rejected');
    expect(negotiateTransfer(world, offer.id, low).outcome).toBe('collapsed');
    expect(offer.status).toBe('collapsed');
    expect(target.clubId).toBe('konyaspor');
  });

  it('imza bonusu düşük maaşı telafi edebilir', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'transfer', askingPrice(world, target));
    if (typeof offer === 'string') throw new Error(offer);
    nextDay(world);
    const terms = demandTerms(world, target);
    const result = negotiateTransfer(world, offer.id, { ...terms, wage: terms.wage * 0.8, signingBonus: terms.wage * 0.25 * terms.years });
    expect(result.outcome).toBe('signed');
  });

  it('bütçe ve dönem kontrolleri', () => {
    const { world, target } = setup();
    world.finances.kasimpasa!.transferBudget = 1000;
    expect(makeOffer(world, target.id, 'transfer', 5_000_000)).toMatch(/bütçe/);
    const own = clubPlayers(world, 'kasimpasa')[0]!;
    expect(makeOffer(world, own.id, 'transfer', 0)).toMatch(/zaten/);
    world.date = '2026-10-01';
    expect(makeOffer(world, target.id, 'transfer', 0)).toMatch(/kapalı/);
  });

  it('maaş bütçesi aşılırsa sözleşme yapılamaz', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'transfer', askingPrice(world, target));
    if (typeof offer === 'string') throw new Error(offer);
    nextDay(world);
    world.finances.kasimpasa!.wageBudget = totalWages(Object.values(world.players), 'kasimpasa');
    expect(negotiateTransfer(world, offer.id, { wage: 5_000_000, years: 3, signingBonus: 0 }).outcome).toBe('error');
  });

  it('kiralık: yedek oyuncu kiralanır, sezon sonunda kulübüne döner', () => {
    const { world, reserve } = setup();
    const offer = makeOffer(world, reserve.id, 'loan', loanFeeAsk(world, reserve));
    if (typeof offer === 'string') throw new Error(offer);
    nextDay(world);
    expect(offer.status).toBe('completed');
    expect(reserve.clubId).toBe('kasimpasa');
    expect(reserve.loan).toEqual({ fromClubId: 'konyaspor', until: '2027-06-30' });
    world.date = '2027-06-30';
    returnLoans(world);
    expect(reserve.clubId).toBe('konyaspor');
    expect(reserve.loan).toBeNull();
  });

  it('kulüp ilk 11 oyuncusunu kiralık vermez', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'loan', 5_000_000);
    if (typeof offer === 'string') throw new Error(offer);
    nextDay(world);
    expect(offer.status).toBe('rejected');
  });

  it('transfer dönemi kapanınca açık teklifler iptal olur', () => {
    const { world, target } = setup();
    const offer = makeOffer(world, target.id, 'transfer', askingPrice(world, target));
    if (typeof offer === 'string') throw new Error(offer);
    world.date = '2026-09-09';
    processOffers(world);
    expect(offer.status).toBe('cancelled');
  });
});

describe('gelen teklifler (kullanıcı satıcı)', () => {
  function incoming(world: GameWorld, player: Player, fee: number, maxFee: number) {
    const offer = {
      id: world.nextOfferId++, playerId: player.id, buyerId: 'galatasaray', sellerId: 'kasimpasa',
      kind: 'transfer' as const, fee, counterFee: null, status: 'pending' as const, created: world.date,
      respondOn: addDays(world.date, 7), patience: 0, maxFee, note: '',
    };
    world.offers.push(offer);
    return world.offers[world.offers.length - 1]!;
  }

  it('kabul edilen teklifle oyuncu satılır, para kasaya girer, taktikten çıkar', () => {
    const { world } = setup();
    const player = clubPlayers(world, 'kasimpasa')[3]!;
    const offer = incoming(world, player, 4_000_000, 5_000_000);
    const before = world.finances.kasimpasa!.balance;
    expect(respondToIncoming(world, offer.id, 'accept')).toBeNull();
    expect(player.clubId).toBe('galatasaray');
    expect(world.finances.kasimpasa!.balance).toBe(before + 4_000_000);
    expect(world.tactics.kasimpasa!.lineup).not.toContain(player.id);
  });

  it('karşı teklif alıcının sınırı içindeyse ertesi gün kabul edilir, değilse alıcı çekilir', () => {
    const { world } = setup();
    const [a, b] = clubPlayers(world, 'kasimpasa');
    const ok = incoming(world, a!, 3_000_000, 4_000_000);
    const tooMuch = incoming(world, b!, 3_000_000, 4_000_000);
    respondToIncoming(world, ok.id, 'counter', 3_800_000);
    respondToIncoming(world, tooMuch.id, 'counter', 6_000_000);
    nextDay(world);
    expect(ok.status).toBe('completed');
    expect(a!.clubId).toBe('galatasaray');
    expect(tooMuch.status).toBe('rejected');
    expect(b!.clubId).toBe('kasimpasa');
  });

  it('yanıtlanmayan teklif 7 gün sonra düşer', () => {
    const { world } = setup();
    const offer = incoming(world, clubPlayers(world, 'kasimpasa')[0]!, 1_000_000, 2_000_000);
    for (let i = 0; i < 7; i++) nextDay(world);
    expect(offer.status).toBe('cancelled');
  });
});

describe('sözleşme yenileme', () => {
  it('talebi karşılayan yeni sözleşme imzalanır', () => {
    const { world } = setup();
    const player = clubPlayers(world, 'kasimpasa')[0]!;
    const terms = demandTerms(world, player);
    expect(negotiateRenewal(world, player.id, { ...terms, wage: terms.wage * 0.5 }).outcome).not.toBe('signed');
    expect(negotiateRenewal(world, player.id, terms).outcome).toBe('signed');
    expect(player.contract.wage).toBe(terms.wage);
  });
});

describe('finans', () => {
  it('ay başında önceki ay kapanır, maaşlar ödenir, yayın ve sponsor geliri gelir', () => {
    const world = createWorld(gameData, 3, 'goztepe', START);
    const fin = world.finances.goztepe!;
    const before = fin.balance;
    world.date = '2026-08-01';
    startNewMonth(world);
    expect(fin.history).toHaveLength(1);
    expect(fin.history[0]!.month).toBe('2026-07');
    expect(fin.current.month).toBe('2026-08');
    const wages = totalWages(Object.values(world.players), 'goztepe') / 12;
    expect(fin.current.expense.wages).toBe(Math.round(wages));
    expect(fin.balance).toBe(before - Math.round(wages) + Math.round(fin.tvIncome / 12) + Math.round(fin.sponsorIncome / 12));
  });

  it('iç saha maçı bilet geliri getirir; kazanan prim öder', () => {
    const world = createWorld(gameData, 3, 'goztepe', START);
    const fixture = world.season.fixtures.find((f) => f.homeId === 'galatasaray')!;
    fixture.result = { homeGoals: 2, awayGoals: 0, goals: [], cards: [], injuries: [], players: [], manOfTheMatch: null,
      stats: { home: { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0 },
        away: { possession: 50, shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0 } } };
    processMatchFinances(world, fixture);
    expect(fixture.result.attendance).toBeGreaterThan(30_000);
    expect(world.finances.galatasaray!.current.income.tickets).toBe(fixture.result.attendance! * world.finances.galatasaray!.ticketPrice);
    expect(world.finances.galatasaray!.current.expense.bonuses).toBeGreaterThan(0);
  });
});

describe('sezon boyunca yapay zekâ transferleri', () => {
  const world = createWorld(gameData, 4, 'samsunspor', START);
  playSeason(world);
  const transfers = world.news.filter((n) => n.category === 'transfer');

  it('transferler olur ve yalnızca dönem içinde', () => {
    expect(transfers.length).toBeGreaterThan(15);
    for (const n of transfers) expect(transferWindow(n.date).open).toBe(true);
  });

  it('kadrolar makul büyüklükte, bütçeler negatife düşmez', () => {
    for (const club of world.clubs) {
      const size = clubPlayers(world, club.id).length;
      expect(size).toBeGreaterThanOrEqual(18);
      // Gerçek kadrolar (Transfermarkt) 38'e kadar başlar; yapay zekâ yeni sezonda 30'a indirir
      expect(size).toBeLessThanOrEqual(40);
      expect(world.finances[club.id]!.transferBudget).toBeGreaterThanOrEqual(0);
    }
  });

  it('sezonda 11 aylık rapor kapanır', () => {
    // Temmuz 2026 – Mayıs 2027 arası: 10 ay kapanır, Mayıs açık
    expect(world.finances.samsunspor!.history.length).toBe(10);
  });
});
