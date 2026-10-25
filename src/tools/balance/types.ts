/** Denge raporunun ham verisi ve sonuç tipleri. */
import type { Status } from './stats';

/** Bir lig maçı (yalnızca denge için gereken alanlar). */
export interface MatchRow {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  penaltyGoals: number;
}

/** Süper Lig kulübünün sezonu. */
export interface ClubSeason {
  clubId: string;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  /** İlk lig maçından sonra ilk 11'in ortalama yeteneği (gizli CA). */
  strength: number;
  /** Sezon sonu kasa (€). */
  balance: number;
  wageBudget: number;
  /** Son 12 ayın toplam geliri / transfer harcaması / transfer geliri (€). */
  income12: number;
  transferSpend12: number;
  transferIncome12: number;
  /** Son 12 ayın gerçek maaş gideri, diğer giderler (prim, imza, menajer, gözlemci, tesis) ve ödül geliri (€). */
  wages12: number;
  otherExpense12: number;
  prize12: number;
  /** Kulübün temel transfer bütçesi (club.budget) ve sezon sonunda kalan transfer bütçesi (€). */
  baseBudget: number;
  transferBudget: number;
}

export interface EuropeSeason {
  comp: 'cl' | 'el';
  /** Türk katılımcı sayısı. */
  turkishClubs: number;
  /** Eleme turuna (çeyrek final ve sonrası) kalan Türk kulübü. */
  turkishKnockout: number;
  turkishFinalists: number;
  turkishWinner: boolean;
}

export interface SeasonSnapshot {
  career: number;
  year: number;
  userClubId: string;
  userPosition: number;
  userTarget: number;
  championId: string;
  matches: MatchRow[];
  clubs: ClubSeason[];
  topScorerGoals: number;
  topAssists: number;
  /** `fees`: bonservisli transferlerin bedelleri (€), `cas`: aynı sırayla oyuncuların sezon sonundaki CA'sı. */
  transfers: { count: number; fee: number; maxFee: number; free: number; loans: number; fees: number[]; cas: number[] };
  europe: EuropeSeason[];
  /** Dünyanın büyüklüğü: Süper Lig A takım büyüklükleri, serbest oyuncu havuzu, altyapı havuzu (sezon sonu). */
  pool: { squadMean: number; squadMin: number; freeAgents: number; academy: number; total: number };
  /** İlk sezon sonunda ligdeki oyuncuların aynı grubu: sonraki sezonlarda (hangi kulüpte olursa olsun) hayatta kalanların ortalaması. */
  cohort: { size: number; alive: number; meanCA: number; meanAge: number };
  /** Süper Lig oyuncuları (A takım). */
  talent: { eliteMeanCA: number; maxCA: number; over150: number; meanAge: number; caByAge: { u22: number; mid: number; o29: number } };
}

export interface SackEvent {
  career: number;
  year: number;
  date: string;
  reason: string;
  clubId: string;
}

export interface CareerLog {
  career: number;
  seed: number;
  userClubId: string;
  seasons: SeasonSnapshot[];
  sacks: SackEvent[];
}

export interface RawData {
  /** Koşunun ayarları (rapora yazılır, tekrar üretilebilsin). */
  config: { careers: number; seasons: number; baseSeed: number; clubs: string[] };
  careers: CareerLog[];
  /** Koşu süresi (sn). */
  elapsedSec: number;
}

export interface MetricResult {
  id: string;
  group: string;
  label: string;
  /** Ölçülen değer (birim `unit` ile). */
  value: number;
  /** Standart hata (varsa). */
  se?: number;
  /** Örnek sayısı. */
  n: number;
  unit: string;
  /** Hedef aralığı; yoksa yalnızca bilgi. */
  target: readonly [number, number] | null;
  status: Status;
  /** Hedef tutmazsa nereye bakılacağı. */
  tune?: string;
  /** Ek bilgi (yorum, dağılım). */
  note?: string;
}

export interface Report {
  generatedAt: string;
  config: RawData['config'];
  elapsedSec: number;
  metrics: MetricResult[];
  /** Sezon sezon eğilimler (sütunlar: yıl dizisi). */
  trends: { id: string; label: string; unit: string; values: number[] }[];
  /** Kovulmalar ve genel notlar. */
  notes: string[];
}
