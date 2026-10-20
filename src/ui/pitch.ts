/**
 * 2D saha geometrisi (saf, testli). Motor oyuncu koordinatı tutmaz; burada dakikanın anından
 * (MatchState.lastPlay) topun yeri, dizilişten de oyuncuların yeri türetilir.
 *
 * Koordinatlar metre: x 0–105 (ev sahibi sağa hücum eder), y 0–68 (yukarıdan aşağı).
 */
import { FORMATION_LAYOUT, FORMATIONS, type MatchPlay, type MatchState, type Side } from '../engine';

export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;
const GOAL_HALF = 3.66;
const MID_Y = PITCH_WIDTH / 2;

export interface Point {
  x: number;
  y: number;
}

/** Dakikaya bağlı sabit "rastgele" sayı (0–1): aynı dakika her çizimde aynı yerde görünsün. */
export function hash01(minute: number, salt: number): number {
  const v = Math.sin(minute * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Tarafın hücum yönünde, kendi kale çizgisinden `a` metre ilerisi → saha x'i. */
function alongX(side: Side, a: number): number {
  return side === 'home' ? a : PITCH_LENGTH - a;
}

/** Topun yeri: dakikanın anına göre. Maç başlamadıysa / aradaysa orta nokta. */
export function ballSpot(play: MatchPlay | null, minute: number): Point {
  if (!play) return { x: PITCH_LENGTH / 2, y: MID_Y };
  const h1 = hash01(minute, 1);
  const h2 = hash01(minute, 2);
  const s = play.side;
  const at = (a: number, y: number): Point => ({ x: alongX(s, a), y });
  switch (play.kind) {
    case 'hold': return at(38 + h1 * 28, 10 + h2 * 48);
    case 'foul': return at(45 + h1 * 30, 10 + h2 * 48);
    case 'attack': return at(70 + h1 * 14, 8 + h2 * 52);
    case 'freekick': return at(79, 20 + h2 * 28);
    case 'corner': return at(104.6, h2 < 0.5 ? 0.6 : PITCH_WIDTH - 0.6);
    case 'blocked': return at(84 + h1 * 4, 24 + h2 * 20);
    // Auta: direklerin dışından çizgiyi geçer
    case 'miss': return at(106.5, h2 < 0.5 ? MID_Y - GOAL_HALF - 2 - h1 * 6 : MID_Y + GOAL_HALF + 2 + h1 * 6);
    // Kurtarış ya da kaçan penaltı: top kalecide / kale önünde
    case 'save':
    case 'penalty': return at(102.5, MID_Y - 3 + h2 * 6);
    case 'goal': return at(106, MID_Y - GOAL_HALF + 0.8 + h2 * (GOAL_HALF * 2 - 1.6));
  }
}

/** Şutun çıktığı yer (şut çizgisi için); şut değilse null. */
export function shotOrigin(play: MatchPlay | null, minute: number): Point | null {
  if (!play || !['blocked', 'miss', 'save', 'penalty', 'goal'].includes(play.kind)) return null;
  if (play.fromPenalty) return { x: alongX(play.side, PITCH_LENGTH - 11), y: MID_Y };
  const h1 = hash01(minute, 3);
  const h2 = hash01(minute, 4);
  return { x: alongX(play.side, 80 + h1 * 13), y: 18 + h2 * 32 };
}

/**
 * Takım bloğunun ne kadar ileride olduğu (0 = kendi kalesine gömülü, 1 = rakip yarıda).
 * Top rakip kaleye yaklaştıkça takım ileri çıkar, kendi kalesine yaklaştıkça geri çekilir.
 */
export function blockLine(side: Side, ball: Point): number {
  const progress = side === 'home' ? ball.x : PITCH_LENGTH - ball.x;
  return clamp((progress - 15) / 75, 0, 1);
}

/**
 * Bir takımın sahadaki oyuncularının yerleri.
 * Dizilişteki yer (FORMATION_LAYOUT: x soldan sağa, y yukarı = hücum) sahaya çevrilir;
 * derinlik blok çizgisine göre kayar, genişlik biraz topa doğru sıkışır.
 * `kickoff`: başlama vuruşu dizilişi (herkes kendi yarısında).
 */
export function teamSpots(match: MatchState, side: Side, ball: Point, kickoff: boolean): Map<number, Point> {
  const team = match[side];
  // Top bir kaleye 20 m'den yakınsa (korner, şut, penaltı) oyuncular ceza sahasına doluşur.
  const attackProgress = side === 'home' ? ball.x : PITCH_LENGTH - ball.x;
  const inOppBox = !kickoff && attackProgress > 85;
  const inOwnBox = !kickoff && attackProgress < 20;
  // Dizilişteki mevki sırası ile saha yerleşimi aynı sıradadır
  const layout = FORMATION_LAYOUT[team.formation];
  const formationSlots = FORMATIONS[team.formation];
  const used = new Set<number>();
  const t = kickoff ? 0.12 : blockLine(side, ball);
  const spots = new Map<number, Point>();

  for (const id of team.onPitch) {
    const slot = match.players[id]!.slot;
    // Aynı mevkiden birden çok varsa (iki stoper) sıradaki boş yer
    let index = formationSlots.findIndex((s, i) => s === slot && !used.has(i));
    // Mevki dizilişte yoksa (beklenmedik durum) nokta kaybolmasın: boştaki ilk yer
    if (index === -1) index = formationSlots.findIndex((_, i) => i > 0 && !used.has(i));
    if (index === -1) continue;
    used.add(index);
    const [lx, ly] = layout[index]!;
    let a: number;
    if (slot === 'GK') a = 4 + t * 8;
    else a = 6 + ((100 - ly) / 100) * 52 + t * 36;
    if (kickoff) a = Math.min(a, PITCH_LENGTH / 2 - 1.5);
    // Hücum yönüne bakan oyuncunun sağı: ev sahibi için aşağı (+y), deplasman için yukarı
    let y = side === 'home' ? (lx / 100) * PITCH_WIDTH : ((100 - lx) / 100) * PITCH_WIDTH;
    if (!kickoff && slot !== 'GK') {
      y += (ball.y - y) * 0.18;
      const defender = ly >= 65;
      if (inOppBox && !defender) {
        // Hücumcular ve orta saha rakip ceza sahasına girer (stoperler geride kalır)
        a += (91 - a) * 0.6;
        y += (MID_Y - y) * 0.35;
      } else if (inOwnBox) {
        // Savunan takım kendi ceza sahasına çekilir
        a += (11 - a) * (defender ? 0.55 : 0.4);
        y += (MID_Y - y) * 0.4;
      }
      // Dizilişin ızgara gibi görünmemesi için her dakika küçük, sabit (çizimler arasında değişmeyen) kayma
      a += (hash01(match.minute, id) - 0.5) * 5;
      y += (hash01(match.minute, id + 0.5) - 0.5) * 5;
    }
    spots.set(id, { x: alongX(side, a), y: clamp(y, 2, PITCH_WIDTH - 2) });
  }
  return spots;
}

/** İki takımın renkleri çok yakınsa deplasman ikinci rengini giyer. */
export function colorsClash(a: string, b: string): boolean {
  const rgb = (hex: string) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 110;
}
