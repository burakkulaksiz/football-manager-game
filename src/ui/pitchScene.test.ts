import { describe, expect, it } from 'vitest';
import { clubPlayers, createMatch, createWorld, stepMatch, type MatchPlay, type MatchState } from '../engine';
import { autoSelectLineup } from '../engine/match/formation';
import { gameData } from '../gameData';
import { ballSpot, PITCH_LENGTH, PITCH_WIDTH } from './pitch';
import { buildScene, frameSpots, framesForDuration } from './pitchScene';

const world = createWorld(gameData, 3, 'galatasaray', '2026-07-01');

function match(seed = 9): MatchState {
  const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(world, clubId)) });
  return createMatch({ fixtureId: 1, home: team('galatasaray'), away: team('besiktas'), seed }, world.players);
}

/** Bütün maçı oynatıp her dakikanın anını ve o anki durumu toplar. */
function playAll(m: MatchState): { minute: number; play: MatchPlay; state: MatchState }[] {
  const out: { minute: number; play: MatchPlay; state: MatchState }[] = [];
  while (m.period !== 'full') {
    stepMatch(m, world.players);
    if (m.lastPlay) out.push({ minute: m.minute, play: m.lastPlay, state: structuredClone(m) });
  }
  return out;
}

describe('2D saha sahnesi', () => {
  const plays = [9, 10, 11].flatMap((seed) => playAll(match(seed)));

  it('her sahne 1–5 kare, son kare motorun anıyla aynı yerde, top saha içinde (gol/aut hariç)', () => {
    for (const { minute, play, state } of plays) {
      const scene = buildScene(state, play, minute);
      expect(scene.length).toBeGreaterThanOrEqual(1);
      expect(scene.length).toBeLessThanOrEqual(5);
      expect(scene[scene.length - 1]!.ball).toEqual(ballSpot(play, minute));
      for (const f of scene.slice(0, -1)) {
        expect(f.ball.x).toBeGreaterThanOrEqual(0);
        expect(f.ball.x).toBeLessThanOrEqual(PITCH_LENGTH);
        expect(f.ball.y).toBeGreaterThanOrEqual(0);
        expect(f.ball.y).toBeLessThanOrEqual(PITCH_WIDTH);
      }
    }
  });

  it('gol sahnesi: asist yapan pası verir, golü atan şutu çeker, sonra top ağlarda', () => {
    const goals = plays.filter((p) => p.play.kind === 'goal' && !p.play.fromPenalty && p.play.assistId != null);
    expect(goals.length).toBeGreaterThan(0);
    for (const { minute, play, state } of goals) {
      const scene = buildScene(state, play, minute);
      const carriers = scene.map((f) => f.carrierId);
      const shot = carriers.indexOf(play.playerId);
      expect(shot).toBeGreaterThan(0);
      expect(carriers[shot - 1]).toBe(play.assistId);
      expect(scene[scene.length - 1]!.move).toBe('shot');
    }
  });

  it('kurtarışta kaleci topun başında; faulde faulü yapan topun yanında', () => {
    const saves = plays.filter((p) => p.play.kind === 'save');
    expect(saves.length).toBeGreaterThan(0);
    for (const { minute, play, state } of saves) {
      const last = buildScene(state, play, minute).at(-1)!;
      const keeper = frameSpots(state, last, false).get(play.keeperId!)!;
      expect(Math.hypot(keeper.at.x - last.ball.x, keeper.at.y - last.ball.y)).toBeLessThan(2);
    }
    const fouls = plays.filter((p) => p.play.kind === 'foul' && p.play.defenderId != null);
    expect(fouls.length).toBeGreaterThan(0);
    for (const { minute, play, state } of fouls) {
      const last = buildScene(state, play, minute).at(-1)!;
      const fouler = frameSpots(state, last, false).get(play.defenderId!)!;
      expect(Math.hypot(fouler.at.x - last.ball.x, fouler.at.y - last.ball.y)).toBeLessThan(3);
    }
  });

  it('kart gören oyuncu son karede sahada görünür (kırmızıyla atılmış olsa da)', () => {
    const carded = plays.filter((p) => p.play.card);
    expect(carded.length).toBeGreaterThan(0);
    for (const { minute, play, state } of carded) {
      const last = buildScene(state, play, minute).at(-1)!;
      expect(frameSpots(state, last, false).has(play.card!.playerId)).toBe(true);
    }
  });

  it('penaltıda vurucu dışındaki saha oyuncuları ceza sahası dışında', () => {
    const m = match();
    const shooter = m.home.onPitch.find((id) => m.players[id]!.slot === 'ST')!;
    const play: MatchPlay = { side: 'home', kind: 'goal', playerId: shooter, fromPenalty: true };
    const scene = buildScene(m, play, 30);
    const spot = scene.find((f) => f.clearBoxFor === 'home' && f.carrierId === shooter)!;
    expect(spot.ball).toEqual({ x: PITCH_LENGTH - 11, y: PITCH_WIDTH / 2 });
    for (const [id, { at }] of frameSpots(m, spot, false)) {
      if (id === shooter || m.players[id]!.slot === 'GK') continue;
      const inBox = at.x > PITCH_LENGTH - 16.5 && Math.abs(at.y - PITCH_WIDTH / 2) < 20.16;
      expect(inBox).toBe(false);
    }
  });

  it('hızlı modda yalnızca son kare, yavaşta en fazla 5 kare', () => {
    const scene = buildScene(plays[0]!.state, plays.find((p) => p.play.kind === 'goal')!.play, 20);
    expect(framesForDuration(scene, 40)).toHaveLength(1);
    expect(framesForDuration(scene, 150)).toHaveLength(1);
    expect(framesForDuration(scene, 450).length).toBeLessThanOrEqual(4);
    expect(framesForDuration(scene, 1000).length).toBeLessThanOrEqual(5);
    expect(framesForDuration(scene, 1000).at(-1)).toBe(scene.at(-1));
  });
});
