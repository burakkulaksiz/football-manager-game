import type { Attributes, HiddenAttributes } from './attributes';
import type { GameDate } from './date';
import type { CareerMove, CareerSeason } from './squad/career';
import type { ScoutingState } from './transfer/scouting';
import type { Tactics } from './match/tactics';
import type { InternationalState } from './league/international';
import type { LowerFixture } from './league/lowerLeague';
import type { PressConference } from './season/press';
import type { ManagerBackground, ManagerRecordMatch, ManagerSeason } from './season/manager';
import type { FacilitiesState } from './finance/facilities';
import type { JobApplication, JobOffer, Unemployment, Vacancy } from './season/jobs';

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
  /** 1–100 (yurtdışı devlerinde 130'a kadar); kadro gücünü, maaşları ve transfer çekiciliğini belirler. */
  reputation: number;
  /** Transfer bütçesi (€). */
  budget: number;
  /** Yıllık maaş bütçesi (€). */
  wageBudget: number;
  fanExpectation: FanExpectation;
  colors: { primary: string; secondary: string };
  /** 1 = Süper Lig, 2 = (kurgusal) 1. Lig. JSON'da yoksa 1 sayılır. Yurtdışı kulübünde anlamsız. */
  division?: 1 | 2;
  /** Yurtdışı kulübü: ülke kodu (nations.json). Yoksa Türkiye. Yurtdışı kulüpleri maç oynamaz. */
  country?: string;
}

export interface Contract {
  /** Yıllık brüt maaş (€). */
  wage: number;
  expires: GameDate;
  /** Sözleşmede verilen rol (yalnızca menajerle pazarlıkla imzalanan sözleşmelerde). */
  role?: SquadRole;
  /** Serbest kalma bedeli: bu bedeli ödeyen kulübe satış reddedilemez. */
  releaseClause?: number;
  /** Oynadığı maç başına prim (€). */
  appearanceBonus?: number;
  /** Attığı gol başına prim (€). */
  goalBonus?: number;
}

/** Sözleşmedeki rol: önemli oyuncu (ilk 11), rotasyon, yedek. */
export type SquadRole = 'star' | 'rotation' | 'backup';

/** Menajerin tavrı: makul, açgözlü (yüksek ücret), sert (yüksek maaş, az sabır, serbest kalma bedeli şartı). */
export type AgentStyle = 'fair' | 'greedy' | 'tough';

/** Oyuncu menajeri; oyuncular kimliklerine göre menajerlere dağılır (bkz. transfer/agents.ts). */
export interface Agent {
  id: number;
  name: string;
  style: AgentStyle;
}

export interface Injury {
  name: string;
  daysOut: number;
}

/** Kiralık: oyuncu clubId'deki kulüpte oynar, `until` tarihinde `fromClubId`'ye döner. */
export interface Loan {
  fromClubId: string;
  until: GameDate;
  /** Satın alma opsiyonu: kiralık sürerken kiralayan bu bedelle oyuncuyu kalıcı alabilir. */
  optionFee?: number;
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
  /** Son maç puanları (en yeni sonda). */
  form: number[];
  /** Kondisyon 0–100 (%). */
  condition: number;
  injury: Injury | null;
  contract: Contract;
  /** Kiralıksa dönüş bilgisi; değilse null. */
  loan: Loan | null;
  /** Sonradan satış payı: oyuncu bonservisle satılınca bedelin `percent`'i bu kulübe gider (bir kez). */
  sellOn?: { clubId: string; percent: number };
  /** Ceza için biriken sarı kart (4'te bir maç ceza, sonra sıfırlanır). */
  yellowCards: number;
  /** Kalan ceza (maç sayısı). */
  suspension: number;
  /** Gelişim birikimi (özellik puanı cinsinden); ±1'e ulaşınca bir özellik değişir. */
  progress: number;
  /** Son haftaların gelişim eğilimi (UI'da ▲/▼). */
  trend: number;
  /** Son şikâyet tarihi (forma şansı); tekrar tekrar şikâyet etmesin. */
  lastComplaint: GameDate | null;
  /** Altyapıda (U19 kadrosunda): lig maçlarında oynamaz, A takım kadrosunda görünmez. */
  academy?: boolean;
  /** Gelişim geçmişi (≤ 23 yaş): başlangıç ayı ('YYYY-MM') ve art arda aylık yetenek değerleri. */
  growth?: { start: string; ca: number[] };
  /** Transfer / kiralık listesinde. */
  listing?: Listing;
  /** Menajerin bu oyuncuyla son görüşmesi (görüşmeler arası bekleme). */
  lastTalk?: GameDate;
  /** Moral uzun süre düşükse başladığı gün (ayrılık talebi için). */
  unhappySince?: GameDate;
  /** Kulübe katılış tarihi (hiyerarşide kulüpteki süre); oyun başından beri kulüpteyse yok. */
  joined?: GameDate;
  /** Kariyer: geçmiş sezonlar (kulüp başına) ve kulüp hareketleri (oyun başından itibaren). */
  career?: CareerSeason[];
  moves?: CareerMove[];
  /** Milli takımda oynadığı maç ve attığı gol (oyun başından itibaren). */
  intl?: { caps: number; goals: number };
}

export type RequestTopic = 'playingTime' | 'contract' | 'transfer';

/** Oyuncunun menajerden görüşme talebi (yanıt bekler). */
export interface PlayerRequest {
  id: number;
  playerId: number;
  topic: RequestTopic;
  created: GameDate;
  /** Bu güne kadar yanıtlanmazsa oyuncu kırılır. */
  respondBy: GameDate;
}

/** Forma şansı sözü: oyuncunun oynayabildiği maçlar ve ilk 11'de başladıkları. */
export interface PlayingPromise {
  playerId: number;
  made: GameDate;
  matches: number;
  starts: number;
}

export type ListingKind = 'transfer' | 'loan';

export interface Listing {
  kind: ListingKind;
  /** İstenen bedel (€); null = önerilen bedel (kulüp değerlendirsin). */
  price: number | null;
  since: GameDate;
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

export type ShotOutcome = 'goal' | 'saved' | 'missed' | 'blocked';

/**
 * Şut (şut haritası için). Sahadaki yeri saklanmaz: gösterimde dakikadan türetilir (2D sahayla aynı yer).
 * Varsayılanlar yazılmaz (kayıt küçük kalsın): ilk yarı, normal şut.
 */
export interface ShotRecord {
  /** Maç saati sayacı: ilk yarı uzatması 46, 47…; ikinci yarı 46'dan başlar (`second` ile ayrılır). */
  minute: number;
  second?: true;
  side: 'home' | 'away';
  playerId: number;
  outcome: ShotOutcome;
  /** Yoksa normal şut. */
  kind?: Exclude<GoalKind, 'normal'>;
  /** Korner ortasından kafa. */
  corner?: true;
}

export interface CardEvent {
  minute: number;
  extra?: number;
  clubId: string;
  playerId: number;
  /** 'red' = direkt ya da ikinci sarıdan kırmızı. */
  type: 'yellow' | 'red';
  /** Kırmızı ikinci sarıdan mı geldi (ceza süresi farklı). */
  secondYellow?: boolean;
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
  /** Maç sonu kondisyonu (oyuncuya geri yazılır). */
  condition?: number;
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
  /** Seyirci sayısı (finans işlenince yazılır). */
  attendance?: number;
  /** Şutlar (şut haritası); eski kayıtlarda yok. */
  shots?: ShotRecord[];
  /** Dakikaların anı, dakika başına bir harf (ısı haritası; bkz. PLAY_CODES); eski kayıtlarda yok. */
  timeline?: string;
  /** Eleme maçında beraberlik: penaltı atışlarının skoru. */
  penalties?: { home: number; away: number };
}

/* ------------------------------------------------------------------ */
/* Finans                                                              */
/* ------------------------------------------------------------------ */

export type IncomeCategory = 'tickets' | 'tv' | 'sponsor' | 'transfersIn' | 'prize';
export type ExpenseCategory = 'wages' | 'bonuses' | 'transfersOut' | 'signingBonuses' | 'agentFees' | 'scouting' | 'facilities';

/** Bir ayın gelir/gider dökümü (giderler pozitif sayı). */
export interface MonthReport {
  /** 'YYYY-MM' */
  month: string;
  income: Record<IncomeCategory, number>;
  expense: Record<ExpenseCategory, number>;
  /** Ay sonundaki kasa (ay kapanınca yazılır). */
  balanceEnd: number;
}

export interface ClubFinance {
  /** Kasa (€); negatif olabilir. */
  balance: number;
  /** Yönetimin transfer için ayırdığı tutar (€). */
  transferBudget: number;
  /** Yıllık maaş bütçesi (€). */
  wageBudget: number;
  /** Yıllık yayın geliri (aylık 1/12 ödenir). */
  tvIncome: number;
  /** Yıllık sponsor geliri (aylık 1/12 ödenir). */
  sponsorIncome: number;
  /** Bilet fiyatı ortalaması (€). */
  ticketPrice: number;
  current: MonthReport;
  history: MonthReport[];
}

/* ------------------------------------------------------------------ */
/* Transfer ve haberler                                                */
/* ------------------------------------------------------------------ */

/**
 * Transfer teklifi. Yön kullanıcıya göre değişir:
 *  - Kullanıcı alıcıysa: pending → (ertesi gün) accepted / countered / rejected;
 *    accepted transferde sözleşme görüşmesi → completed ya da collapsed.
 *  - Kullanıcı satıcıysa: pending (kullanıcının yanıtı bekleniyor) → completed / rejected /
 *    countered (kullanıcının karşı teklifi; alıcı ertesi gün yanıtlar) / cancelled (süre doldu).
 */
export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'rejected' | 'completed' | 'cancelled' | 'collapsed';

export interface TransferOffer {
  id: number;
  playerId: number;
  buyerId: string;
  sellerId: string;
  kind: 'transfer' | 'loan';
  fee: number;
  /** Transferde satıcıya verilen sonradan satış payı (%; yoksa 0). */
  sellOn?: number;
  /** Kiralıkta satın alma opsiyonu bedeli. */
  optionFee?: number;
  /** Karşı teklif tutarı (countered durumunda). */
  counterFee: number | null;
  status: OfferStatus;
  created: GameDate;
  /** Yanıtın verileceği / teklifin düşeceği gün. */
  respondOn: GameDate;
  /** Sözleşme görüşmesinde oyuncunun kalan sabrı. */
  patience: number;
  /** Yapay zekâ alıcının en fazla ödeyeceği tutar (gizli). */
  maxFee: number | null;
  /** Son durum açıklaması (UI'da gösterilir). */
  note: string;
}

export type NewsCategory =
  | 'transfer'
  | 'offer'
  | 'finance'
  | 'window'
  | 'contract'
  | 'loan'
  | 'injury'
  | 'discipline'
  | 'player'
  | 'training'
  | 'board'
  | 'season'
  | 'academy'
  | 'scouting'
  | 'cup'
  | 'europe'
  | 'international'
  | 'job'
  | 'media';

/* ------------------------------------------------------------------ */
/* Antrenman                                                           */
/* ------------------------------------------------------------------ */

export type TrainingFocus = 'balanced' | 'physical' | 'technical' | 'tactical' | 'attacking' | 'defending';
export type TrainingIntensity = 'light' | 'normal' | 'hard';

export interface Training {
  focus: TrainingFocus;
  intensity: TrainingIntensity;
}

export interface NewsItem {
  id: number;
  date: GameDate;
  category: NewsCategory;
  title: string;
  body: string;
  /** Kullanıcıyı ilgilendiriyor: Devam bu haberin geldiği günde durur. */
  important: boolean;
  read: boolean;
  playerId?: number;
  clubId?: string;
}

export interface Fixture {
  id: number;
  /** Ligde hafta (1–34); kupada tur (1 = 1. Tur … 5 = Final); Avrupa'da aşama (1–6 grup maçı, 7–10 çeyrek ve yarı final maçları, 11 final). */
  round: number;
  date: GameDate;
  homeId: string;
  awayId: string;
  /** Oynanmadıysa null. */
  result: MatchResult | null;
  /** Kupa ya da Avrupa maçı; yoksa lig maçı. */
  competition?: Competition;
  /** Avrupa grup aşaması: grup harfi ('A'–'D'). */
  group?: string;
}

/** 'cup' = Türkiye Kupası, 'cl' = Şampiyonlar Ligi, 'el' = Avrupa Ligi. */
export type Competition = 'cup' | 'cl' | 'el';

export interface Season {
  /** Sezonun başladığı yıl: 2026 → "2026/27" */
  year: number;
  fixtures: Fixture[];
  /** 1. Lig fikstürü (yalnızca skor; league/lowerLeague.ts). Eski kayıtta yok: o sezon çıkanlar rastgele seçilir. */
  lower?: LowerFixture[];
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
  /** Kulüp id → kayıtlı taktik (şimdilik yalnızca kullanıcının kulübü; yapay zekâ her maçta seçer). */
  tactics: Record<string, Tactics>;
  /** Kulüp id → antrenman ayarı (yapay zekâ kulüpleri için yoksa dengeli/normal). */
  training: Record<string, Training>;
  finances: Record<string, ClubFinance>;
  offers: TransferOffer[];
  nextOfferId: number;
  /** En yeni sonda; en fazla NEWS_LIMIT kayıt tutulur. */
  news: NewsItem[];
  nextNewsId: number;
  board: BoardState;
  /** Biten sezonların özeti (en yeni sonda). */
  history: SeasonSummary[];
  /** 'running' = sezon sürüyor, 'ended' = son maç oynandı, yeni sezon 1 Temmuz'da başlar. */
  seasonState: 'running' | 'ended';
  /** Görevden alındıysa kariyer biter. */
  gameOver: { date: GameDate; reason: string } | null;
  manager: ManagerInfo;
  /** Takip listesindeki (genelde genç) oyuncular. */
  youthWatch: number[];
  /** Oyuncularımızın bekleyen görüşme talepleri. */
  requests: PlayerRequest[];
  nextRequestId: number;
  /** Verilmiş forma şansı sözleri. */
  promises: PlayingPromise[];
  /** Gözlemciler: oyuncu bilgisi, görevler, raporlar (yalnızca kullanıcının kulübü). */
  scouting: ScoutingState;
  /** Oyuncu menajerleri. */
  agents: Agent[];
  /** Milli takımlar: eleme / turnuva döngüsü, kadrolar, milli maçlar. */
  international: InternationalState;
  /** Tesis seviyeleri (Türkiye kulüpleri) ve kullanıcının inşaatları. */
  facilities: FacilitiesState;
  /** Kapatılan kararlar (ör. sözleşmesinin bitmesine izin verilen oyuncu; bkz. decisions.ts). */
  dismissedDecisions?: string[];
  /** Son maçımızın cevaplanmamış basın toplantısı (season/press.ts); yoksa null / yok. */
  press?: PressConference | null;
  /** İşsizse (görevden alındı / istifa etti): `playerClubId` NO_CLUB olur, son kulüp burada (bkz. season/jobs.ts). */
  unemployed?: Unemployment | null;
  /** Boş teknik direktörlük koltukları (Türkiye kulüpleri). */
  vacancies?: Vacancy[];
  /** Menajere gelen iş teklifleri ve başvuruları. */
  jobOffers?: JobOffer[];
  jobApplications?: JobApplication[];
  nextJobOfferId?: number;
}

/* ------------------------------------------------------------------ */
/* Yönetim ve sezon geçmişi                                            */
/* ------------------------------------------------------------------ */

/** Kullanıcının menajer kartı (kariyer boyunca, sezonlar arası taşınır). */
export interface ManagerInfo {
  name: string;
  /** Göreve başlama tarihi (kariyerin başı; oyuncu kıdemi hesabında da kullanılır). */
  joined: GameDate;
  /** Şimdiki kulübe geldiği tarih (yoksa kariyerin başından beri aynı kulüp). */
  clubSince?: GameDate;
  won: number;
  drawn: number;
  lost: number;
  /** Lig şampiyonlukları. */
  titles: number;
  /** Türkiye Kupası zaferleri. */
  cups?: number;
  /** Avrupa kupası zaferleri (Şampiyonlar Ligi ya da Avrupa Ligi). */
  europeTitles?: number;
  /** Yeni oyunda seçilen geçmiş (başlangıç itibarı). */
  background?: ManagerBackground;
  /** Menajer itibarı 1–100 (bkz. season/manager.ts). */
  reputation?: number;
  /** Aylık itibar geçmişi (en eski önce). */
  reputationHistory?: { month: string; value: number }[];
  /** Tamamlanan (ya da görevden alınılan) sezonlar. */
  seasons?: ManagerSeason[];
  bestWin?: ManagerRecordMatch;
  worstDefeat?: ManagerRecordMatch;
}

export interface BoardState {
  /** Yönetimin güveni 0–100. */
  confidence: number;
  /** Sezon hedefi (lig sırası). */
  targetPosition: number;
  /** Taraftar memnuniyeti 0–100 (season/fans.ts); eski kayıtta yok = 60. */
  fans?: number;
}

export interface SeasonAward {
  title: string;
  playerId: number;
  playerName: string;
  clubId: string;
  clubName: string;
  value: string;
}

export interface SeasonSummary {
  year: number;
  table: { clubId: string; name: string; points: number; goalDifference: number }[];
  championId: string;
  relegatedIds: string[];
  promotedIds: string[];
  /** Kulüp isimleri sezon içindeki hâliyle saklanır. */
  relegatedNames: string[];
  promotedNames: string[];
  userClubId: string;
  userPosition: number;
  targetPosition: number;
  awards: SeasonAward[];
  /** Türkiye Kupası şampiyonu (kupa oynanmadıysa yok). */
  cupWinnerId?: string;
  cupWinnerName?: string;
  /** Avrupa kupaları şampiyonları (oynandıysa). */
  clWinnerName?: string;
  elWinnerName?: string;
}
