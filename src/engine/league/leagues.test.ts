import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { weekday } from '../date';
import { advance, followedFixture, todaysUserFixture } from '../gameFlow';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import { migrateWorld } from '../migrate';
import { Rng } from '../rng';
import { endSeason } from '../season/seasonEnd';
import { academyPlayers } from '../squad/academy';
import { seasonStatsByClub } from '../squad/career';
import { makeResult } from '../testing';
import type { MatchResult, Season } from '../types';
import { FOREIGN_EUROPE_SLOTS, foreignQualifiers, turkishQualifiers } from './europe';
import {
  clubsInLeague, compactResult, foreignMatchDates, leagueFixturesOf, leagueName, leagueTable, tallyLeaders, tallyResult, userLeague,
} from './leagues';
import { isBreakWeekend } from './schedule';

const START = '2026-07-01';

describe('yurtdışı ligleri', () => {
  const world = createWorld(gameData, 21, 'galatasaray', START);

  it('takvim: pazar (gerekirse çarşamba), milli aralar dışında, Ağustos – 24 Mayıs; 34 haftada kış arası boş', () => {
    for (const rounds of [30, 34, 38]) {
      const dates = foreignMatchDates(2026, rounds);
      expect(dates).toHaveLength(rounds);
      expect(new Set(dates).size).toBe(rounds);
      expect([...dates].sort()).toEqual(dates);
      for (const d of dates) {
        expect([0, 3]).toContain(weekday(d));
        expect(d >= '2026-08-08' && d <= '2027-05-24').toBe(true);
        const winter = (d.slice(5, 7) === '12' && d.slice(8) >= '24') || (d.slice(5, 7) === '01' && d.slice(8) <= '15');
        if (!winter) expect(isBreakWeekend(d)).toBe(false);
      }
    }
    expect(foreignMatchDates(2026, 34).some((d) => d.startsWith('2027-01-0'))).toBe(false);
  });

  it('her ülkenin ligi çift devreli; her kulüp her hafta bir maç; Süper Lig fikstürü ve günleri ayrı', () => {
    for (const league of ['ENG', 'ESP', 'GER', 'BEL']) {
      const ids = clubsInLeague(world, league).map((c) => c.id);
      const fixtures = leagueFixturesOf(world.season.fixtures, league);
      expect(fixtures).toHaveLength(ids.length * (ids.length - 1));
      for (const id of ids) expect(fixtures.filter((f) => f.homeId === id)).toHaveLength(ids.length - 1);
      const rounds = new Set(fixtures.map((f) => f.round));
      for (const r of rounds) {
        const week = fixtures.filter((f) => f.round === r);
        expect(new Set(week.flatMap((f) => [f.homeId, f.awayId])).size).toBe(ids.length);
        expect(new Set(week.map((f) => f.date)).size).toBe(1);
      }
    }
    const superLig = new Set(leagueFixturesOf(world.season.fixtures, undefined).map((f) => f.date));
    expect(leagueFixturesOf(world.season.fixtures, 'ENG').some((f) => superLig.has(f.date))).toBe(false);
    expect(new Set(world.season.fixtures.map((f) => f.id)).size).toBe(world.season.fixtures.length);
    expect(leagueName('ENG')).toBe('Premier League');
    expect(leagueName(undefined)).toBe('Süper Lig');
  });

  it('Türkiye\'de oynayan kullanıcının Devam\'ı yalnızca başka liglerin oynadığı günde durmaz; o maçlar oynanmış olur', () => {
    const w = structuredClone(world);
    const firstForeign = leagueFixturesOf(w.season.fixtures, 'ENG')[0]!.date;
    let guard = 0;
    while (w.date <= firstForeign && guard++ < 200) {
      const r = advance(w, gameData, { autoPlayUserMatch: true });
      if (r.kind === 'played') for (const f of r.fixtures) expect(followedFixture(w, f)).toBe(true);
    }
    const eng = leagueFixturesOf(w.season.fixtures, 'ENG').filter((f) => f.date === firstForeign);
    expect(eng.every((f) => f.result !== null)).toBe(true);
    // Kullanıcının liginde olmayan maçın sonucu sıkıştırılır, oyuncu kayıtları sayaçlara geçer
    expect(eng[0]!.result!.players).toHaveLength(0);
    expect(Object.keys(w.season.tallies ?? {}).length).toBeGreaterThan(200);
  });

  it('sıkıştırma: skor ve goller kalır; sayaçlar maç kayıtlarıyla aynı istatistiği verir', () => {
    const f = leagueFixturesOf(world.season.fixtures, 'ITA')[0]!;
    const full: MatchResult = {
      ...makeResult(2, 1),
      players: [
        { playerId: 1, clubId: f.homeId, started: true, minutes: 90, rating: 7.5, goals: 2, assists: 0 },
        { playerId: 2, clubId: f.awayId, started: false, minutes: 20, rating: 6.1, goals: 1, assists: 0 },
      ],
      cards: [{ playerId: 2, clubId: f.awayId, minute: 80, type: 'yellow' }] as MatchResult['cards'],
      manOfTheMatch: 1,
    };
    const season: Season = { year: 2026, fixtures: [] };
    tallyResult(season, full);
    const compact = compactResult(full);
    expect(compact).toMatchObject({ homeGoals: 2, awayGoals: 1, players: [], cards: [], manOfTheMatch: 1 });
    const fromTallies = seasonStatsByClub([], undefined, season.tallies);
    const fromRecords = seasonStatsByClub([{ ...f, result: full }]);
    expect(fromTallies).toEqual(fromRecords);
  });

  it('Avrupa: yurtdışı kontenjanı ülke ülke (ilk sezon itibar sırası), Türk katılımcılarla 16\'şar', () => {
    const q = foreignQualifiers(world);
    const tr = turkishQualifiers(world);
    expect(q.cl.length + tr.cl.length).toBe(16);
    expect(q.el.length + tr.el.length).toBe(16);
    expect(new Set([...q.cl, ...q.el]).size).toBe(q.cl.length + q.el.length);
    for (const [country, [cl, el]] of Object.entries(FOREIGN_EUROPE_SLOTS)) {
      expect(q.cl.filter((id) => getClub(world, id).country === country)).toHaveLength(cl);
      expect(q.el.filter((id) => getClub(world, id).country === country)).toHaveLength(el);
    }
    expect(q.cl).toContain('real-madrid');
    // Geçen sezonun tablosu varsa sıra ondan
    const w = structuredClone(world);
    const order = [...clubsInLeague(w, 'POR')].sort((a, b) => a.reputation - b.reputation);
    w.history.push({
      ...structuredClone(w.history[0] ?? ({} as never)), year: 2025, table: [], championId: '', relegatedIds: [], promotedIds: [],
      relegatedNames: [], promotedNames: [], userClubId: w.playerClubId, userPosition: 0, targetPosition: 0, awards: [],
      leagues: [{ league: 'POR', championId: order[0]!.id, championName: order[0]!.name, table: order.map((c) => ({ clubId: c.id, name: c.name, points: 0, goalDifference: 0 })) }],
    });
    expect(foreignQualifiers(w).cl).toContain(order[0]!.id);
  });
});

describe('yurtdışı kulübünü yöneten kullanıcı', () => {
  const world = createWorld(gameData, 22, 'ajax', START);

  it('yeni oyun: kadro, taktik, U19, tesis; ligi Eredivisie, yönetim hedefi beklentiden', () => {
    expect(userLeague(world)).toBe('NED');
    expect(world.tactics.ajax!.lineup.filter((id) => id !== null)).toHaveLength(11);
    expect(academyPlayers(world, 'ajax').length).toBeGreaterThan(5);
    expect(world.facilities.levels.ajax).toBeDefined();
    expect(clubPlayers(world, 'ajax').length).toBeGreaterThanOrEqual(25);
    expect(world.board.targetPosition).toBeLessThanOrEqual(4);
  });

  it('kendi lig maçında Devam durur (canlı maç); kendi liginin sonuçları tam saklanır', () => {
    const w = structuredClone(world);
    const first = leagueFixturesOf(w.season.fixtures, 'NED').find((f) => f.homeId === 'ajax' || f.awayId === 'ajax')!;
    let guard = 0;
    while (!todaysUserFixture(w) && guard++ < 200) advance(w, gameData);
    expect(todaysUserFixture(w)?.id).toBe(first.id);
    advance(w, gameData, { autoPlayUserMatch: true });
    const ned = leagueFixturesOf(w.season.fixtures, 'NED').filter((f) => f.date === first.date);
    expect(ned.every((f) => f.result !== null && f.result.players.length > 0)).toBe(true);
    expect(leagueTable(w, 'NED').find((r) => r.clubId === 'ajax')!.played).toBe(1);
  });

  it('sezon sonu: sıra ve şampiyonluk kendi liginde, küme düşme yok; yurtdışı tabloları özette', () => {
    const w = structuredClone(world);
    // Bütün lig maçları: kullanıcının takımı hepsini kazanır, diğerleri berabere
    for (const f of w.season.fixtures) {
      if (f.competition !== undefined) continue;
      f.result = f.homeId === 'ajax' ? makeResult(2, 0) : f.awayId === 'ajax' ? makeResult(0, 2) : makeResult(1, 1);
    }
    const summary = endSeason(w, new Rng(1));
    expect(summary.userPosition).toBe(1);
    expect(w.manager.titles).toBe(1);
    expect(w.gameOver).toBeNull();
    expect(summary.leagues?.find((l) => l.league === 'NED')?.championId).toBe('ajax');
    expect(summary.leagues).toHaveLength(8);
  });

  it('eski (17. sürüm) kayda eksik yurtdışı kulüpleri eklenir', () => {
    const old = createWorld({ ...gameData, foreignClubs: gameData.foreignClubs.slice(0, 40) }, 23, 'goztepe', START);
    const m = migrateWorld(structuredClone(old), 17, gameData);
    expect(m.clubs.filter((c) => c.country).length).toBe(gameData.foreignClubs.length);
    expect(clubPlayers(m, gameData.foreignClubs[gameData.foreignClubs.length - 1]!.id).length).toBeGreaterThanOrEqual(25);
    // Sezon başlamadıysa ligler hemen kurulur
    expect(leagueFixturesOf(m.season.fixtures, 'BEL').length).toBeGreaterThan(0);
  });

  it('krallık listesi sayaçlardan (sıkıştırılan lig)', () => {
    const w = structuredClone(world);
    const club = clubsInLeague(w, 'ENG')[0]!.id;
    w.season.tallies = { [`5|${club}`]: [3, 3, 4, 1, 210, 1, 0, 0], [`6|${club}`]: [1, 0, 1, 0, 60, 0, 0, 0] };
    expect(tallyLeaders(w, 'ENG', 'goals', 5)).toEqual([{ playerId: 5, clubId: club, value: 4 }, { playerId: 6, clubId: club, value: 1 }]);
    expect(tallyLeaders(w, 'ENG', 'rating', 5, 2)).toEqual([{ playerId: 5, clubId: club, value: 7 }]);
    expect(tallyLeaders(w, 'ESP', 'goals', 5)).toEqual([]);
  });
});
