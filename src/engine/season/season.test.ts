import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { ageOn } from '../player';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld, getClub, leagueClubs } from '../generation/worldGenerator';
import { computeStandings } from '../league/standings';
import { negotiateFreeAgent } from '../transfer/offers';
import { wageDemand } from '../transfer/market';
import { makeResult } from '../testing';
import type { GameWorld } from '../types';
import { boardAfterMatch, MIN_ROUNDS_BEFORE_SACK } from './board';
import { divisionOf } from './expectation';
import { prizeFor } from './seasonEnd';

const START = '2026-07-01';

/** Belirtilen tarihe kadar oyunu oynatır (kendi maçımız da otomatik). */
function playUntil(world: GameWorld, date: string): void {
  let guard = 0;
  while (world.date < date && !world.gameOver && guard++ < 3000) advance(world, gameData, { autoPlayUserMatch: true });
}

describe('sezon döngüsü', () => {
  const world = createWorld(gameData, 101, 'galatasaray', START);
  const lowerIds = world.clubs.filter((c) => divisionOf(c) === 2).map((c) => c.id);
  const lastMatch = world.season.fixtures.reduce((d, f) => (f.date > d ? f.date : d), '');

  it('son maçın ertesi günü sezon kapanır: şampiyon, küme düşenler, çıkanlar, ödüller, primler', () => {
    playUntil(world, lastMatch);
    const finalTable = computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);
    playUntil(world, '2027-05-20');
    expect(world.seasonState).toBe('ended');
    const summary = world.history[0]!;
    expect(summary.year).toBe(2026);
    expect(summary.championId).toBe(finalTable[0]!.clubId);
    expect(summary.relegatedIds).toEqual(finalTable.slice(-3).map((r) => r.clubId));
    expect(summary.promotedIds).toHaveLength(3);
    for (const id of summary.promotedIds) expect(lowerIds).toContain(id);
    expect(summary.awards.length).toBeGreaterThanOrEqual(4);
    expect(world.finances[summary.championId]!.current.income.prize + world.finances[summary.championId]!.history.reduce((s, r) => s + (r.income.prize ?? 0), 0))
      .toBe(prizeFor(1, 18));
    expect(world.news.some((n) => n.category === 'season')).toBe(true);
  });

  it('menajer kartı sezonun sonuçlarını ve şampiyonluğu tutar', () => {
    if (world.gameOver) return;
    const table = computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);
    const row = table.find((r) => r.clubId === 'galatasaray')!;
    expect(world.manager.name).toBe('Menajer');
    expect([world.manager.won, world.manager.drawn, world.manager.lost]).toEqual([row.won, row.drawn, row.lost]);
    expect(world.manager.titles).toBe(world.history[0]!.championId === 'galatasaray' ? 1 : 0);
  });

  it('30 Haziran: kullanıcının sözleşmesi biten oyuncuları serbest kalır, yapay zekâ işine yarayanı yeniler', () => {
    const expiringUser = clubPlayers(world, 'galatasaray').filter((p) => p.contract.expires <= '2027-06-30' && !p.loan).map((p) => p.id);
    playUntil(world, '2027-06-30');
    for (const id of expiringUser) {
      const p = world.players[id];
      if (p) expect(p.clubId).toBeNull();
    }
    // Yapay zekâ kulüplerinde süresi bugün biten ve hâlâ kulübünde olan kalmadı
    const stale = Object.values(world.players).filter((p) => p.clubId && p.clubId !== 'galatasaray' && p.contract.expires <= world.date);
    expect(stale).toHaveLength(0);
  });

  it('1 Temmuz: yeni sezon — ligler değişir, yeni fikstür, altyapı gelir, emeklilik olur', () => {
    const summary = world.history[0]!;
    const before = Object.keys(world.players).length;
    playUntil(world, '2027-07-01');
    expect(world.seasonState).toBe('running');
    expect(world.season.year).toBe(2027);
    expect(world.season.fixtures).toHaveLength(306);
    const league = leagueClubs(world).map((c) => c.id);
    expect(league).toHaveLength(18);
    for (const id of summary.promotedIds) expect(league).toContain(id);
    for (const id of summary.relegatedIds) expect(getClub(world, id).division).toBe(2);
    const youngsters = Object.values(world.players).filter((p) => ageOn(p.birthDate, world.date) <= 17 && p.clubId);
    expect(youngsters.length).toBeGreaterThanOrEqual(26 * 3);
    expect(Object.values(world.players).every((p) => ageOn(p.birthDate, world.date) < 38 || !p.clubId)).toBe(true);
    expect(Object.keys(world.players).length).not.toBe(before);
    expect(Object.values(world.players).every((p) => p.yellowCards === 0)).toBe(true);
    expect(world.offers.every((o) => world.players[o.playerId] !== undefined)).toBe(true);
    expect(world.board.targetPosition).toBeGreaterThanOrEqual(1);
  });

  it('ikinci sezon da sonuna kadar oynanır', () => {
    playUntil(world, '2028-06-05');
    if (world.gameOver) return; // nadiren kovulabilir; döngü yine de çalıştı
    expect(world.history).toHaveLength(2);
    expect(world.history[1]!.year).toBe(2027);
  });
});

describe('serbest oyuncular', () => {
  it('serbest oyuncu bonservissiz imzalanır', () => {
    const world = createWorld(gameData, 7, 'kasimpasa', START);
    world.finances.kasimpasa!.wageBudget = 60_000_000;
    const player = clubPlayers(world, 'konyaspor')[5]!;
    player.clubId = null;
    player.squadNumber = null;
    const demand = wageDemand(world, player, 'kasimpasa');
    const balance = world.finances.kasimpasa!.balance;
    const result = negotiateFreeAgent(world, player.id, { wage: demand * 1.2, years: 2, signingBonus: 0 });
    expect(result.outcome).toBe('signed');
    expect(player.clubId).toBe('kasimpasa');
    expect(world.finances.kasimpasa!.balance).toBe(balance);
  });
});

describe('yönetim', () => {
  it('yenilgiler güveni düşürür; dibe vurunca ve yeterli hafta oynandıysa görevden alınırsın', () => {
    const world = createWorld(gameData, 9, 'fenerbahce', START);
    const ours = world.season.fixtures.filter((f) => f.homeId === 'fenerbahce' || f.awayId === 'fenerbahce');
    const start = world.board.confidence;
    for (let i = 0; i < MIN_ROUNDS_BEFORE_SACK + 10 && !world.gameOver; i++) {
      const f = ours[i]!;
      const home = f.homeId === 'fenerbahce';
      f.result = makeResult(home ? 0 : 3, home ? 3 : 0);
      boardAfterMatch(world, f);
      if (i === 0) expect(world.board.confidence).toBeLessThan(start);
      if (i < MIN_ROUNDS_BEFORE_SACK - 1) expect(world.gameOver).toBeNull();
    }
    expect(world.gameOver).not.toBeNull();
    expect(world.manager.won + world.manager.drawn).toBe(0);
    expect(world.manager.lost).toBeGreaterThanOrEqual(MIN_ROUNDS_BEFORE_SACK);
    // Kovulduktan sonra oyun ilerlemez
    const date = world.date;
    expect(advance(world, gameData).kind).toBe('moved');
    expect(world.date).toBe(date);
  });
});

describe('sezon geçişinde tekrarlanabilirlik', () => {
  it('aynı seed ile yeni sezonun ilk haftaları da aynı', () => {
    const a = createWorld(gameData, 55, 'trabzonspor', START);
    const b = createWorld(gameData, 55, 'trabzonspor', START);
    playUntil(a, '2027-08-20');
    playUntil(b, '2027-08-20');
    expect(a.season.fixtures).toEqual(b.season.fixtures);
    expect(a.history).toEqual(b.history);
  });
});
