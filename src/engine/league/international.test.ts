import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { HOME_NATION } from '../data';
import { addDays, weekday } from '../date';
import { advance } from '../gameFlow';
import { createWorld } from '../generation/worldGenerator';
import { migrateWorld } from '../migrate';
import { primaryPosition } from '../player';
import { Rng } from '../rng';
import { groupOf } from '../transfer/market';
import type { GameWorld } from '../types';
import { CUP_ROUNDS, cupRoundDate } from './cup';
import { EUROPE_COMPETITIONS, EUROPE_FINAL, stageDate } from './europe';
import {
  breakSaturdays,
  createInternational,
  internationalDay,
  isVirtualPlayer,
  nationalPlayer,
  nationalWinner,
  qualifierFixtures,
  nationalTeams,
  qualifierRanking,
  qualifierTable,
  UEFA_SPOTS,
  selectSquad,
  SQUAD_SIZE,
  TOURNAMENT_FINAL,
  TOURNAMENT_QUARTER,
  TOURNAMENT_SEMI,
  tournamentDrawDate,
  tournamentFixtures,
  windowMatchDays,
} from './international';
import { isBreakWeekend, seasonMatchDates } from './schedule';

const START = '2026-07-01';

describe('Milli ara takvimi', () => {
  it('milli ara cumartesileri ligin boş hafta sonları; maç günleri (cuma, salı) kulüp maçlarıyla çakışmaz', () => {
    for (let year = 2026; year <= 2034; year++) {
      const clubDates = new Set([
        ...seasonMatchDates(year, 34),
        ...CUP_ROUNDS.map((_, i) => cupRoundDate(year, i + 1)),
        ...EUROPE_COMPETITIONS.flatMap((c) => Array.from({ length: EUROPE_FINAL }, (_, i) => stageDate(year, c, i + 1))),
      ]);
      for (const saturday of breakSaturdays(year)) {
        expect(weekday(saturday)).toBe(6);
        expect(isBreakWeekend(saturday)).toBe(true);
        const [friday, tuesday] = windowMatchDays(saturday);
        expect(weekday(friday)).toBe(5);
        expect(weekday(tuesday)).toBe(2);
        // Kadronun kampta olduğu günler (cuma–salı) kulüp maçı yok
        for (let d = friday; d <= tuesday; d = addDays(d, 1)) expect(clubDates.has(d)).toBe(false);
      }
    }
  });
});

describe('Eleme döngüsü', () => {
  const world = createWorld(gameData, 7, 'galatasaray', START);
  const state = world.international;

  it('ilk döngü Avrupa Şampiyonası 2028: en çok 5\'li gruplar, çift devre, kuradan önceki son 10 milli günde', () => {
    expect(state.year).toBe(2028);
    expect(state.kind).toBe('euro');
    const uefa = nationalTeams(gameData).filter((n) => n.confederation === 'UEFA');
    expect(state.qualifierGroups).toHaveLength(Math.ceil(uefa.length / 5));
    expect(state.qualifierGroups.flat().sort()).toEqual(uefa.map((n) => n.code).sort());
    expect(state.qualifierGroups.every((g) => g.length >= 4 && g.length <= 5)).toBe(true);
    expect(state.qualifierGroups.flat()).toContain(HOME_NATION);
    const qualifiers = qualifierFixtures(state);
    const days = [...new Set(qualifiers.map((f) => f.date))].sort();
    expect(days).toHaveLength(10);
    expect(days.at(-1)! < tournamentDrawDate(2028)).toBe(true);
    for (const group of state.qualifierGroups) {
      for (const a of group) {
        expect(qualifiers.filter((f) => f.homeId === a || f.awayId === a)).toHaveLength(2 * (group.length - 1));
        for (const b of group) {
          if (a !== b) expect(qualifiers.filter((f) => f.homeId === a && f.awayId === b)).toHaveLength(1);
        }
      }
    }
  });

  it('her milli günde bir ülke en çok bir maç yapar; Türkiye her milli günde oynar', () => {
    const days = [...new Set(state.fixtures.map((f) => f.date))];
    for (const day of days) {
      const playing = state.fixtures.filter((f) => f.date === day).flatMap((f) => [f.homeId, f.awayId]);
      expect(new Set(playing).size).toBe(playing.length);
      expect(playing).toContain(HOME_NATION);
    }
  });

  it('kadro 23 kişi, 3 kaleci, sakat yok; sanal oyuncular tekrar aynı üretilir', () => {
    for (const nation of nationalTeams(gameData)) {
      const ids = selectSquad(world, gameData, nation.code);
      expect(new Set(ids).size).toBe(SQUAD_SIZE);
      const players = ids.map((id) => nationalPlayer(world, gameData, id)!);
      expect(players.every((p) => p.nationality === nation.code && !p.injury)).toBe(true);
      expect(players.filter((p) => groupOf(primaryPosition(p)) === 'GK')).toHaveLength(3);
    }
    const virtual = selectSquad(world, gameData, 'SUI').find(isVirtualPlayer)!;
    expect(nationalPlayer(world, gameData, virtual)!.clubId).toBeNull();
    expect(world.players[virtual]).toBeUndefined();
    // Türkiye kadrosunun çoğu dünyadaki oyunculardan
    expect(selectSquad(world, gameData, HOME_NATION).filter((id) => !isVirtualPlayer(id)).length).toBeGreaterThanOrEqual(12);
  });
});

describe('Milli ara (Eylül 2026)', () => {
  const world = createWorld(gameData, 3, 'galatasaray', START);
  const [friday, tuesday] = windowMatchDays(breakSaturdays(2026)[0]!);
  let guard = 0;
  while (world.date < addDays(tuesday, 1) && guard++ < 500) advance(world, gameData, { autoPlayUserMatch: true });

  it('kadrolar açıklanır, oyuncular kampa katılır, maçlardan sonra kulübüne döner', () => {
    const state = world.international;
    expect(state.fixtures.filter((f) => f.date === friday || f.date === tuesday).every((f) => f.result)).toBe(true);
    expect(state.onDuty).toHaveLength(0);
    expect(state.campAnnounced).toBeNull();
    const ours = Object.values(world.players).filter((p) => p.clubId === world.playerClubId && p.intl);
    expect(ours.length).toBeGreaterThan(0);
    expect(world.news.some((n) => n.category === 'international' && n.important && n.title.includes('milli takıma çağrıldı'))).toBe(true);
    expect(world.news.some((n) => n.title === 'Milli takımdan dönen oyuncularımız')).toBe(true);
  });

  it('milli maç sayısı ve golleri oyuncuya yazılır; sonuçta yalnızca kulübümüzün oyuncuları saklanır', () => {
    const played = world.international.fixtures.filter((f) => f.result);
    const goals = played.flatMap((f) => f.result!.goals.filter((g) => g.playerId !== undefined));
    const byPlayer = new Map<number, number>();
    for (const g of goals) byPlayer.set(g.playerId!, (byPlayer.get(g.playerId!) ?? 0) + 1);
    for (const [id, count] of byPlayer) expect(world.players[id]!.intl!.goals).toBe(count);
    for (const f of played) {
      for (const a of f.result!.players) expect(world.players[a.playerId]!.clubId).toBe(world.playerClubId);
    }
  });
});

describe('Kamp', () => {
  it('oyuncular ilk maç günü kampa katılır, ülkesinin maçı kalmayınca döner', () => {
    const world = createWorld(gameData, 4, 'galatasaray', START);
    const [friday, tuesday] = windowMatchDays(breakSaturdays(2026)[0]!);
    const rng = new Rng(5);
    const duty: Record<string, number> = {};
    for (world.date = addDays(friday, -6); world.date <= addDays(tuesday, 1); world.date = addDays(world.date, 1)) {
      internationalDay(world, rng, gameData);
      duty[world.date] = world.international.onDuty.length;
    }
    expect(duty[addDays(friday, -5)]).toBe(0); // kadro açıklandı, henüz kamp yok
    expect(world.international.squads[HOME_NATION]?.date).toBe(addDays(friday, -4));
    expect(duty[friday]).toBeGreaterThan(100);
    expect(duty[addDays(friday, 2)]).toBeGreaterThan(100);
    expect(duty[tuesday]).toBe(0);
  });
});

/** Elemeleri basit skorlarla bitirir (turnuva testleri hızlı olsun). */
function finishQualifiersQuickly(world: GameWorld): void {
  for (const f of world.international.fixtures) {
    if (f.date >= tournamentDrawDate(world.international.year)) continue;
    // Torbada önce gelen (güçlü) ülke kazansın: kura sırası
    const order = world.international.qualifierGroups.flat();
    const homeWins = order.indexOf(f.homeId) <= order.indexOf(f.awayId);
    f.result = { homeGoals: homeWins ? 2 : 0, awayGoals: homeWins ? 0 : 1, goals: [], players: [] };
  }
}

function playTournament(world: GameWorld, year: number): void {
  const rng = new Rng(99);
  world.date = tournamentDrawDate(year);
  internationalDay(world, rng, gameData);
  for (world.date = `${year}-06-01`; world.date <= `${year}-06-30`; world.date = addDays(world.date, 1)) {
    internationalDay(world, rng, gameData);
  }
}

describe('Turnuvalar', () => {
  it('Avrupa Şampiyonası: grupların ilk ikisi, 2 grup, yarı final ve final; geçmişe yazılır', () => {
    const world = createWorld(gameData, 21, 'fenerbahce', START);
    finishQualifiersQuickly(world);
    playTournament(world, 2028);
    const state = world.international;
    // Grup birincilerinin hepsi, sonra en iyi ikinciler
    const winners = state.qualifierGroups.map((_, g) => qualifierTable(state, g)[0]!.clubId);
    const qualified = state.qualified!;
    expect(qualified).toHaveLength(UEFA_SPOTS);
    for (const w of winners.slice(0, UEFA_SPOTS)) expect(qualified).toContain(w);
    expect(qualified).toEqual(qualifierRanking(state).slice(0, UEFA_SPOTS));
    expect(state.tournamentGroups).toHaveLength(2);
    expect(state.tournamentGroups.flat().sort()).toEqual([...qualified].sort());
    expect(tournamentFixtures(state, TOURNAMENT_QUARTER)).toHaveLength(0);
    expect(tournamentFixtures(state, TOURNAMENT_SEMI)).toHaveLength(2);
    const final = tournamentFixtures(state, TOURNAMENT_FINAL)[0]!;
    expect(nationalWinner(final)).not.toBeNull();
    expect(state.history).toEqual([expect.objectContaining({ year: 2028, kind: 'euro', winner: nationalWinner(final) })]);
    expect(state.onDuty).toHaveLength(0);
    // 1 Temmuz: yeni döngü (Dünya Kupası 2030), geçmiş taşınır
    world.date = '2028-07-01';
    internationalDay(world, new Rng(1), gameData);
    expect(world.international.year).toBe(2030);
    expect(world.international.kind).toBe('wc');
    expect(world.international.history).toHaveLength(1);
  });

  it('Dünya Kupası: 16 takım (8 UEFA + 8 diğer), 4 grup, çeyrek final, yarı final, final', () => {
    const world = createWorld(gameData, 22, 'besiktas', START);
    createInternational(world, gameData, '2028-07-01');
    expect(world.international.kind).toBe('wc');
    finishQualifiersQuickly(world);
    playTournament(world, 2030);
    const state = world.international;
    const teams = state.tournamentGroups.flat();
    expect(state.tournamentGroups).toHaveLength(4);
    expect(new Set(teams).size).toBe(16);
    const uefa = new Set(gameData.nations.filter((n) => n.confederation === 'UEFA').map((n) => n.code));
    expect(teams.filter((c) => uefa.has(c))).toHaveLength(8);
    expect(tournamentFixtures(state, TOURNAMENT_QUARTER)).toHaveLength(4);
    expect(tournamentFixtures(state, TOURNAMENT_SEMI)).toHaveLength(2);
    expect(tournamentFixtures(state, TOURNAMENT_FINAL)).toHaveLength(1);
    expect(tournamentFixtures(state).every((f) => f.result && (f.round <= 3 || nationalWinner(f)))).toBe(true);
    expect(state.history[0]?.kind).toBe('wc');
  });
});

describe('Kayıt dönüşümü (biçim 13 → 14)', () => {
  it('eski kayıtta milli takım döngüsü bugünden kurulur', () => {
    const world = createWorld(gameData, 5, 'trabzonspor', START);
    world.date = '2027-04-10';
    const raw = structuredClone(world) as Partial<GameWorld>;
    delete raw.international;
    const migrated = migrateWorld(raw, 13, gameData);
    // Kurasına kadar 10 milli gün kalmayan 2028 atlanır
    expect(migrated.international.year).toBe(2030);
    expect(migrated.international.fixtures.every((f) => f.date > '2027-04-10')).toBe(true);
  });
});
