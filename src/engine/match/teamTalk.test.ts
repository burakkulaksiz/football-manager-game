import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import { createMatch, stepMatch, type MatchSetup } from './engine';
import { autoSelectLineup } from './formation';
import { giveTeamTalk, talkEffect } from './teamTalk';

const world = createWorld(gameData, 42, 'galatasaray', '2026-07-01');

function setup(): MatchSetup {
  const team = (id: string, user: boolean) => ({
    clubId: id,
    name: getClub(world, id).name,
    lineup: autoSelectLineup(clubPlayers(world, id)),
    userControlled: user,
  });
  return { fixtureId: 1, home: team('galatasaray', true), away: team('fenerbahce', false), seed: 3 };
}

describe('devre arası konuşması', () => {
  it('etki skora ve profesyonelliğe göre: doğru konuşma artı, yanlışı eksi', () => {
    expect(talkEffect('praise', 1, 10)).toBeGreaterThan(0);
    expect(talkEffect('praise', -1, 10)).toBeLessThan(0);
    expect(talkEffect('demand', -1, 10)).toBeGreaterThan(0);
    expect(talkEffect('angry', -1, 18)).toBeGreaterThan(0);
    expect(talkEffect('angry', -1, 5)).toBeLessThan(0);
    expect(talkEffect('angry', 2, 10)).toBeLessThan(0);
  });

  it('yalnızca devre arasında ve bir kez; günlük form ve moral değişir, rastgelelik kullanmaz', () => {
    const players = structuredClone(world.players);
    const state = createMatch(setup(), players);
    expect(giveTeamTalk(state, players, 'home', 'demand')).toBe(false); // maç başlamadı
    while (state.period !== 'half') stepMatch(state, players);

    const id = state.home.onPitch[0]!;
    const diff = state.score.home - state.score.away;
    const e = talkEffect('demand', diff, players[id]!.hidden.professionalism);
    const form = state.players[id]!.dayForm;
    const morale = players[id]!.morale;
    const rng = state.rngState;
    const events = state.events.length;

    expect(giveTeamTalk(state, players, 'home', 'demand')).toBe(true);
    expect(state.players[id]!.dayForm).toBeCloseTo(Math.max(-0.15, Math.min(0.15, form + e)));
    expect(players[id]!.morale).toBe(Math.max(0, Math.min(100, morale + Math.round(e * 200))));
    expect(state.rngState).toBe(rng);
    expect(state.events).toHaveLength(events + 1);
    expect(state.home.talk).toBe('demand');
    expect(giveTeamTalk(state, players, 'home', 'praise')).toBe(false); // ikinci kez olmaz
  });
});
