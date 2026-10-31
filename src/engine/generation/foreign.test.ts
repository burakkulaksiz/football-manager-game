import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { HOME_NATION } from '../data';
import { migrateWorld } from '../migrate';
import { ageOn } from '../player';
import { Rng } from '../rng';
import { divisionOf } from '../season/expectation';
import { academyPlayers } from '../squad/academy';
import { transferPlayer, willingToJoin } from '../transfer/market';
import type { GameWorld } from '../types';
import { foreignClubs, foreignCountries, foreignIntake } from './foreign';
import { clubPlayers, createWorld, leagueClubs } from './worldGenerator';

const START = '2026-07-01';
const world = createWorld(gameData, 404, 'goztepe', START);
const top11 = (w: GameWorld, id: string) =>
  clubPlayers(w, id).map((p) => p.currentAbility).sort((a, b) => b - a).slice(0, 11).reduce((a, b) => a + b, 0) / 11;

describe('yurtdışı kulüpleri', () => {
  it('8 ülkenin birinci ligi (150 kulüp), Süper Lig ve 1. Lig dışında; U19 yok, gerçek kadro (en az 25)', () => {
    const foreign = foreignClubs(world);
    expect(foreign.length).toBe(gameData.foreignClubs.length);
    expect(foreign.length).toBeGreaterThanOrEqual(140);
    expect(foreignCountries(world)).toHaveLength(8);
    expect(leagueClubs(world).some((c) => c.country)).toBe(false);
    for (const c of foreign) {
      expect(divisionOf(c)).toBe(0);
      expect(clubPlayers(world, c.id).length).toBeGreaterThanOrEqual(25);
      expect(academyPlayers(world, c.id)).toHaveLength(0);
      expect(world.finances[c.id]).toBeDefined();
    }
  });

  it('kadrolar kendi ülkesi ağırlıklı; Türk oyuncu az ama olabilir', () => {
    const ps = foreignClubs(world).flatMap((c) => clubPlayers(world, c.id).map((p) => ({ p, c })));
    const home = ps.filter(({ p, c }) => p.nationality === c.country).length / ps.length;
    // Gerçek kadrolarda (2026/27) ~%40
    expect(home).toBeGreaterThan(0.3);
    expect(home).toBeLessThan(0.75);
    expect(ps.filter(({ p }) => p.nationality === HOME_NATION).length / ps.length).toBeLessThan(0.05);
  });

  it('devler Süper Lig devlerinden belirgin güçlü; Belçika orta sınıfı Süper Lig ortasıyla benzer', () => {
    expect(top11(world, 'real-madrid')).toBeGreaterThan(top11(world, 'galatasaray') + 12);
    // Süper Lig ortası (gerçek kadrolar): itibar sırasında ortadaki kulüpler
    const middle = [...gameData.clubs].sort((a, b) => b.reputation - a.reputation).slice(4, 10).map((c) => top11(world, c.id));
    const median = [...middle].sort((a, b) => a - b)[3]!;
    expect(Math.abs(top11(world, 'gent') - median)).toBeLessThan(12);
  });

  it('Türkiye dünyası yurtdışı eklenmeden önceki hâliyle aynı (ayrı rng): kadrolar ve fikstür', () => {
    const again = createWorld({ ...gameData, foreignClubs: [] }, 404, 'goztepe', START);
    // Süper Lig ve 1. Lig fikstürü aynı; yurtdışı ligleri sonradan eklenir (kendi tohumlarıyla)
    expect(again.season).toEqual({ ...world.season, fixtures: world.season.fixtures.filter((f) => f.league === undefined) });
    expect(world.season.fixtures.some((f) => f.league === 'ENG')).toBe(true);
    for (const p of Object.values(again.players)) expect(world.players[p.id]).toMatchObject({ firstName: p.firstName, currentAbility: p.currentAbility });
  });

  it('dev kulübün yıldızı Türkiye\'ye gelmek istemez (30 yaş altı); Türk kulübünün oyuncusu yurtdışına gider', () => {
    const star = clubPlayers(world, 'real-madrid').find((p) => ageOn(p.birthDate, START) < 29)!;
    expect(willingToJoin(world, star, 'galatasaray')).toBe(false);
    const gs = clubPlayers(world, 'galatasaray')[0]!;
    expect(willingToJoin(world, gs, 'benfica')).toBe(true);
  });

  it('yurtdışı kulüpleri arasındaki transfer habere düşmez; Türk kulübüne gelen düşer', () => {
    const w = createWorld(gameData, 405, 'goztepe', START);
    const before = w.news.length;
    transferPlayer(w, clubPlayers(w, 'gent')[5]!, 'ajax', 2_000_000, { wage: 500_000, years: 3, signingBonus: 0 });
    expect(w.news.length).toBe(before);
    transferPlayer(w, clubPlayers(w, 'gent')[6]!, 'besiktas', 2_000_000, { wage: 500_000, years: 3, signingBonus: 0 });
    expect(w.news.length).toBe(before + 1);
  });

  it('yaz: yabancı kulüplerin A takımına 2–3 genç (17–18) katılır, forma numarasıyla', () => {
    const w = createWorld(gameData, 406, 'goztepe', START);
    const before = new Set(Object.keys(w.players).map(Number));
    foreignIntake(w, new Rng(1), gameData);
    for (const c of foreignClubs(w)) {
      const fresh = clubPlayers(w, c.id).filter((p) => !before.has(p.id));
      expect(fresh.length).toBeGreaterThanOrEqual(2);
      expect(fresh.length).toBeLessThanOrEqual(3);
      for (const p of fresh) {
        expect(ageOn(p.birthDate, w.date)).toBeLessThanOrEqual(18);
        expect(p.squadNumber).not.toBeNull();
        expect(p.academy).toBeUndefined();
      }
    }
  });

  it('10. sürüm kaydına yurtdışı kulüpleri eklenir', () => {
    const old = createWorld({ ...gameData, foreignClubs: [] }, 407, 'goztepe', START);
    const m = migrateWorld(old, 10, gameData);
    expect(foreignClubs(m)).toHaveLength(gameData.foreignClubs.length);
    expect(clubPlayers(m, 'ajax').length).toBeGreaterThanOrEqual(25);
    expect(m.finances.ajax!.tvIncome).toBeGreaterThan(m.finances.ajax!.wageBudget * 0.5);
  });
});
