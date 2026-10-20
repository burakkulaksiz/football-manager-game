import { describe, expect, it } from 'vitest';
import { clubPlayers, createMatch, createWorld, stepMatch, type MatchPlay, type MatchState } from '../engine';
import { autoSelectLineup } from '../engine/match/formation';
import { gameData } from '../gameData';
import { ballSpot, PITCH_LENGTH, PITCH_WIDTH } from './pitch';
import { buildScene, frameSpots, isHighlight, playLabel, SCENE_FRAME_MS, SCENE_HOLD_MS, sceneDurationMs } from './pitchScene';

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
    const spot = scene.find((f) => f.setPiece?.kind === 'penalty' && f.carrierId === shooter)!;
    expect(spot.ball).toEqual({ x: PITCH_LENGTH - 11, y: PITCH_WIDTH / 2 });
    for (const [id, { at }] of frameSpots(m, spot, false)) {
      if (id === shooter || m.players[id]!.slot === 'GK') continue;
      const inBox = at.x > PITCH_LENGTH - 16.5 && Math.abs(at.y - PITCH_WIDTH / 2) < 20.16;
      expect(inBox).toBe(false);
    }
  });

  const inBox = (p: { x: number; y: number }) => p.x > PITCH_LENGTH - 16.5 && Math.abs(p.y - PITCH_WIDTH / 2) < 20.16;

  it('korner: kullanan bayrakta, en az 4 hücumcu ve savunmacılar ceza sahasında, birkaç oyuncu geride', () => {
    const m = match();
    const play: MatchPlay = { side: 'home', kind: 'corner', playerId: null };
    const scene = buildScene(m, play, 33);
    const last = scene.at(-1)!;
    expect(last.setPiece).toMatchObject({ kind: 'corner', side: 'home', spot: last.ball });
    expect(last.ball.x).toBeGreaterThan(PITCH_LENGTH - 1);
    const spots = [...frameSpots(m, last, false).values()];
    const home = spots.filter((p) => p.side === 'home');
    const away = spots.filter((p) => p.side === 'away');
    expect(home.filter((p) => inBox(p.at)).length).toBeGreaterThanOrEqual(4);
    expect(away.filter((p) => inBox(p.at)).length).toBeGreaterThanOrEqual(7);
    expect(home.filter((p) => p.at.x < PITCH_LENGTH / 2 + 10).length).toBeGreaterThanOrEqual(3); // kaleci + 2 geride
  });

  it('serbest vuruş: topa 9.15 m uzaklıkta 4 kişilik baraj, kullanan topun başında', () => {
    const m = match();
    const taker = m.away.onPitch.find((id) => m.players[id]!.slot === 'AMC' || m.players[id]!.slot === 'MC')!;
    const play: MatchPlay = { side: 'away', kind: 'freekick', playerId: taker };
    const last = buildScene(m, play, 52).at(-1)!;
    expect(last.setPiece?.kind).toBe('freekick');
    expect(last.carrierId).toBe(taker);
    const spots = frameSpots(m, last, false);
    const wall = [...spots.values()].filter((p) => p.side === 'home' && Math.abs(Math.hypot(p.at.x - last.ball.x, p.at.y - last.ball.y) - 9.15) < 1.2);
    expect(wall.length).toBeGreaterThanOrEqual(4);
    const t = spots.get(taker)!.at;
    expect(Math.hypot(t.x - last.ball.x, t.y - last.ball.y)).toBeLessThan(2);
  });

  it('önemli anlar: şutlar, duran toplar, kart ve sakatlık; kartsız faul ve şutsuz atak değil', () => {
    const base = { side: 'home' as const, playerId: null };
    for (const kind of ['goal', 'save', 'miss', 'blocked', 'penalty', 'corner', 'freekick'] as const) {
      expect(isHighlight({ ...base, kind })).toBe(true);
    }
    expect(isHighlight({ ...base, kind: 'foul' })).toBe(false);
    expect(isHighlight({ ...base, kind: 'attack' })).toBe(false);
    expect(isHighlight({ ...base, kind: 'hold' })).toBe(false);
    expect(isHighlight({ ...base, kind: 'foul', card: { playerId: 1, type: 'yellow' } })).toBe(true);
    expect(isHighlight({ ...base, kind: 'hold', injuredId: 4 })).toBe(true);
    expect(isHighlight(null)).toBe(false);
    expect(playLabel({ ...base, kind: 'foul', card: { playerId: 1, type: 'red' } })).toBe('Kırmızı kart');
    expect(playLabel({ ...base, kind: 'attack', injuredId: 4 })).toBe('Sakatlık');
    expect(playLabel({ ...base, kind: 'goal', fromPenalty: true })).toBe('GOL! (Penaltı)');
  });

  it('bir maçta önemli anlar dakikaların yaklaşık yarısından azı; sahne süresi kare sayısıyla artar', () => {
    const all = playAll(match(12));
    const highlights = all.filter((p) => isHighlight(p.play)).length;
    expect(highlights).toBeGreaterThan(10);
    expect(highlights / all.length).toBeLessThan(0.6);
    const scene = buildScene(all[0]!.state, all.find((p) => p.play.kind === 'goal' || p.play.kind === 'save')!.play, 20);
    expect(sceneDurationMs(scene)).toBe((scene.length - 1) * SCENE_FRAME_MS + SCENE_HOLD_MS);
  });

  it('sakatlanan oyuncu son karede işaretli ve görünür', () => {
    const m = match();
    const injured = m.away.onPitch.find((id) => m.players[id]!.slot === 'DC')!;
    const last = buildScene(m, { side: 'home', kind: 'hold', playerId: null, injuredId: injured }, 40).at(-1)!;
    expect(last.injuredId).toBe(injured);
    expect(frameSpots(m, last, false).has(injured)).toBe(true);
  });
});
