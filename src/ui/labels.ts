/** Motor anahtarlarının Türkçe karşılıkları ve biçimlendirme yardımcıları. */
import { abilityEstimate, potentialEstimate } from '../engine';
import type { AttributeKey, FanExpectation, Foot, GameDate, GameWorld, Player, Position, ScoutVerdict } from '../engine';
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

export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

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

export const ROLE_LABELS: Record<import('../engine').SquadRole, string> = {
  star: 'Önemli oyuncu',
  rotation: 'Rotasyon',
  backup: 'Yedek',
};

export const AGENT_STYLE_LABELS: Record<import('../engine').AgentStyle, string> = {
  fair: 'Makul',
  greedy: 'Açgözlü',
  tough: 'Sert',
};

export const AGENT_STYLE_HINTS: Record<import('../engine').AgentStyle, string> = {
  fair: 'Talepleri ölçülü, sabırlı; menajer ücreti düşük.',
  greedy: 'Yüksek menajer ücreti ister, ücretsiz imza yok; ücret verilirse maaştan iner.',
  tough: 'Yüksek maaş ister, sabrı az; serbest kalma bedeli şart koşar.',
};

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
  width: [
    { value: 'narrow', label: 'Dar', hint: 'Orta saha kalabalık ve kompakt; kanatlardan az orta, az korner.' },
    { value: 'normal', label: 'Normal', hint: 'Dengeli genişlik.' },
    { value: 'wide', label: 'Geniş', hint: 'Kanatları kullanır: daha çok orta, kafa ve korner; ortada boşluk kalır.' },
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

export const OFFER_STATUS_LABELS: Record<import('../engine').OfferStatus, string> = {
  pending: 'Bekliyor',
  countered: 'Karşı teklif',
  accepted: 'Kabul edildi',
  rejected: 'Reddedildi',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  collapsed: 'Anlaşma yok',
};

export const NEWS_CATEGORY_LABELS: Record<import('../engine').NewsCategory, string> = {
  transfer: 'Transfer',
  offer: 'Teklif',
  finance: 'Finans',
  window: 'Transfer Dönemi',
  contract: 'Sözleşme',
  loan: 'Kiralık',
  injury: 'Sakatlık',
  discipline: 'Disiplin',
  player: 'Oyuncu',
  training: 'Antrenman',
  board: 'Yönetim',
  season: 'Sezon',
  academy: 'Altyapı',
  scouting: 'Gözlemci',
  cup: 'Kupa',
  europe: 'Avrupa',
};

export const INCOME_LABELS: Record<import('../engine').IncomeCategory, string> = {
  tickets: 'Bilet',
  tv: 'Yayın',
  sponsor: 'Sponsor',
  transfersIn: 'Transfer Geliri',
  prize: 'Ödül',
};

export const EXPENSE_LABELS: Record<import('../engine').ExpenseCategory, string> = {
  wages: 'Maaşlar',
  bonuses: 'Primler',
  transfersOut: 'Transfer Gideri',
  signingBonuses: 'İmza Bonusu',
  agentFees: 'Menajer Ücretleri',
  scouting: 'Gözlemcilik',
};

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** '2026-08' → 'Ağustos 2026' */
export function formatMonth(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Negatif tutarları da gösteren para biçimi: −€1,2 Mn */
export function formatSignedMoney(amount: number): string {
  return amount < 0 ? `−${formatMoney(-amount)}` : formatMoney(amount);
}

export const TRAINING_FOCUS_OPTIONS: { value: import('../engine').TrainingFocus; label: string; hint: string }[] = [
  { value: 'balanced', label: 'Dengeli', hint: 'Tüm özellikler mevkiye göre gelişir.' },
  { value: 'physical', label: 'Fiziksel', hint: 'Hız, dayanıklılık, güç, çeviklik öne çıkar.' },
  { value: 'technical', label: 'Teknik', hint: 'Pas, top sürme, bitiricilik, ilk kontrol gibi teknik özellikler.' },
  { value: 'tactical', label: 'Taktik', hint: 'Karar verme, pozisyon alma, önsezi gibi zihinsel özellikler.' },
  { value: 'attacking', label: 'Hücum', hint: 'Bitiricilik, topsuz oyun, yaratıcılık, orta, uzaktan şut.' },
  { value: 'defending', label: 'Savunma', hint: 'Markaj, top kapma, pozisyon alma, kafa, konsantrasyon.' },
];

export const TRAINING_INTENSITY_OPTIONS: { value: import('../engine').TrainingIntensity; label: string; hint: string }[] = [
  { value: 'light', label: 'Hafif', hint: 'Gelişim %20 yavaş; oyuncular tam dinlenik (%100), sakatlık riski düşük.' },
  { value: 'normal', label: 'Normal', hint: 'Dengeli program; kondisyon %98\'e kadar toparlanır.' },
  { value: 'hard', label: 'Yoğun', hint: 'Gelişim %25 hızlı; kondisyon en fazla %94, sakatlık riski yüksek.' },
];

/** Gelişim eğilimi oku. */
export function trendSymbol(trend: number): { text: string; className: string } {
  if (trend >= 1.5) return { text: '▲▲', className: 'trend-up' };
  if (trend >= 0.5) return { text: '▲', className: 'trend-up' };
  if (trend <= -1.5) return { text: '▼▼', className: 'trend-down' };
  if (trend <= -0.5) return { text: '▼', className: 'trend-down' };
  return { text: '–', className: 'muted' };
}

/** Antrenör raporu: yetenek (CA/PA) → 0.5–5 yıldız (lig ölçeğinde: 170+ = 5 yıldız). */
export function abilityStars(ability: number): number {
  return Math.max(0.5, Math.min(5, Math.round(((ability - 45) / 25) * 2) / 2));
}

/** Son 6 ayın gelişimi (yetenek puanı gizli; yalnızca bu etiket gösterilir). */
export const GROWTH_LABELS: Record<import('../engine').GrowthRate, { text: string; className: string }> = {
  fast: { text: 'Hızlı gelişiyor', className: 'trend-up strong' },
  good: { text: 'İyi gelişiyor', className: 'trend-up' },
  slow: { text: 'Yavaş', className: 'muted' },
  falling: { text: 'Geriliyor', className: 'trend-down' },
  none: { text: '—', className: 'muted' },
};

/**
 * Yetenek / potansiyel yıldızları: kendi oyuncumuzda antrenör raporu (kesin), başka kulübün oyuncusunda
 * bilgi düzeyine göre tahmin (gözlemci sistemi; oyuncuya özgü sabit sapma, her bakışta aynı).
 */
export function abilityStarsFor(world: GameWorld, player: Player): number {
  return abilityStars(abilityEstimate(world, player));
}

export function potentialStarsFor(world: GameWorld, player: Player): number {
  return abilityStars(potentialEstimate(world, player));
}

/** Bilgi düzeyi etiketi (gözlemci sistemi). */
export function knowledgeLabel(knowledge: number): string {
  if (knowledge >= 100) return 'Tam';
  if (knowledge >= 75) return 'İyi';
  if (knowledge >= 45) return 'Orta';
  if (knowledge >= 20) return 'Az';
  return 'Çok az';
}

export const VERDICT_LABELS: Record<ScoutVerdict, { text: string; className: string }> = {
  starter: { text: "İlk 11'e girer", className: 'verdict-starter' },
  rotation: { text: 'Rotasyon oyuncusu', className: 'verdict-rotation' },
  prospect: { text: 'Geleceğin oyuncusu', className: 'verdict-prospect' },
  notNeeded: { text: 'Kadroya katkı sağlamaz', className: 'verdict-none' },
};

/** Liste etiketleri (kadro, transfer, profil). */
export const LISTING_LABELS: Record<import('../engine').ListingKind, string> = {
  transfer: 'Satılık',
  loan: 'Kiralık listesi',
};
