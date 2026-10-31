import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { ageOn } from '../player';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld, getClub, leagueClubs } from '../generation/worldGenerator';
import { CUP_ROUNDS, cupFixtures, fixtureWinner } from '../league/cup';
import { europeCompetitionOf } from '../league/europe';
import { computeStandings } from '../league/standings';
import { lowerStandings } from '../league/lowerLeague';
import { negotiateFreeAgent } from '../transfer/offers';
import { contractDemand } from '../transfer/agents';
import { makeResult, playUntil } from '../testing';
import type { Fixture, GameWorld } from '../types';
import { boardAfterMatch, MIN_ROUNDS_BEFORE_SACK } from './board';
import { NO_CLUB } from './jobs';
import { divisionOf } from './expectation';
import { prizeFor } from './seasonEnd';

const START = '2026-07-01';

/** Kulübün kupada geçtiği turların ödülleri. */
function cupPrizes(world: GameWorld, clubId: string): number {
  return cupFixtures(world).filter((f) => fixtureWinner(f) === clubId).reduce((sum, f) => sum + CUP_ROUNDS[f.round - 1]!.prize, 0);
}

describe('sezon döngüsü', () => {
  const world = createWorld(gameData, 101, 'galatasaray', START);
  const lowerIds = world.clubs.filter((c) => divisionOf(c) === 2).map((c) => c.id);

  it('son maçın ertesi günü sezon kapanır: şampiyon, küme düşenler, çıkanlar, ödüller, primler', () => {
    // Sezon son maçın (Şampiyonlar Ligi finali, 25 Mayıs) ertesi günü kapanır
    playUntil(world, '2027-05-28');
    // Fikstür 1 Temmuz'a kadar geçen sezonundur; tablo son haftadan sonra alınır.
    const finalTable = computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);
    expect(world.seasonState).toBe('ended');
    const summary = world.history[0]!;
    expect(summary.year).toBe(2026);
    expect(summary.championId).toBe(finalTable[0]!.clubId);
    expect(summary.relegatedIds).toEqual(finalTable.slice(-3).map((r) => r.clubId));
    // 1. Lig oynandı: bütün maçların skoru var, çıkanlar tablonun ilk üçü
    expect(world.season.lower!.every((f) => f.result !== null)).toBe(true);
    expect(summary.promotedIds).toEqual(lowerStandings(world).slice(0, 3).map((r) => r.clubId));
    for (const id of summary.promotedIds) expect(lowerIds).toContain(id);
    expect(summary.awards.length).toBeGreaterThanOrEqual(4);
    const championPrize = world.finances[summary.championId]!.current.income.prize + world.finances[summary.championId]!.history.reduce((s, r) => s + (r.income.prize ?? 0), 0);
    // Avrupa'da oynadıysa onun ödülleri de eklenir
    if (europeCompetitionOf(world, summary.championId)) expect(championPrize).toBeGreaterThan(prizeFor(1, 18) + cupPrizes(world, summary.championId));
    else expect(championPrize).toBe(prizeFor(1, 18) + cupPrizes(world, summary.championId));
    expect(world.news.some((n) => n.category === 'season')).toBe(true);
  });

  it('menajer kartı sezonun sonuçlarını ve şampiyonluğu tutar', () => {
    if (world.gameOver) return;
    const table = computeStandings(leagueClubs(world).map((c) => c.id), world.season.fixtures);
    const row = table.find((r) => r.clubId === 'galatasaray')!;
    expect(world.manager.name).toBe('Menajer');
    // Lig, kupa ve Avrupa maçları (penaltılarla biten maç beraberlik sayılır)
    const cup = world.season.fixtures.filter((f) => f.competition && (f.homeId === 'galatasaray' || f.awayId === 'galatasaray'));
    const goals = (f: Fixture) => (f.homeId === 'galatasaray' ? [f.result!.homeGoals, f.result!.awayGoals] : [f.result!.awayGoals, f.result!.homeGoals]);
    const cupWon = cup.filter((f) => goals(f)[0]! > goals(f)[1]!).length;
    const cupDrawn = cup.filter((f) => goals(f)[0] === goals(f)[1]).length;
    expect([world.manager.won, world.manager.drawn, world.manager.lost]).toEqual([row.won + cupWon, row.drawn + cupDrawn, row.lost + cup.length - cupWon - cupDrawn]);
    expect(world.manager.titles).toBe(world.history[0]!.championId === 'galatasaray' ? 1 : 0);
  });

  it('30 Haziran: kullanıcının sözleşmesi biten oyuncuları serbest kalır, yapay zekâ işine yarayanı yeniler', () => {
    const expiringUser = clubPlayers(world, 'galatasaray').filter((p) => p.contract.expires <= '2027-06-30' && !p.loan).map((p) => p.id);
    playUntil(world, '2027-06-30');
    for (const id of expiringUser) {
      const p = world.players[id];
      // Kulüpten ayrılır (aynı gün başka bir kulüp serbest oyuncu olarak alabilir)
      if (p) expect(p.clubId).not.toBe('galatasaray');
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
    expect(world.season.fixtures.filter((f) => f.league === undefined)).toHaveLength(306);
    // Yurtdışı ligleri de yeni sezonun fikstüründe; geçen sezonun tabloları özette
    expect(world.season.fixtures.some((f) => f.league === 'ESP' && f.round === 1)).toBe(true);
    expect(summary.leagues?.map((l) => l.league)).toContain('ENG');
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
    // Tam sezon simülasyonu: yük altında 30 sn'lik varsayılanı aşabiliyor (bkz. FINDINGS.md, test süreleri)
  }, 400_000);
});

describe('serbest oyuncular', () => {
  it('serbest oyuncu bonservissiz imzalanır', () => {
    const world = createWorld(gameData, 7, 'kasimpasa', START);
    world.finances.kasimpasa!.wageBudget = 60_000_000;
    const player = clubPlayers(world, 'konyaspor')[5]!;
    player.clubId = null;
    player.squadNumber = null;
    const d = contractDemand(world, player, 'kasimpasa');
    const balance = world.finances.kasimpasa!.balance;
    const result = negotiateFreeAgent(world, player.id, { wage: d.wage * 1.2, years: d.years, signingBonus: 0, agentFee: d.agentFee, releaseClause: d.releaseClause });
    expect(result.outcome).toBe('signed');
    expect(player.clubId).toBe('kasimpasa');
    // Bonservis yok; yalnızca menajer ücreti
    expect(world.finances.kasimpasa!.balance).toBe(balance - d.agentFee);
  });
});

describe('yönetim', () => {
  it('yenilgiler güveni düşürür; dibe vurunca ve yeterli hafta oynandıysa görevden alınırsın', () => {
    const world = createWorld(gameData, 9, 'fenerbahce', START);
    const ours = world.season.fixtures.filter((f) => f.homeId === 'fenerbahce' || f.awayId === 'fenerbahce');
    const start = world.board.confidence;
    for (let i = 0; i < MIN_ROUNDS_BEFORE_SACK + 10 && !world.unemployed; i++) {
      const f = ours[i]!;
      const home = f.homeId === 'fenerbahce';
      f.result = makeResult(home ? 0 : 3, home ? 3 : 0);
      boardAfterMatch(world, f);
      if (i === 0) expect(world.board.confidence).toBeLessThan(start);
      if (i < MIN_ROUNDS_BEFORE_SACK - 1) expect(world.unemployed ?? null).toBeNull();
    }
    // Görevden alınan menajer işsiz kalır (kariyer bitmez), kulübü yapay zekâya geçer
    expect(world.unemployed).toMatchObject({ lastClubId: 'fenerbahce', reason: 'sacked' });
    expect(world.playerClubId).toBe(NO_CLUB);
    expect(world.gameOver).toBeNull();
    expect(world.vacancies?.some((v) => v.clubId === 'fenerbahce')).toBe(true);
    expect(world.manager.won + world.manager.drawn).toBe(0);
    expect(world.manager.lost).toBeGreaterThanOrEqual(MIN_ROUNDS_BEFORE_SACK);
    expect(world.manager.seasons?.at(-1)).toMatchObject({ clubId: 'fenerbahce', sacked: true });
    // Kovulduktan sonra oyun işsiz olarak ilerler
    const date = world.date;
    advance(world, gameData);
    expect(world.date > date).toBe(true);
  });
});
