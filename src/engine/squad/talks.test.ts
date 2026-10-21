import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { addDays } from '../date';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { makeResult } from '../testing';
import type { Fixture, GameWorld, Player } from '../types';
import {
  activePromise,
  expireRequests,
  nextTalkDate,
  playerRequests,
  PROMISE_MATCHES,
  respondToRequest,
  talkToPlayer,
  trackPromises,
} from './talks';

const START = '2026-07-01';
const fresh = () => createWorld(gameData, 71, 'goztepe', START);
const ranked = (w: GameWorld) => clubPlayers(w, w.playerClubId).sort((a, b) => b.currentAbility - a.currentAbility);
/** Bir pazartesi (haftalık kontrol günü). */
const MONDAY = '2026-07-06';

describe('oyuncunun görüşme talepleri', () => {
  it('morali düşük sağlam oyuncu forma şansı ister; aynı hafta ikinci talep yok', () => {
    const w = fresh();
    w.date = MONDAY;
    const p = ranked(w)[15]!;
    p.morale = 20;
    playerRequests(w);
    const req = w.requests.find((r) => r.playerId === p.id)!;
    expect(req.topic).toBe('playingTime');
    expect(req.respondBy).toBe(addDays(MONDAY, 7));
    expect(w.news.some((n) => n.playerId === p.id && n.title.includes('forma şansı'))).toBe(true);
    playerRequests(w);
    expect(w.requests.filter((r) => r.playerId === p.id)).toHaveLength(1);
  });

  it('forma şansı: söz ver (söz takibe girer), yerini kazanmalı (profesyonele göre), kiralık listesi', () => {
    const w = fresh();
    w.date = MONDAY;
    const [a, b, c] = ranked(w).slice(14, 17) as [Player, Player, Player];
    for (const p of [a, b, c]) p.morale = 20;
    b.hidden.professionalism = 18;
    c.hidden.professionalism = 5;
    // Haftada bir talep: üç haftada üçü de gelir
    for (let week = 0; week < 3; week++) {
      playerRequests(w);
      w.date = addDays(w.date, 7);
    }
    w.date = MONDAY;
    const req = (p: Player) => w.requests.find((r) => r.playerId === p.id)!.id;

    expect(respondToRequest(w, req(a), 'promise').delta).toBe(12);
    expect(activePromise(w, a.id)).toBeDefined();
    expect(respondToRequest(w, req(b), 'compete').delta).toBe(3);
    delete c.listing;
    const before = c.morale;
    expect(respondToRequest(w, req(c), 'loanList').error).toBeUndefined();
    expect(w.players[c.id]!.listing?.kind).toBe('loan');
    expect(c.morale).toBe(before + 6);
    expect(w.requests).toHaveLength(0);
  });

  it('haftada en fazla bir yeni talep; önce ayrılık, sonra forma şansı, sonra sözleşme', () => {
    const w = fresh();
    w.date = MONDAY;
    const [star, bench, leaver] = [ranked(w)[0]!, ranked(w)[15]!, ranked(w)[9]!];
    star.contract.wage = 10_000;
    bench.morale = 20;
    leaver.morale = 15;
    leaver.unhappySince = addDays(MONDAY, -40);
    playerRequests(w);
    expect(w.requests.map((r) => r.topic)).toEqual(['transfer']);
    w.date = addDays(MONDAY, 7);
    playerRequests(w);
    expect(w.requests.map((r) => r.topic)).toEqual(['transfer', 'playingTime']);
    w.date = addDays(MONDAY, 14);
    playerRequests(w);
    expect(w.requests.map((r) => r.topic)).toEqual(['transfer', 'playingTime', 'contract']);
  });

  it('uzun süre mutsuz oyuncu ayrılmak ister; transfer listesine koymak onu sevindirir', () => {
    const w = fresh();
    w.date = MONDAY;
    const p = ranked(w)[8]!;
    p.morale = 15;
    p.unhappySince = addDays(MONDAY, -40);
    playerRequests(w);
    const req = w.requests.find((r) => r.playerId === p.id)!;
    expect(req.topic).toBe('transfer');
    // Geçersiz yanıt reddedilir
    expect(respondToRequest(w, req.id, 'promise').error).toBeDefined();
    const result = respondToRequest(w, req.id, 'transferList');
    expect(result.delta).toBe(10);
    expect(p.listing?.kind).toBe('transfer');
    expect(p.unhappySince).toBeUndefined();
  });

  it('maaşı talebinin çok altındaki ilk 11 oyuncusu sözleşme ister; "şimdi değil" morali düşürür', () => {
    const w = fresh();
    w.date = MONDAY;
    const star = ranked(w)[0]!;
    star.contract.wage = 10_000;
    playerRequests(w);
    const req = w.requests.find((r) => r.playerId === star.id)!;
    expect(req.topic).toBe('contract');
    expect(respondToRequest(w, req.id, 'later').delta).toBe(-8);
  });

  it('yanıtsız talep süresi dolunca düşer, oyuncu kırılır', () => {
    const w = fresh();
    w.date = MONDAY;
    const p = ranked(w)[15]!;
    p.morale = 20;
    playerRequests(w);
    w.date = addDays(MONDAY, 8);
    expireRequests(w);
    expect(w.requests).toHaveLength(0);
    expect(p.morale).toBe(12);
    expect(w.news.some((n) => n.playerId === p.id && n.title.includes('görmezden'))).toBe(true);
  });
});

describe('menajerin başlattığı görüşmeler', () => {
  it('övgü formu iyiyse sevindirir, kötüyse ters teper; haksız eleştiri kırar; 14 gün bekleme', () => {
    const w = fresh();
    const [good, bad, critic] = ranked(w).slice(0, 3) as [Player, Player, Player];
    good.form = [7.4, 7.2, 7.6];
    bad.form = [5.8, 6.1, 5.9];
    critic.form = [7.5, 7.3];
    expect(talkToPlayer(w, good.id, 'praise')).toMatchObject({ reaction: 'positive', delta: 8 });
    expect(talkToPlayer(w, bad.id, 'praise').delta).toBe(-3);
    expect(talkToPlayer(w, critic.id, 'criticize')).toMatchObject({ reaction: 'negative', delta: -12 });
    expect(talkToPlayer(w, good.id, 'encourage').error).toBeDefined();
    expect(nextTalkDate(w, good)).toBe(addDays(START, 14));
    w.date = addDays(START, 14);
    expect(talkToPlayer(w, good.id, 'encourage').error).toBeUndefined();
  });

  it('başka kulübün oyuncusuyla görüşülmez', () => {
    const w = fresh();
    const other = clubPlayers(w, 'galatasaray')[0]!;
    expect(talkToPlayer(w, other.id, 'praise').error).toBeDefined();
  });
});

describe('forma şansı sözünün takibi', () => {
  function ourFixture(w: GameWorld): Fixture {
    return w.season.fixtures.find((f) => f.homeId === w.playerClubId || f.awayId === w.playerClubId)!;
  }
  function play(w: GameWorld, p: Player, started: boolean): void {
    const result = makeResult(1, 0);
    if (started) result.players = [{ playerId: p.id, clubId: w.playerClubId, started: true, minutes: 90, rating: 6.8, goals: 0, assists: 0 }];
    trackPromises(w, ourFixture(w), result);
  }

  it(`${PROMISE_MATCHES} maçın 3'ünde ilk 11 → söz tutuldu, moral artar`, () => {
    const w = fresh();
    const p = ranked(w)[16]!;
    talkToPlayer(w, p.id, 'promise');
    const morale = p.morale;
    [true, false, true, true, false].forEach((s) => play(w, p, s));
    expect(activePromise(w, p.id)).toBeUndefined();
    expect(p.morale).toBe(Math.min(100, morale + 8));
  });

  it('söz tutulmazsa moral sert düşer ve oyuncu mutsuz sayılır; sakatken oynanan maç sayılmaz', () => {
    const w = fresh();
    const p = ranked(w)[16]!;
    talkToPlayer(w, p.id, 'promise');
    p.injury = { name: 'Darbe', daysOut: 5 };
    play(w, p, false);
    expect(activePromise(w, p.id)!.matches).toBe(0);
    p.injury = null;
    const morale = p.morale;
    for (let i = 0; i < PROMISE_MATCHES; i++) play(w, p, i === 0);
    expect(activePromise(w, p.id)).toBeUndefined();
    expect(p.morale).toBe(Math.max(0, morale - 20));
    expect(p.unhappySince).toBe(START);
  });
});
