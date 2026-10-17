import type { Attributes, HiddenAttributes } from './attributes';
import type { GameDate } from './date';

export type Position =
  | 'GK'
  | 'DR' | 'DC' | 'DL'
  | 'WBR' | 'WBL'
  | 'DM'
  | 'MR' | 'MC' | 'ML'
  | 'AMR' | 'AMC' | 'AML'
  | 'ST';

export type Foot = 'right' | 'left' | 'both';

export type FanExpectation = 'title' | 'europe' | 'top_half' | 'mid_table' | 'avoid_relegation';

/** data/clubs.json içindeki bir kulüp. Para birimi €. */
export interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stadium: string;
  capacity: number;
  /** 1–100; kadro gücünü, maaşları ve ileride transfer çekiciliğini belirler. */
  reputation: number;
  /** Transfer bütçesi (€). */
  budget: number;
  /** Yıllık maaş bütçesi (€). */
  wageBudget: number;
  fanExpectation: FanExpectation;
  colors: { primary: string; secondary: string };
}

export interface Contract {
  /** Yıllık brüt maaş (€). */
  wage: number;
  expires: GameDate;
}

export interface Injury {
  name: string;
  daysOut: number;
}

export interface Player {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: GameDate;
  /** data/nations.json içindeki ülke kodu (örn. 'TUR'). */
  nationality: string;
  clubId: string | null;
  squadNumber: number | null;
  /** Pozisyon yatkınlığı 1–20; 18+ "doğal" pozisyon sayılır. Listede olmayan = oynayamaz. */
  positions: Partial<Record<Position, number>>;
  foot: Foot;
  attributes: Attributes;
  hidden: HiddenAttributes;
  /** Mevcut yetenek 1–200 (gizli). Özelliklerden hesaplanır. */
  currentAbility: number;
  /** Potansiyel yetenek 1–200 (gizli), her zaman ≥ currentAbility. */
  potentialAbility: number;
  /** 0–100 */
  morale: number;
  /** Son maç puanları (en yeni sonda). 8. aşamada dolacak. */
  form: number[];
  /** Kondisyon 0–100 (%). */
  condition: number;
  injury: Injury | null;
  contract: Contract;
}

export type GoalKind = 'normal' | 'header' | 'long' | 'freekick' | 'penalty';

export interface GoalEvent {
  /** Normal süre dakikası (en fazla 45 / 90). */
  minute: number;
  /** Uzatma dakikası: 45+2 → minute 45, extra 2. */
  extra?: number;
  clubId: string;
  playerId: number;
  assistId?: number | null;
  kind?: GoalKind;
}

export interface CardEvent {
  minute: number;
  extra?: number;
  clubId: string;
  playerId: number;
  /** 'red' = direkt ya da ikinci sarıdan kırmızı. */
  type: 'yellow' | 'red';
}

export interface InjuryEvent {
  minute: number;
  extra?: number;
  clubId: string;
  playerId: number;
}

export interface TeamMatchStats {
  /** Topla oynama yüzdesi (0–100). */
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

/** Bir oyuncunun maçtaki kaydı (ilk 11 ve oyuna girenler). */
export interface PlayerMatchRecord {
  playerId: number;
  clubId: string;
  started: boolean;
  minutes: number;
  /** 1–10, tek ondalık. */
  rating: number;
  goals: number;
  assists: number;
}

export interface MatchResult {
  homeGoals: number;
  awayGoals: number;
  /** Dakika sırasına göre goller. */
  goals: GoalEvent[];
  cards: CardEvent[];
  injuries: InjuryEvent[];
  stats: { home: TeamMatchStats; away: TeamMatchStats };
  players: PlayerMatchRecord[];
  /** Maçın adamı. */
  manOfTheMatch: number | null;
}

export interface Fixture {
  id: number;
  /** 1–34 */
  round: number;
  date: GameDate;
  homeId: string;
  awayId: string;
  /** Oynanmadıysa null. */
  result: MatchResult | null;
}

export interface Season {
  /** Sezonun başladığı yıl: 2026 → "2026/27" */
  year: number;
  fixtures: Fixture[];
}

/** Oyunun tüm durumu — ileride kayıt dosyasına bu yazılacak. */
export interface GameWorld {
  seed: number;
  /** Rng.getState(); oyun ilerlerken rastgelelik buradan devam eder. */
  rngState: number;
  date: GameDate;
  playerClubId: string;
  clubs: Club[];
  players: Record<number, Player>;
  nextPlayerId: number;
  season: Season;
}
