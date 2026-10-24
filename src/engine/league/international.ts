/**
 * Milli takımlar. Kullanıcı yalnızca kulüp tarafındadır: oyuncuları milli takımlarına çağrılır, maçlar arka planda
 * oynanır; dönüşte kondisyon, sakatlık ve moral etkisi; oyuncuda milli maç / gol sayısı.
 *
 * Takvim: ligin milli ara hafta sonları (Eylül, Ekim, Kasım, Mart; bkz. isBreakWeekend). Her arada iki maç günü:
 * cuma (C−1) ve salı (C+3); kadrolar ilk maçtan 4 gün önce açıklanır. Bu günlerde kulüp maçı yoktur.
 * İki yılda bir yaz turnuvası, çift yıllarda haziranda: 4'e bölünen yıllarda Avrupa Şampiyonası (8 takım),
 * diğerlerinde Dünya Kupası (16 takım). Turnuvadan sonraki 1 Temmuz'da yeni döngü başlar ve eleme grupları çekilir.
 * Elemeler: UEFA ülkeleri 4 grupta (5'li grupta her turda biri bay geçer), çift devre; turnuva kurasından
 * (1 Aralık, turnuvadan önceki yıl) önceki son milli maç günlerinde. Diğer milli günler hazırlık maçı.
 * Grupların ilk ikisi turnuvaya; Dünya Kupası'nın kalanı UEFA dışından en güçlüler (onların elemeleri oynanmaz).
 * Kadrolar: ülkenin dünyadaki oyuncuları + ülke gücüne göre üretilen sanal oyuncular (kayda yazılmaz, tohumdan
 * yeniden üretilir, id'leri negatif); en iyi 23 kişi (3 kaleci, 8 defans, 8 orta saha, 4 hücum).
 */
import { HOME_NATION, type GameData, type Nation } from '../data';
import { addDays, formatDateTR, makeDate, weekday, type GameDate } from '../date';
import { generatePlayer } from '../generation/playerGenerator';
import { clubBaseLevel, SQUAD_TEMPLATE } from '../generation/worldGenerator';
import { buildResult, createMatch, simulateToEnd, type TeamSetup } from '../match/engine';
import { autoSelectLineup, chooseFormation, FORMATIONS } from '../match/formation';
import { formatMinute } from '../match/state';
import { addNews } from '../news';
import { primaryPosition } from '../player';
import { Rng } from '../rng';
import { injurePlayer } from '../squad/injuries';
import { groupOf, type PositionGroup } from '../transfer/market';
import type { GameWorld, Player } from '../types';
import { circlePairings } from './schedule';
import { goalDifference, tableFrom, type StandingRow } from './standings';

export type NationalCompetition = 'friendly' | 'qualifier' | 'tournament';
export type TournamentKind = 'euro' | 'wc';

export const TOURNAMENT_NAMES: Record<TournamentKind, string> = { euro: 'Avrupa Şampiyonası', wc: 'Dünya Kupası' };
const TOURNAMENT_TEAMS: Record<TournamentKind, number> = { euro: 8, wc: 16 };

export interface NationalGoal {
  minute: number;
  extra?: number;
  side: 'home' | 'away';
  /** Golü atanın adı (sanal oyuncular kayıtta olmadığından ad saklanır). */
  name: string;
  /** Dünyadaki oyuncuysa id'si. */
  playerId?: number;
  penalty?: true;
}

/** Kulübümüzün oyuncusunun milli maçtaki kaydı (kayıt küçük kalsın; milli maç / gol sayısı oyuncuda tutulur). */
export interface NationalAppearance {
  playerId: number;
  nation: string;
  started: boolean;
  minutes: number;
  rating: number;
  goals: number;
}

export interface NationalResult {
  homeGoals: number;
  awayGoals: number;
  penalties?: { home: number; away: number };
  goals: NationalGoal[];
  /** Yalnızca kulübümüzün oyuncuları. */
  players: NationalAppearance[];
}

export interface NationalFixture {
  id: number;
  date: GameDate;
  /** Ülke kodları (nations.json). */
  homeId: string;
  awayId: string;
  competition: NationalCompetition;
  /** Eleme ya da turnuva grubu ('A'…). */
  group?: string;
  /** Elemede maç günü (1…); turnuvada aşama (1–3 grup maçları, 4 çeyrek final, 5 yarı final, 6 final). */
  round: number;
  result: NationalResult | null;
}

export interface NationalSquad {
  /** Açıklandığı gün. */
  date: GameDate;
  /** Oyuncu id'leri; sanal oyuncular negatif. */
  ids: number[];
}

/** Turnuvada Türkiye'nin geldiği yer. */
export type TurkeyStage = 'notQualified' | 'group' | 'quarter' | 'semi' | 'final' | 'winner';

export interface TournamentSummary {
  year: number;
  kind: TournamentKind;
  winner: string;
  runnerUp: string;
  turkey: TurkeyStage;
}

export interface InternationalState {
  /** Döngünün turnuva yılı (yaz) ve türü. */
  year: number;
  kind: TournamentKind;
  /** Eleme grupları (ülke kodları, kura sırasıyla). */
  qualifierGroups: string[][];
  /** Elemeler bitince turnuvaya katılanlar (UEFA); bitmediyse null. */
  qualified: string[] | null;
  /** Turnuva grupları (kura çekilince). */
  tournamentGroups: string[][];
  fixtures: NationalFixture[];
  nextFixtureId: number;
  /** Ülkelerin son açıklanan kadroları. */
  squads: Record<string, NationalSquad>;
  /** Şu an açıklanmış kampın kadro günü (kamp bitince null). */
  campAnnounced: GameDate | null;
  /** Milli takımda olan (dünyadaki) oyuncular. */
  onDuty: number[];
  /** Biten turnuvalar (en yeni sonda). */
  history: TournamentSummary[];
}

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
/** Eleme grubunda en çok bu kadar ülke; grup sayısı UEFA ülke sayısına göre (5'li grupta çift devre 10 maç günü). */
const MAX_GROUP_SIZE = 5;
/** Elemeden turnuvaya giden UEFA ülkesi: önce grup birincileri, sonra en iyi ikinciler… (bkz. qualifierRanking). */
export const UEFA_SPOTS = 8;
export const SQUAD_SIZE = 23;
const SQUAD_QUOTA: Record<PositionGroup, number> = { GK: 3, DEF: 8, MID: 8, ATT: 4 };

export const TOURNAMENT_GROUP_ROUNDS = 3;
export const TOURNAMENT_QUARTER = 4;
export const TOURNAMENT_SEMI = 5;
export const TOURNAMENT_FINAL = 6;
/** Turnuva aşamalarının tarihleri (haziran). */
const TOURNAMENT_DAYS: Record<number, number> = { 1: 10, 2: 14, 3: 18, 4: 22, 5: 25, 6: 29 };

/** Kadrolar ilk maçtan bu kadar gün önce açıklanır. */
const ANNOUNCE_DAYS = 4;
/** Ülkenin bu kadar gün içinde maçı kalmadıysa oyuncuları kulübüne döner (turnuvada aşamalar arası bekleme). */
const DUTY_GAP_DAYS = 8;
const MIN_DAYS_TO_MATCH = 3;
const INTL_SEED_SALT = 0x51a7e0b3;
/** Milli takıma çağrılan oyuncunun morali; maçta 7.5+ puan alana ek. */
const CALLUP_MORALE = 3;
const GOOD_GAME_MORALE = 2;

export function tournamentKind(year: number): TournamentKind {
  return year % 4 === 0 ? 'euro' : 'wc';
}

/** "Avrupa Şampiyonası 2028" */
export function tournamentTitle(year: number, kind: TournamentKind = tournamentKind(year)): string {
  return `${TOURNAMENT_NAMES[kind]} ${year}`;
}

export function tournamentDate(year: number, round: number): GameDate {
  return makeDate(year, 6, TOURNAMENT_DAYS[round]!);
}

/** Turnuva kurası: turnuvadan önceki yılın 1 Aralık'ı. */
export function tournamentDrawDate(year: number): GameDate {
  return makeDate(year - 1, 12, 1);
}

function nextSaturday(date: GameDate): GameDate {
  let d = date;
  while (weekday(d) !== 6) d = addDays(d, 1);
  return d;
}

/** Sezonun milli ara cumartesileri: Eylül'ün ilk, Ekim ve Kasım'ın ikinci, Mart'ın son haftası (isBreakWeekend). */
export function breakSaturdays(seasonYear: number): GameDate[] {
  return [
    nextSaturday(makeDate(seasonYear, 9, 1)),
    nextSaturday(makeDate(seasonYear, 10, 8)),
    nextSaturday(makeDate(seasonYear, 11, 8)),
    nextSaturday(makeDate(seasonYear + 1, 3, 25)),
  ];
}

/** Bir aranın iki maç günü: cuma ve salı. */
export function windowMatchDays(saturday: GameDate): [GameDate, GameDate] {
  return [addDays(saturday, -1), addDays(saturday, 3)];
}

/** [from, until] aralığındaki milli maç günleri. */
export function windowDaysBetween(from: GameDate, until: GameDate): GameDate[] {
  const days: GameDate[] = [];
  for (let y = Number(from.slice(0, 4)) - 1; y <= Number(until.slice(0, 4)); y++) {
    for (const s of breakSaturdays(y)) for (const d of windowMatchDays(s)) if (d >= from && d <= until) days.push(d);
  }
  return [...new Set(days)].sort();
}

/* ------------------------------------------------------------------ */
/* Ülkeler ve kadrolar                                                 */
/* ------------------------------------------------------------------ */

/** Ülke bilgisi; veriden kaldırılmış bir ülke için (eski kayıt) varsayılan. */
export function nationInfo(data: GameData, code: string): Nation {
  return data.nations.find((n) => n.code === code) ?? {
    code, name: code, namePool: data.nations[0]!.namePool, weight: 0, confederation: 'UEFA', strength: 60,
    colors: { primary: '#666666', secondary: '#FFFFFF' },
  };
}

function codeHash(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 65521;
  return h;
}

export function isVirtualPlayer(id: number): boolean {
  return id < 0;
}

const poolCache = new Map<string, Player[]>();

/**
 * Ülkenin sanal oyuncuları (dünyada olmayan, kayda yazılmayan): 25 kişilik kulüp şablonu, ülke gücüne göre seviye.
 * Döngü başına (turnuva yılı) tohumdan yeniden üretilir; ad ve id hep aynı çıkar.
 */
export function virtualPool(world: GameWorld, data: GameData, code: string, year = world.international.year): Player[] {
  const nation = nationInfo(data, code);
  const key = `${world.seed}:${code}:${year}:${nation.strength}`;
  const cached = poolCache.get(key);
  if (cached) return cached;
  const hash = codeHash(code);
  const rng = new Rng((world.seed ^ INTL_SEED_SALT ^ Math.imul(hash + 1, 2654435761) ^ year) >>> 0);
  const base = clubBaseLevel(nation.strength * 1.25);
  const date = makeDate(year - 2, 7, 1);
  const pool = SQUAD_TEMPLATE.map(({ position, role }, i) => {
    const starter = role === 'starter';
    const player = generatePlayer(rng, data, -(hash * 100 + i + 1), date, {
      position,
      level: starter ? base + rng.normal(0, 0.8) : base - 1.2 + rng.normal(0, 0.8),
      age: Math.round(starter ? Math.max(21, Math.min(33, rng.normal(27, 3))) : Math.max(19, Math.min(34, rng.normal(25, 4)))),
      nationality: code,
      clubId: null,
      wageFactor: 1,
    });
    player.condition = 95;
    return player;
  });
  if (poolCache.size > 300) poolCache.clear();
  poolCache.set(key, pool);
  return pool;
}

/** Milli kadrodaki bir oyuncu: dünyadaki ya da sanal. */
export function nationalPlayer(world: GameWorld, data: GameData, id: number): Player | undefined {
  if (!isVirtualPlayer(id)) return world.players[id];
  const hash = Math.floor((-id - 1) / 100);
  const nation = data.nations.find((n) => codeHash(n.code) === hash);
  return nation ? virtualPool(world, data, nation.code).find((p) => p.id === id) : undefined;
}

/** Seçim puanı: yetenek + son maçların formu. */
function selectionScore(p: Player): number {
  const recent = p.form.slice(-3);
  if (recent.length === 0) return p.currentAbility;
  const avg = recent.reduce((s, r) => s + r, 0) / recent.length;
  return p.currentAbility + Math.max(-6, Math.min(6, (avg - 6.8) * 6));
}

function playersByNation(world: GameWorld): Map<string, Player[]> {
  const map = new Map<string, Player[]>();
  for (const p of Object.values(world.players)) {
    if (p.clubId === null) continue;
    const list = map.get(p.nationality);
    if (list) list.push(p);
    else map.set(p.nationality, [p]);
  }
  return map;
}

/** Ülkenin en iyi 23'ü (sakatlar hariç): mevki kotalarıyla, eksik kalırsa en iyi saha oyuncularıyla tamamlanır. */
export function selectSquad(world: GameWorld, data: GameData, code: string, byNation = playersByNation(world)): number[] {
  const real = (byNation.get(code) ?? []).filter((p) => !p.injury);
  const candidates = [...real, ...virtualPool(world, data, code)]
    .sort((a, b) => selectionScore(b) - selectionScore(a) || b.id - a.id);
  const picked: Player[] = [];
  const count: Record<PositionGroup, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  for (const p of candidates) {
    const g = groupOf(primaryPosition(p));
    if (count[g] < SQUAD_QUOTA[g]) {
      picked.push(p);
      count[g]++;
    }
  }
  for (const p of candidates) {
    if (picked.length >= SQUAD_SIZE) break;
    if (!picked.includes(p) && primaryPosition(p) !== 'GK') picked.push(p);
  }
  return picked.map((p) => p.id);
}

/** Ülkenin gücü (kura torbaları): kadrosunun en iyi 11'inin ortalama yeteneği. */
export function nationRating(world: GameWorld, data: GameData, code: string, byNation = playersByNation(world)): number {
  const top = selectSquad(world, data, code, byNation)
    .map((id) => nationalPlayer(world, data, id)!.currentAbility)
    .sort((a, b) => b - a)
    .slice(0, 11);
  return top.reduce((s, x) => s + x, 0) / Math.max(1, top.length);
}

/* ------------------------------------------------------------------ */
/* Döngü, kuralar, fikstür                                             */
/* ------------------------------------------------------------------ */

function intlRng(world: GameWorld, salt: number): Rng {
  return new Rng((world.seed ^ INTL_SEED_SALT ^ Math.imul(salt + 1, 2654435761)) >>> 0);
}

function dateSalt(date: GameDate): number {
  return Number(date.replaceAll('-', '')) % 1_000_003;
}

/** Milli takımı olan ülkeler (nations.json `nationalTeam: false` olanlar milli maç oynamaz). */
export function nationalTeams(data: GameData): Nation[] {
  return data.nations.filter((n) => n.nationalTeam !== false);
}

const uefaNations = (data: GameData) => nationalTeams(data).filter((n) => n.confederation === 'UEFA').map((n) => n.code);

function qualifierGroupCount(teams: number): number {
  return Math.max(1, Math.ceil(teams / MAX_GROUP_SIZE));
}

/** En kalabalık grubun çift devre maç günü sayısı (tek sayılı grupta her turda biri bay). */
function qualifierRounds(teams: number): number {
  const size = Math.ceil(teams / qualifierGroupCount(teams));
  const padded = size + (size % 2);
  return 2 * (padded - 1);
}

/** Güce göre torbalar, her torbadan her gruba bir ülke. */
function drawGroups(rng: Rng, ratings: Map<string, number>, codes: readonly string[], groups: number): string[][] {
  const sorted = [...codes].sort((a, b) => ratings.get(b)! - ratings.get(a)! || a.localeCompare(b));
  const result: string[][] = Array.from({ length: groups }, () => []);
  for (let start = 0; start < sorted.length; start += groups) {
    const pot = rng.shuffle(sorted.slice(start, start + groups));
    pot.forEach((code, g) => result[g]!.push(code));
  }
  return result;
}

function nationName(data: GameData, code: string): string {
  return nationInfo(data, code).name;
}

/**
 * Yeni döngü: turnuva yılı (elemelere yetecek milli gün kalan ilk çift yıl), eleme kurası ve tüm milli günlerin
 * fikstürü (elemeler + hazırlık maçları). `history` önceki döngüden taşınır.
 */
/** Boş durum (yeni dünya kurulurken; ilk günlük işlemde gerçek döngü kurulur). */
export function emptyInternational(): InternationalState {
  return {
    year: 0, kind: 'euro', qualifierGroups: [], qualified: null, tournamentGroups: [], fixtures: [], nextFixtureId: 1,
    squads: {}, campAnnounced: null, onDuty: [], history: [],
  };
}

export function createInternational(world: GameWorld, data: GameData, from: GameDate, history: TournamentSummary[] = []): InternationalState {
  const uefa = uefaNations(data);
  const rounds = qualifierRounds(uefa.length);
  const first = addDays(from, MIN_DAYS_TO_MATCH);
  let year = Number(from.slice(0, 4));
  if (year % 2 !== 0) year++;
  while (windowDaysBetween(first, addDays(tournamentDrawDate(year), -1)).length < rounds) year += 2;

  const state: InternationalState = {
    year,
    kind: tournamentKind(year),
    qualifierGroups: [],
    qualified: null,
    tournamentGroups: [],
    fixtures: [],
    nextFixtureId: 1,
    squads: {},
    campAnnounced: null,
    onDuty: [],
    history,
  };
  world.international = state;

  const days = windowDaysBetween(first, makeDate(year, 3, 31));
  const qualifierDays = days.filter((d) => d < tournamentDrawDate(year)).slice(-rounds);
  const byNation = playersByNation(world);
  const ratings = new Map(nationalTeams(data).map((n) => [n.code, nationRating(world, data, n.code, byNation)]));
  state.qualifierGroups = drawGroups(intlRng(world, year), ratings, uefa, qualifierGroupCount(uefa.length));

  // Elemeler: çember yöntemi (tek sayılı grupta '' = bay), ikinci devre ev/deplasman tersi
  state.qualifierGroups.forEach((members, g) => {
    const padded = members.length % 2 === 0 ? members : [...members, ''];
    const half = padded.length - 1;
    circlePairings(padded).forEach((pairs, r) => {
      for (const [a, b] of pairs) {
        if (a === '' || b === '') continue;
        const [home, away] = r % 2 === 0 ? [a, b] : [b, a];
        const base = { competition: 'qualifier', group: GROUP_LETTERS[g], result: null } as const;
        state.fixtures.push({ ...base, id: state.nextFixtureId++, date: qualifierDays[r]!, round: r + 1, homeId: home, awayId: away });
        state.fixtures.push({ ...base, id: state.nextFixtureId++, date: qualifierDays[r + half]!, round: r + half + 1, homeId: away, awayId: home });
      }
    });
  });

  // Hazırlık maçları: o gün elemede oynamayan ülkeler eşleşir (Türkiye hep oynar)
  for (const day of days) {
    const busy = new Set(state.fixtures.filter((f) => f.date === day).flatMap((f) => [f.homeId, f.awayId]));
    const pool = intlRng(world, dateSalt(day)).shuffle(nationalTeams(data).map((n) => n.code).filter((c) => !busy.has(c)));
    if (pool.length % 2 === 1 && pool[pool.length - 1] === HOME_NATION) [pool[0], pool[pool.length - 1]] = [pool[pool.length - 1]!, pool[0]!];
    for (let i = 0; i + 1 < pool.length; i += 2) {
      state.fixtures.push({ id: state.nextFixtureId++, date: day, homeId: pool[i]!, awayId: pool[i + 1]!, competition: 'friendly', round: 0, result: null });
    }
  }

  const turkeyGroup = state.qualifierGroups.findIndex((m) => m.includes(HOME_NATION));
  if (turkeyGroup >= 0) {
    addNews(world, {
      category: 'international',
      title: `${tournamentTitle(year)} elemeleri: Türkiye ${GROUP_LETTERS[turkeyGroup]} Grubunda`,
      body: `${tournamentTitle(year)} eleme kurası çekildi. Türkiye'nin rakipleri: ` +
        `${state.qualifierGroups[turkeyGroup]!.filter((c) => c !== HOME_NATION).map((c) => nationName(data, c)).join(', ')}. ` +
        `Elemeler ${formatDateTR(qualifierDays[0]!)} tarihinde başlıyor; turnuvaya ${qualifierRuleText(state)} gider.`,
      important: false,
      clubId: world.playerClubId,
    });
  }
  return state;
}

export function qualifierFixtures(state: InternationalState): NationalFixture[] {
  return state.fixtures.filter((f) => f.competition === 'qualifier');
}

export function tournamentFixtures(state: InternationalState, round?: number): NationalFixture[] {
  return state.fixtures.filter((f) => f.competition === 'tournament' && (round === undefined || f.round === round));
}

/** Ülkenin bu döngüdeki maçları (tarih sırasıyla). */
export function nationFixtures(state: InternationalState, code: string): NationalFixture[] {
  return state.fixtures.filter((f) => f.homeId === code || f.awayId === code).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
}

export function qualifierTable(state: InternationalState, group: number): StandingRow[] {
  const letter = GROUP_LETTERS[group];
  return tableFrom(state.qualifierGroups[group] ?? [], qualifierFixtures(state).filter((f) => f.group === letter));
}

export function tournamentTable(state: InternationalState, group: number): StandingRow[] {
  const letter = GROUP_LETTERS[group];
  return tableFrom(state.tournamentGroups[group] ?? [], tournamentFixtures(state).filter((f) => f.group === letter && f.round <= TOURNAMENT_GROUP_ROUNDS));
}

/** Maçın kazananı (eleme maçında penaltılarla); beraberlikte null. */
export function nationalWinner(f: NationalFixture): string | null {
  const r = f.result;
  if (!r) return null;
  if (r.homeGoals !== r.awayGoals) return r.homeGoals > r.awayGoals ? f.homeId : f.awayId;
  if (r.penalties) return r.penalties.home > r.penalties.away ? f.homeId : f.awayId;
  return null;
}

export function tournamentStageName(round: number): string {
  if (round <= TOURNAMENT_GROUP_ROUNDS) return `Grup ${round}. maç`;
  return ['Çeyrek Final', 'Yarı Final', 'Final'][round - TOURNAMENT_QUARTER] ?? `${round}. Aşama`;
}

/** "Hazırlık maçı" / "Avrupa Şampiyonası 2028 Elemeleri · B Grubu" / "Dünya Kupası 2030 · Yarı Final". */
export function nationalFixtureLabel(state: InternationalState, f: NationalFixture): string {
  if (f.competition === 'friendly') return 'Hazırlık maçı';
  if (f.competition === 'qualifier') return `${tournamentTitle(state.year, state.kind)} Elemeleri · ${f.group} Grubu`;
  const stage = f.round <= TOURNAMENT_GROUP_ROUNDS ? `${f.group} Grubu` : tournamentStageName(f.round);
  return `${tournamentTitle(state.year, state.kind)} · ${stage}`;
}

/** Elemelerin genel sıralaması: önce tüm grup birincileri (puan, averaj, atılan gol), sonra ikinciler… */
export function qualifierRanking(state: InternationalState): string[] {
  const tables = state.qualifierGroups.map((_, g) => qualifierTable(state, g));
  const depth = Math.max(0, ...tables.map((t) => t.length));
  const ranked: string[] = [];
  for (let rank = 0; rank < depth; rank++) {
    const rows = tables.flatMap((t) => (t[rank] ? [t[rank]!] : []));
    rows.sort((a, b) => b.points - a.points || goalDifference(b) - goalDifference(a) || b.goalsFor - a.goalsFor || a.clubId.localeCompare(b.clubId));
    ranked.push(...rows.map((r) => r.clubId));
  }
  return ranked;
}

/** Elemeden turnuvaya kimin gittiği: "grupların ilk 2'si", "7 grup birincisi ve en iyi ikinci"… */
export function qualifierRuleText(state: InternationalState): string {
  const groups = state.qualifierGroups.length;
  const perGroup = Math.floor(UEFA_SPOTS / groups);
  const extra = UEFA_SPOTS - perGroup * groups;
  if (perGroup === 2 && extra === 0) return "grupların ilk 2'si";
  if (perGroup === 1) return extra === 0 ? 'grup birincileri' : `${groups} grup birincisi ve en iyi ${extra > 1 ? `${extra} ` : ''}ikinci`;
  return `grup sıralamasına göre en iyi ${UEFA_SPOTS} ülke`;
}

/** Elemeler bitti: turnuvaya gidenler (bkz. qualifierRanking); Türkiye'ye haber. */
function finishQualifiers(world: GameWorld): void {
  const state = world.international;
  const tables = state.qualifierGroups.map((_, g) => qualifierTable(state, g));
  state.qualified = qualifierRanking(state).slice(0, UEFA_SPOTS);
  const g = state.qualifierGroups.findIndex((m) => m.includes(HOME_NATION));
  if (g < 0) return;
  const position = tables[g]!.findIndex((r) => r.clubId === HOME_NATION) + 1;
  const ok = state.qualified.includes(HOME_NATION);
  addNews(world, {
    category: 'international',
    title: ok ? `Türkiye turnuvaya gidiyor: ${tournamentTitle(state.year)}` : `Türkiye elemelerde kaldı: ${tournamentTitle(state.year)}`,
    body: `Türkiye eleme grubunu ${position}. sırada bitirdi` +
      (ok ? ` ve ${tournamentTitle(state.year)} biletini aldı. Turnuva kurası ${formatDateTR(tournamentDrawDate(state.year))} tarihinde.`
        : `; turnuvaya ${qualifierRuleText(state)} gidiyor.`),
    important: true,
    clubId: world.playerClubId,
  });
}

/** Turnuva kurası: elemeyi geçenler (Dünya Kupası'nda + UEFA dışından en güçlüler), 4'lü gruplar. */
function drawTournament(world: GameWorld, data: GameData): void {
  const state = world.international;
  const size = TOURNAMENT_TEAMS[state.kind];
  const rng = intlRng(world, state.year * 7 + 1);
  const byNation = playersByNation(world);
  const ratings = new Map(nationalTeams(data).map((n) => [n.code, nationRating(world, data, n.code, byNation)]));
  // Eleme sıralaması (boşluk kalırsa doldurmak için)
  const byRank = qualifierRanking(state);
  let teams = (state.qualified ?? byRank).slice(0, Math.min(size, UEFA_SPOTS));
  if (state.kind === 'wc') {
    const others = nationalTeams(data)
      .filter((n) => n.confederation !== 'UEFA')
      .map((n) => ({ code: n.code, score: ratings.get(n.code)! + rng.normal(0, 4) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.code);
    teams = [...teams, ...others.slice(0, size - teams.length)];
  }
  teams = [...teams, ...byRank.filter((c) => !teams.includes(c))].slice(0, size);
  const groupCount = Math.max(1, Math.floor(teams.length / 4));
  state.tournamentGroups = drawGroups(rng, ratings, teams, groupCount);

  state.tournamentGroups.forEach((members, g) => {
    circlePairings(members).forEach((pairs, r) => {
      for (const [home, away] of pairs) {
        state.fixtures.push({
          id: state.nextFixtureId++, date: tournamentDate(state.year, r + 1), homeId: home, awayId: away,
          competition: 'tournament', group: GROUP_LETTERS[g], round: r + 1, result: null,
        });
      }
    });
  });

  const tg = state.tournamentGroups.findIndex((m) => m.includes(HOME_NATION));
  addNews(world, {
    category: 'international',
    title: tg >= 0
      ? `${tournamentTitle(state.year)}: Türkiye ${GROUP_LETTERS[tg]} Grubunda`
      : `${tournamentTitle(state.year)} kurası çekildi`,
    body: `${tournamentTitle(state.year)} grupları: ` +
      state.tournamentGroups.map((m, g) => `${GROUP_LETTERS[g]} Grubu: ${m.map((c) => nationName(data, c)).join(', ')}`).join('. ') +
      `. Turnuva ${formatDateTR(tournamentDate(state.year, 1))} tarihinde başlıyor.`,
    important: false,
    clubId: world.playerClubId,
  });
}

/** Eleme turu: çeyrek final (16 takım) ya da yarı final (8 takım) grup sıralamasından, sonrakiler kazananlardan. */
function nextKnockoutRound(world: GameWorld): void {
  const state = world.international;
  const ko = tournamentFixtures(state).filter((f) => f.round > TOURNAMENT_GROUP_ROUNDS);
  const last = ko.length > 0 ? Math.max(...ko.map((f) => f.round)) : 0;
  let pairs: [string, string][];
  let round: number;
  if (last === 0) {
    const tables = state.tournamentGroups.map((_, g) => tournamentTable(state, g));
    pairs = [];
    for (let g = 0; g + 1 < tables.length; g += 2) {
      pairs.push([tables[g]![0]!.clubId, tables[g + 1]![1]!.clubId], [tables[g + 1]![0]!.clubId, tables[g]![1]!.clubId]);
    }
    round = pairs.length === 4 ? TOURNAMENT_QUARTER : pairs.length === 2 ? TOURNAMENT_SEMI : TOURNAMENT_FINAL;
  } else {
    const winners = ko.filter((f) => f.round === last).sort((a, b) => a.id - b.id).map((f) => nationalWinner(f)!);
    pairs = [];
    for (let i = 0; i + 1 < winners.length; i += 2) pairs.push([winners[i]!, winners[i + 1]!]);
    round = last + 1;
  }
  const planned = tournamentDate(state.year, round);
  const date = planned > world.date ? planned : addDays(world.date, 1);
  for (const [home, away] of pairs) {
    state.fixtures.push({ id: state.nextFixtureId++, date, homeId: home, awayId: away, competition: 'tournament', round, result: null });
  }
}

function turkeyStage(state: InternationalState): TurkeyStage {
  const ours = tournamentFixtures(state).filter((f) => f.homeId === HOME_NATION || f.awayId === HOME_NATION);
  if (ours.length === 0) return 'notQualified';
  const furthest = Math.max(...ours.map((f) => f.round));
  if (furthest <= TOURNAMENT_GROUP_ROUNDS) return 'group';
  if (furthest === TOURNAMENT_QUARTER) return 'quarter';
  if (furthest === TOURNAMENT_SEMI) return 'semi';
  return nationalWinner(ours.find((f) => f.round === TOURNAMENT_FINAL)!) === HOME_NATION ? 'winner' : 'final';
}

/** Aşama ilerlemesi: elemelerin sonu, turnuva kurası, eleme turları, şampiyonluk. Tekrar çağrılması güvenli. */
function progressCompetitions(world: GameWorld, data: GameData): void {
  const state = world.international;
  const qualifiers = qualifierFixtures(state);
  if (state.qualified === null && qualifiers.length > 0 && qualifiers.every((f) => f.result)) finishQualifiers(world);
  if (state.qualified !== null && state.tournamentGroups.length === 0 && world.date >= tournamentDrawDate(state.year)) {
    drawTournament(world, data);
  }
  const tournament = tournamentFixtures(state);
  if (tournament.length === 0 || tournament.some((f) => !f.result)) return;
  const final = tournament.find((f) => f.round === TOURNAMENT_FINAL);
  if (!final) {
    nextKnockoutRound(world);
    return;
  }
  if (state.history.some((h) => h.year === state.year)) return;
  const winner = nationalWinner(final)!;
  const runnerUp = winner === final.homeId ? final.awayId : final.homeId;
  state.history.push({ year: state.year, kind: state.kind, winner, runnerUp, turkey: turkeyStage(state) });
  const r = final.result!;
  addNews(world, {
    category: 'international',
    title: `${nationName(data, winner)} ${tournamentTitle(state.year)} şampiyonu!`,
    body: `Finalde ${nationName(data, final.homeId)} ${r.homeGoals}-${r.awayGoals} ${nationName(data, final.awayId)}` +
      `${r.penalties ? ` (penaltılar ${r.penalties.home}-${r.penalties.away})` : ''}. ${nationName(data, winner)} kupayı kaldırdı.`,
    important: winner === HOME_NATION || runnerUp === HOME_NATION,
    clubId: world.playerClubId,
  });
}

/* ------------------------------------------------------------------ */
/* Kamp: kadrolar, maçlar, dönüş                                       */
/* ------------------------------------------------------------------ */

const fullName = (p: Player) => `${p.firstName} ${p.lastName}`;

function upcomingFixtures(state: InternationalState, from: GameDate, days: number): NationalFixture[] {
  const until = addDays(from, days);
  return state.fixtures.filter((f) => !f.result && f.date >= from && f.date <= until);
}

/** İlk maçtan 4 gün önce: maçı olan ülkelerin kadroları; çağrılan oyuncularımız haberi. */
function announceSquads(world: GameWorld, data: GameData): void {
  const state = world.international;
  if (state.campAnnounced !== null) return;
  const soon = upcomingFixtures(state, world.date, ANNOUNCE_DAYS);
  if (soon.length === 0) return;
  state.campAnnounced = world.date;
  const camp = upcomingFixtures(state, world.date, ANNOUNCE_DAYS + DUTY_GAP_DAYS);
  const nations = [...new Set(camp.flatMap((f) => [f.homeId, f.awayId]))];
  const byNation = playersByNation(world);
  const ours: string[] = [];
  for (const code of nations) {
    const ids = selectSquad(world, data, code, byNation);
    state.squads[code] = { date: world.date, ids };
    for (const id of ids) {
      const p = world.players[id];
      if (!p) continue;
      p.morale = Math.min(100, p.morale + CALLUP_MORALE);
      if (p.clubId === world.playerClubId) ours.push(`${fullName(p)} (${nationName(data, code)})`);
    }
  }
  const turkey = state.squads[HOME_NATION];
  const turkeyNames = nations.includes(HOME_NATION) && turkey
    ? turkey.ids.map((id) => nationalPlayer(world, data, id)).filter((p): p is Player => p !== undefined).map((p) => `${p.firstName} ${p.lastName}`)
    : [];
  if (ours.length === 0 && turkeyNames.length === 0) return;
  addNews(world, {
    category: 'international',
    title: ours.length > 0 ? `${ours.length} oyuncumuz milli takıma çağrıldı` : 'Türkiye aday kadrosu açıklandı',
    body: (ours.length > 0 ? `Milli takımlara çağrılan oyuncularımız: ${ours.join(', ')}. ` : '') +
      (turkeyNames.length > 0 ? `Türkiye kadrosu: ${turkeyNames.join(', ')}.` : ''),
    important: ours.length > 0,
    clubId: world.playerClubId,
  });
}

/** Maç günü kadro: sakatlananlar çıkar (yerine sıradaki); kadro bu kampta açıklanmadıysa şimdi seçilir. */
function matchSquad(world: GameWorld, data: GameData, code: string): Player[] {
  const state = world.international;
  const squad = state.squads[code];
  const stale = !squad || (state.campAnnounced !== null && squad.date < state.campAnnounced);
  let ids = squad?.ids ?? [];
  if (stale || ids.some((id) => world.players[id]?.injury || (!isVirtualPlayer(id) && !world.players[id]))) {
    const fresh = selectSquad(world, data, code);
    const kept = stale ? [] : ids.filter((id) => fresh.includes(id));
    ids = [...kept, ...fresh.filter((id) => !kept.includes(id))].slice(0, SQUAD_SIZE);
    state.squads[code] = { date: stale ? world.date : squad!.date, ids };
  }
  for (const id of ids) if (!isVirtualPlayer(id) && !state.onDuty.includes(id)) state.onDuty.push(id);
  // Kulüp cezası milli maçı etkilemez: kopya (motor yalnızca okur)
  return ids.map((id) => nationalPlayer(world, data, id)).filter((p): p is Player => p !== undefined).map((p) => ({ ...p, suspension: 0 }));
}

function teamSetup(code: string, name: string, players: Player[]): TeamSetup {
  const formation = chooseFormation(players);
  return { clubId: code, name, lineup: autoSelectLineup(players, FORMATIONS[formation]), formation };
}

function playNationalFixture(world: GameWorld, data: GameData, f: NationalFixture, rng: Rng): void {
  const home = matchSquad(world, data, f.homeId);
  const away = matchSquad(world, data, f.awayId);
  const lookup: Record<number, Player> = {};
  for (const p of [...home, ...away]) lookup[p.id] = p;
  const tournament = f.competition === 'tournament';
  const state = createMatch({
    fixtureId: f.id,
    home: teamSetup(f.homeId, nationName(data, f.homeId), home),
    away: teamSetup(f.awayId, nationName(data, f.awayId), away),
    seed: rng.int(0, 0xffffffff),
    ...(tournament ? { neutral: true, knockout: f.round > TOURNAMENT_GROUP_ROUNDS } : {}),
  }, lookup);
  simulateToEnd(state, lookup);
  const result = buildResult(state);
  f.result = {
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    ...(result.penalties ? { penalties: result.penalties } : {}),
    goals: result.goals.map((g) => ({
      minute: g.minute,
      ...(g.extra ? { extra: g.extra } : {}),
      side: g.clubId === f.homeId ? 'home' : 'away',
      name: lookup[g.playerId] ? `${lookup[g.playerId]!.firstName} ${lookup[g.playerId]!.lastName}` : '?',
      ...(isVirtualPlayer(g.playerId) ? {} : { playerId: g.playerId }),
      ...(g.kind === 'penalty' ? { penalty: true as const } : {}),
    })),
    players: result.players
      .filter((r) => !isVirtualPlayer(r.playerId) && world.players[r.playerId]?.clubId === world.playerClubId)
      .map((r) => ({ playerId: r.playerId, nation: r.clubId, started: r.started, minutes: r.minutes, rating: r.rating, goals: r.goals })),
  };

  // Dünyadaki oyunculara etkiler: kondisyon, milli maç / gol, moral, sakatlık (kulübüne döner)
  for (const record of result.players) {
    const p = world.players[record.playerId];
    if (!p) continue;
    if (record.condition !== undefined) p.condition = record.condition;
    p.intl = { caps: (p.intl?.caps ?? 0) + 1, goals: (p.intl?.goals ?? 0) + record.goals };
    if (record.rating >= 7.5) p.morale = Math.min(100, p.morale + GOOD_GAME_MORALE);
  }
  const intl = world.international;
  for (const injury of result.injuries) {
    const p = world.players[injury.playerId];
    if (!p) continue;
    injurePlayer(world, p, rng, 'international');
    intl.onDuty = intl.onDuty.filter((id) => id !== p.id);
    const squad = intl.squads[p.nationality];
    if (squad) squad.ids = squad.ids.filter((id) => id !== p.id);
  }
  if (f.homeId === HOME_NATION || f.awayId === HOME_NATION) turkeyResultNews(world, data, f);
}

function goalsText(f: NationalFixture, side: 'home' | 'away'): string {
  const byName = new Map<string, string[]>();
  for (const g of f.result!.goals) {
    if (g.side !== side) continue;
    byName.set(g.name, [...(byName.get(g.name) ?? []), formatMinute(g.minute, g.extra) + (g.penalty ? ' (P)' : '')]);
  }
  return [...byName].map(([name, minutes]) => `${name} ${minutes.join(', ')}`).join('; ');
}

function turkeyResultNews(world: GameWorld, data: GameData, f: NationalFixture): void {
  const r = f.result!;
  const state = world.international;
  const ours = r.players.filter((a) => a.nation === HOME_NATION);
  const scorers = [goalsText(f, 'home'), goalsText(f, 'away')].filter(Boolean).join(' — ');
  addNews(world, {
    category: 'international',
    title: `${nationName(data, f.homeId)} ${r.homeGoals}-${r.awayGoals} ${nationName(data, f.awayId)}` +
      (r.penalties ? ` (P ${r.penalties.home}-${r.penalties.away})` : ''),
    body: `${nationalFixtureLabel(state, f)}.` + (scorers ? ` Goller: ${scorers}.` : '') +
      (ours.length > 0
        ? ` Oyuncularımız: ${ours.map((a) => `${fullName(world.players[a.playerId]!)} (${a.minutes} dk, ${a.rating.toFixed(1)}${a.goals ? `, ${a.goals} gol` : ''})`).join(', ')}.`
        : ''),
    // Gelen kutusunda görünür ama Devam'ı durdurmaz (kadro çağrısı ve sakatlık haberleri durdurur)
    important: false,
    clubId: world.playerClubId,
  });
}

/** Maçı kalmayan ülkelerin oyuncuları kulüplerine döner; kamp bitince oyuncularımızın özeti. */
function releasePlayers(world: GameWorld, data: GameData): void {
  const state = world.international;
  if (state.campAnnounced === null) return;
  const busy = new Set(upcomingFixtures(state, world.date, DUTY_GAP_DAYS).flatMap((f) => [f.homeId, f.awayId]));
  const released = state.onDuty.filter((id) => !world.players[id] || !busy.has(world.players[id]!.nationality));
  state.onDuty = state.onDuty.filter((id) => !released.includes(id));
  const ours = released.map((id) => world.players[id]).filter((p): p is Player => p?.clubId === world.playerClubId);
  if (ours.length > 0) {
    const camp = state.fixtures.filter((f) => f.result && f.date >= state.campAnnounced!);
    const lines = ours.map((p) => {
      const apps = camp.flatMap((f) => f.result!.players.filter((a) => a.playerId === p.id));
      const goals = apps.reduce((s, a) => s + a.goals, 0);
      return `${fullName(p)} (${nationName(data, p.nationality)}): ${apps.length} maç${goals ? `, ${goals} gol` : ''}`;
    });
    addNews(world, {
      category: 'international',
      title: 'Milli takımdan dönen oyuncularımız',
      body: `${lines.join('; ')}.`,
      important: false,
      clubId: world.playerClubId,
    });
  }
  if (busy.size === 0) {
    state.campAnnounced = null;
    state.onDuty = [];
  }
}

/** Oyuncu şu an milli takımda mı? */
export function isOnNationalDuty(world: GameWorld, playerId: number): boolean {
  return world.international.onDuty.includes(playerId);
}

/** Her gün: döngü yenileme, kuralar, kadrolar, milli maçlar ve dönüşler. */
export function internationalDay(world: GameWorld, rng: Rng, data: GameData): void {
  if (world.date >= makeDate(world.international.year, 7, 1)) {
    createInternational(world, data, world.date, world.international.history);
  }
  progressCompetitions(world, data);
  announceSquads(world, data);
  const state = world.international;
  const today = state.fixtures.filter((f) => f.date === world.date && !f.result);
  if (today.length > 0) {
    for (const f of today) playNationalFixture(world, data, f, rng);
    progressCompetitions(world, data);
  }
  releasePlayers(world, data);
}

/** Bugünden sonraki ilk milli maç günü (yoksa null). */
export function nextNationalMatchDate(world: GameWorld): GameDate | null {
  let next: GameDate | null = null;
  for (const f of world.international.fixtures) {
    if (!f.result && f.date > world.date && (next === null || f.date < next)) next = f.date;
  }
  return next;
}
