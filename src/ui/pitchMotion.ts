/**
 * 2D sahanın akışı (saf, testli): sahnenin kareleri arasında her an (ms) oyuncuların ve topun yeri.
 * Oyuncular kareler arasında yumuşak hızlanıp yavaşlayarak koşar; top kavisli (falso) ve gerekirse havadan gider.
 * Ayrıca sakin dakikalardaki baskı çubuğunun değeri.
 */
import type { MatchState, Side } from '../engine';
import type { Point } from './pitch';
import { frameStartsMs, type SceneFrame } from './pitchScene';

export type Spots = Map<number, { side: Side; at: Point }>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Yavaş başlayıp yavaş biten geçiş. */
export function easeInOut(u: number): number {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}

/** Hızlı başlayıp yavaşlayan geçiş (yerden pas: top ayaktan hızlı çıkar). */
function easeOut(u: number): number {
  return 1 - (1 - u) ** 2;
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Topun yolundaki ilerleme: şut ve havadan top sabit hızda, yerden pas yavaşlayarak, sürmede oyuncuyla birlikte. */
function ballProgress(frame: SceneFrame, u: number): number {
  switch (frame.move) {
    case 'shot':
    case 'lob':
    case 'cross': return u;
    case 'pass': return easeOut(u);
    default: return easeInOut(u);
  }
}

/**
 * Önceki kareden bu kareye topun `u` (0–1) anındaki yeri ve yüksekliği. Yol ikinci dereceden Bézier eğrisi:
 * kontrol noktası yolun ortasından `curl` × 2 metre yana (eğrinin en çok sapması `curl`); yükseklik parabol.
 */
export function ballPath(from: Point, frame: SceneFrame, u: number): { at: Point; height: number } {
  const to = frame.ball;
  const t = ballProgress(frame, clamp(u, 0, 1));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const curl = frame.curl ?? 0;
  const control = { x: (from.x + to.x) / 2 - (dy / length) * curl * 2, y: (from.y + to.y) / 2 + (dx / length) * curl * 2 };
  const a = lerp(from, control, t);
  const b = lerp(control, to, t);
  return { at: lerp(a, b, t), height: 4 * (frame.height ?? 0) * t * (1 - t) };
}

/** SVG yolu (pas / şut izi): topun yerdeki izi. */
export function ballTrack(from: Point, frame: SceneFrame, k = 1): string {
  const to = frame.ball;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const curl = frame.curl ?? 0;
  const cx = (from.x + to.x) / 2 - (dy / length) * curl * 2;
  const cy = (from.y + to.y) / 2 + (dx / length) * curl * 2;
  return `M ${from.x * k} ${from.y} Q ${cx * k} ${cy} ${to.x * k} ${to.y}`;
}

export interface MotionSample {
  /** Gidilen (hedef) kare; girişte 0. */
  index: number;
  /** Geçişin ilerlemesi (0–1); girişte giriş ilerlemesi. */
  u: number;
  /** Sahne girişinde mi (oyuncular ilk kareye süzülüyor / beliriyor). */
  leadIn: boolean;
  players: Spots;
  ball: Point;
  /** Topun yerden yüksekliği (metre). */
  height: number;
}

/**
 * Sahnenin `t` (ms) anı. `spots`: her karenin yerleşimi (frameSpots). `previous`: girişte oyuncuların geldiği yerler
 * (önceki sahnenin son hâli); yoksa ilk karede belirirler.
 */
export function sampleScene(scene: readonly SceneFrame[], spots: readonly Spots[], t: number, previous?: Spots, starts = frameStartsMs(scene)): MotionSample {
  const last = scene.length - 1;
  if (t < starts[0]!) {
    const u = clamp(t / starts[0]!, 0, 1);
    const players: Spots = new Map();
    for (const [id, s] of spots[0]!) {
      const from = previous?.get(id);
      players.set(id, from ? { side: s.side, at: lerp(from.at, s.at, easeInOut(u)) } : s);
    }
    return { index: 0, u, leadIn: true, players, ball: scene[0]!.ball, height: 0 };
  }
  let i = 1;
  while (i <= last && t >= starts[i]!) i++;
  if (i > last) return { index: last, u: 1, leadIn: false, players: spots[last]!, ball: scene[last]!.ball, height: 0 };
  const u = clamp((t - starts[i - 1]!) / (starts[i]! - starts[i - 1]!), 0, 1);
  const eased = easeInOut(u);
  const players: Spots = new Map();
  for (const [id, b] of spots[i]!) {
    const a = spots[i - 1]!.get(id);
    players.set(id, a ? { side: b.side, at: lerp(a.at, b.at, eased) } : b);
  }
  // Bu karede olmayan (sahadan çıkan) oyuncu karenin sonuna kadar eski yerinde
  for (const [id, a] of spots[i - 1]!) if (!players.has(id)) players.set(id, a);
  const ball = ballPath(scene[i - 1]!.ball, scene[i]!, u);
  return { index: i, u, leadIn: false, players, ball: ball.at, height: ball.height };
}

/** Baskı çubuğu için bakılan son dakika sayısı. */
export const DOMINANCE_WINDOW = 10;

/**
 * Son dakikalarda hangi takım baskın: −1 (deplasman) … +1 (ev sahibi). Ataklar (%60) ve top hakimiyeti (%40),
 * yeni dakikalar daha ağır.
 */
export function dominance(match: Pick<MatchState, 'momentum' | 'timeline'>, window = DOMINANCE_WINDOW): number {
  const possession = [...match.timeline.replace(/\|/g, '')].slice(-window).map((c) => (c === c.toLowerCase() ? 1 : -1));
  const attacks = match.momentum.slice(-window);
  const n = Math.max(possession.length, attacks.length);
  let sum = 0;
  let weights = 0;
  for (let age = 0; age < n; age++) {
    const w = 0.82 ** age;
    const p = possession[possession.length - 1 - age] ?? 0;
    const a = attacks[attacks.length - 1 - age] ?? 0;
    sum += w * (0.6 * a + 0.4 * p);
    weights += w;
  }
  return weights === 0 ? 0 : clamp(sum / weights, -1, 1);
}
