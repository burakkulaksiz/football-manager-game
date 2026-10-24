import { describe, expect, it } from 'vitest';
import { gameData } from '../gameData';
import { letContractExpire, pendingDecisions } from './decisions';
import { clubPlayers, createWorld } from './generation/worldGenerator';
import type { GameWorld, TransferOffer } from './types';

const START = '2026-07-01';
const kinds = (w: GameWorld) => pendingDecisions(w).map((d) => d.kind);

function offer(world: GameWorld, over: Partial<TransferOffer>): TransferOffer {
  return {
    id: world.nextOfferId++, playerId: clubPlayers(world, world.playerClubId)[0]!.id, buyerId: 'fenerbahce', sellerId: world.playerClubId,
    kind: 'transfer', fee: 5_000_000, counterFee: null, status: 'pending', created: world.date, respondOn: world.date, patience: 3, maxFee: null, note: '',
    ...over,
  };
}

describe('karar bekleyen konular', () => {
  it('yeni oyunda karar yok', () => {
    const world = createWorld(gameData, 1, 'galatasaray', START);
    // Başlangıçta U19'da 19 yaşına basmış genç olabilir; onu ayıklayıp bak
    expect(kinds(world).filter((k) => k !== 'overAge')).toEqual([]);
  });

  it('gelen teklif, karşı teklif ve kabul edilen teklifte sözleşme görüşmesi', () => {
    const world = createWorld(gameData, 2, 'galatasaray', START);
    world.offers.push(offer(world, {}));
    world.offers.push(offer(world, { buyerId: world.playerClubId, sellerId: 'besiktas', status: 'countered', playerId: clubPlayers(world, 'besiktas')[0]!.id }));
    world.offers.push(offer(world, { buyerId: world.playerClubId, sellerId: 'trabzonspor', status: 'accepted', playerId: clubPlayers(world, 'trabzonspor')[0]!.id }));
    world.offers.push(offer(world, { status: 'rejected' }));
    expect(kinds(world).filter((k) => k !== 'overAge')).toEqual(['offer', 'counter', 'contract']);
  });

  it('oyuncu görüşme talebi ve yaş sınırını geçen U19 genci', () => {
    const world = createWorld(gameData, 3, 'galatasaray', START);
    const p = clubPlayers(world, 'galatasaray')[1]!;
    world.requests.push({ id: 1, playerId: p.id, topic: 'contract', created: START, respondBy: '2026-07-08' });
    const youth = Object.values(world.players).find((x) => x.clubId === 'galatasaray' && x.academy)!;
    youth.birthDate = '2006-01-01';
    expect(kinds(world)).toContain('request');
    expect(pendingDecisions(world).some((d) => d.kind === 'overAge' && d.playerId === youth.id)).toBe(true);
  });

  it('sezonun son iki haftası: sözleşmesi bitecek önemli oyuncu; gitmesine izin verilince kapanır', () => {
    const world = createWorld(gameData, 4, 'galatasaray', START);
    const star = clubPlayers(world, 'galatasaray').sort((a, b) => b.currentAbility - a.currentAbility)[0]!;
    star.contract.expires = '2027-06-30';
    world.date = '2027-06-10';
    expect(pendingDecisions(world).some((d) => d.kind === 'expiring')).toBe(false);
    world.date = '2027-06-20';
    const decision = pendingDecisions(world).find((d) => d.kind === 'expiring' && d.playerId === star.id)!;
    expect(decision).toBeDefined();
    letContractExpire(world, decision.id);
    expect(pendingDecisions(world).some((d) => d.id === decision.id)).toBe(false);
  });

  it('görevden alınınca karar yok', () => {
    const world = createWorld(gameData, 5, 'galatasaray', START);
    world.offers.push(offer(world, {}));
    world.gameOver = { date: START, reason: 'test' };
    expect(pendingDecisions(world)).toEqual([]);
  });
});
