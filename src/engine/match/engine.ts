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
  assignToFormation,
  DEFAULT_FORMATION_ID,
  FORMATIONS,
  slotFit,
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
  type Side,
  type TeamState,
} from './state';
import {
  DEFAULT_INSTRUCTIONS,
  instructionEffects,
  NEUTRAL_EFFECTS,
  type InstructionEffects,
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
  for (const id of team.onPitch) {
    const ps = state.players[id]!;
    const p = lookup[id]!;
    const eff = efficiency(ps, p);
    if (ps.slot === 'GK') {
      gk = keeperScore(p.attributes) * eff;
      continue;
    }
    const w = SLOT_WEIGHTS[ps.slot!];
    att += w.att * eff * attackScore(p.attributes);
    mid += w.mid * eff * midfieldScore(p.attributes);
    def += w.def * eff * defenceScore(p.attributes);
    passing.push((p.attributes.passing + p.attributes.technique) / 2);
    if (DEFENSIVE_SLOTS.has(ps.slot!)) defencePace.push(p.attributes.pace);
    if (ATTACKING_SLOTS.has(ps.slot!)) attackPace.push(p.attributes.pace);
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
    },
  };
}

/** Birim ağırlık toplamları: eksik oyuncu takımı zayıflatsın diye 11 kişilik dizilişten hesaplanır. */
function formationWeights(slots: readonly Position[]): TeamState['fullWeights'] {
  const fw = { att: 0, mid: 0, def: 0 };
  for (const slot of slots) {
    const w = SLOT_WEIGHTS[slot];
    fw.att += w.att;
    fw.mid += w.mid;
    fw.def += w.def;
  }
  return { att: Math.max(fw.att, 0.1), mid: Math.max(fw.mid, 0.1), def: Math.max(fw.def, 0.1) };
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
  instructions?: TeamInstructions;
  /** Boşsa (otomatik) ilk 11'in en yüksek liderlikli oyuncusu; yardımcı kaptan ikincisi. */
  captainId?: number | null;
  viceCaptainId?: number | null;
  penaltyTakerId?: number | null;
  freeKickTakerId?: number | null;
}

export interface MatchSetup {
  fixtureId: number;
  home: TeamSetup;
  away: TeamSetup;
  seed: number;
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
  for (const { playerId, slot } of setup.lineup.starters) {
    players[playerId] = newPlayerState(rng, lookup[playerId]!, side, slot);
  }
  for (const id of setup.lineup.bench) players[id] = newPlayerState(rng, lookup[id]!, side, null);
  const formation = setup.formation ?? DEFAULT_FORMATION_ID;
  return {
    clubId: setup.clubId,
    name: setup.name,
    side,
    onPitch: setup.lineup.starters.map((s) => s.playerId),
    bench: [...setup.lineup.bench],
    subsUsed: 0,
    formation,
    instructions: { ...(setup.instructions ?? DEFAULT_INSTRUCTIONS) },
    captainId,
    viceCaptainId: setup.viceCaptainId ?? autoLeaders.find((id) => id !== captainId) ?? null,
    penaltyTakerId: setup.penaltyTakerId ?? null,
    freeKickTakerId: setup.freeKickTakerId ?? null,
    userControlled: setup.userControlled ?? false,
    counters: { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, yellowCards: 0, redCards: 0 },
    fullWeights: formationWeights(FORMATIONS[formation]),
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
function shotKindFor(rng: Rng, slot: Position, headerBonus: number): GoalKind {
  const [baseHeader, long] =
    slot === 'ST' ? [0.22, 0.08]
      : slot === 'AMC' || slot === 'AMR' || slot === 'AML' ? [0.1, 0.3]
        : slot === 'DC' || slot === 'DR' || slot === 'DL' || slot === 'WBR' || slot === 'WBL' ? [0.45, 0.3]
          : [0.12, 0.55];
  const header = baseHeader + headerBonus;
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

function scoreGoal(ctx: Ctx, side: Side, scorerId: number, kind: GoalKind): number | null {
  const { state, rng } = ctx;
  const team = teamOf(state, side);
  const opp = teamOf(state, other(side));
  state.score[side]++;

  // Asist: penaltı ve serbest vuruş hariç gollerin çoğunda.
  let assistId: number | null = null;
  if (kind !== 'penalty' && kind !== 'freekick' && rng.chance(0.72)) {
    assistId = pickOnPitch(
      ctx,
      side,
      (ps, p) =>
        CREATOR_WEIGHT[ps.slot!] *
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
function resolveShot(ctx: Ctx, side: Side, shooterId: number, kind: GoalKind, threat: number, fromCorner = false): void {
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
  const quality = ctx.effects[side].shotQuality;
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
    const assistId = scoreGoal(ctx, side, shooterId, kind);
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

function awardCorner(ctx: Ctx, side: Side): void {
  const team = teamOf(ctx.state, side);
  team.counters.corners++;
  recordPlay(ctx, side, 'corner');
  emit(ctx, 'corner', side, 'corner', { team: team.name });
  if (!ctx.rng.chance(TUNING.cornerShotChance)) return;
  const shooter = pickOnPitch(ctx, side, (ps, p) => {
    const tall = ps.slot === 'DC' || ps.slot === 'ST' ? 2.5 : ps.slot === 'GK' ? 0 : 0.6;
    return tall * (p.attributes.heading + p.attributes.jumping);
  });
  if (shooter !== null) resolveShot(ctx, side, shooter, 'header', 1, true);
}

/* ------------------------------------------------------------------ */
/* Atak, faul, sakatlık                                                 */
/* ------------------------------------------------------------------ */

function resolveAttack(ctx: Ctx, side: Side, units: Record<Side, Units>): void {
  const { state, rng } = ctx;
  const oppSide = other(side);

  const homeBoost = side === 'home' ? TUNING.homeAttack : 1;
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
    SHOOTER_WEIGHT[ps.slot!] * (p.attributes.finishing + p.attributes.offTheBall + p.attributes.longShots * 0.5));
  if (shooterId === null) return;
  const kind = shotKindFor(rng, state.players[shooterId]!.slot!, ctx.effects[side].headerBonus);
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
      resolveShot(ctx, victimSide, taker, 'freekick', 1);
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
  if (!rng.chance(TUNING.injuryChance * (proneness / 10))) return;
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
    home: instructionEffects(state.home.instructions, units.home.profile, units.away.profile),
    away: instructionEffects(state.away.instructions, units.away.profile, units.home.profile),
  };
  ctx.effects = effects;

  // Top hakimiyeti: orta saha gücü × kendi talimatları × rakibin presi
  const mh = units.home.mid * TUNING.homeMidfield * effects.home.midfield * effects.away.oppMidfield;
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
  if (rng.chance(TUNING.attackChance * effects[side].attackChance)) {
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
export function changeTactics(
  state: MatchState,
  lookup: PlayerLookup,
  side: Side,
  change: { formation?: FormationId; instructions?: Partial<TeamInstructions> },
): void {
  if (state.period === 'full') return;
  const team = teamOf(state, side);
  if (change.instructions) team.instructions = { ...team.instructions, ...change.instructions };
  if (!change.formation || change.formation === team.formation) return;

  const ctx = makeCtx(state, lookup);
  const slots = FORMATIONS[change.formation];
  const keeper = team.onPitch.find((id) => state.players[id]!.slot === 'GK');
  const outfield = team.onPitch.filter((id) => id !== keeper).map((id) => lookup[id]!);
  // Kaleci mevkisi hariç kalan 10 mevkiye saha oyuncularını dağıt.
  const assigned = assignToFormation(outfield, slots.slice(1));
  if (keeper !== undefined) state.players[keeper]!.slot = 'GK';
  assigned.forEach((id, i) => {
    if (id !== null) state.players[id]!.slot = slots[i + 1]!;
  });
  team.formation = change.formation;
  team.fullWeights = formationWeights(slots);
  emit(ctx, 'info', side, 'tactic', { team: team.name, formation: change.formation });
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
  };
}
