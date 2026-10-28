import { describe, expect, it } from 'vitest';
import { ballPath, dominance, easeInOut, reachedIndex, sampleScene, type Spots } from './pitchMotion';
import { frameStartsMs, LEAD_IN_MS, type SceneFrame } from './pitchScene';

const frame = (x: number, y: number, extra: Partial<SceneFrame> = {}): SceneFrame => ({
  ball: { x, y }, carrierId: null, carrierSide: 'home', placed: [], move: 'pass', ...extra,
});

describe('top yolu', () => {
  it('uçlarda başlangıç ve hedef; kavis yana saptırır; yükseklik ortada en çok, uçlarda sıfır', () => {
    const from = { x: 10, y: 34 };
    const to = frame(50, 34, { move: 'cross', curl: 3, height: 6 });
    expect(ballPath(from, to, 0).at).toEqual(from);
    expect(ballPath(from, to, 1).at).toEqual(to.ball);
    const mid = ballPath(from, to, 0.5);
    expect(Math.abs(mid.at.y - 34)).toBeCloseTo(3, 5);
    expect(mid.height).toBeCloseTo(6, 5);
    expect(ballPath(from, to, 1).height).toBe(0);
    expect(ballPath(from, frame(50, 34), 0.5).height).toBe(0);
  });

  it('yumuşak geçiş: 0 → 0, 0.5 → 0.5, 1 → 1, başta yavaş', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
  });
});

describe('sahne örnekleme', () => {
  const scene = [frame(20, 30, { move: 'none' }), frame(40, 30), frame(60, 40, { move: 'dribble' })];
  const spots: Spots[] = [
    new Map([[1, { side: 'home', at: { x: 20, y: 30 } }]]),
    new Map([[1, { side: 'home', at: { x: 40, y: 30 } }]]),
    new Map([[1, { side: 'home', at: { x: 60, y: 40 } }], [2, { side: 'away', at: { x: 70, y: 40 } }]]),
  ];
  const starts = frameStartsMs(scene);

  it('girişte ilk kare; önceki sahneden gelen oyuncu ve top yakınsa oradan süzülür, uzaksa kesilir (solar, sonra belirir)', () => {
    const near: Spots = new Map([[1, { side: 'home', at: { x: 10, y: 30 } }]]);
    const s = sampleScene(scene, spots, LEAD_IN_MS / 2, near, starts, { x: 14, y: 30 });
    expect(s.leadIn).toBe(true);
    expect(s.players.get(1)!.at.x).toBeCloseTo(15);
    expect(s.players.get(1)!.alpha).toBeUndefined();
    expect(s.ball.x).toBeCloseTo(17);
    // 80 m'yi 400 ms'de koşamaz: önce eski yerinde solar, sonra yeni yerinde belirir
    const far: Spots = new Map([[1, { side: 'home', at: { x: 100, y: 30 } }]]);
    const early = sampleScene(scene, spots, LEAD_IN_MS * 0.25, far, starts, { x: 100, y: 30 });
    expect(early.players.get(1)).toMatchObject({ at: { x: 100, y: 30 }, alpha: 0.5 });
    expect(early.ball).toEqual({ x: 100, y: 30 });
    expect(early.ballAlpha).toBeCloseTo(0.5);
    const late = sampleScene(scene, spots, LEAD_IN_MS * 0.75, far, starts, { x: 100, y: 30 });
    expect(late.players.get(1)).toMatchObject({ at: { x: 20, y: 30 }, alpha: 0.5 });
    // Önceki sahne yoksa ilk karede belirir
    expect(sampleScene(scene, spots, LEAD_IN_MS / 2, undefined, starts).players.get(1)!.alpha).toBeCloseTo(0.5);
  });

  it('kareler arasında oyuncular ve top yolda; sonunda son karede', () => {
    const middle = sampleScene(scene, spots, (starts[0]! + starts[1]!) / 2, undefined, starts);
    expect(middle.index).toBe(1);
    expect(middle.players.get(1)!.at.x).toBeCloseTo(30);
    expect(middle.ball.x).toBeGreaterThan(30); // yerden pas hızlı çıkar
    const end = sampleScene(scene, spots, starts[2]! + 5000, undefined, starts);
    expect(end.index).toBe(2);
    expect(end.players.get(2)!.at).toEqual({ x: 70, y: 40 });
    expect(end.ball).toEqual({ x: 60, y: 40 });
  });

  it('varılan kare: top yoldayken bir önceki kare (sonuç şut çekilince değil, top varınca açıklanır)', () => {
    expect(reachedIndex(sampleScene(scene, spots, LEAD_IN_MS / 2, undefined, starts))).toBe(-1);
    expect(reachedIndex(sampleScene(scene, spots, starts[1]! - 1, undefined, starts))).toBe(0);
    expect(reachedIndex(sampleScene(scene, spots, starts[1]!, undefined, starts))).toBe(1);
    expect(reachedIndex(sampleScene(scene, spots, starts[2]! - 1, undefined, starts))).toBe(1);
    expect(reachedIndex(sampleScene(scene, spots, starts[2]! + 5000, undefined, starts))).toBe(2);
  });
});

describe('baskı çubuğu', () => {
  it('ev sahibinin atakları ve topa sahip olması artı, deplasmanınki eksi; yeni dakikalar ağır', () => {
    expect(dominance({ momentum: [1, 1, 1, 1], timeline: 'hhaa' })).toBeGreaterThan(0.8);
    expect(dominance({ momentum: [-1, -1, 0, -1], timeline: 'HHHA' })).toBeLessThan(-0.6);
    expect(dominance({ momentum: [], timeline: '' })).toBe(0);
    const recentAway = dominance({ momentum: [1, 1, 1, -1, -1], timeline: 'aaaAA' });
    const recentHome = dominance({ momentum: [-1, -1, 1, 1, 1], timeline: 'AAaaa' });
    expect(recentHome).toBeGreaterThan(recentAway);
  });
});
