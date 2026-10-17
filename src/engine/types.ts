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
}
