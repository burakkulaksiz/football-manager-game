import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { playerSeasonStats } from '../league/stats';
import { playSeason, makeResult } from '../testing';
import { loanPlayer, releasePlayer, returnLoans, transferPlayer } from '../transfer/market';
import type { GameWorld, PlayerMatchRecord } from '../types';
import { academyPlayers, promoteToFirstTeam } from './academy';
import { careerTotals, currentSeasonRows, recordSeasonCareers, seasonStatsByClub } from './career';

const START = '2026-07-01';
const rec = (playerId: number, clubId: string, goals = 0, rating = 7): PlayerMatchRecord =>
  ({ playerId, clubId, started: true, minutes: 90, rating, goals, assists: 0 });

describe('sezon kariyeri', () => {
  it('sezon sonunda forma giyen herkesin sezonu yazılır; istatistikler sezon istatistiğiyle aynı', () => {
    const w = createWorld(gameData, 91, 'goztepe', START);
    playSeason(w);
    // Sezon kapanışı (endSeason → kariyer kaydı) son maçın ertesi günü
    for (let i = 0; i < 30 && w.seasonState !== 'ended'; i++) advance(w, gameData);
    expect(w.seasonState).toBe('ended');
    const regular = clubPlayers(w, 'goztepe').sort((a, b) => playerSeasonStats(w.season.fixtures, b.id).apps - playerSeasonStats(w.season.fixtures, a.id).apps)[0]!;
    const row = regular.career!.find((c) => c.year === 2026)!;
    const stats = playerSeasonStats(w.season.fixtures, regular.id);
    expect(row).toMatchObject({ clubId: 'goztepe', apps: stats.apps, goals: stats.goals, assists: stats.assists, starts: stats.starts });
    expect(row.avgRating).toBeCloseTo(stats.avgRating!, 2);
    // Aynı sezon iki kez yazılmaz; canlı satır artık boş
    recordSeasonCareers(w);
    expect(regular.career!.filter((c) => c.year === 2026)).toHaveLength(1);
    expect(currentSeasonRows(w, regular)).toEqual([]);
    // Tam sezon simülasyonu: yük altında 30 sn'lik varsayılanı aşabiliyor (bkz. FINDINGS.md, test süreleri)
  }, 120_000);

  it('sezon ortasında kulüp değiştiren oyuncunun iki satırı olur; toplam ikisini birleştirir', () => {
    const w = createWorld(gameData, 92, 'goztepe', START);
    const p = clubPlayers(w, 'goztepe')[5]!;
    const [f1, f2, f3] = w.season.fixtures;
    f1!.result = { ...makeResult(1, 0), players: [rec(p.id, 'goztepe', 1, 8)] };
    f2!.result = { ...makeResult(0, 0), players: [rec(p.id, 'goztepe', 0, 6)] };
    f3!.result = { ...makeResult(2, 1), players: [rec(p.id, 'kasimpasa', 2, 7)] };
    const live = currentSeasonRows(w, p);
    expect(live.map((r) => [r.clubId, r.apps, r.goals])).toEqual([['goztepe', 2, 1], ['kasimpasa', 1, 2]]);
    expect(careerTotals(live)).toMatchObject({ apps: 3, goals: 3, avgRating: 7 });
    expect(seasonStatsByClub(w.season.fixtures).get(p.id)!.size).toBe(2);
  });
});

describe('kulüp hareketleri', () => {
  const freshWorld = (): GameWorld => createWorld(gameData, 93, 'goztepe', START);

  it('transfer (bonservis), serbest imza, serbest bırakma', () => {
    const w = freshWorld();
    const p = clubPlayers(w, 'kasimpasa')[3]!;
    transferPlayer(w, p, 'goztepe', 1_500_000, { wage: 300_000, years: 2, signingBonus: 0 });
    expect(p.moves!.at(-1)).toMatchObject({ kind: 'transfer', fromClubId: 'kasimpasa', toClubId: 'goztepe', fee: 1_500_000, date: START });
    releasePlayer(w, p);
    expect(p.moves!.at(-1)).toMatchObject({ kind: 'release', fromClubId: 'goztepe', toClubId: null });
    transferPlayer(w, p, 'galatasaray', 0, { wage: 300_000, years: 1, signingBonus: 0 });
    expect(p.moves!.at(-1)).toMatchObject({ kind: 'free', fromClubId: null, toClubId: 'galatasaray' });
  });

  it('kiralık ve dönüşü; U19dan A takıma yükselme', () => {
    const w = freshWorld();
    const p = clubPlayers(w, 'goztepe')[20]!;
    loanPlayer(w, p, 'kasimpasa', 100_000);
    expect(p.moves!.at(-1)).toMatchObject({ kind: 'loan', fromClubId: 'goztepe', toClubId: 'kasimpasa', fee: 100_000 });
    w.date = '2027-06-30';
    returnLoans(w);
    expect(p.moves!.at(-1)).toMatchObject({ kind: 'loanEnd', fromClubId: 'kasimpasa', toClubId: 'goztepe' });
    const youth = academyPlayers(w, 'goztepe')[0]!;
    promoteToFirstTeam(w, youth);
    expect(youth.moves!.at(-1)).toMatchObject({ kind: 'promoted', fromClubId: 'goztepe', toClubId: 'goztepe' });
  });
});
