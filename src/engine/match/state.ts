/** Canlı maç durumunun tipleri. Hepsi düz veri (serileştirilebilir). */
import type { CardEvent, GoalEvent, InjuryEvent, Position } from '../types';
import type { FormationId } from './formation';
import type { TeamInstructions } from './tactics';

export type Side = 'home' | 'away';

/** Çok defansif (-2) … çok hücum (+2). */
export type Mentality = -2 | -1 | 0 | 1 | 2;

export type Period = 'pre' | 'first' | 'half' | 'second' | 'full';

export type MatchEventType =
  | 'kickoff'
  | 'halftime'
  | 'secondhalf'
  | 'fulltime'
  | 'goal'
  | 'save'
  | 'miss'
  | 'blocked'
  | 'corner'
  | 'foul'
  | 'freekick'
  | 'penalty'
  | 'penaltyMiss'
  | 'yellow'
  | 'red'
  | 'injury'
  | 'sub'
  | 'tackle'
  | 'info';

/** 2D saha için: dakikanın en önemli anı (motor sonucu etkilemez, yalnızca gösterim). */
export type PlayKind =
  | 'hold' // top orta alanda dolaşıyor
  | 'foul'
  | 'attack' // şuta dönüşmeyen atak
  | 'corner'
  | 'freekick'
  | 'blocked'
  | 'miss'
  | 'save'
  | 'penalty' // kaçan / kurtarılan penaltı
  | 'goal';

export interface MatchPlay {
  /** Anı yaşayan (topa sahip / şutu çeken / faulden yararlanan) taraf. */
  side: Side;
  kind: PlayKind;
  /** Şutu çeken ya da golü atan oyuncu. */
  playerId: number | null;
  /** Şut penaltıdan mı (top penaltı noktasından çıkar). */
  fromPenalty?: boolean;
}

export interface MatchEvent {
  minute: number;
  extra: number;
  type: MatchEventType;
  side: Side | null;
  text: string;
}

export interface PlayerMatchState {
  playerId: number;
  side: Side;
  /** Sahadaysa oynadığı mevki, değilse null. */
  slot: Position | null;
  started: boolean;
  /** Oyuna girdiği dakika (ilk 11 için 0); hiç girmediyse null. */
  minuteIn: number | null;
  minuteOut: number | null;
  /** Maç içi kondisyon 0–100. */
  condition: number;
  /** Günlük form: verime küçük çarpan (−0.1 … +0.1 civarı). */
  dayForm: number;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellow: boolean;
  red: boolean;
  injured: boolean;
}

export interface TeamCounters {
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface TeamState {
  clubId: string;
  name: string;
  side: Side;
  /** Sahadaki oyuncular. */
  onPitch: number[];
  /** Henüz oyuna girmemiş yedekler. */
  bench: number[];
  subsUsed: number;
  formation: FormationId;
  /** Mentalite dahil takım talimatları (yapay zekâ takımında mentalite skora göre değişir). */
  instructions: TeamInstructions;
  captainId: number | null;
  penaltyTakerId: number | null;
  freeKickTakerId: number | null;
  /** true: değişiklik ve taktiği kullanıcı yönetir (sakatlık değişikliği yine otomatik). */
  userControlled: boolean;
  counters: TeamCounters;
  /** Başlangıçtaki 11'in birim ağırlık toplamları; eksik oyuncu takımı zayıflatsın diye sabit. */
  fullWeights: { att: number; mid: number; def: number };
}

export interface MatchState {
  fixtureId: number;
  /** Maçın RNG tohumu (başlama öncesi kadro değişirse maç aynı tohumla yeniden kurulur). */
  seed: number;
  period: Period;
  /** Geçen dakika (uzatmalar dahil): ilk yarı 1–45+a, ikinci yarı 46–90+b. */
  minute: number;
  /** [ilk yarı uzatması, ikinci yarı uzatması] */
  addedTime: [number, number];
  score: { home: number; away: number };
  home: TeamState;
  away: TeamState;
  players: Record<number, PlayerMatchState>;
  events: MatchEvent[];
  goals: GoalEvent[];
  cards: CardEvent[];
  injuries: InjuryEvent[];
  possessionTicks: { home: number; away: number };
  /** Son dakikaların baskısı: +1 ev sahibi atağı, −1 deplasman atağı, 0 sakin. */
  momentum: number[];
  /** Son oynanan dakikanın en önemli anı (2D saha); maç başlamadıysa ya da aradaysa null. */
  lastPlay: MatchPlay | null;
  rngState: number;
}

export const MAX_SUBS = 5;
export const MOMENTUM_WINDOW = 10;

/** Ekranda gösterilecek dakika: 47. dakika ilk yarıdaysa 45+2. */
export function displayMinute(state: Pick<MatchState, 'period' | 'minute'>): { minute: number; extra: number } {
  const limit = state.period === 'first' || state.period === 'half' || state.period === 'pre' ? 45 : 90;
  return state.minute > limit ? { minute: limit, extra: state.minute - limit } : { minute: state.minute, extra: 0 };
}

export function formatMinute(minute: number, extra = 0): string {
  return extra > 0 ? `${minute}+${extra}'` : `${minute}'`;
}
