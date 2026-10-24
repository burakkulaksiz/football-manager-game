import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import { changeTactics, createMatch, slotHolders, stepMatch, type TeamSetup } from './engine';
import {
  autoSelectLineup,
  FORMATIONS,
  formationName,
  moveCustomSpot,
  positionAt,
  slotsOf,
  toCustom,
  type Lineup,
} from './formation';
import type { MatchState } from './state';
import {
  changeFormation,
  copyPlan,
  DEFAULT_INSTRUCTIONS,
  DEFAULT_ORDERS,
  defaultTactics,
  moveFormationSpot,
  resolveLineup,
  setSlotOrders,
  slotOrders,
  switchPlan,
  tacticPlan,
  type PlayerOrders,
  type TeamInstructions,
} from './tactics';

const world = createWorld(gameData, 77, 'besiktas', '2026-07-01');
const squad = clubPlayers(world, 'besiktas');

describe('özel diziliş', () => {
  it('konumdan mevki: forvet, ofansif orta saha, orta saha, ön libero / kanat bek, defans', () => {
    expect(positionAt(50, 15)).toBe('ST');
    expect(positionAt(85, 35)).toBe('AMR');
    expect(positionAt(50, 35)).toBe('AMC');
    expect(positionAt(15, 50)).toBe('ML');
    expect(positionAt(50, 62)).toBe('DM');
    expect(positionAt(90, 62)).toBe('WBR');
    expect(positionAt(50, 75)).toBe('DC');
    expect(positionAt(10, 75)).toBe('DL');
  });

  it('hazır dizilişin adı satırlardan çıkar; yer taşınınca mevki ve ad değişir', () => {
    expect(formationName({ formation: '4-1-4-1', custom: toCustom({ formation: '4-1-4-1' }) })).toBe('4-1-4-1');
    expect(formationName({ formation: '4-2-3-1', custom: toCustom({ formation: '4-2-3-1' }) })).toBe('4-2-3-1');
    const base = toCustom({ formation: '4-4-2' });
    // Sol forveti (10) ofansif orta sahaya çek: 4-4-1-1
    const moved = moveCustomSpot(base, 10, 50, 33);
    expect(moved.slots[10]).toBe('AMC');
    expect(formationName({ formation: '4-4-2', custom: moved })).toBe('4-4-1-1');
    // Kaleci taşınmaz, sınır dışı konum sınıra çekilir
    expect(moveCustomSpot(base, 0, 50, 50)).toBe(base);
    expect(moveCustomSpot(base, 5, 120, -5).layout[5]).toEqual([94, 10]);
  });

  it('taktikte özel diziliş: oyuncu yerinde kalır, maç kadrosu özel mevkilerle kurulur', () => {
    const t = defaultTactics(squad, '4-4-2');
    const next = moveFormationSpot(t, 9, 50, 33);
    expect(next.custom?.slots[9]).toBe('AMC');
    expect(next.lineup).toEqual(t.lineup);
    const lineup = resolveLineup(next, squad);
    expect(lineup.starters.find((s) => s.playerId === t.lineup[9])?.slot).toBe('AMC');
    // Hazır dizilişe dönünce özel diziliş bırakılır
    expect(changeFormation(next, '4-3-3', squad).custom).toBeNull();
  });
});

describe('bireysel talimat ve taktik setleri', () => {
  it('mevkinin talimatı maç kadrosuna taşınır; varsayılana dönen talimat silinir', () => {
    const t = setSlotOrders(defaultTactics(squad), 10, { duty: 'attack', longShots: true });
    expect(slotOrders(t, 10)).toEqual({ ...DEFAULT_ORDERS, duty: 'attack', longShots: true });
    const starter = resolveLineup(t, squad).starters.find((s) => s.playerId === t.lineup[10])!;
    expect(starter.orders?.duty).toBe('attack');
    const back = setSlotOrders(t, 10, { duty: 'support', longShots: false });
    expect(back.orders).toEqual([]);
  });

  it('diziliş değişince talimat aynı mevkiye geçer', () => {
    // 4-2-3-1'de forvet (10) → 4-4-2'de ilk forvet (9)
    const t = setSlotOrders(defaultTactics(squad, '4-2-3-1'), 10, { duty: 'defend' });
    const next = changeFormation(t, '4-4-2', squad);
    expect(slotOrders(next, 9).duty).toBe('defend');
    expect(slotOrders(next, 10).duty).toBe('support');
  });

  it('setler arasında geçiş: her set kendi dizilişini ve talimatlarını hatırlar, ilk 11 ortak', () => {
    const a = { ...defaultTactics(squad, '4-2-3-1'), instructions: { ...DEFAULT_INSTRUCTIONS, mentality: 1 as const } };
    const b = switchPlan(a, 1, squad);
    expect(b.activePlan).toBe(1);
    // Boş set etkin setin kopyasıyla başlar
    expect(b.formation).toBe('4-2-3-1');
    const bEdited = { ...changeFormation(b, '5-3-2', squad), instructions: { ...b.instructions, mentality: -2 as const, timeWasting: true } };
    const backToA = switchPlan(bEdited, 0, squad);
    expect(backToA.formation).toBe('4-2-3-1');
    expect(backToA.instructions.mentality).toBe(1);
    expect([...backToA.lineup].sort()).toEqual([...a.lineup].sort());
    expect(tacticPlan(backToA, 1).formation).toBe('5-3-2');
    expect(tacticPlan(backToA, 1).instructions.timeWasting).toBe(true);
    // Kopyala: A → C
    const copied = copyPlan(backToA, 0, 2);
    expect(tacticPlan(copied, 2).instructions.mentality).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* Motora etkisi (istatistiksel)                                        */
/* ------------------------------------------------------------------ */

function team(clubId: string, lineup: Lineup, instructions: Partial<TeamInstructions> = {}, extra: Partial<TeamSetup> = {}): TeamSetup {
  return {
    clubId, name: getClub(world, clubId).name, lineup, instructions: { ...DEFAULT_INSTRUCTIONS, ...instructions }, userControlled: true, ...extra,
  };
}

const homeLineup = autoSelectLineup(squad);
const awayLineup = autoSelectLineup(clubPlayers(world, 'trabzonspor'));

function run(home: TeamSetup, n = 300, away: TeamSetup = team('trabzonspor', awayLineup)): MatchState[] {
  return Array.from({ length: n }, (_, i) => {
    const state = createMatch({ fixtureId: 1, home, away, seed: 1 + i }, world.players);
    while (state.period !== 'full') stepMatch(state, world.players);
    return state;
  });
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const withOrders = (lineup: Lineup, playerId: number, orders: Partial<PlayerOrders>): Lineup => ({
  ...lineup,
  starters: lineup.starters.map((s) => (s.playerId === playerId ? { ...s, orders: { ...DEFAULT_ORDERS, ...orders } } : s)),
});

describe('yeni talimatların etkisi', () => {
  it('eski kayıttaki gibi eksik talimat alanları varsayılanla aynı maçı üretir', () => {
    const { mentality, passing, tempo, pressing, defensiveLine, width } = DEFAULT_INSTRUCTIONS;
    const old = { mentality, passing, tempo, pressing, defensiveLine, width } as TeamInstructions;
    const a = run(team('besiktas', homeLineup), 20);
    const b = run({ ...team('besiktas', homeLineup), instructions: old }, 20);
    expect(b.map((s) => s.score)).toEqual(a.map((s) => s.score));
  });

  it('zaman geçirme maçı yavaşlatır: iki taraf da daha az şut çeker', { timeout: 90_000 }, () => {
    const shots = (states: MatchState[]) => mean(states.map((s) => s.home.counters.shots + s.away.counters.shots));
    expect(shots(run(team('besiktas', homeLineup, { timeWasting: true })))).toBeLessThan(shots(run(team('besiktas', homeLineup))) * 0.95);
  });

  it('sert müdahale daha çok faul, ofsayt taktiği rakibe daha az şut', { timeout: 90_000 }, () => {
    const normal = run(team('besiktas', homeLineup));
    const hard = run(team('besiktas', homeLineup, { tackling: 'hard' }));
    const trap = run(team('besiktas', homeLineup, { offsideTrap: true }));
    expect(mean(hard.map((s) => s.home.counters.fouls))).toBeGreaterThan(mean(normal.map((s) => s.home.counters.fouls)) * 1.1);
    expect(mean(trap.map((s) => s.away.counters.shots))).toBeLessThan(mean(normal.map((s) => s.away.counters.shots)));
  });

  it('hücum görevli oyuncu daha çok, savunma görevli daha az şut çeker', { timeout: 90_000 }, () => {
    const striker = homeLineup.starters.find((s) => s.slot === 'ST')!.playerId;
    const shots = (states: MatchState[]) => mean(states.map((s) => s.players[striker]!.shots));
    const attack = run(team('besiktas', withOrders(homeLineup, striker, { duty: 'attack', longShots: true })));
    const defend = run(team('besiktas', withOrders(homeLineup, striker, { duty: 'defend' })));
    expect(shots(attack)).toBeGreaterThan(shots(defend) * 1.5);
  });

  it('kornerci asistlerin çoğunu yapar, hedef adam kornerlerde kafayı vurur', { timeout: 90_000 }, () => {
    const outfield = homeLineup.starters.filter((s) => s.slot !== 'GK');
    const taker = outfield.find((s) => s.slot === 'MC' || s.slot === 'AMR')!.playerId;
    const target = outfield.find((s) => s.slot === 'DR')!.playerId;
    const states = run(team('besiktas', homeLineup, { cornerStyle: 'far' }, { cornerTakerId: taker, targetManId: target }), 400);
    const cornerGoals = states.flatMap((s) => s.shots.filter((x) => x.side === 'home' && x.corner && x.outcome === 'goal').map((x) => ({ s, x })));
    expect(cornerGoals.length).toBeGreaterThan(5);
    const assists = states.flatMap((s) => s.goals.filter((g) => g.clubId === 'besiktas' && g.kind === 'header'));
    expect(assists.filter((g) => g.assistId === taker).length).toBeGreaterThan(cornerGoals.length * 0.5);
    const cornerShots = states.flatMap((s) => s.shots.filter((x) => x.side === 'home' && x.corner));
    expect(cornerShots.filter((x) => x.playerId === target).length / cornerShots.length).toBeGreaterThan(0.2);
  });
});

describe('maç içi taktik', () => {
  it('özel dizilişle kurulan maçta mevkiler özel dizilişten; talimatlar değişiklikte yedeğe geçer', () => {
    const custom = moveCustomSpot(toCustom({ formation: '4-4-2' }), 10, 50, 33);
    const lineup = withOrders(autoSelectLineup(squad, custom.slots), autoSelectLineup(squad, custom.slots).starters[10]!.playerId, { duty: 'attack' });
    const state = createMatch({
      fixtureId: 1, seed: 3, home: team('besiktas', lineup, {}, { formation: '4-4-2', custom }), away: team('trabzonspor', awayLineup),
    }, world.players);
    expect(state.home.onPitch.map((id) => state.players[id]!.slot).sort()).toEqual([...custom.slots].sort());
    const holders = slotHolders(state.home, state.players);
    expect(state.players[holders[10]!]!.orders?.duty).toBe('attack');
    for (let i = 0; i < 10; i++) stepMatch(state, world.players);

    // Set değişikliği: hazır 4-3-3'e geç, forvete savunma görevi
    const orders = slotsOf({ formation: '4-3-3' }).map((p) => (p === 'ST' ? { ...DEFAULT_ORDERS, duty: 'defend' as const } : null));
    changeTactics(state, world.players, 'home', { formation: '4-3-3', custom: null, orders, plan: 1, instructions: { counterAttack: true } });
    expect(state.home.custom).toBeUndefined();
    expect(state.home.plan).toBe(1);
    expect(state.home.instructions.counterAttack).toBe(true);
    expect(state.home.onPitch.map((id) => state.players[id]!.slot).sort()).toEqual([...FORMATIONS['4-3-3']].sort());
    const st = state.home.onPitch.find((id) => state.players[id]!.slot === 'ST')!;
    expect(state.players[st]!.orders?.duty).toBe('defend');
    expect(state.home.onPitch.filter((id) => state.players[id]!.orders).length).toBe(1);
  });
});
