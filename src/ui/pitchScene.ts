/**
 * 2D saha sahnesi (saf, testli): dakikanın anını (MatchState.lastPlay) 2–5 karelik kısa bir akışa çevirir.
 * Örn. şut: geriden pas → orta saha → asist → şut → sonuç. Her karede top hedefe en yakın takım
 * arkadaşına gider; motorun seçtiği gerçek oyuncular (asist, şutu çeken, kaleci, faul yapan) rollerini oynar.
 * Ara karelerin yerleri dakikaya bağlı sabit hash'ten gelir; son kare her zaman ballSpot ile aynıdır.
 */
import type { MatchPlay, MatchState, PlaySub, Side } from '../engine';
import { ballSpot, formationRoles, hash01, PITCH_LENGTH, PITCH_WIDTH, shotOrigin, teamShape, teamSpots, type Point } from './pitch';

const MID_Y = PITCH_WIDTH / 2;

/** Topun bu kareye gelişi: yerden pas, havadan uzun pas, orta, oyuncuyla top sürme, şut. */
export type FrameMove = 'none' | 'pass' | 'lob' | 'cross' | 'dribble' | 'shot';

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
  /** Top bu kareye nasıl geldi (çizgi stili, hız). */
  move: FrameMove;
  /** Topun yolunun yana kavisi (falso), metre; işaret yönü verir. */
  curl?: number;
  /** Topun yolda çıktığı en yüksek nokta (metre); yoksa yerden. */
  height?: number;
  /** Duran top dizilişi: `side` kullanan (hücum eden) taraf. */
  setPiece?: SetPiece;
  /** Sakatlanan oyuncu (yerde, işaretli). */
  injuredId?: number;
  /** Anın sonucu bu karede (etiket ve skor burada açıklanır; sonrası gol sevinci). */
  result?: boolean;
  /** Adı gösterilip vurgulanan oyuncu (yeri değişmez; ör. sevinçte golcü). */
  focusId?: number;
  /** Santra dizilişi (gol sonrası). */
  kickoff?: boolean;
  /** Oyuncu değişikliği karesi: girenin ve çıkanın adı ve oku gösterilir. */
  subs?: PlaySub[];
  /** Değişiklikten önceki karelerde girenin yerinde çıkan oyuncu görünür: [giren, çıkan]. */
  standIns?: [number, number][];
}

export interface SetPiece {
  kind: 'corner' | 'freekick' | 'penalty';
  side: Side;
  /** Duran topun kullanıldığı yer: diziliş buna göre kurulur ve şut sonrasında da bozulmaz. */
  spot: Point;
  /** Kullanan: dizilişin dışında, vuruştan sonra da topun başında kalır (diziliş kareden kareye karışmasın). */
  takerId: number | null;
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
  for (const [id, p] of teamSpots(match, side, target, false, side)) {
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
  return teamSpots(match, side, ball, false, side).get(id) ?? ball;
}

/**
 * Dakikanın sahnesi. Maç başlamadıysa / aradaysa tek kare (orta nokta).
 */
export function buildScene(match: MatchState, play: MatchPlay | null, minute: number): SceneFrame[] {
  if (!play) return [{ ball: ballSpot(null, minute), carrierId: null, carrierSide: 'home', placed: [], move: 'none' }];
  const subs = play.subs ?? [];
  const early = subs.filter((s) => s.early);
  const late = subs.filter((s) => !s.early);
  // Yalnızca değişiklik olan sakin dakika: oyun durur, değişiklik yapılır
  if (!playHighlight(play) && subs.length > 0) {
    const pause: SceneFrame = { ball: ballSpot(play, minute), carrierId: null, carrierSide: play.side, placed: [], move: 'none' };
    const frames = substitutionFrames(match, subs, pause);
    frames[0]!.result = true;
    return frames;
  }
  const core = playFrames(match, play, minute);
  const result = core[core.length - 1]!;
  const scene = [...core];
  if (play.card?.type === 'red') scene.push(sendOff(result, play.card.playerId, match.players[play.card.playerId]?.side ?? other(play.side)));
  if (play.kind === 'goal') scene.push(...celebration(match, play, result));
  if (late.length > 0) {
    // Dakikanın sonundaki değişiklik: o ana kadar çıkan oyuncu sahada (girenin yerinde)
    const swap = new Map(late.map((s) => [s.inId, s.outId]));
    for (const f of scene) {
      f.standIns = late.map((s) => [s.inId, s.outId]);
      if (f.carrierId !== null) f.carrierId = swap.get(f.carrierId) ?? f.carrierId;
      f.placed = f.placed.map((p) => ({ ...p, id: swap.get(p.id) ?? p.id }));
    }
    scene.push(...substitutionFrames(match, late, scene[scene.length - 1]!));
  }
  if (early.length > 0) scene.unshift(...substitutionFrames(match, early, core[0]!));
  return scene;
}

/** Değişiklikte oyuncuların girip çıktığı yer: orta çizginin hizasında, alt kenarın hemen dışı (yedek kulübesi). */
const BENCH_Y = PITCH_WIDTH + 0.6;
const BENCH_X = PITCH_LENGTH / 2;

/** Kırmızı kart: atılan oyuncu yedek kulübesinin önünden sahayı terk eder. */
function sendOff(result: SceneFrame, playerId: number, side: Side): SceneFrame {
  return {
    ...result,
    result: undefined,
    move: 'none',
    placed: [...result.placed.filter((p) => p.id !== playerId), { id: playerId, side, at: { x: BENCH_X, y: BENCH_Y } }],
  };
}

/**
 * Oyuncu değişikliği (3 kare): çıkan oyuncu yerinden kenara yürür, giren kenarda bekler →
 * kenarda el sıkışırlar, giren sahaya koşar → giren yerinde, çıkan sahadan ayrılmış.
 * `base`: oyunun durduğu kare (top ve diziliş buna göre).
 */
function substitutionFrames(match: MatchState, subs: readonly PlaySub[], base: SceneFrame): SceneFrame[] {
  const still: SceneFrame = {
    ball: base.ball,
    carrierId: base.kickoff ? base.carrierId : null,
    carrierSide: base.carrierSide,
    placed: [],
    move: 'none',
    kickoff: base.kickoff,
    setPiece: base.setPiece,
    subs: [...subs],
  };
  const field = frameSpots(match, still, false);
  const toward = (from: Point, to: Point, t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  const walk: SceneFrame = { ...still, placed: [] };
  const swap: SceneFrame = { ...still, placed: [] };
  const enter: SceneFrame = { ...still, placed: [] };
  subs.forEach((s, i) => {
    // Aynı anda birden çok değişiklik: kenar boyunca yan yana
    const x = BENCH_X + (i - (subs.length - 1) / 2) * 6;
    const outAt = { x: x - 1.5, y: BENCH_Y };
    const inAt = { x: x + 1.5, y: BENCH_Y };
    // Girenin sahadaki yeri, çıkanın oynadığı yerdir
    const spot = field.get(s.inId)?.at ?? { x, y: PITCH_WIDTH - 6 };
    walk.placed.push({ id: s.outId, side: s.side, at: toward(spot, outAt, 0.5) }, { id: s.inId, side: s.side, at: inAt });
    swap.placed.push({ id: s.outId, side: s.side, at: outAt }, { id: s.inId, side: s.side, at: toward(inAt, spot, 0.35) });
  });
  return [walk, swap, enter];
}

/** Dakikanın anının kareleri (değişiklik ve gol sevinci hariç); son kare sonuç karesi. */
function playFrames(match: MatchState, play: MatchPlay, minute: number): SceneFrame[] {
  const side = play.side;
  const opp = other(side);
  const h = (salt: number) => hash01(minute, salt + 10);
  const final = ballSpot(play, minute);
  const frames: SceneFrame[] = [];
  const used = new Set<number>();
  // Pas koridoru: geniş oynayan takım kanatları, dar oynayan ortayı kullanır
  const spread = teamShape(match[side].instructions).spread;
  const lane = (y: number) => MID_Y + (y - MID_Y) * spread;

  /** Hedefe pas: en yakın takım arkadaşı topla buluşur (aynı oyuncu art arda iki kez almaz). */
  const passTo = (target: Point, move: FrameMove = 'pass', carrier?: number | null) => {
    const id = carrier ?? nearestTeammate(match, side, target, used);
    if (id !== null) used.add(id);
    frames.push({ ball: target, carrierId: id, carrierSide: side, placed: [], move: frames.length === 0 ? 'none' : move });
  };
  const lastFrame = () => frames[frames.length - 1]!;
  /**
   * Topu alan oyuncu bir süre topla ilerler (yaklaşık yarı yarıya): hücum yönünde `min`–`max` metre, hafif yana kayarak;
   * en fazla `limit` metreye kadar (ceza sahasına girmeden).
   */
  const dribble = (salt: number, min: number, max: number, limit: number, chance = 0.55) => {
    const from = lastFrame();
    if (from.carrierId === null || h(salt) > chance) return;
    const a = Math.min(limit, progress(side, from.ball) + min + h(salt + 0.5) * (max - min));
    if (a <= progress(side, from.ball) + 2) return;
    const y = from.ball.y + (h(salt + 0.7) - 0.5) * 10;
    frames.push({ ball: at(side, a, y), carrierId: from.carrierId, carrierSide: side, placed: [], move: 'dribble' });
  };
  /** Oyun kurma: kendi yarısından ileriye 1–2 pas; arada top sürme. */
  const buildUp = (count: number) => {
    const starts = [24 + h(1) * 14, 44 + h(2) * 16];
    for (const a of starts.slice(2 - count)) {
      passTo(at(side, a, lane(10 + h(a) * 48)));
      dribble(a, 6, 14, 66);
    }
  };
  /** Son karede faulü yapan, topun hemen yanında (kendi kalesi tarafında). */
  const fouledHere = () => {
    if (play.defenderId == null) return;
    const ball = lastFrame().ball;
    lastFrame().placed.push({ id: play.defenderId, side: opp, at: { x: ball.x + (side === 'home' ? 1.8 : -1.8), y: ball.y + 1.2 } });
  };
  /** Duran top dizilişi karesi: top yerinde, kullanan başında (yoksa topa en yakın oyuncu). */
  const setUp = (ball: Point, taker: number | null, kind: SetPiece['kind']): SetPiece => {
    const id = taker ?? nearestTeammate(match, side, ball, used);
    if (id !== null) used.add(id);
    const setPiece: SetPiece = { kind, side, spot: ball, takerId: id };
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
        // Kafayı vuran korneri kullanamaz (bayraktan altıpasa ışınlanmasın)
        if (play.playerId !== null) used.add(play.playerId);
        setPiece = setUp(flag, null, 'corner');
        if (play.playerId !== null) used.delete(play.playerId);
        frames.push({ ball: origin, carrierId: play.playerId, carrierSide: side, placed: [], move: 'pass', setPiece });
      } else {
        buildUp(2);
        if (play.assistId != null) {
          // Asist yapan, kendi yerinden (hücum bölgesine yakın) pası alır, biraz sürüp asisti verir
          const approach = at(side, 78, origin.y);
          const spot = spotOf(match, side, play.assistId, approach);
          passTo(at(side, Math.max(68, progress(side, spot) - 6), spot.y), 'pass', play.assistId);
          dribble(11, 5, 10, 92, 0.6);
        } else {
          passTo(at(side, 70 + h(8) * 10, lane(12 + h(9) * 44)));
        }
        if (play.playerId !== null) used.delete(play.playerId);
        // Şutu çeken bazen topu biraz geride alır ve şut yerine kadar sürer
        if (h(12) < 0.4 && progress(side, origin) > 80) {
          passTo(at(side, progress(side, origin) - 5 - h(13) * 4, origin.y + (h(14) - 0.5) * 8), 'pass', play.playerId);
          frames.push({ ball: origin, carrierId: lastFrame().carrierId, carrierSide: side, placed: [], move: 'dribble' });
        } else {
          passTo(origin, 'pass', play.playerId);
        }
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
      // Şutu çeken vurduğu yerde kalır (diziliş onu top kaleye giderken tek başına yerine koşturmasın)
      if (play.playerId !== null) end.placed.push({ id: play.playerId, side, at: { x: origin.x + (side === 'home' ? -1.6 : 1.6), y: origin.y } });
      frames.push(end);
    }
  }

  // Kart: sahadan atılan, son karede topun yanında görünür; sahadaki kendi yerinde kalır (kart dakikanın önceki
  // faulünden şuta taşınmış olabilir: top kaleye giderken tek başına yarım saha koşmasın)
  if (play.card) {
    const last = lastFrame();
    const cardSide = match.players[play.card.playerId]?.side ?? opp;
    if (!match[cardSide].onPitch.includes(play.card.playerId) && !last.placed.some((p) => p.id === play.card!.playerId)) {
      last.placed.push({ id: play.card.playerId, side: cardSide, at: { x: last.ball.x + (cardSide === 'home' ? -1.8 : 1.8), y: last.ball.y - 1.4 } });
    }
  }
  // Sakatlık: son karede oyuncu yerde (değişiklikle çıkmış olsa da o an görünür)
  if (play.injuredId !== undefined) {
    const last = lastFrame();
    last.injuredId = play.injuredId;
    const injuredSide = match.players[play.injuredId]?.side ?? side;
    if (!match[injuredSide].onPitch.includes(play.injuredId) && !last.placed.some((p) => p.id === play.injuredId)) {
      last.placed.push({ id: play.injuredId, side: injuredSide, at: { x: last.ball.x + (injuredSide === 'home' ? -3 : 3), y: last.ball.y + 2 } });
    }
  }
  const core = frames.slice(-MAX_PLAY_FRAMES);
  core[0]!.move = 'none';
  core[core.length - 1]!.result = true;
  shapeBallPaths(core, play, minute);
  return core;
}

/** Bir anın en fazla karesi (sonuç dahil; sevinç ve değişiklik ayrı). */
export const MAX_PLAY_FRAMES = 8;

/**
 * Topun yolu: uzun paslar havadan, kanattan ceza sahasına gelen paslar orta, korner ortası yüksek ve kavisli;
 * şutlarda serbest vuruş falsolu ve barajın üstünden, uzaktan şut biraz havadan. Dakikaya bağlı sabit.
 */
function shapeBallPaths(frames: SceneFrame[], play: MatchPlay, minute: number): void {
  const side = play.side;
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i]!;
    const from = frames[i - 1]!.ball;
    const h = (salt: number) => hash01(minute, 40 + i * 3 + salt);
    const sign = h(0) < 0.5 ? -1 : 1;
    const distance = Math.hypot(f.ball.x - from.x, f.ball.y - from.y);
    if (f.move === 'pass') {
      const intoBox = progress(side, f.ball) > 84 && Math.abs(f.ball.y - MID_Y) < 22;
      if (frames[i - 1]!.setPiece?.kind === 'corner' && intoBox) {
        f.move = 'cross';
        f.height = 6.5 + h(1) * 2;
        f.curl = sign * (3 + h(2) * 2.5);
      } else if (intoBox && Math.abs(from.y - MID_Y) > 16) {
        f.move = 'cross';
        f.height = 4 + h(1) * 3.5;
        f.curl = sign * (1.5 + h(2) * 2.5);
      } else if (distance > 30) {
        f.move = 'lob';
        f.height = 3 + h(1) * 3.5;
        f.curl = sign * h(2) * 1.6;
      } else {
        f.curl = sign * h(2) * 0.9;
      }
    } else if (f.move === 'shot') {
      const kind = frames[i - 1]!.setPiece?.kind;
      if (kind === 'freekick') {
        f.height = 2.2 + h(1) * 1.2;
        f.curl = sign * (3.5 + h(2) * 2.5);
      } else if (kind === 'penalty') {
        f.height = h(1) * 0.8;
      } else if (play.fromCorner) {
        f.height = 0.4;
      } else if (play.kind === 'miss' && h(3) < 0.45) {
        // Üstten auta
        f.height = 2.6 + h(1) * 1.2;
        f.curl = sign * h(2) * 1.5;
      } else {
        f.height = (distance > 18 ? 0.8 : 0.2) + h(1) * (distance > 18 ? 1.6 : 0.6);
        f.curl = sign * h(2) * (distance > 18 ? 2.6 : 1.2);
      }
    }
  }
}

/**
 * Gol sevinci (gol karesinden sonra): golcü yakın köşe bayrağına koşar, takım arkadaşları ona doğru;
 * sonra golcünün etrafında toplanırlar, rakip kaleci topu ağlardan alır; en son santra dizilişi.
 */
function celebration(match: MatchState, play: MatchPlay, goalFrame: SceneFrame): SceneFrame[] {
  const side = play.side;
  const opp = other(side);
  const base = frameSpots(match, goalFrame, false);
  const ball = goalFrame.ball;
  const scorer = play.playerId;
  // Golün atıldığı taraftaki köşe bayrağının biraz içi
  const flag = at(side, 101, ball.y < MID_Y ? 5 : PITCH_WIDTH - 5);
  const teammates = [...base].filter(([id, p]) => p.side === side && id !== scorer && match.players[id]?.slot !== 'GK');
  const toward = (from: Point, to: Point, t: number): Point => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });

  const run: SceneFrame = { ball, carrierId: null, carrierSide: side, placed: [], move: 'none', focusId: scorer ?? undefined };
  const huddle: SceneFrame = { ball, carrierId: null, carrierSide: side, placed: [], move: 'none', focusId: scorer ?? undefined };
  if (scorer !== null) {
    run.placed.push({ id: scorer, side, at: flag });
    huddle.placed.push({ id: scorer, side, at: flag });
  }
  teammates.forEach(([id, p], i) => {
    // İlk karede yolun yarısı; ikinci karede golcünün çevresinde halka (geride kalan stoperler biraz uzakta)
    run.placed.push({ id, side, at: toward(p.at, flag, 0.55) });
    const angle = (i / Math.max(1, teammates.length)) * Math.PI * 2 + hash01(match.minute, id) * 0.4;
    const radius = 2.6 + (i % 3) * 1.1;
    huddle.placed.push({ id, side, at: { x: flag.x + Math.cos(angle) * radius, y: clamp(flag.y + Math.sin(angle) * radius, 1, PITCH_WIDTH - 1) } });
  });
  // Rakip kaleci topu ağlardan alır
  const keeper = [...base].find(([id, p]) => p.side === opp && match.players[id]?.slot === 'GK');
  if (keeper) huddle.placed.push({ id: keeper[0], side: opp, at: { x: ball.x + (side === 'home' ? -1.2 : 1.2), y: ball.y } });
  // Santra: gol yiyen takım başlar
  const center = { x: PITCH_LENGTH / 2, y: MID_Y };
  const taker = match[opp].onPitch.find((id) => match.players[id]?.slot === 'ST') ?? nearestTeammate(match, opp, center, new Set());
  const kickoffFrame: SceneFrame = { ball: center, carrierId: taker, carrierSide: opp, placed: [], move: 'none', kickoff: true };
  return [run, huddle, kickoffFrame];
}

/** Sonucun açıklandığı karenin sırası (etiket, skor ve anlatım burada güncellenir). */
export function revealIndex(scene: readonly SceneFrame[]): number {
  const i = scene.findIndex((f) => f.result);
  return i === -1 ? scene.length - 1 : i;
}

/* ------------------------------------------------------------------ */
/* Önemli anlar ve zamanlama                                            */
/* ------------------------------------------------------------------ */

/** Sahnenin sıradan bir karesi (ms): yavaş, izlenebilir akış. */
export const SCENE_FRAME_MS = 750;
/** Son kare (etiketiyle) ekranda kalma süresi (ms). */
export const SCENE_HOLD_MS = 1500;
/** Sahne başında oyuncuların ilk kareye süzülmesi / belirmesi (ms). */
export const LEAD_IN_MS = 400;

/** Topun bu kareye gelme süresi, hareketine göre: şut hızlı, orta / uzun pas / top sürme daha uzun. */
const MOVE_MS: Record<FrameMove, number> = { none: 700, pass: 750, lob: 950, cross: 1000, dribble: 950, shot: 520 };

/** Önceki kareden bu kareye geçiş süresi (ms). */
export function frameDurationMs(frame: SceneFrame): number {
  if (frame.subs) return SCENE_FRAME_MS;
  // Gol sevinci koşusu ve santra dizilişi yürüyerek
  if (frame.focusId !== undefined || frame.kickoff) return 900;
  return MOVE_MS[frame.move];
}

/** Her kareye varılan an (ms, sahne başından): ilk kare girişten sonra. */
export function frameStartsMs(scene: readonly SceneFrame[]): number[] {
  const starts: number[] = [];
  scene.forEach((f, i) => starts.push(i === 0 ? LEAD_IN_MS : starts[i - 1]! + frameDurationMs(f)));
  return starts;
}

/** Sonuç karesine (etiket, skor, anlatım) varılan an (ms). */
export function revealDelayMs(scene: readonly SceneFrame[]): number {
  return frameStartsMs(scene)[revealIndex(scene)] ?? 0;
}
/** Sakin dakikanın süresi (ms). */
export const QUIET_MINUTE_MS = 1000;

const HIGHLIGHT_KINDS: ReadonlySet<MatchPlay['kind']> = new Set(['goal', 'save', 'miss', 'blocked', 'penalty', 'corner', 'freekick']);

/** Anın kendisi önemli mi: şutlar, gol, penaltı, korner, serbest vuruş, kart, sakatlık. */
function playHighlight(play: MatchPlay): boolean {
  return HIGHLIGHT_KINDS.has(play.kind) || play.card !== undefined || play.injuredId !== undefined;
}

/**
 * 2D sahada gösterilen önemli an mı: şutlar, gol, penaltı, korner, serbest vuruş, kart, sakatlık,
 * oyuncu değişikliği. Kartsız orta saha faulleri ve şutsuz ataklar sakin dakika sayılır.
 */
export function isHighlight(play: MatchPlay | null): boolean {
  if (!play) return false;
  return playHighlight(play) || (play.subs?.length ?? 0) > 0;
}

const KIND_LABELS: Partial<Record<MatchPlay['kind'], string>> = {
  goal: 'GOL!',
  save: 'Kurtarış',
  miss: 'Dışarı',
  blocked: 'Bloke',
  corner: 'Korner',
  freekick: 'Serbest vuruş',
  penalty: 'Penaltı kaçtı',
};

/** Sahanın üstündeki etiket: anın türü; yoksa kart, sakatlık ya da oyuncu değişikliği. */
export function playLabel(play: MatchPlay | null): string | undefined {
  if (!play) return undefined;
  if (play.kind === 'goal' && play.fromPenalty) return 'GOL! (Penaltı)';
  const kind = KIND_LABELS[play.kind];
  if (kind) return kind;
  if (play.card) return play.card.type === 'red' ? 'Kırmızı kart' : 'Sarı kart';
  if (play.injuredId !== undefined) return 'Sakatlık';
  if (play.subs?.length) return 'Oyuncu değişikliği';
  return undefined;
}

/** Sahanın ortasındaki büyük bant: gol, verilen penaltı, kaçan penaltı, kırmızı kart. */
export type BannerKind = 'goal' | 'penalty' | 'penaltyMiss' | 'red';

/**
 * O karede gösterilecek büyük bant (yoksa null). Penaltı kararı penaltı dizilişi karesinden sonuca kadar;
 * gol, kaçan penaltı ve kırmızı kart sonuç karesinden itibaren (golde sevinç boyunca).
 */
export function bannerKind(play: MatchPlay | null, scene: readonly SceneFrame[], index: number, revealed: boolean): BannerKind | null {
  if (!play) return null;
  if (revealed) {
    if (play.kind === 'goal') return scene[index]?.kickoff ? null : 'goal';
    if (play.kind === 'penalty') return 'penaltyMiss';
    if (play.card?.type === 'red') return 'red';
    return null;
  }
  return scene[index]?.setPiece?.kind === 'penalty' ? 'penalty' : null;
}

/** Önemli anın sahada süreceği zaman: giriş + kareler + son karede bekleme. */
export function sceneDurationMs(scene: readonly SceneFrame[]): number {
  return (frameStartsMs(scene).at(-1) ?? 0) + SCENE_HOLD_MS;
}

/**
 * Bir karede herkesin yeri: takım yerleşimi topa göre (duran topta kurulu diziliş), topla buluşan
 * oyuncu topun arkasında, özel yerleşimler üstüne yazılır.
 */
export function frameSpots(match: MatchState, frame: SceneFrame, kickoff: boolean): Map<number, { side: Side; at: Point }> {
  const spots = new Map<number, { side: Side; at: Point }>();
  for (const side of ['home', 'away'] as const) {
    for (const [id, p] of teamSpots(match, side, frame.ball, kickoff || frame.kickoff === true, frame.carrierSide)) spots.set(id, { side, at: p });
  }
  if (frame.setPiece) {
    const sp = frame.setPiece;
    // Kullanan her karede aynı: topu kim taşırsa taşısın diziliş karışmaz
    for (const [id, point] of setPieceSpots(match, sp, sp.spot, sp.takerId)) {
      spots.set(id, { side: spots.get(id)?.side ?? sp.side, at: point });
    }
    if (sp.takerId !== null) spots.set(sp.takerId, { side: sp.side, at: { x: sp.spot.x + (sp.side === 'home' ? -1.6 : 1.6), y: sp.spot.y } });
  }
  // Değişiklikten önce: girenin yerinde (duran top dizilişi dahil) çıkan oyuncu
  for (const [inId, outId] of frame.standIns ?? []) {
    const spot = spots.get(inId);
    if (!spot) continue;
    spots.delete(inId);
    spots.set(outId, spot);
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

