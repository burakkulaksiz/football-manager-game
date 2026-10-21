import { describe, expect, it } from 'vitest';
import { gameData } from '../../gameData';
import { clubPlayers, createWorld, getClub } from '../generation/worldGenerator';
import { buildResult, createMatch, simulateToEnd, stepMatch, type MatchSetup } from './engine';
import { autoSelectLineup } from './formation';
import { decodeTimeline, playCode } from './state';

const world = createWorld(gameData, 43, 'galatasaray', '2026-07-01');

function setup(homeId: string, awayId: string, seed: number): MatchSetup {
  const team = (id: string) => ({ clubId: id, name: getClub(world, id).name, lineup: autoSelectLineup(clubPlayers(world, id)), userControlled: false });
  return { fixtureId: 1, home: team(homeId), away: team(awayId), seed };
}

describe('şut ve ısı haritası kayıtları', () => {
  it('her şut kaydedilir: sayılar istatistiklerle, goller skorla tutar', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = createMatch(setup('fenerbahce', 'konyaspor', seed), world.players);
      simulateToEnd(state, world.players);
      const r = buildResult(state);
      const shots = r.shots!;
      for (const side of ['home', 'away'] as const) {
        const own = shots.filter((s) => s.side === side);
        expect(own).toHaveLength(r.stats[side].shots);
        expect(own.filter((s) => s.outcome === 'goal' || s.outcome === 'saved')).toHaveLength(r.stats[side].shotsOnTarget);
        expect(own.filter((s) => s.outcome === 'goal')).toHaveLength(side === 'home' ? r.homeGoals : r.awayGoals);
      }
      // Şutu çeken o tarafın oyuncusu; penaltı / serbest vuruş türü yazılır, normal şutta yazılmaz
      for (const s of shots) {
        expect(state.players[s.playerId]!.side).toBe(s.side);
        expect(s.kind).not.toBe('normal');
      }
    }
  });

  it('zaman çizelgesi: oynanan her dakika bir harf, devreler ayrı; son harf o dakikanın anı', () => {
    const state = createMatch(setup('galatasaray', 'besiktas', 7), world.players);
    let checked = 0;
    while (state.period !== 'full') {
      const period = state.period;
      stepMatch(state, world.players);
      if ((period === 'first' || period === 'second') && state.lastPlay) {
        expect(state.timeline.at(-1)).toBe(playCode(state.lastPlay));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(80);
    const minutes = decodeTimeline(state.timeline);
    const [first, second] = state.timeline.split('|');
    expect(first!.length).toBe(45 + state.addedTime[0]);
    expect(second!.length).toBe(45 + state.addedTime[1]);
    expect(minutes).toHaveLength(first!.length + second!.length);
    expect(minutes[0]).toMatchObject({ minute: 1, second: false });
    expect(minutes[first!.length]).toMatchObject({ minute: 46, second: true });
    // Gollü dakikalar 'g' / 'G' olarak görünür (aynı dakikada daha önemli an olamaz)
    const goalMinutes = minutes.filter((m) => m.kind === 'goal').length;
    expect(goalMinutes).toBeGreaterThan(0);
    expect(goalMinutes).toBeLessThanOrEqual(state.score.home + state.score.away);
  });

  it('kayıt rastgeleliği değiştirmez: aynı tohumla sonuç aynı', () => {
    const a = createMatch(setup('trabzonspor', 'samsunspor', 11), world.players);
    simulateToEnd(a, world.players);
    const b = createMatch(setup('trabzonspor', 'samsunspor', 11), world.players);
    simulateToEnd(b, world.players);
    expect(buildResult(a)).toEqual(buildResult(b));
  });
});
