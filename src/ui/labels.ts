/** Motor anahtarlarının Türkçe karşılıkları ve biçimlendirme yardımcıları. */
import type { AttributeKey, FanExpectation, Foot, GameDate, Position } from '../engine';
import { gameData } from '../gameData';

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  corners: 'Korner',
  crossing: 'Orta',
  dribbling: 'Top Sürme',
  finishing: 'Bitiricilik',
  firstTouch: 'İlk Kontrol',
  freeKicks: 'Serbest Vuruş',
  heading: 'Kafa',
  longShots: 'Uzaktan Şut',
  longThrows: 'Uzun Taç',
  marking: 'Markaj',
  passing: 'Pas',
  penaltyTaking: 'Penaltı',
  tackling: 'Top Kapma',
  technique: 'Teknik',
  aggression: 'Agresiflik',
  anticipation: 'Önsezi',
  bravery: 'Cesaret',
  composure: 'Soğukkanlılık',
  concentration: 'Konsantrasyon',
  creativity: 'Yaratıcılık',
  decisions: 'Karar Verme',
  determination: 'Kararlılık',
  flair: 'Yetenek',
  leadership: 'Liderlik',
  offTheBall: 'Topsuz Oyun',
  positioning: 'Pozisyon Alma',
  teamwork: 'Takım Oyunu',
  workRate: 'Çalışkanlık',
  acceleration: 'Hızlanma',
  agility: 'Çeviklik',
  balance: 'Denge',
  jumping: 'Zıplama',
  naturalFitness: 'Doğal Kondisyon',
  pace: 'Hız',
  stamina: 'Dayanıklılık',
  strength: 'Güç',
  aerialAbility: 'Hava Hakimiyeti',
  commandOfArea: 'Alan Hakimiyeti',
  communication: 'İletişim',
  eccentricity: 'Eksantriklik',
  handling: 'Topu Kontrol',
  kicking: 'Degaj',
  oneOnOnes: 'Bire Bir',
  reflexes: 'Refleks',
  rushingOut: 'Kaleden Çıkma',
  throwing: 'Elle Oyun Kurma',
};

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'KL',
  DR: 'SĞB',
  DC: 'STP',
  DL: 'SLB',
  WBR: 'SĞKB',
  WBL: 'SLKB',
  DM: 'DOS',
  MR: 'SĞO',
  MC: 'MO',
  ML: 'SLO',
  AMR: 'SĞK',
  AMC: 'OOS',
  AML: 'SLK',
  ST: 'FV',
};

export const POSITION_NAMES: Record<Position, string> = {
  GK: 'Kaleci',
  DR: 'Sağ Bek',
  DC: 'Stoper',
  DL: 'Sol Bek',
  WBR: 'Sağ Kanat Bek',
  WBL: 'Sol Kanat Bek',
  DM: 'Defansif Orta Saha',
  MR: 'Sağ Orta Saha',
  MC: 'Merkez Orta Saha',
  ML: 'Sol Orta Saha',
  AMR: 'Sağ Kanat',
  AMC: 'Ofansif Orta Saha',
  AML: 'Sol Kanat',
  ST: 'Forvet',
};

export const FOOT_LABELS: Record<Foot, string> = {
  right: 'Sağ',
  left: 'Sol',
  both: 'Her ikisi',
};

export const EXPECTATION_LABELS: Record<FanExpectation, string> = {
  title: 'Şampiyonluk',
  europe: 'Avrupa kupaları',
  top_half: 'İlk yarı',
  mid_table: 'Orta sıralar',
  avoid_relegation: 'Ligde kalmak',
};

export function moraleLabel(morale: number): string {
  if (morale >= 90) return 'Süper';
  if (morale >= 75) return 'Çok İyi';
  if (morale >= 60) return 'İyi';
  if (morale >= 45) return 'Normal';
  if (morale >= 30) return 'Kötü';
  if (morale >= 15) return 'Çok Kötü';
  return 'Berbat';
}

export function familiarityLabel(value: number): string {
  if (value >= 18) return 'Doğal';
  if (value >= 13) return 'Becerikli';
  if (value >= 9) return 'Yeterli';
  return 'Zayıf';
}

export function nationName(code: string): string {
  return gameData.nations.find((n) => n.code === code)?.name ?? code;
}

const numberFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

/** €12,5 Mn / €850 bin / €900 */
export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `€${numberFmt.format(amount / 1_000_000)} Mn`;
  if (amount >= 1_000) return `€${Math.round(amount / 1_000)} bin`;
  return `€${Math.round(amount)}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}

/** '2026-07-01' → '01.07.2026' */
export function formatDateShort(date: GameDate): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

/** Özellik değerine göre CSS sınıfı (FM'deki renkli değerler gibi). */
export function attrClass(value: number): string {
  if (value >= 16) return 'attr attr-elite';
  if (value >= 13) return 'attr attr-good';
  if (value <= 5) return 'attr attr-poor';
  return 'attr';
}

const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** '2026-08-15' → '15 Ağu' */
export function formatDayMonth(date: GameDate): string {
  return `${Number(date.slice(8, 10))} ${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}`;
}

/** Maç sonucu harfi (Türkçe): G = galibiyet, B = beraberlik, M = mağlubiyet. */
export const OUTCOME_LABELS: Record<'W' | 'D' | 'L', string> = { W: 'G', D: 'B', L: 'M' };

export type PositionGroup = 'gk' | 'def' | 'mid' | 'att';

/** Mevki kutusu rengi için grup. */
export function positionGroup(position: Position): PositionGroup {
  if (position === 'GK') return 'gk';
  if (position === 'DR' || position === 'DC' || position === 'DL' || position === 'WBR' || position === 'WBL') return 'def';
  if (position === 'AMR' || position === 'AMC' || position === 'AML' || position === 'ST') return 'att';
  return 'mid';
}

/** "1 Temmuz 2026, Çarşamba" → { day: 'Çarşamba', date: '1 Temmuz 2026' } */
export function splitDateTR(formatted: string): { day: string; date: string } {
  const [date = '', day = ''] = formatted.split(', ');
  return { day, date };
}

export const MENTALITY_LABELS: Record<-2 | -1 | 0 | 1 | 2, string> = {
  [-2]: 'Çok Defansif',
  [-1]: 'Defansif',
  0: 'Dengeli',
  1: 'Hücum',
  2: 'Çok Hücum',
};

/** Maç puanı rengi: 7.5+ yeşil, 6.5+ sarı, 6 altı kırmızımsı. */
export function ratingClass(rating: number): string {
  if (rating >= 7.5) return 'rating rating-great';
  if (rating >= 6.5) return 'rating rating-good';
  if (rating < 6) return 'rating rating-poor';
  return 'rating';
}

/** Takım talimatı seçenekleri: etiket + kısa açıklama (taktik ekranında ipucu olarak). */
export const INSTRUCTION_OPTIONS = {
  passing: [
    { value: 'short', label: 'Kısa', hint: 'Topu elde tutar; iyi pasörlerle daha etkili, daha az ama daha net pozisyon.' },
    { value: 'mixed', label: 'Karışık', hint: 'Dengeli oyun.' },
    { value: 'direct', label: 'Uzun', hint: 'Hızlı hücum, daha çok atak ve kafa topu; top daha çabuk kaybedilir.' },
  ],
  tempo: [
    { value: 'slow', label: 'Yavaş', hint: 'Sabırlı oyun, daha kaliteli pozisyonlar, daha az yorgunluk.' },
    { value: 'normal', label: 'Normal', hint: 'Dengeli tempo.' },
    { value: 'fast', label: 'Hızlı', hint: 'Daha çok atak ama aceleci şutlar; oyuncular daha çok yorulur.' },
  ],
  pressing: [
    { value: 'low', label: 'Az', hint: 'Kompakt, az faul, az yorgunluk; rakip topu rahat tutar.' },
    { value: 'normal', label: 'Normal', hint: 'Dengeli pres.' },
    { value: 'high', label: 'Yoğun', hint: 'Rakibin top hakimiyetini düşürür; çok yorar, faul ve kart riski artar.' },
  ],
  defensiveLine: [
    { value: 'deep', label: 'Derin', hint: 'Arkaya alan bırakmaz, rakip şut bulur ama zor pozisyonlardan.' },
    { value: 'normal', label: 'Normal', hint: 'Dengeli savunma hattı.' },
    { value: 'high', label: 'Yüksek', hint: 'Takımı ileri taşır; hızlı rakip forvetlere karşı arkada tehlike.' },
  ],
} as const;

export const MENTALITY_HINTS: Record<-2 | -1 | 0 | 1 | 2, string> = {
  [-2]: 'Kapan ve skoru koru: az atak, rakibe az alan.',
  [-1]: 'Önce savunma, kontra fırsatlarını kolla.',
  0: 'Dengeli oyun.',
  1: 'Daha çok atak, rakibe daha çok alan.',
  2: 'Her şeyiyle hücum: çok şut ama arkada büyük boşluklar.',
};

/** Mevki uyumu (0–1) → uyarı sınıfı. */
export function fitClass(fit: number): 'fit-good' | 'fit-ok' | 'fit-bad' {
  if (fit >= 0.95) return 'fit-good';
  if (fit >= 0.82) return 'fit-ok';
  return 'fit-bad';
}
