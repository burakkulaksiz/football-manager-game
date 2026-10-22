/**
 * 2D saha geometrisi (saf, testli). Motor oyuncu koordinatı tutmaz; burada dakikanın anından
 * (MatchState.lastPlay) topun yeri, dizilişten de oyuncuların yeri türetilir.
 *
 * Koordinatlar metre: x 0–105 (ev sahibi sağa hücum eder), y 0–68 (yukarıdan aşağı).
 */
import { FORMATION_LAYOUT, FORMATIONS, type MatchPlay, type MatchState, type Position, type Side, type TeamInstructions } from '../engine';

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
    case 'freekick': return freeKickSpot(s, minute);
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

/** Serbest vuruşun yeri (ceza sahası önü, 25–30 m). Kazanılan serbest vuruşla şutu aynı yerden. */
export function freeKickSpot(side: Side, minute: number): Point {
  return { x: alongX(side, 79), y: 20 + hash01(minute, 2) * 28 };
}

/** Şutun çıktığı yer (şut çizgisi için); şut değilse null. */
export function shotOrigin(play: MatchPlay | null, minute: number): Point | null {
  if (!play || !['blocked', 'miss', 'save', 'penalty', 'goal'].includes(play.kind)) return null;
  if (play.fromPenalty) return { x: alongX(play.side, PITCH_LENGTH - 11), y: MID_Y };
  const h1 = hash01(minute, 3);
  const h2 = hash01(minute, 4);
  if (play.fromFreeKick) return freeKickSpot(play.side, minute);
  // Korner ortasına kafa: altıpasla penaltı noktası arası
  if (play.fromCorner) return { x: alongX(play.side, 94 + h1 * 5), y: MID_Y - 5 + h2 * 10 };
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

/** Takım talimatlarının saha şekline etkisi (metre ve çarpanlar). */
export interface TeamShape {
  /** Mentalite: bütün blok ileri (+) / geri (−). */
  push: number;
  /** Savunma hattının ek kayması (derin −, yüksek +). */
  line: number;
  /** Top rakipteyken pres: önde oynayanların ileri (+, yoğun) / geri (−, az) kayması. */
  press: number;
  /** Yan yayılma çarpanı (orta çizgiden uzaklık): dar < 1 < geniş. */
  spread: number;
  /** Rakip ceza sahasına girmeyen, geride kalan oyuncuların dizilişteki ly sınırı (ly ≥ sınır → geride). */
  stayBackLy: number;
}

/** Talimatlardan saha şekli; varsayılan talimatlar bugünkü yerleşimi verir. */
export function teamShape(i: TeamInstructions): TeamShape {
  const m = i.mentality;
  return {
    push: m * 3,
    line: (i.defensiveLine === 'high' ? 7 : i.defensiveLine === 'deep' ? -7 : 0) + m,
    press: i.pressing === 'high' ? 8 : i.pressing === 'low' ? -6 : 0,
    spread: i.width === 'wide' ? 1.18 : i.width === 'narrow' ? 0.8 : 1,
    // Tam hücumda bekler de ceza sahasına girer; savunmada ön libero/orta saha geride kalır
    stayBackLy: m >= 2 ? 74 : m === 1 ? 69 : m === -1 ? 56 : m <= -2 ? 51 : 65,
  };
}

/**
 * Bir takımın sahadaki oyuncularının yerleri.
 * Dizilişteki yer (FORMATION_LAYOUT: x soldan sağa, y yukarı = hücum) sahaya çevrilir;
 * derinlik blok çizgisine göre kayar, genişlik biraz topa doğru sıkışır.
 * Talimatlar (teamShape) bloğun derinliğini, savunma hattını, presi ve genişliği değiştirir.
 * `kickoff`: başlama vuruşu dizilişi (herkes kendi yarısında).
 * `possession`: topun hangi takımda olduğu (pres ve top kaybında daralma için; bilinmiyorsa null).
 */
export function teamSpots(match: MatchState, side: Side, ball: Point, kickoff: boolean, possession: Side | null = null): Map<number, Point> {
  // Top bir kaleye 20 m'den yakınsa (korner, şut, penaltı) oyuncular ceza sahasına doluşur.
  const attackProgress = side === 'home' ? ball.x : PITCH_LENGTH - ball.x;
  const inOppBox = !kickoff && attackProgress > 85;
  const inOwnBox = !kickoff && attackProgress < 20;
  const t = kickoff ? 0.12 : blockLine(side, ball);
  const shape = teamShape(match[side].instructions);
  const defending = possession !== null && possession !== side;
  // Top rakipteyken takım daralır (genişlik talimatının etkisi azalır) ve topa doğru kayar
  const spread = defending ? 0.88 * (1 + (shape.spread - 1) * 0.4) : shape.spread;
  const ballPull = defending ? (match[side].instructions.pressing === 'high' ? 0.3 : 0.24) : 0.18;
  const spots = new Map<number, Point>();

  for (const { id, slot, lx, ly } of formationRoles(match, side)) {
    let a: number;
    const defender = ly >= 65;
    if (slot === 'GK') a = 4 + t * 8 + (kickoff ? 0 : Math.max(-1, shape.line * 0.4));
    else a = 6 + ((100 - ly) / 100) * 52 + t * 36;
    if (kickoff) a = Math.min(a, PITCH_LENGTH / 2 - 1.5);
    // Hücum yönüne bakan oyuncunun sağı: ev sahibi için aşağı (+y), deplasman için yukarı
    let y = side === 'home' ? (lx / 100) * PITCH_WIDTH : ((100 - lx) / 100) * PITCH_WIDTH;
    if (!kickoff && slot !== 'GK') {
      // Talimatlar: mentalite bloğu, savunma hattı arka dörtlüyü taşır; pres top rakipteyken önü ileri iter
      a += shape.push + (defender ? shape.line : 0);
      if (defending) a += shape.press * (defender ? 0.35 : 1);
      y = MID_Y + (y - MID_Y) * spread;
      y += (ball.y - y) * ballPull;
      if (inOppBox && ly < shape.stayBackLy) {
        // Hücumcular ve orta saha rakip ceza sahasına girer (stoperler, savunmacı mentalitede ön libero da geride)
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
    spots.set(id, { x: alongX(side, clamp(a, 1, PITCH_LENGTH - 1)), y: clamp(y, 2, PITCH_WIDTH - 2) });
  }
  return spots;
}

export interface FormationRole {
  id: number;
  slot: Position | null;
  /** Dizilişteki yer (FORMATION_LAYOUT): lx soldan sağa, ly yukarı = hücum (küçük ly = ileri). */
  lx: number;
  ly: number;
}

/** Sahadaki oyuncuların dizilişteki yerleri (saha yerleşimi ve duran top rolleri için). */
export function formationRoles(match: MatchState, side: Side): FormationRole[] {
  const team = match[side];
  // Dizilişteki mevki sırası ile saha yerleşimi aynı sıradadır
  const layout = FORMATION_LAYOUT[team.formation];
  const formationSlots = FORMATIONS[team.formation];
  const used = new Set<number>();
  const roles: FormationRole[] = [];
  for (const id of team.onPitch) {
    const slot = match.players[id]!.slot;
    // Aynı mevkiden birden çok varsa (iki stoper) sıradaki boş yer
    let index = formationSlots.findIndex((s, i) => s === slot && !used.has(i));
    // Mevki dizilişte yoksa (beklenmedik durum) nokta kaybolmasın: boştaki ilk yer
    if (index === -1) index = formationSlots.findIndex((_, i) => i > 0 && !used.has(i));
    if (index === -1) continue;
    used.add(index);
    const [lx, ly] = layout[index]!;
    roles.push({ id, slot, lx, ly });
  }
  return roles;
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

/* ------------------------------------------------------------------ */
/* Kamera                                                               */
/* ------------------------------------------------------------------ */

/** Sahanın çizim alanı (SVG viewBox): kaleler ve kenar payı dahil. */
export const PITCH_VIEW = { x: -3, y: -2, w: PITCH_LENGTH + 6, h: PITCH_WIDTH + 4 } as const;

/** Yakın kameranın büyütmesi. */
export const CAMERA_ZOOM = 1.9;

export interface CameraTransform {
  /** Kaydırma, çizim alanının oranı olarak (CSS translate yüzdesi / 100). */
  tx: number;
  ty: number;
  zoom: number;
}

/**
 * Hedefi (top ya da golcü) ortalayan kamera; sahanın dışına taşmaz (kenarda durur).
 * Hedef yoksa ya da büyütme 1 ise tam saha.
 * CSS: transform-origin 0 0; transform: translate(tx·100%, ty·100%) scale(zoom).
 */
export function cameraTransform(target: Point | null, zoom: number): CameraTransform {
  if (!target || zoom <= 1) return { tx: 0, ty: 0, zoom: 1 };
  const fx = (target.x - PITCH_VIEW.x) / PITCH_VIEW.w;
  const fy = (target.y - PITCH_VIEW.y) / PITCH_VIEW.h;
  return {
    tx: clamp(0.5 - fx * zoom, 1 - zoom, 0),
    ty: clamp(0.5 - fy * zoom, 1 - zoom, 0),
    zoom,
  };
}

/**
 * Saha noktasının ekran konumu (px), kamerayla birlikte: sahne kutusunun genişliği `width` px.
 * Oyuncular büyütülen katmanın dışında çizilir (yazılar yakın kamerada da net kalsın);
 * konum ve birim boyutu (`unit`: metre başına px) kamerayı burada içerir.
 */
export function toScreen(p: Point, cam: CameraTransform, width: number): Point {
  const height = (width * PITCH_VIEW.h) / PITCH_VIEW.w;
  const fx = (p.x - PITCH_VIEW.x) / PITCH_VIEW.w;
  const fy = (p.y - PITCH_VIEW.y) / PITCH_VIEW.h;
  return { x: (cam.tx + fx * cam.zoom) * width, y: (cam.ty + fy * cam.zoom) * height };
}

/** Ekranda bir metrenin px karşılığı (kamera büyütmesiyle). */
export function screenUnit(cam: CameraTransform, width: number): number {
  return (width / PITCH_VIEW.w) * cam.zoom;
}
