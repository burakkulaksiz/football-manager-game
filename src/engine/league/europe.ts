/**
 * Avrupa kupaları: Şampiyonlar Ligi (salı) ve Avrupa Ligi (perşembe), 16'şar kulüp. Türkiye'den geçen sezonun
 * sıralamasıyla (ŞL: ilk 2; AL: kupa şampiyonu, 3. ve 4. — kupa şampiyonu zaten katılıyorsa 5.; ilk sezon itibara
 * göre). ŞL'nin kalanı en yüksek itibarlı yabancı kulüpler, AL'ninki en düşük itibarlı yabancı kulüpler (Avrupa'nın orta
 * sınıfı; Türk kulüpleri burada rekabet edebilir). 4'lü 4 grup (rövanşlı 6 maç; aynı ülkeden kulüpler aynı
 * grupta olmaz), ilk iki çeyrek finale. Çeyrek ve yarı final iki maçlı (rövanşta toplamda eşitlik → penaltılar;
 * deplasman golü yok), final tek maç ve tarafsız sahada.
 * Grup kurası 25 Ağustos'ta, sonraki kuralar önceki aşama bitince çekilir. Durum fikstürden türetilir.
 */
import { addDays, formatDateTR, makeDate, weekday, type GameDate } from '../date';
import { addIncome } from '../finance/finance';
import { getClub, leagueClubs } from '../generation/worldGenerator';
import { addNews } from '../news';
import { Rng } from '../rng';
import type { Club, Competition, Fixture, GameWorld } from '../types';
import { fixtureWinner } from './cup';
import { circlePairings } from './schedule';
import { tableFrom, type StandingRow } from './standings';

export type EuropeCompetition = 'cl' | 'el';
export const EUROPE_COMPETITIONS: readonly EuropeCompetition[] = ['cl', 'el'];

export interface EuropePrizes {
  /** Grup aşamasına katılım. */
  participation: number;
  win: number;
  draw: number;
  /** Çeyrek finale kalmak (grupta ilk iki). */
  quarter: number;
  /** Yarı finale çıkmak. */
  semi: number;
  /** Finale çıkmak. */
  final: number;
  /** Kupayı kazanmak (ek). */
  winner: number;
}

export interface EuropeInfo {
  name: string;
  short: string;
  /** Maç günü (0 = pazar): ŞL salı, AL perşembe. */
  weekday: number;
  /** Türkiye'den katılan kulüp sayısı. */
  turkishSlots: number;
  prizes: EuropePrizes;
  /** Kupayı kazanan Türk kulübünün yönetim güvenine katkısı. */
  boardBonus: number;
}

export const EUROPE: Record<EuropeCompetition, EuropeInfo> = {
  cl: {
    name: 'Şampiyonlar Ligi',
    short: 'ŞL',
    weekday: 2,
    turkishSlots: 2,
    prizes: { participation: 8_000_000, win: 1_500_000, draw: 500_000, quarter: 4_000_000, semi: 6_000_000, final: 5_000_000, winner: 10_000_000 },
    boardBonus: 25,
  },
  el: {
    name: 'Avrupa Ligi',
    short: 'AL',
    weekday: 4,
    turkishSlots: 3,
    prizes: { participation: 3_000_000, win: 600_000, draw: 200_000, quarter: 1_500_000, semi: 2_000_000, final: 2_500_000, winner: 5_000_000 },
    boardBonus: 15,
  },
};

export const EUROPE_TEAMS = 16;
export const GROUPS = ['A', 'B', 'C', 'D'] as const;
export const GROUP_ROUNDS = 6;
export const QUARTER_FIRST = 7;
export const QUARTER_SECOND = 8;
export const SEMI_FIRST = 9;
export const SEMI_SECOND = 10;
export const EUROPE_FINAL = 11;

/** Aşamaların planlanan tarihi: bu günden sonraki ilk maç günü (Temmuz öncesi ay sezonun ikinci yılında). */
const STAGE_DATES: readonly [number, number][] = [
  [9, 14], [9, 28], [10, 19], [11, 2], [11, 23], [12, 7], // grup maçları
  [3, 8], [3, 15], [4, 12], [4, 19], // çeyrek ve yarı final
  [5, 18], // final (ligin bitiminden sonra)
];
const GROUP_DRAW: readonly [number, number] = [8, 25];
const EUROPE_SEED_SALT = 0x3e7a91c5;
const MIN_DAYS_TO_MATCH = 3;

export function isEuropeCompetition(c: Competition | undefined): c is EuropeCompetition {
  return c === 'cl' || c === 'el';
}

export function isEuropeFixture(f: Fixture): boolean {
  return isEuropeCompetition(f.competition);
}

export function stageName(round: number, group?: string): string {
  if (round <= GROUP_ROUNDS) return group ? `${group} Grubu, ${round}. Maç` : `Grup ${round}. Maç`;
  return ['Çeyrek Final 1. Maç', 'Çeyrek Final rövanş', 'Yarı Final 1. Maç', 'Yarı Final rövanş', 'Final'][round - QUARTER_FIRST] ?? `${round}. Aşama`;
}

/** Aşamanın planlanan tarihi. */
export function stageDate(seasonYear: number, comp: EuropeCompetition, round: number): GameDate {
  const [month, day] = STAGE_DATES[round - 1]!;
  return nextWeekday(makeDate(month >= 7 ? seasonYear : seasonYear + 1, month, day), EUROPE[comp].weekday);
}

function nextWeekday(date: GameDate, day: number): GameDate {
  let d = date;
  while (weekday(d) !== day) d = addDays(d, 1);
  return d;
}

export function europeFixtures(world: GameWorld, comp: EuropeCompetition, round?: number): Fixture[] {
  return world.season.fixtures.filter((f) => f.competition === comp && (round === undefined || f.round === round));
}

/** Gruptaki kulüpler (kura sırasıyla) ve puan tablosu. */
export function groupTable(world: GameWorld, comp: EuropeCompetition, group: string): StandingRow[] {
  const fixtures = europeFixtures(world, comp).filter((f) => f.group === group);
  const ids = [...new Set(fixtures.flatMap((f) => [f.homeId, f.awayId]))];
  return tableFrom(ids, fixtures);
}

/** Rövanşın ilk maçı. */
export function firstLeg(world: GameWorld, secondLeg: Fixture): Fixture | undefined {
  return world.season.fixtures.find((f) =>
    f.competition === secondLeg.competition && f.round === secondLeg.round - 1 && f.homeId === secondLeg.awayId && f.awayId === secondLeg.homeId);
}

/** Rövanşın toplam skoru (rövanşın ev sahibi / deplasmanı açısından); ilk maç oynanmadıysa null. */
export function aggregateScore(world: GameWorld, secondLeg: Fixture): { home: number; away: number } | null {
  const leg = firstLeg(world, secondLeg);
  if (!leg?.result || !secondLeg.result) return null;
  return { home: secondLeg.result.homeGoals + leg.result.awayGoals, away: secondLeg.result.awayGoals + leg.result.homeGoals };
}

/** Rövanşın maç kurulumuna ilk maçın golleri (bu maçın ev sahibi / deplasmanı açısından). */
export function firstLegGoals(world: GameWorld, secondLeg: Fixture): { home: number; away: number } | undefined {
  const leg = firstLeg(world, secondLeg);
  return leg?.result ? { home: leg.result.awayGoals, away: leg.result.homeGoals } : undefined;
}

/** İki maçlı eşleşmenin (rövanş) ya da finalin kazananı. */
export function tieWinner(world: GameWorld, fixture: Fixture): string | null {
  if (fixture.round === EUROPE_FINAL) return fixtureWinner(fixture);
  const agg = aggregateScore(world, fixture);
  if (!agg) return null;
  if (agg.home !== agg.away) return agg.home > agg.away ? fixture.homeId : fixture.awayId;
  const p = fixture.result!.penalties;
  return p ? (p.home > p.away ? fixture.homeId : fixture.awayId) : null;
}

/** Maç kurulumu için: eleme (rövanş ve final), tarafsız saha (final), ilk maçın golleri. */
export function europeMatchOptions(world: GameWorld, fixture: Fixture): { knockout?: boolean; neutral?: boolean; aggregate?: { home: number; away: number } } {
  if (fixture.round === EUROPE_FINAL) return { knockout: true, neutral: true };
  if (fixture.round === QUARTER_SECOND || fixture.round === SEMI_SECOND) return { knockout: true, aggregate: firstLegGoals(world, fixture) };
  return {};
}

export function europeChampion(world: GameWorld, comp: EuropeCompetition): string | null {
  const final = europeFixtures(world, comp, EUROPE_FINAL)[0];
  return final ? fixtureWinner(final) : null;
}

/** Kulübün bu sezonki Avrupa kupası (katılıyorsa). */
export function europeCompetitionOf(world: GameWorld, clubId: string): EuropeCompetition | null {
  for (const comp of EUROPE_COMPETITIONS) {
    if (europeFixtures(world, comp).some((f) => f.homeId === clubId || f.awayId === clubId)) return comp;
  }
  return null;
}

const countryOf = (club: Club) => club.country ?? 'TUR';

/** Türkiye'den katılanlar: geçen sezonun sıralaması ve kupa şampiyonu (ilk sezon itibar). */
export function turkishQualifiers(world: GameWorld): Record<EuropeCompetition, string[]> {
  const last = world.history[world.history.length - 1];
  const fromTable = last && last.year === world.season.year - 1;
  const exists = (id: string) => world.clubs.some((c) => c.id === id && c.country === undefined);
  const order = fromTable
    ? last.table.map((r) => r.clubId).filter(exists)
    : leagueClubs(world).sort((a, b) => b.reputation - a.reputation).map((c) => c.id);
  const cl = order.slice(0, EUROPE.cl.turkishSlots);
  const cupWinner = fromTable && last.cupWinnerId && exists(last.cupWinnerId) && !cl.includes(last.cupWinnerId) ? [last.cupWinnerId] : [];
  const el = [...cupWinner, ...order.slice(cl.length).filter((id) => !cupWinner.includes(id))].slice(0, EUROPE.el.turkishSlots);
  return { cl, el };
}

/**
 * Yurtdışından Avrupa kontenjanı (ülke → [ŞL, AL]): ŞL 14 + AL 13; kalan yerler Türkiye'nin (2 + 3). Veride olmayan ülkenin
 * boş kalan yeri itibar sırasıyla (ülke sınırıyla) dolar.
 */
export const FOREIGN_EUROPE_SLOTS: Readonly<Record<string, readonly [number, number]>> = {
  ENG: [3, 2], ESP: [3, 2], GER: [2, 2], ITA: [2, 2], FRA: [2, 2], POR: [1, 1], NED: [1, 1], BEL: [0, 1],
};

/** Yurtdışından katılanlar: her ülkeden geçen sezonun lig sırasıyla (ilk sezon itibar) kontenjan kadar; ŞL önce. */
export function foreignQualifiers(world: GameWorld): Record<EuropeCompetition, string[]> {
  const last = world.history[world.history.length - 1];
  const tables = last && last.year === world.season.year - 1 ? last.leagues ?? [] : [];
  const foreign = world.clubs.filter((c) => c.country !== undefined);
  const order = (country: string) => {
    const ranked = foreign.filter((c) => c.country === country).sort((a, b) => b.reputation - a.reputation).map((c) => c.id);
    const table = tables.find((t) => t.league === country)?.table.map((r) => r.clubId).filter((id) => ranked.includes(id)) ?? [];
    return [...table, ...ranked.filter((id) => !table.includes(id))];
  };
  const cl: string[] = [];
  const el: string[] = [];
  for (const country of new Set(foreign.map((c) => c.country!))) {
    const [clSlots, elSlots] = FOREIGN_EUROPE_SLOTS[country] ?? [0, 0];
    const ids = order(country);
    cl.push(...ids.slice(0, clSlots));
    el.push(...ids.slice(clSlots, clSlots + elSlots));
  }
  const byReputation = foreign.sort((a, b) => b.reputation - a.reputation).map((c) => c.id);
  const turkish = turkishQualifiers(world);
  cl.push(...pickWithCountryCap(world, byReputation.filter((id) => !cl.includes(id) && !el.includes(id)), EUROPE_TEAMS - turkish.cl.length - cl.length, [...turkish.cl, ...cl]));
  el.push(...pickWithCountryCap(world, byReputation.filter((id) => !cl.includes(id) && !el.includes(id)), EUROPE_TEAMS - turkish.el.length - el.length, [...turkish.el, ...el]));
  return { cl: cl.slice(0, EUROPE_TEAMS - turkish.cl.length), el: el.slice(0, EUROPE_TEAMS - turkish.el.length) };
}

function drawRng(world: GameWorld, comp: EuropeCompetition, round: number): Rng {
  const salt = Math.imul(world.season.year * 32 + round * 2 + (comp === 'cl' ? 0 : 1), 2654435761);
  return new Rng((world.seed ^ EUROPE_SEED_SALT ^ salt) >>> 0);
}

function nextFixtureId(world: GameWorld): number {
  return world.season.fixtures.reduce((max, f) => Math.max(max, f.id), 0) + 1;
}

/** Aşamanın tarihi: planlanan, ama en erken `after` gününden sonraki ilk maç günü. */
function dateFor(world: GameWorld, comp: EuropeCompetition, round: number, after: GameDate): GameDate {
  const planned = stageDate(world.season.year, comp, round);
  return planned >= after ? planned : nextWeekday(after, EUROPE[comp].weekday);
}

function payPrize(world: GameWorld, clubId: string, amount: number): void {
  const fin = world.finances[clubId];
  if (fin && amount > 0) addIncome(fin, 'prize', amount);
}

function names(world: GameWorld, ids: readonly string[]): string {
  return ids.map((id) => getClub(world, id).name).join(', ');
}

/** Gruplar: itibara göre 4 torba; her torbadan her gruba bir kulüp, aynı ülkeden ikisi aynı grupta olmasın. */
/** Dizinin tüm sıralamaları (4 eleman → 24). */
function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

/** Bir ülkeden en çok bu kadar kulüp (4 grupta ülke çakışması olmasın). */
const MAX_PER_COUNTRY = GROUPS.length;

/** Havuzdan sırayla, ülke sınırını aşmadan `count` kulüp (Türk katılımcılar ülke sayısına dahil). */
function pickWithCountryCap(world: GameWorld, ordered: readonly string[], count: number, already: readonly string[]): string[] {
  const perCountry = new Map<string, number>();
  for (const id of already) perCountry.set(countryOf(getClub(world, id)), (perCountry.get(countryOf(getClub(world, id))) ?? 0) + 1);
  const picked: string[] = [];
  for (const id of ordered) {
    if (picked.length >= count) break;
    const c = countryOf(getClub(world, id));
    if ((perCountry.get(c) ?? 0) >= MAX_PER_COUNTRY) continue;
    perCountry.set(c, (perCountry.get(c) ?? 0) + 1);
    picked.push(id);
  }
  return picked;
}

function drawGroups(world: GameWorld, comp: EuropeCompetition, teams: string[]): void {
  const rng = drawRng(world, comp, 0);
  const sorted = [...teams].sort((a, b) => getClub(world, b).reputation - getClub(world, a).reputation);
  const pots = [0, 1, 2, 3].map((p) => rng.shuffle(sorted.slice(p * 4, p * 4 + 4)));
  const country = (id: string) => countryOf(getClub(world, id));
  const groups: string[][] = GROUPS.map(() => []);
  // Torba torba geri izlemeli yerleştirme: aynı ülkeden iki kulüp aynı gruba düşmesin (mümkün değilse torba sırasıyla)
  const place = (pot: number): boolean => {
    if (pot === pots.length) return true;
    for (const order of permutations(pots[pot]!)) {
      if (order.some((id, g) => groups[g]!.some((other) => country(other) === country(id)))) continue;
      order.forEach((id, g) => groups[g]!.push(id));
      if (place(pot + 1)) return true;
      for (const g of groups) g.pop();
    }
    return false;
  };
  if (!place(0)) pots.forEach((pot) => pot.forEach((id, g) => groups[g]!.push(id)));

  let id = nextFixtureId(world);
  const dates: GameDate[] = [];
  for (let round = 1; round <= GROUP_ROUNDS; round++) {
    const after = round === 1 ? addDays(world.date, MIN_DAYS_TO_MATCH) : addDays(dates[round - 2]!, 7);
    dates.push(dateFor(world, comp, round, after));
  }
  groups.forEach((members, g) => {
    // Çember yöntemi: 3 tur; ev/deplasman turdan tura değişir, ikinci yarı tersi
    circlePairings(members).forEach((pairs, r) => {
      for (const [a, b] of pairs) {
        const [home, away] = r % 2 === 0 ? [a, b] : [b, a];
        const base = { result: null, competition: comp, group: GROUPS[g] } as const;
        world.season.fixtures.push({ ...base, id: id++, round: r + 1, date: dates[r]!, homeId: home, awayId: away });
        world.season.fixtures.push({ ...base, id: id++, round: r + 4, date: dates[r + 3]!, homeId: away, awayId: home });
      }
    });
  });

  for (const team of teams) payPrize(world, team, EUROPE[comp].prizes.participation);
  const info = EUROPE[comp];
  const user = world.playerClubId;
  const userGroup = groups.findIndex((m) => m.includes(user));
  const lines = groups.map((m, g) => `${GROUPS[g]} Grubu: ${names(world, m)}`).join('. ');
  addNews(world, {
    category: 'europe',
    title: userGroup >= 0
      ? `${info.name} ${GROUPS[userGroup]} Grubu: ${names(world, groups[userGroup]!.filter((x) => x !== user))}`
      : `${info.name} grup kurası çekildi`,
    body: `${info.name} grup kurası çekildi. ${lines}. İlk maçlar ${formatDateTR(dates[0]!)}.` +
      (userGroup >= 0 ? ` Katılım ödülü: €${info.prizes.participation.toLocaleString('tr-TR')}.` : ''),
    important: userGroup >= 0,
    clubId: user,
  });
}

/** Çeyrek final: grup birincileri başka grubun ikincileriyle; ilk maç ikincinin, rövanş birincinin evinde. */
function drawQuarterFinals(world: GameWorld, comp: EuropeCompetition): void {
  const rng = drawRng(world, comp, QUARTER_FIRST);
  const tables = GROUPS.map((g) => groupTable(world, comp, g));
  const winners = tables.map((t) => t[0]!.clubId);
  const runners = tables.map((t) => t[1]!.clubId);
  let order = rng.shuffle([0, 1, 2, 3]);
  for (let attempt = 0; attempt < 100 && order.some((r, w) => r === w); attempt++) order = rng.shuffle([0, 1, 2, 3]);

  const user = world.playerClubId;
  const info = EUROPE[comp];
  // Grup aşaması bitti: ilk ikiye çeyrek final ödülü; kullanıcıya grup sonucu
  for (const id of [...winners, ...runners]) payPrize(world, id, info.prizes.quarter);
  tables.forEach((t, g) => {
    const position = t.findIndex((r) => r.clubId === user);
    if (position < 0) return;
    if (position < 2) {
      world.board.confidence = Math.min(100, world.board.confidence + 5);
      bumpReputation(world, user, 1);
    }
    addNews(world, {
      category: 'europe',
      title: position < 2 ? `${info.name}: gruptan çıktık (${GROUPS[g]} Grubu ${position + 1}.)` : `${info.name}: grupta elendik`,
      body: position < 2
        ? `${GROUPS[g]} Grubunu ${position + 1}. sırada bitirdik ve çeyrek finale yükseldik.`
        : `${GROUPS[g]} Grubunu ${position + 1}. sırada bitirdik; ${info.name} macerası sona erdi.`,
      important: true,
      clubId: user,
    });
  });

  const legs = drawLegs(world, comp, QUARTER_FIRST, winners.map((w, i) => [runners[order[i]!]!, w] as [string, string]));
  announceDraw(world, comp, 'Çeyrek final', legs);
}

/** Yarı final ya da final kurası: önceki aşamayı geçenler. */
function drawNextKnockout(world: GameWorld, comp: EuropeCompetition, previousSecondLeg: number): void {
  const winners = europeFixtures(world, comp, previousSecondLeg).map((f) => tieWinner(world, f)!);
  if (previousSecondLeg === SEMI_SECOND) {
    const date = dateFor(world, comp, EUROPE_FINAL, addDays(world.date, MIN_DAYS_TO_MATCH));
    const final: Fixture = { id: nextFixtureId(world), round: EUROPE_FINAL, date, homeId: winners[0]!, awayId: winners[1]!, result: null, competition: comp };
    world.season.fixtures.push(final);
    announceDraw(world, comp, 'Final', [final]);
    return;
  }
  const order = drawRng(world, comp, SEMI_FIRST).shuffle([...winners]);
  const legs = drawLegs(world, comp, SEMI_FIRST, [[order[0]!, order[1]!], [order[2]!, order[3]!]]);
  announceDraw(world, comp, 'Yarı final', legs);
}

/** İki maçlı eşleşmeler: [ilk maçın ev sahibi, rövanşın ev sahibi]. */
function drawLegs(world: GameWorld, comp: EuropeCompetition, firstRound: number, ties: [string, string][]): Fixture[] {
  const first = dateFor(world, comp, firstRound, addDays(world.date, MIN_DAYS_TO_MATCH));
  const second = dateFor(world, comp, firstRound + 1, addDays(first, 7));
  let id = nextFixtureId(world);
  const fixtures: Fixture[] = [];
  for (const [a, b] of ties) {
    fixtures.push({ id: id++, round: firstRound, date: first, homeId: a, awayId: b, result: null, competition: comp });
    fixtures.push({ id: id++, round: firstRound + 1, date: second, homeId: b, awayId: a, result: null, competition: comp });
  }
  world.season.fixtures.push(...fixtures);
  return fixtures.filter((f) => f.round === firstRound);
}

function announceDraw(world: GameWorld, comp: EuropeCompetition, stage: string, fixtures: Fixture[]): void {
  const info = EUROPE[comp];
  const user = world.playerClubId;
  const ours = fixtures.find((f) => f.homeId === user || f.awayId === user);
  const pairs = fixtures.map((f) => `${getClub(world, f.homeId).name} – ${getClub(world, f.awayId).name}`).join(', ');
  const opponent = ours ? getClub(world, ours.homeId === user ? ours.awayId : ours.homeId).name : '';
  addNews(world, {
    category: 'europe',
    title: ours ? `${info.name} ${stage.toLowerCase()}: rakibimiz ${opponent}` : `${info.name} ${stage.toLowerCase()} kurası çekildi`,
    body: `${info.name} ${stage.toLowerCase()} eşleşmeleri: ${pairs}. ${stage === 'Final' ? 'Final' : 'İlk maçlar'} ${formatDateTR(fixtures[0]!.date)}.`,
    important: ours !== undefined,
    clubId: user,
  });
}

function bumpReputation(world: GameWorld, clubId: string, amount: number): void {
  const club = getClub(world, clubId);
  if (club.country === undefined) club.reputation = Math.min(100, club.reputation + amount);
}

/**
 * Her gün: Avrupa kuraları. Grup kurası 25 Ağustos'tan itibaren (ilk maça yetişecekse; sezon ortasında açılan
 * eski kayıtta o sezon Avrupa oynanmaz), sonraki aşamalar önceki aşama bitince.
 */
export function europeDay(world: GameWorld): void {
  if (world.seasonState !== 'running') return;
  for (const comp of EUROPE_COMPETITIONS) {
    const fixtures = europeFixtures(world, comp);
    if (fixtures.length === 0) {
      const year = world.season.year;
      const drawDate = makeDate(year, GROUP_DRAW[0], GROUP_DRAW[1]);
      if (world.date < drawDate || world.date > addDays(stageDate(year, comp, 1), -MIN_DAYS_TO_MATCH)) continue;
      const turkish = turkishQualifiers(world)[comp];
      drawGroups(world, comp, [...turkish, ...foreignQualifiers(world)[comp]]);
      continue;
    }
    const stage = Math.max(...fixtures.map((f) => f.round));
    if (stage === EUROPE_FINAL || fixtures.some((f) => f.round === stage && !f.result)) continue;
    if (stage === GROUP_ROUNDS) drawQuarterFinals(world, comp);
    else if (stage === QUARTER_SECOND || stage === SEMI_SECOND) drawNextKnockout(world, comp, stage);
  }
}

/** Avrupa maçından sonra: grup maçı primi, eşleşmeyi geçene ödül, kullanıcıya haber, şampiyonluk. */
export function europeAfterMatch(world: GameWorld, fixture: Fixture): void {
  const comp = fixture.competition;
  if (!isEuropeCompetition(comp) || !fixture.result) return;
  const info = EUROPE[comp];
  const user = world.playerClubId;
  const r = fixture.result;
  if (fixture.round <= GROUP_ROUNDS) {
    if (r.homeGoals === r.awayGoals) {
      payPrize(world, fixture.homeId, info.prizes.draw);
      payPrize(world, fixture.awayId, info.prizes.draw);
    } else {
      payPrize(world, r.homeGoals > r.awayGoals ? fixture.homeId : fixture.awayId, info.prizes.win);
    }
    return;
  }
  if (fixture.round === QUARTER_FIRST || fixture.round === SEMI_FIRST) return;

  const winner = tieWinner(world, fixture);
  if (!winner) return;
  const loser = winner === fixture.homeId ? fixture.awayId : fixture.homeId;
  const involved = winner === user || loser === user;
  const agg = aggregateScore(world, fixture);
  const score = fixture.round === EUROPE_FINAL
    ? `${r.homeGoals}-${r.awayGoals}`
    : `toplamda ${agg ? `${Math.max(agg.home, agg.away)}-${Math.min(agg.home, agg.away)}` : ''}`;
  const penalties = r.penalties ? ` (penaltılarla ${Math.max(r.penalties.home, r.penalties.away)}-${Math.min(r.penalties.home, r.penalties.away)})` : '';

  if (fixture.round === EUROPE_FINAL) {
    payPrize(world, winner, info.prizes.winner);
    if (winner === user) {
      world.manager.europeTitles = (world.manager.europeTitles ?? 0) + 1;
      world.board.confidence = Math.min(100, world.board.confidence + info.boardBonus);
    }
    bumpReputation(world, winner, 3);
    addNews(world, {
      category: 'europe',
      title: `${getClub(world, winner).name} ${info.name} şampiyonu!`,
      body: `${info.name} finalinde ${getClub(world, winner).name}, ${getClub(world, loser).name} karşısında ${score}${penalties} kazandı.`,
      important: involved,
      clubId: winner,
    });
    return;
  }

  // Çeyrek finali geçen yarı finale, yarı finali geçen finale
  const next = fixture.round === QUARTER_SECOND ? 'yarı final' : 'final';
  const nextDative = fixture.round === QUARTER_SECOND ? 'yarı finale' : 'finale';
  payPrize(world, winner, fixture.round === QUARTER_SECOND ? info.prizes.semi : info.prizes.final);
  if (!involved) return;
  if (winner === user) {
    world.board.confidence = Math.min(100, world.board.confidence + 5);
    bumpReputation(world, user, 1);
  }
  addNews(world, {
    category: 'europe',
    title: winner === user ? `${info.name}: ${next} biletini aldık!` : `${info.name}'ne veda`,
    body: winner === user
      ? `${getClub(world, loser).name} eşleşmesini ${score}${penalties} kazandık ve ${nextDative} yükseldik.`
      : `${getClub(world, winner).name} eşleşmesini ${score}${penalties} kaybettik; ${info.name} macerası sona erdi.`,
    important: true,
    clubId: user,
  });
}
