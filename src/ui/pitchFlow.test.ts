import { describe, expect, it } from 'vitest';
import { clubPlayers, createMatch, createWorld, stepMatch, type MatchPlay, type MatchState } from '../engine';
import { autoSelectLineup } from '../engine/match/formation';
import { gameData } from '../gameData';
import type { Point } from './pitch';
import { sampleScene, type Spots } from './pitchMotion';
import { buildScene, frameStartsMs, isHighlight, sceneDurationMs, viewScene } from './pitchScene';

const world = createWorld(gameData, 3, 'galatasaray', '2026-07-01');

function match(seed: number, home = 'galatasaray', away = 'besiktas'): MatchState {
  const team = (clubId: string) => ({ clubId, name: clubId, lineup: autoSelectLineup(clubPlayers(world, clubId)) });
  return createMatch({ fixtureId: 1, home: team(home), away: team(away), seed }, world.players);
}

/** Bir ekran karesi (~60 fps, maç hızı 1). */
const TICK_MS = 16;
/** Bir ekran karesinde görünen oyuncunun / topun en çok yer değiştirmesi (m): üstü ışınlanma. */
const MAX_STEP_M = 1.5;
/** Bir ekran karesinde görünürlüğün en çok değişimi: üstü bir anda belirme / kaybolma. */
const MAX_FADE_STEP = 0.1;

interface Worst { step: number; fade: number; where: string }

/** PitchView gibi: ekrandaki sahneyi 16 ms adımlarla oynatır; önceki sahnenin son hâlinden girer (sakin dakika sahneyi siler). */
class Viewer {
  players: Spots | undefined;
  ball: { at: Point; alpha: number } | undefined;
  worst: Worst = { step: 0, fade: 0, where: '' };
  /** Sahne içinde (santraya geçiş dışında) iki karede de olan ama koşamayıp kesilen oyuncular. */
  cuts: string[] = [];

  play(m: MatchState, play: MatchPlay | null): void {
    const kickoff = play === null;
    if (!(kickoff || isHighlight(play))) {
      this.players = undefined;
      this.ball = undefined;
      return;
    }
    const { frames, spots } = viewScene(m, buildScene(m, play, m.minute), kickoff);
    const starts = frameStartsMs(frames);
    const from = this.players;
    const fromBall = this.ball?.at;
    for (let t = 0; t <= sceneDurationMs(frames); t += TICK_MS) {
      const s = sampleScene(frames, spots, t, from, starts, fromBall);
      const where = (who: string) => `${m.period} ${m.minute}. dk ${play?.kind ?? 'santra'} kare ${s.index}${s.leadIn ? ' (giriş)' : ''} ${who}`;
      for (const id of new Set([...s.players.keys(), ...(this.players?.keys() ?? [])])) {
        const p = s.players.get(id);
        const q = this.players?.get(id);
        const both = !s.leadIn && spots[s.index]!.has(id) && spots[s.index - 1]?.has(id);
        if (both && !frames[s.index]!.kickoff && (p?.alpha ?? 1) < 1) this.cuts.push(where(`oyuncu ${id}`));
        this.check(p ? { at: p.at, alpha: p.alpha ?? 1 } : undefined, q ? { at: q.at, alpha: q.alpha ?? 1 } : undefined, where(`oyuncu ${id}`));
      }
      if (this.ball) this.check({ at: s.ball, alpha: s.ballAlpha }, this.ball, where('top'));
      this.players = s.players;
      this.ball = { at: s.ball, alpha: s.ballAlpha };
    }
  }

  private check(now: { at: Point; alpha: number } | undefined, before: { at: Point; alpha: number } | undefined, where: string): void {
    const fade = Math.abs((now?.alpha ?? 0) - (before?.alpha ?? 0));
    // Yer değiştirme yalnızca iki karede de görünürken sayılır (kesmede solmuşken yer değişir)
    const step = now && before && Math.min(now.alpha, before.alpha) > MAX_FADE_STEP ? Math.hypot(now.at.x - before.at.x, now.at.y - before.at.y) : 0;
    if (step > this.worst.step) this.worst = { ...this.worst, step, where };
    if (fade > this.worst.fade) this.worst = { ...this.worst, fade, where };
  }
}

describe('2D saha akışı: ışınlanma yok', () => {
  it('bütün maç boyunca (sahneler arası, devre arası yer değişimi, gol sonrası santra, değişiklik, duran top) kimse sıçramaz', () => {
    const seen = new Set<string>();
    // Tester'ın yeniden üretme maçları dahil (A-001 tohum 32, A-002 tohum 21)
    const games: [number, string?, string?][] = [[1], [2], [3], [4], [5], [6], [21, 'fenerbahce', 'trabzonspor'], [32, 'fenerbahce', 'trabzonspor']];
    for (const [seed, home, away] of games) {
      const m = match(seed, home, away);
      const viewer = new Viewer();
      while (m.period !== 'full') {
        const before = viewer.players !== undefined;
        stepMatch(m, world.players);
        const play = m.lastPlay;
        if (play === null && m.period === 'second' && before) seen.add('devre arası');
        if (play?.kind === 'goal') seen.add('gol');
        if (play?.subs) seen.add('değişiklik');
        if (play?.kind === 'corner' || play?.fromCorner) seen.add('korner');
        if (play?.kind === 'freekick' || play?.fromFreeKick || play?.fromPenalty) seen.add('serbest vuruş / penaltı');
        viewer.play(m, play);
      }
      expect(viewer.worst.step, viewer.worst.where).toBeLessThanOrEqual(MAX_STEP_M);
      expect(viewer.worst.fade, viewer.worst.where).toBeLessThanOrEqual(MAX_FADE_STEP);
      // Sahne içinde kesme yalnızca santraya geçişte (bilerek); başka her yerde oyuncular yürüyerek / koşarak yetişir
      expect(viewer.cuts.slice(0, 3)).toEqual([]);
    }
    expect([...seen].sort()).toEqual(['devre arası', 'değişiklik', 'gol', 'korner', 'serbest vuruş / penaltı']);
  });

  it('kırmızı kart ve penaltı sahnesi: atılan oyuncu kulübeye yürür, kimse sıçramaz', () => {
    const m = match(7);
    for (let i = 0; i < 30; i++) stepMatch(m, world.players);
    const red = m.away.onPitch.find((id) => m.players[id]!.slot === 'DC')!;
    const striker = m.home.onPitch.find((id) => m.players[id]!.slot === 'ST')!;
    const viewer = new Viewer();
    viewer.play(m, { side: 'home', kind: 'foul', playerId: null, defenderId: red, card: { playerId: red, type: 'red' } });
    viewer.play(m, { side: 'home', kind: 'save', playerId: striker, keeperId: m.away.onPitch[0]!, fromPenalty: true });
    expect(viewer.worst.step, viewer.worst.where).toBeLessThanOrEqual(MAX_STEP_M);
    expect(viewer.worst.fade, viewer.worst.where).toBeLessThanOrEqual(MAX_FADE_STEP);
  });
});
