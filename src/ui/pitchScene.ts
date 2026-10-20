/**
 * 2D saha sahnesi (saf, testli): dakikanın anını (MatchState.lastPlay) 2–5 karelik kısa bir akışa çevirir.
 * Örn. şut: geriden pas → orta saha → asist → şut → sonuç. Her karede top hedefe en yakın takım
 * arkadaşına gider; motorun seçtiği gerçek oyuncular (asist, şutu çeken, kaleci, faul yapan) rollerini oynar.
 * Ara karelerin yerleri dakikaya bağlı sabit hash'ten gelir; son kare her zaman ballSpot ile aynıdır.
 */
import type { MatchPlay, MatchState, Side } from '../engine';
import { ballSpot, hash01, PITCH_LENGTH, PITCH_WIDTH, shotOrigin, teamSpots, type Point } from './pitch';

const MID_Y = PITCH_WIDTH / 2;
/** Ceza sahası: kale çizgisinden 16.5 m, kale ortasından ±20.16 m. */
const BOX_DEPTH = 16.5;
const BOX_HALF = 20.16;

export type FrameMove = 'none' | 'pass' | 'shot';

export interface PlacedPlayer {
  id: number;
  side: Side;
  at: Point;
}

export interface SceneFrame {
  ball: Point;
  /** Topla buluşan oyuncu (topun hemen arkasında durur). */
  carrierId: number | null;
  carrierSide: Side;
  /** Özel yerleşimler: faulü yapan, kurtarışı yapan kaleci, bloke eden… (sahadan atılan da olabilir). */
  placed: PlacedPlayer[];
  /** Top bu kareye nasıl geldi (çizgi stili). */
  move: FrameMove;
  /** Penaltı: bu tarafın hücum ettiği ceza sahası boşaltılır. */
  clearBoxFor?: Side;
}

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Hücum yönünde `a` metre, yan çizgiden `y` metre → saha noktası. */
function at(side: Side, a: number, y: number): Point {
  return { x: side === 'home' ? a : PITCH_LENGTH - a, y: clamp(y, 1, PITCH_WIDTH - 1) };
}

/** Noktanın tarafın hücum yönündeki ilerlemesi (0 = kendi kale çizgisi). */
function progress(side: Side, p: Point): number {
  return side === 'home' ? p.x : PITCH_LENGTH - p.x;
}

/** Hedef noktaya (o anki takım yerleşimine göre) en yakın takım arkadaşı; kaleci ve hariç tutulanlar dışında. */
function nearestTeammate(match: MatchState, side: Side, target: Point, exclude: ReadonlySet<number>): number | null {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const [id, p] of teamSpots(match, side, target, false)) {
    if (exclude.has(id) || match.players[id]!.slot === 'GK') continue;
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < bestDist) {
      best = id;
      bestDist = d;
    }
  }
  return best;
}

/** Oyuncunun o anki yerleşimdeki yeri (bulunamazsa hedef). */
function spotOf(match: MatchState, side: Side, id: number, ball: Point): Point {
  return teamSpots(match, side, ball, false).get(id) ?? ball;
}

/**
 * Dakikanın sahnesi. Maç başlamadıysa / aradaysa tek kare (orta nokta).
 */
export function buildScene(match: MatchState, play: MatchPlay | null, minute: number): SceneFrame[] {
  if (!play) return [{ ball: ballSpot(null, minute), carrierId: null, carrierSide: 'home', placed: [], move: 'none' }];
  const side = play.side;
  const opp = other(side);
  const h = (salt: number) => hash01(minute, salt + 10);
  const final = ballSpot(play, minute);
  const frames: SceneFrame[] = [];
  const used = new Set<number>();

  /** Hedefe pas: en yakın takım arkadaşı topla buluşur (aynı oyuncu art arda iki kez almaz). */
  const passTo = (target: Point, move: FrameMove = 'pass', carrier?: number | null) => {
    const id = carrier ?? nearestTeammate(match, side, target, used);
    if (id !== null) used.add(id);
    frames.push({ ball: target, carrierId: id, carrierSide: side, placed: [], move: frames.length === 0 ? 'none' : move });
  };
  /** Oyun kurma: kendi yarısından ileriye 1–2 pas. */
  const buildUp = (count: number) => {
    const starts = [24 + h(1) * 14, 44 + h(2) * 16];
    for (const a of starts.slice(2 - count)) passTo(at(side, a, 10 + h(a) * 48));
  };
  const lastFrame = () => frames[frames.length - 1]!;

  switch (play.kind) {
    case 'hold': {
      buildUp(2);
      passTo(final);
      break;
    }
    case 'attack': {
      buildUp(2);
      passTo(final);
      // Top kapıldı: savunmacı topla birlikte görünür
      if (play.defenderId != null) {
        const steal = { x: final.x + (side === 'home' ? 1.2 : -1.2), y: final.y };
        frames.push({ ball: final, carrierId: null, carrierSide: opp, placed: [{ id: play.defenderId, side: opp, at: steal }], move: 'none' });
      }
      break;
    }
    case 'foul':
    case 'freekick': {
      buildUp(play.kind === 'foul' ? 1 : 2);
      passTo(final, 'pass', play.kind === 'freekick' ? play.playerId : undefined);
      if (play.defenderId != null) {
        // Faulü yapan topun hemen yanında (kendi kalesi tarafında)
        const by = { x: final.x + (side === 'home' ? 1.8 : -1.8), y: final.y + 1.2 };
        lastFrame().placed.push({ id: play.defenderId, side: opp, at: by });
      }
      break;
    }
    case 'corner': {
      buildUp(1);
      passTo(at(side, 70 + h(3) * 8, final.y < MID_Y ? 12 : PITCH_WIDTH - 12));
      passTo(at(side, 92 + h(4) * 6, final.y < MID_Y ? 6 : PITCH_WIDTH - 6));
      // Top kornere gitti: kullanacak oyuncu bayrağa
      passTo(final, 'pass');
      break;
    }
    default: {
      // Şut: bloke, aut, kurtarış, kaçan penaltı, gol
      const origin = shotOrigin(play, minute)!;
      if (play.fromPenalty) {
        buildUp(1);
        passTo(at(side, 72 + h(5) * 8, 18 + h(6) * 32));
        passTo(at(side, 96, MID_Y - 6 + h(7) * 12));
        // Penaltı noktası: vurucu topun başında, diğerleri ceza sahası dışında
        frames.push({ ball: origin, carrierId: play.playerId, carrierSide: side, placed: [], move: 'none', clearBoxFor: side });
      } else {
        buildUp(2);
        if (play.assistId != null) {
          // Asist yapan, kendi yerinden (hücum bölgesine yakın) pası verir
          const approach = at(side, 78, origin.y);
          const spot = spotOf(match, side, play.assistId, approach);
          passTo(at(side, Math.max(70, progress(side, spot)), spot.y), 'pass', play.assistId);
        } else {
          passTo(at(side, 70 + h(8) * 10, 12 + h(9) * 44));
        }
        if (play.playerId !== null) used.delete(play.playerId);
        passTo(origin, 'pass', play.playerId);
      }
      const end: SceneFrame = { ball: final, carrierId: null, carrierSide: side, placed: [], move: 'shot', clearBoxFor: play.fromPenalty ? side : undefined };
      // Kaleci: kurtarışta / penaltıda topun başında; golde kale çizgisinde topa uzanmış ama yetişememiş
      if (play.keeperId != null && (play.kind === 'save' || play.kind === 'penalty' || play.kind === 'goal')) {
        const keeperAt = play.kind === 'goal'
          ? at(side, PITCH_LENGTH - 1.2, MID_Y + (final.y - MID_Y) * 0.5)
          : at(side, progress(side, final) - 1, final.y);
        end.placed.push({ id: play.keeperId, side: opp, at: keeperAt });
      }
      if (play.kind === 'blocked' && play.defenderId != null) end.placed.push({ id: play.defenderId, side: opp, at: final });
      frames.push(end);
    }
  }

  // Kart: kartı gören son karede topun yanında (sahadan atılsa da o an görünür)
  if (play.card) {
    const last = lastFrame();
    if (!last.placed.some((p) => p.id === play.card!.playerId)) {
      const cardSide = match.players[play.card.playerId]?.side ?? opp;
      last.placed.push({ id: play.card.playerId, side: cardSide, at: { x: last.ball.x + (cardSide === 'home' ? -1.8 : 1.8), y: last.ball.y - 1.4 } });
    }
  }
  return frames.slice(-5);
}

/**
 * Bir karede herkesin yeri: takım yerleşimi topa göre, topla buluşan oyuncu topun arkasında,
 * özel yerleşimler üstüne yazılır. Penaltıda ceza sahasındakiler çizginin dışına çıkar.
 */
export function frameSpots(match: MatchState, frame: SceneFrame, kickoff: boolean): Map<number, { side: Side; at: Point }> {
  const spots = new Map<number, { side: Side; at: Point }>();
  for (const side of ['home', 'away'] as const) {
    for (const [id, p] of teamSpots(match, side, frame.ball, kickoff)) {
      let point = p;
      if (frame.clearBoxFor && match.players[id]!.slot !== 'GK') {
        // Hücum edilen ceza sahası: hücum edenin ilerlemesine göre 88.5 m'den ötesi
        const a = progress(frame.clearBoxFor, point);
        if (a > PITCH_LENGTH - BOX_DEPTH - 1 && Math.abs(point.y - MID_Y) < BOX_HALF + 1) {
          point = at(frame.clearBoxFor, PITCH_LENGTH - BOX_DEPTH - 2.5, point.y);
        }
      }
      spots.set(id, { side, at: point });
    }
  }
  if (frame.carrierId !== null) {
    // Topun 1.6 m gerisinde (hücum yönüne göre)
    const back = frame.carrierSide === 'home' ? -1.6 : 1.6;
    spots.set(frame.carrierId, { side: frame.carrierSide, at: { x: frame.ball.x + back, y: frame.ball.y } });
  }
  for (const p of frame.placed) spots.set(p.id, { side: p.side, at: p.at });
  return spots;
}

/** Maç hızına göre gösterilecek kare sayısı: hızlı modda yalnızca son kare (zaman yetmez). */
export function framesForDuration(scene: readonly SceneFrame[], minuteMs: number): SceneFrame[] {
  if (minuteMs < 300) return scene.slice(-1);
  const count = clamp(Math.floor(minuteMs / 110), 2, 5);
  return scene.slice(-count);
}
