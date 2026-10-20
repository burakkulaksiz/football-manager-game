/**
 * 2D saha sahnesi (saf, testli): dakikanın anını (MatchState.lastPlay) 2–5 karelik kısa bir akışa çevirir.
 * Örn. şut: geriden pas → orta saha → asist → şut → sonuç. Her karede top hedefe en yakın takım
 * arkadaşına gider; motorun seçtiği gerçek oyuncular (asist, şutu çeken, kaleci, faul yapan) rollerini oynar.
 * Ara karelerin yerleri dakikaya bağlı sabit hash'ten gelir; son kare her zaman ballSpot ile aynıdır.
 */
import type { MatchPlay, MatchState, Side } from '../engine';
import { ballSpot, formationRoles, hash01, PITCH_LENGTH, PITCH_WIDTH, shotOrigin, teamSpots, type Point } from './pitch';

const MID_Y = PITCH_WIDTH / 2;

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
  /** Duran top dizilişi: `side` kullanan (hücum eden) taraf. */
  setPiece?: SetPiece;
}

export interface SetPiece {
  kind: 'corner' | 'freekick' | 'penalty';
  side: Side;
  /** Duran topun kullanıldığı yer: diziliş buna göre kurulur ve şut sonrasında da bozulmaz. */
  spot: Point;
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
  /** Son karede faulü yapan, topun hemen yanında (kendi kalesi tarafında). */
  const fouledHere = () => {
    if (play.defenderId == null) return;
    const ball = lastFrame().ball;
    lastFrame().placed.push({ id: play.defenderId, side: opp, at: { x: ball.x + (side === 'home' ? 1.8 : -1.8), y: ball.y + 1.2 } });
  };
  /** Duran top dizilişi karesi: top yerinde, kullanan başında (yoksa topa en yakın oyuncu). */
  const setUp = (ball: Point, taker: number | null, kind: SetPiece['kind']): SetPiece => {
    const setPiece: SetPiece = { kind, side, spot: ball };
    const id = taker ?? nearestTeammate(match, side, ball, used);
    if (id !== null) used.add(id);
    frames.push({ ball, carrierId: id, carrierSide: side, placed: [], move: 'none', setPiece });
    return setPiece;
  };

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
    case 'foul': {
      buildUp(1);
      passTo(final);
      fouledHere();
      break;
    }
    case 'freekick': {
      // Faul → serbest vuruş dizilişi (baraj); kullanan topun başında
      buildUp(2);
      passTo(final);
      fouledHere();
      setUp(final, play.playerId, 'freekick');
      break;
    }
    case 'corner': {
      buildUp(1);
      passTo(at(side, 70 + h(3) * 8, final.y < MID_Y ? 12 : PITCH_WIDTH - 12));
      passTo(at(side, 92 + h(4) * 6, final.y < MID_Y ? 6 : PITCH_WIDTH - 6));
      // Top kornere gitti: kullanacak oyuncu bayrağa, ceza sahası dolar
      setUp(final, null, 'corner');
      break;
    }
    default: {
      // Şut: bloke, aut, kurtarış, kaçan penaltı, gol
      const origin = shotOrigin(play, minute)!;
      let setPiece: SetPiece | undefined;
      if (play.fromPenalty) {
        buildUp(1);
        passTo(at(side, 72 + h(5) * 8, 18 + h(6) * 32));
        passTo(at(side, 96, MID_Y - 6 + h(7) * 12));
        fouledHere();
        // Penaltı noktası: vurucu topun başında, diğerleri ceza sahası dışında
        setPiece = setUp(origin, play.playerId, 'penalty');
      } else if (play.fromFreeKick) {
        buildUp(1);
        passTo(origin);
        fouledHere();
        setPiece = setUp(origin, play.playerId, 'freekick');
      } else if (play.fromCorner) {
        // Korner: bayraktan orta, kafayı vuran altıpas önünde
        buildUp(1);
        const flag = at(side, 104.6, origin.y < MID_Y ? 0.6 : PITCH_WIDTH - 0.6);
        setPiece = setUp(flag, null, 'corner');
        if (play.playerId !== null) used.delete(play.playerId);
        frames.push({ ball: origin, carrierId: play.playerId, carrierSide: side, placed: [], move: 'pass', setPiece });
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
      const end: SceneFrame = { ball: final, carrierId: null, carrierSide: side, placed: [], move: 'shot', setPiece };
      // Kaleci: kurtarışta / penaltıda topun başında; golde kale çizgisinde topa uzanmış ama yetişememiş
      if (play.keeperId != null && (play.kind === 'save' || play.kind === 'penalty' || play.kind === 'goal')) {
        const keeperAt = play.kind === 'goal'
          ? at(side, PITCH_LENGTH - 1.2, MID_Y + (final.y - MID_Y) * 0.5)
          : at(side, progress(side, final) - 1, final.y);
        end.placed.push({ id: play.keeperId, side: opp, at: keeperAt });
      }
      if (play.kind === 'blocked' && play.defenderId != null) end.placed.push({ id: play.defenderId, side: opp, at: final });
      // Duran topta şutu çeken vurduğu yerde kalır (diziliş onu başka yere koymasın)
      if (setPiece && play.playerId !== null) end.placed.push({ id: play.playerId, side, at: { x: origin.x + (side === 'home' ? -1.6 : 1.6), y: origin.y } });
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
 * Bir karede herkesin yeri: takım yerleşimi topa göre (duran topta kurulu diziliş), topla buluşan
 * oyuncu topun arkasında, özel yerleşimler üstüne yazılır.
 */
export function frameSpots(match: MatchState, frame: SceneFrame, kickoff: boolean): Map<number, { side: Side; at: Point }> {
  const spots = new Map<number, { side: Side; at: Point }>();
  for (const side of ['home', 'away'] as const) {
    for (const [id, p] of teamSpots(match, side, frame.ball, kickoff)) spots.set(id, { side, at: p });
  }
  if (frame.setPiece) {
    for (const [id, point] of setPieceSpots(match, frame.setPiece, frame.setPiece.spot, frame.carrierId)) {
      spots.set(id, { side: spots.get(id)?.side ?? frame.setPiece.side, at: point });
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

/** Korner: hücumcuların ceza sahasındaki yerleri (hücum yönünde a, y); yakın direk önce. */
const CORNER_TARGETS: readonly [number, number][] = [[99.5, 31], [99, 37.5], [96.5, 34], [94, 28.5], [94, 40], [91.5, 34], [89, 25]];
/** Serbest vuruş: hücumcular ceza sahası çizgisinde ve içinde. */
const FREE_KICK_TARGETS: readonly [number, number][] = [[89.5, 28], [89.5, 40], [92.5, 31.5], [92.5, 37], [95, 34], [88, 22]];
const WALL_DISTANCE = 9.15;
const WALL_SIZE = 4;

/**
 * Duran top dizilişi (kullanan hariç herkes): oyuncu id → yer.
 * Hücum eden takımın en geri iki oyuncusu ve savunanın en ileri oyuncusu orta sahada kalır.
 * Korner: hücumcular ceza sahasına, savunanlar onları markaja, biri yakın direğe.
 * Serbest vuruş: topa 9.15 m'de 4 kişilik baraj, hücumcular ceza sahası çizgisinde.
 * Penaltı: herkes ceza sahası dışında, çizgi boyunca.
 */
export function setPieceSpots(match: MatchState, sp: SetPiece, ball: Point, takerId: number | null): Map<number, Point> {
  const out = new Map<number, Point>();
  const s = sp.side;
  const d = other(s);
  const jitter = (id: number, salt: number) => (hash01(match.minute, id + salt) - 0.5) * 1.6;
  const place = (id: number, a: number, y: number) => out.set(id, at(s, a + jitter(id, 0.1), y + jitter(id, 0.2)));
  // Saha oyuncuları: hücum edende en geridekiler önce, savunanda en ilerdekiler önce
  const attackers = formationRoles(match, s).filter((r) => r.slot !== 'GK' && r.id !== takerId).sort((a, b) => b.ly - a.ly);
  const defenders = formationRoles(match, d).filter((r) => r.slot !== 'GK').sort((a, b) => a.ly - b.ly);
  const keeper = formationRoles(match, d).find((r) => r.slot === 'GK');
  const [stayUp, ...restDefenders] = defenders;
  if (stayUp) place(stayUp.id, 62, MID_Y);
  attackers.slice(0, 2).forEach((r, i) => place(r.id, 52 + i * 5, 20 + i * 28));
  const forward = attackers.slice(2);
  /** Savunmacı, markaj yaptığı hücumcunun kale tarafında. */
  const mark = (defenderId: number, attackerId: number | undefined) => {
    const target = attackerId !== undefined ? out.get(attackerId) : undefined;
    if (!target) return false;
    // Noktalar üst üste binmesin: kale tarafında ~2.6 m
    out.set(defenderId, { x: target.x + (s === 'home' ? 2.2 : -2.2), y: target.y + 1.3 });
    return true;
  };

  if (sp.kind === 'penalty') {
    // Ceza sahası çizgisi ve yay çevresinde, kenarlara doğru dağınık iki sıra (ceza sahası 88.5 m'de başlar)
    [...forward, ...restDefenders].forEach((r, i) => {
      const row = Math.floor(i / 8);
      const k = i % 8;
      const offset = (k % 2 === 0 ? 1 : -1) * (3 + Math.floor(k / 2) * 4.6) + (row ? 2.3 : 0);
      out.set(r.id, at(s, 86.4 - row * 5 - (k % 3) * 1.1 + jitter(r.id, 0.3), MID_Y + offset));
    });
    if (keeper) out.set(keeper.id, at(s, 104.6, MID_Y));
    return out;
  }

  if (sp.kind === 'corner') {
    // Alt köşeden kullanılıyorsa hedefler aynalanır (yakın direk köşe tarafında kalsın)
    const fy = (y: number) => (ball.y > MID_Y ? PITCH_WIDTH - y : y);
    forward.forEach((r, i) => {
      const [a, y] = CORNER_TARGETS[i % CORNER_TARGETS.length]!;
      place(r.id, a, fy(y));
    });
    const [post, ...markers] = restDefenders;
    if (post) out.set(post.id, at(s, 104, fy(MID_Y - 3.4)));
    markers.forEach((r, i) => {
      if (!mark(r.id, forward[i]?.id)) place(r.id, 100, fy(30 + (i % 3) * 4));
    });
    if (keeper) out.set(keeper.id, at(s, 104.2, fy(MID_Y - 1)));
    return out;
  }

  // Serbest vuruş: baraj top ile kale ortası arasındaki çizgide
  const goal = at(s, PITCH_LENGTH, MID_Y);
  const len = Math.hypot(goal.x - ball.x, goal.y - ball.y) || 1;
  const ux = (goal.x - ball.x) / len;
  const uy = (goal.y - ball.y) / len;
  const wall = { x: ball.x + ux * WALL_DISTANCE, y: ball.y + uy * WALL_DISTANCE };
  restDefenders.slice(0, WALL_SIZE).forEach((r, i) => {
    // Noktalar insandan iri çizildiği için baraj aralığı gerçekten geniş (üst üste binmesin)
    const k = (i - (WALL_SIZE - 1) / 2) * 2.3;
    out.set(r.id, { x: wall.x - uy * k, y: wall.y + ux * k });
  });
  forward.forEach((r, i) => {
    const [a, y] = FREE_KICK_TARGETS[i % FREE_KICK_TARGETS.length]!;
    place(r.id, a, y);
  });
  restDefenders.slice(WALL_SIZE).forEach((r, i) => {
    if (!mark(r.id, forward[i]?.id)) place(r.id, 97, 30 + i * 4);
  });
  if (keeper) out.set(keeper.id, at(s, 104.3, MID_Y + (ball.y - MID_Y) * 0.15));
  return out;
}

/** Maç hızına göre gösterilecek kare sayısı: hızlı modda yalnızca son kare (zaman yetmez). */
export function framesForDuration(scene: readonly SceneFrame[], minuteMs: number): SceneFrame[] {
  if (minuteMs < 300) return scene.slice(-1);
  const count = clamp(Math.floor(minuteMs / 110), 2, 5);
  return scene.slice(-count);
}
