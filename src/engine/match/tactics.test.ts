import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import type { Player, Position } from '../types';
import { buildResult, changeTactics, createMatch, simulateToEnd, stepMatch, type TeamSetup } from './engine';
import {
  autoSelectLineup,
  chooseFormation,
  FORMATION_IDS,
  FORMATION_LAYOUT,
  FORMATIONS,
  type Lineup,
} from './formation';
import type { MatchState } from './state';
import {
  changeFormation,
  DEFAULT_INSTRUCTIONS,
  defaultTactics,
  placePlayer,
  removePlayer,
  resolveLineup,
  type TeamInstructions,
} from './tactics';

const world = createWorld(gameData, 77, 'besiktas', '2026-07-01');
const squad = clubPlayers(world, 'besiktas');

describe('dizilişler', () => {
  it('her diziliş 11 mevki, ilki kaleci, saha yerleşimi tanımlı', () => {
    for (const id of FORMATION_IDS) {
      expect(FORMATIONS[id]).toHaveLength(11);
      expect(FORMATIONS[id][0]).toBe('GK');
      expect(FORMATIONS[id].filter((p) => p === 'GK')).toHaveLength(1);
      expect(FORMATION_LAYOUT[id]).toHaveLength(11);
    }
  });

  it('her dizilişte otomatik 11 kurulur; yapay zekâ geçerli bir diziliş seçer', () => {
    for (const id of FORMATION_IDS) expect(autoSelectLineup(squad, FORMATIONS[id]).starters).toHaveLength(11);
    expect(FORMATION_IDS).toContain(chooseFormation(squad));
  });
});

describe('kadro düzenleme', () => {
  const t = defaultTactics(squad);

  it('varsayılan taktik: 11 oyuncu, kaptan ve vurucular ilk 11 içinde', () => {
    expect(t.lineup.filter((id) => id !== null)).toHaveLength(11);
    for (const id of [t.captainId, t.penaltyTakerId, t.freeKickTakerId]) expect(t.lineup).toContain(id);
  });

  it('ilk 11 içinde iki oyuncunun yerini değiştirir', () => {
    const a = t.lineup[1]!;
    const b = t.lineup[9]!;
    const next = placePlayer(t, { kind: 'slot', index: 9 }, a);
    expect(next.lineup[9]).toBe(a);
    expect(next.lineup[1]).toBe(b);
  });

  it('yedekten ilk 11e alınan oyuncunun yerindeki yedeğe geçer', () => {
    const sub = t.bench[0]!;
    const starter = t.lineup[3]!;
    const next = placePlayer(t, { kind: 'slot', index: 3 }, sub);
    expect(next.lineup[3]).toBe(sub);
    expect(next.bench[0]).toBe(starter);
  });

  it('kadro dışından gelen oyuncu, yerindekini kadro dışına çıkarır', () => {
    const outsider = squad.find((p) => !t.lineup.includes(p.id) && !t.bench.includes(p.id))!;
    const starter = t.lineup[5]!;
    const next = placePlayer(t, { kind: 'slot', index: 5 }, outsider.id);
    expect(next.lineup[5]).toBe(outsider.id);
    expect(next.lineup).not.toContain(starter);
    expect(next.bench).not.toContain(starter);
  });

  it('oyuncu çıkarılınca mevkisi boşalır; diziliş değişince ilk 11 korunur', () => {
    const removed = removePlayer(t, t.lineup[2]!);
    expect(removed.lineup[2]).toBeNull();
    const changed = changeFormation(t, '3-5-2', squad);
    expect([...changed.lineup].sort()).toEqual([...t.lineup].sort());
  });

  it('maç kadrosu: sakat ya da kulüpten ayrılmış oyuncu yerine otomatik biri girer', () => {
    const injured = t.lineup[4]!;
    const gone = t.lineup[6]!;
    const modified = squad
      .filter((p) => p.id !== gone)
      .map((p) => (p.id === injured ? { ...p, injury: { name: 'Sakatlık', daysOut: 10 } } : p));
    const lineup = resolveLineup(t, modified);
    expect(lineup.starters).toHaveLength(11);
    const ids = lineup.starters.map((s) => s.playerId);
    expect(ids).not.toContain(injured);
    expect(ids).not.toContain(gone);
  });

  it('boşalan yere önce o mevkiyi bilen yedek; yedekte yoksa o mevkinin oyuncusu, bilmediği mevkideki iyi oyuncu değil', () => {
    const i = 9;
    const slot = FORMATIONS[t.formation][i]!;
    expect(['GK', 'DC']).not.toContain(slot);
    const out = t.lineup[i]!;
    const keeper = (id: number) => squad.find((p) => p.id === id)!.positions.GK !== undefined;
    const benchMan = t.bench.find((id) => !keeper(id))!;
    const [star, natural] = squad.filter((p) => !t.lineup.includes(p.id) && !t.bench.includes(p.id) && !keeper(p.id));
    const only = (pos: Position, v = 20) => ({ [pos]: v }) as Player['positions'];
    const scenario = (benchKnows: boolean) =>
      squad.map((p): Player => {
        if (p.id === out) return { ...p, suspension: 1 };
        if (p.id === benchMan) return { ...p, currentAbility: 100, condition: 100, positions: benchKnows ? only(slot, 15) : only('DC') };
        if (p.id === star!.id) return { ...p, currentAbility: 180, condition: 100, positions: benchKnows ? only(slot) : only('DC') };
        if (p.id === natural!.id) return { ...p, currentAbility: 110, condition: 100, positions: only(slot) };
        // geri kalan saha oyuncuları yalnızca stoper: aday olarak karışmasınlar
        return t.lineup.includes(p.id) || keeper(p.id) ? p : { ...p, positions: only('DC') };
      });
    const at = (players: Player[]) => resolveLineup(t, players).starters.find((s) => s.slot === slot && !t.lineup.includes(s.playerId))?.playerId;

    // Kadro dışında daha iyisi (180) olsa da mevkiyi bilen yedek girer; kulübe kalanlardan tamamlanır (tek yedek kaleci)
    expect(at(scenario(true))).toBe(benchMan);
    const { bench } = resolveLineup(t, scenario(true));
    expect(bench).toHaveLength(t.bench.length);
    expect(bench).not.toContain(benchMan);
    expect(bench.filter(keeper)).toHaveLength(t.bench.filter(keeper).length);
    // Yedeklerde mevkiyi bilen yok: CA 180'lik stoper değil, mevkinin doğal oyuncusu (110)
    expect(at(scenario(false))).toBe(natural!.id);
  });
});

/* ------------------------------------------------------------------ */
/* Taktiklerin motora etkisi (istatistiksel)                            */
/* ------------------------------------------------------------------ */

function team(clubId: string, lineup: Lineup, instructions: TeamInstructions = DEFAULT_INSTRUCTIONS, extra: Partial<TeamSetup> = {}): TeamSetup {
  return { clubId, name: getClub(world, clubId).name, lineup, instructions, userControlled: true, ...extra };
}

const homeLineup = autoSelectLineup(squad);
const awayLineup = autoSelectLineup(clubPlayers(world, 'trabzonspor'));

/** Ev sahibi için verilen kurulumla N maç oynatır; maç durumlarını döndürür. */
function run(home: TeamSetup, n = 400, seedBase = 1): MatchState[] {
  return Array.from({ length: n }, (_, i) => {
    const state = createMatch({ fixtureId: 1, home, away: team('trabzonspor', awayLineup), seed: seedBase + i }, world.players);
    // userControlled kalsın diye simulateToEnd yerine adım adım
    while (state.period !== 'full') stepMatch(state, world.players);
    return state;
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('taktiklerin etkisi', () => {
  it('hücum mentalitesi daha çok şut ve daha açık maç üretir', () => {
    const attacking = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, mentality: 2 }));
    const defensive = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, mentality: -2 }));
    expect(mean(attacking.map((s) => s.home.counters.shots))).toBeGreaterThan(mean(defensive.map((s) => s.home.counters.shots)) * 1.2);
    expect(mean(attacking.map((s) => s.away.counters.shots))).toBeGreaterThan(mean(defensive.map((s) => s.away.counters.shots)));
  });

  it('yoğun pres daha çok faul ve yorgunluk getirir', () => {
    const condition = (s: MatchState) =>
      mean(s.home.onPitch.map((id) => s.players[id]!.condition));
    const high = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, pressing: 'high' }), 200);
    const low = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, pressing: 'low' }), 200);
    expect(mean(high.map((s) => s.home.counters.fouls))).toBeGreaterThan(mean(low.map((s) => s.home.counters.fouls)));
    expect(mean(high.map(condition))).toBeLessThan(mean(low.map(condition)));
  });

  it('geniş oyun daha çok korner, dar oyun daha çok top hakimiyeti getirir', () => {
    const poss = (s: MatchState) => s.possessionTicks.home / (s.possessionTicks.home + s.possessionTicks.away);
    const wide = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, width: 'wide' }), 200);
    const narrow = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, width: 'narrow' }), 200);
    expect(mean(wide.map((s) => s.home.counters.corners))).toBeGreaterThan(mean(narrow.map((s) => s.home.counters.corners)));
    expect(mean(narrow.map(poss))).toBeGreaterThan(mean(wide.map(poss)));
  });

  it('kısa pas iyi pas yapan takıma top hakimiyeti kazandırır', () => {
    const poss = (s: MatchState) => s.possessionTicks.home / (s.possessionTicks.home + s.possessionTicks.away);
    const short = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, passing: 'short' }), 200);
    const direct = run(team('besiktas', homeLineup, { ...DEFAULT_INSTRUCTIONS, passing: 'direct' }), 200);
    expect(mean(short.map(poss))).toBeGreaterThan(mean(direct.map(poss)));
  });

  it('yanlış mevkide oynayan takım belirgin şekilde zayıflar', () => {
    // Defans ve hücum oyuncularının yerlerini karıştır
    const shuffled: Lineup = {
      bench: homeLineup.bench,
      starters: homeLineup.starters.map((s, i, all) => {
        const mirror = all[all.length - i] ?? s; // kaleci yerinde kalır
        return { playerId: i === 0 ? s.playerId : mirror.playerId, slot: s.slot as Position };
      }),
    };
    const gd = (states: MatchState[]) => mean(states.map((s) => s.score.home - s.score.away));
    const normal = run(team('besiktas', homeLineup));
    const wrong = run(team('besiktas', shuffled));
    expect(gd(wrong)).toBeLessThan(gd(normal) - 0.4);
  });

  it('penaltıları seçilen oyuncu kullanır', () => {
    const outfield = homeLineup.starters.filter((s) => s.slot !== 'GK');
    const chosen = outfield[outfield.length - 1]!.playerId;
    const states = run(team('besiktas', homeLineup, DEFAULT_INSTRUCTIONS, { penaltyTakerId: chosen }), 600);
    const penalties = states.flatMap((s) =>
      s.home.onPitch.includes(chosen) ? s.goals.filter((g) => g.kind === 'penalty' && g.clubId === 'besiktas') : [],
    );
    expect(penalties.length).toBeGreaterThan(0);
    expect(penalties.every((g) => g.playerId === chosen)).toBe(true);
  });

  it('maç içinde diziliş değişince oyuncular yeni mevkilere dağılır, kaleci kalede kalır', () => {
    const state = createMatch({ fixtureId: 1, home: team('besiktas', homeLineup), away: team('trabzonspor', awayLineup), seed: 5 }, world.players);
    for (let i = 0; i < 20; i++) stepMatch(state, world.players);
    const keeper = state.home.onPitch.find((id) => state.players[id]!.slot === 'GK');
    changeTactics(state, world.players, 'home', { formation: '3-5-2', instructions: { tempo: 'fast' } });
    expect(state.home.formation).toBe('3-5-2');
    expect(state.home.instructions.tempo).toBe('fast');
    expect(state.players[keeper!]!.slot).toBe('GK');
    const slots = state.home.onPitch.map((id) => state.players[id]!.slot).sort();
    expect(slots).toEqual([...FORMATIONS['3-5-2']].sort());
    simulateToEnd(state, world.players);
    expect(buildResult(state).players.length).toBeGreaterThanOrEqual(22);
  });
});
