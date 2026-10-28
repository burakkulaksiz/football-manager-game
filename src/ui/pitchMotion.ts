/**
 * 2D sahanın akışı (saf, testli): sahnenin kareleri arasında her an (ms) oyuncuların ve topun yeri.
 * Oyuncular kareler arasında yumuşak hızlanıp yavaşlayarak koşar; top kavisli (falso) ve gerekirse havadan gider.
 * Ayrıca sakin dakikalardaki baskı çubuğunun değeri.
 */
import type { MatchState, Side } from '../engine';
import type { Point } from './pitch';
import { frameStartsMs, MAX_GLIDE_SPEED, type SceneFrame } from './pitchScene';

/** `alpha`: görünürlük (0–1; yoksa 1): kesmede ve sahneye giriş / çıkışta solar. */
export type Spots = Map<number, { side: Side; at: Point; alpha?: number }>;

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

/**
 * `a`'dan `b`'ye `durationMs` içinde `u` anı: yol kısaysa yumuşak süzülme; hız sınırını aşıyorsa (gol sonrası santra,
 * başka dakikanın sahnesi, devre arasında yer değişimi) koşulmaz, kesilir: eski yerinde solar, yenisinde belirir.
 */
function glide(a: Point, b: Point, u: number, durationMs: number): { at: Point; alpha?: number } {
  if (Math.hypot(b.x - a.x, b.y - a.y) <= MAX_GLIDE_SPEED * durationMs) return { at: lerp(a, b, easeInOut(u)) };
  return u < 0.5 ? { at: a, alpha: 1 - 2 * u } : { at: b, alpha: 2 * u - 1 };
}

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
  /** Topun görünürlüğü (0–1). */
  ballAlpha: number;
}

/** Geçişte oyuncular: varsa süzülür / kesilir, yeni gelen belirir, giden eski yerinde solar. */
function blend(from: Spots | undefined, to: Spots, u: number, durationMs: number): Spots {
  const players: Spots = new Map();
  for (const [id, b] of to) {
    const a = from?.get(id);
    players.set(id, { side: b.side, ...(a ? glide(a.at, b.at, u, durationMs) : { at: b.at, alpha: u }) });
  }
  for (const [id, a] of from ?? []) if (!players.has(id)) players.set(id, { side: a.side, at: a.at, alpha: (a.alpha ?? 1) * (1 - u) });
  return players;
}

/**
 * Sahnenin `t` (ms) anı. `spots`: her karenin yerleşimi (frameSpots). `previous` / `previousBall`: girişte oyuncuların
 * ve topun geldiği yerler (önceki sahnenin son hâli); yoksa ilk karede belirirler.
 */
export function sampleScene(
  scene: readonly SceneFrame[],
  spots: readonly Spots[],
  t: number,
  previous?: Spots,
  starts = frameStartsMs(scene),
  previousBall?: Point,
): MotionSample {
  const last = scene.length - 1;
  if (t < starts[0]!) {
    const u = clamp(t / starts[0]!, 0, 1);
    const ball = previousBall ? glide(previousBall, scene[0]!.ball, u, starts[0]!) : { at: scene[0]!.ball, alpha: u };
    return { index: 0, u, leadIn: true, players: blend(previous, spots[0]!, u, starts[0]!), ball: ball.at, height: 0, ballAlpha: ball.alpha ?? 1 };
  }
  let i = 1;
  while (i <= last && t >= starts[i]!) i++;
  if (i > last) return { index: last, u: 1, leadIn: false, players: spots[last]!, ball: scene[last]!.ball, height: 0, ballAlpha: 1 };
  const duration = starts[i]! - starts[i - 1]!;
  const u = clamp((t - starts[i - 1]!) / duration, 0, 1);
  const players = blend(spots[i - 1], spots[i]!, u, duration);
  // Vuruşsuz kare (santra, kurulum): top kendi kendine uzun yol gitmez, kesilir
  if (scene[i]!.move === 'none') {
    const ball = glide(scene[i - 1]!.ball, scene[i]!.ball, u, duration);
    return { index: i, u, leadIn: false, players, ball: ball.at, height: 0, ballAlpha: ball.alpha ?? 1 };
  }
  const ball = ballPath(scene[i - 1]!.ball, scene[i]!, u);
  return { index: i, u, leadIn: false, players, ball: ball.at, height: ball.height, ballAlpha: 1 };
}

/**
 * Topun vardığı son kare (girişte −1). `index` gidilen karedir: sonuç (gol bandı, etiket) ona bakarsa top daha yoldayken,
 * şut çekildiği an açıklanır; skor ve anlatım da varışta açıklanır (revealDelayMs).
 */
export function reachedIndex(sample: MotionSample): number {
  return sample.u >= 1 && !sample.leadIn ? sample.index : sample.index - 1;
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
