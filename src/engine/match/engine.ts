/**
 * Dakika dakika maç motoru.
 *
 * Her dakika:
 *  1. Orta saha gücüne göre topun hangi takımda olduğu seçilir (topla oynama).
 *  2. Topa sahip takım belli olasılıkla atak kurar; atak gücü / rakip savunma oranı
 *     atağın şuta dönüşme olasılığını belirler.
 *  3. Şut: şutçu (mevki + bitiricilik), şut türü (normal/kafa/uzaktan), isabet ve
 *     kaleciye karşı gol olasılığı oyuncu özelliklerinden hesaplanır.
 *  4. Bağımsız olarak faul / kart / penaltı / serbest vuruş ve sakatlık kontrol edilir.
 *  5. Yorgunluk işler, yapay zekâ mentalite ve oyuncu değişikliği kararları verir.
 *
 * Oyuncunun verimi = mevki uyumu × kondisyon × moral × form × günlük form.
 * Denge sabitleri TUNING içinde; istatistik testi (engine.test.ts) hedefleri doğrular.
 */
import type { Attributes } from '../attributes';
import { Rng } from '../rng';
import type { GoalKind, MatchResult, Player, PlayerMatchRecord, Position, ShotOutcome, ShotRecord, TeamMatchStats } from '../types';
import { commentary, type CommentaryKey } from './commentary';
import {
  AI_FORMATION_IDS,
  assignToFormation,
  DEFAULT_FORMATION_ID,
  FORMATIONS,
  formationName,
  slotFit,
  slotsOf,
  type CustomFormation,
  type FormationId,
  type Lineup,
} from './formation';
import {
  displayMinute,
  MAX_SUBS,
  MOMENTUM_WINDOW,
  playCode,
  type MatchEventType,
  type MatchState,
  type Mentality,
  type PlayerMatchState,
  type MatchPlay,
  type PlayKind,
  type Shootout,
  type Side,
  type TeamState,
} from './state';
import {
  DEFAULT_INSTRUCTIONS,
  instructionEffects,
  isDefaultOrders,
  NEUTRAL_EFFECTS,
  orderCreating,
  orderShooting,
  orderWeights,
  type InstructionEffects,
  type PlayerOrders,
  type TeamInstructions,
  type TeamProfile,
} from './tactics';

export type PlayerLookup = Record<number, Player>;

/** Denge sabitleri. Değiştirince `npm test` ile skor dağılımı testine bak. */
export const TUNING = {
  /** Topa sahip takımın o dakika atak kurma olasılığı. */
  attackChance: 0.42,
  /** Güçler eşitken atağın şuta dönüşme olasılığı. */
  shotChance: 0.5,
  /** Atak/savunma oranının şut olasılığına etkisi (üs). */
  threatExponent: 1.2,
  /** Orta saha gücü oranının top hakimiyetine etkisi (üs). */
  possessionExponent: 1.5,
  /** Şutun rakip oyuncuya çarpma olasılığı. */
  blockChance: 0.22,
  onTargetBase: 0.5,
  goalBase: 0.31,
  /** Vuruş yeteneği / kaleci oranının gol olasılığına etkisi (üs). Büyükse iyi golcüler çok fazla atar. */
  finishingExponent: 0.8,
  /** İç saha avantajı: hücum ve orta saha çarpanları. */
  homeAttack: 1.2,
  homeMidfield: 1.05,
  /** Dakika başına faul olasılığı (iki takım toplam). */
  foulChance: 0.24,
  /** Takım başına dakikalık sakatlanma olasılığı (ortalama sakatlık eğilimi için). */
  injuryChance: 0.0018,
  cornerShotChance: 0.28,
  /** Şuta dönüşmeyen atağın kornerle bitme olasılığı. */
  cornerFromAttack: 0.3,
  directRedChance: 0.004,
  /** Savunan takımın faulünün penaltı olma olasılığı. */
  penaltyChance: 0.024,
};

/* ------------------------------------------------------------------ */
/* Oyuncu ve takım güçleri                                             */
/* ------------------------------------------------------------------ */

/** Mevki başına hücum / orta saha / savunma katkı ağırlıkları. */
const SLOT_WEIGHTS: Record<Position, { att: number; mid: number; def: number }> = {
  GK: { att: 0, mid: 0, def: 0 },
  DC: { att: 0.05, mid: 0.2, def: 1 },
  DR: { att: 0.15, mid: 0.35, def: 0.85 },
  DL: { att: 0.15, mid: 0.35, def: 0.85 },
  WBR: { att: 0.35, mid: 0.5, def: 0.6 },
  WBL: { att: 0.35, mid: 0.5, def: 0.6 },
  DM: { att: 0.15, mid: 0.9, def: 0.65 },
  MC: { att: 0.35, mid: 1, def: 0.35 },
  MR: { att: 0.5, mid: 0.8, def: 0.3 },
  ML: { att: 0.5, mid: 0.8, def: 0.3 },
  AMC: { att: 0.8, mid: 0.7, def: 0.1 },
  AMR: { att: 0.85, mid: 0.5, def: 0.15 },
  AML: { att: 0.85, mid: 0.5, def: 0.15 },
  ST: { att: 1, mid: 0.25, def: 0.05 },
};

const attackScore = (a: Attributes) =>
  (a.finishing * 1.5 + a.offTheBall + a.dribbling + a.pace * 0.7 + a.technique + a.composure +
    a.firstTouch * 0.8 + a.creativity * 0.7) / 7.7;

const midfieldScore = (a: Attributes) =>
  (a.passing * 1.4 + a.decisions + a.teamwork + a.workRate * 0.8 + a.technique * 0.8 +
    a.firstTouch * 0.8 + a.creativity + a.anticipation * 0.7 + a.stamina * 0.5) / 7.8;

const defenceScore = (a: Attributes) =>
  (a.marking * 1.3 + a.tackling * 1.3 + a.positioning * 1.2 + a.heading * 0.7 + a.anticipation +
    a.concentration + a.strength * 0.6 + a.pace * 0.6 + a.bravery * 0.4) / 8.1;

const keeperScore = (a: Attributes) =>
  (a.handling * 1.2 + a.reflexes * 1.4 + a.oneOnOnes + a.positioning + a.aerialAbility * 0.7 +
    a.commandOfArea * 0.7 + a.concentration * 0.6 + a.agility * 0.6) / 7.2;

/** Son maç puanlarına göre küçük form çarpanı. */
function formFactor(p: Player): number {
  if (p.form.length === 0) return 1;
  const avg = p.form.reduce((s, r) => s + r, 0) / p.form.length;
  return 1 + Math.max(-0.04, Math.min(0.04, (avg - 6.7) * 0.02));
}

/** Oyuncunun o anki verimi (çarpan, ~0.2–1.15). */
function efficiency(ps: PlayerMatchState, p: Player): number {
  if (ps.slot === null) return 0;
  return (
    slotFit(p, ps.slot) *
    (0.72 + 0.28 * (ps.condition / 100)) *
    (0.95 + 0.1 * (p.morale / 100)) *
    formFactor(p) *
    (1 + ps.dayForm) *
    (ps.injured ? 0.6 : 1)
  );
}

interface Units {
  att: number;
  mid: number;
  def: number;
  gk: number;
  /** Talimat etkileri için takım profili. */
  profile: TeamProfile;
}

const DEFENSIVE_SLOTS: ReadonlySet<Position> = new Set(['DR', 'DC', 'DL', 'WBR', 'WBL']);
const ATTACKING_SLOTS: ReadonlySet<Position> = new Set(['AMR', 'AMC', 'AML', 'ST']);

const average = (xs: number[], fallback: number) => (xs.length === 0 ? fallback : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Kaptan (sahada değilse yardımcı kaptan) liderliğine göre takıma küçük bir çarpan (±%3). */
function captainBonus(team: TeamState, lookup: PlayerLookup): number {
  const id = [team.captainId, team.viceCaptainId].find((x) => x !== null && team.onPitch.includes(x));
  if (id === undefined || id === null) return 1;
  return 1 + (lookup[id]!.attributes.leadership - 10) * 0.003;
}

function teamUnits(state: MatchState, team: TeamState, lookup: PlayerLookup): Units {
  let att = 0;
  let mid = 0;
  let def = 0;
  let gk = 4; // kalede kaleci yoksa (kırmızı kart, değişiklik hakkı bitti) çok zayıf
  const passing: number[] = [];
  const defencePace: number[] = [];
  const attackPace: number[] = [];
  const attackAerial: number[] = [];
  const creativity: number[] = [];
  const defencePassing: number[] = [];
  const defenceAwareness: number[] = [];
  let tightMarkers = 0;
  for (const id of team.onPitch) {
    const ps = state.players[id]!;
    const p = lookup[id]!;
    const a = p.attributes;
    const eff = efficiency(ps, p);
    if (ps.slot === 'GK') {
      gk = keeperScore(a) * eff;
      continue;
    }
    const w = SLOT_WEIGHTS[ps.slot!];
    const o = orderWeights(ps.orders, a.dribbling);
    att += w.att * o.att * eff * attackScore(a);
    mid += w.mid * o.mid * eff * midfieldScore(a);
    def += w.def * o.def * eff * defenceScore(a);
    passing.push((a.passing + a.technique) / 2);
    creativity.push((a.creativity + a.flair) / 2);
    if (ps.orders?.tightMarking) tightMarkers++;
    if (DEFENSIVE_SLOTS.has(ps.slot!)) {
      defencePace.push(a.pace);
      defencePassing.push((a.passing + a.composure) / 2);
      defenceAwareness.push((a.concentration + a.anticipation) / 2);
    }
    if (ATTACKING_SLOTS.has(ps.slot!)) {
      attackPace.push(a.pace);
      attackAerial.push((a.heading + a.jumping) / 2);
    }
  }
  const fw = team.fullWeights;
  const cap = captainBonus(team, lookup);
  return {
    att: (att / fw.att) * cap,
    mid: (mid / fw.mid) * cap,
    def: (def / fw.def) * cap,
    gk,
    profile: {
      passing: average(passing, 10),
      defencePace: average(defencePace, 10),
      attackPace: average(attackPace, 10),
      attackAerial: average(attackAerial, 10),
      creativity: average(creativity, 10),
      defencePassing: average(defencePassing, 10),
      defenceAwareness: average(defenceAwareness, 10),
      tightMarkers,
    },
  };
}

function rawWeights(slots: readonly Position[]): TeamState['fullWeights'] {
  const fw = { att: 0, mid: 0, def: 0 };
  for (const slot of slots) {
    const w = SLOT_WEIGHTS[slot];
    fw.att += w.att;
    fw.mid += w.mid;
    fw.def += w.def;
  }
  return { att: Math.max(fw.att, 0.1), mid: Math.max(fw.mid, 0.1), def: Math.max(fw.def, 0.1) };
}

/** Yapay zekâ dizilişlerinin ortalama birim ağırlıkları (dizilişin şekli buna göre ölçülür). */
const REFERENCE_WEIGHTS: TeamState['fullWeights'] = (() => {
  const all = AI_FORMATION_IDS.map((id) => rawWeights(FORMATIONS[id]));
  const avg = (k: 'att' | 'mid' | 'def') => all.reduce((s, w) => s + w[k], 0) / all.length;
  return { att: avg('att'), mid: avg('mid'), def: avg('def') };
})();

/** Dizilişin şeklinin etkisi (üs): çok forvetli diziliş hücumda biraz güçlü, savunmada zayıf olur. */
const SHAPE_EXPONENT = 0.3;

/**
 * Birim ağırlık toplamları: eksik oyuncu takımı zayıflatsın diye 11 kişilik dizilişten hesaplanır.
 * Bölen, dizilişin ağırlığı ile ortalama dizilişin ağırlığı arasında: birimin gücü oyuncuların ortalamasıdır,
 * dizilişte o birime çok oyuncu varsa biraz artar (SHAPE_EXPONENT).
 */
function formationWeights(slots: readonly Position[]): TeamState['fullWeights'] {
  const fw = rawWeights(slots);
  const k = SHAPE_EXPONENT;
  const scale = (key: 'att' | 'mid' | 'def') => fw[key] ** (1 - k) * REFERENCE_WEIGHTS[key] ** k;
  return { att: scale('att'), mid: scale('mid'), def: scale('def') };
}

/* ------------------------------------------------------------------ */
/* Kurulum                                                             */
/* ------------------------------------------------------------------ */

export interface TeamSetup {
  clubId: string;
  name: string;
  lineup: Lineup;
  userControlled?: boolean;
  formation?: FormationId;
  /** Kendi dizilişi (varsa formation yerine). */
  custom?: CustomFormation | null;
  plan?: number;
  instructions?: TeamInstructions;
  /** Boşsa (otomatik) ilk 11'in en yüksek liderlikli oyuncusu; yardımcı kaptan ikincisi. */
  captainId?: number | null;
  viceCaptainId?: number | null;
  penaltyTakerId?: number | null;
  freeKickTakerId?: number | null;
  cornerTakerId?: number | null;
  targetManId?: number | null;
  /** Maç sakatlığı riski çarpanı (kulübün sağlık merkezi); yoksa 1. */
  injuryRisk?: number;
}

export interface MatchSetup {
  fixtureId: number;
  home: TeamSetup;
  away: TeamSetup;
  seed: number;
  /** Eleme maçı: beraberlikte penaltı atışları. */
  knockout?: boolean;
  /** Tarafsız saha: iç saha avantajı yok. */
  neutral?: boolean;
  /** İki maçlı eşleşmenin rövanşı: ilk maçın golleri (bu maçın ev sahibi / deplasmanı açısından). */
  aggregate?: { home: number; away: number };
}

function newPlayerState(rng: Rng, p: Player, side: Side, slot: Position | null): PlayerMatchState {
  // Tutarlılığı düşük oyuncunun "günü" daha çok oynar.
  const spread = 0.03 + (20 - p.hidden.consistency) * 0.003;
  return {
    playerId: p.id,
    side,
    slot,
    started: slot !== null,
    minuteIn: slot !== null ? 0 : null,
    minuteOut: null,
    condition: p.condition,
    dayForm: Math.max(-0.12, Math.min(0.12, rng.normal(0, spread))),
    rating: 6,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    yellow: false,
    red: false,
    injured: false,
  };
}

function newTeam(rng: Rng, setup: TeamSetup, side: Side, lookup: PlayerLookup, players: MatchState['players']): TeamState {
  // Otomatik kaptan / yardımcı kaptan: ilk 11'in en yüksek liderlikli iki oyuncusu
  const autoLeaders = setup.lineup.starters
    .map((s) => s.playerId)
    .sort((a, b) => lookup[b]!.attributes.leadership - lookup[a]!.attributes.leadership);
  const captainId = setup.captainId ?? autoLeaders[0] ?? null;
  for (const { playerId, slot, orders } of setup.lineup.starters) {
    players[playerId] = newPlayerState(rng, lookup[playerId]!, side, slot);
    if (!isDefaultOrders(orders)) players[playerId]!.orders = { ...orders! };
  }
  for (const id of setup.lineup.bench) players[id] = newPlayerState(rng, lookup[id]!, side, null);
  const formation = setup.formation ?? DEFAULT_FORMATION_ID;
  const custom = setup.custom ?? null;
  return {
    clubId: setup.clubId,
    name: setup.name,
    side,
    onPitch: setup.lineup.starters.map((s) => s.playerId),
    bench: [...setup.lineup.bench],
    subsUsed: 0,
    formation,
    ...(custom ? { custom } : {}),
    ...(setup.plan !== undefined ? { plan: setup.plan } : {}),
    instructions: { ...DEFAULT_INSTRUCTIONS, ...setup.instructions },
    captainId,
    viceCaptainId: setup.viceCaptainId ?? autoLeaders.find((id) => id !== captainId) ?? null,
    penaltyTakerId: setup.penaltyTakerId ?? null,
    freeKickTakerId: setup.freeKickTakerId ?? null,
    ...(setup.cornerTakerId != null ? { cornerTakerId: setup.cornerTakerId } : {}),
    ...(setup.targetManId != null ? { targetManId: setup.targetManId } : {}),
    userControlled: setup.userControlled ?? false,
    ...(setup.injuryRisk !== undefined && setup.injuryRisk !== 1 ? { injuryRisk: setup.injuryRisk } : {}),
    counters: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0 },
    fullWeights: formationWeights(slotsOf({ formation, custom })),
  };
}

export function createMatch(setup: MatchSetup, lookup: PlayerLookup): MatchState {
  const rng = new Rng(setup.seed);
  const players: MatchState['players'] = {};
  const home = newTeam(rng, setup.home, 'home', lookup, players);
  const away = newTeam(rng, setup.away, 'away', lookup, players);
  return {
    fixtureId: setup.fixtureId,
    seed: setup.seed,
    period: 'pre',
    minute: 0,
    addedTime: [rng.int(0, 3), rng.int(2, 6)],
    score: { home: 0, away: 0 },
    home,
    away,
    players,
    events: [],
    goals: [],
    cards: [],
    injuries: [],
    possessionTicks: { home: 0, away: 0 },
    momentum: [],
    lastPlay: null,
    pendingSubs: [],
    ...(setup.knockout ? { knockout: true } : {}),
    ...(setup.neutral ? { neutral: true } : {}),
    ...(setup.aggregate ? { aggregate: { ...setup.aggregate } } : {}),
    shots: [],
    timeline: '',
    rngState: rng.getState(),
  };
}

/* ------------------------------------------------------------------ */
/* Yardımcılar                                                          */
/* ------------------------------------------------------------------ */

/** Bir dakikalık simülasyon bağlamı (rng ve oyuncu sözlüğü her fonksiyona taşınmasın). */
interface Ctx {
  state: MatchState;
  lookup: PlayerLookup;
  rng: Rng;
  /** Bu dakikanın taktik etkileri (dakika dışı işlemlerde etkisiz). */
  effects: Record<Side, InstructionEffects>;
  /** Dakika oynanırken (değişiklik dakikanın anına yazılır; dışında sıradaki dakikaya bekler). */
  inMinute?: boolean;
}

/** 2D saha için dakikanın anlarının önemi: aynı dakikada daha önemli olan gösterilir. */
const PLAY_PRIORITY: Record<PlayKind, number> = {
  hold: 0, foul: 1, attack: 2, corner: 3, freekick: 3, blocked: 4, miss: 4, save: 4, penalty: 5, goal: 6,
};

/** Dakikanın anını kaydeder (yalnızca gösterim; rng kullanmaz, sonucu etkilemez). */
function recordPlay(
  ctx: Ctx,
  side: Side,
  kind: PlayKind,
  playerId: number | null = null,
  extra: Omit<MatchPlay, 'side' | 'kind' | 'playerId' | 'card'> = {},
): void {
  const current = ctx.state.lastPlay;
  if (current && PLAY_PRIORITY[current.kind] > PLAY_PRIORITY[kind]) return;
  const play: MatchPlay = { side, kind, playerId };
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== false) (play as unknown as Record<string, unknown>)[k] = v;
  // Kart ve değişiklikler dakikaya aittir: daha önemli bir an gelse de kaybolmaz
  if (current?.card) play.card = current.card;
  if (current?.subs) play.subs = current.subs;
  // Penaltı / serbest vuruş şutunda faulü yapan, önceki andan (faul) taşınır
  if ((play.fromPenalty || play.fromFreeKick) && play.defenderId == null && current?.side === side && current.defenderId != null) {
    play.defenderId = current.defenderId;
  }
  ctx.state.lastPlay = play;
}

/** Dakikanın kartı (2D sahada oyuncunun üstünde gösterilir). */
function noteCard(ctx: Ctx, playerId: number, type: 'yellow' | 'red'): void {
  if (ctx.state.lastPlay) ctx.state.lastPlay.card = { playerId, type };
}

/** Anın savunmacısını ekler (an aynı taraf ve türdeyse). */
function noteDefender(ctx: Ctx, side: Side, kind: PlayKind, defenderId: number | null): void {
  const play = ctx.state.lastPlay;
  if (play && defenderId !== null && play.side === side && play.kind === kind) play.defenderId = defenderId;
}

function makeCtx(state: MatchState, lookup: PlayerLookup): Ctx {
  return { state, lookup, rng: Rng.fromState(state.rngState), effects: { home: NEUTRAL_EFFECTS, away: NEUTRAL_EFFECTS } };
}

const other = (side: Side): Side => (side === 'home' ? 'away' : 'home');
const teamOf = (state: MatchState, side: Side) => state[side];
const nameOf = (ctx: Ctx, id: number) => ctx.lookup[id]!.lastName;

function addRating(ctx: Ctx, id: number, delta: number): void {
  const ps = ctx.state.players[id]!;
  ps.rating = Math.max(1, Math.min(10, ps.rating + delta));
}

function emit(ctx: Ctx, type: MatchEventType, side: Side | null, key: CommentaryKey, vars: Record<string, string | number> = {}): void {
  const { minute, extra } = displayMinute(ctx.state);
  ctx.state.events.push({ minute, extra, type, side, text: commentary(ctx.rng, key, vars) });
}

function scoreText(state: MatchState): string {
  return `(${state.home.name} ${state.score.home}-${state.score.away} ${state.away.name})`;
}

/** Sahadaki oyunculardan ağırlığa göre seçim; ağırlık toplamı 0 ise rastgele. */
function pickOnPitch(ctx: Ctx, side: Side, weight: (ps: PlayerMatchState, p: Player) => number, exclude: number[] = []): number | null {
  const ids = teamOf(ctx.state, side).onPitch.filter((id) => !exclude.includes(id));
  if (ids.length === 0) return null;
  const weights = ids.map((id) => Math.max(0, weight(ctx.state.players[id]!, ctx.lookup[id]!)));
  if (weights.every((w) => w === 0)) return ctx.rng.pick(ids);
  return ids[ctx.rng.weightedIndex(weights)]!;
}

function keeperOf(ctx: Ctx, side: Side): number | null {
  return teamOf(ctx.state, side).onPitch.find((id) => ctx.state.players[id]!.slot === 'GK') ?? null;
}

/* ------------------------------------------------------------------ */
/* Şut ve gol                                                          */
/* ------------------------------------------------------------------ */

const SHOOTER_WEIGHT: Record<Position, number> = {
  GK: 0, DC: 0.5, DR: 0.4, DL: 0.4, WBR: 0.8, WBL: 0.8, DM: 0.7, MC: 1.5, MR: 1.8, ML: 1.8,
  AMC: 3.5, AMR: 3, AML: 3, ST: 3.5,
};

const CREATOR_WEIGHT: Record<Position, number> = {
  GK: 0.05, DC: 0.4, DR: 1.2, DL: 1.2, WBR: 1.8, WBL: 1.8, DM: 1.2, MC: 2.2, MR: 2.4, ML: 2.4,
  AMC: 3, AMR: 2.6, AML: 2.6, ST: 1.4,
};

/**
 * Mevkiye göre şut türü olasılıkları [kafa, uzaktan]; kalanı normal şut.
 * `headerBonus`: uzun top oynayan takımda kafa şutu payı artar.
 */
function shotKindFor(rng: Rng, slot: Position, headerBonus: number, longBonus = 0): GoalKind {
  const [baseHeader, baseLong] =
    slot === 'ST' ? [0.22, 0.08]
      : slot === 'AMC' || slot === 'AMR' || slot === 'AML' ? [0.1, 0.3]
        : slot === 'DC' || slot === 'DR' || slot === 'DL' || slot === 'WBR' || slot === 'WBL' ? [0.45, 0.3]
          : [0.12, 0.55];
  const header = baseHeader + headerBonus;
  const long = baseLong + longBonus;
  const r = rng.next();
  return r < header ? 'header' : r < header + long ? 'long' : 'normal';
}

function shotSkill(a: Attributes, kind: GoalKind): number {
  switch (kind) {
    case 'header': return (a.heading * 2 + a.jumping + a.strength * 0.5 + a.offTheBall * 0.5) / 4;
    case 'long': return (a.longShots * 2 + a.technique + a.composure * 0.5) / 3.5;
    case 'freekick': return (a.freeKicks * 2 + a.technique) / 3;
    case 'penalty': return (a.penaltyTaking * 2 + a.composure) / 3;
    default: return (a.finishing * 2 + a.composure + a.technique + a.offTheBall * 0.5) / 4.5;
  }
}

const KIND_ON_TARGET: Record<GoalKind, number> = { normal: 1, header: 0.9, long: 0.75, freekick: 0.85, penalty: 1 };
const KIND_GOAL: Record<GoalKind, number> = { normal: 1, header: 0.85, long: 0.55, freekick: 0.7, penalty: 1 };

const WIDE_SLOTS: ReadonlySet<Position> = new Set(['DR', 'DL', 'WBR', 'WBL', 'MR', 'ML', 'AMR', 'AML']);

/**
 * Gol. `assistBy`: duran topta ortayı yapan (kornerde kornerci), varsa asisti çoğunlukla o yapar.
 */
function scoreGoal(ctx: Ctx, side: Side, scorerId: number, kind: GoalKind, assistBy: number | null = null): number | null {
  const { state, rng } = ctx;
  const team = teamOf(state, side);
  const opp = teamOf(state, other(side));
  state.score[side]++;

  // Asist: penaltı ve serbest vuruş hariç gollerin çoğunda.
  let assistId: number | null = null;
  if (assistBy !== null && assistBy !== scorerId && team.onPitch.includes(assistBy)) {
    if (rng.chance(0.8)) assistId = assistBy;
  } else if (kind !== 'penalty' && kind !== 'freekick' && rng.chance(0.72)) {
    assistId = pickOnPitch(
      ctx,
      side,
      (ps, p) =>
        CREATOR_WEIGHT[ps.slot!] * orderCreating(ps.orders, WIDE_SLOTS.has(ps.slot!)) *
        (p.attributes.passing + p.attributes.creativity + p.attributes.crossing * (kind === 'header' ? 1.5 : 0.5)),
      [scorerId],
    );
  }

  const { minute, extra } = displayMinute(state);
  state.goals.push({ minute, extra, clubId: team.clubId, playerId: scorerId, assistId, kind });

  const scorer = state.players[scorerId]!;
  scorer.goals++;
  addRating(ctx, scorerId, kind === 'penalty' ? 0.6 : 1.0);
  if (assistId !== null) {
    state.players[assistId]!.assists++;
    addRating(ctx, assistId, 0.6);
  }
  for (const id of opp.onPitch) {
    const slot = state.players[id]!.slot;
    if (slot === 'GK') addRating(ctx, id, -0.4);
    else if (slot === 'DC' || slot === 'DR' || slot === 'DL' || slot === 'WBR' || slot === 'WBL') addRating(ctx, id, -0.15);
  }

  const key: CommentaryKey =
    kind === 'header' ? 'goalHeader' : kind === 'long' ? 'goalLong' : kind === 'freekick' ? 'goalFreekick'
      : kind === 'penalty' ? 'goalPenalty' : 'goal';
  emit(ctx, 'goal', side, key, { player: nameOf(ctx, scorerId), score: scoreText(state) });
  if (assistId !== null) emit(ctx, 'info', side, 'assist', { assist: nameOf(ctx, assistId) });
  return assistId;
}

/**
 * Bir şutu sonuçlandırır. `threat` atak gücü oranıdır (pozisyonun kalitesi).
 */
function resolveShot(
  ctx: Ctx,
  side: Side,
  shooterId: number,
  kind: GoalKind,
  threat: number,
  fromCorner = false,
  setPiece: { quality: number; crosser: number | null } | null = null,
): void {
  const { state, rng, lookup } = ctx;
  const team = teamOf(state, side);
  const oppSide = other(side);
  const opp = teamOf(state, oppSide);
  const shooter = state.players[shooterId]!;
  const skill = shotSkill(lookup[shooterId]!.attributes, kind) * efficiency(shooter, lookup[shooterId]!);

  team.counters.shots++;
  shooter.shots++;
  const name = nameOf(ctx, shooterId);

  const penalty = kind === 'penalty';
  // 2D saha için şutun kaynağı (duran top sahneleri)
  const source = { fromPenalty: penalty, fromCorner, fromFreeKick: kind === 'freekick' };
  // Şut haritası kaydı (yalnızca gösterim)
  const noteShot = (outcome: ShotOutcome) => {
    const shot: ShotRecord = { minute: state.minute, side, playerId: shooterId, outcome };
    if (state.period === 'second') shot.second = true;
    if (kind !== 'normal') shot.kind = kind;
    if (fromCorner) shot.corner = true;
    state.shots.push(shot);
  };
  // Engellenen şut (penaltı ve serbest vuruş hariç)
  if (kind !== 'penalty' && kind !== 'freekick' && rng.chance(TUNING.blockChance)) {
    recordPlay(ctx, side, 'blocked', shooterId, source);
    noteShot('blocked');
    const blocker = pickOnPitch(ctx, oppSide, (ps, p) => SLOT_WEIGHTS[ps.slot!].def * (p.attributes.bravery + p.attributes.positioning));
    noteDefender(ctx, side, 'blocked', blocker);
    if (blocker !== null) {
      addRating(ctx, blocker, 0.15);
      emit(ctx, 'blocked', side, 'blocked', { player: name, defender: nameOf(ctx, blocker) });
    }
    if (rng.chance(0.4)) awardCorner(ctx, side);
    return;
  }

  const keeperId = keeperOf(ctx, oppSide);
  const keeperName = keeperId !== null ? nameOf(ctx, keeperId) : 'kalede kimse';
  const gk = teamUnits(state, opp, lookup).gk;

  // Taktik: kendi şut kalitemiz ve rakibin savunma hattının açtığı/kapattığı alan.
  const quality = ctx.effects[side].shotQuality * (setPiece?.quality ?? 1);
  const conceded = ctx.effects[oppSide].oppShotQuality;
  const pOnTarget = kind === 'penalty' ? 0.85
    : Math.max(0.1, Math.min(0.75, TUNING.onTargetBase * (0.5 + skill / 24) * KIND_ON_TARGET[kind] * quality));
  if (!rng.chance(pOnTarget)) {
    recordPlay(ctx, side, penalty ? 'penalty' : 'miss', shooterId, { ...source, keeperId });
    noteShot('missed');
    addRating(ctx, shooterId, kind === 'penalty' ? -0.6 : -0.05);
    if (kind === 'penalty') emit(ctx, 'penaltyMiss', side, 'penaltyMiss', { player: name, keeper: keeperName });
    else emit(ctx, 'miss', side, kind === 'long' ? 'missLong' : kind === 'header' ? 'missHeader' : 'miss', { player: name });
    return;
  }

  team.counters.shotsOnTarget++;
  shooter.shotsOnTarget++;
  const pGoal = kind === 'penalty'
    ? Math.max(0.6, Math.min(0.95, 0.88 + (skill - 12) * 0.015 - (gk - 12) * 0.012))
    : Math.max(0.06, Math.min(0.65,
      TUNING.goalBase * (skill / Math.max(gk, 3)) ** TUNING.finishingExponent * KIND_GOAL[kind] * threat ** 0.3 * quality * conceded));

  if (rng.chance(pGoal)) {
    const assistId = scoreGoal(ctx, side, shooterId, kind, setPiece?.crosser ?? null);
    recordPlay(ctx, side, 'goal', shooterId, { ...source, keeperId, assistId });
    noteShot('goal');
    return;
  }
  recordPlay(ctx, side, penalty ? 'penalty' : 'save', shooterId, { ...source, keeperId });
  noteShot('saved');
  addRating(ctx, shooterId, kind === 'penalty' ? -0.6 : 0.1);
  if (keeperId !== null) addRating(ctx, keeperId, kind === 'penalty' ? 0.8 : 0.3);
  if (kind === 'penalty') emit(ctx, 'penaltyMiss', side, 'penaltyMiss', { player: name, keeper: keeperName });
  else emit(ctx, 'save', side, kind === 'header' ? 'saveHeader' : 'save', { player: name, keeper: keeperName });
  if (rng.chance(0.3)) awardCorner(ctx, side);
}

/** Duran toplarda kafa vuruşu için oyuncu: uzun boylular (stoper, forvet) ve hedef adam öne çıkar. */
function aerialTarget(ctx: Ctx, side: Side, exclude: number[]): number | null {
  const target = teamOf(ctx.state, side).targetManId ?? null;
  return pickOnPitch(ctx, side, (ps, p) => {
    // Hedef adam kafa vuruşlarının üçte birinden fazlasını alır
    const tall = ps.playerId === target ? 6 : ps.slot === 'DC' || ps.slot === 'ST' ? 2.5 : ps.slot === 'GK' ? 0 : 0.6;
    return tall * (p.attributes.heading + p.attributes.jumping);
  }, exclude);
}

/** Ortacının duran top kalitesine etkisi (orta / korner becerisi 10 → etkisiz). */
function deliveryQuality(ctx: Ctx, crosser: number | null, skill: (a: Attributes) => number): number {
  if (crosser === null) return 1;
  return 1 + Math.max(-0.08, Math.min(0.1, (skill(ctx.lookup[crosser]!.attributes) - 12) * 0.012));
}

/** Korner tarzının şut olasılığı ve kalitesine etkisi (karışık = etkisiz). */
const CORNER_STYLE: Record<TeamInstructions['cornerStyle'], { shot: number; quality: number }> = {
  mixed: { shot: 1, quality: 1 },
  // Ön direk: daha çok vuruş, ama zor açıdan
  near: { shot: 1.12, quality: 0.9 },
  // Arka direk: hava topunda iyi takımlara kaliteli pozisyon
  far: { shot: 0.92, quality: 1.08 },
  // Kısa korner: az ama yerden, kaliteli pozisyon
  short: { shot: 0.8, quality: 1.12 },
};

function awardCorner(ctx: Ctx, side: Side): void {
  const team = teamOf(ctx.state, side);
  team.counters.corners++;
  recordPlay(ctx, side, 'corner');
  emit(ctx, 'corner', side, 'corner', { team: team.name });
  const style = CORNER_STYLE[team.instructions.cornerStyle] ?? CORNER_STYLE.mixed;
  if (!ctx.rng.chance(TUNING.cornerShotChance * style.shot)) return;
  // Varsayılan (karışık, kornerci seçilmemiş) korner eskisi gibi: ortacı hesaba girmez
  const custom = team.instructions.cornerStyle !== 'mixed' || team.cornerTakerId != null;
  const crosser = custom
    ? designatedTaker(ctx, side, team.cornerTakerId ?? null, (p) => p.attributes.corners * 2 + p.attributes.crossing)
    : null;
  const exclude = crosser !== null ? [crosser] : [];
  if (team.instructions.cornerStyle === 'short') {
    // Kısa korner: ceza sahası önünden ayakla şut
    const shooter = pickOnPitch(ctx, side, (ps, p) =>
      SHOOTER_WEIGHT[ps.slot!] * (p.attributes.finishing + p.attributes.longShots), exclude);
    if (shooter !== null) {
      resolveShot(ctx, side, shooter, 'normal', 1, true, {
        quality: style.quality * deliveryQuality(ctx, crosser, (a) => a.passing), crosser,
      });
    }
    return;
  }
  const shooter = aerialTarget(ctx, side, exclude);
  if (shooter === null) return;
  // Arka direk hava topuna güçlü oyuncuyla daha etkili
  const aerial = style === CORNER_STYLE.far
    ? 1 + Math.max(-0.08, Math.min(0.08, ((ctx.lookup[shooter]!.attributes.heading + ctx.lookup[shooter]!.attributes.jumping) / 2 - 13) * 0.02))
    : 1;
  resolveShot(ctx, side, shooter, 'header', 1, true, custom
    ? { quality: style.quality * aerial * deliveryQuality(ctx, crosser, (a) => a.corners), crosser }
    : null);
}

/* ------------------------------------------------------------------ */
/* Atak, faul, sakatlık                                                 */
/* ------------------------------------------------------------------ */

function resolveAttack(ctx: Ctx, side: Side, units: Record<Side, Units>): void {
  const { state, rng } = ctx;
  const oppSide = other(side);

  const homeBoost = side === 'home' && !state.neutral ? TUNING.homeAttack : 1;
  const threat = (units[side].att * homeBoost) / Math.max(units[oppSide].def, 1);
  // Kendi taktiğimiz ve rakibin verdiği açık şut olasılığını değiştirir.
  const pShot = Math.max(0.05, Math.min(0.9,
    TUNING.shotChance * threat ** TUNING.threatExponent *
      ctx.effects[side].shotChance * ctx.effects[oppSide].oppShotChance));

  recordPlay(ctx, side, 'attack');
  if (!rng.chance(pShot)) {
    if (rng.chance(TUNING.cornerFromAttack * ctx.effects[side].corners)) {
      awardCorner(ctx, side);
      return;
    }
    // Savunma topu kazandı
    if (rng.chance(0.35)) {
      const tackler = pickOnPitch(ctx, oppSide, (ps, p) =>
        SLOT_WEIGHTS[ps.slot!].def * (p.attributes.tackling + p.attributes.marking + p.attributes.anticipation));
      noteDefender(ctx, side, 'attack', tackler);
      if (tackler !== null) {
        addRating(ctx, tackler, 0.05);
        if (rng.chance(0.25)) emit(ctx, 'tackle', oppSide, 'tackle', { player: nameOf(ctx, tackler) });
      }
    }
    return;
  }

  const shooterId = pickOnPitch(ctx, side, (ps, p) =>
    SHOOTER_WEIGHT[ps.slot!] * orderShooting(ps.orders, WIDE_SLOTS.has(ps.slot!)) *
      (p.attributes.finishing + p.attributes.offTheBall + p.attributes.longShots * 0.5));
  if (shooterId === null) return;
  const shooter = state.players[shooterId]!;
  const kind = shotKindFor(rng, shooter.slot!, ctx.effects[side].headerBonus, shooter.orders?.longShots ? 0.2 : 0);
  resolveShot(ctx, side, shooterId, kind, threat);
}

function sendOff(ctx: Ctx, id: number): void {
  const { state } = ctx;
  const ps = state.players[id]!;
  const team = teamOf(state, ps.side);
  const wasKeeper = ps.slot === 'GK';
  ps.red = true;
  ps.slot = null;
  ps.minuteOut = displayMinute(state).minute;
  team.onPitch = team.onPitch.filter((x) => x !== id);
  team.counters.redCards++;
  addRating(ctx, id, -1.5);

  // Kaleci atıldıysa: bir saha oyuncusu çıkar, yedek kaleci girer.
  if (wasKeeper && team.subsUsed < MAX_SUBS) {
    const benchKeeper = team.bench.find((b) => ctx.lookup[b]!.positions.GK !== undefined);
    const outfield = [...team.onPitch].sort((a, b) => state.players[a]!.rating - state.players[b]!.rating)
      .find((x) => state.players[x]!.slot !== 'GK');
    if (benchKeeper !== undefined && outfield !== undefined) {
      state.players[outfield]!.slot = 'GK'; // substitute() slotu devralır
      makeSubstitution(ctx, ps.side, outfield, benchKeeper);
    }
  }
}

function resolveFoul(ctx: Ctx, attackingSide: Side): void {
  const { state, rng, lookup } = ctx;
  // Fauller çoğunlukla savunan takımdan gelir; yoğun pres yapan takım daha çok faul yapar.
  const defending = other(attackingSide);
  const defWeight = 0.62 * ctx.effects[defending].fouls;
  const attWeight = 0.38 * ctx.effects[attackingSide].fouls;
  const foulSide = rng.chance(defWeight / (defWeight + attWeight)) ? defending : attackingSide;
  const victimSide = other(foulSide);
  const team = teamOf(state, foulSide);
  const foulerId = pickOnPitch(ctx, foulSide, (ps, p) =>
    (SLOT_WEIGHTS[ps.slot!].def + 0.3) * (p.attributes.aggression + 5));
  if (foulerId === null) return;
  team.counters.fouls++;
  recordPlay(ctx, victimSide, 'foul', null, { defenderId: foulerId });
  addRating(ctx, foulerId, -0.05);
  const fouler = state.players[foulerId]!;
  const aggression = lookup[foulerId]!.attributes.aggression;

  // Kart
  if (rng.chance(TUNING.directRedChance)) {
    state.cards.push({ ...displayMinute(state), clubId: team.clubId, playerId: foulerId, type: 'red' });
    noteCard(ctx, foulerId, 'red');
    emit(ctx, 'red', foulSide, 'red', { player: nameOf(ctx, foulerId), team: team.name });
    sendOff(ctx, foulerId);
  } else if (rng.chance((0.09 + aggression / 180) * (fouler.yellow ? 0.45 : 1))) {
    // Sarı kartı olan oyuncu daha temkinli oynar.
    if (fouler.yellow) {
      state.cards.push({ ...displayMinute(state), clubId: team.clubId, playerId: foulerId, type: 'red', secondYellow: true });
      noteCard(ctx, foulerId, 'red');
      emit(ctx, 'red', foulSide, 'secondYellow', { player: nameOf(ctx, foulerId), team: team.name });
      sendOff(ctx, foulerId);
    } else {
      fouler.yellow = true;
      noteCard(ctx, foulerId, 'yellow');
      team.counters.yellowCards++;
      addRating(ctx, foulerId, -0.3);
      state.cards.push({ ...displayMinute(state), clubId: team.clubId, playerId: foulerId, type: 'yellow' });
      emit(ctx, 'yellow', foulSide, 'yellow', { player: nameOf(ctx, foulerId) });
    }
  } else if (rng.chance(0.3)) {
    emit(ctx, 'foul', foulSide, 'foul', { player: nameOf(ctx, foulerId) });
  }

  // Savunan takımın faulü: penaltı ya da tehlikeli serbest vuruş olabilir.
  if (foulSide !== attackingSide) {
    const victims = teamOf(state, victimSide);
    if (rng.chance(TUNING.penaltyChance)) {
      const taker = designatedTaker(ctx, victimSide, victims.penaltyTakerId, (p) => p.attributes.penaltyTaking);
      if (taker === null) return;
      addRating(ctx, foulerId, -0.5);
      emit(ctx, 'penalty', victimSide, 'penalty', { fouler: nameOf(ctx, foulerId), player: nameOf(ctx, taker) });
      resolveShot(ctx, victimSide, taker, 'penalty', 1);
    } else if (rng.chance(0.12) && rng.chance(0.45)) {
      const taker = designatedTaker(ctx, victimSide, victims.freeKickTakerId, (p) => p.attributes.freeKicks);
      if (taker === null) return;
      recordPlay(ctx, victimSide, 'freekick', taker, { defenderId: foulerId });
      emit(ctx, 'freekick', victimSide, 'freekick', { player: nameOf(ctx, taker) });
      // Orta: kaleye vurmak yerine ceza sahasına (karışıkta ara sıra)
      const style = victims.instructions.freeKickStyle;
      const cross = style === 'cross' || (style === 'mixed' && victims.targetManId != null && rng.chance(0.3));
      const header = cross ? aerialTarget(ctx, victimSide, [taker]) : null;
      if (header !== null) {
        resolveShot(ctx, victimSide, header, 'header', 1, false, {
          quality: deliveryQuality(ctx, taker, (a) => (a.freeKicks + a.crossing) / 2), crosser: taker,
        });
      } else resolveShot(ctx, victimSide, taker, 'freekick', 1);
    }
  }
}

/** Taktikte seçilen vurucu sahadaysa o, değilse özelliği en iyi olan. */
function designatedTaker(ctx: Ctx, side: Side, chosen: number | null, score: (p: Player) => number): number | null {
  if (chosen !== null && teamOf(ctx.state, side).onPitch.includes(chosen)) return chosen;
  return bestOnPitch(ctx, side, score);
}

/** Sahadaki kaleci olmayan oyunculardan özelliği en yüksek olan. */
function bestOnPitch(ctx: Ctx, side: Side, score: (p: Player) => number): number | null {
  let best: number | null = null;
  let bestScore = -1;
  for (const id of teamOf(ctx.state, side).onPitch) {
    if (ctx.state.players[id]!.slot === 'GK') continue;
    const s = score(ctx.lookup[id]!);
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return best;
}

function checkInjury(ctx: Ctx, side: Side): void {
  const { state, rng, lookup } = ctx;
  const team = teamOf(state, side);
  const healthy = team.onPitch.filter((id) => !state.players[id]!.injured);
  if (healthy.length === 0) return;
  const proneness = healthy.reduce((s, id) => s + lookup[id]!.hidden.injuryProneness, 0) / healthy.length;
  if (!rng.chance(TUNING.injuryChance * (proneness / 10) * (team.injuryRisk ?? 1))) return;
  const id = healthy[rng.weightedIndex(healthy.map((h) => lookup[h]!.hidden.injuryProneness + 2))]!;
  state.players[id]!.injured = true;
  state.injuries.push({ ...displayMinute(state), clubId: team.clubId, playerId: id });
  if (state.lastPlay) state.lastPlay.injuredId = id;
  emit(ctx, 'injury', side, 'injury', { player: nameOf(ctx, id) });
}

/* ------------------------------------------------------------------ */
/* Değişiklik, mentalite, yorgunluk                                     */
/* ------------------------------------------------------------------ */

function makeSubstitution(ctx: Ctx, side: Side, outId: number, inId: number): boolean {
  const { state } = ctx;
  const team = teamOf(state, side);
  const out = state.players[outId];
  const incoming = state.players[inId];
  if (!out || !incoming || out.slot === null || !team.onPitch.includes(outId) || !team.bench.includes(inId)) return false;
  if (team.subsUsed >= MAX_SUBS || state.period === 'full') return false;

  const minute = displayMinute(state).minute;
  incoming.slot = out.slot;
  if (out.orders) incoming.orders = out.orders;
  else delete incoming.orders;
  incoming.minuteIn = minute;
  out.slot = null;
  out.minuteOut = minute;
  team.onPitch = team.onPitch.map((id) => (id === outId ? inId : id));
  team.bench = team.bench.filter((id) => id !== inId);
  team.subsUsed++;
  // 2D saha: dakika içindeki değişiklik o dakikanın sahnesinde, dakikalar arasındaki sıradaki dakikada
  if (ctx.inMinute && state.lastPlay) (state.lastPlay.subs ??= []).push({ side, outId, inId });
  else state.pendingSubs.push({ side, outId, inId, early: true });
  emit(ctx, 'sub', side, 'sub', { team: team.name, in: nameOf(ctx, inId), out: nameOf(ctx, outId) });
  return true;
}

/** Yedeklerden o mevki için en uygun oyuncu. */
function bestReplacement(ctx: Ctx, team: TeamState, slot: Position): number | null {
  let best: number | null = null;
  let bestScore = -1;
  for (const id of team.bench) {
    const p = ctx.lookup[id]!;
    const score = p.currentAbility * slotFit(p, slot);
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}

function autoSubstitutions(ctx: Ctx, side: Side): void {
  const { state } = ctx;
  const team = teamOf(state, side);
  if (team.subsUsed >= MAX_SUBS || team.bench.length === 0) return;

  // Sakatlar her zaman (kullanıcı takımında da) değiştirilir.
  for (const id of [...team.onPitch]) {
    const ps = state.players[id]!;
    if (!ps.injured || team.subsUsed >= MAX_SUBS) continue;
    const replacement = bestReplacement(ctx, team, ps.slot!);
    if (replacement !== null) makeSubstitution(ctx, side, id, replacement);
  }

  // Taktik değişiklikler yalnızca yapay zekâ takımında: 58'den sonra 5 dakikada bir, en fazla 4.
  if (team.userControlled || state.period !== 'second' || state.minute < 58 || state.minute % 5 !== 0) return;
  if (team.subsUsed >= 4) return;
  const candidates = team.onPitch
    .map((id) => state.players[id]!)
    .filter((ps) => ps.slot !== 'GK' && (ps.condition < 68 || (state.minute >= 70 && ps.rating < 6)));
  if (candidates.length === 0) return;
  // En yorgun / en kötü oynayan çıkar
  candidates.sort((a, b) => a.condition / 100 + a.rating / 10 - (b.condition / 100 + b.rating / 10));
  const out = candidates[0]!;
  const replacement = bestReplacement(ctx, team, out.slot!);
  if (replacement !== null) makeSubstitution(ctx, side, out.playerId, replacement);
}

/** Yapay zekâ mentalitesi: geride kalan sona doğru yüklenir, önde olan skoru korur. */
function aiMentality(state: MatchState, side: Side): Mentality {
  if (state.period !== 'second') return 0;
  const diff = state.score[side] - state.score[other(side)];
  const m = state.minute;
  if (diff < 0 && m >= 75) return diff === -1 ? 2 : 1;
  if (diff < 0 && m >= 60) return 1;
  if (diff === 1 && m >= 80) return -2;
  if (diff > 0 && m >= 55) return -1;
  // Deplasman takımı sona doğru beraberliğe razı olur
  if (diff === 0 && side === 'away' && m >= 75) return -1;
  return 0;
}

function applyFatigue(ctx: Ctx, team: TeamState): void {
  const tactical = ctx.effects[team.side].fatigue;
  for (const id of team.onPitch) {
    const ps = ctx.state.players[id]!;
    const stamina = ctx.lookup[id]!.attributes.stamina;
    const drain = 0.24 * (1.55 - stamina / 20) * tactical * (ps.slot === 'GK' ? 0.3 : 1);
    ps.condition = Math.max(20, ps.condition - drain);
  }
}

/* ------------------------------------------------------------------ */
/* Dakika döngüsü                                                       */
/* ------------------------------------------------------------------ */

function simulateMinute(ctx: Ctx): void {
  const { state, rng, lookup } = ctx;

  for (const side of ['home', 'away'] as const) {
    const team = teamOf(state, side);
    if (!team.userControlled) team.instructions.mentality = aiMentality(state, side);
  }

  const units = { home: teamUnits(state, state.home, lookup), away: teamUnits(state, state.away, lookup) };
  const effects = {
    home: instructionEffects(state.home.instructions, units.home.profile, units.away.profile, state.away.instructions),
    away: instructionEffects(state.away.instructions, units.away.profile, units.home.profile, state.home.instructions),
  };
  ctx.effects = effects;

  // Top hakimiyeti: orta saha gücü × kendi talimatları × rakibin presi
  const mh = units.home.mid * (state.neutral ? 1 : TUNING.homeMidfield) * effects.home.midfield * effects.away.oppMidfield;
  const ma = units.away.mid * effects.away.midfield * effects.home.oppMidfield;
  const pe = TUNING.possessionExponent;
  const side: Side = rng.chance(mh ** pe / (mh ** pe + ma ** pe)) ? 'home' : 'away';
  state.possessionTicks[side]++;
  state.lastPlay = { side, kind: 'hold', playerId: null };
  if (state.pendingSubs.length > 0) {
    state.lastPlay.subs = state.pendingSubs;
    state.pendingSubs = [];
  }
  ctx.inMinute = true;

  const eventsBefore = state.events.length;
  let attacked = false;
  if (rng.chance(TUNING.attackChance * effects[side].attackChance * effects[other(side)].oppAttackChance)) {
    attacked = true;
    resolveAttack(ctx, side, units);
  }
  if (rng.chance(TUNING.foulChance * (effects.home.fouls + effects.away.fouls) / 2)) resolveFoul(ctx, side);
  checkInjury(ctx, 'home');
  checkInjury(ctx, 'away');

  state.momentum.push(attacked ? (side === 'home' ? 1 : -1) : 0);
  if (state.momentum.length > MOMENTUM_WINDOW) state.momentum.shift();

  // Sessiz dakikalarda ara sıra renk katan anlatım
  if (state.events.length === eventsBefore && rng.chance(0.12)) {
    const team = teamOf(state, side);
    const carrier = team.onPitch.length > 0 ? rng.pick(team.onPitch) : null;
    emit(ctx, 'info', side, 'info', { team: team.name, player: carrier !== null ? nameOf(ctx, carrier) : '' });
  }

  applyFatigue(ctx, state.home);
  applyFatigue(ctx, state.away);
  autoSubstitutions(ctx, 'home');
  autoSubstitutions(ctx, 'away');
}

/**
 * Eleme maçında beraberlik: penaltı atışları. Önce 5'er atış (sonuç belli olunca biter), sonra tek tek.
 * Vurucular sahadakiler (seçilen penaltıcı önce, sonra penaltı becerisine göre; kaleci en son).
 */
function penaltyShootout(ctx: Ctx): void {
  const { state, rng, lookup } = ctx;
  const lineup = (side: Side) => {
    const team = teamOf(state, side);
    const keeper = team.onPitch.find((id) => state.players[id]!.slot === 'GK');
    const takers = team.onPitch
      .filter((id) => id !== keeper)
      .sort((a, b) => Number(b === team.penaltyTakerId) - Number(a === team.penaltyTakerId) ||
        lookup[b]!.attributes.penaltyTaking - lookup[a]!.attributes.penaltyTaking);
    if (keeper !== undefined) takers.push(keeper);
    return { takers, keeper };
  };
  const sides = { home: lineup('home'), away: lineup('away') };
  const pens: Shootout = { home: 0, away: 0, kicks: [] };
  state.penalties = pens;
  emit(ctx, 'shootout', null, 'shootoutStart');

  const kick = (side: Side, n: number) => {
    const { takers } = sides[side];
    if (takers.length === 0) return;
    const taker = takers[n % takers.length]!;
    const keeper = sides[other(side)].keeper;
    const a = lookup[taker]!.attributes;
    const skill = (a.penaltyTaking * 2 + a.composure) / 3;
    const save = keeper !== undefined ? (lookup[keeper]!.attributes.reflexes + lookup[keeper]!.attributes.oneOnOnes) / 2 : 5;
    const scored = rng.chance(Math.max(0.5, Math.min(0.92, 0.75 + (skill - 12) * 0.012 - (save - 12) * 0.01)));
    if (scored) pens[side]++;
    pens.kicks.push({ side, playerId: taker, scored });
    emit(ctx, 'shootout', side, scored ? 'shootoutGoal' : 'shootoutMiss', {
      player: nameOf(ctx, taker),
      keeper: keeper !== undefined ? nameOf(ctx, keeper) : '',
      hp: pens.home,
      ap: pens.away,
    });
  };
  /** İlk 5 atışta kalan atışlar yetişemiyorsa, sonrasında eşit sayıda atıştan sonra fark varsa biter. */
  const decided = (homeTaken: number, awayTaken: number) => {
    if (homeTaken <= 5 && awayTaken <= 5) {
      const homeLeft = 5 - homeTaken;
      const awayLeft = 5 - awayTaken;
      return pens.home > pens.away + awayLeft || pens.away > pens.home + homeLeft;
    }
    return homeTaken === awayTaken && pens.home !== pens.away;
  };
  for (let n = 0; n < 40; n++) {
    kick('home', n);
    if (decided(n + 1, n)) break;
    kick('away', n);
    if (decided(n + 1, n + 1)) break;
  }
  // Çok uzun seride (pratikte olmaz) yazı tura
  if (pens.home === pens.away) pens[rng.chance(0.5) ? 'home' : 'away']++;
  const winner = pens.home > pens.away ? state.home.name : state.away.name;
  emit(ctx, 'shootout', null, 'shootoutEnd', { winner, hp: pens.home, ap: pens.away });
}

/** Maç sonu puan düzeltmeleri: galibiyet/mağlubiyet, gol yemeyen savunma. */
function finalizeRatings(ctx: Ctx): void {
  const { state } = ctx;
  for (const ps of Object.values(state.players)) {
    if (ps.minuteIn === null) continue;
    const own = state.score[ps.side];
    const opp = state.score[other(ps.side)];
    if (own > opp) addRating(ctx, ps.playerId, 0.3);
    if (own < opp) addRating(ctx, ps.playerId, -0.3);
    const slot = ps.slot;
    if (opp === 0 && slot !== null) {
      if (slot === 'GK') addRating(ctx, ps.playerId, 0.4);
      else if (slot === 'DC' || slot === 'DR' || slot === 'DL' || slot === 'WBR' || slot === 'WBL') addRating(ctx, ps.playerId, 0.25);
    }
  }
}

/**
 * Maçı bir adım ilerletir: başlama, bir dakika, devre arası ya da bitiş.
 * Durumu yerinde değiştirir.
 */
export function stepMatch(state: MatchState, lookup: PlayerLookup): void {
  if (state.period === 'full') return;
  const ctx = makeCtx(state, lookup);
  const vars = () => ({ home: state.home.name, away: state.away.name, hg: state.score.home, ag: state.score.away });

  if (state.period === 'pre') {
    state.period = 'first';
    emit(ctx, 'kickoff', null, 'kickoff', vars());
  } else if (state.period === 'half') {
    state.period = 'second';
    state.minute = 45;
    // İkinci yarı santrasıyla başlar (2D sahada başlama dizilişi)
    state.lastPlay = null;
    state.timeline += '|';
    emit(ctx, 'secondhalf', null, 'secondhalf');
  } else {
    state.minute++;
    simulateMinute(ctx);
    if (state.lastPlay) state.timeline += playCode(state.lastPlay);
    if (state.period === 'first' && state.minute >= 45 + state.addedTime[0]) {
      state.period = 'half';
      emit(ctx, 'halftime', null, 'halftime', vars());
    } else if (state.period === 'second' && state.minute >= 90 + state.addedTime[1]) {
      state.period = 'full';
      finalizeRatings(ctx);
      emit(ctx, 'fulltime', null, 'fulltime', vars());
      // Eleme: beraberlikte (rövanşta toplam skorda eşitlikte) penaltı atışları
      const agg = state.aggregate ?? { home: 0, away: 0 };
      if (state.knockout && state.score.home + agg.home === state.score.away + agg.away) penaltyShootout(ctx);
    }
  }
  state.rngState = ctx.rng.getState();
}

/** Kullanıcının oyuncu değişikliği. Başarısızsa false. */
export function substitute(state: MatchState, lookup: PlayerLookup, side: Side, outId: number, inId: number): boolean {
  const ctx = makeCtx(state, lookup);
  const ok = makeSubstitution(ctx, side, outId, inId);
  state.rngState = ctx.rng.getState();
  return ok;
}

export function setMentality(state: MatchState, side: Side, mentality: Mentality): void {
  teamOf(state, side).instructions.mentality = mentality;
}

/**
 * Maç içi taktik değişikliği. Diziliş değişirse sahadaki oyuncular yeni mevkilere
 * en iyi uyumla dağıtılır (kaleci kalede kalır). Bitmiş maçta etkisizdir.
 */
export interface TacticsChange {
  formation?: FormationId;
  /** Kendi dizilişi; null hazır dizilişe döner, verilmezse değişmez. */
  custom?: CustomFormation | null;
  instructions?: Partial<TeamInstructions>;
  /** Mevki sırasına göre bireysel talimatlar (dizilişle birlikte verilir). */
  orders?: (PlayerOrders | null)[];
  /** Taktik seti (gösterim). */
  plan?: number;
}

/**
 * Sahadaki oyuncuların dizilişteki yerleri (mevki sırası): aynı mevkiden birden çok varsa sahadaki sıraya göre.
 * Dizilişte olmayan mevkideki oyuncu boştaki ilk yere konur. 2D saha da bu sırayı kullanır.
 */
export function slotHolders(team: TeamState, players: MatchState['players']): (number | null)[] {
  const slots = slotsOf(team);
  const holders: (number | null)[] = slots.map(() => null);
  const misplaced: number[] = [];
  for (const id of team.onPitch) {
    const slot = players[id]!.slot;
    const i = slots.findIndex((s, k) => s === slot && holders[k] === null);
    if (i === -1) misplaced.push(id);
    else holders[i] = id;
  }
  for (const id of misplaced) {
    const i = holders.findIndex((h, k) => k > 0 && h === null);
    if (i !== -1) holders[i] = id;
  }
  return holders;
}

/**
 * Maç içi taktik değişikliği. Diziliş değişirse sahadaki oyuncular yeni mevkilere
 * en iyi uyumla dağıtılır (kaleci kalede kalır). Bitmiş maçta etkisizdir.
 */
export function changeTactics(state: MatchState, lookup: PlayerLookup, side: Side, change: TacticsChange): void {
  if (state.period === 'full') return;
  const team = teamOf(state, side);
  if (change.instructions) team.instructions = { ...team.instructions, ...change.instructions };
  if (change.plan !== undefined) team.plan = change.plan;
  const formation = change.formation ?? team.formation;
  const custom = change.custom === undefined ? team.custom ?? null : change.custom;
  const before = slotsOf(team);
  const slots = slotsOf({ formation, custom });
  const reshaped = before.length !== slots.length || before.some((p, i) => p !== slots[i]) ||
    JSON.stringify(custom?.layout ?? null) !== JSON.stringify(team.custom?.layout ?? null);

  const ctx = makeCtx(state, lookup);
  let holders = slotHolders(team, state.players);
  if (reshaped) {
    const keeper = team.onPitch.find((id) => state.players[id]!.slot === 'GK');
    const outfield = team.onPitch.filter((id) => id !== keeper).map((id) => lookup[id]!);
    // Kaleci mevkisi hariç kalan 10 mevkiye saha oyuncularını dağıt.
    const assigned = assignToFormation(outfield, slots.slice(1));
    if (keeper !== undefined) state.players[keeper]!.slot = 'GK';
    assigned.forEach((id, i) => {
      if (id !== null) state.players[id]!.slot = slots[i + 1]!;
    });
    team.formation = formation;
    if (custom) team.custom = custom;
    else delete team.custom;
    team.fullWeights = formationWeights(slots);
    holders = [keeper ?? null, ...assigned];
    // Taşınan bireysel talimat yoksa eski talimatlar düşer (mevkiler değişti)
    if (!change.orders) for (const id of team.onPitch) delete state.players[id]!.orders;
    emit(ctx, 'info', side, 'tactic', { team: team.name, formation: formationName(team) });
  }
  if (change.orders) {
    holders.forEach((id, i) => {
      if (id === null) return;
      const o = change.orders![i];
      if (isDefaultOrders(o)) delete state.players[id]!.orders;
      else state.players[id]!.orders = { ...o! };
    });
  }
  state.rngState = ctx.rng.getState();
}

/** Maçı sonuna kadar oynatır; iki takımın kararlarını da yapay zekâ verir. */
export function simulateToEnd(state: MatchState, lookup: PlayerLookup): void {
  state.home.userControlled = false;
  state.away.userControlled = false;
  while (state.period !== 'full') stepMatch(state, lookup);
}

/* ------------------------------------------------------------------ */
/* Sonuç                                                                */
/* ------------------------------------------------------------------ */

function teamStats(state: MatchState, side: Side): TeamMatchStats {
  const total = state.possessionTicks.home + state.possessionTicks.away;
  const c = teamOf(state, side).counters;
  return {
    possession: total === 0 ? 50 : Math.round((state.possessionTicks[side] / total) * 100),
    ...c,
  };
}

export function buildResult(state: MatchState): MatchResult {
  const players: PlayerMatchRecord[] = Object.values(state.players)
    .filter((ps) => ps.minuteIn !== null)
    .map((ps) => ({
      playerId: ps.playerId,
      clubId: teamOf(state, ps.side).clubId,
      started: ps.started,
      minutes: Math.max(1, Math.min(90, (ps.minuteOut ?? 90) - ps.minuteIn!)),
      rating: Math.round(ps.rating * 10) / 10,
      goals: ps.goals,
      assists: ps.assists,
      condition: Math.round(ps.condition),
    }));
  const best = [...players].sort((a, b) => b.rating - a.rating)[0];
  const stats = { home: teamStats(state, 'home'), away: teamStats(state, 'away') };
  // Yuvarlama sonrası toplam 100 olsun.
  stats.away.possession = 100 - stats.home.possession;
  return {
    homeGoals: state.score.home,
    awayGoals: state.score.away,
    goals: [...state.goals],
    cards: [...state.cards],
    injuries: [...state.injuries],
    stats,
    players,
    manOfTheMatch: best?.playerId ?? null,
    shots: [...state.shots],
    timeline: state.timeline,
    ...(state.penalties ? { penalties: { home: state.penalties.home, away: state.penalties.away } } : {}),
  };
}
