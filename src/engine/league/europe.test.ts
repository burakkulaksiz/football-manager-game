import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { weekday } from '../date';
import { advance } from '../gameFlow';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import { buildResult, createMatch, simulateToEnd } from '../match/engine';
import { autoSelectLineup } from '../match/formation';
import { playSeason } from '../testing';
import { cupFixtures } from './cup';
import { fixtureLabel } from './competitions';
import {
  aggregateScore,
  EUROPE,
  EUROPE_COMPETITIONS,
  EUROPE_FINAL,
  europeChampion,
  europeFixtures,
  GROUPS,
  groupTable,
  QUARTER_FIRST,
  QUARTER_SECOND,
  SEMI_FIRST,
  SEMI_SECOND,
  stageDate,
  tieWinner,
  turkishQualifiers,
} from './europe';

const START = '2026-07-01';

describe('Avrupa takvimi', () => {
  it('ŞL salı, AL perşembe; aşamalar sırayla; final ligden sonra; lig ve kupa günleriyle çakışmaz', () => {
    const world = createWorld(gameData, 5, 'galatasaray', START);
    const busy = new Set(world.season.fixtures.map((f) => f.date));
    for (const comp of EUROPE_COMPETITIONS) {
      const dates = Array.from({ length: EUROPE_FINAL }, (_, i) => stageDate(2026, comp, i + 1));
      for (const d of dates) {
        expect(weekday(d)).toBe(EUROPE[comp].weekday);
        expect(busy.has(d)).toBe(false);
      }
      expect([...dates].sort()).toEqual(dates);
    }
    // İlk sezon: itibara göre
    expect(turkishQualifiers(world)).toEqual({ cl: ['galatasaray', 'fenerbahce'], el: ['besiktas', 'trabzonspor', 'basaksehir'] });
  });
});

describe('Avrupa sezonu', () => {
  const world = createWorld(gameData, 17, 'galatasaray', START);
  playSeason(world);
  advance(world, gameData);

  it('her kupada 16 kulüp, 4 grup; grupta aynı ülkeden iki kulüp yok; Türk kulüpleri katılır', () => {
    for (const comp of EUROPE_COMPETITIONS) {
      const groupFixtures = europeFixtures(world, comp).filter((f) => f.round <= 6);
      expect(groupFixtures).toHaveLength(48);
      const teams = new Set(groupFixtures.flatMap((f) => [f.homeId, f.awayId]));
      expect(teams.size).toBe(16);
      for (const id of turkishQualifiers(world)[comp]) expect(teams).toContain(id);
      for (const g of GROUPS) {
        const table = groupTable(world, comp, g);
        expect(table).toHaveLength(4);
        expect(table.every((r) => r.played === 6)).toBe(true);
        const countries = table.map((r) => getClub(world, r.clubId).country ?? 'TUR');
        expect(new Set(countries).size).toBe(4);
      }
    }
  });

  it('çeyrek finale grupların ilk ikisi; eşleşmeler iki maçlı, kazanan bir üst tura; final tek maç', () => {
    for (const comp of EUROPE_COMPETITIONS) {
      expect([QUARTER_FIRST, QUARTER_SECOND, SEMI_FIRST, SEMI_SECOND, EUROPE_FINAL].map((r) => europeFixtures(world, comp, r).length)).toEqual([4, 4, 2, 2, 1]);
      const qualified = GROUPS.flatMap((g) => groupTable(world, comp, g).slice(0, 2).map((r) => r.clubId));
      const quarter = europeFixtures(world, comp, QUARTER_FIRST).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(quarter)).toEqual(new Set(qualified));
      for (const f of europeFixtures(world, comp, QUARTER_SECOND)) {
        const winner = tieWinner(world, f)!;
        const agg = aggregateScore(world, f)!;
        if (agg.home === agg.away) expect(f.result!.penalties).toBeDefined();
        const semi = europeFixtures(world, comp, SEMI_FIRST).flatMap((x) => [x.homeId, x.awayId]);
        expect(semi).toContain(winner);
      }
      expect(europeChampion(world, comp)).not.toBeNull();
      expect(fixtureLabel(europeFixtures(world, comp, EUROPE_FINAL)[0]!)).toBe(`${EUROPE[comp].name} · Final`);
    }
    const summary = world.history.at(-1)!;
    expect(summary.clWinnerName).toBe(getClub(world, europeChampion(world, 'cl')!).name);
    expect(summary.elWinnerName).toBe(getClub(world, europeChampion(world, 'el')!).name);
  });

  it('kupa ve Avrupa maçları aynı gün aynı kulübe denk gelmez', () => {
    const seen = new Set<string>();
    for (const f of world.season.fixtures) {
      for (const id of [f.homeId, f.awayId]) {
        const key = `${id}@${f.date}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(cupFixtures(world).length).toBeGreaterThan(0);
  });

  it('ikinci sezon: geçen sezonun ilk ikisi ŞL, kupa şampiyonu ve sıradakiler AL', () => {
    const last = world.history.at(-1)!;
    let guard = 0;
    while (world.date < '2027-07-02' && guard++ < 100) advance(world, gameData, { autoPlayUserMatch: true });
    const q = turkishQualifiers(world);
    expect(q.cl).toEqual(last.table.slice(0, 2).map((r) => r.clubId));
    if (last.cupWinnerId && !q.cl.includes(last.cupWinnerId)) expect(q.el[0]).toBe(last.cupWinnerId);
    expect(q.el).toHaveLength(3);
  });
});

describe('rövanş', () => {
  it('toplam skorda eşitlikte penaltılar; ilk maçı kazanan rövanşta kaybetse de toplamda geçebilir', () => {
    const world = createWorld(gameData, 3, 'galatasaray', START);
    const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(world, clubId)) });
    let shootouts = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const m = createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed, knockout: true, aggregate: { home: 0, away: 1 } }, world.players);
      simulateToEnd(m, world.players);
      const r = buildResult(m);
      if (r.homeGoals === r.awayGoals + 1) {
        shootouts++;
        expect(r.penalties).toBeDefined();
      } else {
        expect(r.penalties).toBeUndefined();
      }
    }
    expect(shootouts).toBeGreaterThan(0);
  });
});
