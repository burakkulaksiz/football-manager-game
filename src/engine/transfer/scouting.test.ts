import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { ALL_ATTRS } from '../attributes';
import { addDays } from '../date';
import { clubPlayers, createWorld } from '../generation/worldGenerator';
import { applyResult } from '../match/simulate';
import { migrateWorld } from '../migrate';
import { ageOn } from '../player';
import { Rng } from '../rng';
import { academyPlayers } from '../squad/academy';
import { makeResult } from '../testing';
import type { GameWorld, PlayerMatchRecord } from '../types';
import { transferPlayer } from './market';
import {
  assignScout,
  attributeRange,
  FULL_KNOWLEDGE,
  knowledgeOf,
  MATCH_KNOWLEDGE_CAP,
  MAX_ASSIGNMENTS,
  rangeWidth,
  SCOUT_TASKS,
  scoutBlocker,
  scoutingDay,
} from './scouting';

const START = '2026-07-01';
const fresh = (): GameWorld => createWorld(gameData, 71, 'goztepe', START);

/** Görev süresi kadar gün ilerletir (yalnızca gözlemci işleri). */
function passDays(w: GameWorld, days: number): void {
  const rng = new Rng(5);
  for (let i = 0; i < days; i++) {
    w.date = addDays(w.date, 1);
    scoutingDay(w, rng);
  }
}

describe('oyuncu bilgisi', () => {
  it('kendi oyuncumuz tam, başka kulübün U19u hiç bilinmez; ün yetenek ve itibarla artar', () => {
    const w = fresh();
    expect(knowledgeOf(w, clubPlayers(w, 'goztepe')[0]!)).toBe(FULL_KNOWLEDGE);
    expect(knowledgeOf(w, academyPlayers(w, 'goztepe')[0]!)).toBe(FULL_KNOWLEDGE);
    expect(knowledgeOf(w, academyPlayers(w, 'galatasaray')[0]!)).toBe(0);
    const best = (id: string) => clubPlayers(w, id).sort((a, b) => b.currentAbility - a.currentAbility)[0]!;
    const big = knowledgeOf(w, best('galatasaray'));
    expect(big).toBeGreaterThan(20);
    expect(big).toBeLessThan(FULL_KNOWLEDGE);
    // Kadronun zayıf oyuncuları neredeyse hiç tanınmaz
    const weakest = clubPlayers(w, 'kasimpasa').sort((a, b) => a.currentAbility - b.currentAbility)[0]!;
    expect(knowledgeOf(w, weakest)).toBeLessThan(big);
  });

  it('özellik aralığı gerçek değeri içerir, bilgi arttıkça daralır, tam bilgide tek sayı', () => {
    const w = fresh();
    for (const p of clubPlayers(w, 'trabzonspor')) {
      for (const k of ALL_ATTRS) {
        for (const knowledge of [0, 30, 75, 99]) {
          const r = attributeRange(w, p, k, knowledge);
          expect(r.lo).toBeLessThanOrEqual(p.attributes[k]);
          expect(r.hi).toBeGreaterThanOrEqual(p.attributes[k]);
          expect(r.lo).toBeGreaterThanOrEqual(1);
          expect(r.hi).toBeLessThanOrEqual(20);
          expect(r.hi - r.lo).toBe(rangeWidth(knowledge));
        }
        expect(attributeRange(w, p, k, FULL_KNOWLEDGE)).toEqual({ lo: p.attributes[k], hi: p.attributes[k] });
      }
    }
    expect(rangeWidth(0)).toBeGreaterThan(rangeWidth(75));
  });

  it('karşılaştığımız takımın oynayan oyuncuları maçla tanınır (sınıra kadar); diğer maçlar etkilemez', () => {
    const w = fresh();
    const f = w.season.fixtures.find((x) => x.homeId === 'goztepe' || x.awayId === 'goztepe')!;
    const oppId = f.homeId === 'goztepe' ? f.awayId : f.homeId;
    const opp = clubPlayers(w, oppId).sort((a, b) => a.currentAbility - b.currentAbility)[0]!;
    const before = knowledgeOf(w, opp);
    const rec: PlayerMatchRecord = { playerId: opp.id, clubId: oppId, started: true, minutes: 90, rating: 7, goals: 0, assists: 0 };
    for (let i = 0; i < 6; i++) applyResult(w, f, { ...makeResult(1, 1), players: [rec] }, new Rng(i));
    expect(knowledgeOf(w, opp)).toBe(Math.max(before, MATCH_KNOWLEDGE_CAP));

    const other = w.season.fixtures.find((x) => x.homeId !== 'goztepe' && x.awayId !== 'goztepe')!;
    const q = clubPlayers(w, other.homeId)[0]!;
    const k = knowledgeOf(w, q);
    applyResult(w, other, { ...makeResult(0, 0), players: [{ ...rec, playerId: q.id, clubId: other.homeId }] }, new Rng(9));
    expect(knowledgeOf(w, q)).toBe(k);
  });

  it('bizden ayrılan oyuncu tanınmaya devam eder', () => {
    const w = fresh();
    const p = clubPlayers(w, 'goztepe')[10]!;
    transferPlayer(w, p, 'kasimpasa', 500_000, { wage: 200_000, years: 2, signingBonus: 0 });
    expect(knowledgeOf(w, p)).toBe(FULL_KNOWLEDGE);
  });
});

describe('gözlemci görevleri', () => {
  it('oyuncu raporu: ücret bütçeden düşer, süre dolunca tam bilgi ve haber', () => {
    const w = fresh();
    const target = clubPlayers(w, 'besiktas')[3]!;
    const fin = w.finances.goztepe!;
    const budget = fin.transferBudget;
    expect(assignScout(w, { kind: 'player', playerId: target.id })).toBeNull();
    expect(fin.transferBudget).toBe(budget - SCOUT_TASKS.player.cost);
    expect(fin.current.expense.scouting).toBe(SCOUT_TASKS.player.cost);
    // Aynı görev ikinci kez verilemez
    expect(scoutBlocker(w, { kind: 'player', playerId: target.id })).not.toBeNull();
    passDays(w, SCOUT_TASKS.player.days - 1);
    expect(knowledgeOf(w, target)).toBeLessThan(FULL_KNOWLEDGE);
    passDays(w, 1);
    expect(knowledgeOf(w, target)).toBe(FULL_KNOWLEDGE);
    expect(w.scouting.assignments).toHaveLength(0);
    expect(w.scouting.reports.at(-1)!.playerIds).toEqual([target.id]);
    expect(w.news.at(-1)!.category).toBe('scouting');
    expect(scoutBlocker(w, { kind: 'player', playerId: target.id })).toMatch(/zaten/);
  });

  it(`aynı anda en fazla ${MAX_ASSIGNMENTS} görev; bütçe yetmezse görev verilmez`, () => {
    const w = fresh();
    const others = clubPlayers(w, 'fenerbahce');
    for (let i = 0; i < MAX_ASSIGNMENTS; i++) expect(assignScout(w, { kind: 'player', playerId: others[i]!.id })).toBeNull();
    expect(assignScout(w, { kind: 'player', playerId: others[5]!.id })).toMatch(/dolu/);
    const w2 = fresh();
    w2.finances.goztepe!.transferBudget = 1000;
    expect(assignScout(w2, { kind: 'club', clubId: 'fenerbahce' })).toMatch(/bütçe/);
  });

  it('kulüp taraması kadroyu tanıtır (tam değil); arama ölçütlere uyan adaylar getirir', () => {
    const w = fresh();
    expect(assignScout(w, { kind: 'club', clubId: 'konyaspor' })).toBeNull();
    expect(assignScout(w, { kind: 'search', position: 'DL', maxAge: 23, maxValue: 0 })).toBeNull();
    passDays(w, SCOUT_TASKS.club.days);
    for (const p of clubPlayers(w, 'konyaspor')) {
      expect(knowledgeOf(w, p)).toBeGreaterThanOrEqual(80);
    }
    const search = w.scouting.reports.find((r) => r.target.kind === 'search')!;
    expect(search.playerIds.length).toBe(5);
    for (const id of search.playerIds) {
      const p = w.players[id]!;
      expect(p.clubId).not.toBe('goztepe');
      expect(ageOn(p.birthDate, w.date)).toBeLessThanOrEqual(23);
      expect(p.positions.DL ?? 0).toBeGreaterThanOrEqual(13);
      expect(knowledgeOf(w, p)).toBe(FULL_KNOWLEDGE);
    }
  });
});

describe('kayıt dönüşümü', () => {
  it("9. sürüm kaydına gözlemci durumu ve finans dökümüne gözlemcilik gideri eklenir", () => {
    const w = fresh() as Partial<GameWorld> & GameWorld;
    delete (w as Partial<GameWorld>).scouting;
    for (const fin of Object.values(w.finances)) delete (fin.current.expense as Partial<typeof fin.current.expense>).scouting;
    const m = migrateWorld(w, 9, gameData);
    expect(m.scouting).toEqual({ knowledge: {}, assignments: [], reports: [], nextId: 1 });
    expect(m.finances.goztepe!.current.expense.scouting).toBe(0);
  });
});
